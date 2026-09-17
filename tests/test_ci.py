"""워크플로의 **형태** 고정 케이스.

러너를 쓸 수 없으니 실제로 도는 것은 못 본다. 대신 트리거와 job 의 모양을 본다 —
여기가 갈리면 필수 회귀가 조용히 안 돌거나, 돌지 말아야 할 자리에서 돈다.

**YAML 파서를 들이지 않는다.** 이 저장소의 런타임 의존은 `jsonschema` 하나다. 대신 우리가
쓴 워크플로의 얕은 줄 구조를 직접 읽는다 — 최상위 키와 그 아래 줄들이면 판정에 충분하다.
"""

from __future__ import annotations

import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
WORKFLOWS = ROOT / ".github" / "workflows"
CI = WORKFLOWS / "ci.yml"


def blocks(text: str) -> dict[str, list[str]]:
    """최상위 키 → 그 아래 줄들. 주석과 빈 줄은 버린다."""
    out: dict[str, list[str]] = {}
    key: str | None = None
    body: list[str] = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[:1].isspace() and ":" in line:
            if key is not None:
                out[key] = body
            key, _, rest = line.partition(":")
            body = [rest.strip()] if rest.strip() else []
        elif key is not None:
            body.append(line.rstrip())
    if key is not None:
        out[key] = body
    return out


def lines_of(text: str, key: str) -> list[str]:
    """최상위 키 아래 줄들을 들여쓰기 뺀 채로."""
    return [line.strip() for line in blocks(text).get(key, [])]


class OnlyOneWorkflow(unittest.TestCase):
    def test_the_repository_has_no_other_trigger_to_keep(self) -> None:
        """배포·릴리스·보안 워크플로가 없다. 지킬 다른 트리거가 없다는 것을 못박는다."""
        found = sorted(p.name for p in WORKFLOWS.glob("*.y*ml"))
        self.assertEqual(found, ["ci.yml"])


class Triggers(unittest.TestCase):
    def setUp(self) -> None:
        self.text = CI.read_text(encoding="utf-8")

    def test_the_shape_is_the_one_we_wrote(self) -> None:
        self.assertEqual(set(blocks(self.text)), {"name", "on", "concurrency", "permissions", "jobs"})

    def test_it_runs_only_on_pull_requests_into_the_base_branch(self) -> None:
        """작업 브랜치끼리 여는 PR 에서는 돌지 않는다."""
        on = lines_of(self.text, "on")
        self.assertIn("pull_request:", on)
        self.assertIn("branches: [develop]", on)

    def test_it_runs_again_on_update_and_reopen(self) -> None:
        """랜딩 PR 에 커밋을 얹으면 입력이 달라진다. 앞 회차의 결과를 그대로 믿지 않는다."""
        types = [line for line in lines_of(self.text, "on") if line.startswith("types:")]
        self.assertEqual(len(types), 1, types)
        for kind in ("opened", "synchronize", "reopened"):
            with self.subTest(kind):
                self.assertIn(kind, types[0])

    def test_it_does_not_run_on_a_branch_push(self) -> None:
        """테스트 CI 는 브랜치 push 에서 돌지 않는다. 머지 뒤 재측정은 지킬 배포가 없다."""
        self.assertNotIn("push", blocks(self.text))
        self.assertNotIn("push:", lines_of(self.text, "on"))

    def test_it_cancels_only_the_previous_round_of_the_same_pull_request(self) -> None:
        group = [line for line in lines_of(self.text, "concurrency") if line.startswith("group:")]
        self.assertEqual(len(group), 1, group)
        self.assertIn("github.event.pull_request.number", group[0])
        self.assertIn("cancel-in-progress: true", lines_of(self.text, "concurrency"))


class TheJobCallsMakeAndNothingElse(unittest.TestCase):
    """게이트 목록의 정본은 `Makefile` 하나다. 워크플로가 게이트를 다시 적지 않는다."""

    def setUp(self) -> None:
        self.jobs = lines_of(CI.read_text(encoding="utf-8"), "jobs")
        self.runs = [line.partition("run:")[2].strip() for line in self.jobs if line.startswith("run:")]

    def test_it_runs_make_all(self) -> None:
        self.assertIn("make all", self.runs)

    def test_it_does_not_list_the_gates_again(self) -> None:
        gates = ("test", "types-check", "check", "viewer-check", "viewer-test", "guard-test", "viewer")
        for run in self.runs:
            if run == "make all":
                continue
            for gate in gates:
                with self.subTest(run=run, gate=gate):
                    self.assertNotIn(f"make {gate}", run)

    def test_it_does_not_use_a_shallow_clone(self) -> None:
        # 줄 끝에 주석이 붙어 있으므로 앞부분으로 본다.
        self.assertTrue(any(line.startswith("fetch-depth: 0") for line in self.jobs), self.jobs)

    def test_it_pins_both_runtimes(self) -> None:
        """node 가 없으면 `viewer-test` 가 건너뛰지 않고 실패한다. 러너가 그것을 깔아야 한다."""
        self.assertIn('python-version: "3.13"', self.jobs)
        self.assertIn('node-version: "24"', self.jobs)


if __name__ == "__main__":
    unittest.main()
