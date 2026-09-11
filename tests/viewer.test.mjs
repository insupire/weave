// 참조 렌더의 고정 케이스. `make viewer-test` (= node --test) 가 돌린다.
//
// facet 은 값이 있을 때와 없을 때, subject 가 하나일 때와 여럿일 때, 아직 분석되지 않은
// subject 가 섞였을 때를 갖는다. 여기에 없는 focus id 와 원시 요소 다섯 전부를 더한다.
//
// **판정은 여기 없다.** 스키마 판정의 정본은 Python 검사기이고 `tests/test_samples.py` 가
// 샘플 전부를 그것에 건다. 여기서는 「그려지는가」만 본다.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

import { ELEMENTS, KIND_LABEL, NO_ITEMS, NO_VALUE, UNANALYZED, UNDRAWABLE, formatScalar, renderView } from "../viewer/render.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf-8"));

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
  return { ...meta, template: read(path.join(dir, "template.json")), values };
}

const COMPARE = sample("proposal-compare");
const ONE = sample("one-proposal");
const HALF = sample("half-read");

/** 태그를 걷어낸 글. 사람이 화면에서 읽을 것에 가깝다. */
const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const draw = (s, overrides = {}) =>
  renderView({ template: s.template, values: s.values, subjects: s.subjects, focus: s.focus ?? null, ...overrides });

// ---------------------------------------------------------------- 원시 요소

test("원시 요소가 렌더의 분기 전부다", () => {
  const enumerated = read("schema/weave-common.schema.json").$defs.Element.enum;
  assert.deepEqual(Object.keys(ELEMENTS).sort(), [...enumerated].sort());
});

test("맨 처음 띄우는 샘플이 원시 요소 다섯을 전부 쓴다", () => {
  const first = sample(sampleNames[0]);
  const used = new Set(first.template.facets.map((f) => f.element));
  assert.deepEqual([...used].sort(), Object.keys(ELEMENTS).sort());
});

test("원시 요소 다섯이 전부 그려진다", () => {
  const { html } = draw(COMPARE);
  for (const element of Object.keys(ELEMENTS)) assert.match(html, new RegExp(`element-${element}`));
  assert.match(html, /<svg/); // line
  assert.match(html, /class="track"/); // bars
  assert.match(html, /class="facts"/); // facts
  assert.match(html, /class="items"/); // list
  assert.match(html, /class="big"/); // stat
});

test("샘플 넷이 전부 그려지고 아무것도 던지지 않는다", () => {
  assert.equal(sampleNames.length, 4);
  for (const name of sampleNames) {
    const { html, report } = draw(sample(name));
    assert.ok(html.length > 500, name);
    assert.deepEqual(report, [], `${name}: ${report.join(" | ")}`);
  }
});

// ------------------------------------------------ 렌더가 내는 것은 분석뷰뿐이다

test("렌더 결과에 도구가 덧붙인 것이 없다", () => {
  // 오른쪽 판은 앱이 그대로 가져다 쓸 분석뷰다. 뷰어의 표시가 따라가면 안 된다.
  for (const name of sampleNames) {
    const { html } = draw(sample(name));
    for (const gone of [
      "<header", // 머리말 통째로
      'class="meta"', // 템플릿 id · subject 수 · focus 상태
      'class="roster"', // 명단 chip 줄 (왼쪽 focus 버튼과 겹쳤다)
      'class="chip', "no-values", "focus-badge",
      'class="legend"', // 값 없음 / 아직 분석 중 범례
      '<span class="element"', // 제목 옆 원시 요소 배지
    ]) {
      assert.ok(!html.includes(gone), `${name}: ${gone}`);
    }
    const shown = textOf(html);
    for (const word of ["분석됨", "명단에 없다", "분석했지만 값이 없다", "값 한 벌이 아직 없다"]) {
      assert.ok(!shown.includes(word), `${name}: ${word}`);
    }
    // 원시 요소 이름이 글로 찍히지 않는다. 구조(class·data 속성)로만 남는다.
    for (const element of Object.keys(ELEMENTS)) {
      assert.ok(!html.includes(`>${element}<`), `${name}: ${element} 배지`);
    }
    assert.ok(html.startsWith("<h1>"), name); // 남는 것은 템플릿 제목과 facet 들뿐
  }
});

test("걷어낸 것들은 화면 상태로 나가 뷰어가 왼쪽에 적는다", () => {
  // 없애는 게 아니라 자리를 옮기는 것이다.
  const { view } = draw(COMPARE, { focus: "proposal-b" });
  assert.equal(view.templateId, COMPARE.template.id);
  assert.equal(view.focus, "proposal-b");
  assert.equal(view.focusMissing, null);
  assert.deepEqual(
    view.seats.map((s) => [s.id, s.name, s.analysed]),
    [
      ["proposal-a", "가 제안서", true],
      ["proposal-b", "나 제안서", true],
      ["proposal-c", "다 제안서", true],
      ["proposal-d", "라 제안서", false], // 값 한 벌이 없다
    ],
  );
});

test("원시 요소는 배지가 아니라 구조로 남는다", () => {
  // 뷰어가 켜면 CSS 가 data-element 를 읽어 배지를 그린다. 렌더가 낸 글은 그대로다.
  const { html } = draw(COMPARE);
  for (const facet of COMPARE.template.facets) {
    assert.ok(html.includes(`<h2 data-element="${facet.element}">`), facet.id);
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  assert.match(css, /\.show-elements h2\[data-element\]::after \{ content:attr\(data-element\)/);
});

// ---------------------------------------------------------------- 값

test("채워진 값이 표시 단위로 그려진다", () => {
  const shown = textOf(draw(COMPARE).html);
  for (const piece of ["87,400원", "41,200원", "240개월", "90세", "15세 ~ 65세", "20세 이상", "아니오"]) {
    assert.ok(shown.includes(piece), piece);
  }
});

test("값이 없는 facet 도 자리를 남기고 없다고 말한다", () => {
  const blank = structuredClone(COMPARE.values[0]);
  for (const facet of Object.values(blank.facets)) {
    for (const key of Object.keys(facet.fields)) facet.fields[key] = { state: "empty" };
  }
  const { html } = renderView({ template: COMPARE.template, values: [blank] });
  const shown = textOf(html);
  for (const facet of COMPARE.template.facets) {
    assert.ok(shown.includes(facet.title), facet.id);
    assert.ok(html.includes(`element-${facet.element}`), facet.id);
  }
  assert.ok(shown.includes(NO_VALUE));
  assert.ok(!textOf(html).includes(UNANALYZED));
});

test("빈 목록은 값이 없는 것과 다르다", () => {
  const only = COMPARE.values.find((v) => v.subjectId === "proposal-c");
  const shown = textOf(renderView({ template: COMPARE.template, values: [only] }).html);
  assert.ok(shown.includes(NO_ITEMS));
  assert.notEqual(NO_ITEMS, NO_VALUE);
});

// ---------------------------------------------------------------- subject 수

test("골격은 subject 가 하나일 때와 여럿일 때 같다", () => {
  const one = textOf(renderView({ template: COMPARE.template, values: [COMPARE.values[0]] }).html);
  const many = textOf(draw(COMPARE).html);
  for (const facet of COMPARE.template.facets) {
    assert.ok(one.includes(facet.title), facet.id);
    assert.ok(many.includes(facet.title), facet.id);
    for (const field of facet.fields) {
      assert.ok(one.includes(field.label), field.key);
      assert.ok(many.includes(field.label), field.key);
    }
  }
});

test("subject 하나뿐인 샘플도 골격이 온전하다", () => {
  const { html } = draw(ONE);
  assert.equal(ONE.values.length, 1);
  for (const facet of ONE.template.facets) assert.ok(html.includes(`element-${facet.element}`), facet.id);
});

// ---------------------------------------------------------------- 미분석 subject

test("값 한 벌이 없는 subject 는 아직 분석 중으로 보인다", () => {
  const { html } = draw(HALF);
  const shown = textOf(html);
  assert.ok(shown.includes(UNANALYZED));
  assert.ok(shown.includes("셋째 스캔"));
  assert.ok(html.includes('class="miss unanalyzed"'));
  assert.ok(html.includes('class="miss empty"'));
  // 명단 chip 이 아니라 facet 이 직접 말한다 — chip 은 뷰어의 것이라 렌더에서 걷었다.
  assert.ok(!html.includes("no-values"));
  assert.ok(html.includes(`<span class="badge">${UNANALYZED}</span>`), "표 머리가 말해야 한다");
});

test("아무것도 분석되지 않아도 명단과 골격이 남는다", () => {
  const { html } = renderView({ template: HALF.template, values: [], subjects: HALF.subjects });
  const shown = textOf(html);
  for (const seat of HALF.subjects) assert.ok(shown.includes(seat.label), seat.id);
  for (const facet of HALF.template.facets) assert.ok(shown.includes(facet.title), facet.id);
});

test("명단을 주지 않으면 분석된 subject 만 선다", () => {
  const body = textOf(renderView({ template: HALF.template, values: HALF.values }).html);
  assert.ok(!body.includes("셋째 스캔"));
  assert.ok(!body.includes(UNANALYZED));
});

// ---------------------------------------------------------------- focus

const focusedNames = (html) => new Set([...html.matchAll(/is-focus[^>]*>\s*<div class="who">([^<]+)<\/div>/g)].map((m) => m[1]));

test("focus 가 null 이면 아무것도 강조하지 않는다", () => {
  assert.ok(!draw(COMPARE, { focus: null }).html.includes("is-focus"));
});

test("focus 는 그 subject 하나만 잡는다", () => {
  const { html } = draw(COMPARE, { focus: "proposal-b" });
  assert.ok(html.includes("is-focus"));
  assert.deepEqual(focusedNames(html), new Set(["나 제안서"]));
});

test("아직 분석되지 않은 subject 도 focus 가 된다", () => {
  const { html } = draw(COMPARE, { focus: "proposal-d" });
  assert.deepEqual(focusedNames(html), new Set(["라 제안서"]));
});

test("없는 id 면 focus 만 사라진다", () => {
  const missing = draw(COMPARE, { focus: "proposal-zzz" });
  const released = draw(COMPARE, { focus: null });
  assert.ok(!missing.html.includes("is-focus"));
  // 분석뷰가 focus 를 놓은 것과 **통째로 같다**. 안내 문구도 렌더에 섞이지 않는다.
  assert.equal(missing.html, released.html);
  assert.ok(!missing.html.includes("proposal-zzz"));
  // 그 사실은 화면 상태로 나가고 뷰어가 왼쪽에 적는다. 결함이 아니므로 report 에 넣지 않는다.
  assert.equal(missing.view.focusMissing, "proposal-zzz");
  assert.equal(released.view.focusMissing, null);
  assert.deepEqual(missing.report, released.report);
});

// ---------------------------------------------------------------- 주석

test("주석 네 갈래가 각각 보인다", () => {
  const { html } = draw(COMPARE);
  for (const kind of ["quote", "tip", "note", "caution"]) assert.match(html, new RegExp(`note-${kind}`));
});

test("주석 갈래를 정본 이름으로 부른다", () => {
  // glossary §2.4 — 인용·팁·보충·주의. 참조 뷰어는 언어를 배우는 자리라 딴 이름을 쓰지 않는다.
  assert.deepEqual(KIND_LABEL, { quote: "인용", tip: "팁", note: "보충", caution: "주의" });
  const kinds = read("schema/weave-common.schema.json").$defs.AnnotationKind.enum;
  assert.deepEqual(Object.keys(KIND_LABEL).sort(), [...kinds].sort());
  const shown = textOf(draw(COMPARE).html);
  for (const name of Object.values(KIND_LABEL)) assert.ok(shown.includes(` ${name} `), name);
});

test("값에 붙은 것과 facet 에 붙은 것이 모두 보인다", () => {
  const shown = textOf(draw(COMPARE).html);
  assert.ok(shown.includes("합계보험료 87,400원")); // 값에 붙은 것
  assert.ok(shown.includes("설계안 2쪽 계약사항 표에서 읽었습니다.")); // 값 한 벌의 facet 에 붙은 것
  assert.ok(shown.includes("갱신형은 처음 보험료가 싼 대신")); // 템플릿 facet 에 붙은 것
});

test("템플릿 주석은 아직 분석된 subject 가 하나도 없어도 남는다", () => {
  const shown = textOf(renderView({ template: HALF.template, values: [], subjects: HALF.subjects }).html);
  for (const facet of HALF.template.facets) {
    for (const note of facet.notes ?? []) assert.ok(shown.includes(note.text), note.text.slice(0, 24));
  }
});

// ---------------------------------------------------------------- 시각을 소유하지 않는다

test("쓰는 색이 전부 무채색이다", () => {
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  const chromatic = [];
  for (const [, hex] of css.matchAll(/#([0-9a-fA-F]{3,8})\b/g)) {
    const pairs = hex.length <= 4 ? [...hex].slice(0, 3).map((c) => c + c) : [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)];
    const channels = pairs.map((p) => parseInt(p, 16));
    if (new Set(channels).size !== 1) chromatic.push(`#${hex}`);
  }
  for (const [, body] of css.matchAll(/rgba?\(([^)]+)\)/g)) {
    const channels = body.split(",").slice(0, 3).map((p) => Number(p.trim()));
    if (new Set(channels).size !== 1) chromatic.push(`rgb(${body})`);
  }
  assert.deepEqual(chromatic, [], `무채색이 아닌 색: ${chromatic.join(", ")}`);
});

test("선은 색이 아니라 점선 무늬로 갈린다", () => {
  assert.ok(draw(COMPARE).html.includes("stroke-dasharray"));
});

test("순위·등급 어휘가 화면으로 새지 않는다", () => {
  const body = draw(COMPARE, { focus: "proposal-a" }).html;
  for (const word of ["rank", "grade", "score", "1위", "추천", "best"]) {
    assert.ok(!body.includes(word), word);
  }
});

// ---------------------------------------------------------------- 판정하지 않는다

test("그리지 못하는 입력은 자리를 표시하고 까닭을 적는다", () => {
  const cases = [
    ["모르는 원시 요소", (t) => (t.facets[0].element = "rank"), /모르는 원시 요소/],
    ["필드가 없다", (t) => (t.facets[0].fields = []), /필드가 하나도 없다/],
    ["facet 이 객체가 아니다", (t) => (t.facets[0] = "ranking"), /객체가 아니다/],
  ];
  for (const [why, mutate, expected] of cases) {
    const template = structuredClone(COMPARE.template);
    mutate(template);
    const { html, report } = renderView({ template, values: COMPARE.values, subjects: COMPARE.subjects });
    assert.ok(html.includes(UNDRAWABLE), why);
    assert.match(report.join(" | "), expected, why);
    // 멈추지 않는다. 나머지 facet 은 그대로 그려진다.
    assert.ok(html.includes("element-list"), why);
  }
});

test("값의 생김새가 선언한 모양과 다르면 그 자리만 표시된다", () => {
  const values = structuredClone(COMPARE.values);
  values[0].facets["contract-terms"].fields["entry-age"].value = 40; // range 자리에 홑값
  values[0].facets["renewal-premium"].fields["premium-curve"] = { state: "filled", value: "40세부터" };
  const { html, report } = renderView({ template: COMPARE.template, values, subjects: COMPARE.subjects });
  assert.ok(html.includes(UNDRAWABLE));
  assert.equal(report.length, 2, report.join(" | "));
  assert.ok(html.includes("87,400원")); // 나머지는 멀쩡히 그려진다
});

test("템플릿에 없는 facet 과 열은 그리지 않고 적어 둔다", () => {
  const values = structuredClone(COMPARE.values);
  values[0].facets["ranking"] = { fields: {} };
  values[0].facets["riders"].fields["rider-list"].value[0].grade = "A";
  const { html, report } = renderView({ template: COMPARE.template, values, subjects: COMPARE.subjects });
  assert.match(report.join(" | "), /템플릿에 없는 facet/);
  assert.match(report.join(" | "), /템플릿에 없는 열/);
  assert.ok(!html.includes(">A<"));
});

test("템플릿이 없으면 빈 판을 내고 던지지 않는다", () => {
  const { html, report, view } = renderView({ template: null, values: COMPARE.values });
  // 그릴 분석뷰가 없다. 안내는 렌더가 아니라 뷰어가 한다.
  assert.equal(html, "");
  assert.equal(view, null);
  assert.equal(report.length, 1);
});

// ---------------------------------------------------------------- 표시 단위

test("타입 여덟이 저마다 표시 단위를 갖는다", () => {
  const cases = [
    ["number", 3.5, "3.5"],
    ["money", 50000000, "50,000,000원"],
    ["ratio", 0.5, "50%"],
    ["ratio", 0.0725, "7.25%"],
    ["duration", 240, "240개월"],
    ["age", 100, "100세"],
    ["boolean", true, "예"],
    ["boolean", false, "아니오"],
    ["text", "종신", "종신"],
    ["date", "2026-10-01", "2026-10-01"],
  ];
  for (const [type, value, shown] of cases) assert.equal(formatScalar(type, value), shown, `${type} ${value}`);
});

test("값에서 온 글은 escape 된다", () => {
  const doc = structuredClone(COMPARE.values[0]);
  doc.subjectLabel = '<script>alert("x")</script>';
  const { html } = renderView({ template: COMPARE.template, values: [doc] });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

// ---------------------------------------------------------------- 한 장이 실제로 도는가

test("빌드된 viewer.html 의 스크립트가 DOM 위에서 돈다", async () => {
  const page = fs.readFileSync(path.join(ROOT, "viewer.html"), "utf-8");
  const script = page.match(/<script type="module">([\s\S]*?)<\/script>/)[1];

  const nodes = new Map();
  const make = (tag) => ({
    tagName: tag,
    className: "",
    type: "",
    value: "",
    children: [],
    _text: "",
    innerHTML: "",
    get textContent() {
      return this._text;
    },
    set textContent(v) {
      this._text = String(v);
      this.innerHTML = this._text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    },
    appendChild(child) {
      this.children.push(child);
    },
    addEventListener() {},
    setAttribute(name, value) {
      this[name] = value;
    },
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

  assert.ok(nodes.get("view").innerHTML.includes("element-stat"), "첫 샘플이 그려져야 한다");
  assert.ok(nodes.get("about").textContent.length > 10, "샘플 설명이 붙어야 한다");
  // 분석뷰에서 걷어낸 표시가 왼쪽 상태 줄에 있어야 한다 — 없애는 게 아니라 옮기는 것이다.
  const status = nodes.get("status").textContent;
  for (const piece of ["템플릿 proposal-compare-1", "분석됨", "focus"]) {
    assert.ok(status.includes(piece), `상태 줄: ${piece}`);
  }
  assert.equal(nodes.get("view").className, "viewport", "원시 요소 배지는 기본이 꺼짐이다");
  assert.ok(nodes.get("tabs").children.length >= 3, "템플릿·명단·값 탭이 서야 한다");
  assert.equal(nodes.get("strip").innerHTML, "", "첫 샘플에는 그리지 못한 자리가 없어야 한다");
  fs.rmSync(path.dirname(file), { recursive: true, force: true });
});
