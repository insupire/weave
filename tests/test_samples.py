"""샘플과 primitive element 카탈로그의 고정 케이스.

샘플은 **템플릿 샘플**이다 — 분석뷰를 어떻게 짤 수 있는지를 여럿으로 보인다. 가르는 축은
템플릿의 짜임이지 값의 상태가 아니다. 값 상태 조합의 판정은 `tests/fixtures/ok/` 를 쓰는
`tests/viewer.test.mjs` 가 갖는다.

**검사기가 샘플과 카탈로그 보기 전부를 통과시키는 것**이 여기 걸린다 — 뷰어는 판정하지
않으므로 그것들이 옳다는 근거가 이 자리밖에 없다.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
import unittest

from weave import check_render_args, check_template, check_valueset
from weave.schemas import documents

ROOT = pathlib.Path(__file__).resolve().parent.parent
SAMPLES = ROOT / "samples"

sys.path.insert(0, str(ROOT))
from tools import build_viewer, catalog, reference  # noqa: E402


def sample_dirs() -> list[pathlib.Path]:
    """빌더와 같은 순서로 본다 — 뷰어가 띄우는 차례가 곧 이 차례다."""
    return build_viewer.sample_dirs()


def load(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


class SamplesAreWhole(unittest.TestCase):
    def test_the_samples_are_counted_here(self) -> None:
        # 사람이 빈 화면에서 시작하지 않는다. 성격이 다른 것으로 넷.
        # 수를 세는 자리는 **여기 하나**다. 두 군데서 세면 샘플을 늘릴 때마다 두 군데를 고친다.
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
    def test_the_samples_cover_every_element_together(self) -> None:
        """샘플 **전부를 합치면** 언어를 다 쓴다. 한 샘플에 다 밀어 넣지 않는다.

        커버리지를 첫 샘플에 지우면 그 샘플이 실물이 아니라 진열장이 된다 — 샘플은
        사람이 읽는 화면이고 커버리지는 기계가 보는 것이라 목적이 다르다. 어휘를 빠짐없이
        쓰는지는 고정 케이스가 본다(``test_every_element_is_exercised``). 여기서는
        **설명서가 모든 원소를 실제 화면으로 한 번은 보여 주는지**만 본다.
        """
        enum = set(documents()["weave-common.schema.json"]["$defs"]["Element"]["enum"])
        used = {f["element"] for d in sample_dirs() for f in load(d / "template.json")["facets"]}
        self.assertEqual(used, enum, f"어느 샘플도 안 쓰는 원소: {sorted(enum - used)}")

    def test_the_order_is_a_total_order(self) -> None:
        orders = [load(f / "sample.json")["order"] for f in sample_dirs()]
        self.assertEqual(orders, sorted(set(orders)), f"order 가 겹치거나 비었다: {orders}")

    def test_empty_values_and_an_all_blank_valueset_survive_in_the_samples(self) -> None:
        """샘플을 가르는 축은 아니지만 그 상태들은 여전히 보여야 한다.

        「아직 채우지 않았다」의 자리를 **전부 빈 값 한 벌 + 주석**이 이어받았다.
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

    def test_titles_are_names_and_hints_carry_the_sentence(self) -> None:
        """**샘플이 본보기다.** 템플릿을 쓰는 쪽이 여기 말투를 따라 쓴다.

        제목은 **이름**(명사구)이고 「이것이 무엇인지」는 hint 가 진다. 제목이 설명까지
        지면 화면을 훑을 때 무엇에 대한 자리인지가 한눈에 안 들어온다.

        **말투는 기계가 못 잰다.** 여기서 막는 것은 되돌아가기 쉬운 한 가지 — 물음 꼴이다.
        나머지(명사구인가·간결한가)는 사람이 본다.
        """
        asking = ("?", "？")
        endings = ("나", "까", "요", "다")
        for folder in sample_dirs():
            meta = load(folder / "sample.json")
            template = load(folder / "template.json")
            names = [("샘플 이름", meta["name"]), ("분석뷰 제목", template["title"])]
            names += [(f"facet {f['id']}", f["title"]) for f in template["facets"]]
            for where, said in names:
                with self.subTest(f"{folder.name}/{where}"):
                    self.assertFalse(said.endswith(asking), f"물음표로 끝난다: {said}")
                    self.assertFalse(
                        said.endswith(endings), f"제목이 문장이다 — 이름으로 쓴다: {said}"
                    )
            for facet in template["facets"]:
                with self.subTest(f"{folder.name}/{facet['id']}/hint"):
                    self.assertIn("hint", facet, "이것이 무엇인지를 말하는 자리가 비었다")

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
                self.assertEqual(set(entry), {"compare", "draws", "blank", "note", "demo"})
                # "chosen" 은 rows 처럼 facet 의 compare 필드가 스스로 고르는 element 다.
                self.assertIn(entry["compare"], {"overlay", "focus", "chosen"})

    def test_prose_is_plain_text(self) -> None:
        """표에서는 살고 화면에서는 글자로 새는 markdown 을 막는다. 두 자리에 같게 나와야 한다."""
        def look(where: str, text: str) -> None:
            with self.subTest(where):
                self.assertNotIn("**", text)
                self.assertNotIn("`", text)

        for row in catalog.catalog():
            for field in ("draws", "blank", "note"):
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
        """보기가 실제로 쓸 수 있는 템플릿이어야 설명서 노릇을 한다.

        보기 하나에 facet 이 여럿일 수 있다 — `rows` 처럼 compare 로 갈리는 갈래를
        하나의 demo 로 함께 보이는 경우다. 다만 전부 그 카탈로그 항목의 element 여야 한다.
        """
        for row in catalog.catalog():
            demo = row["demo"]
            with self.subTest(row["element"]):
                result = check_template(demo["template"])
                self.assertTrue(result.ok, [str(p) for p in result.problems])
                elements = [f["element"] for f in demo["template"]["facets"]]
                self.assertTrue(elements, "demo 에 facet 이 하나도 없다")
                self.assertEqual(set(elements), {row["element"]})
                for doc in demo["values"]:
                    result = check_valueset(doc, demo["template"])
                    self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_the_docs_table_is_generated_not_written(self) -> None:
        text = catalog.DOCS.read_text(encoding="utf-8")
        self.assertIn(catalog.MARK_START, text)
        self.assertIn(catalog.docs_table(), text)


class ReferenceCountsEveryPlace(unittest.TestCase):
    """**요소 전수 표가 자리 하나도 빠뜨리지 않는다.**

    손으로 적은 목록은 칸이 늘 때 조용히 옛것이 된다. 그래서 표를 스키마에서 뽑고,
    여기서는 **뽑기가 눈을 감지 않았는지**를 본다 — 훑기가 좁아지면 표가 줄어든 채로
    통과해 버린다.
    """

    def _places(self) -> list[tuple[str, str]]:
        """스키마에 있는 모든 자리. **손으로 세지 않는다.**"""
        out = []

        def walk(node: object, where: str) -> None:
            if isinstance(node, dict):
                for key, sub in node.get("properties", {}).items():
                    out.append((where, key))
                    walk(sub, f"{where}.{key}")
                for key, sub in node.get("$defs", {}).items():
                    walk(sub, f"{where}#{key}")
                for key in ("items", "additionalProperties", "then", "not"):
                    if isinstance(node.get(key), dict):
                        walk(node[key], where)
                for key in ("allOf", "anyOf", "oneOf"):
                    for sub in node.get(key, []):
                        walk(sub, where)

        for name, doc in documents().items():
            walk(doc, name)
        return out

    def test_every_place_is_in_the_table(self) -> None:
        body = reference.body()
        missing = sorted({key for _, key in self._places() if f"`{key}`" not in body})
        self.assertEqual(missing, [], f"요소 전수 표에 없는 자리가 있다: {missing}")

    def test_the_scan_would_notice_a_missing_place(self) -> None:
        """**대조군.** 자리를 하나 빼 보고 표가 그것을 잃는지 본다."""
        places = {key for _, key in self._places()}
        for known in ("subjectLabel", "byOption", "previousFocus", "allowed", "compare"):
            self.assertIn(known, places, "훑기가 자리를 못 센다")
        slot = reference.SCHEMAS["weave-valueset.schema.json"]["$defs"]["FieldSlot"]["properties"]
        gone = slot.pop("byOption")
        try:
            self.assertNotIn("`byOption`", reference.body(), "뺀 자리가 표에 남았다")
        finally:
            slot["byOption"] = gone

    def test_a_place_without_a_description_stops_the_build(self) -> None:
        """**대조군.** 설명이 없으면 멈춘다 — 빈 칸을 낸 표는 없는 것만 못하다."""
        node = reference.SCHEMAS["weave-valueset.schema.json"]["properties"]["subjectLabel"]
        said = node.pop("description")
        try:
            with self.assertRaises(SystemExit):
                reference.body()
        finally:
            node["description"] = said

    def test_the_section_is_generated_not_written(self) -> None:
        text = catalog.DOCS.read_text(encoding="utf-8")
        self.assertIn(reference.MARK_START, text)
        self.assertIn(reference.body(), text)

    def test_the_prose_tells_every_closed_vocabulary_value(self) -> None:
        """**어휘 하나가 설명서 본문에서 통째로 빠지지 않는다.**

        전수 표가 값을 나열하니 그 뒤는 늘 통과한다 — 그러므로 **표 앞의 글**만 본다.
        실제로 그렇게 빠져 있었다: 타입 하나가 어휘에 들어온 뒤로 타입 표에 줄이 없었다.
        """
        text = catalog.DOCS.read_text(encoding="utf-8")
        prose = text.partition(reference.MARK_START)[0]
        defs = documents()["weave-common.schema.json"]["$defs"]
        for vocabulary in ("Type", "Shape", "Element", "AnnotationKind"):
            for value in defs[vocabulary]["enum"]:
                with self.subTest(f"{vocabulary}.{value}"):
                    self.assertIn(f"`{value}`", prose, f"설명서 본문이 {value} 를 말하지 않는다")


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


class MarkdownPointsAtRealPlaces(unittest.TestCase):
    """**자리를 옮기면 그것을 가리키던 글이 같이 따라와야 한다.**

    폴더 하나를 옮겨 보니 ``make all`` 이 코드의 경로는 전부 잡는데 **산문의 경로는 못 잡았다** —
    ``AGENTS.md`` 의 레이아웃 표와 ``README.md`` 의 안내가 없는 파일을 가리켜도 통과했다.
    """

    LINK = re.compile(r"\]\(([^)\s]+)\)")
    SKIP = {".git", ".venv", "__pycache__", "node_modules"}

    # **적어 둔 명령도 자리를 가리킨다.** 링크만 재면 울타리 안의 경로는 아무도 안 보고,
    # 폴더가 없어진 뒤에도 설명서의 **첫 명령**이 그대로 서 있는다. 실제로 그랬다.
    # 명령은 저장소 뿌리에서 돈다 — 그래서 뿌리 기준으로 푼다. 맨 위 폴더 이름으로
    # 시작하는 것만 경로로 본다: 폴더가 늘면 훑기도 같이 는다.
    FENCE = re.compile(r"^```.*?^```", re.S | re.M)

    @classmethod
    def tops(cls) -> set[str]:
        return {p.name for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith(".")} - cls.SKIP

    def test_every_path_in_a_command_resolves(self) -> None:
        pattern = re.compile(r"(?<![\w/.-])((?:%s)/[\w./*-]+)" % "|".join(sorted(self.tops())))
        dead = []
        for path in ROOT.rglob("*.md"):
            if set(path.relative_to(ROOT).parts) & self.SKIP:
                continue
            for fence in self.FENCE.findall(path.read_text(encoding="utf-8")):
                for target in pattern.findall(fence):
                    target = target.rstrip(".,)")
                    if not list(ROOT.glob(target)):
                        dead.append(f"{path.relative_to(ROOT)} → {target}")
        self.assertEqual(dead, [], f"적어 둔 명령이 없는 자리를 가리킨다: {dead}")

    def test_every_repo_link_resolves(self) -> None:
        dead = []
        for path in ROOT.rglob("*.md"):
            if set(path.relative_to(ROOT).parts) & self.SKIP:
                continue
            for target in self.LINK.findall(path.read_text(encoding="utf-8")):
                if target.startswith(("http://", "https://", "mailto:", "#")):
                    continue
                where = (path.parent / target.split("#", 1)[0]).resolve()
                if not where.exists():
                    dead.append(f"{path.relative_to(ROOT)} → {target}")
        self.assertEqual(dead, [], f"가리키는 자리가 없다: {dead}")

    def test_the_scan_would_notice(self) -> None:
        """**대조군.** 위 판정이 죽은 링크를 실제로 무는지."""
        self.assertEqual(self.LINK.findall("[글](../render) 과 [딴 것](docs/weave.md#자리)"),
                         ["../render", "docs/weave.md#자리"])
        self.assertFalse((ROOT / "render" / "nowhere.mjs").exists())

        # 울타리 쪽도 같은 자로 잰다 — 무는지와, 안 물 것은 안 무는지.
        pattern = re.compile(r"(?<![\w/.-])((?:%s)/[\w./*-]+)" % "|".join(sorted(self.tops())))
        fences = self.FENCE.findall("앞\n```sh\npython -m weave template samples/nowhere/template.json\n```\n뒤\n")
        self.assertEqual(len(fences), 1, "울타리를 못 찾는다")
        self.assertEqual(pattern.findall(fences[0]), ["samples/nowhere/template.json"])
        self.assertEqual(list(ROOT.glob("samples/nowhere/template.json")), [], "없는 자리가 있다")
        self.assertTrue(list(ROOT.glob("samples/*/template.json")), "별표를 못 푼다")
        # 경로가 아닌 것은 안 문다 — 옵션 값도 산출물 이름도 자리가 아니다.
        self.assertEqual(pattern.findall("npx tool --cwd=schema -o weave_template.d.ts"), [])
        self.assertIn("samples", self.tops())


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


class CountsAreNotWrittenOutInProse(unittest.TestCase):
    """**닫힌 어휘의 개수를 글로 적지 않는다.**

    적으면 어휘가 늘 때 두 군데를 고쳐야 하고, 한쪽이 빠지면 문서가 조용히 거짓말을 한다.
    실제로 그렇게 굳어 있었다 — 설명서가 적어 둔 타입의 개수는 실제보다 하나 적었고,
    아이콘의 개수는 둘이나 적었으며, 렌더 주석의 primitive element 개수는 옛 수 그대로였다.
    **수를 고치는 것이 아니라 걷는 것이 고침이다** — 고쳐 봐야 다음에 또 갈린다.

    **찾는 꼴을 이 파일에 통째로 적지 않는다** — 적으면 스스로 걸린다. 예외를 두면
    「저장소에 그런 자리가 없다」가 더는 참이 아니게 되므로, 형제 저장소 이름을 막는
    판정과 같이 조각으로 이어 붙인다.

    수가 없어도 뜻이 사는 문장이면 걷는다. 「고를 것이 여섯이면 값도 여섯이다」처럼
    **수 자체가 예시인 문장**은 어휘의 개수가 아니므로 여기 걸리지 않는다.
    """

    WORDS = "둘|셋|넷|다섯|여섯|일곱|여덟|아홉|열"
    # 개수의 정본이 있는 어휘만 본다. 정본이 없으면 판정이 무엇과 견줄지 모른다.
    TERMS = ["타입", "모양", "primitive element", "주석 갈래"]
    # **글이 있는 자리는 전부 본다.** 문서만 막으면 「왜 여기만 막나」가 나오고 코드 쪽은
    # 계속 갈린다. 코드를 고치러 온 사람이 제일 먼저 읽는 것이 주석이다.
    #
    # **자리를 손으로 적지 않고 찾는다.** 적어 두면 한 줄 지워 훑는 범위를 줄일 수 있고,
    # 그러면 판정이 조용히 좁아진다 — 이 판정이 막으려는 병과 같은 꼴이다.
    SKIP = {".git", ".venv", "__pycache__", "node_modules"}
    SUFFIXES = {".md", ".json", ".mjs", ".js", ".py", ".css", ".yml", ".html"}

    def _texts(self) -> dict[str, str]:
        out = {}
        for path in ROOT.rglob("*"):
            if not path.is_file() or set(path.relative_to(ROOT).parts) & self.SKIP:
                continue
            if path.suffix not in self.SUFFIXES:
                continue
            try:
                out[str(path.relative_to(ROOT))] = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
        return out

    def test_no_closed_vocabulary_is_counted_in_words(self) -> None:
        import re

        hits = []
        for name, text in self._texts().items():
            for term in self.TERMS:
                for pattern in (rf"{re.escape(term)}\s*(?:는|은|이|가)?\s*({self.WORDS})",
                                rf"({self.WORDS})\s+{re.escape(term)}\b"):
                    for found in re.finditer(pattern, text):
                        line = text[: found.start()].count("\n") + 1
                        hits.append(f"{name}:{line} {found.group(0).strip()}")
        self.assertEqual(hits, [], f"어휘의 개수를 글로 적었다 — 수를 고치지 말고 걷는다: {hits}")

    def test_the_scan_would_notice(self) -> None:
        """**대조군.** 위 판정은 지금 아무것도 못 찾는다 — 찾을 줄은 아는지 여기서 본다."""
        import re

        # `\b` 는 한글 뒤에 서지 않는다 — 「다섯이고」에는 경계가 없어 그것을 믿으면 판정이 눈을 감는다.
        pattern = rf"primitive element\s*(?:는|은|이|가)?\s*({self.WORDS})"
        # 미끼는 **조각으로 잇는다** — 통째로 적으면 이 파일이 스스로 걸린다.
        bait = "primitive element 는 " + "다" + "섯이고"
        self.assertTrue(re.search(pattern, bait), "패턴이 안 문다")
        self.assertTrue(re.search(rf"({self.WORDS})\s+primitive element\b", "다" + "섯 primitive element"))
        # **수가 예시이거나 실제 값인 자리는 안 문다** — 그것까지 막으면 쓸 수 있는 말이 줄어든다.
        for safe in ["고를 것이 여섯이면 값도 여섯이다", "주석을 아홉 개 단다",
                     "색이 나오는 자리는 둘뿐이다", "세 갈래를 보려면 선이 셋이어야 한다"]:
            for one in (pattern, rf"({self.WORDS})\s+primitive element\b"):
                self.assertIsNone(re.search(one, safe), safe)
        # **훑는 범위가 좁아지면 위 판정은 조용히 눈을 감는다.** 어휘와 자리가 살아 있는지 본다.
        self.assertGreaterEqual(len(self.TERMS), 4, "볼 어휘가 없다")
        texts = self._texts()
        # 글이 사는 자리 — 문서·렌더·앱·아이콘·고정 케이스·도구가 전부 훑기에 들어야 한다.
        for name in ("AGENTS.md", "docs/weave.md", "catalog/elements.json",
                     "render/render.mjs", "viewer/app.mjs", "render/icons.mjs",
                     "tests/viewer.test.mjs", "tests/test_samples.py", "tools/catalog.py"):
            self.assertIn(name, texts, f"훑기가 {name} 를 안 본다")
        self.assertGreater(len(texts), 30, "훑은 파일이 너무 적다")
        # 어휘가 그 자리에 실제로 쓰이는 말인지 — 죽은 글자를 훑으면 영원히 아무것도 못 찾는다.
        for term in self.TERMS:
            self.assertTrue(any(term in text for text in texts.values()), f"쓰이지 않는 말을 훑는다: {term}")


class TheRepoDoesNotKnowItsConsumersByName(unittest.TestCase):
    """**소비자를 이름으로 알지 않는다. 역할만 안다.**

    보험을 모르기로 한 것과 같은 이유다 — 특정 앱을 알면 소비자가 늘거나 바뀔 때 굳는다.
    공유 계약은 소비자가 바뀌어도 안 바뀐다. 누가 그 자리에 있는지는 PM 이 갖는다.

    **찾는 이름을 이 파일에 통째로 적지 않는다** — 적으면 스스로 걸리고, 예외를 두면
    「이 저장소에 그 이름이 없다」가 더는 참이 아니게 된다. 조각으로 이어 붙인다.
    """

    # **조각은 맨이름도 담지 않는다.** 아래 BARE 가 맨이름까지 막으므로, 조각 하나가
    # 통째로 맨이름이면 이 파일이 스스로 걸린다 — 실제로 그런 조각이 하나 있었다.
    NAMES = [
        ("claim", "-mobile"), ("claim", "-web"), ("claim", "-chat"),
        ("claim", "-design", "-system"), ("eighty", "two", "-jud", "ge"),
        ("insurance", "-policy", "-search"), ("ip", "ix"),
    ]

    # **맨이름도 이름이다.** 전체 이름만 찾으면 앞을 뗀 한 마디가 그대로 지나간다 —
    # 실제로 지나갔고, 저장소를 고치는 쪽이 읽는 글에 그 한 마디가 서 있었다.
    # 여기 서는 것은 **그 저장소 말고는 가리킬 것이 없는 말**뿐이다. 흔한 말(web·chat·claim)은
    # 두고 `NAMES` 가 전체 이름으로만 잡는다 — 막으면 `-webkit-` 같은 자리가 억울하게
    # 빨개지고, 억울한 판정은 다음 사람이 걷어낸다.
    BARE = [("jud", "ge"), ("eighty", "two"), ("design", "-system"), ("policy", "-search")]
    SKIP = {".git", ".venv", "__pycache__"}
    SUFFIXES = {".md", ".py", ".mjs", ".js", ".json", ".css", ".html", ".yml", ".txt", ""}

    def _texts(self) -> dict[str, str]:
        out = {}
        for path in ROOT.rglob("*"):
            if not path.is_file() or set(path.relative_to(ROOT).parts) & self.SKIP:
                continue
            if path.suffix not in self.SUFFIXES:
                continue
            try:
                out[str(path.relative_to(ROOT))] = path.read_text(encoding="utf-8")
            except (UnicodeDecodeError, OSError):
                continue
        return out

    # **하는 일로 부르는 것도 이름으로 아는 것이다.** 우리 계약을 읽는 쪽이 지금 무슨 일을
    # 하는지(뽑아낸다·판정한다)를 스키마의 글이 말하기 시작하면, 다른 쪽이 그 자리에 붙는
    # 날 그 말이 거짓이 된다. 언어가 아는 역할은 **채우는 쪽**과 **그리는 쪽**까지다.
    # 여기도 조각으로 잇는다 — 통째로 적으면 이 파일이 스스로 걸린다.
    ROLE_HALVES = [("Proce", "dure"), ("추", "출"), ("분석", "에게")]

    def test_no_consumer_role_is_named(self) -> None:
        texts = self._texts()
        for head, tail in self.ROLE_HALVES:
            word = head + tail
            hits = sorted(where for where, text in texts.items() if word in text)
            with self.subTest(word):
                self.assertEqual(hits, [], f"소비자가 하는 일로 소비자를 불렀다: {word} — {hits}")

    def test_no_sibling_repository_is_named(self) -> None:
        texts = self._texts()
        for pieces in self.NAMES + self.BARE:
            name = "".join(pieces)
            hits = sorted(where for where, text in texts.items() if name in text)
            with self.subTest(name):
                self.assertEqual(hits, [], f"형제 저장소 이름이 남아 있다: {name} — {hits}")

    def test_the_scan_actually_reads_the_repository(self) -> None:
        """**대조군.** 훑는 자리가 비어 있으면 위 판정은 아무것도 안 보고 통과한다."""
        texts = self._texts()
        self.assertIn("AGENTS.md", texts)
        self.assertGreater(len(texts), 30, "훑은 파일이 너무 적다")
        # 있는 것은 찾아낸다 — 같은 훑기로 확실히 있는 말을 집어 본다.
        found = [where for where, text in texts.items() if "primitive element" in text]
        self.assertGreater(len(found), 3, "훑기가 글을 못 읽는다")
        # **조각이 스스로 맨이름이면** 이 파일이 걸려 판정 전체가 못 쓰게 된다.
        for pieces in self.NAMES:
            for piece in pieces:
                for bare in self.BARE:
                    self.assertNotIn("".join(bare), piece, "조각 하나가 이미 맨이름이다")


class TheLanguageDoesNotSayWhatIsShown(unittest.TestCase):
    """**언어는 그 자리가 무엇인지까지만 말한다. 무엇을 화면에 낼지는 렌더가 고른다.**

    보험을 모르기로 한 것·소비자를 이름으로 모르기로 한 것과 같은 줄이다. 스키마의 설명
    글이 「이것은 늘 보인다」·「이것은 화면에 안 나온다」라고 말하기 시작하면, 그 자리를
    내기로 한 렌더가 나타나는 날 그 말이 거짓이 된다. **렌더는 우리가 아는 하나가 아니다.**

    갈리는 선은 이렇다.

    | 언어가 말한다 | 렌더가 고른다 |
    | --- | --- |
    | 그것이 무엇인가 — 「이 필드의 이름」·「이 필드의 설명」 | 그것을 내는가 |
    | 어디에 매이는가 — 「필드에 매인다」·「표의 열 하나」 | 어느 자리에 내는가 |
    | 값과의 관계 — 「값이 없어도 필요한 말이다」 | 늘 내는가, 열어야 나오는가 |

    **그리는 법이 곧 뜻인 자리는 여기 걸리지 않는다** — `element`·`compare`·렌더 인자는
    화면을 말하는 것이 제 일이다. 막는 것은 **글과 이름이 설 자리**가 제 렌더를 정하는 것뿐이라,
    아래 어휘도 「보임」과 「자리」로만 골랐다.
    """

    # 자리를 정하거나 보임을 못 박는 말. 각각이 **렌더가 어떻게 다뤄야 하는가**다.
    BANNED = [
        "화면에 보인다", "화면에 나온다", "화면에 나오지", "화면에는 나오",
        "화면에서", "화면에 쓸", "화면을 훑",
        "늘 보인다", "늘 보이는", "늘 읽",
        "제목 아래", "맨 위에", "머리에 선다", "옆에 선다",
        "보여준다", "표시된다", "숨는다", "숨긴다",
    ]

    @staticmethod
    def _walk(node: object, where: str) -> dict[str, str]:
        """문서 하나에서 사람 글을 모은다 — `description` 과 `title`."""
        out: dict[str, str] = {}

        def go(node: object, where: str) -> None:
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in ("description", "title") and isinstance(value, str):
                        out[f"{where}/{key}"] = value
                    else:
                        go(value, f"{where}/{key}")
            elif isinstance(node, list):
                for i, value in enumerate(node):
                    go(value, f"{where}[{i}]")

        go(node, where)
        return out

    def _prose(self) -> dict[str, str]:
        """스키마에 적힌 사람 글을 **전부** 모은다."""
        out: dict[str, str] = {}
        for path in sorted((ROOT / "schema").glob("*.json")):
            out.update(self._walk(json.loads(path.read_text(encoding="utf-8")), path.name))
        return out

    def test_no_description_decides_what_the_render_shows(self) -> None:
        prose = self._prose()
        for word in self.BANNED:
            hits = sorted(where for where, text in prose.items() if word in text)
            with self.subTest(word):
                self.assertEqual(hits, [], f"언어가 렌더의 선택을 미리 정했다: {word} — {hits}")

    def test_the_scan_actually_reads_the_schemas(self) -> None:
        """**대조군.** 훑는 자리가 비어 있거나 어휘가 안 물면 위 판정은 늘 통과한다."""
        prose = self._prose()
        self.assertGreater(len(prose), 60, "훑은 설명 글이 너무 적다")
        for name in ("weave-template.schema.json", "weave-valueset.schema.json",
                     "weave-render-args.schema.json", "weave-common.schema.json"):
            self.assertTrue(any(where.startswith(name) for where in prose),
                            f"훑기가 {name} 를 안 본다")
        # 심은 것을 실제로 문다 — 결함을 **훑기가 지나가는 길**에 심고 같은 길로 잰다.
        # 문장 안에 든 말을 그 문장에서 다시 찾으면 무엇을 심어도 참이라 아무것도 안 잰다.
        for word in self.BANNED:
            planted = self._walk(
                {"$defs": {"Field": {"properties": {"hint": {"description": f"이 자리의 이름. {word}."}}}}},
                "planted.json",
            )
            with self.subTest(word):
                hits = [where for where, text in planted.items() if word in text]
                self.assertEqual(hits, ["planted.json/$defs/Field/properties/hint/description"],
                                 f"깊이 심은 것을 훑기가 못 본다: {word}")
        # **설명 글이 아닌 자리는 안 본다.** 닫힌 어휘의 값까지 물면 쓸 수 있는 말이 줄어든다.
        elsewhere = self._walk({"$defs": {"Kind": {"enum": ["화면에 보인다"], "const": "늘 보인다"}}}, "x.json")
        self.assertEqual(elsewhere, {}, "설명 글이 아닌 자리를 글로 읽는다")

    def test_the_hint_and_the_description_are_told_apart_by_depth(self) -> None:
        """**둘이 갈리는 까닭이 형에 이미 있다.** 없어지면 칸 하나를 지워야 한다는 뜻이다.

        독자로도 보임으로도 가르지 않기로 했으므로 남는 축은 **깊이**다. 그 축은 글이
        아니라 형이 진다 — `hint` 는 한 줄이라 가리키기밖에 못 하고, `description` 은
        단위와 경계를 끝까지 적을 만큼 길다. 그래서 하나는 선택이고 하나는 필수다.
        """
        field = documents()["weave-template.schema.json"]["$defs"]["Field"]
        hint, desc = field["properties"]["hint"], field["properties"]["description"]
        self.assertEqual(hint["maxLength"], 80, "한 줄을 넘기면 가리키는 말이 아니다")
        self.assertRegex(hint["pattern"], r"\\n", "줄바꿈을 막지 않으면 한 줄이 아니다")
        self.assertGreaterEqual(desc["maxLength"], 600, "끝까지 적을 자리가 없다")
        self.assertGreater(desc["minLength"], 1, "한 마디로 때울 수 있으면 깊이가 축이 아니다")
        self.assertIn("description", field["required"], "채울 수 없는 자리가 생긴다")
        self.assertNotIn("hint", field["required"], "가리키는 말은 없어도 자리를 채운다")
