# weave — 저장소 진입점

분석뷰를 선언하는 스키마와 그것을 그리는 참조 구현. 런타임 서비스가 아니라 **공유 계약**이다.
아무도 weave 를 호출하지 않고 소비자 둘이 그것을 읽는다 — eightytwo-judge(Python, 템플릿을 쓰고 값을 채운다)와 claim-mobile(TS, 그린다).

스키마를 쓰거나 값을 채우는 쪽은 [`docs/weave.md`](docs/weave.md) 하나만 읽으면 된다. 이 문서는 저장소를 고치는 쪽이 읽는다.

## 어기면 저장소를 만든 이유가 사라지는 것 넷

1. **보험이 들어오면 안 된다.** 스키마는 값의 타입과 그리는 법만 안다. 무엇을 찾을지는 필드 선언의 `description` 이 자연어로 말한다. 도메인 어휘가 타입이나 primitive element 이름으로 새어 들면 다른 상품군에서 다시 못 쓴다.
2. **순위·등급·점수·경고색을 표현할 문법을 두지 않는다.** 객관성을 문서가 아니라 스키마로 강제하는 자리다. 모든 객체가 `additionalProperties: false` 이고 어휘가 전부 닫힌 `enum` 인 이유가 이것이다.
   그 대신 **비교를 시각이 맡는다**(glossary §3.14 원칙 7). 나란히 늘어놓으면 비교를 사람이 머릿속에서 해야 하므로 그러지 않는다. **방법은 primitive element 마다 다르다** — 겹칠 자리가 있는 `line`·`list` 는 겹치고, 없는 `stat`·`facts`·`bars` 는 **`focus` 가 무엇을 그릴지 고른다.** 그래서 focus 가 강조 장치가 아니라 고르는 자리다. 고른 것이 없으면 첫 subject 를 그리고, 무엇을 보고 있는지 이름으로 늘 말한다.
3. **렌더가 구현하는 것은 primitive element 다.** facet 종류를 스키마가 열거하지 않는다. facet 은 primitive element 하나에 필드를 채운 것이다. primitive element 는 다섯이고 **늘리는 것이 기본값이 아니다**.
4. **뷰어가 시각을 소유하지 않는다.** 구조가 보이는 최소한만 입힌다. 앱의 시각은 claim-design-system 것이다. 참조 뷰어는 무엇이 올바른 렌더인지의 기준이지 앱의 공유 코드가 아니다.

## 레이아웃

| 자리 | 무엇 |
| --- | --- |
| `schema/*.json` | **정본.** JSON Schema 2020-12. 어휘·모양·제약이 전부 여기 있다 |
| `docs/weave.md` | 설명서 겸 카탈로그. 템플릿을 쓰는 Procedure 의 프롬프트에 실린다 |
| `weave/` | 검사기 (Python). **판정은 전부 여기 하나에 있다** |
| `viewer/render.mjs` | 참조 렌더. primitive element 다섯을 그린다. 문서를 받아 HTML 문자열을 내는 순수 함수 |
| `viewer/app.mjs` · `style.css` · `shell.html` | 설명서의 목차·본문과 그 안의 플레이그라운드 |
| `viewer/icons.mjs` | lucide 아이콘 아홉을 **인라인으로 옮겨 둔 것.** 출처·버전·라이선스가 파일 머리에 있다 |
| `catalog/guide.json` | element 가 아닌 쪽의 산문. 목차의 앞뒤가 여기서 나온다 |
| `samples/` | **템플릿 샘플** 넷. 한 벌 = `sample.json`(차례·명단·focus) + `template.json` + `values-*.json` |
| `catalog/elements.json` | primitive element 설명서의 **산문과 보기**. 제약은 적지 않는다 |
| `tools/catalog.py` | 스키마에서 제약을 뽑아 카탈로그 하나를 만든다 |
| **`viewer.html`** | 빌드 산출물. **weave 의 설명서다.** 브라우저로 열면 바로 돈다. 손으로 고치지 않는다 |
| `viewer/samples.mjs` · `viewer/catalog.mjs` | 마찬가지로 빌드 산출물 |
| `tools/build_viewer.py` | 위 셋과 `docs/weave.md` 의 카탈로그 표를 만든다 |
| `.github/workflows/ci.yml` | 필수 전체 회귀. `make all` 한 줄을 부른다 |
| `tools/emit_types.py` | 닫힌 어휘를 소비자 언어로 내보낸다 |
| `generated/` | 그 산출물. 손으로 고치지 않는다 |
| `tests/` | 고정 케이스. 검사기는 `test_check.py`(정상 사례 `fixtures/ok/` · 결함 사례는 파일 안의 변형 표), 샘플과 카탈로그는 `test_samples.py`, 워크플로의 형태는 `test_ci.py`, 그리는 쪽은 `viewer.test.mjs` |

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
from weave import check_template, check_valueset, check_render_args
result = check_valueset(values, template)   # result.ok / result.problems
```

```sh
python -m weave template tpl.json
python -m weave values --template tpl.json values-a.json values-b.json
python -m weave args args.json
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

**이 sprint 의 남은 weave 변경은 작업 브랜치 하나에 쌓는다.** 중간 PR 도 `develop` 머지도 하지 않고 sprint 종료 때 PR 하나로 올린다(PM `orchestrator.md` §4).

**CI 는 `develop` 으로 향하는 PR 에서 `make all` 을 돌린다**([`.github/workflows/ci.yml`](.github/workflows/ci.yml)). 생성·갱신·재개 셋에서 돈다 — 랜딩 PR 에 커밋을 얹으면 입력이 달라지므로 앞 회차를 그대로 믿지 않는다. **작업 브랜치 push 나 브랜치끼리 여는 PR 에서는 돌지 않는다.** 취소는 같은 PR 의 앞 회차만 한다.

게이트 목록의 정본은 `Makefile` 하나이고 워크플로는 그것을 부르기만 한다 — 워크플로에 검사를 따로 적지 않는다. 실행기는 python 3.13 과 node 24 이고 워크플로가 못박는다. **로컬 통과는 필수 CI 를 대체하지 않는다.**

| 무엇을 고쳤나 | 돌릴 것 |
| --- | --- |
| `schema/` | `make all` — 어휘가 바뀌면 `generated/` 도 같이 커밋한다 |
| `weave/` (검사기) | `make test check` |
| `viewer/` | `make viewer viewer-test test` — **`viewer.html` 을 같이 커밋한다** |
| `samples/` · `catalog/` | `make viewer check test viewer-test` — 마찬가지로 산출물을 같이 커밋한다 |
| `schema/weave-render-args` | `make all` — 소비자 둘에게 알린다 |
| `samples/*/values-*.json` | 파일 이름 차례가 **화면 차례**다. 값 한 벌들이 곧 명단이기 때문이다 |
| `tests/fixtures/` | `make test check` |
| `tools/emit_types.py` · `generated/` | `make types-check` |
| `.github/workflows/` · `Makefile` | `make all` 과 **의도한 회귀 하나**. 워크플로를 넣었다는 사실이 보호가 아니다. 트리거의 형태는 `tests/test_ci.py` 가 본다 |
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

⚠️ **아직 돌려 보지 않았다.** 두 생성기 모두 `if`/`then`/`not` 조건절을 온전히 옮기지 못할 수 있고, 그러면 primitive element 별 필드 제약이 생성 타입에서 느슨해진다. **그 제약의 판정은 어차피 검사기가 갖는다** — 생성 타입은 모양을 잡는 용도이고 판정이 아니다. 소비자가 처음 돌릴 때 확인한다.

⚠️ **LLM 구조화 출력.** judge 가 `weave-template.schema.json` 을 그대로 구조화 출력 스키마로 넘기려면, 파일 간 `$ref` 와 조건절을 지원하는지 그쪽 API 가 정한다. 지원하지 않으면 한 파일로 펼친 변형이 필요하다. 그 변형을 이 저장소가 낼지는 정하지 않았다.

⚠️ **배포 방법은 미정이다.** 패키지로 낼지, 서브모듈로 둘지, `schema/` 를 복사해 갈지 PM 이 정한다.

## 설명서 한 장

`viewer.html` 을 브라우저로 연다. **이 한 장이 weave 의 설명서이고 플레이그라운드는 그 안의 한 자리다.**
왼쪽에 목차, 가운데에 본문. element 쪽 본문은 제약과 최소 템플릿 조각과 **그 자리에서 그린 모습**이다.
언어를 배우고 만져 보는 자리이지 앱의 코드가 아니다. 앱은 claim-design-system 으로 자기 시각을 입힌다.

- **목차의 정본은 카탈로그다.** 손으로 적지 않는다 — primitive element 가 늘거나 줄면 목차가 따라 바뀐다.
- **의존성이 없다.** 서버도 CDN 도 빌드 도구도 없다. `file://` 로 열어도 돌도록 스타일·스크립트·샘플을 한 장에 박는다.
- **`renderView` 가 내는 것은 분석뷰뿐이다.** 템플릿 제목과 facet 들. 설명서가 덧붙이는 것(목차·조작 띠·primitive element 이름)은 전부 분석뷰 바깥에 둔다 — 앱이 이 출력을 가져다 쓸 때 따라가면 안 된다. 화면 상태는 `view` 로 따로 나간다.
- **화면에 남길지는 하나로 고른다** — 그것이 없으면 사람이 못 하는 일이 있는가. 없으면 뺀다. 상태 줄·범례·샘플 설명·「없는 id」 입력칸이 그래서 없다.
- **판정하지 않는다.** JSON 으로 읽히는지만 본다. 스키마 판정의 정본은 Python 검사기 하나이고 브라우저에서 다시 구현하지 않는다.
- **그리지 못하는 입력에서 멈추지 않는다.** 그 자리를 표시하고 왼쪽 아래에 까닭을 적고 나머지는 그대로 그린다.
- **primitive element 다섯을 전부 그린다.** `ELEMENTS` 표가 렌더의 분기 전부이고 facet 종류를 아는 분기는 없다.
- **값이 없는 facet 도 자리를 남기고 없다고 말한다.** 숨기면 subject 마다 골격이 달라져 견줄 수 없다.
- **전부 비어 있는 값 한 벌도 자리를 얻는다.** 모든 facet 이 「값 없음」이라고 말하고 왜인지는 주석이 말한다.
- **subject 명단은 계약의 일부다.** `weave-render-args` 의 `subjects` 다. 아직 분석되지 않은 subject 는 값 한 벌이 없으므로 부르는 쪽이 말해 주지 않으면 그릴 수가 없다.
- **subject 마다 값 한 벌이 정확히 하나 있다. 비어 있을 수 있다.** 「값 한 벌이 없는 subject」라는 것은 없다. 자리와 그 차례는 값 한 벌들이 정하고 명단을 따로 받지 않는다.
- **「아직 분석되지 않았다」는 상태가 없다.** 전부 비어 있는 값 한 벌과 주석이 그것을 말한다 — 왜 없는지를 언어가 분류하지 않는다는 규칙의 예외를 두지 않는다. 대가는 분석이 주석을 달지 않으면 화면이 「값 없음」이라고만 말하는 것이다.
- **탭은 값 한 벌마다 하나다.** subject 마다 값 한 벌이 하나이므로 탭이 곧 subject 다. 「값 한 벌」이라고 또 적지 않는다.
- **더하고 지우는 것은 subject 하나뿐이다.** `＋ subject` 는 **전부 비어 있는** 값 한 벌을 만든다 — 그것이 아직 분석하지 않았음을 만들어 보는 길이다.
- **`focus` 는 subject 의 id 다.** `null` 이면 아무것도 강조하지 않고, 없는 id 면 focus 만 사라진다 — 분석뷰가 focus 를 놓은 것과 통째로 같아지고, 그 사실은 띠가 알린다. 조작하는 자리는 **오른쪽 판 위의 띠**다. 보면서 누르는 것이라 편집기 쪽이 아니다.
- **말은 데이터 뒤에 한자리에 모인다.** facet 제목 → 본문 → facet 주석 → subject 주석. 예외를 두지 않는다. 둘을 가르는 것은 띠도 상자도 아니고 자리와 글이다 — subject 것은 이름이 앞에 선다.
- **subject 의 주석은 언제나 고른 subject 것이다.** element 로 갈리지 않는다 — 규칙이 하나다. focus 를 옮기면 말이 따라온다. facet 에 붙은 주석은 그대로 전부 선다.
- **값 옆의 표시는 하나이고 중립이다.** 「붙은 말이 있다」만 말하고 둘 이상이면 수를 적는다. 갈래는 툴팁 안에서 산다.
- **설명서 페이지가 같은 한 장 안에 있다.** primitive element 마다 무엇을 그리는지·어떤 필드를 받는지·최소 템플릿 조각·**그 자리에서 그린 모습**을 보인다.
- **subject 나 값의 우열을 시각으로 말하지 않는다.** subject 색은 자리 차례로 배정되고 값의 크기와 무관하다. 주석 갈래는 통용 시맨틱을 따르되 색이 값에 닿지 않는다. 선은 색과 점선 무늬로 함께 갈린다. 고정 케이스가 기계로 볼 수 있는 만큼 본다 — 나머지는 사람이 본다.

## 시각을 고칠 때

**뷰어의 시각은 참조일 뿐 제품의 정본이 아니다.** 사람이 언어를 만져 보는 자리라 **읽히는 만큼의 시각**을 갖고,
**주석 갈래처럼 통용되는 UI 시맨틱은 따른다**(주의는 경고색과 경고 아이콘, 보충은 info).
다만 **subject 나 값의 우열을 시각으로 말하지 않는다** — 값의 크기에 따라 달라지는 색, 순위·등급 표시를 두지 않는다.
제품 화면의 시각 정본은 claim-design-system 것이다.

**둘은 다른 일이다.** 「주의」가 경고색인 것은 **이 자리를 조심해 읽으라**는 뜻이지 그 제안서가 나쁘다는 뜻이 아니다.
그래서 갈래 색은 **표시와 갈래 이름에만** 얹고 값이나 글에는 얹지 않는다.

정본(`glossary.md`)의 **「산출물에 디자인이 없다」는 스키마와 값에 대한 말**이다 — 템플릿과 값 한 벌에는
색도 아이콘도 들어가지 않는다. 뷰어는 그 「최종 렌더 위치」이고 시각을 주입하는 쪽이다. 헷갈리지 않는다.

### 쓸 수 있는 것

| 무엇 | 조건 |
| --- | --- |
| **주석 갈래의 색** (`.note-<kind>` 의 `--kind`) | **색이 나오는 유일한 자리다.** 통용되는 UI 시맨틱을 따르고, **주석 줄 안의** 갈래 표시와 갈래 이름에만 닿는다 |
| **subject 를 가르는 것** | 색이 아니다 — **이름**(늘 글로 선다)과 `line` 의 **점선 무늬**뿐이다 |
| **세로 리듬** (`--row` · `--step` · `--gap`) | 자는 셋뿐이다. 줄 사이·층 사이·facet 사이. 낱개로 여백을 주지 않는다 |
| **갈래를 가리키는 아이콘** | 주석 넷과 primitive element 다섯뿐. **lucide 실물을 인라인으로 옮긴다**(`viewer/icons.mjs`) — 기억으로 그리지 않고, 아이콘 폰트도 CDN 도 쓰지 않는다 |
| **타이포와 여백** | 크기 단계·줄간·여백. 가장 싸게 좋아지는 자리다 |

### 하지 않는 것

| 하지 않는다 | 왜 |
| --- | --- |
| **평가를 색으로 말하기** — 빨강=나쁨, 값의 크기에 따라 달라지는 색, 1등 표시, 경고 삼각형 | 순위를 스키마에서 뺀 이유가 사라진다 |
| **색을 값·subject·facet 에 칠하기** | 색 있는 값은 `--kind` 선언에만 설 수 있다. 나머지는 그 변수를 거치거나 무채색이다 |
| **값 옆 표시를 갈래로 물들이기** — 갈래 아이콘 늘어놓기 · 주의면 빨간 표시 | 값이 갈래로 물든다. 표시는 중립이고 갈래는 툴팁 안에서 산다 |
| **도메인 아이콘** — 돈·병원·서류 | 언어가 보험을 모른다는 것이 이 저장소의 첫째 규칙이다 |
| **무늬만으로 가르기** | 색을 걷은 뒤 `line` 은 **무늬**가 유일한 가름이다. 그래서 선 끝의 **이름**이 반드시 함께 선다 |
| **간격으로 두 묶음 가르기** | 주석 줄 사이는 전부 같은 자다. facet 것과 subject 것을 가르는 것은 **이름**이지 여백이 아니다 |
| **표가 페이지를 옆으로 밀기** | `list` 는 subject 가 늘수록 넓어진다. 스크롤은 그 표의 상자 것이고 열 너비는 균일하다 |
| 둥근 상자에 왼쪽 띠를 덧대기 · 활성을 **밑줄**로 말하기 | 뜻 없는 장식이 위계를 흉내 낸다. 굵기·색조·면으로 말한다 |
| 덩어리마다 다른 `border-radius` · 점선·겹선 장식 · 빗금 · 그림자 | 모서리는 한 값뿐이고 진짜 컨테이너에만 |
| 빈 자리를 점선 상자와 가운데 정렬로 꾸미기 · 배지와 알약 남발 | 틀이 아니라 자리다. 글로 말한다 |

### 아이콘을 고칠 때

[`viewer/icons.mjs`](viewer/icons.mjs) 는 **lucide 실물을 옮겨 둔 것**이다 — `npm pack lucide-static@<버전>` 으로 풀어
`icons/<이름>.svg` 의 안쪽을 그대로 가져온다. **기억으로 path 를 그리지 않는다.** 비슷하지만 다른 그림이 된다.
출처·버전·라이선스(ISC)는 그 파일 머리에 적혀 있고, 아홉 가운데 어느 이름을 썼는지도 주석에 있다.

고를 때 — **갈래를 가리키는 것만**. 도메인(돈·병원·서류)도, 심각도를 말하는 그림(경고 삼각형·느낌표)도 안 된다.
주석 넷은 **통용되는 UI 시맨틱**을 따른다 — 주의는 `circle-alert`, 보충은 `info`.

### 기계가 보는 것과 사람이 봐야 하는 것

이 판정은 **기계가 전부 볼 수 없다.** 「이 빨강이 나쁨을 뜻하는가」는 의미의 문제다.

| 기계가 본다 (`장식으로 위계를 만들지 않는다` · `평가를 시각으로 말하지 않는다` · `subject 를 색으로 가르지 않는다` · `세로 리듬이 자 셋에서만 나온다` · `list 의 열은 균일하고 표만 옆으로 굴린다`) |
| --- |
| 색이 있는 자리가 **주석 갈래뿐**이고 나머지는 전부 무채색인지 |
| subject 색이 스타일시트·렌더·앱 어디에도 남지 않았는지 |
| 렌더가 넣는 inline `style` 이 **길이뿐**인지 (값이 시각을 정하지 않는지) |
| **색 있는 값이 `--kind` 선언에만 서는지** — 값·subject·facet 에 칠하는 길이 막혔는지 |
| 겹친 선 둘이 **서로 다른 무늬**이고 각각 **이름표**를 갖는지 |
| facet 의 위아래 여백이 같은지 (divider 가 한가운데 서는지) |
| 주석 줄 사이와 묶음 사이가 **같은 자**인지 — 묶음 사이만 따로 벌린 규칙이 없는지 |
| `list` 의 표가 자기 스크롤 상자에 있고 열 너비가 `table-layout:fixed` 로 균일한지 |
| 갈래별 색이 스키마의 `AnnotationKind` 넷과 같은지, 그 색이 값·글에 닿지 않는지 |
| 값 옆 표시가 **svg 하나**이고 갈래 클래스를 걸치지 않는지, 그 갈래가 툴팁 안에는 남는지 |
| subject 의 주석이 **다섯 element 모두에서** 고른 subject 것만인지 — 고정 케이스에 subject 둘 이상이 말을 가졌는지까지 |
| `⚠`·`★`·`1위` 같은 평가 기호와 순위 어휘가 없는지 |
| 왼쪽 띠·밑줄·그림자·모서리 난립·점선 장식이 없는지 |

| **사람이 봐야 한다** |
| --- |
| 갈래 색·아이콘이 **그 제안서의 우열처럼** 읽히지 않는가 |
| 색 없이도 `line` 의 선이 서로 갈리는가 — 선이 여럿일 때가 이번의 위험이다 |
| 여백이 고른가, 어디서 끊기는지 눈이 읽는가 |
| `list` 가 좁은 화면에서 표만 굴러가는가 |
| 아이콘이 보험을 연상시키지 않는가 (이름 검사 너머) |
| 「대략적인 느낌이 오는가」 — 이것이 시각을 들인 목적이다 |

**Tailwind 를 들이지 않기로 했다.** 허가는 받았지만 이득이 아니다 — `renderView` 의 출력은
앱이 가져다 쓰는 **계약 면**이고 지금은 의미 있는 클래스(`facet element-stat` · `miss empty`)만
낸다. Tailwind 는 시각을 마크업에 넣는 도구라 유틸리티 클래스가 렌더 출력에 실리고, 그러면
앱이 그것을 걷어내야 한다 — 「뷰어가 시각을 소유하지 않는다」와 정면으로 부딪힌다. `@apply` 로
의미 클래스에만 쓰면 180줄짜리 스타일시트를 위해 node_modules 를 들이는 것뿐이다.

## 샘플을 고칠 때

샘플은 **템플릿 샘플**이다. 분석뷰를 어떻게 짤 수 있는지를 넷으로 보인다.
**가르는 축은 템플릿의 짜임**이다 — 어떤 facet 을 어떤 primitive element 로 몇 개, 어떤 순서로.
값의 상태(있음·없음·미분석)로 가르지 않는다. 그건 샘플의 축이 아니라 `tests/fixtures/ok/` 의 일이다.

지금 넷 — `all-elements`(다섯 전부·facet 여섯) · `stat-row`(같은 element 를 넷) ·
`one-table`(facet 하나에 필드 열) · `one-axis`(축 하나를 셋으로).

`sample.json` 은 `{order, name, args}` 이고 `args` 는 **`weave-render-args` 문서 그대로**다.
뷰어가 지어낸 모양이 아니라 계약이라 고정 케이스가 검사기로 판정한다.

값은 그 템플릿을 보이는 데 필요한 만큼만 딸려 온다. 다만 **값이 비는 경우와 미분석 subject 는 없애지 않는다.**
그 상태들은 여전히 보여야 하고, 한 샘플 안에 자연스럽게 섞여 있으면 된다.

필드는 **추출률이 높은 것부터** 고른다. 지금 제안서에서 바로 뽑히는 것은 보장명·초회 보험료·가입금액·
가입나이·갱신 여부·갱신주기·납입기간·만기나이다. 드문 축으로 짜면 화면이 대부분 비어 나와 시험이 되지 않는다.

**한 facet 이 비교 축 하나**라는 규칙은 스키마가 검사하지 못한다. 샘플이 그것을 지켜서 보인다.
고치면 `make viewer` 로 다시 묶고 산출물을 같이 커밋한다.

## 설명서가 갈리지 않게 하는 법

primitive element 카탈로그가 서는 자리가 둘이다 — `docs/weave.md` 의 표와 뷰어의 설명서 페이지.
**둘 다 산출물이다.** `tools/catalog.py` 가 하나를 만들고 `tools/build_viewer.py` 가 둘 다 낸다.

| 무엇 | 정본 |
| --- | --- |
| 제약 — 필드 수 · shape · type | `schema/weave-template.schema.json` 의 `Facet` 조건절 |
| 산문 — 무엇을 그리는가 · 비고 · 보기 | `catalog/elements.json` |
| 목차의 앞뒤 — 시작 · 플레이그라운드 | `catalog/guide.json` |
| `docs/weave.md` 의 표 · 뷰어의 설명서 페이지 | **산출물.** 손으로 고치지 않는다 |

산문은 **평문**으로 쓴다. markdown 강조나 backtick 을 섞으면 표에서는 살고 뷰어에서는 글자로 샌다.
고정 케이스가 그것과, 보기가 검사기를 통과하는 것과, 산출물이 갈렸는지를 본다.

## 어휘를 늘릴 때

primitive element·타입·모양·주석 갈래는 **닫힌 목록이고 좁히는 쪽이 기본**이다. 늘리기는 쉽고 줄이기는 어렵다.

늘리려면 넷을 함께 댄다.

1. 지금 다섯(여덟·넷)의 조합으로 안 되는 구체적 사례
2. 그것이 도메인 없이 설명되는가 — 「병명 목록」은 새 primitive element 가 아니라 `list` 다
3. 순위·등급으로 쓰일 길이 없는가
4. `docs/weave.md` 가 얼마나 커지는가 — **설명서 크기가 곧 Procedure 프롬프트 무게다**

어휘를 바꾸면 `generated/` 를 같이 커밋하고, 소비자 둘(eightytwo-judge · claim-mobile)이 있으므로 PM 에 알린다.

## 권한 밖

제품 의도 변경, 소비자 repo 수정, 배포. PM 에 올린다.
소비자와 라이브로 협상하지 않는다 — 계약 형상은 이 저장소가 먼저 발행하고 소비자가 그 버전을 적용한다.
