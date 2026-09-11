# weave — 저장소 진입점

분석뷰를 선언하는 스키마와 그것을 그리는 참조 구현. 런타임 서비스가 아니라 **공유 계약**이다.
아무도 weave 를 호출하지 않고 소비자 둘이 그것을 읽는다 — eightytwo-judge(Python, 템플릿을 쓰고 값을 채운다)와 claim-mobile(TS, 그린다).

스키마를 쓰거나 값을 채우는 쪽은 [`docs/weave.md`](docs/weave.md) 하나만 읽으면 된다. 이 문서는 저장소를 고치는 쪽이 읽는다.

## 어기면 저장소를 만든 이유가 사라지는 것 넷

1. **보험이 들어오면 안 된다.** 스키마는 값의 타입과 그리는 법만 안다. 무엇을 찾을지는 필드 선언의 `description` 이 자연어로 말한다. 도메인 어휘가 타입이나 원시 요소 이름으로 새어 들면 다른 상품군에서 다시 못 쓴다.
2. **순위·등급·점수·경고색을 표현할 문법을 두지 않는다.** 객관성을 문서가 아니라 스키마로 강제하는 자리다. 모든 객체가 `additionalProperties: false` 이고 어휘가 전부 닫힌 `enum` 인 이유가 이것이다.
3. **렌더가 구현하는 것은 원시 요소다.** facet 종류를 스키마가 열거하지 않는다. facet 은 원시 요소 하나에 필드를 채운 것이다. 원시 요소는 다섯이고 **늘리는 것이 기본값이 아니다**.
4. **뷰어가 시각을 소유하지 않는다.** 구조가 보이는 최소한만 입힌다. 앱의 시각은 claim-design-system 것이다. (참조 뷰어는 아직 없다.)

## 레이아웃

| 자리 | 무엇 |
| --- | --- |
| `schema/*.json` | **정본.** JSON Schema 2020-12. 어휘·모양·제약이 전부 여기 있다 |
| `docs/weave.md` | 설명서 겸 카탈로그. 템플릿을 쓰는 Procedure 의 프롬프트에 실린다 |
| `weave/` | 검사기 (Python) |
| `tools/emit_types.py` | 닫힌 어휘를 소비자 언어로 내보낸다 |
| `generated/` | 그 산출물. 손으로 고치지 않는다 |
| `tests/` | 고정 케이스. `fixtures/ok/` 가 정상 사례, 결함 사례는 `test_check.py` 안의 변형 표 |

`schema/` 넷 — `weave-common`(어휘) · `weave-template`(분석 템플릿) · `weave-valueset`(값 한 벌) · `weave-render-args`(focus).
파일 사이 참조는 상대 `$ref` 라 그대로 복사해 가도 풀린다.

## 시작

```sh
make setup   # .venv 를 만들고 jsonschema 를 넣는다 (유일한 런타임 의존)
make all     # test + types-check + check
```

검사기는 라이브러리로도 CLI 로도 쓴다.

```python
from weave import check_template, check_valueset
result = check_valueset(values, template)   # result.ok / result.problems
```

```sh
python -m weave template tpl.json
python -m weave values --template tpl.json values-a.json values-b.json
```

exit 0 통과 · 1 결함 · 2 읽지 못함.

## 검사 동사와 변경별 관련 검증

| 동사 | 하는 일 |
| --- | --- |
| `make test` | 고정 케이스. 정상 사례가 통과하고 결함 사례가 막히는 것을 함께 본다 |
| `make check` | 검사기를 `tests/fixtures/ok/` 에 직접 돌린다. CLI 가 사는지 본다 |
| `make types-check` | `generated/` 가 스키마와 갈렸는지 본다 |
| `make types` | 갈렸으면 다시 쓴다 |
| `make all` | 위 셋 |

| 무엇을 고쳤나 | 돌릴 것 |
| --- | --- |
| `schema/` | `make all` — 어휘가 바뀌면 `generated/` 도 같이 커밋한다 |
| `weave/` (검사기) | `make test check` |
| `tests/fixtures/` | `make test check` |
| `tools/emit_types.py` · `generated/` | `make types-check` |
| `docs/` · `AGENTS.md` 만 | 없음 |

## 검사기가 못 보는 것

사실대로 적어 둔다. 이 자리를 믿고 넘기면 안 된다.

- **한 facet 이 비교 축 하나인지.** 의미의 문제라 템플릿을 쓰는 Procedure 가 지킨다. 볼 만한지는 참조 뷰어로 사람이 본다.
- **`description` 안의 자연어.** 「종합 등급을 A~E 로 매겨라」라고 적어도 검사기는 통과시킨다. 어휘 검열은 하지 않는다.
- **잘못 정규화한 값.** `ratio` 에 `50`(= 5000%) 을 넣어도 수치로는 옳다. 정수 여부(`money`·`age`·`duration`)와 날짜 형식만 본다.
- **`text` 로 우회하는 등급.** `text` 값에 "A등급" 을 담는 것은 막을 수 없다.
- **값 한 벌이 없는 subject.** 아직 분석되지 않은 것이므로 검사기가 할 말이 없다. 몇 벌이 와야 하는지는 부르는 쪽이 안다.
- **`generated/weave-vocab.ts` 가 실제로 컴파일되는지.** 이 저장소에 TS 툴체인이 없다. 소비자 쪽 빌드가 처음 확인한다.

## 타입을 내보내는 길

정본은 `schema/` 하나이고 소비자 둘은 여기서 파생한다. 두 갈래다.

**1. 닫힌 어휘 — 이 저장소가 낸다.** `tools/emit_types.py` 가 `weave-common.schema.json` 에서 `generated/weave_vocab.py` 와 `generated/weave-vocab.ts` 를 쓴다. 렌더가 분기하는 지점이자 갈리면 바로 화면이 깨지는 지점이라 `make types-check` 로 붙잡는다. 의존성 없이 stdlib 로 돈다.

**2. 모델 전체 — 소비자가 자기 빌드에서 뽑는다.** 이 저장소는 생성기를 들이지 않는다.

```sh
# eightytwo-judge (Python)
uvx datamodel-code-generator --input schema --input-file-type jsonschema \
    --output-model-type pydantic_v2.BaseModel --output weave_models/

# claim-mobile (TS)
npx json-schema-to-typescript@15 schema/weave-template.schema.json -o weave-template.d.ts
npx json-schema-to-typescript@15 schema/weave-valueset.schema.json -o weave-valueset.d.ts
```

⚠️ **아직 돌려 보지 않았다.** 두 생성기 모두 `if`/`then`/`not` 조건절을 온전히 옮기지 못할 수 있고, 그러면 원시 요소별 필드 제약이 생성 타입에서 느슨해진다. **그 제약의 판정은 어차피 검사기가 갖는다** — 생성 타입은 모양을 잡는 용도이고 판정이 아니다. 소비자가 처음 돌릴 때 확인한다.

⚠️ **LLM 구조화 출력.** judge 가 `weave-template.schema.json` 을 그대로 구조화 출력 스키마로 넘기려면, 파일 간 `$ref` 와 조건절을 지원하는지 그쪽 API 가 정한다. 지원하지 않으면 한 파일로 펼친 변형이 필요하다. 그 변형을 이 저장소가 낼지는 정하지 않았다.

⚠️ **배포 방법은 미정이다.** 패키지로 낼지, 서브모듈로 둘지, `schema/` 를 복사해 갈지 PM 이 정한다.

## 어휘를 늘릴 때

원시 요소·타입·모양·주석 갈래는 **닫힌 목록이고 좁히는 쪽이 기본**이다. 늘리기는 쉽고 줄이기는 어렵다.

늘리려면 넷을 함께 댄다.

1. 지금 다섯(여덟·넷)의 조합으로 안 되는 구체적 사례
2. 그것이 도메인 없이 설명되는가 — 「병명 목록」은 새 원시 요소가 아니라 `list` 다
3. 순위·등급으로 쓰일 길이 없는가
4. `docs/weave.md` 가 얼마나 커지는가 — **설명서 크기가 곧 Procedure 프롬프트 무게다**

어휘를 바꾸면 `generated/` 를 같이 커밋하고, 소비자 둘(eightytwo-judge · claim-mobile)이 있으므로 PM 에 알린다.

## 권한 밖

제품 의도 변경, 소비자 repo 수정, 배포. PM 에 올린다.
소비자와 라이브로 협상하지 않는다 — 계약 형상은 이 저장소가 먼저 발행하고 소비자가 그 버전을 적용한다.
