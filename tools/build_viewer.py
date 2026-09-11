"""참조 뷰어를 의존성 없는 단일 HTML 한 장으로 묶는다.

    python3 tools/build_viewer.py          # 다시 쓴다
    python3 tools/build_viewer.py --check  # 갈렸으면 exit 1

왜 묶는가 — `file://` 로 연 페이지는 옆 파일을 `fetch` 하지 못하고 외부 모듈도 못 읽는다.
상주 서버를 세우지 않기로 했으므로 스타일과 스크립트와 샘플을 전부 한 장에 넣는다.
CDN 도 쓰지 않는다(오프라인에서 죽는다).

내는 것 넷이다.

- ``viewer/samples.mjs`` — ``samples/`` 를 글 그대로 담은 모듈. 편집기가 그대로 띄운다
- ``viewer/catalog.mjs`` — primitive element 카탈로그. 설명서 페이지가 읽는다
- ``docs/weave.md`` 의 카탈로그 표 — 같은 카탈로그에서 나온다. **둘이 갈릴 수 없다**
- ``viewer.html`` — 열면 바로 도는 한 장

의존성 없이 stdlib 로 돈다.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from tools import catalog  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
VIEWER = ROOT / "viewer"
SAMPLES = ROOT / "samples"
OUT_SAMPLES = VIEWER / "samples.mjs"
OUT_CATALOG = VIEWER / "catalog.mjs"
OUT_HTML = ROOT / "viewer.html"

BANNER = "samples/ 에서 생성된다. 직접 고치지 않는다 — python3 tools/build_viewer.py"
CATALOG_BANNER = "schema/ 와 catalog/elements.json 에서 생성된다. 직접 고치지 않는다 — python3 tools/build_viewer.py"

# 인라인할 때 모듈 문법을 걷는다. 한 장 안에서는 같은 모듈 스코프를 나눠 쓴다.
DROP_IMPORT = re.compile(r"^\s*import\s.*$")
DROP_EXPORT = re.compile(r"^export\s")


def sample_dirs() -> list[pathlib.Path]:
    """``order`` 순으로. 뷰어가 처음 띄우는 것이 첫째다 — 사람이 빈 화면에서 시작하지 않는다."""
    folders = [p for p in SAMPLES.iterdir() if p.is_dir() and (p / "sample.json").exists()]
    return sorted(folders, key=lambda p: (json.loads((p / "sample.json").read_text(encoding="utf-8"))["order"], p.name))


def sample_payload() -> dict:
    """샘플을 **글 그대로** 담는다. 편집기가 파일에 적힌 모양 그대로 보여 줘야 한다."""
    out: dict[str, dict] = {}
    for folder in sample_dirs():
        meta = json.loads((folder / "sample.json").read_text(encoding="utf-8"))
        values = []
        for path in sorted(folder.glob("values-*.json")):
            doc = json.loads(path.read_text(encoding="utf-8"))
            values.append({"label": f"값: {doc.get('subjectId', path.stem)}", "text": path.read_text(encoding="utf-8")})
        out[folder.name] = {
            "name": meta["name"],
            "template": (folder / "template.json").read_text(encoding="utf-8"),
            "values": values,
            # weave-render-args 문서 그대로. 명단은 사람이 JSON 으로 쓰는 것이 아니라 계약의 일부다.
            "args": meta["args"],
        }
    return out


def samples_source() -> str:
    body = json.dumps(sample_payload(), ensure_ascii=False, indent=2)
    return f"// {BANNER}\n\nexport const SAMPLES = {body};\n"


def inline(text: str) -> str:
    lines = []
    for line in text.splitlines():
        if DROP_IMPORT.match(line):
            continue
        lines.append(DROP_EXPORT.sub("", line))
    return "\n".join(lines).strip("\n")


def html_source(samples_js: str, catalog_js: str) -> str:
    """디스크가 아니라 방금 만든 글을 받는다. --check 가 묵은 파일을 보면 안 된다."""
    script = "\n\n".join(
        [
            f"// ---- viewer/render.mjs ----\n{inline((VIEWER / 'render.mjs').read_text(encoding='utf-8'))}",
            f"// ---- viewer/samples.mjs ----\n{inline(samples_js)}",
            f"// ---- viewer/catalog.mjs ----\n{inline(catalog_js)}",
            f"// ---- viewer/app.mjs ----\n{inline((VIEWER / 'app.mjs').read_text(encoding='utf-8'))}",
            "start();",
        ]
    )
    # </script> 가 글 안에 있으면 한 장이 거기서 끊긴다. 샘플은 사람이 쓰는 글이라 막아 둔다.
    script = script.replace("</script", "<\\/script")
    shell = (VIEWER / "shell.html").read_text(encoding="utf-8")
    css = (VIEWER / "style.css").read_text(encoding="utf-8").strip()
    return shell.replace("/*__STYLE__*/", css).replace("/*__SCRIPT__*/", script)


def artifacts() -> dict[pathlib.Path, str]:
    """이 빌드가 내는 것 전부. 고정 케이스가 같은 것을 보도록 여기 하나만 둔다."""
    samples_js = samples_source()
    catalog_js = catalog.viewer_source(CATALOG_BANNER)
    return {
        OUT_SAMPLES: samples_js,
        OUT_CATALOG: catalog_js,
        catalog.DOCS: catalog.docs_source(),  # 표와 설명서 페이지가 같은 카탈로그에서 나온다
        OUT_HTML: html_source(samples_js, catalog_js),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python3 tools/build_viewer.py")
    parser.add_argument("--check", action="store_true", help="다시 쓰지 않고 갈렸는지만 본다")
    args = parser.parse_args(argv)

    if not sample_dirs():
        print("samples/ 에 샘플이 하나도 없다", file=sys.stderr)
        return 1

    wanted = artifacts()

    stale = []
    for path, text in wanted.items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == text:
            continue
        if args.check:
            stale.append(path)
        else:
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path.relative_to(ROOT)}")

    if stale:
        for path in stale:
            print(f"갈렸다: {path.relative_to(ROOT)}", file=sys.stderr)
        print("python3 tools/build_viewer.py 를 다시 돌린다", file=sys.stderr)
        return 1
    if args.check:
        print("viewer.html · viewer/catalog.mjs · docs/weave.md 가 schema/ · catalog/ · samples/ 와 같다")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
