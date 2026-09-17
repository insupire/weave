"""하네스 표면의 고정 케이스 — `harness.json` 이 참인지와 검사를 고르는 판정.

`harness.json` 은 **밖에서 기계가 읽는 면**이다. 진입점·검사 동사·가드가 어디 있는지를
한 자리에 적는다. 적어 둔 것이 사라져도 아무 일이 안 일어나면 그것은 매니페스트가 아니라
글이다 — 그래서 적힌 자리가 실제로 있는지, 적힌 동사가 실제로 도는 타깃인지를 여기서 본다.

검사를 고르는 판정(`tools/relevant.py`)도 같은 표면이다. **고른 것과 안 고른 것을 함께 본다** —
아무것도 안 고르는 판정과 늘 전부 고르는 판정은 둘 다 고장이고 통과만으로는 구별되지 않는다.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

from relevant import ALL, RULES, targets_for  # noqa: E402

MANIFEST = json.loads((ROOT / "harness.json").read_text(encoding="utf-8"))
MAKEFILE = (ROOT / "Makefile").read_text(encoding="utf-8")
MAKE_TARGETS = set(re.findall(r"^([a-z][a-z-]*):", MAKEFILE, re.MULTILINE))


class TheManifestIsTrue(unittest.TestCase):
    def test_the_shape_is_the_one_the_reader_expects(self) -> None:
        """PM 이 스키마를 고정한다. 키를 늘리거나 줄이면 읽는 쪽이 깨진다."""
        self.assertEqual(set(MANIFEST), {"version", "entrypoint", "verbs", "preview", "guard"})
        self.assertEqual(MANIFEST["version"], 1)
        self.assertEqual(set(MANIFEST["verbs"]), {"relevant", "full"})

    def test_the_entrypoint_and_the_guard_are_where_it_says(self) -> None:
        for key in ("entrypoint", "guard"):
            with self.subTest(key):
                self.assertTrue((ROOT / MANIFEST[key]).is_file(), MANIFEST[key])

    def test_the_verbs_are_targets_that_exist(self) -> None:
        """「make <이름>」 이라고 적었으면 그 이름이 Makefile 에 있어야 한다."""
        for key, command in MANIFEST["verbs"].items():
            with self.subTest(key):
                head, _, target = command.partition(" ")
                self.assertEqual(head, "make", command)
                self.assertIn(target, MAKE_TARGETS, command)

    def test_it_declares_no_preview_because_the_repository_stands_none(self) -> None:
        """상주 서버·컨테이너·프리뷰를 세우지 않는다. `viewer.html` 은 파일이라 포트가 없다."""
        self.assertIsNone(MANIFEST["preview"])

    def test_the_guard_file_points_at_a_script_that_exists(self) -> None:
        settings = json.loads((ROOT / MANIFEST["guard"]).read_text(encoding="utf-8"))
        commands = [
            hook["command"]
            for entry in settings["hooks"]["PreToolUse"]
            for hook in entry["hooks"]
        ]
        self.assertTrue(commands, settings)
        for command in commands:
            with self.subTest(command):
                named = re.findall(r"[\w./-]+\.mjs", command)
                self.assertEqual(len(named), 1, command)
                # 앞에 붙은 $CLAUDE_PROJECT_DIR 를 떼면 저장소 상대경로가 남는다.
                self.assertTrue((ROOT / named[0].lstrip("/")).is_file(), named[0])

    def test_the_guard_watches_the_tools_that_can_write(self) -> None:
        settings = json.loads((ROOT / MANIFEST["guard"]).read_text(encoding="utf-8"))
        matchers = "|".join(entry["matcher"] for entry in settings["hooks"]["PreToolUse"])
        for tool in ("Write", "Edit", "Bash"):
            with self.subTest(tool):
                self.assertIn(tool, matchers)


class ThePickerPicks(unittest.TestCase):
    """**고른 것과 안 고른 것을 함께 본다.**"""

    def test_it_picks_only_what_the_change_needs(self) -> None:
        cases = {
            "weave/check.py": ["test", "check"],
            "render/render.mjs": ["test", "viewer-check", "viewer-test"],
            "generated/weave-vocab.ts": ["types-check"],
            "tools/workspace-guard.mjs": ["guard-test"],
            ".claude/settings.json": ["guard-test"],
            "tests/fixtures/ok/template.json": ["test", "check"],
        }
        for path, expected in cases.items():
            with self.subTest(path):
                self.assertEqual(targets_for([path]), expected)

    def test_a_documentation_only_change_runs_the_pointer_check_and_no_more(self) -> None:
        """산문도 자리를 가리킨다 — `make test` 는 돌고 전체 게이트는 안 돈다.

        여기가 넓어지면 문서 한 줄에 전체 게이트가 돈다. 여기가 비면 옮긴 폴더를
        가리키던 글이 죽은 채로 지나간다 — 둘 다 고장이라 함께 본다.
        """
        self.assertEqual(targets_for(["docs/weave.md", "AGENTS.md", "README.md"]), ["test"])
        self.assertEqual(targets_for(["", "  "]), [])

    def test_the_schema_and_anything_unknown_widen_to_everything(self) -> None:
        """고를 근거가 없으면 넓힌다. 좁게 틀리는 것이 더 비싸다."""
        for path in ("schema/weave-common.schema.json", "Makefile", ".github/workflows/ci.yml", "brand-new-file"):
            with self.subTest(path):
                self.assertEqual(targets_for([path]), list(ALL))

    def test_it_unions_and_keeps_the_makefile_order(self) -> None:
        picked = targets_for(["generated/weave-vocab.ts", "weave/check.py", "viewer.html"])
        self.assertEqual(picked, ["test", "types-check", "check", "viewer-check"])

    def test_it_never_picks_a_verb_that_rewrites_the_tree(self) -> None:
        """고르는 것은 확인하는 동사뿐이다. 검사를 부르는 자리가 나무를 고치면 무엇을 쟀는지 모른다."""
        for targets in list(RULES.values()) + [ALL]:
            for target in targets:
                with self.subTest(target):
                    self.assertNotIn(target, {"viewer", "types", "setup", "clean"})

    def test_every_target_it_can_name_is_a_real_target(self) -> None:
        for target in ALL:
            with self.subTest(target):
                self.assertIn(target, MAKE_TARGETS)

    def test_no_rule_points_at_a_place_that_is_gone(self) -> None:
        """죽은 규칙은 조용히 좁힌다 — 자리가 사라지면 그 변경이 기본값(전부)으로 가야 한다."""
        for place in RULES:
            with self.subTest(place):
                self.assertTrue((ROOT / place.rstrip("/")).exists(), place)


if __name__ == "__main__":
    unittest.main()
