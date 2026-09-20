"""**스키마가 바뀌면 판이 올라야 한다** — 그것을 못박는다.

판은 소비자가 기대는 **형상**에 매인다. 그 형상은 `schema/*.json` 하나다 — 설명서나
카탈로그가 바뀌었다고 판이 움직이면 그 판은 아무것도 약속하지 않고, 고정한 쪽은 판이
그대로인 것을 보고 「안 바뀌었다」고 읽는다.

`schema-lock.json` 이 「이 판일 때 스키마가 이러했다」를 적는다. 나무와 갈리면
`make version-check` 가 막는다. `make version` 이 다시 쓰되 **스키마가 바뀌었는데 판이
그대로면 쓰지 않는다** — 써 주고 지나가면 이 판정 전체가 아무것도 안 막는다.
"""

from __future__ import annotations

import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOCK = ROOT / "schema-lock.json"
INIT = ROOT / "weave" / "__init__.py"
SCHEMA = ROOT / "schema"


def version() -> str:
    found = re.search(r'^__version__ = "([^"]+)"', INIT.read_text(encoding="utf-8"), re.M)
    if not found:
        raise SystemExit(f"판을 찾지 못했다: {INIT}")
    return found.group(1)


def digests() -> dict[str, str]:
    out = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in sorted(SCHEMA.glob("*.json"))
    }
    if not out:
        # 빈 채로 가면 잠근 것과 늘 같아 보인다 — 통과와 구별되지 않는다.
        raise SystemExit(f"정본 스키마를 찾지 못했다: {SCHEMA}")
    return out


def current() -> dict:
    return {"version": version(), "schema": digests()}


def locked() -> dict:
    if not LOCK.exists():  # 아직 없는 것은 전부 갈린 것이다 — `make version` 이 처음 쓴다.
        return {"version": None, "schema": {}}
    return json.loads(LOCK.read_text(encoding="utf-8"))


def verdict(now: dict, was: dict) -> str | None:
    """순수 판정. 막을 까닭이 있으면 글, 없으면 None. 파일을 읽지 않는다 — 그래야 고정 케이스가 붙는다."""
    if now == was:
        return None
    if now["schema"] != was["schema"] and now["version"] == was["version"]:
        moved = sorted(
            name
            for name in set(now["schema"]) | set(was["schema"])
            if now["schema"].get(name) != was["schema"].get(name)
        )
        return (
            f"스키마가 바뀌었는데 판이 그대로다 ({now['version']}) — 소비자는 판으로 고정하므로 "
            f"그대로 두면 모르고 낡는다. weave/__init__.py 의 __version__ 을 올리고 "
            f"`make version` 으로 다시 쓴다. 바뀐 자리: {', '.join(moved)}"
        )
    return "schema-lock.json 이 나무와 갈렸다 — `make version` 으로 다시 쓴다"


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    now = current()
    was = locked()
    reason = verdict(now, was)

    if "--check" in argv:
        if reason is None:
            return 0
        print(reason, file=sys.stderr)
        return 1

    if reason is not None and now["version"] == was["version"]:
        print(reason, file=sys.stderr)
        return 1
    LOCK.write_text(json.dumps(now, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"schema-lock.json 을 다시 썼다 — weave {now['version']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
