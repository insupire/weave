"""primitive element 카탈로그를 **한 번만** 만든다.

카탈로그가 서는 자리가 둘이다 — `docs/weave.md` 의 표와 뷰어의 설명서 페이지. 둘이
따로 쓰이면 갈리므로 여기서 하나를 만들어 둘 다 여기서 낸다.

정본이 어디인가.

- **제약(필드 수·shape·type)은 `schema/weave-template.schema.json` 이 정본이다.** 손으로 옮겨
  적지 않고 `Facet` 의 조건절에서 뽑는다. 스키마가 바뀌면 카탈로그가 따라 바뀐다.
- **산문(무엇을 그리는가·비고)과 보기는 `catalog/elements.json` 이 정본이다.**
- `docs/weave.md` 의 표와 `viewer/catalog.mjs` 는 **둘 다 산출물**이다. 손으로 고치지 않는다.

의존성 없이 stdlib 로 돈다.
"""

from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
COMMON = ROOT / "schema" / "weave-common.schema.json"
TEMPLATE = ROOT / "schema" / "weave-template.schema.json"
PROSE = ROOT / "catalog" / "elements.json"
GUIDE = ROOT / "catalog" / "guide.json"

DOCS = ROOT / "docs" / "weave.md"
MARK_START = "<!-- catalog:start — tools/build_viewer.py 가 쓴다. 손으로 고치지 않는다 -->"
MARK_END = "<!-- catalog:end -->"


def _load(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _enum_of(node: dict, defs: dict) -> list[str] | None:
    """`{"enum": [...]}` 이거나 `{"$ref": "...#/$defs/Name"}` 이거나 `{"const": "x"}`."""
    if node is None:
        return None
    if "enum" in node:
        return list(node["enum"])
    if "const" in node:
        return [node["const"]]
    ref = node.get("$ref")
    if ref and "#/$defs/" in ref:
        return list(defs[ref.split("#/$defs/")[1]]["enum"])
    return None


def constraints() -> dict[str, dict]:
    """스키마의 조건절에서 element 별 제약을 뽑는다. **여기에 지식을 적지 않는다.**"""
    common = _load(COMMON)["$defs"]
    template = _load(TEMPLATE)
    facet = template["$defs"]["Facet"]
    base_fields = facet["properties"]["fields"]
    every_type = list(common["Type"]["enum"])

    out: dict[str, dict] = {}
    for branch in facet["allOf"]:
        element = branch["if"]["properties"]["element"]["const"]
        fields = branch["then"]["properties"]["fields"]
        items = fields.get("items", {}).get("properties", {})
        out[element] = {
            "min_fields": base_fields.get("minItems", 1),
            "max_fields": fields.get("maxItems", base_fields.get("maxItems")),
            "shapes": _enum_of(items.get("shape"), common) or list(common["Shape"]["enum"]),
            "types": _enum_of(items.get("type"), common) or every_type,
            "every_type": _enum_of(items.get("type"), common) is None,
        }

    declared = list(common["Element"]["enum"])
    missing = [e for e in declared if e not in out]
    if missing:
        raise SystemExit(f"스키마가 조건절을 두지 않은 primitive element 가 있다: {missing}")
    return {element: out[element] for element in declared}


def catalog() -> list[dict]:
    """설명서 한 벌. 표와 페이지가 이것 하나에서 나온다."""
    prose = _load(PROSE)
    limits = constraints()
    rows = []
    for element, limit in limits.items():
        entry = prose.get(element)
        if entry is None:
            raise SystemExit(f"catalog/elements.json 에 {element} 의 산문이 없다")
        rows.append({"element": element, **limit, **{k: entry[k] for k in ("compare", "draws", "note", "demo")}})
    return rows


def fields_text(row: dict) -> str:
    low, high = row["min_fields"], row["max_fields"]
    return str(low) if low == high else f"{low}–{high}"


def types_text(row: dict) -> str:
    if row["every_type"]:
        return f"{len(row['types'])} 가지 전부"
    return "·".join(f"`{t}`" for t in row["types"])


def shapes_text(row: dict) -> str:
    return "·".join(f"`{s}`" for s in row["shapes"])


COMPARE_SAID = {"overlay": "겹친다", "focus": "focus 를 따라 바뀐다"}


def docs_table() -> str:
    lines = [
        "| element | 비교 | 그리는 것 | 필드 수 | shape | type | 비고 |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for row in catalog():
        lines.append(
            f"| `{row['element']}` | {COMPARE_SAID[row['compare']]} | {row['draws']} | {fields_text(row)} | "
            f"{shapes_text(row)} | {types_text(row)} | {row['note']} |"
        )
    return "\n".join(lines)


def docs_source() -> str:
    """`docs/weave.md` 의 카탈로그 자리를 다시 쓴 글 전체."""
    text = DOCS.read_text(encoding="utf-8")
    head, _, rest = text.partition(MARK_START)
    if not rest:
        raise SystemExit(f"docs/weave.md 에 {MARK_START} 가 없다")
    _, _, tail = rest.partition(MARK_END)
    return f"{head}{MARK_START}\n{docs_table()}\n{MARK_END}{tail}"


def guide() -> dict:
    """element 가 아닌 쪽의 산문. 목차의 앞뒤가 여기서 나온다."""
    return {k: v for k, v in _load(GUIDE).items() if not k.startswith("__")}


def pages() -> list[dict]:
    """**설명서의 목차이자 본문이다.** element 쪽은 카탈로그가, 나머지는 guide 가 낸다.

    목차를 손으로 적지 않는다 — primitive element 가 늘거나 줄면 목차가 따라 바뀐다.
    """
    texts = guide()
    out: list[dict] = [{"id": "intro", "kind": "guide", "group": "시작", **texts["intro"]}]
    for row in catalog():
        out.append(
            {
                "id": row["element"],
                "kind": "element",
                "group": "primitive element",
                "title": row["element"],
                "compare": row["compare"],
                "compareSaid": COMPARE_SAID[row["compare"]],
                "draws": row["draws"],
                "note": row["note"],
                "fields": fields_text(row),
                "shapes": row["shapes"],
                "types": row["types"],
                "everyType": row["every_type"],
                "demo": row["demo"],
            }
        )
    out.append({"id": "playground", "kind": "playground", "group": "해 보기", **texts["playground"]})
    return out


def viewer_source(banner: str) -> str:
    """뷰어가 설명서를 그릴 때 읽는 것. docs 표와 같은 카탈로그에서 나온다."""
    body = json.dumps(pages(), ensure_ascii=False, indent=2)
    return f"// {banner}\n\nexport const PAGES = {body};\n"
