// 참조 렌더의 고정 케이스. `make viewer-test` (= node --test) 가 돌린다.
//
// **값 상태 조합은 샘플이 아니라 자기 fixture 로 본다** (`tests/fixtures/ok/`). 샘플은 템플릿의
// 짜임을 보이는 자리라 갈아 끼워도 이 판정이 흔들리면 안 된다.
//
// **판정은 여기 없다.** 스키마 판정의 정본은 Python 검사기이고 `tests/test_samples.py` 가
// 샘플과 카탈로그 보기 전부를 그것에 건다. 여기서는 「그려지는가」만 본다.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

import { PAGES } from "../viewer/catalog.mjs";
import {
  COMPARE, ELEMENTS, KIND_LABEL, NO_ITEM, NO_ITEMS, NO_VALUE, NO_VALUE_MARK, TRACE, UNDRAWABLE, esc,
  formatScalar, renderView, traceOf,
} from "../viewer/render.mjs";
import { ICON } from "../viewer/icons.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));
const parseJson = (t) => JSON.parse(t);

// ---------------------------------------------------------------- 재료

/** 값 상태 조합의 fixture. primitive element 를 전부 쓰고 채움·빔·섞임 한 벌씩.
 *  **subject 마다 값 한 벌이 정확히 하나 있다** — 그중 하나(proposal-b)가 전부 비어 있다. */
const FIX = {
  template: read("tests/fixtures/ok/template.json"),
  filled: read("tests/fixtures/ok/values-filled.json"), // proposal-a · 전부 채움
  empty: read("tests/fixtures/ok/values-empty.json"), // proposal-b · 전부 빔
  mixed: read("tests/fixtures/ok/values-mixed.json"), // proposal-c · 섞임, 빈 목록 포함
};
FIX.values = [FIX.filled, FIX.empty, FIX.mixed];

const fix = (overrides = {}) =>
  renderView({ template: FIX.template, values: FIX.values, focus: null, ...overrides });

// 뷰어가 띄우는 차례. sample.json 의 order 가 정한다.
const sampleNames = fs
  .readdirSync(path.join(ROOT, "samples"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort((a, b) => read(`samples/${a}/sample.json`).order - read(`samples/${b}/sample.json`).order);

function sample(name) {
  const dir = path.join("samples", name);
  const meta = read(path.join(dir, "sample.json"));
  const values = fs
    .readdirSync(path.join(ROOT, dir))
    .filter((f) => f.startsWith("values-") && f.endsWith(".json"))
    .sort()
    .map((f) => read(path.join(dir, f)));
  // args 는 weave-render-args 문서 그대로다 — 이제 focus 하나뿐이다.
  return { ...meta.args, name: meta.name, template: read(path.join(dir, "template.json")), values };
}

/** 설명서 목차에서 primitive element 쪽만. */
const elementPages = () => PAGES.filter((p) => p.kind === "element");

const drawSample = (s, overrides = {}) =>
  renderView({ template: s.template, values: s.values, focus: s.focus ?? null, ...overrides });

/** 태그를 걷어낸 글. 사람이 화면에서 읽을 것에 가깝다. */
const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
// **읽어 주는 기계가 듣는 것.** 없다는 자리는 화면에 표기 하나로 서고 뜻은 이름표가 갖는다 —
// 그 말이 사라지지 않았는지 보려면 판정도 이름표를 함께 들어야 한다.
// 표시를 가리켜야 열리는 자리들. 「그 안에 있나」를 자리로 재려면 시작과 끝을 알아야 한다 —
// 앞뒤로 재면 표시 뒤에 또 펴 놓은 것을 「표시 안」으로 잘못 센다.
const pops = (html) => {
  const found = [];
  for (const m of html.matchAll(/class="note-pop"/g)) {
    const end = html.indexOf('class="pop-close">', m.index);
    if (end > 0) found.push([m.index, end]);
  }
  return found;
};
const spokenOf = (html) =>
  textOf(html.replace(/<[^>]*role="img"[^>]*aria-label="([^"]*)"[^>]*>[\s\S]*?<\/[a-z]+>/g, " $1 "));

// ---------------------------------------------------------------- primitive element

test("primitive element 가 렌더의 분기 전부다", () => {
  const enumerated = read("schema/weave-common.schema.json").$defs.Element.enum;
  assert.deepEqual(Object.keys(ELEMENTS).sort(), [...enumerated].sort());
});

/**
 * 한 facet 의 마크업만 잘라 낸다. element 별로 무엇이 그려졌는지 따로 본다.
 *
 * `rows` 는 facet 이 둘 이상일 수 있다(compare 가 focus·overlay 로 갈린다) — `occurrence` 로
 * 몇 번째 것인지 고른다. 기본 0 은 그 element 가 하나뿐일 때 그대로 쓴다.
 */
function sectionOf(html, element, occurrence = 0) {
  const marker = `element-${element}"`;
  let at = -1;
  for (let i = 0; i <= occurrence; i++) {
    at = html.indexOf(marker, at + 1);
    if (at < 0) break;
  }
  assert.ok(at >= 0, `element-${element}[${occurrence}] 가 없다`);
  const end = html.indexOf("<section", at);
  return end < 0 ? html.slice(at) : html.slice(at, end);
}

/**
 * facet 하나의 마크업. **제목으로 찾는다** — 같은 element 를 쓰는 facet 이 둘이어도
 * (`rows` 의 focus·overlay) 제목은 facet 마다 다르므로 갈린다.
 */
function sectionOfFacet(html, facet) {
  const marker = `>${esc(facet.title ?? facet.id)}</h2>`;
  const at = html.indexOf(marker);
  assert.ok(at >= 0, `facet ${facet.id} 의 제목이 없다`);
  const start = html.lastIndexOf("<section", at);
  assert.ok(start >= 0, `facet ${facet.id} 의 section 이 없다`);
  const end = html.indexOf("<section", start + 1);
  return end < 0 ? html.slice(start) : html.slice(start, end);
}

test("primitive element 가 전부 그려진다", () => {
  const { html } = fix();
  for (const element of Object.keys(ELEMENTS)) assert.match(html, new RegExp(`element-${element}`));
  assert.match(sectionOf(html, "stat"), /class="big"/); // 값 하나를 크게
  assert.match(sectionOf(html, "facts"), /class="facts"/); // 라벨과 값 여럿
  assert.match(sectionOf(html, "bars"), /class="track"/); // 크기 비교
  assert.match(sectionOf(html, "line"), /svg class="line"/); // 축 위의 변화
  assert.match(sectionOf(html, "rows"), /table class="items"/); // 항목이 좌표다
});

const NAMES = { "proposal-a": "가 제안서", "proposal-b": "나 제안서", "proposal-c": "proposal-c" };

test("비교하는 법이 primitive element 마다 다르다", () => {
  // 겹칠 자리가 있는 것만 겹친다. 나머지는 focus 가 무엇을 그릴지 고른다.
  assert.deepEqual(COMPARE, {
    stat: "focus", facts: "focus", bars: "focus", parts: "focus",
    line: "overlay", rows: "chosen",
  });
  // **하나를 쪼갠 것은 겹칠 수 없다** — 두 subject 의 안이 한 덩어리가 될 수 없다.
  assert.equal(COMPARE.parts, "focus");
  // **rows 만 facet 마다 스스로 고른다.** 나머지는 이름 자체가 비교법을 고정한다.
  assert.equal(COMPARE.rows, "chosen");
  assert.deepEqual(Object.keys(COMPARE).sort(), Object.keys(ELEMENTS).sort());
});

test("line 과 겹치는 rows(overlay) 는 subject 를 한 좌표에 겹친다", () => {
  const { html } = fix();
  // riders(compare: overlay) 는 항목이 좌표다. subject 마다 표를 따로 두지 않는다.
  assert.equal((sectionOf(html, "rows", 0).match(/<table/g) ?? []).length, 1);
  // 자리를 가르는 것은 **이름**이다. 겹친 자리마다 누구 것인지 글로 서 있어야 한다.
  for (const name of Object.values(NAMES)) {
    assert.ok(sectionOf(html, "rows", 0).includes(name), `열 머리에 ${name} 가 없다`);
  }
  // 겹치는 쪽은 focus 를 옮겨도 subject 가 전부 그대로 서 있다.
  for (const id of Object.keys(NAMES)) {
    const part = sectionOf(fix({ focus: id }).html, "rows", 0);
    for (const name of Object.values(NAMES)) assert.ok(part.includes(name), `rows(overlay)/${id}: ${name}`);
  }
  const lines = fix().html;
  // 주석의 갈래 표시도 svg 라 선 그림만 센다.
  assert.equal((sectionOf(lines, "line").match(/<svg class="line"/g) ?? []).length, 1);
  assert.ok((sectionOf(lines, "line").match(/class="series/g) ?? []).length >= 2, "선이 겹쳐야 한다");
});

test("stat · facts · bars 는 focus 를 따라 바뀐다", () => {
  // 겹칠 자리가 없어 억지로 늘어놓는 대신 focus 가 무엇을 그릴지 고른다.
  const a = fix({ focus: "proposal-a" }).html;
  const c = fix({ focus: "proposal-c" }).html;
  for (const element of ["stat", "facts", "bars"]) {
    const one = sectionOf(a, element);
    const other = sectionOf(c, element);
    assert.notEqual(one, other, `${element}: focus 를 옮겨도 그림이 그대로다`);
    // 무엇을 보고 있는지는 **화면에 한 번**이면 된다 — facet 마다 되풀이하지 않는다.
    assert.ok(!one.includes('class="shown"'), `${element}: facet 마다 이름을 되풀이한다`);
  }
  // 값도 그 subject 의 것으로 바뀐다.
  assert.ok(textOf(sectionOf(a, "stat")).includes("87,400원"));
  assert.ok(textOf(sectionOf(c, "stat")).includes("62,000원"));
  assert.ok(!textOf(sectionOf(c, "stat")).includes("87,400원"));
});

test("focus 가 없으면 첫 subject 를 그린다", () => {
  // 늘어놓기로 돌아가지 않고, 빈 화면도 내지 않고, 무엇을 보는지 이름으로 말한다.
  const none = fix({ focus: null });
  const first = fix({ focus: FIX.values[0].subjectId });
  // 무엇을 그리고 있는지는 화면 상태가 말한다. 뷰어가 그것을 띠에 한 번 적는다.
  assert.equal(none.view.shown, FIX.values[0].subjectId);
  assert.ok(none.view.seats.some((s) => s.id === none.view.shown && s.name === "가 제안서"));
  for (const element of ["stat", "facts", "bars"]) {
    const part = sectionOf(none.html, element);
    assert.ok(part.trim().length > 40, `${element}: 빈 자리다`);
  }
  // 없는 id 도 같은 자리로 떨어진다 — 사라지면 무엇을 그릴지 정해져 있어야 한다.
  const missing = fix({ focus: "proposal-zzz" });
  assert.equal(missing.view.shown, FIX.values[0].subjectId);
  for (const element of ["stat", "facts", "bars"]) {
    assert.equal(sectionOf(missing.html, element), sectionOf(none.html, element));
  }
  // 첫째를 고른 것과 고르지 않은 것은 **바뀌는 쪽에서 같다** — 둘 다 첫 subject 를 그린다.
  for (const element of ["stat", "facts", "bars"]) {
    assert.equal(sectionOf(none.html, element), sectionOf(first.html, element), element);
  }
  // 겹치는 쪽에서만 갈린다 — 고르면 그 선과 그 열이 강조된다. rows 는 compare 가 갈래를 정한다.
  for (const element of ["line", "rows"]) {
    assert.notEqual(sectionOf(none.html, element), sectionOf(first.html, element), element);
    assert.ok(!sectionOf(none.html, element).includes("is-focus"), `${element}: 고르지 않았는데 강조가 있다`);
  }
  // rows 의 focus 변형(두 번째 자리, payments)은 stat·facts·bars 처럼 focus 를 옮겨도 그대로다.
  assert.equal(
    sectionOf(none.html, "rows", 1),
    sectionOf(first.html, "rows", 1),
    "rows(focus): focus 를 옮겨도 바뀌면 안 된다",
  );
});

test("모르는 primitive element 는 조용히 넘어가지 않는다", () => {
  const template = structuredClone(FIX.template);
  template.facets[0].element = "rank";
  const { html, report } = fix({ template });
  assert.ok(html.includes(UNDRAWABLE));
  assert.match(report.join(" | "), /모르는 primitive element/);
});

// ------------------------------------------------ 렌더가 내는 것은 분석뷰뿐이다

test("렌더 결과에 도구가 덧붙인 것이 없다", () => {
  // 오른쪽 판은 앱이 그대로 가져다 쓸 분석뷰다. 뷰어의 표시가 따라가면 안 된다.
  //
  // **선을 다시 그었다** — 화면 **전체**에 걸리는 조작은 껍데기라 밖에 남고(focus·명단·
  // 상태 줄·샘플 고르기), **facet 에 걸리는 축**은 그 facet 이 무엇에 대한 값인지를
  // 말하므로 내용이라 안에 선다. 아래가 막는 것은 전자이고, 전자는 하나도 새지 않는다.
  const pages = [fix({ focus: "proposal-a" }).html,
                 ...sampleNames.map((name) => drawSample(sample(name)).html)];
  for (const html of pages) {
    for (const gone of [
      "<header", // 머리말 통째로
      'class="meta"', // 템플릿 id · subject 수 · focus 상태
      'class="roster"', 'class="chip', "no-values", "focus-badge", // 명단 chip 줄
      'class="legend"', // 범례
      '<span class="element"', // 제목 옆 primitive element 이름
      'class="toolbar"', 'class="doc"', // 오른쪽 띠와 설명서 페이지
    ]) {
      assert.ok(!html.includes(gone), gone);
    }
    const shown = textOf(html);
    for (const word of ["분석됨", "명단에 없다", "분석했지만 값이 없다", "값 한 벌이 아직 없다"]) {
      assert.ok(!shown.includes(word), word);
    }
    // primitive element 이름이 글로 찍히지 않는다. 구조(class·data 속성)로만 남는다.
    for (const element of Object.keys(ELEMENTS)) assert.ok(!html.includes(`>${element}<`), element);
    assert.ok(html.startsWith("<h1>")); // 남는 것은 템플릿 제목과 facet 들뿐

    // **밖의 것은 밖에 남는다.** focus·명단은 렌더가 낸 글에 조작으로 서지 않는다.
    for (const seat of drawSample(sample(sampleNames[0])).view.seats) {
      assert.ok(!html.includes(`data-focus="${seat.id}"`), "focus 조작이 분석뷰에 들어왔다");
    }
    assert.ok(!/data-(sample|subject|pane|page)=/.test(html), "도구 조작이 분석뷰에 들어왔다");
    // 누를 것은 **축의 선택자와 붙은 말을 닫는 것뿐**이다. 둘 다 그 자리의 내용이다.
    for (const [, tag] of html.matchAll(/(<button[^>]*>)/g)) {
      assert.ok(/data-option=|class="pop-close"/.test(tag), `분석뷰에 다른 단추가 섰다: ${tag}`);
    }
    for (const at of [...html.matchAll(/data-choice="/g)].map((m) => m.index)) {
      assert.ok(html.lastIndexOf("<section", at) > html.lastIndexOf("</section>", at),
        "축의 선택자가 facet 밖에 섰다");
    }
  }
});

test("걷어낸 것들은 화면 상태로 나가 뷰어가 바깥에 적는다", () => {
  const { view } = fix({ focus: "proposal-b" });
  assert.equal(view.focus, "proposal-b");
  assert.equal(view.focusMissing, null);
  assert.deepEqual(view.seats.map((s) => s.id), ["proposal-a", "proposal-b", "proposal-c"]);
});

test("primitive element 는 이름표가 아니라 구조로 남는다", () => {
  // **이름은 기본으로 보인다.** 켜고 끄는 것을 걷었다 — 설명서가 쪽마다 원소를 설명하므로
  // facet 마다 이름이 서면 둘이 이어지고, 「없으면 못 하는 일이 있는가」에 답이 「아니오」였다.
  // 그래도 **렌더가 낸 글은 그대로다** — CSS 가 data-element 를 읽어 붙인다.
  const { html } = fix();
  for (const facet of FIX.template.facets) {
    assert.ok(html.includes(`<h2 data-element="${facet.element}">`), facet.id);
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  assert.match(css, /\.viewport h2\[data-element\]::after \{ content:attr\(data-element\)/);
  // 켜는 길이 사라졌으므로 켜고 끄던 자리도 남아 있으면 안 된다.
  assert.ok(!css.includes(".show-elements"), "켜고 끄던 자리가 남았다");
  const app = fs.readFileSync(path.join(ROOT, "viewer/app.mjs"), "utf-8");
  assert.ok(!app.includes("showElements"), "앱이 아직 켜고 끈다");
});

// ---------------------------------------------------------------- 값 상태

test("채워진 값이 표시 단위로 그려진다", () => {
  // focus 를 따라 바뀌는 쪽은 고른 subject 의 값이 나온다.
  const a = textOf(fix({ focus: "proposal-a" }).html);
  for (const piece of ["87,400원", "240개월", "100세", "15세 ~ 65세", "아니오", "2026-10-01"]) {
    assert.ok(a.includes(piece), piece);
  }
  const c = textOf(fix({ focus: "proposal-c" }).html);
  for (const piece of ["62,000원", "120개월", "20세 이상", "예"]) {
    assert.ok(c.includes(piece), piece);
  }
});

test("subject 하나가 비면 자리가 남고 아무도 없으면 facet 이 빠진다", () => {
  // **선이 어디인지가 핵심이다.** 하나가 비는 것은 숨기지 않는다 — 숨기면 subject 마다
  // 골격이 달라져 견줄 수 없다. **전원이 비었을 때만** 빠진다: 견줄 것이 없으니 골격이
  // 달라질 일도 없고 남는 것은 빈 카드뿐이다.
  const { html } = renderView({ template: FIX.template, values: [FIX.empty] });
  const shown = textOf(html);
  for (const facet of FIX.template.facets) {
    assert.ok(shown.includes(facet.title), facet.id);
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }

  // 한쪽만 비었다 → 자리가 남고 표기가 말한다.
  const half = renderView({ template: FIX.template, values: [FIX.filled, FIX.empty] });
  for (const facet of FIX.template.facets) {
    assert.ok(half.html.includes(`element-${facet.element}`), `${facet.id}: 한쪽만 비었는데 빠졌다`);
  }
  assert.deepEqual(half.view.dropped, []);

  // **아무에게도 값이 없고 할 말도 없다 → 빠진다.** 말을 전부 걷어야 빈 카드가 된다.
  const bare = structuredClone(FIX.template);
  bare.facets = bare.facets.map((f) => ({ ...f, notes: [] }));
  const mute = [FIX.filled, FIX.empty].map((doc) => {
    const copy = structuredClone(doc);
    for (const facet of Object.values(copy.facets)) {
      delete facet.notes;
      for (const slot of Object.values(facet.fields)) {
        slot.state = "empty";
        delete slot.value;
        delete slot.notes;
      }
    }
    return copy;
  });
  const gone = renderView({ template: bare, values: mute });
  assert.equal(gone.html.match(/<section/g), null, `빈 카드가 남았다: ${gone.html.slice(0, 200)}`);
  assert.deepEqual(gone.view.dropped, bare.facets.map((f) => f.id));

  // **말이 붙어 있으면 선다.** 「이 제안서엔 이 항목이 없습니다」가 적힌 카드는 빈 카드가 아니다 —
  // 전부 빈 값 한 벌이 「아직 채우지 않았다」를 말하는 길이 그것이다.
  const said = structuredClone(mute);
  said[0].facets[bare.facets[0].id].notes = [{ kind: "caution", text: "아직 값을 채우지 않았습니다." }];
  const kept = renderView({ template: bare, values: said });
  assert.ok(kept.html.includes(`element-${bare.facets[0].element}`), "말이 붙었는데 빠졌다");
  assert.deepEqual(kept.view.dropped, bare.facets.slice(1).map((f) => f.id));

  // subject 가 하나도 없으면 이 규칙을 쓰지 않는다 — 템플릿만으로 골격을 보는 자리다.
  const skeleton = renderView({ template: bare, values: [] });
  for (const facet of bare.facets) assert.ok(skeleton.html.includes(`element-${facet.element}`), facet.id);
  // 화면에는 **표기**가 서고 뜻은 이름표가 갖는다 — 빈 칸으로 두면 깨진 것과 구별되지 않는다.
  assert.ok(shown.includes(NO_VALUE_MARK), `값이 설 자리에 표기가 없다: ${shown.slice(0, 120)}`);
  assert.ok(spokenOf(html).includes(NO_VALUE), "읽어 주는 기계에 말이 남지 않았다");
});

test("못 그린 사실은 남고 범례는 서지 않는다", () => {
  // **범위를 좁혔다.** 선 끝에 이름이 붙으므로 축 아래에 못 그린 subject 를 줄줄이 적으면
  // 그것이 범례다. **고른 subject 가 못 섰을 때만** 그 사실을 말한다 — 지금 보고 있는 것에
  // 값이 없으면 알아야 하고, 안 보고 있는 것까지 적을 까닭은 없다.
  // (정본 「값이 없으면 facet 이 그 사실을 말한다」는 이 범위로 지켜진다.)
  const values = structuredClone(FIX.values);
  values[2].facets["premium-by-age"].fields["premium-curve"] = { state: "empty" };
  const off = (part) => [...part.matchAll(/<div class="offs">[\s\S]*?<\/div>/g)].map((m) => m[0]).join("");

  // 고른 것에 선이 없다 → 말한다. 함께 못 그린 다른 subject 는 조용히 빠진다.
  const mine = sectionOf(fix({ values, focus: "proposal-b" }).html, "line");
  assert.ok(off(mine).includes(NO_VALUE), "고른 subject 가 못 선 사실이 사라졌다");
  for (const name of ["proposal-c", "가 제안서", "나 제안서"]) {
    assert.ok(!off(mine).includes(name), `축 아래에 이름이 선다 — 범례다: ${name}`);
  }
  // 고른 것에 선이 있다 → 축 아래는 비어 있다. 못 그린 둘을 적으면 그것이 범례다.
  const drawn = sectionOf(fix({ values, focus: "proposal-a" }).html, "line");
  assert.equal(off(drawn), "", `고른 것이 그려졌는데 축 아래에 줄이 선다: ${off(drawn)}`);
  // 선 끝의 이름은 그대로다 — 누가 누구인지는 거기서 읽는다.
  assert.match(drawn, /<text class="series-label[^"]*"[^>]*>가 제안서</, "선 끝의 이름이 사라졌다");
  // rows(overlay) 는 축 아래 줄을 두지 않는다. 칸이 「값 없음」이라고 말한다.
  const listPart = sectionOf(fix({ values, focus: "proposal-b" }).html, "rows", 0);
  assert.ok(!listPart.includes('class="offs"'), "rows(overlay) 에 문장 줄이 남아 있다");
  assert.ok(spokenOf(listPart).includes(NO_VALUE), "칸이 말해야 한다");
});

test("없다는 말이 뜻마다 다르게 선다", () => {
  // **표기는 「모른다」 하나뿐이고 아는 사실은 글이 말한다.** 뭉개면 「모른다」와
  // 「읽었고 없다」가 같아지고, 「그리지 못한다」가 조용해진다 — 그건 값의 문제가 아니라
  // 템플릿과 값이 어긋난 신호다.
  const words = [NO_VALUE, NO_ITEM, NO_ITEMS, UNDRAWABLE];
  assert.equal(new Set(words).size, words.length, `없다는 말이 겹친다: ${words}`);
  assert.match(NO_VALUE_MARK, /^\S$/, `표기가 글자 하나가 아니다: ${NO_VALUE_MARK}`);

  // **표기는 「모른다」 하나뿐이다.** 아는 사실은 글이 말한다 — 표기 둘을 눈으로 가르려다
  // 쓰다 만 글자처럼 보이느니, 아는 것은 말하게 두는 편이 낫다.
  const list = sectionOf(fix({ focus: "proposal-a" }).html, "rows", 0);
  const marks = [...list.matchAll(/<span class="miss[^"]*"([^>]*)>([^<]*)<\/span>/g)];
  const spoken = marks.filter((m) => /role="img"/.test(m[1]));
  assert.ok(spoken.length > 0, "모른다는 자리가 표에 있어야 한다");
  for (const [, attrs, glyph] of spoken) {
    assert.equal(glyph, NO_VALUE_MARK, "표기가 여럿이다");
    assert.equal(attrs.match(/aria-label="([^"]*)"/)?.[1], NO_VALUE, "표기가 다른 뜻을 지고 있다");
  }
  // **읽었고 그 항목이 없다는 것은 아는 사실**이라 글로 선다. 「모른다」와 여전히 갈린다.
  assert.ok(textOf(list).includes(NO_ITEM), "읽었고 없다는 말이 사라졌다");
  assert.ok(marks.some((m) => !/role="img"/.test(m[1]) && m[2].trim() === NO_ITEM));

  // **빈 칸으로 두지 않는다.** 아무것도 없으면 렌더가 깨진 것과 구별되지 않는다.
  // **읽어 주는 기계에는 말이 남는다** — 표기마다 이름표가 제 뜻을 글로 갖는다.
  for (const element of Object.keys(ELEMENTS)) {
    const part = sectionOf(fix({ focus: "proposal-b" }).html, element);
    for (const [, attrs, glyph] of part.matchAll(/<span class="miss[^"]*"([^>]*)>([^<]*)<\/span>/g)) {
      assert.ok(glyph.trim(), `${element}: 표기가 비어 있다`);
      if (!/role="img"/.test(attrs)) {
        assert.ok(words.includes(glyph.trim()), `${element}: 모르는 말이 섰다 — ${glyph}`);
        continue; // 아는 사실은 글로 선다
      }
      assert.equal(attrs.match(/aria-label="([^"]*)"/)?.[1], NO_VALUE, `${element}: 표기에 뜻이 없다`);
      assert.match(attrs, /title="/, `${element}: 가리켜도 뜻이 안 나온다`);
    }
  }

  // **「그리지 못한다」는 표기로 줄지 않는다.** 조용해지면 안 되는 자리다.
  const broken = structuredClone(FIX.values);
  broken[0].facets["contract-terms"].fields["entry-age"] = { state: "filled", value: 30 }; // range 인데 수
  const part = sectionOf(fix({ values: broken, focus: "proposal-a" }).html, "facts");
  const at = part.indexOf('class="undrawable"');
  assert.ok(at > 0 && textOf(part).includes(UNDRAWABLE), "어긋남이 조용해졌다");
  // 글이 서고 **무엇이 어긋났는지 적는다.** 여는 태그가 아니라 눈에 보이는 글을 잰다 —
  // 태그를 재면 title 속성만으로 길이가 차서 까닭이 사라져도 통과한다.
  const said = part.slice(part.indexOf(">", at) + 1, part.indexOf("</span>", at));
  assert.ok(!said.includes(NO_VALUE_MARK), `어긋남을 표기로 뭉갠다: ${said}`);
  // 글 뒤에 **무엇이** 어긋났는지가 붙고, 가리키면 **왜**가 나온다. 둘 다 있어야 한다.
  assert.match(said, new RegExp(`^${UNDRAWABLE}: \\S`), `무엇이 어긋났는지 적지 않는다: ${said}`);
  const why = part.slice(at, part.indexOf(">", at)).match(/title="([^"]*)"/)?.[1] ?? "";
  assert.ok(why && why !== said, `왜 어긋났는지 적지 않는다: ${why}`);
});

test("빈 목록은 값이 없는 것과 다르다", () => {
  const shown = textOf(renderView({ template: FIX.template, values: [FIX.mixed] }).html);
  assert.ok(shown.includes(NO_ITEMS));
  assert.notEqual(NO_ITEMS, NO_VALUE);
});

test("골격은 subject 가 하나일 때와 여럿일 때 같다", () => {
  const one = textOf(renderView({ template: FIX.template, values: [FIX.filled] }).html);
  const many = textOf(fix().html);
  for (const facet of FIX.template.facets) {
    assert.ok(one.includes(facet.title), facet.id);
    assert.ok(many.includes(facet.title), facet.id);
    for (const field of facet.fields) {
      assert.ok(one.includes(field.label), field.key);
      assert.ok(many.includes(field.label), field.key);
    }
  }
});

test("subject 가 하나여도 primitive element 가 다 선다", () => {
  const { html } = renderView({ template: FIX.template, values: [FIX.filled] });
  for (const element of Object.keys(ELEMENTS)) assert.ok(html.includes(`element-${element}`), element);
});

// ------------------------------------ 값 한 벌 없는 subject 라는 것은 없다

test("자리는 값 한 벌이 정한다 — 명단을 따로 받지 않는다", () => {
  // subject 마다 값 한 벌이 정확히 하나. 「값 한 벌이 없는 subject」라는 개념이 사라졌다.
  const { view } = fix();
  assert.deepEqual(view.seats.map((s) => s.id), FIX.values.map((v) => v.subjectId));
  for (const seat of view.seats) assert.ok(!("analysed" in seat), "분석 여부라는 자리가 없다");
  // 명단을 넘겨도 렌더가 받지 않는다.
  const meddled = renderView({
    template: FIX.template, values: FIX.values, subjects: [{ id: "proposal-z", label: "없는 자리" }],
  });
  assert.equal(meddled.html, fix().html, "명단은 렌더 인자가 아니다");
  assert.ok(!meddled.html.includes("없는 자리"));
});

test("렌더 결과에 아직 분석 중이라는 상태가 없다", () => {
  const pages = [fix().html, ...sampleNames.map((name) => drawSample(sample(name)).html)];
  for (const html of pages) {
    assert.ok(!html.includes("아직 분석 중"), "미분석 상태가 되살아났다");
    assert.ok(!html.includes("unanalyz"), "미분석 표시가 되살아났다");
    assert.ok(!html.includes("seat-note"));
  }
});

test("고르는 자리는 값을 바꾸고 골격은 바꾸지 않는다", () => {
  // 고르는 자리가 있는 샘플로 본다 — 말로만 설명하면 실제로 도는지 아무도 안 본다.
  // **타는 facet 과 안 타는 facet 이 둘 다 있는 샘플로 본다** — 전부 타는 것으로 보면
  // 「안 타는 facet 에는 안 선다」가 빈 반복문이 되어 초록으로 지나간다.
  const name = sampleNames.find((one) => {
    const t = sample(one).template;
    if (!t.choices?.length) return false;
    const rides = (f) => f.fields.some((d) => d.choice);
    return t.facets.some(rides) && t.facets.some((f) => !rides(f));
  });
  assert.ok(name, "타는 facet 과 안 타는 facet 이 함께 있는 샘플이 없다");
  const { template, values } = sample(name);
  const pick = template.choices[0];
  const options = pick.options.map((one) => one.id);
  assert.ok(options.length >= 2, "고를 것 하나는 고르는 것이 아니다");

  const draw = (option) =>
    renderView({ template, values, focus: values[0].subjectId, choices: { [pick.id]: option } });
  const shots = options.map(draw);

  // **골격은 그대로다.** 어떤 facet 이 어떤 element 로 어떤 차례에 서는지가 달라지지 않는다.
  const bones = (html) => [...html.matchAll(/class="facet element-([a-z]+)"/g)].map((m) => m[1]).join(",");
  const titles = (html) => [...html.matchAll(/<h2 data-element="[^"]*">([^<]*)<\/h2>/g)].map((m) => m[1]).join(",");
  for (const shot of shots) {
    assert.equal(bones(shot.html), bones(shots[0].html), "축이 facet 구성을 바꾼다");
    assert.equal(titles(shot.html), titles(shots[0].html), "축이 facet 차례를 바꾼다");
  }
  // **값은 바뀐다.** 안 바뀌면 고르는 자리가 하는 일이 없다.
  // **선택자 자체를 걷고 본다** — 눌린 표시(aria-pressed)만 달라도 그림이 달라 보인다.
  const bodyOnly = (html) => html.replace(/<div class="choice"[\s\S]*?<\/div>/g, "");
  assert.ok(new Set(shots.map((one) => bodyOnly(one.html))).size > 1, "골라도 값이 그대로다");
  // 타지 않는 필드는 무엇을 골라도 같은 값이다.
  const steady = template.facets
    .flatMap((f) => f.fields.filter((d) => !d.choice).map((d) => ({ facet: f, decl: d })))
    .find(({ decl }) => decl.shape === "single");
  assert.ok(steady, "안 타는 필드도 있어야 무엇이 바뀌는지 보인다");
  const slot = values[0].facets[steady.facet.id].fields[steady.decl.key];
  assert.ok(!("byOption" in slot), "안 타는 필드가 고를 것마다 쪼개져 있다");
  const said = formatScalar(steady.decl.type, slot.value);
  for (const shot of shots) assert.ok(textOf(shot.html).includes(said), "안 타는 값이 고른 것을 탄다");

  // **없는 id 거나 안 주면 첫 option 이다.** 빈 화면을 내지 않는다 — focus 와 같은 규칙이다.
  assert.equal(draw("아무개").view.chosen[pick.id], options[0]);
  assert.equal(renderView({ template, values, focus: values[0].subjectId }).view.chosen[pick.id], options[0]);
  assert.equal(draw("아무개").html, shots[0].html);
  assert.deepEqual(draw(null).view.choices, template.choices);

  // **여럿 선언할 수 있다.** 자리마다 따로 골라지고 서로 섞이지 않는다.
  const two = structuredClone(template);
  two.choices = [...two.choices, { id: "spare", label: "또 하나", options: [{ id: "x", label: "엑스" }, { id: "y", label: "와이" }] }];
  const twice = renderView({ template: two, values, focus: values[0].subjectId, choices: { spare: "y" } });
  assert.deepEqual(twice.view.chosen, { [pick.id]: options[0], spare: "y" });

  // **고르는 자리가 없는 템플릿이 기본이다.** 지금 있는 샘플과 소비자가 그대로 돈다.
  for (const other of sampleNames.filter((one) => !sample(one).template.choices)) {
    const plain = drawSample(sample(other));
    assert.deepEqual(plain.view.chosen, {}, `${other}: 선언이 없는데 고른 것이 생겼다`);
    assert.deepEqual(plain.view.choices, [], other);
    // **인자가 자리를 만들지 못한다.** 무엇을 고를 수 있는지는 템플릿만 말한다 —
    // 그림뿐 아니라 **화면 상태**까지 그대로여야 한다.
    const pushed = renderView({ ...sample(other), choices: { 아무개: "아무거나" } });
    assert.equal(pushed.html, plain.html, `${other}: 선언이 없는데 인자가 그림을 바꾼다`);
    assert.deepEqual(pushed.view.choices, [], `${other}: 인자가 고를 자리를 만들었다`);
    assert.deepEqual(pushed.view.chosen, {}, `${other}: 인자가 고른 것을 만들었다`);
  }

  // **축은 facet 안에 선다.** 그 facet 이 무엇에 대한 값인지를 말하므로 내용이다.
  // 타는 facet **마다** 제 선택자를 낸다 — 첫 것에만 두면 나머지가 까닭 없이 바뀌고
  // facet 차례가 뜻을 지게 된다.
  const riding = template.facets.filter((f) => f.fields.some((d) => d.choice === pick.id));
  assert.ok(riding.length >= 1, "타는 facet 이 있어야 한다");
  // **element 로 찾지 않는다** — 같은 element 를 쓰는 facet 이 둘이면 엉뚱한 쪽을 본다.
  const partOf = (html, facet) => {
    const at = html.indexOf(`>${facet.title}<`);
    assert.ok(at > 0, `${facet.id}: 제목이 없다`);
    const from = html.lastIndexOf("<section", at);
    return html.slice(from, html.indexOf("</section>", from));
  };
  for (const shot of shots) {
    const slots = [...shot.html.matchAll(new RegExp(`data-choice="${pick.id}"`, "g"))];
    assert.equal(slots.length, riding.length, "타는 facet 마다 하나씩 서야 한다");
    // **한 자리에 눌린 것은 하나다.** 전부 눌린 것으로 보이면 무엇을 고른 줄 모른다.
    for (const one of shot.html.match(/<div class="choice"[\s\S]*?<\/div>/g) ?? []) {
      assert.equal((one.match(/aria-pressed="true"/g) ?? []).length, 1,
        `한 자리에 눌린 것이 하나가 아니다: ${one.slice(0, 100)}`);
    }
    for (const facet of riding) {
      assert.ok(partOf(shot.html, facet).includes(`data-choice="${pick.id}"`), `${facet.id}: 선택자가 없다`);
    }
    // **안 타는 facet 에는 서지 않는다.** 하나라도 있어야 가를 수 있다.
    const idle = template.facets.filter((f) => !riding.includes(f));
    assert.ok(idle.length > 0, "안 타는 facet 이 있어야 가를 수 있다");
    for (const facet of idle) {
      assert.ok(!partOf(shot.html, facet).includes("data-choice"), `${facet.id}: 안 타는데 섰다`);
    }
  }
  // **한 번 고르면 전부 따라온다.** 축이 이름으로 선언되고 facet 이 그 이름을 타기 때문이다.
  if (riding.length >= 2) {
    const moved = draw(options[1]);
    for (const facet of riding) {
      assert.match(partOf(moved.html, facet),
        new RegExp(`data-option="${options[1]}" aria-pressed="true"`), `${facet.id}: 안 따라왔다`);
    }
  }
  // **한 facet 에 한 자리는 한 번 선다.** 필드 둘이 같은 자리를 타도 선택자는 하나다 —
  // 고정 케이스에 그런 facet 이 없으니 여기서 만들어 본다.
  {
    const twice = structuredClone(FIX.template);
    twice.choices = [{ id: "case", label: "갈래",
      options: [{ id: "one", label: "하나" }, { id: "two", label: "둘" }] }];
    const many = twice.facets.find((f) => f.fields.length >= 2);
    assert.ok(many, "필드 둘인 facet 이 있어야 같은 자리를 두 번 타게 해 볼 수 있다");
    for (const decl of many.fields.slice(0, 2)) decl.choice = "case";
    const html = renderView({ template: twice, values: [], choices: { case: "one" } }).html;
    assert.equal((html.match(/data-choice=/g) ?? []).length, 1, "한 자리가 여러 번 섰다");
  }

  // **모양은 여전히 말하지 않는다.** 고를 것과 고른 것을 자리로 낼 뿐이다.
  // **이름을 본다** — `<table>` 안의 tab 같은 것에 걸리면 판정이 헛돈다.
  const named = new Set();
  for (const [, value] of shots[0].html.matchAll(/class="([^"]*)"/g)) {
    for (const one of value.split(/\s+/)) named.add(one.toLowerCase());
  }
  for (const [, key] of shots[0].html.matchAll(/\b(data-[a-z-]+)=/g)) named.add(key.toLowerCase());
  for (const bad of ["chip", "dropdown", "segment", "tab", "pill", "toggle", "data-widget"]) {
    assert.ok(!named.has(bad), `모양을 말한다: ${bad}`);
  }
  assert.ok(named.has("choice") && named.has("data-choice") && named.has("data-option"));
});

test("렌더 인자는 값이 말할 수 없는 것뿐이다", () => {
  // 지키려던 것은 「하나」가 아니라 **「값 한 벌이 이미 아는 것은 인자가 아니다」**다.
  // 명단은 값 한 벌들이 갖고 있어 뺐고, focus 와 직전 focus 는 **앱만 아는 상호작용
  // 이력**이라 값에서 유도할 수가 없다. 그것이 여기 설 수 있는 유일한 자격이다.
  const args = read("schema/weave-render-args.schema.json");
  assert.deepEqual(Object.keys(args.properties), ["focus", "previousFocus", "choices"]);
  assert.equal(args.additionalProperties, false);
  assert.ok(!("$defs" in args), "자리(Seat) 정의가 남아 있다");
  // **고를 수 있는 것은 여기 서지 않는다.** 명단도 갈래 목록도 이미 다른 곳이 안다.
  assert.ok(!("subjects" in args.properties));
  assert.ok("choices" in read("schema/weave-template.schema.json").properties,
    "고를 것의 목록이 템플릿에 없다 — 그러면 subject 마다 골격이 달라진다");
  // subject 를 가리키는 둘은 같은 규칙이다 — id 이거나 null 이다.
  for (const name of ["focus", "previousFocus"]) {
    assert.deepEqual(args.properties[name].anyOf.map((one) => Object.keys(one)[0]), ["$ref", "type"]);
    assert.equal(args.properties[name].anyOf[1].type, "null");
  }

  const view = (extra) => renderView({ template: FIX.template, values: FIX.values, ...extra }).view;
  assert.equal(view({ focus: "proposal-a", previousFocus: "proposal-b" }).prior, "proposal-b");
  // **없는 id 면 그 상태만 사라진다** — focus 와 같은 규칙이다.
  assert.equal(view({ focus: "proposal-a", previousFocus: "아무개" }).prior, null);
  assert.equal(view({ focus: "proposal-a", previousFocus: "아무개" }).focus, "proposal-a");
  // **현재와 같으면 직전이 없는 것으로 본다.** 직전이 현재와 같을 수는 없다.
  assert.equal(view({ focus: "proposal-a", previousFocus: "proposal-a" }).prior, null);
  assert.equal(view({ focus: null, previousFocus: null }).prior, null);
  // 주지 않아도 그려진다 — 기존 부르는 쪽이 그대로 돈다.
  assert.equal(view({ focus: "proposal-a" }).prior, null);
});

test("전부 빈 값 한 벌이 「아직 안 채웠다」의 자리를 이어받는다", () => {
  // 아직 채우지 않았다는 것을 구조가 아니라 **빈 값과 주석**이 말한다.
  const said = "아직 값을 채우지 않았습니다.";
  const blank = structuredClone(FIX.empty);
  for (const facet of Object.values(blank.facets)) facet.notes = [{ kind: "caution", text: said }];
  const { html } = renderView({ template: FIX.template, values: [FIX.filled, blank] });
  const shown = textOf(html);

  for (const facet of FIX.template.facets) {
    assert.ok(shown.includes(facet.title), facet.id); // 골격은 그대로
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }
  // **facet 마다** 그 subject 가 이 자리에 못 섰다는 것이 남는다. 조용히 사라지면 안 된다.
  // 말하는 법은 둘이다 — 「값 없음」이라는 말이 서거나, **이름이 흐리게 남거나.**
  const mine = renderView({ template: FIX.template, values: [FIX.filled, blank], focus: blank.subjectId });
  for (const facet of FIX.template.facets) {
    const part = sectionOfFacet(mine.html, facet);
    const said = spokenOf(part).includes(NO_VALUE);
    const stood = part.includes('class="off ') && textOf(part).includes(blank.subjectLabel);
    assert.ok(said || stood, `${facet.id}: 못 선 사실이 사라졌다`);
  }
  // 겹치는 쪽은 **그 subject 를 골랐을 때** 축 아래가 못 섰다고 말한다.
  assert.match(mine.html, /class="offs"/);
  // 주석이 이유를 facet 마다 말한다. 고르는 쪽은 **그리는 subject 의 말만** 내므로 그 subject 를 골라 센다.
  const mineSaid = textOf(
    renderView({ template: FIX.template, values: [FIX.filled, blank], focus: blank.subjectId }).html,
  );
  assert.equal((mineSaid.match(new RegExp(said, "g")) ?? []).length, FIX.template.facets.length);
  // 옆자리는 멀쩡히 채워진다 — 「여럿 중 하나가 거의 비어 있다」는 조합이 그대로 산다
  assert.ok(shown.includes("87,400원"));
});

test("값 한 벌이 하나도 없으면 골격만 남는다", () => {
  const { html, view } = renderView({ template: FIX.template, values: [] });
  const shown = textOf(html);
  assert.deepEqual(view.seats, []);
  for (const facet of FIX.template.facets) assert.ok(shown.includes(facet.title), facet.id);
});

test("subject 가 하나도 없어도 원소마다 제 자리가 선다", () => {
  // **골격이 섰다는 것으로는 모자란다.** 제목만 보면 원소 안이 텅 빈 채로도 통과한다.
  // 여기서는 원소 일곱이 각자 「여기에 무엇이 올지」를 그리는지를 하나씩 본다.
  const { html } = renderView({ template: FIX.template, values: [] });
  const byId = Object.fromEntries(FIX.template.facets.map((f) => [f.element, f]));
  assert.equal(Object.keys(byId).length, Object.keys(ELEMENTS).length, "fixture 가 원소 전부를 써야 한다");
  const at = (element) => sectionOf(html, element);
  // rows 는 facet 이 둘이다(compare: overlay 인 riders · compare: focus 인 payments) —
  // element 만으로는 갈리지 않아 facet id 로 짚는다.
  const byFacetId = Object.fromEntries(FIX.template.facets.map((f) => [f.id, f]));
  const slots = (part) => (part.match(/class="slot[ "]/g) ?? []).length;

  // 공통 — **가짜 값도 표기도 쓰지 않는다.** `—` 는 「어떤 subject 의 값을 모른다」는 말인데
  // 여기엔 모를 subject 자체가 없다. 「없음」류의 글도 아직 할 말이 아니다.
  assert.ok(!html.includes(NO_VALUE_MARK), "모른다는 표기가 섰다 — 모를 subject 가 없는 자리다");
  // **자리의 모양이 값의 생김새를 따른다.** 릴 수는 타입마다 고정이라 자릿수가 크기를 말하지 않는다.
  const shapeOf = (part, type) => {
    const m = part.match(new RegExp(`<span class="slot[^"]*" data-slot="[^"]*"[^>]*>([\\s\\S]*?)</span>`));
    assert.ok(m, `${type}: 자리가 없다`);
    return m[1];
  };
  assert.equal((shapeOf(at("stat"), "stat").match(/<i><\/i>/g) ?? []).length, 6, "금액 자리는 여섯 칸이다");
  assert.match(at("stat"), /class="slot slot-big" data-slot="num"/, "큰 수 자리가 수의 모양이 아니다");
  assert.match(at("stat"), /class="slot-unit">원</, "금액이 올 자리인 것이 안 읽힌다");

  for (const said of [NO_VALUE, NO_ITEM, NO_ITEMS, UNDRAWABLE]) {
    assert.ok(!textOf(html).includes(said), `아직 할 말이 아니다: ${said}`);
  }
  // **자리의 모양이 값의 생김새를 따른다.** 밑줄 하나가 아니라 수가 설 칸·글줄·자·축이다.
  // 움직임은 여기 없다 — 아래 「움직임은 뷰어가 얹는다」가 그 선을 따로 본다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  // **밑그림이 실제로 그려진다.** 칸에 면이 없으면 자리가 아니라 빈 공백이다.
  assert.match(css, /\.slot i[^{]*\{[^}]*background:var\(--bed\)/, "칸이 모양을 안 갖고 있다");
  // **칸의 폭은 타입이 정한다.** 값에서 오면 그 폭이 곧 크기를 말한다.
  assert.match(css, /\.slot\[data-slot="num"\] i \{[^}]*width:[\d.]+em/, "수 칸의 폭이 없다");
  assert.match(css, /\.slot\[data-slot="text"\] i \{[^}]*width:[\d.]+em/, "글줄의 폭이 없다");

  // stat — 수 하나가 크게 설 자리를 그 크기 그대로 비운다.
  assert.match(at("stat"), /class="big"/);
  assert.equal(slots(at("stat")), 1, "stat 은 자리 하나다");
  assert.ok(textOf(at("stat")).includes(byId.stat.fields[0].label), "stat 의 이름이 빠졌다");

  // facts — **사용자가 선언한 줄이 전부 선다.** 그 줄들이 이 facet 의 내용이다.
  const factLines = byId.facts.fields;
  assert.ok(factLines.length >= 3, "줄이 여럿이어야 「전부 선다」가 재진다");
  for (const f of factLines) assert.ok(textOf(at("facts")).includes(f.label ?? f.key), f.key);
  assert.equal(slots(at("facts")), factLines.length, "줄 수와 자리 수가 다르다");

  // bars — 빈 자가 선다. 길이 0 의 막대를 그리는 것이 아니라 **채우지 않은 자**를 둔다.
  const barFields = byId.bars.fields;
  assert.ok(barFields.length >= 2, "막대가 여럿이어야 한다");
  assert.equal((at("bars").match(/class="track"/g) ?? []).length, barFields.length);
  assert.ok(!/class="fill"/.test(at("bars")), "막대를 그렸다 — 가짜 값이다");
  for (const f of barFields) assert.ok(textOf(at("bars")).includes(f.label ?? f.key), f.key);

  // line — **축만 남는다.** 눈금을 지어내면 그것이 가짜 값이다.
  // **그림 안만 본다** — 표시 아이콘도 `<path>` 라 facet 째로 재면 판정이 헛돈다.
  const chart = at("line").match(/<svg class="line"[\s\S]*?<\/svg>/)?.[0];
  assert.ok(chart, "선이 설 자리가 없다");
  assert.equal((chart.match(/class="axis"/g) ?? []).length, 2, "축 둘만 선다");
  // **눈금도 수도 없다.** 축에 숫자가 서는 순간 그 모양이 값이 된다 — 그림 안에 글자가 없다.
  for (const drawn of ["<circle", "series-label", "class=\"tick", "<text"]) {
    assert.ok(!chart.includes(drawn), `선 위에 무언가 그렸다: ${drawn}`);
  }
  assert.ok(!/>[^<]*[0-9][^<]*</.test(chart), "그림 안에 수가 섰다");
  // **꺾은선을 그리지 않는다.** 고정된 꺾은선 하나는 눈금이 없어도 **추세로 읽힌다** —
  // 「오르는 중」은 눈금이 없어도 값이다. 이 자리는 어떤 추세로도 읽히면 안 된다.
  for (const drawn of ["<polyline", "<path", "<polygon"]) {
    assert.ok(!chart.includes(drawn), `그림 자리에 선을 그렸다 — 추세로 읽힌다: ${drawn}`);
  }
  // 남는 것은 **그림이 들어올 면** 하나다. 면은 어떤 추세도 말하지 않는다.
  const plots = [...chart.matchAll(/<rect class="plot"[^>]*>/g)];
  assert.equal(plots.length, 1, `그림 자리가 하나가 아니다: ${plots.length}`);
  // 그 면은 **축 안쪽**이다 — 자에서 나온 수라 밖으로 새지 않는다.
  const boxOf = (tag) => Object.fromEntries(
    [...tag.matchAll(/\b(x|y|width|height)="([\d.]+)"/g)].map((m) => [m[1], Number(m[2])]));
  const plot = boxOf(plots[0][0]);
  const view = chart.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).slice(1).map(Number);
  assert.ok(plot.x > 0 && plot.y > 0, "그림 자리가 축 밖에서 시작한다");
  assert.ok(plot.x + plot.width < view[0] && plot.y + plot.height < view[1], "그림 자리가 자를 넘는다");
  // **빛줄기는 그 면 위만 지나간다.** 상자를 가리키는 수는 산출물의 자에서 나온다 —
  // 스타일시트가 좌표를 따로 가지면 둘이 어긋나 빛줄기가 면 밖으로 샌다.
  const blank = at("line").match(/<div class="chart-blank">[\s\S]*?<\/div>/)[0];
  const box = blank.match(/<span class="sheen"[^>]*style="([^"]*)"/)[1];
  const said = Object.fromEntries(box.split(";").map((one) => one.split(":")).map(([k, v]) => [k, v]));
  const near = (got, want, name) =>
    assert.ok(Math.abs(Number(got.replace("%", "")) - want) < 0.01, `${name}: ${got} (${want}% 여야)`);
  near(said.left, (plot.x / view[0]) * 100, "빛줄기 상자의 왼쪽");
  near(said.top, (plot.y / view[1]) * 100, "빛줄기 상자의 위");
  near(said.right, ((view[0] - plot.x - plot.width) / view[0]) * 100, "빛줄기 상자의 오른쪽");
  near(said.bottom, ((view[1] - plot.y - plot.height) / view[1]) * 100, "빛줄기 상자의 아래");
  // 그 상자가 그림과 **같은 폭**이 아니면 백분율이 딴 곳을 가리킨다.
  const widths = [...css.matchAll(/([^{}]*)\{([^}]*min-width:(\d+)px[^}]*)\}/g)]
    .filter(([, sel]) => /svg\.line|\.chart-blank/.test(sel));
  assert.equal(widths.length, 1, `그림과 자리 상자의 폭이 따로 적혔다: ${widths.length}`);
  for (const one of ["svg.line", ".chart-blank"]) {
    assert.ok(widths[0][1].split(",").map((x) => x.trim()).includes(one), `${one} 의 폭이 빠졌다`);
  }

  // rows(overlay, riders) — 열은 subject 가 만든다. 키 열만 서고 그 옆이 「제안서가 오면 여기」라는 자리다.
  const items = sectionOf(html, "rows", 0);
  assert.match(items, /table class="items"/);
  const keyColumn = byFacetId.riders.fields[0].columns[0];
  assert.ok(textOf(items).includes(keyColumn.label ?? keyColumn.key), "키 열 이름이 빠졌다");
  assert.equal((items.match(/<tbody>[\s\S]*?<\/tbody>/)[0].match(/<tr>/g) ?? []).length, 1);
  for (const name of Object.values(NAMES)) assert.ok(!items.includes(name), `이름을 지어냈다: ${name}`);

  // rows(focus, payments) — **열 머리가 전부 선다.** 열은 템플릿이 선언한 것이라 subject 없이도 안다.
  const table = sectionOf(html, "rows", 1);
  const columns = byFacetId.payments.fields[0].columns;
  assert.ok(columns.length >= 2, "열이 여럿이어야 한다");
  for (const c of columns) assert.ok(textOf(table).includes(c.label ?? c.key), c.key);
  assert.equal(slots(table), columns.length, "빈 줄이 열 수만큼 서야 한다");

  // parts — 빈 띠가 자리를 말한다. 조각 이름은 값이 갖고 오는 것이라 지어내지 않는다.
  const band = at("parts");
  assert.match(band, /class="band"/);
  assert.ok(!/class="slice"/.test(band), "조각을 그렸다 — 가짜 값이다");
  assert.ok(!/class="slice-row"/.test(band), "조각 이름을 지어냈다");
});

test("움직임은 뷰어가 얹는다 — 산출물에는 한 글자도 없다", () => {
  // **막아야 하는 것은 산출물에 움직임이 들어가는 것**이지 뷰어가 움직이는 것이 아니다.
  // 렌더는 자리 표식만 내고 스타일시트가 그것을 굴린다. 그래야 앱이 제 방식을 얹을 수 있다.
  const drawn = [
    renderView({ template: FIX.template, values: [] }).html, // subject 0
    fix().html, // 값이 있는 보통 화면
    ...sampleNames.map((n) => drawSample(sample(n), { values: [] }).html),
  ];
  // 시간 · 프레임 · 애니메이션 지시 · 그것을 태울 스크립트. SVG 쪽(SMIL)까지 함께 막는다.
  const banned = [
    "animation", "@keyframes", "transition", "<animate", "dur=", "begin=", "repeatCount",
    "keyTimes", "steps(", "requestAnimationFrame", "setInterval", "setTimeout", "<style", "style=\"--",
  ];
  for (const html of drawn) {
    for (const one of banned) {
      assert.ok(!html.includes(one), `산출물에 움직임이 들어왔다: ${one}`);
    }
  }
  // 표식은 있어야 한다 — 없으면 뷰어가 움직일 것이 없고 위 판정은 공짜로 통과한다.
  const zero = drawn[0];
  assert.match(zero, /class="slot[ "]/, "밑그림 표식이 없다");
  // **빛줄기는 밑그림마다 하나씩 선다.** 한 갈래만 빠져도 그 자리만 멎어 있고, 그러면
  // 움직임이 하나라는 말이 거짓이 된다 — 수를 세어 맞춘다.
  const count = (re) => (zero.match(re) ?? []).length;
  const beds = {
    "자리": count(/class="slot[ "]/g), "자": count(/class="track"/g),
    "띠": count(/class="band"/g), "그림 자리": count(/class="chart-blank"/g),
  };
  for (const [what, many] of Object.entries(beds)) {
    assert.ok(many >= 1, `밑그림 갈래를 못 찾았다 — 판정이 헛돈다: ${what}`);
  }
  assert.equal(count(/class="sheen"/g), Object.values(beds).reduce((a, b) => a + b, 0),
    `빛줄기가 밑그림마다 하나씩 서지 않는다: ${JSON.stringify(beds)}`);

  // **움직이는 쪽은 스타일시트 하나뿐이다.** 앱 스크립트가 몰래 움직이면 그것도 산출물의 움직임이다.
  const app = fs.readFileSync(path.join(ROOT, "viewer/app.mjs"), "utf-8");
  for (const one of ["requestAnimationFrame", "setInterval", "@keyframes", "animate("]) {
    assert.ok(!app.includes(one), `앱이 굴린다: ${one}`);
  }
});

test("읽을 수 있는 정지 숫자를 두지 않는다", () => {
  // **0원은 이 도메인에서 진짜 값이다** — 미보장이 0원이다. 정지한 회색 0 은 값으로 오독된다.
  // 그래서 **빈 자리에 숫자를 한 글자도 두지 않는다** — 산출물에도 스타일시트에도.
  const html = renderView({ template: FIX.template, values: [] }).html;
  // 자리마다 빛줄기가 **마지막에 하나** 선다 — 그 앞이 자리의 밑그림 전부다.
  const inSlots = [...html.matchAll(
    /<span class="slot[^"]*"[^>]*>([\s\S]*?)<span class="sheen"[^>]*><\/span><\/span>/g)];
  assert.equal(inSlots.length, (html.match(/class="slot[ "]/g) ?? []).length,
    "빛줄기가 자리의 끝에 서지 않는 자리가 있다");
  for (const [, inside] of inSlots) {
    assert.ok(!/[0-9]/.test(inside), `자리에 숫자가 박혀 있다: ${inside.slice(0, 60)}`);
    // 칸과 단위 말고는 아무것도 없다 — 흐린 더미 값이 끼어들 틈을 남기지 않는다.
    const left = inside.replace(/<i><\/i>/g, "")
      .replace(/<b class="slot-unit">[^<]*<\/b>/g, "").trim();
    assert.equal(left, "", `자리에 다른 것이 들었다: ${left.slice(0, 60)}`);
  }
  // 단위는 값이 아니다. 숫자가 없으므로 정지해 있어도 값으로 읽히지 않는다.
  assert.match(html, /class="slot-unit">개월</, "기간 자리가 기간인 줄 모른다");

  // **산출물이 도메인을 모른다.** 자리에 적히는 말과 표기는 렌더가 스스로 내는 글이라
  // 값에서 오지 않는다 — 여기에 보험 말이 섞이면 다른 상품군에서 다시 못 쓴다(규칙 1).
  // 주석은 보지 않는다. 주석은 보기를 들 수 있고 화면으로 나가지 않는다.
  const source = fs.readFileSync(path.join(ROOT, "viewer/render.mjs"), "utf-8");
  const said = [...source.matchAll(/\bslot\(\s*"([^"]*)"/g)].map((m) => m[1])
    .concat([NO_VALUE, NO_ITEM, NO_ITEMS, UNDRAWABLE, NO_VALUE_MARK]);
  assert.ok(said.length >= 4, "렌더가 스스로 내는 글을 못 찾았다 — 판정이 헛돈다");
  for (const word of ["보험", "제안서", "담보", "약관", "설계안", "가입"]) {
    for (const one of said) assert.ok(!one.includes(word), `산출물에 도메인 말이 섰다: ${one}`);
  }

  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  // **스타일시트도 글자를 내지 않는다.** 예전에는 숫자를 내는 규칙이 하나 있었고, 그것이
  // 멈출 때 사라지는지를 재야 했다. 이제 내는 규칙이 **하나도 없으므로** 잴 것이 없다 —
  // 걷은 판정보다 좁지 않다: 0개는 「도는 하나」보다 강한 조건이다.
  const printed = [...css.matchAll(/([^{}]*)\{([^}]*)\}/g)]
    .filter(([, , body]) => /content:\s*"[^"]+"/.test(body))
    .map(([, sel]) => sel.trim());
  assert.deepEqual(printed, [], `스타일시트가 빈 자리에 글자를 낸다: ${printed.join(" · ")}`);
});

test("움직임을 끈 사람에게도 자리가 선다", () => {
  // **이 자리의 조건이 뒤집혔다.** 예전에는 움직이던 것이 **사라져야** 했다 — 멈춘 릴에
  // 숫자가, 멈춘 줄에 임의의 길이가 남으면 그것이 읽을 수 있는 값이었기 때문이다.
  // 지금 밑그림에는 읽힐 것이 없으므로(숫자도 글자도 꺾은선도 없다) 남아도 안전하고,
  // 오히려 **사라지면 안 된다** — 자리가 통째로 사라지면 「여기에 무엇이 온다」가 없어진다.
  // 그래서 조용한 자리가 멎게 하는 것은 **빛줄기뿐**이다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const quietStart = bare.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.ok(quietStart >= 0, "움직임을 끈 사람을 위한 자리가 없다");
  // **`@media` 껍데기 하나만 벗긴다.** 끝까지 탐욕스럽게 물면 그 뒤의 규칙까지 조용한 자리로
  // 읽혀, 「멎는 것은 빛줄기뿐」이 엉뚱한 것을 가리킨다.
  const media = bare.slice(quietStart).match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/)[0];
  const quietBody = media.match(/\{([\s\S]*?)\n\}/)[1];
  const quietRules = [...quietBody.matchAll(/([^{}]*)\{([^}]*)\}/g)]
    .map(([, sel, rule]) => [sel.trim(), rule.trim()]);
  assert.ok(quietRules.length >= 1, "조용한 자리에 규칙이 없다 — 판정이 헛돈다");

  // 1. **움직이는 자리는 전부 멎는다.** 어느 하나가 계속 돌면 끈 사람에게 그것만 움직인다.
  const moving = [...bare.slice(0, quietStart).matchAll(/([^{}]*)\{([^}]*)\}/g)]
    .filter(([, , rule]) => /animation:[^;]*infinite/.test(rule))
    .map(([, sel]) => sel.trim());
  assert.ok(moving.length >= 1, "움직이는 자리를 못 찾았다 — 판정이 헛돈다");
  for (const one of moving) {
    const off = quietRules.some(([sel, rule]) =>
      /animation:none|display:none/.test(rule)
      && sel.split(",").map((x) => x.trim()).includes(one));
    assert.ok(off, `조용한 자리에 움직이던 것이 남았다: ${one}`);
  }

  // 2. **멎는 것은 빛줄기뿐이다.** 조용한 자리의 규칙이 빛줄기 말고 다른 것을 건드리면
  //    밑그림이 함께 사라진다 — 예전 판정이 그것을 요구했고, 지금은 그것이 결함이다.
  for (const [sel] of quietRules) {
    for (const one of sel.split(",").map((x) => x.trim())) {
      assert.match(one, /^\.sheen(::before)?$/, `조용한 자리가 빛줄기 말고 다른 것을 건드린다: ${one}`);
    }
  }

  // 3. **밑그림을 내는 규칙은 조용한 자리 밖에 있다.** 안으로 들어가면 그것은 끈 사람에게만
  //    서는 자리이고, 켠 사람의 화면에서는 사라진다.
  const outside = bare.replace(media, "");
  for (const [sel, must] of [
    [".slot i", /background:var\(--bed\)/],
    [".track > .sheen", /background:var\(--bed\)/],
    [".band > .sheen", /background:var\(--bed\)/],
    ["svg.line .plot", /fill:var\(--bed\)/],
    [".track", /background:var\(--surface\)/],
    [".band", /background:var\(--surface\)/],
  ]) {
    const rule = [...outside.matchAll(/([^{}]*)\{([^}]*)\}/g)]
      .find(([, name, body]) => name.split(",").map((x) => x.trim()).includes(sel) && must.test(body));
    assert.ok(rule, `밑그림이 조용한 자리 밖에 없다: ${sel}`);
  }

  // 4. 모양을 내는 것은 산출물 쪽(칸 수 · 단위 · 자 · 축 · 그림 자리)이라 그대로 선다.
  const html = renderView({ template: FIX.template, values: [] }).html;
  assert.match(html, /data-slot="num"/);
  assert.match(html, /class="track"/);
  assert.match(html, /class="axis"/);
  assert.match(html, /class="plot"/);
  assert.match(html, /class="band"/);
});

test("빈 자리의 움직임은 빛줄기 하나다", () => {
  // **일관은 박자로 맞추는 것이 아니라 효과를 하나로 줄여서 얻는다.** 슬롯이 돌고 줄이
  // 찍히고 선이 변형되던 세 움직임은 속도를 맞춰도 한 벌로 안 읽혔다. 이제 하나뿐이다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...bare.matchAll(/([^{}]*)\{([^}]*)\}/g)].map(([, sel, body]) => [sel.trim(), body]);

  // 1. **움직이는 규칙이 하나뿐이다.** 둘이 되는 순간 자리마다 다른 움직임이 생긴다.
  const moving = rules.filter(([, body]) => /animation:[^;n]/.test(body)).map(([sel]) => sel);
  assert.deepEqual(moving, [".sheen::before"], `움직임이 하나가 아니다: ${moving.join(" · ")}`);
  // 시간표도 하나뿐이다 — 두 번째가 생기면 그것이 다른 움직임이다.
  const frames = [...bare.matchAll(/@keyframes\s+([A-Za-z-]+)/g)].map((m) => m[1]);
  assert.deepEqual(frames, ["sheen"], `시간표가 여럿이다: ${frames.join(" · ")}`);

  // 2. **속도는 변수 하나에서만 나온다.** 인스턴스가 흔들 길을 막는다.
  const timed = rules.filter(([, body]) => /animation(-duration)?:/.test(body) && !/animation:none/.test(body));
  for (const [sel, body] of timed) {
    const said = body.match(/animation(?:-duration)?:\s*([^;]+)/)[1];
    assert.match(said, /var\(--sheen\)/, `속도가 그 변수에서 안 나온다: ${sel} — ${said}`);
  }
  const declared = rules.filter(([, body]) => /--sheen\s*:/.test(body)).map(([sel]) => sel);
  assert.equal(declared.length, 1, `속도를 적는 자리가 여럿이다: ${declared.join(" · ")}`);
  assert.equal(declared[0], ":root", `속도가 뿌리 밖에서 나온다: ${declared[0]}`);
  const span = rules.filter(([, body]) => /--sheen-span\s*:/.test(body)).map(([sel]) => sel);
  assert.deepEqual(span, [":root"], `거리를 적는 자리가 여럿이다: ${span.join(" · ")}`);

  // 3. **위상을 어긋내지 않는다.** 전부 같이 움직이는 것이 한 벌로 읽히는 까닭이다 —
  //    자리마다 시작점을 달리 주면 다시 여러 움직임이 된다.
  for (const [sel, body] of rules) {
    assert.ok(!/animation-delay/.test(body), `시작점을 어긋냈다: ${sel}`);
    assert.ok(!/--phase/.test(body), `위상 변수가 남아 있다: ${sel}`);
  }
  assert.ok(!/nth-child[^{]*\{[^}]*animation/.test(bare), "차례마다 움직임을 달리 준다");

  // 4. **같은 방향·같은 거리.** 한 바퀴가 `--sheen-span` 만큼만 나아가므로 자리가 넓든 좁든
  //    초당 같은 거리를 간다. 폭에 맞춰 늘이면(`100%`) 넓은 자리가 더 빨라 보이고 그것이 강조다.
  const sheen = bare.match(/@keyframes sheen \{([\s\S]*?)\n\}/);
  assert.ok(sheen, "빛줄기의 시간표가 없다");
  const steps = [...sheen[1].matchAll(/(from|to|[\d.]+%)\s*\{([^}]*)\}/g)].map(([, at, rule]) => [at, rule]);
  assert.equal(steps.length, 2, `빛줄기가 한 번에 지나가지 않는다: ${steps.length}`);
  for (const [at, rule] of steps) {
    assert.match(rule, /transform:translateX\(/, `transform 말고 다른 것을 움직인다: ${at}`);
    assert.ok(!/%/.test(rule.replace(/[\d.]+%\s*\{/, "")), `거리가 자리 폭에서 나온다: ${at} — ${rule}`);
  }
  assert.match(steps[0][1], /var\(--sheen-span\) \* -1/, "왼쪽 밖에서 들어오지 않는다");
  assert.match(steps[1][1], /translateX\(0\)/, "한 주기만큼만 밀리지 않는다 — 이음매가 생긴다");
  // 무늬가 그 거리마다 되풀이돼야 이음매가 없다.
  const band = rules.find(([sel]) => sel === ".sheen::before")[1];
  assert.match(band, /background-size:var\(--sheen-span\) 100%/, "무늬 주기가 미는 거리와 다르다");
  assert.match(band, /background-repeat:repeat-x/, "무늬가 되풀이되지 않는다");

  // 5. **세기도 하나다.** 빛줄기의 색이 한 곳에서만 나오고 무채색이다.
  const lit = [...bare.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => m[1]);
  assert.equal(lit.length, 1, `빛줄기 말고 다른 반투명이 있다: ${lit.join(" · ")}`);
  const channels = lit[0].split(",").slice(0, 3).map((x) => Number(x.trim()));
  assert.equal(new Set(channels).size, 1, `빛줄기가 색을 갖는다: ${lit[0]}`);
});

test("그림 자리가 추세로 읽히지 않는다", () => {
  // **눈금이 없어도 「오르는 중」은 값이다.** 고정된 꺾은선 하나는 추세로 읽히고, 추세는
  // 그 subject 에 대한 말이다. 그래서 자리에는 축과 **면**만 선다.
  const chart = renderView({ template: FIX.template, values: [] }).html
    .match(/<svg class="line"[\s\S]*?<\/svg>/)[0];
  for (const drawn of ["<polyline", "<path", "<polygon", "<circle", "<text"]) {
    assert.ok(!chart.includes(drawn), `그림 자리에 무언가 그렸다: ${drawn}`);
  }
  // 남는 것은 축 둘과 면 하나다. 면은 오르지도 내리지도 않는다.
  assert.equal((chart.match(/<line class="axis"/g) ?? []).length, 2, "축 둘만 선다");
  assert.equal((chart.match(/<rect class="plot"/g) ?? []).length, 1, "그림 자리가 하나가 아니다");
  assert.equal((chart.match(/<(line|rect|circle|path|polyline|polygon|text)\b/g) ?? []).length, 3,
    "그림 자리에 그린 것이 셋을 넘는다");

  // **스타일시트가 그림의 좌표를 한 수도 갖지 않는다.** 예전에는 꺾은선 좌표를 옮겨 적고
  //  둘이 갈리지 않았는지를 쟀다. 이제 옮겨 적을 것 자체가 없어야 한다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  for (const [, sel, body] of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    if (!/svg\.line|\.plot|\.chart/.test(sel)) continue;
    assert.ok(!/\bd:|points:|path\(/.test(body), `스타일시트가 그림의 좌표를 갖는다: ${sel.trim()}`);
  }
  // 값이 있는 그림은 그대로다 — 자리만 바뀌었지 그리는 법이 바뀐 것이 아니다.
  const drawn = fix().html.match(/<svg class="line"[\s\S]*?<\/svg>/)[0];
  assert.match(drawn, /<polyline/, "값이 있는 그림이 선을 안 그린다");
  assert.match(drawn, /class="tick/, "값이 있는 그림에 눈금이 없다");
});

test("subject 0 에서도 고르는 자리는 서고 focus 는 가리킬 것이 없어도 안 무너진다", () => {
  // **축은 값이 아니라 템플릿의 것이다.** 아직 아무도 없어도 「무엇으로 볼지」는 고를 수 있어야
  // 그 facet 에 무엇이 올지가 읽힌다.
  const axed = structuredClone(FIX.template);
  axed.choices = [{ id: "term", label: "기간",
    options: [{ id: "y10", label: "10년" }, { id: "y20", label: "20년" }] }];
  for (const facet of axed.facets) facet.fields[0].choice = "term";
  const html = renderView({ template: axed, values: [], choices: { term: "y20" } }).html;
  assert.equal((html.match(/data-choice="term"/g) ?? []).length, axed.facets.length,
    "facet 마다 선택자가 서야 한다");
  assert.match(html, /data-option="y20" aria-pressed="true"/);
  // 고른 것을 바꿔도 골격은 그대로다 — 아직 바뀔 값이 없다.
  const other = renderView({ template: axed, values: [], choices: { term: "y10" } }).html;
  assert.equal((other.match(/class="slot[ "]/g) ?? []).length, (html.match(/class="slot[ "]/g) ?? []).length);

  // **focus 는 가리킬 것이 없다.** 없는 subject 를 가리켜도 자리는 그대로 선다.
  const lost = renderView({ template: FIX.template, values: [], focus: "nobody", previousFocus: "nobody2" });
  assert.deepEqual(lost.view.seats, []);
  assert.ok(!lost.html.includes("is-focus"), "가리킬 것이 없는데 표시가 붙었다");
  assert.equal(lost.html, renderView({ template: FIX.template, values: [] }).html);
});

// ---------------------------------------------------------------- focus

/** focus 표시가 붙은 자리에서 읽히는 subject 이름. 겹친 화면에서 어느 것이 무엇인지 가르는 자리다. */
function focusedNames(html) {
  const all = FIX.values.map((v) => v.subjectLabel ?? v.subjectId).concat("아직 안 본 제안서");
  const hits = new Set();
  // 글을 담는 태그만 본다. circle·line 같은 자기닫힘 표시를 섞으면 옆 이름까지 삼킨다.
  for (const m of html.matchAll(/<(text|th|td|span|b)[^>]*class="[^"]*is-focus[^"]*"[^>]*>([\s\S]*?)<\/\1>/g)) {
    for (const name of all) if (m[2].includes(name)) hits.add(name);
  }
  return hits;
}

test("focus 가 null 이면 아무것도 강조하지 않는다", () => {
  assert.ok(!fix({ focus: null }).html.includes("is-focus"));
  assert.ok(!renderView({ template: FIX.template, values: FIX.values }).html.includes("is-focus"));
});

test("focus 는 그 subject 하나만 잡는다", () => {
  const { html } = fix({ focus: "proposal-a" });
  assert.ok(html.includes("is-focus"));
  assert.deepEqual(focusedNames(html), new Set(["가 제안서"]));

  // 표에서는 **열 선언**이 잡는다 — 이름표가 아니라 자리를 가리켜 열이 통째로 잡힌다.
  const list = sectionOf(html, "rows", 0); // riders — compare: overlay
  const cols = [...list.matchAll(/<col( class="is-focus")?>/g)].map((m) => Boolean(m[1]));
  assert.equal(cols.length, FIX.values.length + 1, "열 선언이 열 수와 맞지 않는다");
  assert.deepEqual(cols, [false, true, false, false], "고른 열 하나만 잡아야 한다");
  assert.ok(!/<t[hd][^>]*is-focus/.test(list), "칸마다 따로 잡아 열 안에 가로선이 생긴다");
});

test("거의 비어 있는 subject 도 focus 가 된다", () => {
  const { html, view } = fix({ focus: "proposal-b" });
  assert.equal(view.focus, "proposal-b");
  // 값이 거의 없어 이름이 설 자리가 적다. 그래도 **표의 열 선언**이 어느 자리인지 잡는다.
  const cols = [...sectionOf(html, "rows", 0).matchAll(/<col( class="is-focus")?>/g)].map((m) => Boolean(m[1]));
  const seat = FIX.values.findIndex((doc) => doc.subjectId === "proposal-b");
  assert.deepEqual(cols, cols.map((_, i) => i === seat + 1), `고른 자리를 잡지 못한다: ${cols}`);
  // 이름이 서는 자리에서는 고른 것 하나만 잡힌다.
  const named = focusedNames(html);
  assert.ok(named.size === 0 || [...named].every((name) => name === "나 제안서"), [...named].join(" / "));
});

test("없는 id 면 focus 만 사라진다", () => {
  const missing = fix({ focus: "proposal-zzz" });
  const released = fix({ focus: null });
  assert.ok(!missing.html.includes("is-focus"));
  // 분석뷰가 focus 를 놓은 것과 **통째로 같다**. 안내 문구도 렌더에 섞이지 않는다.
  assert.equal(missing.html, released.html);
  assert.ok(!missing.html.includes("proposal-zzz"));
  // 그 사실은 화면 상태로 나가 오른쪽 띠가 적는다. 결함이 아니므로 report 에 넣지 않는다.
  assert.equal(missing.view.focusMissing, "proposal-zzz");
  assert.equal(released.view.focusMissing, null);
  assert.deepEqual(missing.report, released.report);
});

// ---------------------------------------------------------------- 주석

test("주석 네 갈래가 각각 보인다", () => {
  const { html } = fix();
  for (const kind of ["quote", "tip", "note", "caution"]) assert.match(html, new RegExp(`note-${kind}`));
});

test("필드에 붙은 말은 표시를 세워 그 자리에서 연다", () => {
  // 감추는 만큼 잃는 것이 있으므로 **붙어 있다는 것 자체는 감춰지지 않는다.**
  const { html } = fix({ focus: "proposal-a" });
  const said = "합계보험료 87,400원 (보장보험료 87,400원 / 적립보험료 0원)";
  const mark = html.match(/<span class="note-mark"[\s\S]*?<\/span><\/span>/)?.[0] ?? "";
  assert.ok(mark.includes('tabindex="0"') && mark.includes('role="button"'), "키보드로 닿아야 한다");
  assert.ok(mark.includes('class="note-pop"'), "내용이 그 안에서 열려야 한다");

  // **표시는 하나이고 중립이다.** 값 옆에 서는 것은 「붙은 말이 있다」 하나뿐이고,
  // 갈래를 따라 달라지지 않는다 — 달라지면 값이 갈래로 물든다.
  const badge = mark.slice(0, mark.indexOf('<span class="note-pop"'));
  assert.equal((badge.match(/<svg/g) ?? []).length, 1, `값 옆에 표시가 여럿이다: ${badge}`);
  assert.ok(!/note-(quote|tip|note|caution)/.test(badge), `표시가 갈래를 입는다: ${badge}`);
  // **수를 적지 않는다.** 값 옆에 눈에 보이는 글은 하나도 없다 — 표시 하나뿐이다.
  assert.equal(textOf(badge).trim(), "", `값 옆에 글이 흐른다: ${textOf(badge)}`);
  // **갈래는 툴팁 안에서 산다** — 열면 줄마다 자기 갈래 표시와 이름을 갖는다.
  const notes = FIX.filled.facets["monthly-premium"].fields["premium"].notes;
  assert.ok(notes.length > 1, "고정 케이스에 말이 여럿 걸린 값이 있어야 한다");
  const pop = mark.slice(mark.indexOf('<span class="note-pop"'));
  for (const note of notes) {
    assert.ok(pop.includes(note.text), `툴팁에 ${note.text.slice(0, 12)} 가 없다`);
    assert.match(pop, new RegExp(`note-${note.kind}"`), `툴팁 줄이 ${note.kind} 갈래를 잃었다`);
  }
  // 말이 여럿 걸려도 값 옆은 표시 하나 그대로다 — 세는 것은 읽는 사람의 일이 아니다.
  const inside = badge.slice(badge.indexOf(">") + 1); // 표시 자체의 여는 태그를 뺀 안쪽
  assert.equal((inside.match(/<span/g) ?? []).length, 0, `표시 옆에 무언가 더 선다: ${inside}`);
  assert.ok(!/note-count/.test(fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8")));
  // 기계가 읽는 이름표에는 남는다 — 눈에 보이는 글이 아니다.
  assert.match(mark, new RegExp(`aria-label="붙은 말 ${notes.length}"`));

  // 표시가 갈래색을 받는 길이 CSS 에도 없다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  assert.ok(!/\.(note-mark|mark-icon)[^{]*\{[^}]*var\(--kind/.test(css), "표시가 갈래색을 받는다");

  // **자리가 뜻을 가른다** — 이름 옆은 hint(이 필드가 무엇인지), 값 옆은 그 값에 대한 말.
  // bars 에서 그 둘이 한 줄에 양끝으로 선다.
  const rows = sectionOf(html, "bars").split('<div class="bar-row">').slice(1);
  const marked = rows.filter((row) => row.includes("note-mark"));
  assert.ok(marked.length > 0, "고정 케이스에 말이 붙은 막대가 있어야 한다");
  for (const row of marked) {
    const label = row.slice(0, row.indexOf('<span class="track"'));
    const val = row.slice(row.indexOf('<span class="val">'));
    assert.ok(!/note-mark(?![^"]*hint-mark)/.test(label.replace(/hint-mark/g, "")) || label.includes("hint-mark"),
      `라벨 옆에 값 주석이 섰다: ${label}`);
    assert.ok(val.includes("note-mark"), `값 주석이 값 옆에 서지 않는다: ${row}`);
  }
  // 내용은 본문에 펼쳐지지 않고 표시 안에 있다.
  const at = html.indexOf(said);
  assert.ok(at > 0, "붙은 말이 있어야 한다");
  assert.ok(html.lastIndexOf('class="note-pop"', at) > html.lastIndexOf('class="body"', at),
    "필드에 붙은 말이 본문에 펼쳐져 있다");
  // **모든 element 가 같다.** 겹치는 쪽만 본문 아래에 펴면 그것이 subject 주석처럼
  // 읽혀 순서가 둘이 된다 — 그 자리를 여기서 막는다.
  let checkedFields = 0;
  for (const doc of FIX.values) {
    const page = fix({ focus: doc.subjectId }).html;
    for (const facet of FIX.template.facets) {
      const part = sectionOfFacet(page, facet);
      for (const decl of facet.fields) {
        for (const note of doc.facets?.[facet.id]?.fields?.[decl.key]?.notes ?? []) {
          const needle = note.text.slice(0, 14);
          // **등장하는 자리를 전부 본다.** 첫 자리만 보면 표시 안에 두고 본문에도 또 펴는 것을
          // 놓친다 — 그러면 화면에는 규칙이 둘인 채로 판정이 초록이다.
          let where = part.indexOf(needle);
          let seen = 0;
          while (where >= 0) {
            assert.ok(pops(part).some(([from, to]) => where > from && where < to),
              `${facet.id}/${decl.key}: 값에 붙은 말이 본문에 펼쳐져 있다`);
            seen += 1;
            where = part.indexOf(needle, where + 1);
          }
          if (seen) checkedFields += 1;
        }
      }
    }
  }

  assert.ok(checkedFields >= 3, `값에 붙은 말이 여러 element 에 있어야 가를 수 있다: ${checkedFields}`);

  // facet 에 붙은 것은 감추지 않는다 — 먼저 알아야 할 것이다.
  const head = sectionOf(html, "stat");
  const afterBody = head.slice(head.indexOf('class="body"'));
  assert.ok(textOf(afterBody).includes("적립보험료를 뺀 보장 보험료입니다."),
    "facet 에 붙은 말은 본문 뒤에 남아 있어야 한다");
});

test("아이콘은 lucide 실물을 옮겨 온 것이다", () => {
  const src = fs.readFileSync(path.join(ROOT, "viewer/icons.mjs"), "utf-8");
  assert.match(src, /lucide-static@\d+\.\d+\.\d+/, "어느 버전에서 왔는지 적혀 있어야 한다");
  assert.match(src, /ISC/, "라이선스 고지");
  // 갈래를 가리키는 것만 — 주석 갈래와 primitive element.
  assert.deepEqual(
    Object.keys(ICON).sort(),
    [...Object.keys(KIND_LABEL), ...Object.keys(ELEMENTS)].sort(),
  );
  // 심각도를 말하는 그림을 쓰지 않는다.
  // 도메인(돈·병원·서류) 그림은 여전히 안 된다.
  for (const banned of ["banknote", "coins", "wallet", "hospital", "stethoscope", "receipt"]) {
    assert.ok(!src.includes(banned), `도메인 아이콘: ${banned}`);
  }
  // 주석 갈래는 통용되는 UI 시맨틱을 따른다 — 사람이 준 예 그대로.
  assert.ok(src.includes("circle-alert"), "주의는 warning 의 통용 표시다");
  assert.ok(src.includes("`info`"), "보충은 info 의 통용 표시다");
});

test("주석 갈래를 정본 이름으로 부른다", () => {
  // glossary §2.4 — 인용·팁·보충·주의. 참조 뷰어는 언어를 배우는 자리라 딴 이름을 쓰지 않는다.
  assert.deepEqual(KIND_LABEL, { quote: "인용", tip: "팁", note: "보충", caution: "주의" });
  const kinds = read("schema/weave-common.schema.json").$defs.AnnotationKind.enum;
  assert.deepEqual(Object.keys(KIND_LABEL).sort(), [...kinds].sort());
  const shown = textOf(fix().html);
  for (const name of Object.values(KIND_LABEL)) assert.ok(shown.includes(` ${name} `), name);
});

test("말은 데이터 뒤에 한자리에 모인다", () => {
  // facet 제목 → 본문 → facet 주석 → subject 주석. 예외를 두지 않는다 —
  // 읽는 규칙이 둘이면 매번 어디 있는지 찾게 된다.
  // **모든 element 에서 같은지 본다.** 하나만 보면 「몇몇은 또 그렇지 않다」를 못 잡는다.
  // subject 도 옮겨 가며 본다 — 어느 조합에서도 규칙은 하나여야 한다.
  let checked = 0;
  for (const doc of FIX.values) {
    const html = fix({ focus: doc.subjectId }).html;
    for (const facet of FIX.template.facets) {
      if (!(facet.notes ?? []).length) continue;
      const part = sectionOfFacet(html, facet);
      const body = part.indexOf('class="body"');
      const said = part.indexOf('class="said"');
      assert.ok(body >= 0 && said > body, `${facet.id}: 말 묶음이 데이터보다 앞에 선다`);
      // **첫 등장**으로 본다 — 위아래 두 군데에 두면 규칙이 둘이 되는 것은 마찬가지다.
      const facetSaid = part.indexOf(facet.notes[0].text.slice(0, 12));
      assert.ok(facetSaid > 0, `${facet.id}: facet 에 붙은 말이 없다`);
      assert.ok(facetSaid > body, `${facet.id}: 말이 데이터보다 앞에도 선다`);
      // **subject 것이 facet 것보다 뒤에 선다.** 이름표를 뗐으므로 글로 찾는다 —
      // 표시(`<b class="who">`)로 찾으면 그것이 사라진 날 판정이 조용히 아무것도 안 본다.
      for (const note of doc.facets?.[facet.id]?.notes ?? []) {
        const at = part.indexOf(note.text.slice(0, 12));
        assert.ok(at > facetSaid, `${facet.id}/${doc.subjectId}: subject 것이 facet 것보다 앞에 선다`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0, "고정 케이스에 subject 주석이 있어야 순서를 가를 수 있다");
  // 묶음을 **띠나 상자로 두르지 않는다.** 가르는 것은 두 묶음 사이의 짧은 선 하나뿐이다 —
  // 묶음 자체에는 테두리가 붙지 않는다.
  const sheet = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  for (const [, selector, body] of sheet.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = selector.trim();
    if (!/\.said\b/.test(sel) || sel.includes(".said-cut")) continue;
    assert.ok(!/border|background/.test(body), `말 묶음에 띠나 면을 두른다: ${sel} { ${body} }`);
  }
});

test("짧은 선은 두 묶음 사이에만 선다", () => {
  // 이름이 가르는 것을 **거드는** 구조선이다. 위계를 꾸미는 장식이 아니라 자리를 나눈다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const cut = css.match(/\.said-cut \{([^}]*)\}/)?.[1] ?? "";
  assert.ok(cut, "선 규칙이 없다");
  // **짧다.** 판을 가로지르지 않는다.
  const width = cut.match(/width:([^;]+);/)?.[1].trim();
  assert.ok(width && !/^(100%|auto)$/.test(width), `선이 판을 가로지른다: ${width}`);
  // 무채색이고 갈래 색을 받지 않는다.
  assert.ok(!/var\(--kind|var\(--subject/.test(cut), "선이 갈래·subject 색을 받는다");
  assert.match(cut, /border-top:[^;]*var\(--line\)/);
  // **세로 리듬을 깨지 않는다** — 앞뒤 간격은 다른 줄과 같은 자(`--row`)로 재어진다.
  assert.match(cut, /margin:0/);
  assert.match(css.match(/\.said \{([^}]*)\}/)[1], /gap:var\(--row\)/);

  // **두 묶음이 다 있을 때만 선다.** 가를 것이 없는데 선만 서면 안 된다.
  for (const doc of FIX.values) {
    const html = fix({ focus: doc.subjectId }).html;
    for (const facet of FIX.template.facets) {
      const part = sectionOfFacet(html, facet);
      const ours = (facet.notes ?? []).length > 0;
      const yours = (doc.facets?.[facet.id]?.notes ?? []).length > 0;
      const at = part.indexOf('class="said"');
      const cutAt = part.indexOf('class="said-cut"');
      assert.equal(cutAt >= 0, ours && yours,
        `${facet.id}/${doc.subjectId}: 선이 ${ours && yours ? "빠졌다" : "홀로 섰다"}`);
      if (cutAt < 0) continue;
      // 선은 그 둘 **사이**다. facet 것 뒤이고 subject 것 앞이다.
      // **이름표가 사라졌으므로 가르는 것은 이 선뿐이다** — 글로 찾는다.
      assert.ok(cutAt > at, "선이 말 묶음 밖에 있다");
      assert.ok(cutAt > part.indexOf(facet.notes[0].text.slice(0, 12)), "선이 facet 것보다 앞에 선다");
      const said = doc.facets[facet.id].notes[0].text.slice(0, 12);
      assert.ok(cutAt < part.indexOf(said, at), "선이 subject 것보다 뒤에 선다");
    }
  }
  // **이름표가 아니라 이 선이 가른다.** 이름은 늘 고른 subject 것이라 그 사실을 두 번 말한다.
  // (되돌리려면 `notesHtml` 의 둘째 인자에 이름을 다시 주면 된다.)
  for (const doc of FIX.values) {
    for (const part of [...fix({ focus: doc.subjectId }).html.matchAll(/<div class="said">[\s\S]*?<\/div>/g)]) {
      assert.ok(!part[0].includes('<b class="who">'), `말 묶음에 이름표가 섰다: ${part[0].slice(0, 120)}`);
    }
  }
  // 다른 자리에 선을 늘리지 않았다 — 이 선은 말 묶음 안에서만 산다.
  assert.equal((fix().html.match(/said-cut/g) ?? []).length,
    (fix().html.match(/<hr/g) ?? []).length, "말 묶음 밖에 선이 섰다");
});

test("subject 의 말은 언제나 고른 subject 것이다", () => {
  // **규칙이 하나다.** 겹쳐 그리든 하나만 그리든, 아래에 서는 subject 의 말은 고른 것뿐이다.
  // element 로 갈리지 않으므로 모든 element 에서 같은 것을 본다.
  //
  // 판정이 실제로 무언가를 보는지부터 — 고정 케이스에 subject 마다 facet 주석이 있어야
  // 「남의 말이 빠졌는지」를 물을 수 있다. (없으면 빈 반복문이 초록으로 지나간다.)
  const mineOf = (doc, facetId) => (doc.facets?.[facetId]?.notes ?? []).map((n) => n.text);
  for (const facetId of ["contract-terms", "riders"]) {
    const owners = FIX.values.filter((doc) => mineOf(doc, facetId).length > 0);
    assert.ok(owners.length >= 2, `${facetId}: subject 둘 이상이 말을 가져야 가를 수 있다`);
  }

  for (const facetId of ["contract-terms", "riders"]) {
    const element = FIX.template.facets.find((f) => f.id === facetId).element;
    for (const doc of FIX.values) {
      const part = sectionOf(fix({ focus: doc.subjectId }).html, element);
      for (const other of FIX.values) {
        const shown = mineOf(other, facetId).every((text) => textOf(part).includes(text));
        if (other.subjectId === doc.subjectId) {
          assert.ok(shown, `${element}/${doc.subjectId}: 고른 subject 의 말이 빠졌다`);
        } else {
          for (const text of mineOf(other, facetId)) {
            assert.ok(!textOf(part).includes(text),
              `${element}/${doc.subjectId}: 고르지 않은 ${other.subjectId} 의 말이 붙어 있다`);
          }
        }
      }
    }
  }

  // focus 가 없으면 첫 subject 다 — 화면이 그리는 것과 말이 여전히 맞는다.
  const none = sectionOf(fix({ focus: null }).html, "rows", 0); // riders — compare: overlay
  assert.ok(textOf(none).includes(mineOf(FIX.values[0], "riders")[0]), "첫 subject 의 말이 서야 한다");
  assert.ok(!textOf(none).includes(mineOf(FIX.values[2], "riders")[0]));

  // **값에 붙은 말을 본문 아래에 펴는 자리(line · rows(overlay))도 같은 규칙을 따른다.**
  // 여기가 감춰지지 않고 펴지는 유일한 자리라, 규칙이 갈리면 화면에서 바로 드러난다.
  const curve = "갱신 예상표를 그대로 옮겼습니다."; // proposal-a 의 premium-curve
  const riders = "특약 목록은 비어 있습니다."; // proposal-c 의 rider-list
  assert.ok(textOf(sectionOf(fix({ focus: "proposal-a" }).html, "line")).includes(curve));
  assert.ok(!textOf(sectionOf(fix({ focus: "proposal-c" }).html, "line")).includes(curve),
    "line: 고르지 않은 subject 의 값에 붙은 말이 펴져 있다");
  assert.ok(textOf(sectionOf(fix({ focus: "proposal-c" }).html, "rows", 0)).includes(riders));
  assert.ok(!textOf(sectionOf(fix({ focus: "proposal-a" }).html, "rows", 0)).includes(riders),
    "rows(overlay): 고르지 않은 subject 의 값에 붙은 말이 펴져 있다");

  // **facet 에 붙은 말은 그대로 전부 선다** — 그건 subject 의 것이 아니다.
  for (const doc of FIX.values) {
    const html = fix({ focus: doc.subjectId }).html;
    for (const facet of FIX.template.facets) {
      for (const note of facet.notes ?? []) {
        assert.ok(textOf(sectionOfFacet(html, facet)).includes(note.text),
          `${facet.id}/${doc.subjectId}: facet 에 붙은 말이 사라졌다`);
      }
    }
  }
});

test("값에 붙은 것과 facet 에 붙은 것이 모두 보인다", () => {
  const shown = textOf(fix().html);
  assert.ok(shown.includes("합계보험료 87,400원")); // 값에 붙은 것
  assert.ok(shown.includes("설계안 2쪽 계약사항 표에서 읽었습니다.")); // 값 한 벌의 facet 에 붙은 것
  assert.ok(shown.includes("계약의 뼈대가 되는 조건들입니다.")); // 템플릿 facet 에 붙은 것
});

test("템플릿 주석은 아직 채워진 subject 가 하나도 없어도 남는다", () => {
  const shown = textOf(renderView({ template: FIX.template, values: [] }).html);
  for (const facet of FIX.template.facets) {
    assert.ok(facet.notes?.length, `${facet.id}: fixture 가 템플릿 주석을 가져야 한다`);
    for (const note of facet.notes) assert.ok(shown.includes(note.text), note.text.slice(0, 20));
  }
});

// ---------------------------------------------------------------- 시각을 소유하지 않는다

test("평가를 시각으로 말하지 않는다", () => {
  // 좁힌 판정이다. 지키려는 것은 「무채색」이 아니라 **「평가를 색으로 말하지 않는다」**다.
  // 기계가 볼 수 있는 것만 여기 있다 — 「이 빨강이 나쁨을 뜻하는가」는 사람이 본다(AGENTS.md).
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");

  // **색이 나오는 자리는 둘뿐이다** — 주석 갈래(통용 시맨틱)와 선의 **상태**(지금·직전·나머지).
  // subject 팔레트는 걷었고 되살아나지 않는다: 상태 색은 id 도 차례도 보지 않는다.
  const byKind = [...css.matchAll(/\.note-([a-z]+)\s*\{\s*--kind:([^;]+);\s*\}/g)];
  const kindColors = new Set(
    byKind.map((m) => m[2].trim()).filter((v) => v.startsWith("#")).map((v) => v.toLowerCase()),
  );

  // 0. **색 있는 값이 설 수 있는 자리는 갈래·상태 선언뿐이다.** 다른 규칙은 무채색이거나
  //    var(--kind)·var(--trace) 를 거쳐야 한다 — 값·subject·facet 에 칠하는 길을 전부 막는다.
  //    상태 선언은 **닫힌 세 갈래**에만 선다. `.trace-<id>` 같은 것이 끼어들 수 없다.
  const isChromatic = (hex) => {
    const parts = hex.length <= 4
      ? [...hex].slice(0, 3).map((c) => c + c)
      : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
    return new Set(parts.map((x) => parseInt(x, 16))).size !== 1;
  };
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const hues = [...body.matchAll(/#([0-9a-fA-F]{3,8})\b/g)].map((m) => m[1]).filter(isChromatic);
    if (hues.length === 0) continue;
    assert.match(
      body.trim(),
      /^--(kind|trace):\s*#[0-9a-fA-F]{3,8};$/,
      `색을 직접 칠한다: ${selector.trim()} { ${body.trim()} }`,
    );
    if (!body.includes("--trace")) continue;
    const sel = selector.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    assert.ok(TRACE.map((name) => `.trace-${name}`).includes(sel),
      `상태가 아닌 것에 선 색을 준다: ${sel}`);
  }
  // 상태 선언은 렌더의 갈래와 이름이 그대로 같다 — 하나 더 끼워 넣을 자리가 없다.
  const traces = [...css.matchAll(/\.trace-([a-z]+)\s*\{\s*--trace:/g)].map((m) => m[1]);
  assert.deepEqual(traces, TRACE, "선 갈래 선언이 렌더의 갈래와 다르다");

  // 1. 갈래와 상태 말고는 색이 없다. 뼈대도 subject 도 무채색으로 남는다.
  const traceColors = new Set(
    [...css.matchAll(/\.trace-[a-z]+\s*\{\s*--trace:\s*(#[0-9a-fA-F]{3,8});\s*\}/g)]
      .map((m) => m[1].toLowerCase()),
  );
  const chromatic = [];
  for (const [, hex] of css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const pairs = hex.length <= 4
      ? [...hex].slice(0, 3).map((c) => c + c)
      : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
    if (new Set(pairs.map((p) => parseInt(p, 16))).size === 1) continue; // 무채색
    if (kindColors.has(`#${hex.toLowerCase()}`)) continue; // 주석 갈래의 통용색
    if (traceColors.has(`#${hex.toLowerCase()}`)) continue; // 선의 상태색
    chromatic.push(`#${hex}`);
  }
  for (const [, body] of css.matchAll(/rgba?\(([^)]+)\)/g)) {
    const channels = body.split(",").slice(0, 3).map((p) => Number(p.trim()));
    if (new Set(channels).size !== 1) chromatic.push(`rgb(${body})`);
  }
  assert.deepEqual(chromatic, [], `갈래·상태 밖의 색: ${chromatic.join(", ")}`);

  // 2. 값에 따라 달라지는 색이 없다. 렌더가 넣는 inline style 은 **길이뿐**이다.
  //    아직 아무도 없는 화면도 함께 본다 — 빈 자리의 상자도 자에서 나온 길이여야 한다.
  const styled = [
    fix({ focus: "proposal-a" }).html,
    renderView({ template: FIX.template, values: [] }).html,
    ...sampleNames.map((n) => drawSample(sample(n)).html),
  ];
  for (const html of styled) {
    for (const [, style] of html.matchAll(/style="([^"]*)"/g)) {
      for (const one of style.split(";")) {
        assert.match(one, /^(width|left|right|top|bottom):[\d.]+%$/, `값이 시각을 정한다: ${style}`);
      }
    }
  }

  // 3. **색은 갈래에서만 나온다.** 「주의가 빨갛다」와 「값이 작으면 빨갛다」를 가르는 선이 여기다.
  //    갈래는 통용되는 UI 시맨틱을 따르되(주의=warning · 보충=info), 그것은 **이 자리를 어떻게
  //    읽으라는 말**이지 그 제안서가 좋고 나쁘다는 말이 아니다.
  const kinds = read("schema/weave-common.schema.json").$defs.AnnotationKind.enum;
  assert.deepEqual(byKind.map((m) => m[1]), kinds, "갈래별 색이 스키마의 갈래와 다르다");
  // 갈래 색이 닿는 자리는 표시와 갈래 이름뿐이다 — 값이나 글은 물들이지 않는다.
  assert.match(css, /\.kind-icon \{[^}]*stroke:var\(--kind/);
  assert.ok(!/\.note \.text \{[^}]*var\(--kind/.test(css), "갈래 색이 글까지 물들인다");
  assert.ok(!/\.big \{[^}]*var\(--kind/.test(css) && !/\.val \{[^}]*var\(--kind/.test(css),
    "갈래 색이 값까지 물들인다");
  // 갈래가 모두 그려진다.
  const icons = [...fix().html.matchAll(/<svg class="kind-icon note-([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(icons)].sort(), [...kinds].sort());

  // 4. **혼자 서는 글이 없다.** 값에 매이지 않는 문장을 분석뷰가 내기 시작하면 그것이
  //    판정이다 — 순위를 문장으로 말하지 않기로 한 자리와 같다. 글이 설 수 있는 자리는
  //    정해져 있다: 제목 · facet 의 한 줄 · 필드의 한 줄 · 주석 줄 · 값.
  for (const page of [fix({ focus: "proposal-a" }).html, ...sampleNames.map((n) => drawSample(sample(n)).html)]) {
    for (const [, attrs] of page.matchAll(/<p\b([^>]*)>/g)) {
      assert.match(attrs, /class="(facet-hint|hint)"/, `분석뷰에 혼자 서는 글이 섰다: <p${attrs}>`);
    }
    assert.ok(!/<h[3-6]\b/.test(page), "분석뷰에 새 머리글이 섰다");
  }

  // 5. 순위·경고를 뜻하는 기호가 없다.
  const shown = fix({ focus: "proposal-a" }).html;
  for (const sign of ["⚠", "★", "☆", "▲", "!", "1위", "best", "worst"]) {
    assert.ok(!shown.includes(sign), `평가 기호: ${sign}`);
  }
});

test("subject 를 색으로 가르지 않는다", () => {
  // 「값이 색을 바꾸지 않는다」를 좁힌 자리다. 이제 **색이 아예 없다** —
  // subject 를 가르는 일은 이름과 무늬가 한다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  assert.ok(!/--subject/.test(css), "subject 색 변수가 남아 있다");
  assert.ok(!/\.sub-\d/.test(css), "subject 팔레트가 남아 있다");
  assert.ok(!/\.swatch/.test(css), "색 조각이 남아 있다");
  const { html, view } = fix({ focus: "proposal-b" });
  assert.ok(!/sub-\d|swatch/.test(html), "렌더가 subject 에 색을 붙인다");
  assert.ok(view.seats.every((s) => !("tone" in s)), "자리가 아직 색을 들고 있다");
  // 앱의 focus 단추도 이름만 세운다 — 색 조각을 앞에 두지 않는다.
  assert.ok(!/swatch/.test(fs.readFileSync(path.join(ROOT, "viewer/app.mjs"), "utf-8")));

  // 무엇이 대신 가르는지는 「선은 색이 아니라 점선 무늬로 갈린다」가 본다.

  // 차례는 여전히 값이 아니라 넘어온 순서다 — 자리가 우열이 아님을 지키던 신호다.
  const swapped = fix({ values: [FIX.mixed, FIX.empty, FIX.filled] });
  assert.deepEqual(swapped.view.seats.map((s) => s.id),
    [FIX.mixed, FIX.empty, FIX.filled].map((d) => d.subjectId));
});

test("세로 리듬이 자 셋에서만 나온다", () => {
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const rules = new Map();
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    rules.set(selector.trim().replace(/\s*\/\*[\s\S]*?\*\/\s*/g, "").trim(), body.trim());
  }
  // 1. **선은 두 facet 의 한가운데 선다.** 위 여백(앞 facet 의 아래)과 아래 여백이 같아야 한다.
  const pad = rules.get(".facet").match(/padding:([^;]+);/)[1].trim().split(/\s+/);
  assert.equal(pad.length >= 3 ? pad[2] : pad[0], pad[0],
    `divider 가 한가운데 서지 않는다: padding:${pad.join(" ")}`);

  // 2. **주석 줄 사이가 전부 같다.** 묶음 안이든 묶음과 묶음 사이든 한 자다.
  const gapOf = (sel) => (rules.get(sel)?.match(/gap:([^;]+);/) ?? [])[1]?.trim();
  assert.ok(gapOf(".notes"), "주석이 줄 간격을 자로 갖지 않는다");
  assert.equal(gapOf(".said"), gapOf(".notes"), "말 묶음 사이가 줄 사이와 다르다");
  // 묶음 사이만 따로 벌리면 간격이 둘이 된다 — 그 길을 막는다.
  for (const [selector, body] of rules) {
    if (!/\.notes\s*\+\s*\.notes|\.said[^,]*\.notes\s*\{?$/.test(selector)) continue;
    assert.ok(!/margin|padding/.test(body), `말 묶음 사이를 따로 벌린다: ${selector} { ${body} }`);
  }

  // 3. 자는 셋뿐이고 리듬을 정하는 자리는 그것만 쓴다.
  for (const token of ["--row", "--step", "--gap"]) {
    assert.match(css, new RegExp(`${token}:\\s*\\d`), `${token} 자가 없다`);
  }
  for (const sel of [".facet", ".body", ".said"]) {
    assert.match(rules.get(sel), /var\(--(row|step|gap)\)/, `${sel} 이 자를 쓰지 않는다`);
  }
});

test("bars 는 좁아져도 가로로 눕는다", () => {
  // 라벨 | 막대 | 값이 한 줄이다. 접어 올리면 막대가 라벨 아래로 내려가 세로로 읽힌다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const rule = (block, sel) => block.match(new RegExp(`${sel} \\{([^}]*)\\}`))?.[1] ?? "";
  for (const block of [css, css.slice(css.indexOf("@media (max-width: 900px)"))]) {
    assert.match(rule(block, "\\.bar-row"), /grid-template-columns:[^;]*1fr[^;]*(max-content|\d+px)/,
      "라벨·막대·값이 한 줄에 서지 않는다");
    assert.ok(!/\.bar-row \.val \{[^}]*grid-(column|row)/.test(block), "값을 다음 줄로 접는다");
  }
  // 막대는 가로로 뻗는다 — 길이는 너비가 말한다.
  assert.match(rule(css, "\\.track"), /height:\d/);
  assert.match(rule(css, "\\.fill"), /height:100%/);
  for (const [, style] of sectionOf(fix().html, "bars").matchAll(/style="([^"]*)"/g)) {
    assert.match(style, /^width:[\d.]+%$/, `막대가 너비가 아닌 것으로 자란다: ${style}`);
  }
});

test("rows(overlay) 의 열은 균일하고 표만 옆으로 굴린다", () => {
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  // **고른 열은 통째로 잡히고 잘리지 않는다.** 칸마다 두르면 열 안에 가로선이 생기고,
  // 스크롤 상자는 한 축만 굴릴 수 없어 여백이 없으면 테두리가 모서리에서 잘린다.
  assert.match(css, /col\.is-focus \{[^}]*border:\d+px solid var\(--ink\)/);
  assert.match(css, /\.table-scroll \{[^}]*padding:\d/);
  // 표는 자기 스크롤 상자 안에 있다 — 페이지 전체가 옆으로 밀리면 띠도 목차도 사라진다.
  assert.match(sectionOf(fix().html, "rows", 0), /<div class="table-scroll"><table class="items"/);
  assert.match(css, /\.table-scroll \{[^}]*overflow-x:auto/);
  // 열 너비를 자리마다 달리 주지 않는다. 넓은 칸이 중요해 보이면 그것도 우열이다.
  assert.match(css, /table \{[^}]*table-layout:fixed/);
  assert.match(css, /thead th \{[^}]*width:\d+px/);
  // 스크롤은 그 상자만의 것이다. 판이나 페이지가 옆으로 굴러서는 안 된다.
  assert.ok(!/\.(viewport|scroll|page|content) \{[^}]*overflow-x:(auto|scroll)/.test(css),
    "페이지가 옆으로 밀린다");
});

test("손에 잡히는 화면이 있다", () => {
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const app = fs.readFileSync(path.join(ROOT, "viewer/app.mjs"), "utf-8");
  const page = fs.readFileSync(path.join(ROOT, "viewer.html"), "utf-8");
  // 머리말이 다른 머리말의 앞토막일 수 있다 — `{` 가 바로 뒤에 오는 것만 그 블록이다.
  const block = (head) => {
    const at = css.search(new RegExp(head.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*\\{"));
    assert.ok(at > 0, `${head} 가 없다`);
    let depth = 0;
    for (let i = css.indexOf("{", at); i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}" && (depth -= 1) === 0) return css.slice(at, i);
    }
    return "";
  };

  // **누를 것은 손가락만 해야 한다.** 통용되는 자가 44px 이다.
  const touch = block("@media (max-width: 900px), (pointer: coarse)");
  assert.match(touch, /button, select, \.toc-link \{[^}]*min-height:44px/, "누를 것이 작다");
  assert.match(touch, /label:has\(input\) \{[^}]*min-height:44px/, "네모 줄이 작다");
  assert.match(touch, /\.pop-close \{[^}]*min-height:44px/, "닫는 길이 손가락에 안 맞는다");

  // **분석뷰가 주인공이다.** 전화기에서는 판 하나만 서고 편집기는 고를 때만 나온다.
  const narrow = block("@media (max-width: 900px)");
  assert.match(page, /class="pane-pick"/, "판을 고르는 줄이 없다");
  assert.match(narrow, /\.pane\.edit \{[^}]*display:none/, "좁은 화면에서 편집기가 먼저 선다");
  assert.match(narrow, /\.playground\.editing \.pane\.edit \{[^}]*display:flex/);
  assert.match(narrow, /\.playground\.editing \.pane\.view \{[^}]*display:none/);
  assert.match(app, /data-pane/, "판을 고르는 길이 앱에 없다");

  // **손가락에는 가리키기가 없다.** 눌러서 켜는 길이 따로 있어야 한다 —
  // 글자 위의 초점은 기기마다 달리 돌아서 :focus 하나로는 열린다고 말할 수 없다.
  assert.match(css, /\.note-mark\.is-open \.note-pop[^{]*\{[^}]*display:block/, "눌러서 여는 길이 없다");
  assert.match(app, /classList\.add\("is-open"\)/, "앱이 표시를 켜지 않는다");
  assert.match(app, /classList\.remove\("is-open"\)/, "앱이 표시를 끄지 않는다");
  // 닫는 길 셋 — 닫기 단추 · 바깥 누르기 · Esc.
  assert.match(app, /pop-close/, "닫기 단추를 듣지 않는다");
  assert.match(app, /Escape/, "Esc 로 닫히지 않는다");
  assert.match(block("@media (max-width: 900px)"), /\.pop-close \{[^}]*display:block/, "좁은 화면에 닫기가 없다");

  // **가로로 밀리지 않는다.** 넘치는 것은 자기 상자에서 굴러간다 — 페이지가 아니다.
  for (const one of [".table-scroll", ".chart-scroll"]) {
    assert.match(css, new RegExp(`\\${one} \\{[^}]*overflow-x:auto`), `${one} 이 굴러가지 않는다`);
  }
  assert.match(sectionOf(fix().html, "line"), /<div class="chart-scroll"><svg class="line"/);
  assert.ok(!/\.(site|content|page|viewport|scroll|panes) \{[^}]*overflow-x:(auto|scroll)/.test(css),
    "페이지가 옆으로 밀린다");

  // 아티팩트로 올릴 때 밖에서 덧대던 것을 저장소 안으로 들였다 — 밖에서 기우면 그 자리가 미대응이다.
  assert.match(css, /:root \{[^}]*color-scheme: ?light/, "밝은 바탕을 못 박지 않았다");
  assert.match(block("@media (max-width: 420px)"), /textarea \{[^}]*min-height:44vh/, "전화기 편집기가 납작하다");
});

test("오른쪽 판의 띠는 스크롤 영역 밖에 있다", () => {
  // 분석뷰는 길다. 아래를 보다가 focus 를 바꾸려고 위로 되올라오면 안 된다.
  const page = fs.readFileSync(path.join(ROOT, "viewer.html"), "utf-8");
  const markup = page.split('<script type="module">')[0];
  const pane = markup.slice(markup.indexOf('<div class="pane view">'));
  const bar = pane.indexOf('<div class="bar">');
  const scroll = pane.indexOf('<div class="scroll">');
  const body = pane.indexOf('id="view"');
  assert.ok(bar >= 0 && scroll > bar, "띠가 스크롤 영역보다 앞에 서야 한다");
  assert.ok(body > scroll, "본문이 스크롤 영역 안에 있어야 한다");

  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  assert.match(css, /\.pane\.view \{ overflow:hidden; \}/, "판이 스크롤 상자면 띠가 밀린다");
  assert.match(css, /\.scroll \{[^}]*overflow:auto/, "스크롤하는 것은 본문뿐이다");
  // 붙박이를 만들려고 시각을 새로 들이지 않는다. 구조로 푼 자리다.
  assert.ok(!/position:\s*sticky/.test(css), "sticky 로 띄우지 않는다");
});

test("장식으로 위계를 만들지 않는다", () => {
  // 띠와 상자로 말하던 것을 글자로 말하게 한다. 되살아나면 여기서 걸린다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");

  // 둥근 상자에 왼쪽 띠를 덧댄 것 · 왼쪽 띠를 흉내 낸 inset 그림자
  assert.ok(!/border-left\s*:/.test(css), "왼쪽 띠");
  assert.ok(!/box-shadow/.test(css), "그림자");

  // 모서리는 하나뿐이다. 덩어리마다 제각각 굴리지 않는다.
  const radii = new Set([...css.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1].trim()));
  assert.deepEqual([...radii], ["var(--r)"], `모서리가 여럿: ${[...radii]}`);

  // 활성·선택을 밑줄로 말하지 않는다 — 왼쪽 띠를 아래로 옮긴 것뿐이다.
  // 구조로 쓰는 테두리(판 구분선·표)와는 선택자로 가른다.
  for (const [, sel, body] of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    if (!sel.includes("[aria-pressed")) continue;
    assert.ok(!/border-(top|bottom|left|right)/.test(body), `활성 표시에 테두리: ${sel.trim()}`);
  }
  // 투명 밑줄을 깔아 두고 색만 바꾸는 우회도 막는다
  assert.ok(!/border-bottom[^;}]*transparent/.test(css), "투명 밑줄");

  // 점선·겹선 장식과 빗금 텍스처와 가운데 정렬
  assert.ok(!/\b(dashed|dotted|double)\b/.test(css), "점선·겹선 장식");
  assert.ok(!css.includes("repeating-linear-gradient"), "빗금 텍스처");
  // 가운데 정렬은 **내용의 위계**를 막자는 것이다. 릴 한 칸(글자 폭 하나) 안에서 숫자가
  // 가운데 서는 것은 위계가 아니라 글리프 자리라, 규칙을 지우지 않고 선택자로 가른다.
  // **주석을 걷고 센다** — 주석이 선택자에 붙어 오면 이름으로 거르는 판정이 헛돈다.
  for (const [, sel, body] of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    if (!/text-align:\s*center/.test(body)) continue;
    assert.match(sel.trim(), /^\.slot(\[|\s|$)/, `가운데 정렬: ${sel.trim()}`);
  }
});

test("선은 보는 상태로 갈린다 — 색을 빼도 갈린다", () => {
  // 지키려는 것은 「무늬」가 아니라 **「선이 서로 갈린다」**다. 가르는 자가 무늬에서
  // 상태(지금 보는 것 · 직전에 보던 것 · 나머지)로 바뀌었을 뿐이다.
  const values = structuredClone(FIX.values);
  for (const [i, at] of [[1, 42], [2, 44]]) {
    values[i].facets["premium-by-age"].fields["premium-curve"] = {
      state: "filled",
      value: [{ at, value: 60000 + i * 9000 }, { at: at + 18, value: 140000 + i * 9000 }],
    };
  }
  const drawSvg = (args) => sectionOf(renderView({ template: FIX.template, values, ...args }).html, "line");
  const svg = drawSvg({ focus: "proposal-a", previousFocus: "proposal-b" });
  const drawn = [...svg.matchAll(/<polyline[^>]*>/g)].map((m) => m[0]);
  assert.equal(drawn.length, 3, "세 갈래를 보려면 선이 셋이어야 한다");
  // **점선을 쓰지 않는다.** 무늬로 가르던 자리를 걷었다.
  assert.ok(!svg.includes("stroke-dasharray"), "점선이 남아 있다");
  assert.ok(!drawn.some((tag) => /stroke="/.test(tag)), "선에 색을 직접 칠한다");

  // 세 갈래가 저마다 하나씩 선다.
  const traceOfTag = (tag) => (tag.match(/trace-([a-z]+)/) ?? [])[1];
  assert.deepEqual(drawn.map(traceOfTag).sort(), [...TRACE].sort());

  // **색을 빼도 갈린다** — 굵기와 진하기가 같은 순서를 함께 말한다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const seen = { width: new Map(), opacity: new Map() };
  for (const name of TRACE) {
    const body = css.match(new RegExp(`svg \\.series\\.trace-${name} \\{([^}]*)\\}`))?.[1] ?? "";
    for (const key of ["stroke-width", "opacity"]) {
      const value = Number(body.match(new RegExp(`${key}:([\\d.]+)`))?.[1]);
      assert.ok(Number.isFinite(value), `${name}: ${key} 가 없다`);
      seen[key === "opacity" ? "opacity" : "width"].set(name, value);
    }
  }
  for (const [key, got] of Object.entries(seen)) {
    assert.equal(new Set(got.values()).size, TRACE.length, `${key} 가 갈래를 가르지 못한다`);
    // 순서까지 같다 — 지금 보는 것이 가장 뚜렷하고 나머지가 가장 옅다.
    assert.deepEqual([...got.values()], [...got.values()].sort((a, b) => b - a), `${key} 의 순서`);
  }

  // **색은 상태에서만 나온다.** 같은 subject 라도 보는 것이 바뀌면 갈래가 바뀐다.
  const moved = drawSvg({ focus: "proposal-b", previousFocus: "proposal-a" });
  const traceFor = (part, name) =>
    traceOfTag(part.match(new RegExp(`<polyline[^>]*>(?=[\\s\\S]*?${name})`))?.[0] ?? "");
  assert.equal(traceOf("proposal-a", "proposal-a", "proposal-b"), "now");
  assert.equal(traceOf("proposal-a", "proposal-b", "proposal-a"), "prior");
  assert.equal(traceOf("proposal-a", "proposal-c", "proposal-b"), "rest");
  // **직전이 현재와 같을 수는 없다.** 같은 id 가 오면 직전이 없는 것으로 본다.
  assert.equal(traceOf("proposal-a", "proposal-a", "proposal-a"), "now");
  assert.notEqual(svg, moved, "focus 를 옮겨도 그림이 그대로다");
  // 차례를 바꿔도 갈래는 그대로다 — id 나 자리에서 나오지 않는다.
  const swapped = renderView({
    template: FIX.template, values: [...values].reverse(),
    focus: "proposal-a", previousFocus: "proposal-b",
  });
  const bySeat = [...sectionOf(swapped.html, "line").matchAll(/<polyline[^>]*>/g)]
    .map((m) => traceOfTag(m[0]));
  assert.deepEqual(bySeat.sort(), [...TRACE].sort(), "차례가 갈래를 정한다");

  // **이름은 그대로다** — 누가 누구인지는 이름이, 무엇을 보는 중인지는 색과 굵기가 말한다.
  const labelled = [...svg.matchAll(/<text class="series-label[^"]*"[^>]*>([^<]+)</g)].map((m) => m[1]);
  assert.equal(labelled.length, 3, "이름 없는 선이 있다");
  assert.ok(labelled.every((name) => Object.values(NAMES).includes(name)), labelled.join(" / "));
});

test("순위·등급 어휘가 화면으로 새지 않는다", () => {
  const { html } = fix({ focus: "proposal-a" });
  for (const word of ["rank", "grade", "score", "1위", "추천", "best"]) assert.ok(!html.includes(word), word);
});

// ---------------------------------------------------------------- 판정하지 않는다

test("그리지 못하는 입력은 자리를 표시하고 까닭을 적는다", () => {
  const cases = [
    ["필드가 없다", (t) => (t.facets[0].fields = []), /필드가 하나도 없다/],
    ["facet 이 객체가 아니다", (t) => (t.facets[0] = "ranking"), /객체가 아니다/],
  ];
  for (const [why, mutate, expected] of cases) {
    const template = structuredClone(FIX.template);
    mutate(template);
    const { html, report } = fix({ template });
    assert.ok(html.includes(UNDRAWABLE), why);
    assert.match(report.join(" | "), expected, why);
    assert.ok(html.includes("element-rows"), why); // 멈추지 않는다
  }
});

test("값의 생김새가 선언한 모양과 다르면 그 자리만 표시된다", () => {
  const values = structuredClone(FIX.values);
  values[0].facets["contract-terms"].fields["entry-age"].value = 40; // range 자리에 홑값
  values[0].facets["premium-by-age"].fields["premium-curve"] = { state: "filled", value: "40세부터" };
  const { html, report } = fix({ values });
  assert.ok(html.includes(UNDRAWABLE));
  assert.equal(report.length, 2, report.join(" | "));
  assert.ok(html.includes("87,400원")); // 나머지는 멀쩡히 그려진다
});

test("템플릿에 없는 facet 과 열은 그리지 않고 적어 둔다", () => {
  const values = structuredClone(FIX.values);
  values[0].facets["ranking"] = { fields: {} };
  values[0].facets["riders"].fields["rider-list"].value[0].grade = "A";
  const { html, report } = fix({ values });
  assert.match(report.join(" | "), /템플릿에 없는 facet/);
  assert.match(report.join(" | "), /템플릿에 없는 열/);
  assert.ok(!html.includes(">A<"));
});

test("템플릿이 없으면 빈 판을 내고 던지지 않는다", () => {
  const { html, report, view } = renderView({ template: null, values: FIX.values });
  assert.equal(html, "");
  assert.equal(view, null);
  assert.equal(report.length, 1);
});

// ---------------------------------------------------------------- 표시 단위

test("타입마다 표시 단위가 있다", () => {
  const cases = [
    ["number", 3.5, "3.5"], ["money", 50000000, "50,000,000원"],
    ["ratio", 0.5, "50%"], ["ratio", 0.0725, "7.25%"],
    // 배수는 비율이 아니다 — 같은 4.9 가 한쪽에선 490% 고 다른 쪽에선 4.9 배다.
    ["multiple", 4.9, "4.9배"], ["multiple", 1, "1배"],
    ["duration", 240, "240개월"], ["age", 100, "100세"],
    ["boolean", true, "예"], ["boolean", false, "아니오"],
    ["text", "종신", "종신"], ["date", "2026-10-01", "2026-10-01"],
  ];
  for (const [type, value, shown] of cases) assert.equal(formatScalar(type, value), shown, `${type} ${value}`);
  // **어휘가 닫혀 있다.** 표시 단위를 자유 글로 열면 「1위」·「A등급」이 들어온다 —
  // 그래서 단위가 필요하면 타입을 더한다. 스키마에 없는 것이 여기 서면 걸린다.
  const enums = read("schema/weave-common.schema.json").$defs.Type.enum;
  assert.deepEqual([...new Set(cases.map((one) => one[0]))].sort(), [...enums].sort());
  assert.notEqual(formatScalar("multiple", 4.9), formatScalar("ratio", 4.9));
});

test("이것이 무엇인지는 층마다 hint 가 말한다", () => {
  // **뜻이 층마다 같다** — facet 의 hint 도 필드의 hint 도 「이것이 무엇인지」다.
  // **어느 것을 어떻게 낼지는 언어가 아니라 렌더가 고른다.** 아래는 이 참조 렌더의 선택을
  // 못 박는 것이지 언어의 규칙을 못 박는 것이 아니다 — 근거는 **밀도**다: facet 은 화면에
  // 서넛이라 한 줄씩 붙어도 길어지지 않고, 필드는 열 개씩이라 늘 내면 값보다 설명이 길어진다.
  const facetHint = read("schema/weave-template.schema.json").$defs.Facet.properties.hint;
  assert.ok(facetHint, "facet 에 hint 가 없다");
  assert.match(facetHint.pattern, /\\n/, "줄바꿈을 막지 않는다");
  assert.ok(facetHint.maxLength <= 120, "한 문장을 넘길 수 있으면 제목이 다시 설명을 진다");

  // **이 렌더는 facet 의 hint 를 제목 바로 아래에 늘 낸다.** 표시 뒤로 숨기지 않는다.
  const line = "이 자리가 무엇인지 한 문장으로 말합니다.";
  const withHint = structuredClone(FIX.template);
  for (const facet of withHint.facets) facet.hint = `${facet.id} — ${line}`;
  const page = renderView({ template: withHint, values: FIX.values, focus: "proposal-a" }).html;
  for (const facet of withHint.facets) {
    const part = sectionOfFacet(page, facet);
    const at = part.indexOf(`${facet.id} — ${line}`);
    assert.ok(at > 0, `${facet.id}: facet hint 가 안 보인다`);
    assert.ok(!pops(part).some(([from, to]) => at > from && at < to), `${facet.id}: 표시 뒤로 숨었다`);
    // 제목 **아래**다 — 제목이 이름을 지고 hint 가 설명을 진다.
    assert.ok(at > part.indexOf("</h2>"), `${facet.id}: hint 가 제목보다 앞에 선다`);
    assert.ok(at < part.indexOf('class="body"'), `${facet.id}: hint 가 본문보다 뒤에 선다`);
  }
  // hint 없는 facet 에는 줄이 서지 않는다.
  const bareFacets = structuredClone(FIX.template);
  for (const facet of bareFacets.facets) delete facet.hint;
  assert.ok(!renderView({ template: bareFacets, values: FIX.values }).html.includes("facet-hint"));

  // **셋이 말하는 것이 다르다.**
  //   `description` — 무엇을 어떤 단위로 담는 자리인지. **그 자리를 채울 수 있을 만큼.**
  //   `hint`        — **이 필드가 무엇인지.** 한 줄로 가리킨다. 값이 없어도 필요하다.
  //   주석          — 이 값에 대해 할 말.
  // `hint` 와 `description` 이 갈리는 축은 **깊이**다 — 독자도 보임도 아니다. 형이 이미
  // 그 축을 진다: 한 줄 대 600자, 선택 대 필수. 아래가 그것을 못 박는다.
  // 합치면 쓰는 쪽이 매번 「이건 hint 인가 note 인가」를 고민한다. 가르면 그 고민이 없다.
  const field = read("schema/weave-template.schema.json").$defs.Field.properties;
  assert.ok(field.hint && field.description, "둘 다 있어야 한다");
  assert.ok(!("notes" in field), "필드 주석이 템플릿에 되살아났다 — hint 의 자리다");
  assert.equal(field.hint.maxLength, 80, "한 줄을 넘길 수 있으면 혼자 서는 글이 된다");
  assert.match(field.hint.pattern, /\\n/, "줄바꿈을 막지 않는다");

  // **자리가 뜻을 가른다.** 이름 옆 표시를 열면 hint 가 나오고, 값 옆 표시를 열면 그
  // 값에 대한 말이 나온다. 양끝으로 갈리니 섞이지 않는다.
  //
  // 늘 보이던 것을 감췄으므로 「제품 지식이 감춰지지 않는다」를 **자리로** 다시 세운다:
  // hint 를 단 필드마다 표시가 서고, 열면 그 글이 나오고, 값 옆 표시와 한 자리에 겹치지 않는다.
  const said = "이 값이 무엇인지 한 줄로 말합니다.";
  const template = structuredClone(FIX.template);
  for (const facet of template.facets) facet.fields[0].hint = `${facet.id} — ${said}`;
  const { html } = renderView({ template, values: FIX.values, focus: "proposal-a" });
  for (const facet of template.facets) {
    const part = sectionOfFacet(html, facet);
    // 1. **표시가 선다.** 없어지면 hint 가 조용히 사라진 것이다.
    const at = part.indexOf("hint-mark");
    assert.ok(at > 0, `${facet.id}: 이름 옆 표시가 없다`);
    // 2. **열면 그 글이 나온다** — 표시 안에 있다.
    const raw = part.indexOf(`${facet.id} — ${said}`);
    assert.ok(raw > 0, `${facet.id}: hint 글이 없다`);
    assert.ok(pops(part).some(([from, to]) => raw > from && raw < to), `${facet.id}: 표시 밖에 있다`);
    // 3. **값 옆 표시와 자리가 갈린다.** 값이 설 자리가 있는 element 에서는 값 주석이
    //    **이름 자리에 들어오지 못한다.** (`line`·`rows` 는 값이 설 한 자리가 없어
    //    이름 줄에 함께 서고, 그때도 hint 가 앞선다 — 아래 4번이 차례를 본다.)
    //    **이름 자리를 전부 본다** — 첫 줄만 보면 말이 안 붙은 필드를 보고 지나간다.
    const zones = {
      stat: [/<div class="field-label">([\s\S]*?)<\/div>/g],
      rows: [/<div class="field-label">([\s\S]*?)<\/div>/g],
      facts: [/<dt>([\s\S]*?)<\/dt>/g],
      bars: [/<span class="who">([\s\S]*?)<span class="track"/g],
    }[facet.element];
    let looked = 0;
    for (const pattern of zones ?? []) {
      for (const [, zone] of part.matchAll(pattern)) {
        looked += 1;
        assert.ok(!zone.includes('class="note-mark" '), `${facet.id}: 값 주석이 이름 자리에 섰다`);
      }
    }
    if (zones) assert.ok(looked > 0, `${facet.id}: 이름 자리를 하나도 못 찾았다`);
    // 4. 값 주석 표시가 있다면 **hint 뒤**다. 차례가 고정이라 여는 것이 무엇인지 갈린다.
    const valueAt = part.indexOf('class="note-mark" ');
    if (valueAt > 0) assert.ok(at < valueAt, `${facet.id}: 값 주석이 이름 옆보다 앞에 선다`);
  }
  // 4. **hint 에는 갈래가 없다.** 갈래는 주석의 것이다 — hint 는 이 필드가 무엇인지일 뿐,
  //    인용도 팁도 주의도 아니다.
  for (const facet of template.facets) {
    const part = sectionOfFacet(page, facet);
    const mark = part.slice(part.indexOf("hint-mark"));
    const pop = mark.slice(0, mark.indexOf("</span></span>"));
    assert.ok(!/class="kind"|note-(quote|tip|note|caution)/.test(pop),
      `${facet.id}: hint 에 갈래가 붙었다`);
  }

  // 5. **hint 없는 필드에는 표시가 없다.** 빈 표시를 세우지 않는다.
  const bare = structuredClone(FIX.template);
  for (const facet of bare.facets) for (const decl of facet.fields) delete decl.hint;
  assert.ok(!renderView({ template: bare, values: FIX.values }).html.includes("hint-mark"));
  // **이 렌더는 `description` 을 내지 않는다.** 낼 수 없어서가 아니라 필드마다 600자가
  // 붙으면 계약 표가 값보다 설명으로 길어지기 때문이다 — 다른 렌더는 낼 수 있다.
  for (const facet of FIX.template.facets) {
    for (const decl of facet.fields) {
      assert.ok(!textOf(html).includes(decl.description.slice(0, 20)),
        `${facet.id}/${decl.key}: 이 렌더가 안 내기로 한 description 이 화면에 났다`);
    }
  }
});

test("그림이 값과 같은 자로 재어진다", () => {
  // **길이가 값을 뜻하면 그 자는 무엇을 눌러도 안 움직여야 한다.** 글로 「견주면 안
  // 됩니다」라고 쓰는 것은 고치는 것이 아니다 — 그림이 거짓말하는 것은 그대로다.
  const width = (html) => [...html.matchAll(/style="width:([\d.]+)%"/g)].map((m) => Number(m[1]));

  // ── bars: **자가 facet 하나에 하나다.** 큰 값이 반드시 더 길다.
  const facet = FIX.template.facets.find((f) => f.element === "bars");
  const part = sectionOf(fix({ focus: "proposal-a" }).html, "bars");
  const shown = facet.fields.map((decl) => {
    const slot = FIX.filled.facets[facet.id].fields[decl.key];
    return slot.state === "filled" ? slot.value : null;
  });
  const drawn = width(part);
  assert.equal(drawn.length, shown.filter((v) => v !== null).length, "막대 수가 값과 다르다");
  const pairs = shown.filter((v) => v !== null).map((v, i) => ({ v, w: drawn[i] }));
  assert.ok(pairs.length >= 2, "막대가 둘 이상이어야 자를 가를 수 있다");
  for (const a of pairs) {
    for (const b of pairs) {
      if (a.v > b.v) assert.ok(a.w > b.w, `값이 큰데 짧다: ${a.v}(${a.w}%) vs ${b.v}(${b.w}%)`);
      if (a.v === b.v) assert.equal(a.w, b.w, "같은 값인데 길이가 다르다");
    }
  }

  // ── **자가 subject 를 따라 움직이지 않는다.** focus 를 옮겨도 같은 값은 같은 길이다.
  //    **같은 값을 두 subject 에 심어 두고 본다** — 겹치는 값이 없으면 볼 것이 없다.
  const shared = structuredClone(FIX.values);
  shared[0].facets[facet.id].fields[facet.fields[0].key] = { state: "filled", value: 50000000 };
  shared[0].facets[facet.id].fields[facet.fields[1].key] = { state: "filled", value: 10000000 };
  //    **두 subject 의 최댓값이 달라야** 한다 — 같으면 자를 따로 재도 티가 안 난다.
  shared[2].facets[facet.id].fields[facet.fields[0].key] = { state: "filled", value: 10000000 };
  shared[2].facets[facet.id].fields[facet.fields[1].key] = { state: "filled", value: 20000000 };
  const here = new Map();
  let compared = 0;
  for (const doc of [shared[0], shared[2]]) {
    const page = sectionOf(fix({ values: shared, focus: doc.subjectId }).html, "bars");
    for (const [i, row] of page.split('<div class="bar-row">').slice(1).entries()) {
      const w = Number((row.match(/style="width:([\d.]+)%"/) ?? [])[1]);
      const slot = doc.facets[facet.id]?.fields?.[facet.fields[i].key];
      if (slot?.state !== "filled" || !Number.isFinite(w)) continue;
      const seen = here.get(slot.value);
      if (seen !== undefined) { assert.equal(w, seen, `같은 값 ${slot.value} 이 길이가 둘이다`); compared += 1; }
      here.set(slot.value, w);
    }
  }
  assert.ok(compared >= 1, `견줄 짝이 없다: ${compared}`);

  // ── **0 이 아닌 값은 사라지지 않고, 0 은 길이 0 이다.**
  const tiny = structuredClone(FIX.values);
  const [big, small] = facet.fields;
  tiny[0].facets[facet.id].fields[big.key] = { state: "filled", value: 100000000 };
  tiny[0].facets[facet.id].fields[small.key] = { state: "filled", value: 1 };
  const zeroed = structuredClone(tiny);
  zeroed[0].facets[facet.id].fields[small.key] = { state: "filled", value: 0 };
  const [, thin] = width(sectionOf(fix({ values: tiny, focus: "proposal-a" }).html, "bars"));
  const [, none] = width(sectionOf(fix({ values: zeroed, focus: "proposal-a" }).html, "bars"));
  assert.ok(thin > 0, "0 이 아닌 값이 길이 0 으로 사라졌다");
  assert.equal(none, 0, "0 인데 길이가 있다");

  // ── line: **두 축이 고른 것을 따라 움직이지 않는다.**
  //    고를 것마다 범위가 다른 값을 심는다 — 같으면 움직여도 티가 안 난다.
  const lineFacet = FIX.template.facets.find((f) => f.element === "line");
  const axedTemplate = structuredClone(FIX.template);
  const axed = axedTemplate.facets.find((f) => f.id === lineFacet.id);
  axedTemplate.choices = [{ id: "case", label: "갈래",
    options: [{ id: "one", label: "하나" }, { id: "two", label: "둘" }] }];
  axed.fields[0].choice = "case";
  const axedValues = structuredClone(FIX.values);
  axedValues[0].facets[lineFacet.id].fields[axed.fields[0].key] = { byOption: {
    one: { state: "filled", value: [{ at: 40, value: 10000 }, { at: 50, value: 20000 }] },
    two: { state: "filled", value: [{ at: 45, value: 300000 }, { at: 80, value: 900000 }] } } };
  for (const doc of axedValues.slice(1)) {
    doc.facets[lineFacet.id].fields[axed.fields[0].key] = { byOption: {
      one: { state: "empty" }, two: { state: "empty" } } };
  }
  const axisOf = (option) => {
    const html = renderView({ template: axedTemplate, values: axedValues,
      focus: "proposal-a", choices: { case: option } }).html;
    // 눈금의 **글과 자리**를 함께 본다 — 글만 보면 자가 움직여도 같아 보일 수 있다.
    return [...sectionOf(html, "line").matchAll(/<text class="tick[^"]*"[^>]*>[^<]*<\/text>/g)].map((m) => m[0]);
  };
  const first = axisOf("one");
  assert.ok(first.length >= 4, "눈금이 넷은 서야 축을 볼 수 있다");
  assert.deepEqual(axisOf("two"), first, "고른 것을 옮기니 축이 움직인다");

  // ── **bars 의 자도 고를 것을 덮는다.** 고른 것을 옮겨도 같은 값은 같은 길이다.
  {
    const barsFacet = FIX.template.facets.find((f) => f.element === "bars");
    const two = structuredClone(FIX.template);
    const axedBars = two.facets.find((f) => f.id === barsFacet.id);
    two.choices = [{ id: "case", label: "갈래",
      options: [{ id: "one", label: "하나" }, { id: "two", label: "둘" }] }];
    axedBars.fields[0].choice = "case";
    const vals = structuredClone(FIX.values);
    for (const [i, doc] of vals.entries()) {
      doc.facets[barsFacet.id].fields[axedBars.fields[0].key] = i === 0
        ? { byOption: { one: { state: "filled", value: 10000000 }, two: { state: "filled", value: 90000000 } } }
        : { byOption: { one: { state: "empty" }, two: { state: "empty" } } };
    }
    const barWidth = (option) =>
      width(sectionOf(renderView({ template: two, values: vals, focus: "proposal-a",
        choices: { case: option } }).html, "bars"))[0];
    // **자를 넘는 길이가 없다.** 고른 것만 보고 재면 다른 갈래의 큰 값이 자를 넘어선다.
    for (const option of ["one", "two"]) {
      assert.ok(barWidth(option) <= 100, `길이가 자를 넘는다: ${option} ${barWidth(option)}%`);
    }
    assert.ok(barWidth("one") < barWidth("two") - 1,
      `고른 것을 옮겼는데 자가 따라 움직인다: ${barWidth("one")} vs ${barWidth("two")}`);
  }

  // ── **바닥은 바닥이다.** 크면 작은 값이 실제보다 길어져 그림이 다시 거짓말한다.
  // ── **line 의 y 축은 0 에서 시작한다.** 0 에서 자르면 작은 차이가 크게 보인다 —
  //    읽기 좋게 하려고 자를 왜곡하는 것이고 그 판단은 우리 것이 아니다.
  {
    const src = fs.readFileSync(path.join(ROOT, "viewer/render.mjs"), "utf-8");
    const floor = Number(src.match(/const FLOOR = ([\d.]+);/)?.[1]);
    assert.ok(Number.isFinite(floor) && floor > 0 && floor <= 2, `바닥이 자를 흔든다: ${floor}`);
    assert.match(src, /const ymin = Math\.min\(\.\.\.ys, 0\)/, "y 축이 0 에서 떨어졌다");
  }

  // ── 길이로 말하지 않는 element 는 inline style 을 아예 내지 않는다.
  for (const element of ["stat", "facts", "rows"]) {
    const flat = sectionOf(fix({ focus: "proposal-a" }).html, element);
    assert.equal(width(flat).length, 0, `${element}: 길이가 값을 말한다`);
  }
  // rows 는 focus·overlay 둘 다 본다 — occurrence 0(riders) 은 위에서, 1(payments) 은 여기서.
  assert.equal(width(sectionOf(fix({ focus: "proposal-a" }).html, "rows", 1)).length, 0);
});

test("하나를 쪼갠 것은 합이 전체다", () => {
  // **`bars` 와 다른 자리다.** 막대는 서로 다른 것들의 크기를 견주고, 조각은 한 덩어리의
  // 안쪽이다 — 합이 전체라는 사실이 `bars` 로는 보이지 않는다.
  const { html } = fix({ focus: "proposal-a" });
  const part = sectionOf(html, "parts");
  const facet = FIX.template.facets.find((f) => f.element === "parts");
  const items = FIX.filled.facets[facet.id].fields[facet.fields[0].key].value;
  const share = facet.fields[0].columns[1];

  // 조각이 값 그대로 서고, 너비가 **전체 대비 몫**이다. 합치면 100 이 된다.
  const widths = [...part.matchAll(/class="slice"[^>]*width:([\d.]+)%/g)].map((m) => Number(m[1]));
  assert.equal(widths.length, items.length, "조각 수가 값과 다르다");
  assert.ok(Math.abs(widths.reduce((a, b) => a + b, 0) - 100) < 0.01, `합이 전체가 아니다: ${widths}`);
  const whole = items.reduce((sum, one) => sum + one[share.key], 0);
  for (const [i, one] of items.entries()) {
    assert.ok(Math.abs(widths[i] - (one[share.key] / whole) * 100) < 0.01, `${i}: 몫이 다르다`);
    assert.ok(textOf(part).includes(formatScalar(share.type, one[share.key])), `${i}: 값이 안 보인다`);
  }

  // **차례는 값이 아니라 선언이다.** 큰 것을 앞으로 옮기지 않는다 — 그것이 순위다.
  const said = [...part.matchAll(/<span class="who">([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(said, items.map((one) => one[facet.fields[0].columns[0].key]), "조각 차례가 값을 탄다");

  // **무채색 둘을 자리 차례로 번갈아 쓴다.** 크기와 무관하고 우열이 없다.
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  assert.match(css, /\.slice:nth-child\(even\)/, "자리 차례가 아니라 다른 것으로 가른다");
  assert.ok(!/\.slice[^{]*\{[^}]*var\(--(kind|trace|subject)/.test(css), "조각이 갈래·상태 색을 받는다");

  // **0 인 조각도 목록에 남는다.** 띠에서 사라진다고 값까지 사라지면 안 된다 —
  // 「0 원이다」와 「그런 조각이 없다」는 다른 말이다.
  const zero = structuredClone(FIX.values);
  const slot = zero[0].facets[facet.id].fields[facet.fields[0].key];
  slot.value = [...slot.value, { [facet.fields[0].columns[0].key]: "쓰지 않은 몫",
                                 [share.key]: 0 }];
  const withZero = sectionOf(fix({ values: zero, focus: "proposal-a" }).html, "parts");
  assert.ok(textOf(withZero).includes("쓰지 않은 몫"), "0 인 조각이 목록에서 사라졌다");
  assert.equal((withZero.match(/class="slice"/g) ?? []).length, slot.value.length - 1,
    "0 인 조각이 띠에 섰다");

  // **쪼갤 것이 없으면 띠를 그리지 않는다.** 값이 아예 없을 때와, 목록이 비었을 때 둘 다.
  const blank = sectionOf(renderView({ template: FIX.template, values: [FIX.empty] }).html, "parts");
  assert.ok(!blank.includes('class="band"'), "값이 없는데 띠가 섰다");
  const none = structuredClone(FIX.values);
  none[0].facets[facet.id].fields[facet.fields[0].key] = { state: "filled", value: [] };
  const drawn = sectionOf(fix({ values: none, focus: "proposal-a" }).html, "parts");
  assert.ok(!drawn.includes('class="band"'), "빈 목록인데 띠가 섰다");
  assert.ok(textOf(drawn).includes(NO_ITEMS), "빈 목록이라고 말하지 않는다");
});

test("겹치는 표와 고른 것만 내는 표가 compare 로 갈린다", () => {
  // 둘은 같은 element(rows) 다 — 갈리는 것은 이름이 아니라 facet 이 스스로 적은 compare 다.
  const { html } = fix({ focus: "proposal-a" });
  const overlay = sectionOf(html, "rows", 0); // riders — compare: overlay
  const focused = sectionOf(html, "rows", 1); // payments — compare: focus
  // overlay 는 subject 를 열로 겹친다 — 명단 전부가 표 안에 선다.
  for (const doc of FIX.values) assert.ok(overlay.includes(NAMES[doc.subjectId]), `overlay: ${doc.subjectId}`);
  // focus 는 고른 하나만 편다 — 다른 subject 의 이름이 표에 없다.
  for (const doc of FIX.values) {
    if (doc.subjectId === "proposal-a") continue;
    assert.ok(!focused.includes(NAMES[doc.subjectId]), `focus 표에 ${doc.subjectId} 가 섰다`);
  }
  // 고른 것을 옮기면 focus 표는 바뀌고 overlay 의 골격(열)은 그대로다.
  const other = fix({ focus: "proposal-c" }).html;
  assert.notEqual(sectionOf(other, "rows", 1), focused, "compare: focus 가 focus 를 안 따른다");
  const cols = (part) => (part.match(/<col( class="is-focus")?>/g) ?? []).length;
  assert.equal(cols(sectionOf(other, "rows", 0)), cols(overlay), "compare: overlay 의 열이 focus 를 탄다");
  // 값의 모양은 같다 — 둘 다 같은 items 를 받는다. element 도 같다, compare 만 다르다.
  const riders = FIX.template.facets.find((f) => f.id === "riders");
  const payments = FIX.template.facets.find((f) => f.id === "payments");
  assert.equal(riders.element, payments.element);
  assert.equal(riders.fields[0].shape, payments.fields[0].shape);
  assert.notEqual(riders.compare, payments.compare);
});

test("값에서 온 글은 escape 된다", () => {
  // **다섯 글자를 전부 본다.** 하나라도 새면 값이 마크업이 된다 — 홑따옴표는 속성값을
  // 닫는 글자라 빠뜨리기 쉽고, 빠뜨려도 나머지 넷이 통과해 초록으로 지나간다.
  for (const [raw, want] of [["&", "&amp;"], ["<", "&lt;"], [">", "&gt;"], ['"', "&quot;"], ["'", "&#x27;"]]) {
    assert.equal(esc(raw), want, `escape 가 ${raw} 를 흘린다`);
  }
  const doc = structuredClone(FIX.filled);
  doc.subjectLabel = '<script>alert("x")</script>';
  const { html } = renderView({ template: FIX.template, values: [doc] });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

// ---------------------------------------------------------------- 샘플은 템플릿 샘플이다

test("샘플은 서로 다른 템플릿 짜임으로 갈린다", () => {
  // 수는 python 쪽이 센다 — 두 군데서 세면 샘플을 늘릴 때마다 두 군데를 고쳐야 한다.
  assert.ok(sampleNames.length >= 4, `샘플이 너무 적다: ${sampleNames.length}`);
  const shapes = sampleNames.map((name) => {
    const t = sample(name).template;
    return JSON.stringify(t.facets.map((f) => f.element));
  });
  assert.equal(new Set(shapes).size, shapes.length, `짜임이 겹친다: ${shapes.join(" / ")}`);
  // 값 상태가 아니라 짜임이 축이다. **차례를 바꾼 것도 같은 짜임이다** — element 를
  // 몇 개씩 쓰는지의 묶음으로 잰다. 예전엔 facet 수로 갈랐는데, 수가 같아도 짜임이
  // 다를 수 있어 늘어날수록 억지가 된다.
  const mix = sampleNames.map((name) => {
    const count = new Map();
    for (const f of sample(name).template.facets) count.set(f.element, (count.get(f.element) ?? 0) + 1);
    return JSON.stringify([...count].sort());
  });
  assert.equal(new Set(mix).size, mix.length, `element 묶음이 겹친다: ${mix.join(" / ")}`);
});

test("샘플을 다 합치면 primitive element 를 전부 쓴다", () => {
  // **한 샘플에 다 밀어 넣지 않는다.** 그러면 그 샘플이 실물이 아니라 진열장이 된다 —
  // 샘플은 사람이 읽는 화면이고, 어휘를 빠짐없이 쓰는지는 고정 케이스가 본다.
  const used = new Set(sampleNames.flatMap((name) => sample(name).template.facets.map((f) => f.element)));
  assert.deepEqual([...used].sort(), Object.keys(ELEMENTS).sort());
  // 고정 케이스가 그 자리를 이어받았다 — 거기서는 한 문서가 전부를 쓴다.
  assert.deepEqual([...new Set(FIX.template.facets.map((f) => f.element))].sort(),
    Object.keys(ELEMENTS).sort(), "고정 케이스가 어휘를 다 쓰지 않는다");
});

test("샘플이 전부 그려지고 아무것도 던지지 않는다", () => {
  for (const name of sampleNames) {
    const { html, report } = drawSample(sample(name));
    assert.ok(html.length > 300, name);
    assert.deepEqual(report, [], `${name}: ${report.join(" | ")}`);
  }
});

test("값이 비는 경우가 샘플에도 남아 있다", () => {
  // 샘플을 가르는 축은 아니지만 그 상태는 여전히 보여야 한다.
  const pages = sampleNames.map((name) => spokenOf(drawSample(sample(name)).html));
  assert.ok(pages.some((p) => p.includes(NO_VALUE)), "값 없음이 어느 샘플에도 없다");
  assert.ok(sampleNames.some((name) => drawSample(sample(name)).html.includes(NO_VALUE_MARK)),
    "값이 없다는 표기가 어느 샘플에도 서지 않는다");
  // 전부 빈 값 한 벌이 「아직 안 채웠다」의 자리를 이어받았다. 샘플에도 그 한 벌이 있어야 한다.
  const allBlank = sampleNames.flatMap((name) =>
    sample(name).values.filter((doc) =>
      Object.values(doc.facets).every((f) => Object.values(f.fields).every((e) => e.state === "empty"))));
  assert.ok(allBlank.length > 0, "전부 빈 값 한 벌이 어느 샘플에도 없다");
  for (const doc of allBlank) {
    const said = Object.values(doc.facets).flatMap((f) => f.notes ?? []);
    assert.ok(said.length > 0, `${doc.subjectId}: 왜 비었는지 주석이 말해야 한다`);
  }
});

// ---------------------------------------------------------------- primitive element 설명서

test("설명서가 말하는 비교 방법이 렌더와 갈리지 않는다", () => {
  // 산문 파일(catalog/elements.json)이 적은 것과 렌더가 하는 것이 같아야 한다.
  const said = {
    overlay: "겹친다",
    focus: "focus 를 따라 바뀐다",
    chosen: "facet 의 compare 로 고른다(focus·overlay)",
  };
  for (const row of elementPages()) {
    assert.equal(row.compare, COMPARE[row.id], `${row.id}: 설명서와 렌더가 다르다`);
    assert.equal(row.compareSaid, said[row.compare]);
  }
});

test("목차가 스키마의 primitive element 를 빠짐없이 덮는다", () => {
  const enumerated = read("schema/weave-common.schema.json").$defs.Element.enum;
  assert.deepEqual(elementPages().map((r) => r.id), enumerated);
  // 앞뒤로 시작 한 쪽과 플레이그라운드 한 쪽. 플레이그라운드는 설명서 안의 한 자리다.
  assert.equal(PAGES[0].kind, "guide");
  assert.equal(PAGES[PAGES.length - 1].kind, "playground");
});

test("설명서의 보기가 자기가 말한 제약 안에 있다", () => {
  // 산문과 제약이 갈리면 여기서 걸린다. 보기 하나에 facet 이 여럿일 수 있다(rows 의
  // compare 갈래) — **전부** 본다, 첫째만 보면 둘째의 어긋남을 놓친다.
  for (const row of elementPages()) {
    for (const facet of row.demo.template.facets) {
      assert.equal(facet.element, row.id);
      const [low, high] = row.fields.includes("–") ? row.fields.split("–").map(Number) : [Number(row.fields), Number(row.fields)];
      assert.ok(facet.fields.length >= low && facet.fields.length <= high, `${row.id}/${facet.id}: 필드 수`);
      for (const field of facet.fields) {
        assert.ok(row.shapes.includes(field.shape), `${row.id}/${facet.id}: shape ${field.shape}`);
        if (field.type) assert.ok(row.types.includes(field.type), `${row.id}/${facet.id}: type ${field.type}`);
      }
    }
  }
});

test("설명서의 보기가 그 자리에서 그려진다", () => {
  for (const row of elementPages()) {
    const { html, report } = renderView({
      template: row.demo.template, values: row.demo.values, focus: null,
    });
    assert.deepEqual(report, [], `${row.id}: ${report.join(" | ")}`);
    assert.ok(html.includes(`element-${row.id}`), row.id);
  }
});

// ---------------------------------------------------------------- 한 장이 실제로 도는가

test("빌드된 viewer.html 의 스크립트가 DOM 위에서 돈다", async () => {
  const page = fs.readFileSync(path.join(ROOT, "viewer.html"), "utf-8");
  const script = page.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

  const nodes = new Map();
  const make = (tag) => ({
    tagName: tag, className: "", type: "", value: "", checked: false, hidden: false,
    children: [], _text: "", _html: "", _on: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); if (v === "") this.children = []; },
    get textContent() { return this._text; },
    set textContent(v) {
      this._text = String(v);
      this._html = this._text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    },
    appendChild(child) { this.children.push(child); },
    addEventListener(type, fn) { this._on[type] = fn; },
    closest() { return null; },
    setAttribute(name, value) { this[name] = value; },
  });
  globalThis.document = {
    addEventListener() {},
    createElement: make,
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, make("div"));
      return nodes.get(id);
    },
  };

  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "weave-")), "bundle.mjs");
  fs.writeFileSync(file, script, "utf-8");
  await import(pathToFileURL(file).href);

  // 설명서가 상위다 — 열면 설명서가 서고 플레이그라운드는 목차의 한 자리다.
  // **머리글은 여럿을 묶을 때만 선다.** 하나뿐인 묶음에 머리글을 얹으면 이름을 두 번 적는다.
  const sizes = new Map();
  for (const page of PAGES) sizes.set(page.group, (sizes.get(page.group) ?? 0) + 1);
  const heads = [...sizes.values()].filter((n) => n > 1).length;
  assert.ok([...sizes.values()].some((n) => n === 1), "하나뿐인 묶음이 있어야 이 규칙을 잰다");
  assert.ok(heads >= 1, "여럿인 묶음이 있어야 머리글이 서는 쪽도 잰다");
  assert.equal(nodes.get("toc").children.length, PAGES.length + heads, "목차의 머리글 수가 다르다");
  assert.equal(nodes.get("toc").children.filter((c) => c.className === "group").length, heads);
  assert.ok(nodes.get("page").innerHTML.includes(PAGES[0].title), "첫 쪽이 그려져야 한다");
  assert.equal(nodes.get("page").hidden, false);
  assert.equal(nodes.get("playground").hidden, true, "플레이그라운드는 고른 뒤에 선다");
  // 플레이그라운드의 DOM 은 살아 있다. 편집 중인 글이 쪽을 옮겨도 안 날아간다.
  assert.ok(nodes.get("view").innerHTML.includes("element-stat"), "첫 샘플이 그려져야 한다");
  assert.ok(nodes.get("editor").value.includes('"weave"'), "편집기에 템플릿이 올라야 한다");
  assert.ok(nodes.get("tabs").children.length >= 2, "템플릿 탭과 값 탭이 서야 한다");
  assert.equal(nodes.get("view").className, "viewport", "primitive element 이름은 기본이 꺼짐이다");
  assert.equal(nodes.get("strip").innerHTML, "", "첫 샘플에는 그리지 못한 자리가 없어야 한다");
  const tabsBefore = nodes.get("tabs").children.length;

  // **「아무도 없을 때」를 여기서 고를 수 있다.** subject 를 하나씩 지워야만 그 화면을 볼 수
  // 있으면 지운 값이 사라지고 되돌리기도 번거롭다. 자리는 fixture 가 이미 보므로 여기서는
  // **뷰어가 그 상태를 낼 수 있는지와, 그것이 미리보기이지 편집이 아닌지**만 본다.
  const bar = nodes.get("focus-buttons").children;
  assert.ok(bar.length >= 2, "무엇을 볼지 고르는 줄이 서야 한다");
  const blank = bar[0];
  assert.equal(blank.textContent, "아무도 없을 때", "영문 이름이 화면에 섰다");
  assert.equal(blank["aria-pressed"], "false", "처음부터 눌려 있으면 안 된다");
  const drawn = nodes.get("view").innerHTML;
  const named = bar.slice(1).map((b) => b.textContent);
  assert.ok(named.length >= 2, "subject 가 둘 이상인 샘플이어야 돌아오는 것을 잴 수 있다");
  assert.ok(named.some((name) => drawn.includes(name)), "고정 화면에 subject 이름이 없다");

  blank._on.click();
  const empty = nodes.get("view").innerHTML;
  assert.match(empty, /class="slot[ "]/, "고른 뒤에도 아무도 없을 때의 자리가 안 선다");
  for (const name of named) assert.ok(!empty.includes(name), `아무도 없는데 ${name} 가 섰다`);
  // 축은 템플릿의 것이라 그대로 선다. **조건을 걸지 않는다** — 첫 샘플에 축이 없으면
  // 조건부 판정은 아무것도 안 보고 통과한다. 축이 있는 샘플이 먼저 서는지까지 못 박는다.
  assert.match(drawn, /data-choice=/, "첫 샘플에 축이 있어야 이 자리를 잴 수 있다");
  assert.match(empty, /data-choice=/, "아무도 없을 때 축 선택자가 사라졌다");
  // **명단은 그대로 있다** — 지운 것이 아니라 안 건네준 것이다.
  const after = nodes.get("focus-buttons").children;
  assert.deepEqual(after.slice(1).map((b) => b.textContent), named, "명단이 사라졌다");
  assert.equal(after[0]["aria-pressed"], "true", "고른 것이 안 눌렸다");
  assert.equal(nodes.get("tabs").children.length, tabsBefore, "편집기 탭이 달라졌다");

  // 다른 subject 를 누르면 보던 것이 그대로 돌아온다.
  after[1]._on.click();
  assert.equal(nodes.get("view").innerHTML.includes(named[0]), drawn.includes(named[0]),
    "돌아온 화면이 다르다");
  assert.ok(!nodes.get("view").innerHTML.includes('class="slot"'), "값이 있는데 빈 자리가 남았다");

  // **눌린 것을 다시 누르면 풀린다.** 「아무도 고르지 않음」으로 가는 길이 이것이라
  // 단추를 더 세우지 않는다 — 없어지면 그 상태를 화면에서 볼 길이 사라진다.
  const picked = nodes.get("focus-buttons").children[1];
  assert.equal(picked["aria-pressed"], "true", "누른 것이 안 눌렸다");
  picked._on.click();
  assert.equal(nodes.get("focus-buttons").children[1]["aria-pressed"], "false", "다시 눌러도 안 풀린다");
  assert.match(nodes.get("watching").innerHTML, /보는 중/, "아무도 안 골랐다는 것을 화면이 안 말한다");

  // 걷어낸 것들이 화면에 없다. 있던 자리를 다시 채우면 여기서 걸린다.
  // 코드 주석이 아니라 **마크업**만 본다.
  const markup = page.split('<script type="module">')[0];
  for (const gone of ["focus-free", 'class="legend"', 'id="status"', 'id="about"', "명단"]) {
    assert.ok(!markup.includes(gone), `걷어낸 것이 돌아왔다: ${gone}`);
  }
  // 명단은 사람이 JSON 으로 쓰는 탭이 아니라 화면의 동작이다. **그 동작이 탭 줄로 들어갔다** —
  // 브라우저가 하는 그대로라 툴바의 단추 둘이 빠지고 그 줄이 짧아졌다.
  assert.ok(!markup.includes('id="add-subject"') && !markup.includes('id="drop-subject"'),
    "툴바에 단추가 남았다");
  for (const tab of nodes.get("tabs").children) assert.ok(!String(tab.innerHTML).includes("명단"));

  // **탭은 값 한 벌마다 하나다.** subject 마다 값 한 벌이 정확히 하나이므로 탭이 곧 subject 다.
  const sample0 = sample(sampleNames[0]);
  const slots = () => nodes.get("tabs").children.filter((t) => t.className === "tab-slot");
  const tabNames = () => slots().map((t) => String(t.children[0].innerHTML));
  assert.equal(tabNames().length, sample0.values.length + 1, "템플릿 하나 + 값 한 벌마다 하나");
  for (const doc of sample0.values) {
    assert.ok(tabNames().some((n) => n.includes(doc.subjectLabel ?? doc.subjectId)), `탭이 없다: ${doc.subjectId}`);
  }
  assert.ok(!markup.includes("tab-group"), "묶는 말이 돌아왔다");
  assert.ok(!markup.includes("분석 전"), "미분석 표시가 되살아났다");
  assert.ok(!markup.includes("no-values") && !markup.includes("drop-values"),
    "값 한 벌만 지우고 만드는 길이 되살아났다");

  // **탭 줄 끝이 새 탭을 열고, 탭마다 닫는 자리가 있다.** 브라우저가 하는 그대로다.
  const addTab = () => nodes.get("tabs").children.find((t) => t.className === "tab-add");
  const closeOf = (slot) => slot.children.find((c) => c.className === "tab-x");
  const seats = () => nodes.get("focus-buttons").children.length; // 아무도 없을 때 + 자리들
  const tabs = () => slots().length; // 템플릿 + 값 한 벌마다 하나
  // 처음에는 템플릿 탭이 고른 것이 아니다 — 샘플을 올리면 첫 탭(템플릿)이 선다.
  const state0Closable = slots().filter((one) => closeOf(one)).length;
  assert.ok(state0Closable <= 1, "닫는 자리가 여럿 섰다");
  assert.ok(addTab(), "새 탭을 여는 자리가 없다");
  // **템플릿 탭은 닫히지 않는다** — subject 가 아니다.
  assert.equal(closeOf(slots()[0]), undefined, "템플릿 탭에 닫는 자리가 섰다");
  // 닫는 자리는 **지금 고른 탭에만** 선다 — 좁은 화면에서 고르려다 닫는 일을 줄인다.

  const blanks = () => (nodes.get("view").innerHTML.match(new RegExp(NO_VALUE, "g")) ?? []).length;
  const before = seats();
  const beforeTabs = tabs();
  const wasBlank = blanks();

  // **더하고 지우는 것은 subject 하나뿐이다.** 더하면 전부 비어 있는 값 한 벌이 생긴다 —
  // 그것이 「아직 채우지 않았다」를 만드는 길이다.
  assert.ok(!nodes.get("view").innerHTML.includes(">subject-"), "새 자리는 아직 없다");
  addTab()._on.click();
  assert.equal(seats(), before + 1, "자리가 하나 늘어야 한다");
  assert.equal(tabs(), beforeTabs + 1, "탭이 함께 생겨야 한다");
  assert.ok(nodes.get("view").innerHTML.includes(">subject-"), "새 자리가 분석뷰에 서야 한다");
  assert.ok(blanks() > wasBlank, "새 자리의 모든 facet 이 값 없음으로 그려져야 한다");
  const made = parseJson(nodes.get("editor").value);
  assert.ok(Object.values(made.facets).every((f) => Object.values(f.fields).every((e) => e.state === "empty")),
    "만들어진 값 한 벌이 전부 비어 있어야 한다");
  assert.ok(Object.values(made.facets).every((f) => (f.notes ?? []).length > 0),
    "왜 비었는지 주석이 말해야 한다");

  // 지우는 길은 하나다 — 지금 고른 탭의 닫는 자리다.
  const here = slots().find((one) => closeOf(one));
  assert.ok(here, "고른 탭에 닫는 자리가 없다");
  closeOf(here)._on.click();
  assert.equal(seats(), before, "자리가 도로 줄어야 한다");
  assert.equal(tabs(), beforeTabs, "탭도 도로 줄어야 한다");
  assert.ok(!nodes.get("view").innerHTML.includes(">subject-"));
  assert.equal(blanks(), wasBlank);
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});
