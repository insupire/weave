# weave — 저장소 진입점

분석뷰를 선언하는 스키마와 그것을 그리는 참조 구현. 런타임 서비스가 아니라 **공유 계약**이다.
아무도 weave 를 호출하지 않고 소비자 둘이 그것을 읽는다 — eightytwo-judge(Python, 템플릿을 쓰고 값을 채운다)와 claim-mobile(TS, 그린다).

스키마를 쓰거나 값을 채우는 쪽은 [`docs/weave.md`](docs/weave.md) 하나만 읽으면 된다. 이 문서는 저장소를 고치는 쪽이 읽는다.

## 어기면 저장소를 만든 이유가 사라지는 것 넷

1. **보험이 들어오면 안 된다.** 스키마는 값의 타입과 그리는 법만 안다. 무엇을 찾을지는 필드 선언의 `description` 이 자연어로 말한다. 도메인 어휘가 타입이나 원시 요소 이름으로 새어 들면 다른 상품군에서 다시 못 쓴다.
2. **순위·등급·점수·경고색을 표현할 문법을 두지 않는다.** 객관성을 문서가 아니라 스키마로 강제하는 자리다. 모든 객체가 `additionalProperties: false` 이고 어휘가 전부 닫힌 `enum` 인 이유가 이것이다.
3. **렌더가 구현하는 것은 원시 요소다.** facet 종류를 스키마가 열거하지 않는다. facet 은 원시 요소 하나에 필드를 채운 것이다. 원시 요소는 다섯이고 **늘리는 것이 기본값이 아니다**.
4. **뷰어가 시각을 소유하지 않는다.** 구조가 보이는 최소한만 입힌다. 앱의 시각은 claim-design-system 것이다. 참조 뷰어는 무엇이 올바른 렌더인지의 기준이지 앱의 공유 코드가 아니다.

## 레이아웃

| 자리 | 무엇 |
| --- | --- |
| `schema/*.json` | **정본.** JSON Schema 2020-12. 어휘·모양·제약이 전부 여기 있다 |
| `docs/weave.md` | 설명서 겸 카탈로그. 템플릿을 쓰는 Procedure 의 프롬프트에 실린다 |
| `weave/` | 검사기 (Python). **판정은 전부 여기 하나에 있다** |
| `viewer/render.mjs` | 참조 렌더. 원시 요소 다섯을 그린다. 문서를 받아 HTML 문자열을 내는 순수 함수 |
| `viewer/app.mjs` · `style.css` · `shell.html` | 실시간 편집기와 껍데기 |
| `samples/` | 샘플 넷. 한 벌 = `sample.json`(명단·focus) + `template.json` + `values-*.json` |
| **`viewer.html`** | 빌드 산출물. **파일을 브라우저로 열면 바로 돈다.** 손으로 고치지 않는다 |
| `viewer/samples.mjs` | 마찬가지로 빌드 산출물 |
| `tools/build_viewer.py` | 위 둘을 만든다 |
| `.github/workflows/ci.yml` | 필수 전체 회귀. `make all` 한 줄을 부른다 |
| `tools/emit_types.py` | 닫힌 어휘를 소비자 언어로 내보낸다 |
| `generated/` | 그 산출물. 손으로 고치지 않는다 |
| `tests/` | 고정 케이스. 검사기는 `test_check.py`(정상 사례 `fixtures/ok/` · 결함 사례는 파일 안의 변형 표), 샘플은 `test_samples.py`, 그리는 쪽은 `viewer.test.mjs` |

`schema/` 넷 — `weave-common`(어휘) · `weave-template`(분석 템플릿) · `weave-valueset`(값 한 벌) · `weave-render-args`(focus).
파일 사이 참조는 상대 `$ref` 라 그대로 복사해 가도 풀린다.

## 시작

```sh
make setup   # .venv 를 만들고 jsonschema 를 넣는다 (유일한 런타임 의존)
make all     # test + types-check + check + viewer-check + viewer-test
make viewer  # viewer/ 와 samples/ 를 viewer.html 한 장으로 다시 묶는다
```

**상주 서버·컨테이너·프리뷰를 세우지 않는다.** `viewer.html` 을 브라우저로 열면 그대로 돈다.
CDN 도 쓰지 않는다 — 오프라인에서 죽으면 안 된다.

`make viewer-test` 만 `node` 를 쓴다. **개발용이고 런타임 의존이 아니다** — 저장소의 런타임 의존은 `jsonschema` 하나 그대로다.

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
| `make viewer` | `viewer/` 와 `samples/` 를 `viewer.html` 한 장으로 다시 묶는다 |
| `make viewer-check` | `viewer.html` 이 소스·샘플과 갈렸는지 본다 |
| `make viewer-test` | 그리는 쪽의 고정 케이스. `node` 가 있어야 돈다 |
| `make all` | `test` · `types-check` · `check` · `viewer-check` · `viewer-test` |

**CI 는 PR 과 `develop` push 에서 `make all` 을 돌린다**([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). 게이트 목록의 정본은 `Makefile` 하나이고 워크플로는 그것을 부르기만 한다 — 워크플로에 검사를 따로 적지 않는다. 실행기는 python 3.13 과 node 24 이고 워크플로가 못박는다. **로컬 통과는 필수 CI 를 대체하지 않는다.**

| 무엇을 고쳤나 | 돌릴 것 |
| --- | --- |
| `schema/` | `make all` — 어휘가 바뀌면 `generated/` 도 같이 커밋한다 |
| `weave/` (검사기) | `make test check` |
| `viewer/` | `make viewer viewer-test test` — **`viewer.html` 을 같이 커밋한다** |
| `samples/` | `make viewer check test viewer-test` — 마찬가지로 `viewer.html` 을 같이 커밋한다 |
| `tests/fixtures/` | `make test check` |
| `tools/emit_types.py` · `generated/` | `make types-check` |
| `.github/workflows/` · `Makefile` | `make all` 과 **의도한 회귀 하나**. 워크플로를 넣었다는 사실이 보호가 아니다 |
| `docs/` · `AGENTS.md` 만 | 없음 |

## 검사기가 못 보는 것

사실대로 적어 둔다. 이 자리를 믿고 넘기면 안 된다.

- **한 facet 이 비교 축 하나인지.** 의미의 문제라 템플릿을 쓰는 Procedure 가 지킨다. 볼 만한지는 참조 뷰어로 사람이 본다.
- **`description` 안의 자연어.** 「종합 등급을 A~E 로 매겨라」라고 적어도 검사기는 통과시킨다. 어휘 검열은 하지 않는다.
- **잘못 정규화한 값.** `ratio` 에 `50`(= 5000%) 을 넣어도 수치로는 옳다. 정수 여부(`money`·`age`·`duration`)와 날짜 형식만 본다.
- **`text` 로 우회하는 등급.** `text` 값에 "A등급" 을 담는 것은 막을 수 없다.
- **값 한 벌이 없는 subject.** 아직 분석되지 않은 것이므로 검사기가 할 말이 없다. 몇 벌이 와야 하는지는 부르는 쪽이 안다.
- **`generated/weave-vocab.ts` 가 실제로 컴파일되는지.** 이 저장소에 TS 툴체인이 없다. 소비자 쪽 빌드가 처음 확인한다.
- **참조 뷰어가 브라우저에서 어떻게 보이는지.** 고정 케이스는 나온 HTML 의 글과 표시를 보고, DOM 흉내 위에서 한 장이 돌기까지만 본다. 실제 화면은 `viewer.html` 을 사람이 열어 본다.
- **뷰어는 아무것도 판정하지 않는다.** JSON 으로 읽히는지만 본다. 뷰어에서 멀쩡해 보여도 스키마에 맞는다는 뜻이 아니다. 판정은 `python -m weave` 가 한다.

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

## 참조 뷰어

`viewer.html` 을 브라우저로 연다. 왼쪽에서 템플릿과 값을 쓰면 오른쪽이 그 자리에서 바뀐다.
**언어를 만져 보고 화면이 어떻게 되는지 보는 자리**이지 앱의 코드가 아니다. 앱은 claim-design-system 으로 자기 시각을 입힌다.

- **의존성이 없다.** 서버도 CDN 도 빌드 도구도 없다. `file://` 로 열어도 돌도록 스타일·스크립트·샘플을 한 장에 박는다.
- **판정하지 않는다.** JSON 으로 읽히는지만 본다. 스키마 판정의 정본은 Python 검사기 하나이고 브라우저에서 다시 구현하지 않는다.
- **그리지 못하는 입력에서 멈추지 않는다.** 그 자리를 표시하고 왼쪽 아래에 까닭을 적고 나머지는 그대로 그린다.
- **원시 요소 다섯을 전부 그린다.** `ELEMENTS` 표가 렌더의 분기 전부이고 facet 종류를 아는 분기는 없다.
- **값이 없는 facet 도 자리를 남기고 없다고 말한다.** 숨기면 subject 마다 골격이 달라져 견줄 수 없다.
- **값 한 벌이 없는 subject 는 「아직 분석 중」이다.** 필드가 비어 있는 「값 없음」과 눈으로 구별된다.
- **subject 명단은 뷰어의 인자다.** 값 한 벌이 없는 subject 를 세우려면 부르는 쪽이 명단을 준다. 스키마에 넣지 않는다.
- **`focus` 는 subject 의 id 다.** `null` 이면 아무것도 강조하지 않고, 없는 id 면 focus 만 사라진다. 화면에서 눌러 보고 없는 id 를 쳐 볼 수 있다.
- **색이 뜻을 갖지 않는다.** 쓰는 색이 전부 무채색이고, 선은 색이 아니라 점선 무늬로 구별한다. 고정 케이스가 이것을 본다.

## 샘플을 고칠 때

샘플은 **뷰어를 시험할 재료이자 사람이 읽는 분석뷰**다. 검사기를 통과시키려 만든 조각 모음이 아니다.
성격이 다른 넷을 유지한다 — 원시 요소 다섯을 전부 쓰는 것, subject 가 하나뿐인 것,
값이 많이 비고 미분석 subject 가 섞인 것, 비교 축 하나를 깊게 파는 것.

필드는 **추출률이 높은 것부터** 고른다. 지금 제안서에서 바로 뽑히는 것은 보장명·초회 보험료·가입금액·
가입나이·갱신 여부·갱신주기·납입기간·만기나이다. 드문 축으로 짜면 화면이 대부분 비어 나와 시험이 되지 않는다.

**한 facet 이 비교 축 하나**라는 규칙은 스키마가 검사하지 못한다. 샘플이 그것을 지켜서 보인다.
고치면 `make viewer` 로 다시 묶고 `viewer.html` 을 같이 커밋한다.

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
