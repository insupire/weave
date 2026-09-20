"""바꾼 자리에서 **돌릴 검사만** 고른다.

AGENTS.md 「검사 동사와 변경별 관련 검증」의 표를 기계가 읽을 수 있게 옮긴 것이다.
`make relevant` 이 부르고, 바뀐 파일 이름을 줄마다 stdin 으로 받아 make 타깃을 낸다.

**고르는 것은 확인하는 동사뿐이다.** `viewer`·`types` 처럼 산출물을 다시 쓰는 동사는 넣지 않는다 —
검사를 부르는 자리가 나무를 고치면 무엇을 쟀는지 알 수 없게 된다. 갈렸으면 `viewer-check` 가
그 사실을 말하고 다시 쓰는 것은 사람이 한다.

**모르는 자리는 넓힌다.** 고를 근거가 없으면 전부 돈다 — 좁게 틀리는 것이 넓게 도는 것보다 비싸다.
이 저장소의 전체 게이트는 20초대라 넓히는 값이 싸다.
"""

from __future__ import annotations

import sys
from collections.abc import Iterable

# Makefile 의 `all` 차례. 고른 것도 이 차례로 낸다.
ALL = (
    "test", "types-check", "check", "viewer-check", "viewer-test", "guard-test", "install-check",
)

# 자리 → 돌릴 것. 긴 자리가 이긴다.
RULES: dict[str, tuple[str, ...]] = {
    "schema/": ALL,
    "weave/": ("test", "check", "install-check"),
    "generated/": ("types-check",),
    "tools/emit_types.py": ("types-check",),
    "tools/build_viewer.py": ("viewer-check",),
    "tools/catalog.py": ("test", "viewer-check"),
    "tools/relevant.py": ("test",),
    "tools/workspace-guard.mjs": ("guard-test",),
    ".claude/": ("guard-test",),
    "tests/workspace-guard.test.mjs": ("guard-test",),
    "tests/viewer.test.mjs": ("viewer-test",),
    "tests/install_probe.py": ("install-check",),
    "tests/fixtures/": ("test", "check"),
    "tests/": ("test",),
    "render/": ("test", "viewer-check", "viewer-test"),
    "viewer/": ("test", "viewer-check", "viewer-test"),
    "viewer.html": ("viewer-check",),
    "samples/": ("test", "check", "viewer-check", "viewer-test"),
    "catalog/": ("test", "check", "viewer-check", "viewer-test"),
    "pyproject.toml": ("install-check",),  # 패키지 선언이 갈리면 설치본이 먼저 죽는다
    "harness.json": ("test",),  # 매니페스트가 참인지는 tests/test_harness.py 가 본다
    # 산문도 자리를 가리킨다 — `make test` 가 가리키는 자리가 사는지 본다.
    # 전체 게이트는 안 돈다: 문서 한 줄에 전부 도는 것이 애초에 막으려던 것이다.
    "docs/": ("test",),
    "AGENTS.md": ("test",),
    "README.md": ("test",),
}

_BY_LENGTH = sorted(RULES, key=len, reverse=True)


def targets_for(paths: Iterable[str]) -> list[str]:
    """바뀐 파일들 → 돌릴 make 타깃. 파일을 읽지 않는 순수 판정이다."""
    picked: set[str] = set()
    for raw in paths:
        path = raw.strip()
        if not path:
            continue
        for place in _BY_LENGTH:
            if path == place or path.startswith(place):
                picked.update(RULES[place])
                break
        else:
            picked.update(ALL)
    return [target for target in ALL if target in picked]


if __name__ == "__main__":
    print(" ".join(targets_for(sys.stdin)))
