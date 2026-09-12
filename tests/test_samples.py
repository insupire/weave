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
    def test_the_samples_are_counted_here(self) -> None:
        # 사람이 빈 화면에서 시작하지 않는다. 성격이 다른 것으로 넷.
        # 수를 세는 자리는 **여기 하나**다. 두 군데서 세면 샘플을 늘릴 때마다 두 군데를 고친다.
        self.assertEqual(len(sample_dirs()), 6, [p.name for p in sample_dirs()])

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

    def test_one_sample_shows_a_choice(self) -> None:
        """고르는 자리는 있어도 되고 없어도 되는 것이라 **둘 다** 샘플에 서야 한다.

        없는 것이 기본이고 대다수가 그것이다. 보여 주는 샘플이 하나도 없으면 설명서가
        말로만 설명하게 되고, 그 자리가 실제로 도는지 아무도 안 본다.
        """
        picked = [d for d in sample_dirs() if load(d / "template.json").get("choices")]
        plain = [d for d in sample_dirs() if not load(d / "template.json").get("choices")]
        self.assertTrue(picked, "고르는 자리를 보여 주는 샘플이 없다")
        self.assertTrue(plain, "고르는 자리 없는 샘플이 없다 — 그쪽이 기본이다")
        for folder in picked:
            template = load(folder / "template.json")
            declared = {c["id"] for c in template["choices"]}
            for choice in template["choices"]:
                self.assertGreaterEqual(len(choice["options"]), 2, "고를 것 하나는 고르는 것이 아니다")
            fields = [d for f in template["facets"] for d in f["fields"]]
            rides = [d["key"] for d in fields if d.get("choice")]
            self.assertTrue(rides, f"{folder.name}: 타는 필드가 없으면 고르는 자리가 하는 일이 없다")
            steady = [d["key"] for d in fields if not d.get("choice")]
            self.assertTrue(steady, f"{folder.name}: 안 타는 필드도 있어야 무엇이 바뀌는지 보인다")
            for decl in fields:
                if "choice" in decl:
                    self.assertIn(decl["choice"], declared, f"{folder.name}/{decl['key']}")

    def test_sample_metadata_carries_a_render_args_document(self) -> None:
        """화면 상태는 뷰어가 지어낸 모양이 아니라 발행한 계약이다.

        무엇이 설 수 있는지는 **스키마가 정한다.** 여기에 이름을 또 적으면 계약이 두 벌이
        되어 갈릴 수 있다 — 스키마의 ``properties`` 로 재고, 검사기로 판정한다.
        """
        allowed = set(documents()["weave-render-args.schema.json"]["properties"])
        self.assertTrue(allowed, "렌더 인자 스키마에 properties 가 없다")
        for folder in sample_dirs():
            with self.subTest(folder.name):
                meta = load(folder / "sample.json")
                self.assertEqual(set(meta), {"order", "name", "args"})
                self.assertTrue(meta["name"])
                self.assertEqual(set(meta["args"]) - allowed, set(), "스키마에 없는 렌더 인자")
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

    def test_every_focus_names_a_subject_that_has_a_valueset(self) -> None:
        """값 한 벌들이 곧 명단이다. focus 는 그 가운데 하나를 가리킨다."""
        for folder in sample_dirs():
            with self.subTest(folder.name):
                focus = load(folder / "sample.json")["args"].get("focus")
                if focus is None:
                    continue
                ids = {load(p)["subjectId"] for p in sorted(folder.glob("values-*.json"))}
                self.assertIn(focus, ids)

    def test_each_subject_has_exactly_one_valueset(self) -> None:
        for folder in sample_dirs():
            with self.subTest(folder.name):
                ids = [load(p)["subjectId"] for p in sorted(folder.glob("values-*.json"))]
                self.assertEqual(len(ids), len(set(ids)), f"같은 subject 의 값 한 벌이 둘: {ids}")


class SamplesCoverWhatTheViewerMustShow(unittest.TestCase):
    def test_the_first_sample_uses_every_element(self) -> None:
        """맨 처음 띄우는 샘플이 언어 전부를 보여야 한다. 사람이 처음 보는 화면이다."""
        enum = set(documents()["weave-common.schema.json"]["$defs"]["Element"]["enum"])
        first = load(sample_dirs()[0] / "template.json")
        self.assertEqual({f["element"] for f in first["facets"]}, enum)

    def test_the_order_is_a_total_order(self) -> None:
        orders = [load(f / "sample.json")["order"] for f in sample_dirs()]
        self.assertEqual(orders, sorted(set(orders)), f"order 가 겹치거나 비었다: {orders}")

    def test_empty_values_and_an_all_blank_valueset_survive_in_the_samples(self) -> None:
        """샘플을 가르는 축은 아니지만 그 상태들은 여전히 보여야 한다.

        「아직 분석하지 않았다」의 자리를 **전부 빈 값 한 벌 + 주석**이 이어받았다.
        """
        empties, blanks = [], []
        for folder in sample_dirs():
            for doc in (load(p) for p in sorted(folder.glob("values-*.json"))):
                entries = _entries(doc)
                empties.append(any(e["state"] == "empty" for e in entries))
                if entries and all(e["state"] == "empty" for e in entries):
                    said = [n for f in doc["facets"].values() for n in f.get("notes", [])]
                    blanks.append((f"{folder.name}/{doc['subjectId']}", said))
        self.assertTrue(any(empties), "빈 값이 어느 샘플에도 없다")
        self.assertTrue(blanks, "전부 빈 값 한 벌이 어느 샘플에도 없다")
        for where, said in blanks:
            with self.subTest(where):
                self.assertTrue(said, "왜 비었는지 주석이 말해야 한다")

    def test_every_facet_carries_template_author_notes(self) -> None:  # noqa: D102
        # 깨알 지식이 값이 아니라 템플릿에 사는지. 샘플이 그 자리를 실제로 쓴다.
        for folder in sample_dirs():
            for facet in load(folder / "template.json")["facets"]:
                with self.subTest(f"{folder.name}/{facet['id']}"):
                    self.assertTrue(facet.get("notes"), "템플릿 주석이 없다")


def _entries(doc: dict) -> list[dict]:
    """값 한 벌의 모든 값 자리. **갈래로 쪼갠 자리도 펴서 센다.**

    고르는 자리가 들어오면서 한 필드가 값 하나일 수도 고를 것마다 하나일 수도 있게 됐다.
    펴지 않으면 「빈 값이 샘플에 있는가」 같은 물음이 그쪽을 못 보고 지나간다.
    """
    out = []
    for facet in doc["facets"].values():
        for slot in facet["fields"].values():
            out.extend(slot["byOption"].values() if "byOption" in slot else [slot])
    return out


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
                self.assertEqual(set(entry), {"compare", "draws", "note", "demo"})
                self.assertIn(entry["compare"], {"overlay", "focus"})

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

    def test_the_page_makes_no_outside_request(self) -> None:
        """의존성 없는 한 장이다. CDN 도 서버도 쓰지 않는다 — 오프라인에서 죽지 않아야 한다.

        막는 것은 **바깥 요청**이지 글자가 아니다. 주석 속 출처·라이선스 URL 은 요청을 만들지
        않으므로 남는다 — 아이콘의 출처 고지가 빌드 산출물까지 따라가야 한다.
        """
        page = build_viewer.OUT_HTML.read_text(encoding="utf-8")
        for forbidden in (
            "<script src", '<link rel="stylesheet"', "@import", "fetch(",
            "XMLHttpRequest", 'src="http', "href=\"http", "url(http",
        ):
            with self.subTest(forbidden):
                self.assertNotIn(forbidden, page)

        # 그 밖에 주소가 나오는 줄은 전부 주석이어야 한다.
        for number, line in enumerate(page.splitlines(), 1):
            if "http" not in line:
                continue
            said = line.strip()
            with self.subTest(f"{number}: {said[:40]}"):
                self.assertTrue(
                    said.startswith(("//", "*", "/*", "<!--")) or said.endswith("-->"),
                    "주석이 아닌 자리에 주소가 있다",
                )

    def test_every_sample_is_inlined(self) -> None:
        page = build_viewer.OUT_HTML.read_text(encoding="utf-8")
        for folder in sample_dirs():
            with self.subTest(folder.name):
                self.assertIn(load(folder / "sample.json")["name"], page)


if __name__ == "__main__":
    unittest.main()
