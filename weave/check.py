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


def _spot(path) -> str:
    return "".join(f"[{p!r}]" if isinstance(p, str) else f"[{p}]" for p in path)


def _because(error) -> str:
    """One schema error's message, with the branch failures an ``anyOf`` folds away.

    Folded, the reader is told the value is wrong under *something* and never what any
    of the alternatives wanted — which is exactly the part they cannot recover. The
    branch failures are placed relative to the value the branches were tried on.
    """
    if not error.context:
        return error.message
    inner: list[str] = []
    for sub in sorted(error.context, key=lambda e: list(e.relative_path)):
        spot = _spot(sub.relative_path)
        line = f"{spot}: {_because(sub)}" if spot else _because(sub)
        if line not in inner:
            inner.append(line)
    return f"{error.message}  because: {'; '.join(inner)}"


def _structural(result: Result, schema_id: str, doc: object, prefix: str = "$", note: str = "") -> bool:
    """Run the canonical schema. ``note`` rides on every message it raises.

    The note is for what the value alone cannot show — at a field slot, what the template
    declared there.
    """
    errors = sorted(
        schemas.validator(schema_id).iter_errors(doc), key=lambda e: list(e.absolute_path)
    )
    for error in errors:
        where = prefix + _spot(error.absolute_path)
        result.add(where, _because(error) + note)
    return not errors


# The keywords a scalar type is declared with, in the order they read. Anything the
# canonical schema does not use is simply absent from a message.
_CONDITIONS = (
    "type", "const", "enum", "pattern", "format", "multipleOf",
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "minLength", "maxLength",
)


def _declared(type_name: str) -> str:
    """What the canonical schema requires of one scalar type, as data.

    Read off ``weave-common.schema.json`` rather than written out here, so a message
    cannot drift from the constraint it reports. The ``description`` beside it is not
    read — it is prose, and prose is what this is replacing.
    """
    node = documents()[schemas.COMMON]["$defs"][type_name.capitalize()]
    return " ".join(f"{key}={node[key]}" for key in _CONDITIONS if key in node)


def _scalar(result: Result, where: str, type_name: str, value: object) -> None:
    pointer = "#/$defs/" + type_name.capitalize()
    if not schemas.validator(schemas.COMMON, pointer).is_valid(value):
        result.add(
            where,
            f"not a valid {type_name} value: {value!r}  expected: {_declared(type_name)}",
        )


def _duplicates(names: list[str]) -> list[tuple[str, list[int]]]:
    """Every name that appears more than once, with **every position it stands at**.

    The name alone leaves the reader to scan for the other one. The positions are the
    part of the defect the reader cannot recover from the message.
    """
    places: dict[str, list[int]] = {}
    for index, name in enumerate(names):
        places.setdefault(name, []).append(index)
    return [(name, spots) for name, spots in places.items() if len(spots) > 1]


def check_template(doc: object) -> Result:
    """Check a template. The side that writes templates calls this right after producing one."""
    result = Result()
    if not _structural(result, schemas.TEMPLATE, doc):
        return result
    assert isinstance(doc, dict)

    for name, spots in _duplicates([f["id"] for f in doc["facets"]]):
        result.add("$['facets']", f"duplicate facet id: {name!r}  at: {spots}")

    choices = {c["id"]: [o["id"] for o in c["options"]] for c in doc.get("choices", [])}
    for name, spots in _duplicates([c["id"] for c in doc.get("choices", [])]):
        result.add("$['choices']", f"duplicate choice id: {name!r}  at: {spots}")
    for index, choice in enumerate(doc.get("choices", [])):
        for name, spots in _duplicates([o["id"] for o in choice["options"]]):
            result.add(f"$['choices'][{index}]", f"duplicate option id: {name!r}  at: {spots}")

    for index, facet in enumerate(doc["facets"]):
        base = f"$['facets'][{index}]"
        for name, spots in _duplicates([f["key"] for f in facet["fields"]]):
            result.add(base, f"duplicate field key: {name!r}  at: {spots}")
        for findex, decl in enumerate(facet["fields"]):
            if decl["shape"] == "items":
                columns = [c["key"] for c in decl["columns"]]
                for name, spots in _duplicates(columns):
                    result.add(f"{base}['fields'][{findex}]", f"duplicate column key: {name!r}  at: {spots}")
            # parts splits one whole, so its second column must be the share. What cannot be split cannot be drawn.
            if facet["element"] == "parts" and decl["shape"] == "items":
                share = decl["columns"][1] if len(decl["columns"]) > 1 else None
                numeric = documents()[schemas.COMMON]["$defs"]["NumericType"]["enum"]
                if share is None:
                    result.add(
                        f"{base}['fields'][{findex}]",
                        "the second column of parts is the share, so it must be a numeric type, "
                        f"but only {len(decl['columns'])} column(s) are declared: "
                        f"{[c['key'] for c in decl['columns']]}  numeric: {numeric}",
                    )
                elif share["type"] not in numeric:
                    result.add(
                        f"{base}['fields'][{findex}]",
                        "the second column of parts is the share, so it must be a numeric type: "
                        f"{share['key']!r} is {share['type']}  numeric: {numeric}",
                    )
            # A field riding an undeclared choice has nothing to point at.
            where = f"{base}['fields'][{findex}]"
            if "choice" in decl and decl["choice"] not in choices:
                result.add(
                    where,
                    f"choice not declared by the template: {decl['choice']!r}  declared: {list(choices)}",
                )
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
        # Carry the template's own defects along. Saying only that it does not match leaves
        # the reader holding nothing they can act on.
        result.add(
            "$",
            "the template itself does not match the schema, so values cannot be compared against it: "
            + " | ".join(str(problem) for problem in tresult.problems),
        )
        return result
    assert isinstance(template, dict)

    if doc["templateId"] != template["id"]:
        result.add(
            "$['templateId']",
            f"template id does not match: the valueset says {doc['templateId']!r} "
            f"and the template says {template['id']!r}",
        )

    facets = {f["id"]: f for f in template["facets"]}
    _compare_keys(result, "$['facets']", "facet", list(facets), doc["facets"])
    choices = {c["id"]: [o["id"] for o in c["options"]] for c in template.get("choices", [])}

    for facet_id, declared in facets.items():
        given = doc["facets"].get(facet_id)
        if given is None:
            continue
        base = f"$['facets'][{facet_id!r}]"
        decls = {d["key"]: d for d in declared["fields"]}
        _compare_keys(result, f"{base}['fields']", "field", list(decls), given["fields"])
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
                    result.add(
                        f"{label}['value']",
                        f"not an allowed value: {entry['value']!r}  allowed: {decl['allowed']}",
                    )
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
    options = choices.get(rides, [])
    given = "byOption" in slot
    if rides and not given:
        result.add(
            where,
            f"field rides the choice ({rides!r}) but carries a single value  "
            f"expected byOption keyed by: {options}",
        )
        return []
    if not rides and given:
        result.add(
            where,
            "field rides no choice but carries a value per option: "
            f"{sorted(slot['byOption'])}  expected one value",
        )
        return []
    if not rides:
        return [(where, slot)]
    _compare_keys(result, f"{where}['byOption']", "option", options, slot["byOption"])
    return [
        (f"{where}['byOption'][{name!r}]", entry)
        for name, entry in slot["byOption"].items()
        if name in options
    ]


def _compare_keys(result: Result, where: str, what: str, declared: list[str], given) -> None:
    """Declared against given, both ways. The **declared list rides along** on the extra side.

    A name the template does not carry is only half a defect without the names it does
    carry — the reader has to guess what they meant to write. A missing name is already
    whole: the message names the very thing to add.
    """
    given = list(given)
    for name in sorted(set(declared) - set(given)):
        result.add(where, f"declared {what} is missing: {name!r}")
    for name in sorted(set(given) - set(declared)):
        result.add(where, f"{what} not in the template: {name!r}  the template declares: {declared}")


def _declares(decl: dict) -> str:
    """What the template declared at one field, as data.

    A value cannot show the shape it was supposed to have, so a shape defect that only
    reports what the value is leaves the reader with nothing to aim at.
    """
    parts = [f"shape={decl['shape']}"]
    for key in ("type", "axis"):
        if key in decl:
            parts.append(f"{key}={decl[key]}")
    if "columns" in decl:
        parts.append("columns=" + str([f"{c['key']}:{c['type']}" for c in decl["columns"]]))
    if "allowed" in decl:
        parts.append(f"allowed={decl['allowed']}")
    return " ".join(parts)


def _check_value(result: Result, where: str, decl: dict, value: object) -> None:
    shape = decl["shape"]
    declared = f"  the template declares: {_declares(decl)}"
    if not _structural(result, schemas.VALUESET + SHAPE_DEF[shape], value, prefix=where, note=declared):
        return

    if shape == "single":
        _scalar(result, where, decl["type"], value)
    elif shape == "range":
        assert isinstance(value, dict)
        for bound in ("min", "max"):
            if bound in value:
                _scalar(result, f"{where}[{bound!r}]", decl["type"], value[bound])
        if "min" in value and "max" in value and _gt(value["min"], value["max"]):
            result.add(where, f"range min is greater than max: min={value['min']!r} max={value['max']!r}")
    elif shape == "series":
        assert isinstance(value, list)
        previous = None
        for index, point in enumerate(value):
            _scalar(result, f"{where}[{index}]['at']", decl["axis"], point["at"])
            _scalar(result, f"{where}[{index}]['value']", decl["type"], point["value"])
            if previous is not None and not _gt(point["at"], previous):
                result.add(
                    f"{where}[{index}]['at']",
                    f"series at values must ascend and never repeat: "
                    f"at={point['at']!r} stands after at={previous!r}",
                )
            previous = point["at"]
    elif shape == "items":
        assert isinstance(value, list)
        columns = {c["key"]: c for c in decl["columns"]}
        for index, item in enumerate(value):
            for key, cell in item.items():
                column = columns.get(key)
                if column is None:
                    result.add(
                        f"{where}[{index}]",
                        f"column not in the template: {key!r}  the template declares: {list(columns)}",
                    )
                    continue
                spot = f"{where}[{index}][{key!r}]"
                _scalar(result, spot, column["type"], cell)
                # A column closed list follows the same discipline as a field one — just one layer deeper.
                if "allowed" in column and cell not in column["allowed"]:
                    result.add(spot, f"not an allowed value: {cell!r}  allowed: {column['allowed']}")


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
