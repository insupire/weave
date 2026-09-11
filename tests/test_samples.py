"""샘플과 primitive element 카탈로그의 고정 케이스.

샘플은 **템플릿 샘플**이다 — 분석뷰를 어떻게 짤 수 있는지를 넷으로 보인다. 가르는 축은
템플릿의 짜임이지 값의 상태가 아니다. 값 상태 조합의 판정은 `tests/fixtures/ok/` 를 쓰는
`tests/viewer.test.mjs` 가 갖는다.

**검사기가 샘플과 카탈로그 보기 전부를 통과시키는 것**이 여기 걸린다 — 뷰어는 판정하지
않으므로 그것들이 옳다는 근거가 이 자리밖에 없다.
"""

from __future__ import annotations

import json
import pathlib
import sys
import unittest

from weave import check_render_args, check_template, check_valueset
from weave.schemas import documents

ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "samples"

sys.path.insert(0, str(ROOT))
from tools import build_viewer, catalog  # noqa: E402


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

    def test_samples_are_told_apart_by_template_shape(self) -> None:
        """가르는 축은 템플릿의 짜임이다. 값 상태로 가르면 샘플이 아니라 fixture 다."""
        shapes = [
            tuple(f["element"] for f in load(d / "template.json")["facets"]) for d in sample_dirs()
        ]
        self.assertEqual(len(set(shapes)), len(shapes), f"짜임이 겹친다: {shapes}")

    def test_sample_metadata_carries_a_render_args_document(self) -> None:
        """명단과 focus 는 뷰어가 지어낸 모양이 아니라 발행한 계약이다."""
        for folder in sample_dirs():
            with self.subTest(folder.name):
                meta = load(folder / "sample.json")
                self.assertEqual(set(meta), {"order", "name", "args"})
                self.assertTrue(meta["name"])
                result = check_render_args(meta["args"])
                self.assertTrue(result.ok, [str(p) for p in result.problems])


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

    def test_every_focus_sits_in_the_roster(self) -> None:
        for folder in sample_dirs():
            with self.subTest(folder.name):
                args = load(folder / "sample.json")["args"]
                if args.get("focus") is not None:
                    self.assertIn(args["focus"], [s["id"] for s in args["subjects"]])

    def test_the_roster_covers_every_analysed_subject(self) -> None:
        for folder in sample_dirs():
            with self.subTest(folder.name):
                seats = {s["id"] for s in load(folder / "sample.json")["args"]["subjects"]}
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

    def test_empty_values_and_an_unanalysed_subject_survive_in_the_samples(self) -> None:
        """샘플을 가르는 축은 아니지만 그 상태들은 여전히 보여야 한다."""
        gaps, empties = [], []
        for folder in sample_dirs():
            seats = {s["id"] for s in load(folder / "sample.json")["args"]["subjects"]}
            docs = [load(p) for p in sorted(folder.glob("values-*.json"))]
            gaps.append(len(seats - {d["subjectId"] for d in docs}))
            empties.append(
                any(
                    entry["state"] == "empty"
                    for doc in docs
                    for facet in doc["facets"].values()
                    for entry in facet["fields"].values()
                )
            )
        self.assertTrue(any(g > 0 for g in gaps), "값 한 벌이 없는 subject 가 어느 샘플에도 없다")
        self.assertTrue(any(empties), "빈 값이 어느 샘플에도 없다")

    def test_every_facet_carries_template_author_notes(self) -> None:
        # 깨알 지식이 값이 아니라 템플릿에 사는지. 샘플이 그 자리를 실제로 쓴다.
        for folder in sample_dirs():
            for facet in load(folder / "template.json")["facets"]:
                with self.subTest(f"{folder.name}/{facet['id']}"):
                    self.assertTrue(facet.get("notes"), "템플릿 주석이 없다")


class CatalogCannotDiverge(unittest.TestCase):
    """설명서가 서는 자리가 둘이라 갈릴 수 있는 곳이다. 하나에서 만들어 둘 다 여기서 본다."""

    def test_the_catalog_covers_every_declared_element(self) -> None:
        enum = documents()["weave-common.schema.json"]["$defs"]["Element"]["enum"]
        self.assertEqual([row["element"] for row in catalog.catalog()], enum)

    def test_constraints_come_from_the_schema_not_from_prose(self) -> None:
        """산문 파일이 제약을 적지 않는다. 적으면 스키마와 갈린다."""
        prose = json.loads((ROOT / "catalog" / "elements.json").read_text(encoding="utf-8"))
        for element, entry in prose.items():
            if element.startswith("__"):
                continue
            with self.subTest(element):
                self.assertEqual(set(entry), {"draws", "note", "demo"})

    def test_prose_is_plain_text(self) -> None:
        """표에서는 살고 화면에서는 글자로 새는 markdown 을 막는다. 두 자리에 같게 나와야 한다."""
        def look(where: str, text: str) -> None:
            with self.subTest(where):
                self.assertNotIn("**", text)
                self.assertNotIn("`", text)

        for row in catalog.catalog():
            for field in ("draws", "note"):
                look(f"{row['element']}/{field}", row[field])
        for key, entry in catalog.guide().items():
            look(f"{key}/lead", entry["lead"])
            for index, para in enumerate(entry.get("paragraphs", [])):
                look(f"{key}/p{index}", para)

    def test_the_table_of_contents_comes_from_the_catalog(self) -> None:
        """목차를 손으로 적지 않는다. primitive element 가 늘거나 줄면 목차가 따라 바뀐다."""
        enum = documents()["weave-common.schema.json"]["$defs"]["Element"]["enum"]
        pages = catalog.pages()
        self.assertEqual([p["id"] for p in pages if p["kind"] == "element"], enum)
        self.assertEqual([p["kind"] for p in pages][0], "guide")
        self.assertEqual([p["kind"] for p in pages][-1], "playground")
        self.assertEqual(len({p["id"] for p in pages}), len(pages), "목차에 같은 id 가 둘 있다")

    def test_every_demo_passes_the_checker(self) -> None:
        """보기가 실제로 쓸 수 있는 템플릿이어야 설명서 노릇을 한다."""
        for row in catalog.catalog():
            demo = row["demo"]
            with self.subTest(row["element"]):
                result = check_template(demo["template"])
                self.assertTrue(result.ok, [str(p) for p in result.problems])
                self.assertEqual([f["element"] for f in demo["template"]["facets"]], [row["element"]])
                for doc in demo["values"]:
                    result = check_valueset(doc, demo["template"])
                    self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_the_docs_table_is_generated_not_written(self) -> None:
        text = catalog.DOCS.read_text(encoding="utf-8")
        self.assertIn(catalog.MARK_START, text)
        self.assertIn(catalog.docs_table(), text)


class Vocabulary(unittest.TestCase):
    def test_the_translated_term_does_not_come_back(self) -> None:
        """통용되는 기술 용어는 번역하지 않는다. `primitive element` 가 정본이다."""
        needle = "\uc6d0\uc2dc \uc694\uc18c"  # 찾는 말 자체가 이 파일에 있으면 스스로 걸린다
        skip = {".git", ".venv", "__pycache__"}
        hits = []
        for path in ROOT.rglob("*"):
            if not path.is_file() or set(path.relative_to(ROOT).parts) & skip:
                continue
            if path.suffix not in {".md", ".py", ".mjs", ".js", ".json", ".css", ".html", ".yml", ""}:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
            if needle in text:
                hits.append(str(path.relative_to(ROOT)))
        self.assertEqual(hits, [], f"번역어가 남아 있다: {hits}")


class BuiltViewerIsNotStale(unittest.TestCase):
    def test_every_artifact_matches_its_sources(self) -> None:
        """사람이 여는 한 장과 설명서 표가 지금 소스와 같은지. ``make viewer`` 로 다시 쓴다."""
        for path, text in build_viewer.artifacts().items():
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
