# weave 설명서

분석 템플릿을 쓰는 쪽과 값을 채우는 쪽이 읽는다. **별도 카탈로그는 없고 이 문서가 카탈로그다.**
형상의 정본은 [`../schema/`](../schema) 의 JSON Schema 이고 이 문서는 그것을 사람이 읽는 형태다.

## 한 눈에

분석 템플릿 하나에 subject 마다 값 한 벌이 주입되어 분석뷰가 된다. 렌더는 여러 벌을 **한 화면에 함께** 그리므로 모든 facet 이 본래 비교형이다.

템플릿은 facet 의 배열이고, facet 하나는 **원시 요소 하나와 그것이 요구하는 필드들**이다.
필드 선언의 `description` 이 곧 분석에게 주는 추출 지시다. 무엇을 그릴지와 무엇을 찾을지를 한 문서가 함께 말한다.

## 타입 여덟

값은 **기본 단위로 정규화**해서 담는다. 표시 단위는 렌더가 정한다.

| type | 담는 것 | 기본 단위 | JSON |
| --- | --- | --- | --- |
| `number` | 숫자 | 없음 | 수 |
| `money` | 금액 | 원 | 정수 (5,000만원 → `50000000`) |
| `ratio` | 비율 | 분수 | 수 (50% → `0.5`) |
| `duration` | 기간 | 개월 | 정수 (20년 → `240`) |
| `age` | 나이 | 세 | 정수 |
| `boolean` | 참거짓 | — | `true` / `false` |
| `text` | 글 | — | 문자열 (긴 설명은 값이 아니라 주석에) |
| `date` | 날짜 | — | `"YYYY-MM-DD"` |

## 모양 넷

| shape | 값의 생김새 | 함께 선언할 것 | 쓸 수 있는 type |
| --- | --- | --- | --- |
| `single` | 홑값 | `type` | 여덟 전부 |
| `range` | `{"min": …, "max": …}` — 한쪽만 알아도 된다 | `type` | 순서 있는 것 (`boolean`·`text` 제외) |
| `series` | `[{"at": 축값, "value": 값}, …]` — `at` 오름차순 | `type`, `axis` | `type` 은 수치형, `axis` 는 `age`·`date`·`duration`·`number` |
| `items` | `[{열key: 값}, …]` — 없는 열은 빈 칸 | `columns` | 열마다 `type` |

## 원시 요소 다섯

**렌더가 구현하는 것은 이 다섯이다. facet 종류는 없다** — facet 은 이 다섯 중 하나에 필드를 채운 것이다.

| element | 그리는 것 | 필드 수 | shape | 비고 |
| --- | --- | --- | --- | --- |
| `stat` | 값 하나를 크게, subject 수만큼 나란히 | 1 | `single`·`range` | |
| `facts` | 라벨과 값 여럿 | 1–12 | `single`·`range` | subject 가 여럿이면 행이 항목, 열이 subject 인 표가 된다. **표는 따로 없다** |
| `bars` | 크기 비교 | 1–6 | `single` | 수치형 타입만 |
| `line` | 축 위의 변화 | 1 | `series` | |
| `list` | 반복되는 항목 | 1 | `items` | |

제목과 설명 글은 원시 요소가 아니다. 제목은 facet 의 `title` 이고 설명은 주석이다.

## 템플릿

```json
{
  "weave": "1",
  "id": "tpl-0001",
  "title": "내 분석뷰",
  "facets": [
    {
      "id": "monthly-premium",
      "title": "월 보험료",
      "element": "stat",
      "fields": [
        {
          "key": "premium",
          "label": "월 보험료",
          "shape": "single",
          "type": "money",
          "description": "이 설계안의 월 납입 보험료 총액을 원 단위 정수로. 적립보험료가 섞여 있으면 분리하고 보장 보험료만."
        }
      ],
      "notes": [
        { "kind": "note", "text": "적립보험료를 뺀 보장 보험료입니다." },
        { "kind": "tip", "text": "같은 보장이라도 납입기간이 길면 월 보험료는 내려갑니다." }
      ]
    }
  ]
}
```

`facets` 의 순서가 그리는 순서다. **배치일 뿐 우열이 아니다.**

facet 의 `notes` 는 **템플릿 저작자가 다는 주석**이다. subject 와 무관한 지식 — 갱신과 비갱신의 차이 같은 것 — 은
값 한 벌이 아니라 여기 둔다. 값에 두면 subject 마다 같은 문장이 복제되고, **아직 분석된 subject 가 하나도 없을 때
그 지식이 통째로 사라진다.**

**facet 에 `description` 필드는 없다.** facet 의 설명 글도 `notes` 에 `note` 로 적는다. 설명은 주석이라는 규칙이 하나다.

## 값 한 벌

subject 하나에 한 벌. 템플릿의 facet 과 필드를 **빠짐도 덤도 없이** 덮는다.

```json
{
  "weave": "1",
  "templateId": "tpl-0001",
  "subjectId": "proposal-a",
  "subjectLabel": "가 제안서",
  "facets": {
    "monthly-premium": {
      "fields": {
        "premium": {
          "state": "filled",
          "value": 87400,
          "notes": [{ "kind": "quote", "text": "합계보험료 87,400원" }]
        }
      },
      "notes": [{ "kind": "note", "text": "설계안 2쪽에서 읽었습니다." }]
    }
  }
}
```

상태는 **`filled` 와 `empty` 둘뿐**이다. `filled` 면 `value` 가 있고 `empty` 면 없다.
**왜 비었는지는 분류하지 않는다.** 「제안서에 없다」와 「약관이 아직 없다」는 둘 다 `empty` 이고, 까닭은 주석에 글로 적는다.

**아직 분석되지 않은 subject 는 값 한 벌 자체를 내지 않는다.** 필드 상태로 두지 않는다.

## 주석 넷

| kind | 무엇 |
| --- | --- |
| `quote` | 이 값의 근거. 원문 그대로 |
| `tip` | 알아두면 좋은 것. 깨알 지식의 자리 |
| `note` | 더 붙이는 설명 |
| `caution` | 한계와 조심할 것. 불확실하면 여기에 글로 적는다 |

**갈래 넷은 세 자리에서 같다.** 자리가 누가 쓴 주석인지를 말한다.

| 어디 | 누가 | 무엇에 대해 |
| --- | --- | --- |
| 템플릿 facet 의 `notes` | 템플릿 저작자 | subject 와 무관한 것. 이 facet 이 무엇인지, 이 축을 볼 때 알아둘 것 |
| 값 한 벌 facet 의 `notes` | 분석 | 이 subject 의 이 facet 전체에 대한 것 |
| 값 한 벌 필드의 `notes` | 분석 | 이 subject 의 이 값 하나에 대한 것 |

확실성 수치는 어느 자리에도 없다. 불확실하면 `caution` 에 글로 적는다.

## 렌더 인자

`focus` 하나다. **index 가 아니라 subject 의 id** 로 가리킨다. `null` 이 release 이고, 없는 id 면 focus 만 사라진다.

## 렌더가 하기로 돼 있는 것

참조 뷰어가 기준이다. 앱은 자기 시각을 입히되 아래는 지킨다.

- **값이 없는 facet 도 자리를 남기고 없다고 말한다.** 숨기면 subject 마다 골격이 달라져 견줄 수 없다.
- **값 한 벌이 없는 subject 는 「아직 분석 중」으로 보인다.** 필드가 비어 있는 「값 없음」과 눈으로 구별된다.
- **주석 넷은 붙은 자리에 그대로 보인다.** 템플릿 facet 의 것, 값 한 벌 facet 의 것, 값의 것.
- **순위·등급을 렌더가 되살리지 않는다.** 스키마에서 뺀 것을 색이나 배치로 다시 만들지 않는다.

subject 명단은 스키마가 아니라 **부르는 쪽의 인자**다. 값 한 벌이 없는 subject 도 세우려면 명단을 넘긴다.

## 만져 보기

저장소 뿌리의 [`viewer.html`](../viewer.html) 을 **브라우저로 연다.** 서버도 설치도 없다.
왼쪽에서 템플릿과 값을 고치면 오른쪽 분석뷰가 그 자리에서 바뀐다. focus 도 눌러 보고 없는 id 도 쳐 볼 수 있다.
[`samples/`](../samples) 의 샘플 넷을 골라 바로 띄운다.

**뷰어는 판정하지 않는다.** JSON 으로 읽히는지만 본다. 맞는지는 검사기가 말한다.

```sh
python -m weave template samples/proposal-compare/template.json
python -m weave values --template samples/proposal-compare/template.json samples/proposal-compare/values-*.json
```

## 일부러 없는 것

순위 · 등급 · 점수 · 경고색 · 확실성 수치 · 조건부 facet · 중간 트리 산출물 · 자유 설정 주머니.
객관성을 문서가 아니라 스키마로 강제하는 자리다. **문법에 없으므로 나올 수 없다.**

## 스키마가 못 지키는 것

- **한 facet 은 비교 축 하나여야 한다.** 의미의 문제라 템플릿을 쓰는 쪽이 지킨다.
- **`description` 에 「등급을 A~E 로 매겨라」라고 적는 것.** 자연어는 검사하지 않는다.
- **잘못 정규화한 값.** `ratio` 에 `50`(= 5000%) 을 넣어도 수치로는 옳다. 정수 여부와 날짜 형식만 본다.
