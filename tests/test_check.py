"""고정 케이스. 정상 사례가 통과하고 결함 사례가 막히는 것을 함께 본다."""

from __future__ import annotations

import copy
import json
import pathlib
import unittest

from weave import check_render_args, check_template, check_valueset
from weave.schemas import RENDER_ARGS, documents, validator

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures"


def load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


TEMPLATE = load("ok/template.json")
FILLED = load("ok/values-filled.json")
EMPTY = load("ok/values-empty.json")
MIXED = load("ok/values-mixed.json")


def facet(doc: dict, facet_id: str) -> dict:
    return next(f for f in doc["facets"] if f["id"] == facet_id)


def field(doc: dict, facet_id: str, key: str) -> dict:
    return next(f for f in facet(doc, facet_id)["fields"] if f["key"] == key)


class TemplatePasses(unittest.TestCase):
    def test_fixture_template_passes(self) -> None:
        result = check_template(TEMPLATE)
        self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_every_element_is_exercised(self) -> None:
        """고정 케이스가 **어휘 전부**를 쓴다. 수를 손으로 적지 않는다 —
        element 가 늘면 여기가 자동으로 따라오고, 안 쓰는 것이 생기면 걸린다.
        """
        used = {f["element"] for f in TEMPLATE["facets"]}
        self.assertEqual(used, set(documents()["weave-common.schema.json"]["$defs"]["Element"]["enum"]))

    def test_template_author_notes_use_the_same_four_kinds(self) -> None:
        # subject 무관 지식의 자리. 아직 채워진 subject 가 하나도 없어도 남는다.
        doc = mutate(
            TEMPLATE,
            lambda d: facet(d, "monthly-premium").__setitem__(
                "notes",
                [
                    {"kind": "quote", "text": "설계안 1쪽 합계보험료"},
                    {"kind": "tip", "text": "적립보험료가 섞이면 실제 보장 보험료는 더 적습니다."},
                    {"kind": "note", "text": "월납 기준입니다."},
                    {"kind": "caution", "text": "할인 전 금액일 수 있습니다."},
                ],
            ),
        )
        result = check_template(doc)
        self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_facet_has_no_description_field(self) -> None:
        # 설명은 주석이라는 규칙이 하나로 유지된다.
        facet_schema = documents()["weave-template.schema.json"]["$defs"]["Facet"]
        self.assertNotIn("description", facet_schema["properties"])
        self.assertIn("notes", facet_schema["properties"])


class ValuesPass(unittest.TestCase):
    def test_all_filled(self) -> None:
        result = check_valueset(FILLED, TEMPLATE)
        self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_all_empty(self) -> None:
        result = check_valueset(EMPTY, TEMPLATE)
        self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_mixed_including_empty_list_and_open_range(self) -> None:
        result = check_valueset(MIXED, TEMPLATE)
        self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_without_template_structure_only(self) -> None:
        self.assertTrue(check_valueset(FILLED).ok)

    def test_one_subject_and_many_subjects_are_the_same_check(self) -> None:
        # subject 가 하나든 여럿이든 값 한 벌의 판정은 한 벌씩 같다.
        for doc in (FILLED, EMPTY, MIXED):
            self.assertTrue(check_valueset(doc, TEMPLATE).ok)

    def test_not_analysed_is_an_all_empty_valueset_not_a_state(self) -> None:
        """아직 채우지 않았다는 것도 구조가 아니라 **전부 비어 있는 값 한 벌과 주석**이 말한다.

        상태를 새로 만드는 길은 막혀 있고(``TEMPLATE_DEFECTS``·``VALUE_DEFECTS`` 참조),
        전부 빈 값 한 벌은 그냥 통과한다 — 그것이 이 언어가 「아직 안 채웠다」를 말하는 방법이다.
        """
        self.assertTrue(check_valueset(EMPTY, TEMPLATE).ok)
        states = {
            entry["state"]
            for facet in EMPTY["facets"].values()
            for entry in facet["fields"].values()
        }
        self.assertEqual(states, {"empty"})


def mutate(base: dict, fn) -> dict:
    doc = copy.deepcopy(base)
    fn(doc)
    return doc


def set_score(doc: dict) -> None:
    facet(doc, "monthly-premium")["score"] = 90


def break_share(doc: dict) -> None:
    """parts 의 둘째 열을 글로 바꾼다 — 쪼갤 수 없는 것은 쪼갠 것이 아니다."""
    facet(doc, "premium-split")["fields"][0]["columns"][1]["type"] = "text"


TEMPLATE_DEFECTS = [
    ("parts 의 몫을 글로 연다", break_share, "둘째 열은 몫이라 수치형"),
    ("primitive element 에 순위를 더한다", lambda d: facet(d, "monthly-premium").__setitem__("element", "rank"), "is not one of"),
    ("primitive element 에 등급 게이지를 더한다", lambda d: facet(d, "monthly-premium").__setitem__("element", "gauge"), "is not one of"),
    ("facet 에 점수를 붙인다", set_score, "Additional properties"),
    ("facet 에 경고색을 붙인다", lambda d: facet(d, "monthly-premium").__setitem__("color", "red"), "Additional properties"),
    ("facet 에 자유 설정 주머니를 붙인다", lambda d: facet(d, "monthly-premium").__setitem__("settings", {"badge": "best"}), "Additional properties"),
    ("facet 에 가중치를 붙인다", lambda d: facet(d, "monthly-premium").__setitem__("weight", 3), "Additional properties"),
    ("타입에 등급을 더한다", lambda d: field(d, "monthly-premium", "premium").__setitem__("type", "grade"), "is not one of"),
    ("타입에 점수를 더한다", lambda d: field(d, "monthly-premium", "premium").__setitem__("type", "score"), "is not one of"),
    ("필드에 순위를 붙인다", lambda d: field(d, "monthly-premium", "premium").__setitem__("rank", 1), "Additional properties"),
    ("facet 에 설명 필드를 따로 만든다", lambda d: facet(d, "riders").__setitem__("description", "특약을 모아 보여 줍니다"), "Additional properties"),
    ("템플릿 주석에 확실성 수치를 붙인다", lambda d: facet(d, "contract-terms")["notes"][0].__setitem__("confidence", 0.8), "Additional properties"),
    ("템플릿 주석에 순위를 붙인다", lambda d: facet(d, "contract-terms")["notes"][0].__setitem__("rank", 1), "Additional properties"),
    ("템플릿 주석 갈래를 늘린다", lambda d: facet(d, "contract-terms")["notes"][0].__setitem__("kind", "grade"), "is not one of"),
    ("템플릿 주석 갈래에 점수를 더한다", lambda d: facet(d, "contract-terms")["notes"][0].__setitem__("kind", "score"), "is not one of"),
    ("템플릿 주석에 글이 없다", lambda d: facet(d, "contract-terms")["notes"][0].pop("text"), "'text' is a required property"),
    ("템플릿 주석을 아홉 개 단다", lambda d: facet(d, "contract-terms").__setitem__("notes", [{"kind": "note", "text": f"{i}"} for i in range(9)]), "is too long"),
    ("막대에 글을 싣는다", lambda d: field(d, "coverage-amounts", "death-benefit").__setitem__("type", "text"), "is not one of"),
    ("필드 설명을 뺀다", lambda d: field(d, "monthly-premium", "premium").pop("description"), "'description' is a required property"),
    ("필드 설명을 너무 짧게 둔다", lambda d: field(d, "monthly-premium", "premium").__setitem__("description", "짧다"), "is too short"),
    ("선에 축이 없다", lambda d: field(d, "premium-by-age", "premium-curve").pop("axis"), "'axis' is a required property"),
    ("글에 구간을 준다", lambda d: field(d, "contract-terms", "entry-age").update({"type": "text"}), "is not one of"),
    ("수치에 필드를 둘 싣는다", lambda d: facet(d, "monthly-premium")["fields"].append(copy.deepcopy(field(d, "contract-terms", "renewal"))), "is too long"),
    ("목록에 필드를 둘 싣는다", lambda d: facet(d, "riders")["fields"].append(copy.deepcopy(field(d, "contract-terms", "renewal"))), "is too long"),
    ("버전을 지어낸다", lambda d: d.__setitem__("weave", "2"), "'1'"),
    ("facet 이 하나도 없다", lambda d: d.__setitem__("facets", []), "should be non-empty"),
    ("템플릿 뿌리에 채점 설정을 붙인다", lambda d: d.__setitem__("scoring", {"weights": {}}), "Additional properties"),
    ("facet 을 조건부로 만든다", lambda d: facet(d, "riders").__setitem__("showIf", "premium > 0"), "Additional properties"),
    ("facet id 가 겹친다", lambda d: d["facets"].append(copy.deepcopy(facet(d, "riders"))), "facet id 가 겹친다"),
    ("필드 key 가 겹친다", lambda d: facet(d, "contract-terms")["fields"].append(copy.deepcopy(field(d, "contract-terms", "renewal"))), "필드 key 가 겹친다"),
    ("열 key 가 겹친다", lambda d: field(d, "riders", "rider-list")["columns"].append(copy.deepcopy(field(d, "riders", "rider-list")["columns"][0])), "열 key 가 겹친다"),
    ("글이 아닌 열에 닫힌 목록을 건다", lambda d: field(d, "riders", "rider-list")["columns"][1].__setitem__("allowed", ["가", "나"]), "was expected"),
]


class TemplateDefectsAreBlocked(unittest.TestCase):
    def test_defects(self) -> None:
        for why, fn, expected in TEMPLATE_DEFECTS:
            with self.subTest(why):
                result = check_template(mutate(TEMPLATE, fn))
                self.assertFalse(result.ok, f"막히지 않았다: {why}")
                joined = " | ".join(str(p) for p in result.problems)
                self.assertIn(expected, joined, f"{why}\n{joined}")


def fval(doc: dict, facet_id: str, key: str) -> dict:
    return doc["facets"][facet_id]["fields"][key]


VALUE_DEFECTS = [
    ("상태를 새로 만든다", lambda d: fval(d, "monthly-premium", "premium").__setitem__("state", "not-analyzed"), "is not one of"),
    ("empty 에 이유를 코드로 분류한다", lambda d: fval(d, "monthly-premium", "premium").update({"state": "empty", "reason": "not-in-document"}), "Additional properties"),
    ("filled 인데 값이 없다", lambda d: fval(d, "monthly-premium", "premium").pop("value"), "'value' is a required property"),
    ("empty 인데 값이 있다", lambda d: fval(d, "contract-terms", "start-date").update({"state": "empty", "value": "2026-10-01"}), "should not be valid"),
    ("주석에 확실성 수치를 붙인다", lambda d: fval(d, "monthly-premium", "premium")["notes"][0].__setitem__("confidence", 0.8), "Additional properties"),
    ("주석 갈래를 늘린다", lambda d: fval(d, "monthly-premium", "premium")["notes"][0].__setitem__("kind", "warning-level"), "is not one of"),
    ("facet 에 순위를 붙인다", lambda d: d["facets"]["monthly-premium"].__setitem__("rank", 1), "Additional properties"),
    ("facet 에 등급을 붙인다", lambda d: d["facets"]["monthly-premium"].__setitem__("grade", "A"), "Additional properties"),
    ("값 한 벌에 총점을 붙인다", lambda d: d.__setitem__("totalScore", 88), "Additional properties"),
    ("금액을 소수로 낸다", lambda d: fval(d, "monthly-premium", "premium").__setitem__("value", 87400.5), "money 타입이 아니다"),
    ("나이를 소수로 낸다", lambda d: fval(d, "contract-terms", "maturity-age").__setitem__("value", 100.5), "age 타입이 아니다"),
    ("참거짓 자리에 글을 낸다", lambda d: fval(d, "contract-terms", "renewal").__setitem__("value", "예"), "boolean 타입이 아니다"),
    ("날짜 형식이 다르다", lambda d: fval(d, "contract-terms", "start-date").__setitem__("value", "2026/10/01"), "date 타입이 아니다"),
    ("구간이 뒤집혔다", lambda d: fval(d, "contract-terms", "entry-age").__setitem__("value", {"min": 65, "max": 15}), "min 이 max 보다 크다"),
    ("구간이 비었다", lambda d: fval(d, "contract-terms", "entry-age").__setitem__("value", {}), "is not valid under any of the given schemas"),
    ("series 의 at 이 뒤섞였다", lambda d: fval(d, "premium-by-age", "premium-curve")["value"].reverse(), "오름차순"),
    ("series 의 축 타입이 다르다", lambda d: fval(d, "premium-by-age", "premium-curve")["value"][0].__setitem__("at", "마흔"), "age 타입이 아니다"),
    ("목록에 선언 없는 열을 넣는다", lambda d: fval(d, "riders", "rider-list")["value"][0].__setitem__("grade", "A"), "템플릿에 없는 열이다"),
    ("목록 칸의 타입이 다르다", lambda d: fval(d, "riders", "rider-list")["value"][0].__setitem__("amount", "3천만"), "money 타입이 아니다"),
    ("필드가 빠졌다", lambda d: d["facets"]["contract-terms"]["fields"].pop("renewal"), "빠졌다"),
    ("템플릿에 없는 필드를 낸다", lambda d: d["facets"]["contract-terms"]["fields"].__setitem__("rating", {"state": "filled", "value": 5}), "템플릿에 없는 필드"),
    ("facet 이 빠졌다", lambda d: d["facets"].pop("riders"), "빠졌다"),
    ("템플릿에 없는 facet 을 낸다", lambda d: d["facets"].__setitem__("ranking", {"fields": {}}), "템플릿에 없는 facet"),
    ("템플릿 id 가 다르다", lambda d: d.__setitem__("templateId", "other-template"), "템플릿 id 가 다르다"),
]


class ValueDefectsAreBlocked(unittest.TestCase):
    def test_defects(self) -> None:
        for why, fn, expected in VALUE_DEFECTS:
            with self.subTest(why):
                result = check_valueset(mutate(FILLED, fn), TEMPLATE)
                self.assertFalse(result.ok, f"막히지 않았다: {why}")
                joined = " | ".join(str(p) for p in result.problems)
                self.assertIn(expected, joined, f"{why}\n{joined}")


class SchemaFilesAreSound(unittest.TestCase):
    def test_every_schema_file_is_a_valid_json_schema(self) -> None:
        from jsonschema import Draft202012Validator

        for schema_id, doc in documents().items():
            with self.subTest(schema_id):
                Draft202012Validator.check_schema(doc)

    def test_every_object_is_closed(self) -> None:
        """빈틈이 하나라도 있으면 거기로 순위와 등급이 들어온다."""
        open_nodes: list[str] = []

        def walk(node: object, where: str) -> None:
            if isinstance(node, dict):
                if node.get("type") == "object" and "additionalProperties" not in node:
                    open_nodes.append(where)
                for key, child in node.items():
                    walk(child, f"{where}/{key}")
            elif isinstance(node, list):
                for index, child in enumerate(node):
                    walk(child, f"{where}/{index}")

        for schema_id, doc in documents().items():
            walk(doc, schema_id)
        self.assertEqual(open_nodes, [], f"닫히지 않은 객체: {open_nodes}")


class RenderArgs(unittest.TestCase):
    def test_focus_by_subject_id(self) -> None:
        args = validator(RENDER_ARGS)
        self.assertTrue(args.is_valid({}))
        self.assertTrue(args.is_valid({"focus": "proposal-a"}))
        self.assertTrue(args.is_valid({"focus": None}))
        self.assertTrue(args.is_valid({"focus": "proposal-zzz"}), "없는 id 는 스키마가 막지 않는다")

    def test_no_index_and_no_ranking(self) -> None:
        args = validator(RENDER_ARGS)
        self.assertFalse(args.is_valid({"focus": 0}))
        self.assertFalse(args.is_valid({"sortBy": "score"}))

    def test_the_roster_is_not_a_render_arg(self) -> None:
        """subject 마다 값 한 벌이 정확히 하나 있으므로 값 한 벌들이 곧 명단이다.

        명단을 인자로 받으면 「값 한 벌이 없는 subject」라는 예외가 생기고, 그러면 왜 없는지를
        언어가 분류하지 않는다는 규칙이 깨진다.
        """
        self.assertTrue(check_render_args({}).ok)
        self.assertTrue(check_render_args({"focus": "a"}).ok)
        result = check_render_args({"subjects": [{"id": "a"}]})
        self.assertFalse(result.ok, "명단은 렌더 인자가 아니다")
        self.assertIn("Additional properties", " | ".join(str(p) for p in result.problems))

    def test_the_schema_declares_only_what_values_cannot_say(self) -> None:
        """렌더 인자는 **값에서 유도할 수 없는 것**만 담는다.

        ``focus`` 와 ``previousFocus`` 는 앱의 상호작용 이력이라 값 한 벌에도 템플릿에도
        없다. 명단처럼 값이 이미 갖고 있는 것은 여기 서지 않는다.
        """
        args = documents()["weave-render-args.schema.json"]
        self.assertEqual(list(args["properties"]), ["focus", "previousFocus", "choices"])
        self.assertNotIn("$defs", args, "자리(Seat) 정의가 남아 있다")
        # subject 를 가리키는 둘은 같은 규칙이다 — id 이거나 null.
        for name in ("focus", "previousFocus"):
            self.assertEqual(
                [list(one)[0] for one in args["properties"][name]["anyOf"]],
                ["$ref", "type"],
                f"{name} 이 focus 와 다른 규칙을 쓴다",
            )
        # 고르는 자리는 **여럿일 수 있어** 지도로 온다. 값 하나하나는 같은 규칙이다.
        picked = args["properties"]["choices"]
        self.assertEqual(picked["type"], "object")
        self.assertEqual([list(one)[0] for one in picked["additionalProperties"]["anyOf"]], ["$ref", "type"])

    def test_a_choice_binds_template_and_values(self) -> None:
        """고르는 자리가 들어오면 **값 쪽도 바뀐다.** 인자만 늘리고 끝나지 않는다.

        타는 필드는 고를 것마다 값을 갖고, 그 목록은 템플릿이 선언한 것과 **빠짐도 덤도
        없이** 같아야 한다 — 선언한 만큼 채워야 하는 값이 여기서 드러난다.
        어느 모양이어야 하는지는 템플릿이 정하므로 검사기가 가른다.
        """
        template = {
            "weave": "1", "id": "t", "title": "t",
            "choices": [{"id": "d", "label": "무엇을 고르나",
                         "options": [{"id": "a", "label": "가"}, {"id": "b", "label": "나"}]}],
            "facets": [{
                "id": "f", "title": "f", "element": "facts",
                "fields": [
                    {"key": "moves", "label": "탄다", "shape": "single", "type": "money",
                     "choice": "d", "description": "고른 것마다 다른 금액을 원 단위로."},
                    {"key": "stays", "label": "안 탄다", "shape": "single", "type": "money",
                     "description": "고른 것과 무관한 금액을 원 단위로."},
                ],
            }],
        }
        self.assertTrue(check_template(template).ok, [str(p) for p in check_template(template).problems])

        def values(moves, stays):
            return {"weave": "1", "templateId": "t", "subjectId": "s",
                    "facets": {"f": {"fields": {"moves": moves, "stays": stays}}}}

        full = {"byOption": {"a": {"state": "filled", "value": 1}, "b": {"state": "empty"}}}
        one = {"state": "filled", "value": 2}
        self.assertTrue(check_valueset(values(full, one), template).ok)

        for why, moves, stays, expected in [
            ("타는 필드에 값 하나만 준다", one, one, "값이 하나다"),
            ("안 타는 필드를 쪼갠다", full, full, "타지 않는 필드인데"),
            ("고를 것을 빠뜨린다", {"byOption": {"a": {"state": "empty"}}}, one, "선언한 고를 것 이 빠졌다"),
            ("없는 것을 덤으로 준다",
             {"byOption": {"a": {"state": "empty"}, "b": {"state": "empty"}, "c": {"state": "empty"}}},
             one, "템플릿에 없는 고를 것"),
            ("고른 값의 타입이 어긋난다",
             {"byOption": {"a": {"state": "filled", "value": "많이"}, "b": {"state": "empty"}}},
             one, "money 타입이 아니다"),
        ]:
            with self.subTest(why):
                result = check_valueset(values(moves, stays), template)
                self.assertFalse(result.ok, f"막히지 않았다: {why}")
                self.assertIn(expected, " | ".join(str(p) for p in result.problems))

        # 선언하지 않은 자리를 타면 가리킬 것이 없다.
        astray = {k: v for k, v in template.items() if k != "choices"}
        result = check_template(astray)
        self.assertFalse(result.ok)
        self.assertIn("선언하지 않은 고르는 자리", " | ".join(str(p) for p in result.problems))

        # **한 자리 안의 것끼리는 닫힌 목록이다.** 자유 글에서 오타를 막는 자리도 같다.
        closed = {
            "weave": "1", "id": "t", "title": "t",
            "facets": [{"id": "f", "title": "f", "element": "facts", "fields": [
                {"key": "src", "label": "출처", "shape": "single", "type": "text",
                 "allowed": ["설계사 제안", "직접 업로드"], "description": "어디서 왔는지 그대로."}]}],
        }
        self.assertTrue(check_template(closed).ok)
        good = {"weave": "1", "templateId": "t", "subjectId": "s",
                "facets": {"f": {"fields": {"src": {"state": "filled", "value": "설계사 제안"}}}}}
        self.assertTrue(check_valueset(good, closed).ok)
        bad = {"weave": "1", "templateId": "t", "subjectId": "s",
               "facets": {"f": {"fields": {"src": {"state": "filled", "value": "설계사제안"}}}}}
        self.assertIn("허용한 값이 아니다", " | ".join(str(p) for p in check_valueset(bad, closed).problems))

    def test_what_can_be_chosen_is_the_skeleton_not_an_arg(self) -> None:
        """**고른 것은 인자, 고를 수 있는 것은 골격이다.**

        고를 것의 목록은 템플릿이 갖는다 — subject 마다 고를 것이 다르면 견줄 수가 없어서,
        facet 을 템플릿이 갖는 것과 같은 까닭이다. 인자에는 **무엇을 골랐는지**만 온다.
        모양(칩·드롭다운)은 어느 쪽에도 없다 — 앱의 것이다.
        """
        args = documents()["weave-render-args.schema.json"]
        template = documents()["weave-template.schema.json"]
        self.assertIn("choices", template["properties"], "고를 것의 목록이 템플릿에 없다")
        self.assertIn("options", template["$defs"]["Choice"]["properties"])
        self.assertTrue(check_render_args({"choices": {"illness": "cancer"}}).ok)
        self.assertTrue(check_render_args({"choices": {"illness": None}}).ok)
        self.assertTrue(check_render_args({"choices": {}}).ok)
        self.assertFalse(check_render_args({"choices": {"illness": ["cancer"]}}).ok)
        self.assertFalse(check_render_args({"choices": [{"id": "illness"}]}).ok)
        # **언어는 모양을 선언하지 않는다.** 산문이 아니라 **이름과 어휘**를 본다 —
        # 「드롭다운인지는 앱이 정한다」고 적는 것은 괜찮고, 그런 이름의 자리를 두는 것이 안 된다.
        names = set()

        def walk(node: object) -> None:
            if isinstance(node, dict):
                names.update(node.get("properties", {}))
                names.update(str(one) for one in node.get("enum", []))
                for value in node.values():
                    walk(value)
            elif isinstance(node, list):
                for one in node:
                    walk(one)

        walk(args)
        walk(template)
        for ui in ("widget", "dropdown", "chip", "segment", "tab", "toggle", "layout", "style"):
            self.assertNotIn(ui, {n.lower() for n in names}, f"모양을 선언한다: {ui}")

    def test_previous_focus_is_a_render_arg(self) -> None:
        """직전 focus 는 **값에서 유도할 수 없다.** 앱만 아는 상호작용 이력이다."""
        self.assertTrue(check_render_args({"focus": "a", "previousFocus": "b"}).ok)
        self.assertTrue(check_render_args({"previousFocus": None}).ok)
        # 직전이 현재와 같은 것은 결함이 아니다. 렌더가 직전이 없는 것으로 정리한다.
        self.assertTrue(check_render_args({"focus": "a", "previousFocus": "a"}).ok)
        self.assertFalse(check_render_args({"previousFocus": 3}).ok)


class ColumnVocabulary(unittest.TestCase):
    """**열도 닫힌 목록을 건다.** 필드의 ``allowed`` 와 같은 규율이고 자리만 한 겹 깊다.

    자유 글의 변종이 가장 많이 되풀이되는 자리가 항목의 열이다 — 항목이 수백 줄이면
    같은 뜻의 말이 몇 가지로 갈린다. **칸만 열고 안 재면 선언이 장식이 되므로**
    검사기가 그것을 문다.
    """

    TEMPLATE = {
        "weave": "1", "id": "t", "title": "t",
        "facets": [{
            "id": "f", "title": "f", "element": "rows", "compare": "focus",
            "fields": [{
                "key": "list", "label": "목록", "shape": "items",
                "description": "항목을 하나씩 담는다. 열 선언을 따른다.",
                "columns": [
                    {"key": "name", "label": "이름", "type": "text",
                     "description": "적힌 이름 그대로 담는다."},
                    {"key": "mode", "label": "방식", "type": "text",
                     "allowed": ["갱신 없음", "10년 갱신"],
                     "description": "그 항목의 방식을 적힌 말 그대로 담는다."},
                ],
            }],
        }],
    }

    def values(self, mode: object) -> dict:
        return {"weave": "1", "templateId": "t", "subjectId": "s",
                "facets": {"f": {"fields": {"list": {"state": "filled",
                                                     "value": [{"name": "가", "mode": mode}]}}}}}

    def test_the_template_may_close_a_text_column(self) -> None:
        result = check_template(self.TEMPLATE)
        self.assertTrue(result.ok, [str(p) for p in result.problems])

    def test_a_value_inside_the_list_passes(self) -> None:
        self.assertTrue(check_valueset(self.values("10년 갱신"), self.TEMPLATE).ok)

    def test_a_variant_is_blocked(self) -> None:
        """오타와 변종을 막는 자리다 — 「10년갱신」은 같은 뜻이지만 다른 값이다."""
        result = check_valueset(self.values("10년갱신"), self.TEMPLATE)
        self.assertFalse(result.ok, "닫힌 목록 밖의 값이 통과했다")
        joined = " | ".join(str(p) for p in result.problems)
        self.assertIn("허용한 값이 아니다", joined)
        self.assertIn("'mode'", joined, "어느 칸인지 말하지 않는다")

    def test_a_column_without_a_list_stays_free(self) -> None:
        """**대조군.** 목록을 걸지 않은 열은 그대로 자유 글이다."""
        self.assertTrue(check_valueset(self.values("아무 말"), self.TEMPLATE).ok is False)
        free = copy.deepcopy(self.TEMPLATE)
        free["facets"][0]["fields"][0]["columns"][1].pop("allowed")
        self.assertTrue(check_valueset(self.values("아무 말"), free).ok)

    def test_the_door_for_grades_is_open_and_said_so(self) -> None:
        """**막지 못한다.** ``allowed`` 는 ``description`` 에 등급을 적는 것의 더 날카로운 판이다.

        자연어가 아니라 **닫힌 목록**이라 소비자가 그대로 갈래로 쓴다. 그런데 막으려면
        스키마가 도메인 어휘를 알아야 하고, 그러면 「보험이 들어오면 안 된다」가 깨진다.
        그래서 **막지 못하고 적어 둔다** — 적어 둔 것이 사라지면 여기가 빨개진다.
        """
        graded = copy.deepcopy(self.TEMPLATE)
        graded["facets"][0]["fields"][0]["columns"][1]["allowed"] = ["A등급", "B등급", "C등급"]
        self.assertTrue(check_template(graded).ok, "막을 수 있게 되었으면 설명서를 고친다")
        said = (pathlib.Path(__file__).resolve().parents[1] / "docs" / "weave.md").read_text(encoding="utf-8")
        head = said.split("## 스키마가 못 지키는 것", 1)[1].split("\n## ", 1)[0]
        self.assertIn("allowed", head, "못 막는다는 사실이 설명서에 없다")
        # 저장소를 고치는 쪽이 읽는 자리에도 서 있어야 한다 — 거기서 조용히 사라지면
        # 다음 사람이 이 구멍을 모른 채 「검사기가 본다」고 믿는다.
        agents = (pathlib.Path(__file__).resolve().parents[1] / "AGENTS.md").read_text(encoding="utf-8")
        blind = agents.split("## 검사기가 못 보는 것", 1)[1].split("\n## ", 1)[0]
        self.assertIn("allowed", blind, "못 막는다는 사실이 AGENTS.md 에 없다")


if __name__ == "__main__":
    unittest.main()
