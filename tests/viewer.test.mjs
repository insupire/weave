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
  COMPARE, ELEMENTS, KIND_LABEL, NO_ITEMS, NO_VALUE, UNDRAWABLE, formatScalar, renderView,
} from "../viewer/render.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));
const parseJson = (t) => JSON.parse(t);

// ---------------------------------------------------------------- 재료

/** 값 상태 조합의 fixture. primitive element 다섯을 전부 쓰고 채움·빔·섞임 한 벌씩.
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

// ---------------------------------------------------------------- primitive element

test("primitive element 가 렌더의 분기 전부다", () => {
  const enumerated = read("schema/weave-common.schema.json").$defs.Element.enum;
  assert.deepEqual(Object.keys(ELEMENTS).sort(), [...enumerated].sort());
});

/** 한 facet 의 마크업만 잘라 낸다. element 별로 무엇이 그려졌는지 따로 본다. */
function sectionOf(html, element) {
  const at = html.indexOf(`element-${element}"`);
  assert.ok(at >= 0, `element-${element} 가 없다`);
  const end = html.indexOf("<section", at);
  return end < 0 ? html.slice(at) : html.slice(at, end);
}

test("primitive element 다섯이 전부 그려진다", () => {
  const { html } = fix();
  for (const element of Object.keys(ELEMENTS)) assert.match(html, new RegExp(`element-${element}`));
  assert.match(sectionOf(html, "stat"), /class="big"/); // 값 하나를 크게
  assert.match(sectionOf(html, "facts"), /class="facts"/); // 라벨과 값 여럿
  assert.match(sectionOf(html, "bars"), /class="track"/); // 크기 비교
  assert.match(sectionOf(html, "line"), /svg class="line"/); // 축 위의 변화
  assert.match(sectionOf(html, "list"), /table class="items"/); // 항목이 좌표다
});

const NAMES = { "proposal-a": "가 제안서", "proposal-b": "나 제안서", "proposal-c": "proposal-c" };

test("비교하는 법이 primitive element 마다 다르다", () => {
  // 겹칠 자리가 있는 것만 겹친다. 나머지는 focus 가 무엇을 그릴지 고른다.
  assert.deepEqual(COMPARE, {
    stat: "focus", facts: "focus", bars: "focus", line: "overlay", list: "overlay",
  });
  assert.deepEqual(Object.keys(COMPARE).sort(), Object.keys(ELEMENTS).sort());
});

test("line 과 list 는 subject 를 한 좌표에 겹친다", () => {
  const { html } = fix();
  // list 는 항목이 좌표다. subject 마다 표를 따로 두지 않는다.
  assert.equal((sectionOf(html, "list").match(/<table/g) ?? []).length, 1);
  // 겹치는 쪽은 focus 를 옮겨도 subject 가 전부 그대로 서 있다.
  for (const id of Object.keys(NAMES)) {
    const part = sectionOf(fix({ focus: id }).html, "list");
    for (const name of Object.values(NAMES)) assert.ok(part.includes(name), `list/${id}: ${name}`);
  }
  const lines = fix().html;
  assert.equal((sectionOf(lines, "line").match(/<svg/g) ?? []).length, 1);
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
    // 고른 subject 의 이름이 서고, 고르지 않은 subject 의 이름은 본문에 없다.
    assert.ok(one.includes('class="shown">가 제안서'), `${element}: 무엇을 보는지 안 읽힌다`);
    assert.ok(other.includes('class="shown">proposal-c'), element);
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
  assert.equal(none.view.shown, FIX.values[0].subjectId);
  for (const element of ["stat", "facts", "bars"]) {
    const part = sectionOf(none.html, element);
    assert.ok(part.includes('class="shown">가 제안서'), `${element}: 이름이 없다`);
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
  // 겹치는 쪽에서만 갈린다 — 고르면 그 선과 그 열이 강조된다.
  for (const element of ["line", "list"]) {
    assert.notEqual(sectionOf(none.html, element), sectionOf(first.html, element), element);
    assert.ok(!sectionOf(none.html, element).includes("is-focus"), `${element}: 고르지 않았는데 강조가 있다`);
  }
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
  }
});

test("걷어낸 것들은 화면 상태로 나가 뷰어가 바깥에 적는다", () => {
  const { view } = fix({ focus: "proposal-b" });
  assert.equal(view.focus, "proposal-b");
  assert.equal(view.focusMissing, null);
  assert.deepEqual(view.seats.map((s) => s.id), ["proposal-a", "proposal-b", "proposal-c"]);
});

test("primitive element 는 이름표가 아니라 구조로 남는다", () => {
  // 뷰어가 켜면 CSS 가 data-element 를 읽어 이름을 붙인다. 렌더가 낸 글은 그대로다.
  const { html } = fix();
  for (const facet of FIX.template.facets) {
    assert.ok(html.includes(`<h2 data-element="${facet.element}">`), facet.id);
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  assert.match(css, /\.show-elements h2\[data-element\]::after \{ content:attr\(data-element\)/);
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

test("값이 없는 facet 도 자리를 남기고 없다고 말한다", () => {
  // 숨기면 subject 마다 골격이 달라져 견줄 수 없다.
  const { html } = renderView({ template: FIX.template, values: [FIX.empty] });
  const shown = textOf(html);
  for (const facet of FIX.template.facets) {
    assert.ok(shown.includes(facet.title), facet.id);
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }
  assert.ok(shown.includes(NO_VALUE));
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

test("subject 가 하나여도 primitive element 다섯이 다 선다", () => {
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

test("렌더 인자는 focus 하나뿐이다", () => {
  const args = read("schema/weave-render-args.schema.json");
  assert.deepEqual(Object.keys(args.properties), ["focus"]);
  assert.equal(args.additionalProperties, false);
  assert.ok(!("$defs" in args), "자리(Seat) 정의가 남아 있다");
});

test("전부 빈 값 한 벌이 미분석의 자리를 이어받는다", () => {
  // 아직 분석하지 않았다는 것을 구조가 아니라 **빈 값과 주석**이 말한다.
  const said = "아직 분석하지 않았습니다.";
  const blank = structuredClone(FIX.empty);
  for (const facet of Object.values(blank.facets)) facet.notes = [{ kind: "caution", text: said }];
  const { html } = renderView({ template: FIX.template, values: [FIX.filled, blank] });
  const shown = textOf(html);

  for (const facet of FIX.template.facets) {
    assert.ok(shown.includes(facet.title), facet.id); // 골격은 그대로
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }
  // **facet 마다** 그 subject 가 값이 없다는 것이 보인다. 조용히 사라지면 안 된다.
  // focus 를 따라 바뀌는 쪽은 그 subject 를 골라야 그 사실이 보인다.
  const mine = renderView({ template: FIX.template, values: [FIX.filled, blank], focus: blank.subjectId });
  for (const facet of FIX.template.facets) {
    const part = textOf(sectionOf(mine.html, facet.element));
    assert.ok(part.includes(NO_VALUE), `${facet.id}: 값 없음이 안 보인다`);
  }
  // 겹치는 쪽은 축 아래에 적는다 — 얹을 자리가 없어도 이름이 남는다.
  assert.match(html, /class="offs"/);
  // 주석이 이유를 facet 마다 말한다
  assert.equal((shown.match(new RegExp(said, "g")) ?? []).length, FIX.template.facets.length);
  // 옆자리는 멀쩡히 채워진다 — 「여럿 중 하나가 거의 비어 있다」는 조합이 그대로 산다
  assert.ok(shown.includes("87,400원"));
});

test("값 한 벌이 하나도 없으면 골격만 남는다", () => {
  const { html, view } = renderView({ template: FIX.template, values: [] });
  const shown = textOf(html);
  assert.deepEqual(view.seats, []);
  for (const facet of FIX.template.facets) assert.ok(shown.includes(facet.title), facet.id);
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
});

test("거의 비어 있는 subject 도 focus 가 된다", () => {
  const { html } = fix({ focus: "proposal-b" });
  assert.deepEqual(focusedNames(html), new Set(["나 제안서"]));
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

test("주석 갈래를 정본 이름으로 부른다", () => {
  // glossary §2.4 — 인용·팁·보충·주의. 참조 뷰어는 언어를 배우는 자리라 딴 이름을 쓰지 않는다.
  assert.deepEqual(KIND_LABEL, { quote: "인용", tip: "팁", note: "보충", caution: "주의" });
  const kinds = read("schema/weave-common.schema.json").$defs.AnnotationKind.enum;
  assert.deepEqual(Object.keys(KIND_LABEL).sort(), [...kinds].sort());
  const shown = textOf(fix().html);
  for (const name of Object.values(KIND_LABEL)) assert.ok(shown.includes(` ${name} `), name);
});

test("값에 붙은 것과 facet 에 붙은 것이 모두 보인다", () => {
  const shown = textOf(fix().html);
  assert.ok(shown.includes("합계보험료 87,400원")); // 값에 붙은 것
  assert.ok(shown.includes("설계안 2쪽 계약사항 표에서 읽었습니다.")); // 값 한 벌의 facet 에 붙은 것
  assert.ok(shown.includes("계약의 뼈대가 되는 조건들입니다.")); // 템플릿 facet 에 붙은 것
});

test("템플릿 주석은 아직 분석된 subject 가 하나도 없어도 남는다", () => {
  const shown = textOf(renderView({ template: FIX.template, values: [] }).html);
  for (const facet of FIX.template.facets) {
    assert.ok(facet.notes?.length, `${facet.id}: fixture 가 템플릿 주석을 가져야 한다`);
    for (const note of facet.notes) assert.ok(shown.includes(note.text), note.text.slice(0, 20));
  }
});

// ---------------------------------------------------------------- 시각을 소유하지 않는다

test("쓰는 색이 전부 무채색이다", () => {
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const chromatic = [];
  for (const [, hex] of css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const pairs = hex.length <= 4 ? [...hex].slice(0, 3).map((c) => c + c) : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
    if (new Set(pairs.map((p) => parseInt(p, 16))).size !== 1) chromatic.push(`#${hex}`);
  }
  for (const [, body] of css.matchAll(/rgba?\(([^)]+)\)/g)) {
    const channels = body.split(",").slice(0, 3).map((p) => Number(p.trim()));
    if (new Set(channels).size !== 1) chromatic.push(`rgb(${body})`);
  }
  assert.deepEqual(chromatic, [], `무채색이 아닌 색: ${chromatic.join(", ")}`);
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

  // 주석 네 갈래가 시각을 달리 갖지 않는다 — 갈래이지 심각도가 아니다
  for (const kind of ["quote", "tip", "note", "caution"]) {
    assert.ok(!css.includes(`.note-${kind}`), `갈래별 시각: ${kind}`);
  }

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
  assert.ok(!/text-align:\s*center/.test(css), "가운데 정렬");
});

test("선은 색이 아니라 점선 무늬로 갈린다", () => {
  // 선이 둘 이상일 때만 갈릴 일이 생긴다. 둘째 선을 여기서 만든다.
  const values = structuredClone(FIX.values);
  values[2].facets["premium-by-age"].fields["premium-curve"] = {
    state: "filled",
    value: [{ at: 40, value: 60000 }, { at: 50, value: 90000 }, { at: 60, value: 140000 }],
  };
  const { html } = fix({ values });
  assert.equal((html.match(/<polyline/g) ?? []).length, 2);
  assert.ok(html.includes("stroke-dasharray"));
  // 색으로 가르지 않는다 — 선에 stroke 색을 따로 주지 않는다.
  assert.ok(!/<polyline[^>]*stroke="/.test(html));
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
    assert.ok(html.includes("element-list"), why); // 멈추지 않는다
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

test("타입 여덟이 저마다 표시 단위를 갖는다", () => {
  const cases = [
    ["number", 3.5, "3.5"], ["money", 50000000, "50,000,000원"],
    ["ratio", 0.5, "50%"], ["ratio", 0.0725, "7.25%"],
    ["duration", 240, "240개월"], ["age", 100, "100세"],
    ["boolean", true, "예"], ["boolean", false, "아니오"],
    ["text", "종신", "종신"], ["date", "2026-10-01", "2026-10-01"],
  ];
  for (const [type, value, shown] of cases) assert.equal(formatScalar(type, value), shown, `${type} ${value}`);
});

test("값에서 온 글은 escape 된다", () => {
  const doc = structuredClone(FIX.filled);
  doc.subjectLabel = '<script>alert("x")</script>';
  const { html } = renderView({ template: FIX.template, values: [doc] });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

// ---------------------------------------------------------------- 샘플은 템플릿 샘플이다

test("샘플 넷은 서로 다른 템플릿 짜임이다", () => {
  assert.equal(sampleNames.length, 4);
  const shapes = sampleNames.map((name) => {
    const t = sample(name).template;
    return JSON.stringify(t.facets.map((f) => f.element));
  });
  assert.equal(new Set(shapes).size, shapes.length, `짜임이 겹친다: ${shapes.join(" / ")}`);
  // 값 상태가 아니라 짜임이 축이다. facet 수도 서로 달라야 한 눈에 갈린다.
  const counts = sampleNames.map((name) => sample(name).template.facets.length);
  assert.equal(new Set(counts).size, counts.length, `facet 수가 겹친다: ${counts.join(", ")}`);
});

test("맨 처음 띄우는 샘플이 primitive element 다섯을 전부 쓴다", () => {
  const first = sample(sampleNames[0]);
  assert.deepEqual([...new Set(first.template.facets.map((f) => f.element))].sort(), Object.keys(ELEMENTS).sort());
});

test("샘플 넷이 전부 그려지고 아무것도 던지지 않는다", () => {
  for (const name of sampleNames) {
    const { html, report } = drawSample(sample(name));
    assert.ok(html.length > 300, name);
    assert.deepEqual(report, [], `${name}: ${report.join(" | ")}`);
  }
});

test("값이 비는 경우가 샘플에도 남아 있다", () => {
  // 샘플을 가르는 축은 아니지만 그 상태는 여전히 보여야 한다.
  const pages = sampleNames.map((name) => textOf(drawSample(sample(name)).html));
  assert.ok(pages.some((p) => p.includes(NO_VALUE)), "값 없음이 어느 샘플에도 없다");
  // 전부 빈 값 한 벌이 미분석의 자리를 이어받았다. 샘플에도 그 한 벌이 있어야 한다.
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
  for (const row of elementPages()) {
    assert.equal(row.compare, COMPARE[row.id], `${row.id}: 설명서와 렌더가 다르다`);
    assert.equal(row.compareSaid, row.compare === "overlay" ? "겹친다" : "focus 를 따라 바뀐다");
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
  // 산문과 제약이 갈리면 여기서 걸린다.
  for (const row of elementPages()) {
    const facet = row.demo.template.facets[0];
    assert.equal(facet.element, row.id);
    const [low, high] = row.fields.includes("–") ? row.fields.split("–").map(Number) : [Number(row.fields), Number(row.fields)];
    assert.ok(facet.fields.length >= low && facet.fields.length <= high, `${row.id}: 필드 수`);
    for (const field of facet.fields) {
      assert.ok(row.shapes.includes(field.shape), `${row.id}: shape ${field.shape}`);
      if (field.type) assert.ok(row.types.includes(field.type), `${row.id}: type ${field.type}`);
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
    setAttribute(name, value) { this[name] = value; },
  });
  globalThis.document = {
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
  assert.ok(nodes.get("toc").children.length >= PAGES.length, "목차가 서야 한다");
  assert.ok(nodes.get("page").innerHTML.includes(PAGES[0].title), "첫 쪽이 그려져야 한다");
  assert.equal(nodes.get("page").hidden, false);
  assert.equal(nodes.get("playground").hidden, true, "플레이그라운드는 고른 뒤에 선다");
  // 플레이그라운드의 DOM 은 살아 있다. 편집 중인 글이 쪽을 옮겨도 안 날아간다.
  assert.ok(nodes.get("view").innerHTML.includes("element-stat"), "첫 샘플이 그려져야 한다");
  assert.ok(nodes.get("editor").value.includes('"weave"'), "편집기에 템플릿이 올라야 한다");
  assert.ok(nodes.get("tabs").children.length >= 2, "템플릿 탭과 값 탭이 서야 한다");
  assert.equal(nodes.get("view").className, "viewport", "primitive element 이름은 기본이 꺼짐이다");
  assert.equal(nodes.get("strip").innerHTML, "", "첫 샘플에는 그리지 못한 자리가 없어야 한다");

  // 걷어낸 것들이 화면에 없다. 있던 자리를 다시 채우면 여기서 걸린다.
  // 코드 주석이 아니라 **마크업**만 본다.
  const markup = page.split('<script type="module">')[0];
  for (const gone of ["focus-free", 'class="legend"', 'id="status"', 'id="about"', "명단"]) {
    assert.ok(!markup.includes(gone), `걷어낸 것이 돌아왔다: ${gone}`);
  }
  // 명단은 사람이 JSON 으로 쓰는 탭이 아니라 화면의 동작이다.
  assert.ok(markup.includes('id="add-subject"') && markup.includes('id="drop-subject"'));
  for (const tab of nodes.get("tabs").children) assert.ok(!String(tab.innerHTML).includes("명단"));

  // **탭은 값 한 벌마다 하나다.** subject 마다 값 한 벌이 정확히 하나이므로 탭이 곧 subject 다.
  const sample0 = sample(sampleNames[0]);
  const tabNames = () => nodes.get("tabs").children.map((t) => String(t.innerHTML));
  assert.equal(tabNames().length, sample0.values.length + 1, "템플릿 하나 + 값 한 벌마다 하나");
  for (const doc of sample0.values) {
    assert.ok(tabNames().some((n) => n.includes(doc.subjectLabel ?? doc.subjectId)), `탭이 없다: ${doc.subjectId}`);
  }
  assert.ok(!markup.includes("tab-group"), "묶는 말이 돌아왔다");
  assert.ok(!markup.includes("분석 전"), "미분석 표시가 되살아났다");
  assert.ok(!markup.includes("no-values") && !markup.includes("drop-values"),
    "값 한 벌만 지우고 만드는 길이 되살아났다");

  const click = (id) => nodes.get(id)._on.click();
  const seats = () => nodes.get("focus-buttons").children.length; // none + 자리들
  const tabs = () => nodes.get("tabs").children.length; // 템플릿 + 값 한 벌마다 하나
  const blanks = () => (nodes.get("view").innerHTML.match(new RegExp(NO_VALUE, "g")) ?? []).length;
  const before = seats();
  const beforeTabs = tabs();
  const wasBlank = blanks();

  // **더하고 지우는 것은 subject 하나뿐이다.** 더하면 전부 비어 있는 값 한 벌이 생긴다 —
  // 그것이 「아직 분석하지 않았다」를 만드는 길이다.
  assert.ok(!nodes.get("view").innerHTML.includes(">subject-"), "새 자리는 아직 없다");
  click("add-subject");
  assert.equal(seats(), before + 1, "자리가 하나 늘어야 한다");
  assert.equal(tabs(), beforeTabs + 1, "탭이 함께 생겨야 한다");
  assert.ok(nodes.get("view").innerHTML.includes(">subject-"), "새 자리가 분석뷰에 서야 한다");
  assert.ok(blanks() > wasBlank, "새 자리의 모든 facet 이 값 없음으로 그려져야 한다");
  const made = parseJson(nodes.get("editor").value);
  assert.ok(Object.values(made.facets).every((f) => Object.values(f.fields).every((e) => e.state === "empty")),
    "만들어진 값 한 벌이 전부 비어 있어야 한다");
  assert.ok(Object.values(made.facets).every((f) => (f.notes ?? []).length > 0),
    "왜 비었는지 주석이 말해야 한다");

  // 지우는 길은 하나다.
  click("drop-subject");
  assert.equal(seats(), before, "자리가 도로 줄어야 한다");
  assert.equal(tabs(), beforeTabs, "탭도 도로 줄어야 한다");
  assert.ok(!nodes.get("view").innerHTML.includes(">subject-"));
  assert.equal(blanks(), wasBlank);
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});
