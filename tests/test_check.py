"""고정 케이스. 정상 사례가 통과하고 결함 사례가 막히는 것을 함께 본다."""

from __future__ import annotations

import copy
import json
import pathlib
import unittest

from weave import check_template, check_valueset
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
        used = {f["element"] for f in TEMPLATE["facets"]}
        self.assertEqual(used, {"stat", "facts", "bars", "line", "list"})

    def test_template_author_notes_use_the_same_four_kinds(self) -> None:
        # subject 무관 지식의 자리. 아직 분석된 subject 가 하나도 없어도 남는다.
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

    def test_unanalyzed_subject_is_not_a_field_state(self) -> None:
        # 아직 분석되지 않은 subject 는 값 한 벌 자체가 없다. 검사기가 할 말이 없는 자리다.
        analysed = [FILLED, MIXED]
        self.assertTrue(all(check_valueset(d, TEMPLATE).ok for d in analysed))
        self.assertNotIn("proposal-z", {d["subjectId"] for d in analysed})


def mutate(base: dict, fn) -> dict:
    doc = copy.deepcopy(base)
    fn(doc)
    return doc


def set_score(doc: dict) -> None:
    facet(doc, "monthly-premium")["score"] = 90


TEMPLATE_DEFECTS = [
    ("원시 요소에 순위를 더한다", lambda d: facet(d, "monthly-premium").__setitem__("element", "rank"), "is not one of"),
    ("원시 요소에 등급 게이지를 더한다", lambda d: facet(d, "monthly-premium").__setitem__("element", "gauge"), "is not one of"),
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
    ("추출 지시를 뺀다", lambda d: field(d, "monthly-premium", "premium").pop("description"), "'description' is a required property"),
    ("추출 지시를 빈 글로 둔다", lambda d: field(d, "monthly-premium", "premium").__setitem__("description", "짧다"), "is too short"),
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


if __name__ == "__main__":
    unittest.main()
