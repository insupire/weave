"""Check templates and valuesets.

Two layers. The first is the canonical JSON Schema looking at structure. The second
looks only at what JSON Schema cannot say — duplicate keys inside one document, a
valueset compared against its template, the axis order of a series. The vocabulary
and the shapes all belong to the first layer.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from dataclasses import dataclass, field

from weave import schemas
from weave.schemas import documents

SHAPE_DEF = {
    "single": "#/$defs/ValueSingle",
    "range": "#/$defs/ValueRange",
    "series": "#/$defs/ValueSeries",
    "items": "#/$defs/ValueItems",
}


@dataclass(frozen=True)
class Problem:
    where: str
    message: str

    def __str__(self) -> str:
        return f"{self.where}: {self.message}"


@dataclass
class Result:
    problems: list[Problem] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.problems

    def add(self, where: str, message: str) -> None:
        self.problems.append(Problem(where, message))


def _structural(result: Result, schema_id: str, doc: object, prefix: str = "$") -> bool:
    errors = sorted(
        schemas.validator(schema_id).iter_errors(doc), key=lambda e: list(e.absolute_path)
    )
    for error in errors:
        where = prefix + "".join(f"[{p!r}]" if isinstance(p, str) else f"[{p}]" for p in error.absolute_path)
        result.add(where, error.message)
    return not errors


def _scalar(result: Result, where: str, type_name: str, value: object) -> None:
    pointer = "#/$defs/" + type_name.capitalize()
    if not schemas.validator(schemas.COMMON, pointer).is_valid(value):
        result.add(where, f"not a valid {type_name} value (check it is normalized to the base unit): {value!r}")


def _duplicates(names: list[str]) -> list[str]:
    seen: set[str] = set()
    dupes: list[str] = []
    for name in names:
        if name in seen and name not in dupes:
            dupes.append(name)
        seen.add(name)
    return dupes


def check_template(doc: object) -> Result:
    """Check a template. The side that writes templates calls this right after producing one."""
    result = Result()
    if not _structural(result, schemas.TEMPLATE, doc):
        return result
    assert isinstance(doc, dict)

    for name in _duplicates([f["id"] for f in doc["facets"]]):
        result.add("$['facets']", f"duplicate facet id: {name}")

    choices = {c["id"]: [o["id"] for o in c["options"]] for c in doc.get("choices", [])}
    for name in _duplicates([c["id"] for c in doc.get("choices", [])]):
        result.add("$['choices']", f"duplicate choice id: {name}")
    for index, choice in enumerate(doc.get("choices", [])):
        for name in _duplicates([o["id"] for o in choice["options"]]):
            result.add(f"$['choices'][{index}]", f"duplicate option id: {name}")

    for index, facet in enumerate(doc["facets"]):
        base = f"$['facets'][{index}]"
        for name in _duplicates([f["key"] for f in facet["fields"]]):
            result.add(base, f"duplicate field key: {name}")
        for findex, decl in enumerate(facet["fields"]):
            if decl["shape"] == "items":
                columns = [c["key"] for c in decl["columns"]]
                for name in _duplicates(columns):
                    result.add(f"{base}['fields'][{findex}]", f"duplicate column key: {name}")
            # parts splits one whole, so its second column must be the share. What cannot be split cannot be drawn.
            if facet["element"] == "parts" and decl["shape"] == "items":
                share = decl["columns"][1] if len(decl["columns"]) > 1 else None
                numeric = documents()[schemas.COMMON]["$defs"]["NumericType"]["enum"]
                if share is None or share["type"] not in numeric:
                    result.add(
                        f"{base}['fields'][{findex}]",
                        "the second column of parts is the share, so it must be a numeric type",
                    )
            # A field riding an undeclared choice has nothing to point at.
            where = f"{base}['fields'][{findex}]"
            if "choice" in decl and decl["choice"] not in choices:
                result.add(where, f"choice not declared by the template: {decl['choice']}")
    return result


def check_render_args(doc: object) -> Result:
    """Check render args. Only the three screen states (``focus`` · ``previousFocus`` · ``choices``), structure only.

    An id that no valueset carries is not a defect — the convention is that this
    state simply drops. ``previousFocus`` equal to ``focus`` is not a defect either:
    the previous cannot be the current, so the render reads it as having no previous.
    """
    result = Result()
    _structural(result, schemas.RENDER_ARGS, doc)
    return result


def check_valueset(doc: object, template: object | None = None) -> Result:
    """Check one valueset. The side that fills values calls this right after finishing one subject.

    Without ``template`` only the structure is checked. Types, shapes and coverage
    cannot be known without the template.
    """
    result = Result()
    if not _structural(result, schemas.VALUESET, doc):
        return result
    assert isinstance(doc, dict)
    if template is None:
        return result

    tresult = check_template(template)
    if not tresult.ok:
        result.add("$", "the template itself does not match the schema, so values cannot be compared against it")
        return result
    assert isinstance(template, dict)

    if doc["templateId"] != template["id"]:
        result.add("$['templateId']", f"template id does not match: {doc['templateId']!r} != {template['id']!r}")

    facets = {f["id"]: f for f in template["facets"]}
    _compare_keys(result, "$['facets']", "facet", set(facets), set(doc["facets"]))
    choices = {c["id"]: {o["id"] for o in c["options"]} for c in template.get("choices", [])}

    for facet_id, declared in facets.items():
        given = doc["facets"].get(facet_id)
        if given is None:
            continue
        base = f"$['facets'][{facet_id!r}]"
        decls = {d["key"]: d for d in declared["fields"]}
        _compare_keys(result, f"{base}['fields']", "field", set(decls), set(given["fields"]))
        for key, decl in decls.items():
            slot = given["fields"].get(key)
            if slot is None:
                continue
            where = f"{base}['fields'][{key!r}]"
            for label, entry in _entries(result, where, decl, choices, slot):
                if entry["state"] != "filled":
                    continue
                _check_value(result, f"{label}['value']", decl, entry["value"])
                if "allowed" in decl and entry["value"] not in decl["allowed"]:
                    result.add(f"{label}['value']", f"not an allowed value: {entry['value']!r}")
    return result


def _entries(result: Result, where: str, decl: dict, choices: dict, slot: dict):
    """The values to check at one field slot. One per option when the field rides a choice.

    **The template decides which shape it must be.** The schema accepts both, so the
    split happens here — a single value on a riding field, or a per-option value on a
    field that does not ride, is the defect.

    **Fill as much as was declared.** Six options mean six values — a value that invents
    an option shows up here.
    """
    rides = decl.get("choice")
    given = "byOption" in slot
    if rides and not given:
        result.add(where, f"field rides the choice ({rides}) but carries a single value")
        return []
    if not rides and given:
        result.add(where, "field rides no choice but carries a value per option")
        return []
    if not rides:
        return [(where, slot)]
    _compare_keys(result, f"{where}['byOption']", "option", choices.get(rides, set()), set(slot["byOption"]))
    return [
        (f"{where}['byOption'][{name!r}]", entry)
        for name, entry in slot["byOption"].items()
        if name in choices.get(rides, set())
    ]


def _compare_keys(result: Result, where: str, what: str, declared: set[str], given: set[str]) -> None:
    for name in sorted(declared - given):
        result.add(where, f"declared {what} is missing: {name}")
    for name in sorted(given - declared):
        result.add(where, f"{what} not in the template: {name}")


def _check_value(result: Result, where: str, decl: dict, value: object) -> None:
    shape = decl["shape"]
    if not _structural(result, schemas.VALUESET + SHAPE_DEF[shape], value, prefix=where):
        return

    if shape == "single":
        _scalar(result, where, decl["type"], value)
    elif shape == "range":
        assert isinstance(value, dict)
        for bound in ("min", "max"):
            if bound in value:
                _scalar(result, f"{where}[{bound!r}]", decl["type"], value[bound])
        if "min" in value and "max" in value and _gt(value["min"], value["max"]):
            result.add(where, "range min is greater than max")
    elif shape == "series":
        assert isinstance(value, list)
        previous = None
        for index, point in enumerate(value):
            _scalar(result, f"{where}[{index}]['at']", decl["axis"], point["at"])
            _scalar(result, f"{where}[{index}]['value']", decl["type"], point["value"])
            if previous is not None and not _gt(point["at"], previous):
                result.add(f"{where}[{index}]['at']", "series at values must ascend and never repeat")
            previous = point["at"]
    elif shape == "items":
        assert isinstance(value, list)
        columns = {c["key"]: c for c in decl["columns"]}
        for index, item in enumerate(value):
            for key, cell in item.items():
                column = columns.get(key)
                if column is None:
                    result.add(f"{where}[{index}]", f"column not in the template: {key}")
                    continue
                spot = f"{where}[{index}][{key!r}]"
                _scalar(result, spot, column["type"], cell)
                # A column closed list follows the same discipline as a field one — just one layer deeper.
                if "allowed" in column and cell not in column["allowed"]:
                    result.add(spot, f"not an allowed value: {cell!r}")


def _gt(left: object, right: object) -> bool:
    try:
        return left > right  # type: ignore[operator]
    except TypeError:
        return False


def _load(path: str) -> object:
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    from weave import __version__  # imported here — at module level it would loop back.

    parser = argparse.ArgumentParser(prog="python -m weave.check", description="weave schema checker")
    # Ask what it measured with from the shell too. The library side reads the same value
    # from `weave.__version__`.
    parser.add_argument("--version", action="version", version=f"weave {__version__}")
    sub = parser.add_subparsers(dest="what", required=True)

    p_template = sub.add_parser("template", help="check an analysis template")
    p_template.add_argument("files", nargs="+")

    p_values = sub.add_parser("values", help="check one valueset")
    p_values.add_argument("--template", required=False, help="the analysis template to check against")
    p_values.add_argument("files", nargs="+")

    p_args = sub.add_parser("args", help="check render args")
    p_args.add_argument("files", nargs="+")

    args = parser.parse_args(argv)

    try:
        template = _load(args.template) if getattr(args, "template", None) else None
    except (OSError, json.JSONDecodeError) as exc:
        print(f"could not read the template: {exc}", file=sys.stderr)
        return 2

    failed = False
    for path in args.files:
        try:
            doc = _load(path)
        except (OSError, json.JSONDecodeError) as exc:
            print(f"FAIL {path}\n  could not read: {exc}")
            failed = True
            continue
        if args.what == "template":
            result = check_template(doc)
        elif args.what == "args":
            result = check_render_args(doc)
        else:
            result = check_valueset(doc, template)
        if result.ok:
            print(f"OK   {path}")
        else:
            failed = True
            print(f"FAIL {path}")
            for problem in result.problems:
                print(f"  {problem}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
