"""샘플의 고정 케이스.

샘플은 뷰어를 시험할 재료이자 사람이 읽는 분석뷰다. **검사기가 샘플 전부를 통과시키는 것**이
여기 걸린다 — 뷰어는 판정하지 않으므로 샘플이 옳다는 근거가 이 자리밖에 없다.

그리는 쪽의 고정 케이스는 `tests/viewer.test.mjs` 가 갖는다 (`make viewer-test`).
"""

from __future__ import annotations

import json
import pathlib
import sys
import unittest

from weave import check_template, check_valueset
from weave.schemas import RENDER_ARGS, documents, validator

ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "samples"

sys.path.insert(0, str(ROOT))
from tools import build_viewer  # noqa: E402


def sample_dirs() -> list[pathlib.Path]:
    """빌더와 같은 순서로 본다 — 뷰어가 띄우는 차례가 곧 이 차례다."""
    return build_viewer.sample_dirs()


def load(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class SamplesAreWhole(unittest.TestCase):
    def test_there_are_four_samples(self) -> None:
        # 사람이 빈 화면에서 시작하지 않는다. 성격이 다른 것으로 넷.
        self.assertEqual(len(sample_dirs()), 4, [p.name for p in sample_dirs()])

    def test_each_sample_has_its_three_parts(self) -> None:
        for folder in sample_dirs():
            with self.subTest(folder.name):
                self.assertTrue((folder / "sample.json").exists())
                self.assertTrue((folder / "template.json").exists())
                self.assertTrue(sorted(folder.glob("values-*.json")), "값 한 벌이 하나도 없다")

    def test_sample_metadata_is_the_viewer_s_own_shape(self) -> None:
        """명단과 focus 는 스키마가 아니라 뷰어의 인자다. 그래서 여기서 본다."""
        for folder in sample_dirs():
            with self.subTest(folder.name):
                meta = load(folder / "sample.json")
                self.assertEqual(set(meta) - {"focus"}, {"order", "name", "about", "subjects"})
                self.assertTrue(meta["name"] and meta["about"])
                ids = [s["id"] for s in meta["subjects"]]
                self.assertEqual(len(ids), len(set(ids)), "명단에 같은 id 가 둘 있다")
                self.assertTrue(all(s.get("label") for s in meta["subjects"]))


class CheckerPassesEverySample(unittest.TestCase):
    def test_every_template_passes(self) -> None:
        for folder in sample_dirs():
            with self.subTest(folder.name):
                result = check_template(load(folder / "template.json"))
                self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_every_valueset_passes_against_its_template(self) -> None:
        for folder in sample_dirs():
            template = load(folder / "template.json")
            for path in sorted(folder.glob("values-*.json")):
                with self.subTest(f"{folder.name}/{path.name}"):
                    result = check_valueset(load(path), template)
                    self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_every_focus_is_a_valid_render_arg_and_sits_in_the_roster(self) -> None:
        args = validator(RENDER_ARGS)
        for folder in sample_dirs():
            with self.subTest(folder.name):
                meta = load(folder / "sample.json")
                focus = meta.get("focus")
                self.assertTrue(args.is_valid({"focus": focus}))
                if focus is not None:
                    self.assertIn(focus, [s["id"] for s in meta["subjects"]])

    def test_the_roster_covers_every_analysed_subject(self) -> None:
        for folder in sample_dirs():
            with self.subTest(folder.name):
                seats = {s["id"] for s in load(folder / "sample.json")["subjects"]}
                analysed = {load(p)["subjectId"] for p in sorted(folder.glob("values-*.json"))}
                self.assertEqual(analysed - seats, set(), "값 한 벌이 있는데 명단에 없다")


class SamplesCoverWhatTheViewerMustShow(unittest.TestCase):
    def test_the_first_sample_uses_every_element(self) -> None:
        """맨 처음 띄우는 샘플이 언어 전부를 보여야 한다. 사람이 처음 보는 화면이다."""
        enum = set(documents()["weave-common.schema.json"]["$defs"]["Element"]["enum"])
        first = load(sample_dirs()[0] / "template.json")
        self.assertEqual({f["element"] for f in first["facets"]}, enum)

    def test_the_order_is_a_total_order(self) -> None:
        orders = [load(f / "sample.json")["order"] for f in sample_dirs()]
        self.assertEqual(orders, sorted(set(orders)), f"order 가 겹치거나 비었다: {orders}")

    def test_one_sample_has_a_single_subject(self) -> None:
        counts = [len(load(f / "sample.json")["subjects"]) for f in sample_dirs()]
        self.assertIn(1, counts, counts)

    def test_one_sample_mixes_in_an_unanalysed_subject(self) -> None:
        gaps = []
        for folder in sample_dirs():
            seats = {s["id"] for s in load(folder / "sample.json")["subjects"]}
            analysed = {load(p)["subjectId"] for p in sorted(folder.glob("values-*.json"))}
            gaps.append(len(seats - analysed))
        self.assertTrue(any(g > 0 for g in gaps), "값 한 벌이 없는 subject 가 어느 샘플에도 없다")

    def test_every_facet_carries_template_author_notes(self) -> None:
        # 깨알 지식이 값이 아니라 템플릿에 사는지. 샘플이 그 자리를 실제로 쓴다.
        for folder in sample_dirs():
            for facet in load(folder / "template.json")["facets"]:
                with self.subTest(f"{folder.name}/{facet['id']}"):
                    self.assertTrue(facet.get("notes"), "템플릿 주석이 없다")


class BuiltViewerIsNotStale(unittest.TestCase):
    def test_viewer_html_matches_its_sources(self) -> None:
        """사람이 여는 한 장이 지금 소스·샘플과 같은지. ``make viewer`` 로 다시 쓴다."""
        samples_js = build_viewer.samples_source()
        wanted = {
            build_viewer.OUT_SAMPLES: samples_js,
            build_viewer.OUT_HTML: build_viewer.html_source(samples_js),
        }
        for path, text in wanted.items():
            with self.subTest(path.name):
                self.assertTrue(path.exists(), "python3 tools/build_viewer.py 를 돌린다")
                self.assertEqual(path.read_text(encoding="utf-8"), text, "갈렸다. make viewer 로 다시 쓴다")

    def test_the_page_carries_no_outside_reference(self) -> None:
        """의존성 없는 한 장이다. CDN 도 서버도 쓰지 않는다 — 오프라인에서 죽지 않아야 한다."""
        page = build_viewer.OUT_HTML.read_text(encoding="utf-8")
        for forbidden in ("http://", "https://", "<script src", "<link rel=\"stylesheet\"", "fetch("):
            with self.subTest(forbidden):
                self.assertNotIn(forbidden, page)

    def test_every_sample_is_inlined(self) -> None:
        page = build_viewer.OUT_HTML.read_text(encoding="utf-8")
        for folder in sample_dirs():
            with self.subTest(folder.name):
                self.assertIn(load(folder / "sample.json")["name"], page)


if __name__ == "__main__":
    unittest.main()
