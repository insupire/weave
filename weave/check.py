"""템플릿과 값 한 벌을 판정한다.

두 겹이다. 첫 겹은 정본 JSON Schema 가 구조를 본다. 둘째 겹은 JSON Schema 로
쓸 수 없는 것만 본다 — 같은 문서 안의 키 중복, 값 한 벌과 템플릿의 대조,
series 의 축 순서. 어휘와 모양은 전부 첫 겹이 갖는다.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys
from dataclasses import dataclass, field

from weave import schemas

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
        result.add(where, f"{type_name} 타입이 아니다 (기본 단위로 정규화했는지 본다): {value!r}")


def _duplicates(names: list[str]) -> list[str]:
    seen: set[str] = set()
    dupes: list[str] = []
    for name in names:
        if name in seen and name not in dupes:
            dupes.append(name)
        seen.add(name)
    return dupes


def check_template(doc: object) -> Result:
    """템플릿을 판정한다. 생성 Procedure 가 템플릿을 낸 직후에 부른다."""
    result = Result()
    if not _structural(result, schemas.TEMPLATE, doc):
        return result
    assert isinstance(doc, dict)

    for name in _duplicates([f["id"] for f in doc["facets"]]):
        result.add("$['facets']", f"facet id 가 겹친다: {name}")

    for index, facet in enumerate(doc["facets"]):
        base = f"$['facets'][{index}]"
        for name in _duplicates([f["key"] for f in facet["fields"]]):
            result.add(base, f"필드 key 가 겹친다: {name}")
        for findex, decl in enumerate(facet["fields"]):
            if decl["shape"] == "items":
                columns = [c["key"] for c in decl["columns"]]
                for name in _duplicates(columns):
                    result.add(f"{base}['fields'][{findex}]", f"열 key 가 겹친다: {name}")
    return result


def check_render_args(doc: object) -> Result:
    """렌더 인자를 판정한다. 그릴 subject 와 강조할 subject 뿐이고 구조만 본다.

    명단에 없는 focus 는 결함이 아니다 — 그 경우 focus 만 사라지는 것이 규약이다.
    """
    result = Result()
    if not _structural(result, schemas.RENDER_ARGS, doc):
        return result
    assert isinstance(doc, dict)
    for name in _duplicates([s["id"] for s in doc.get("subjects", [])]):
        result.add("$['subjects']", f"subject id 가 겹친다: {name}")
    return result


def check_valueset(doc: object, template: object | None = None) -> Result:
    """값 한 벌을 판정한다. 분석 Procedure 가 subject 하나를 끝낸 직후에 부른다.

    ``template`` 을 주지 않으면 구조만 본다. 타입·모양·덮는 범위는 템플릿이 있어야 안다.
    """
    result = Result()
    if not _structural(result, schemas.VALUESET, doc):
        return result
    assert isinstance(doc, dict)
    if template is None:
        return result

    tresult = check_template(template)
    if not tresult.ok:
        result.add("$", "템플릿 자체가 스키마에 맞지 않아 값을 대조할 수 없다")
        return result
    assert isinstance(template, dict)

    if doc["templateId"] != template["id"]:
        result.add("$['templateId']", f"템플릿 id 가 다르다: {doc['templateId']!r} != {template['id']!r}")

    facets = {f["id"]: f for f in template["facets"]}
    _compare_keys(result, "$['facets']", "facet", set(facets), set(doc["facets"]))

    for facet_id, declared in facets.items():
        given = doc["facets"].get(facet_id)
        if given is None:
            continue
        base = f"$['facets'][{facet_id!r}]"
        decls = {d["key"]: d for d in declared["fields"]}
        _compare_keys(result, f"{base}['fields']", "필드", set(decls), set(given["fields"]))
        for key, decl in decls.items():
            entry = given["fields"].get(key)
            if entry is None or entry["state"] != "filled":
                continue
            _check_value(result, f"{base}['fields'][{key!r}]['value']", decl, entry["value"])
    return result


def _compare_keys(result: Result, where: str, what: str, declared: set[str], given: set[str]) -> None:
    for name in sorted(declared - given):
        result.add(where, f"템플릿이 선언한 {what} 이 빠졌다: {name}")
    for name in sorted(given - declared):
        result.add(where, f"템플릿에 없는 {what} 이다: {name}")


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
            result.add(where, "구간의 min 이 max 보다 크다")
    elif shape == "series":
        assert isinstance(value, list)
        previous = None
        for index, point in enumerate(value):
            _scalar(result, f"{where}[{index}]['at']", decl["axis"], point["at"])
            _scalar(result, f"{where}[{index}]['value']", decl["type"], point["value"])
            if previous is not None and not _gt(point["at"], previous):
                result.add(f"{where}[{index}]['at']", "series 의 at 은 오름차순이고 겹치지 않는다")
            previous = point["at"]
    elif shape == "items":
        assert isinstance(value, list)
        columns = {c["key"]: c["type"] for c in decl["columns"]}
        for index, item in enumerate(value):
            for key, cell in item.items():
                if key not in columns:
                    result.add(f"{where}[{index}]", f"템플릿에 없는 열이다: {key}")
                    continue
                _scalar(result, f"{where}[{index}][{key!r}]", columns[key], cell)


def _gt(left: object, right: object) -> bool:
    try:
        return left > right  # type: ignore[operator]
    except TypeError:
        return False


def _load(path: str) -> object:
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m weave.check", description="weave 스키마 검사기")
    sub = parser.add_subparsers(dest="what", required=True)

    p_template = sub.add_parser("template", help="분석 템플릿을 판정한다")
    p_template.add_argument("files", nargs="+")

    p_values = sub.add_parser("values", help="값 한 벌을 판정한다")
    p_values.add_argument("--template", required=False, help="대조할 분석 템플릿")
    p_values.add_argument("files", nargs="+")

    p_args = sub.add_parser("args", help="렌더 인자를 판정한다")
    p_args.add_argument("files", nargs="+")

    args = parser.parse_args(argv)

    try:
        template = _load(args.template) if getattr(args, "template", None) else None
    except (OSError, json.JSONDecodeError) as exc:
        print(f"템플릿을 읽지 못했다: {exc}", file=sys.stderr)
        return 2

    failed = False
    for path in args.files:
        try:
            doc = _load(path)
        except (OSError, json.JSONDecodeError) as exc:
            print(f"FAIL {path}\n  읽지 못했다: {exc}")
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
