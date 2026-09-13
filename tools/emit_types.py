"""정본 스키마의 닫힌 어휘를 소비자 둘의 언어로 내보낸다.

모델 전체는 외부 생성기로 뽑는다(AGENTS.md 「타입을 내보내는 길」). 여기서 내보내는 것은
어휘뿐이다 — 렌더가 분기하는 지점이 이것이고, 갈리면 바로 화면이 깨지는 것도 이것이다.

    python3 tools/emit_types.py          # 다시 쓴다
    python3 tools/emit_types.py --check  # 갈렸으면 exit 1
"""

from __future__ import annotations

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = ROOT / "schema" / "weave-common.schema.json"
OUT_PY = ROOT / "generated" / "weave_vocab.py"
OUT_TS = ROOT / "generated" / "weave-vocab.ts"

BANNER = "schema/weave-common.schema.json 에서 생성된다. 직접 고치지 않는다."

# (스키마 $defs 이름, python 이름, typescript 타입 이름, typescript 상수 이름)
VOCAB = [
    ("Type", "Type", "WeaveType", "WEAVE_TYPES"),
    ("NumericType", "NumericType", "WeaveNumericType", "WEAVE_NUMERIC_TYPES"),
    ("OrderedType", "OrderedType", "WeaveOrderedType", "WEAVE_ORDERED_TYPES"),
    ("AxisType", "AxisType", "WeaveAxisType", "WEAVE_AXIS_TYPES"),
    ("Shape", "Shape", "WeaveShape", "WEAVE_SHAPES"),
    ("Element", "Element", "WeaveElement", "WEAVE_ELEMENTS"),
    ("AnnotationKind", "AnnotationKind", "WeaveAnnotationKind", "WEAVE_ANNOTATION_KINDS"),
]


def vocabularies() -> list[tuple[str, str, str, str, list[str], str]]:
    defs = json.loads(SOURCE.read_text(encoding="utf-8"))["$defs"]
    out = []
    for name, py, ts, const in VOCAB:
        node = defs[name]
        out.append((name, py, ts, const, node["enum"], node.get("description", "")))
    return out


def python_source() -> str:
    lines = [f"# {BANNER}", "", "from typing import Literal", ""]
    for _, py, _, _, values, doc in vocabularies():
        members = ", ".join(json.dumps(v, ensure_ascii=False) for v in values)
        if doc:
            lines.append(f"# {doc}")
        lines.append(f"{py} = Literal[{members}]")
        lines.append(f"{py.upper()}S: tuple[{py}, ...] = ({members},)")
        lines.append("")
    names = [py for _, py, _, _, _, _ in vocabularies()]
    exported = names + [n.upper() + "S" for n in names]
    lines.append("__all__ = [")
    lines.extend(f'    "{n}",' for n in exported)
    lines.append("]")
    return "\n".join(lines) + "\n"


def typescript_source() -> str:
    lines = [f"// {BANNER}", ""]
    for _, _, ts, const, values, doc in vocabularies():
        members = " | ".join(json.dumps(v, ensure_ascii=False) for v in values)
        array = ", ".join(json.dumps(v, ensure_ascii=False) for v in values)
        if doc:
            lines.append(f"/** {doc} */")
        lines.append(f"export type {ts} = {members};")
        lines.append(f"export const {const} = [{array}] as const satisfies readonly {ts}[];")
        lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 tools/emit_types.py")
    parser.add_argument("--check", action="store_true", help="다시 쓰지 않고 갈렸는지만 본다")
    args = parser.parse_args(argv)

    wanted = {OUT_PY: python_source(), OUT_TS: typescript_source()}
    stale = []
    for path, text in wanted.items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == text:
            continue
        if args.check:
            stale.append(path)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path.relative_to(ROOT)}")

    if stale:
        for path in stale:
            print(f"갈렸다: {path.relative_to(ROOT)}", file=sys.stderr)
        print("python3 tools/emit_types.py 를 다시 돌린다", file=sys.stderr)
        return 1
    if args.check:
        print("generated/ 가 스키마와 같다")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
