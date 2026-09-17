"""두 문서에 서는 요소를 **빠짐없이** 한 자리에 편다.

`docs/weave.md` 의 앞 절들은 쓰는 법을 이야기로 말하고, 여기는 **자리 하나하나**를 센다.
새 칸이 스키마에 서면 다음 `make viewer` 에 이 표가 따라 자란다 — 손으로 적지 않으므로
「적어 둔 목록이 조용히 옛것이 되는」 길이 없다.

정본이 어디인가.

- **형상(어느 자리가 있고 무엇이 필수인가)은 `schema/` 의 JSON Schema 가 정본이다.**
- **각 자리가 무엇인가도 스키마의 `description` 이 정본이다.** 여기서 지어내지 않고, 글이
  없는 자리를 만나면 표를 내지 않고 **멈춘다** — 설명이 스키마 밖에서 자라지 못하게 한다.
- primitive element 의 산문만 `catalog/elements.json` 것이다(카탈로그 표와 같은 자리).
- `docs/weave.md` 의 이 절은 **산출물**이다. 손으로 고치지 않는다.

의존성 없이 stdlib 로 돈다.
"""

from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "schema"

MARK_START = "<!-- reference:start — tools/build_viewer.py 가 쓴다. 손으로 고치지 않는다 -->"
MARK_END = "<!-- reference:end -->"

# 문서마다 — 제목 · 어느 문서의 것인가 · 언제 정해지나.
DOCS_ORDER = [
    ("weave-template.schema.json", "템플릿의 것", "**저작 때** 정해진다. subject 가 누구든 같다."),
    ("weave-valueset.schema.json", "값 한 벌의 것", "**채울 때** 정해진다. subject 마다 다르다."),
    ("weave-render-args.schema.json", "어느 쪽 문서도 아니다 — 화면 상태다",
     "**볼 때** 정해진다. 사람이 누를 때마다 바뀐다."),
    ("weave-common.schema.json", "두 문서가 함께 쓴다",
     "쓰는 자리를 따른다 — 템플릿에 선 것은 저작 때, 값 한 벌에 선 것은 채울 때."),
]


def _load(name: str) -> dict:
    return json.loads((SCHEMA / name).read_text(encoding="utf-8"))


SCHEMAS = {name: _load(name) for name, _, _ in DOCS_ORDER}


def deref(node: dict, home: str) -> tuple[dict, str]:
    """`$ref` 를 따라간다. 파일을 건너뛰어도 따라간다 — 참조가 상대 경로라 그대로 풀린다."""
    seen = 0
    while isinstance(node, dict) and "$ref" in node and seen < 8:
        ref = node["$ref"]
        file, _, pointer = ref.partition("#")
        home = file or home
        target = SCHEMAS[home]
        for step in [p for p in pointer.split("/") if p and p != "#"]:
            target = target[step]
        node, seen = target, seen + 1
    return node, home


def said(node: dict, home: str, where: str) -> str:
    """그 자리가 무엇인가. **스키마에 없으면 멈춘다** — 여기서 지어내지 않는다."""
    if node.get("description"):
        return node["description"]
    target, _ = deref(node, home)
    if target.get("description"):
        return target["description"]
    raise SystemExit(f"{where} 에 description 이 없다 — 스키마에 적는다 (tools/reference.py)")


def _cell(text: str) -> str:
    return " ".join(text.split()).replace("|", "\\|")


def rows(obj: dict, home: str, where: str) -> list[str]:
    required = set(obj.get("required", []))
    out = []
    for key, node in obj.get("properties", {}).items():
        need = "필수" if key in required else "선택"
        out.append(f"| `{key}` | {_cell(said(node, home, f'{where}.{key}'))} | {need} |")
    return out


def table(obj: dict, home: str, where: str) -> list[str]:
    body = rows(obj, home, where)
    if not body:
        return []
    return ["", "| 자리 | 무엇인가 | 필수·선택 |", "| --- | --- | --- |", *body]


def structures(name: str) -> list[tuple[str, dict, str]]:
    """문서 뿌리와 그 아래 이름 붙은 구조 전부. **손으로 세지 않고 스키마를 훑는다.**"""
    doc = SCHEMAS[name]
    out: list[tuple[str, dict, str]] = [("문서 뿌리", doc, doc.get("description", ""))]
    for label, node in doc.get("$defs", {}).items():
        if node.get("enum"):  # 닫힌 어휘는 아래 한 표에 모은다
            continue
        described = node.get("description", "")
        if node.get("properties"):
            out.append((f"`{label}`", node, described))
        elif node.get("items", {}).get("properties"):
            out.append((f"`{label}` 의 한 칸", node["items"], described))
        else:
            out.append((f"`{label}`", {}, described or said(node, name, f"{name}#{label}")))
    return out


def vocabulary_lines() -> list[str]:
    """닫힌 어휘 — 값이 무엇무엇인가. **뜻은 이 문서가 이미 가진 자리를 가리킨다.**"""
    common = SCHEMAS["weave-common.schema.json"]["$defs"]
    out = ["", "닫힌 어휘는 값이 전부 정해져 있다. 각 값이 무엇인지는 이 문서의 앞 절이 말한다.", ""]
    out.append("| 어휘 | 값 | 각 값이 무엇인지 |")
    out.append("| --- | --- | --- |")
    where = {
        "Type": "[타입](#타입)",
        "NumericType": "[타입](#타입) — 크기를 견줄 수 있는 것만",
        "OrderedType": "[타입](#타입) — 순서를 매길 수 있는 것만",
        "AxisType": "[타입](#타입) — series 의 가로축이 될 수 있는 것만",
        "Shape": "[모양](#모양)",
        "Element": "[primitive element](#primitive-element)",
        "Compare": "위 `Facet.compare`",
        "AnnotationKind": "[주석](#주석)",
    }
    for label, pointer in where.items():
        values = "·".join(f"`{v}`" for v in common[label]["enum"])
        out.append(f"| `{label}` | {values} | {pointer} |")
    return out


def section(name: str, whose: str, when: str) -> list[str]:
    doc = SCHEMAS[name]
    out = [f"### {doc['title']} — [`{name}`](../schema/{name})", "", f"{whose}. {when}"]
    for label, obj, described in structures(name):
        head = f"**{label}**"
        if described:
            head += f" — {_cell(described)}"
        out += ["", head, *table(obj, name, f"{name}#{label}")]
    if name == "weave-common.schema.json":
        out += vocabulary_lines()
    return out


def body() -> str:
    out: list[str] = []
    for name, whose, when in DOCS_ORDER:
        out += section(name, whose, when)
        out.append("")
    return "\n".join(out).strip("\n")


def docs_source(text: str) -> str:
    """`docs/weave.md` 의 이 절을 다시 쓴 글 전체."""
    head, _, rest = text.partition(MARK_START)
    if not rest:
        raise SystemExit(f"docs/weave.md 에 {MARK_START} 가 없다")
    _, _, tail = rest.partition(MARK_END)
    return f"{head}{MARK_START}\n{body()}\n{MARK_END}{tail}"


if __name__ == "__main__":
    print(body())
