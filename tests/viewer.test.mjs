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
  COMPARE, ELEMENTS, KIND_LABEL, NO_ITEM, NO_ITEMS, NO_VALUE, NO_VALUE_MARK, TRACE, UNDRAWABLE,
  formatScalar, renderView, traceOf,
} from "../viewer/render.mjs";
import { ICON } from "../viewer/icons.mjs";

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
  // 자리를 가르는 것은 **이름**이다. 겹친 자리마다 누구 것인지 글로 서 있어야 한다.
  for (const name of Object.values(NAMES)) {
    assert.ok(sectionOf(html, "list").includes(name), `열 머리에 ${name} 가 없다`);
  }
  // 겹치는 쪽은 focus 를 옮겨도 subject 가 전부 그대로 서 있다.
  for (const id of Object.keys(NAMES)) {
    const part = sectionOf(fix({ focus: id }).html, "list");
    for (const name of Object.values(NAMES)) assert.ok(part.includes(name), `list/${id}: ${name}`);
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
  // 전부 빈 값 한 벌이 「아직 분석하지 않았다」를 말하는 길이 그것이다.
  const said = structuredClone(mute);
  said[0].facets[bare.facets[0].id].notes = [{ kind: "caution", text: "아직 분석하지 않았습니다." }];
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
  // list 는 축 아래 줄을 두지 않는다. 칸이 「값 없음」이라고 말한다.
  const listPart = sectionOf(fix({ values, focus: "proposal-b" }).html, "list");
  assert.ok(!listPart.includes('class="offs"'), "list 에 문장 줄이 남아 있다");
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
  const list = sectionOf(fix({ focus: "proposal-a" }).html, "list");
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

test("축은 값을 바꾸고 골격은 바꾸지 않는다", () => {
  // 축이 있는 샘플로 본다 — 말로만 설명하면 실제로 도는지 아무도 안 본다.
  const name = sampleNames.find((one) => sample(one).template.variants?.length);
  assert.ok(name, "축을 보여 주는 샘플이 없다");
  const { template, values } = sample(name);
  const variants = template.variants.map((one) => one.id);
  assert.ok(variants.length >= 2, "갈래 하나는 축이 아니다");

  const draw = (variant) => renderView({ template, values, focus: values[0].subjectId, variant });
  const shots = variants.map(draw);

  // **골격은 그대로다.** 어떤 facet 이 어떤 element 로 어떤 차례에 서는지가 달라지지 않는다.
  const bones = (html) => [...html.matchAll(/class="facet element-([a-z]+)"/g)].map((m) => m[1]).join(",");
  const titles = (html) => [...html.matchAll(/<h2 data-element="[^"]*">([^<]*)<\/h2>/g)].map((m) => m[1]).join(",");
  for (const shot of shots) {
    assert.equal(bones(shot.html), bones(shots[0].html), "축이 facet 구성을 바꾼다");
    assert.equal(titles(shot.html), titles(shots[0].html), "축이 facet 차례를 바꾼다");
  }
  // **값은 바뀐다.** 안 바뀌면 축이 하는 일이 없다.
  assert.ok(new Set(shots.map((one) => one.html)).size > 1, "축을 옮겨도 그림이 그대로다");
  // 갈리지 않는 필드는 어느 갈래에서나 같은 값이다.
  const steady = template.facets
    .flatMap((f) => f.fields.filter((d) => !d.varies).map((d) => ({ facet: f, decl: d })))
    .find(Boolean);
  assert.ok(steady, "갈리지 않는 필드도 있어야 축이 무엇인지 보인다");
  const slot = values[0].facets[steady.facet.id].fields[steady.decl.key];
  assert.ok(!("byVariant" in slot), "갈리지 않는 필드가 갈래로 쪼개져 있다");
  const said = formatScalar(steady.decl.type, slot.value);
  for (const shot of shots) assert.ok(textOf(shot.html).includes(said), "안 갈리는 값이 갈래를 탄다");

  // **없는 갈래거나 안 주면 첫 갈래다.** 빈 화면을 내지 않는다 — focus 와 같은 규칙이다.
  assert.equal(draw("아무개").view.variant, variants[0]);
  assert.equal(draw(null).view.variant, variants[0]);
  assert.equal(draw("아무개").html, shots[0].html);
  assert.deepEqual(draw(null).view.variants, template.variants);

  // **축이 없는 템플릿이 기본이다.** 지금 있는 샘플과 소비자가 그대로 돈다.
  for (const other of sampleNames.filter((one) => !sample(one).template.variants)) {
    const plain = drawSample(sample(other));
    assert.equal(plain.view.variant, null, `${other}: 축이 없는데 갈래가 생겼다`);
    assert.deepEqual(plain.view.variants, [], other);
    assert.equal(plain.html, renderView({ ...sample(other), variant: "아무개" }).html,
      `${other}: 축이 없는데 인자가 그림을 바꾼다`);
  }
});

test("렌더 인자는 값이 말할 수 없는 것뿐이다", () => {
  // 지키려던 것은 「하나」가 아니라 **「값 한 벌이 이미 아는 것은 인자가 아니다」**다.
  // 명단은 값 한 벌들이 갖고 있어 뺐고, focus 와 직전 focus 는 **앱만 아는 상호작용
  // 이력**이라 값에서 유도할 수가 없다. 그것이 여기 설 수 있는 유일한 자격이다.
  const args = read("schema/weave-render-args.schema.json");
  assert.deepEqual(Object.keys(args.properties), ["focus", "previousFocus", "variant"]);
  assert.equal(args.additionalProperties, false);
  assert.ok(!("$defs" in args), "자리(Seat) 정의가 남아 있다");
  // **고를 수 있는 것은 여기 서지 않는다.** 명단도 갈래 목록도 이미 다른 곳이 안다.
  assert.ok(!("subjects" in args.properties) && !("variants" in args.properties));
  assert.ok("variants" in read("schema/weave-template.schema.json").properties,
    "갈래 목록이 템플릿에 없다 — 그러면 subject 마다 골격이 달라진다");
  // 셋이 같은 규칙이다 — id 이거나 null 이다.
  for (const name of ["focus", "previousFocus", "variant"]) {
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
  // **facet 마다** 그 subject 가 이 자리에 못 섰다는 것이 남는다. 조용히 사라지면 안 된다.
  // 말하는 법은 둘이다 — 「값 없음」이라는 말이 서거나, **이름이 흐리게 남거나.**
  const mine = renderView({ template: FIX.template, values: [FIX.filled, blank], focus: blank.subjectId });
  for (const facet of FIX.template.facets) {
    const part = sectionOf(mine.html, facet.element);
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
  const list = sectionOf(html, "list");
  const cols = [...list.matchAll(/<col( class="is-focus")?>/g)].map((m) => Boolean(m[1]));
  assert.equal(cols.length, FIX.values.length + 1, "열 선언이 열 수와 맞지 않는다");
  assert.deepEqual(cols, [false, true, false, false], "고른 열 하나만 잡아야 한다");
  assert.ok(!/<t[hd][^>]*is-focus/.test(list), "칸마다 따로 잡아 열 안에 가로선이 생긴다");
});

test("거의 비어 있는 subject 도 focus 가 된다", () => {
  const { html, view } = fix({ focus: "proposal-b" });
  assert.equal(view.focus, "proposal-b");
  // 값이 거의 없어 이름이 설 자리가 적다. 그래도 **표의 열 선언**이 어느 자리인지 잡는다.
  const cols = [...sectionOf(html, "list").matchAll(/<col( class="is-focus")?>/g)].map((m) => Boolean(m[1]));
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

  // **bars 는 표시를 맨 앞 라벨 옆에 세운다.** 오른쪽 끝 값에 붙이면 막대 길이를 읽는
  // 자리와 겹치고, 좁아질 때 값이 먼저 줄어드는 자리라 표시가 밀린다.
  const rows = sectionOf(html, "bars").split('<div class="bar-row">').slice(1);
  const marked = rows.filter((row) => row.includes("note-mark"));
  assert.ok(marked.length > 0, "고정 케이스에 말이 붙은 막대가 있어야 한다");
  for (const row of marked) {
    const label = row.slice(0, row.indexOf('<span class="track"'));
    assert.ok(label.includes("note-mark"), `표시가 라벨 옆에 서지 않는다: ${row}`);
    assert.ok(!row.slice(row.indexOf('<span class="val">')).includes("note-mark"),
      "표시가 값 옆에 남아 있다");
  }
  // 내용은 본문에 펼쳐지지 않고 표시 안에 있다.
  const at = html.indexOf(said);
  assert.ok(at > 0, "붙은 말이 있어야 한다");
  assert.ok(html.lastIndexOf('class="note-pop"', at) > html.lastIndexOf('class="body"', at),
    "필드에 붙은 말이 본문에 펼쳐져 있다");
  // **다섯 element 가 모두 같다.** 겹치는 쪽만 본문 아래에 펴면 그것이 subject 주석처럼
  // 읽혀 순서가 둘이 된다 — 그 자리를 여기서 막는다.
  let checkedFields = 0;
  for (const doc of FIX.values) {
    const page = fix({ focus: doc.subjectId }).html;
    for (const facet of FIX.template.facets) {
      const part = sectionOf(page, facet.element);
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
  // 갈래를 가리키는 것만 — 주석 넷과 primitive element 다섯.
  assert.deepEqual(
    Object.keys(ICON).sort(),
    [...Object.keys(KIND_LABEL), ...Object.keys(ELEMENTS)].sort(),
  );
  // 심각도를 말하는 그림을 쓰지 않는다.
  // 도메인(돈·병원·서류) 그림은 여전히 안 된다.
  for (const banned of ["banknote", "coins", "wallet", "hospital", "stethoscope", "receipt"]) {
    assert.ok(!src.includes(banned), `도메인 아이콘: ${banned}`);
  }
  // 주석 넷은 통용되는 UI 시맨틱을 따른다 — 사람이 준 예 그대로.
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
  // **다섯 element 에서 같은지 본다.** 하나만 보면 「몇몇은 또 그렇지 않다」를 못 잡는다.
  // subject 도 옮겨 가며 본다 — 어느 조합에서도 규칙은 하나여야 한다.
  let checked = 0;
  for (const doc of FIX.values) {
    const html = fix({ focus: doc.subjectId }).html;
    for (const facet of FIX.template.facets) {
      if (!(facet.notes ?? []).length) continue;
      const part = sectionOf(html, facet.element);
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
      const part = sectionOf(html, facet.element);
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
  // element 로 갈리지 않으므로 다섯 자리에서 같은 것을 본다.
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
  const none = sectionOf(fix({ focus: null }).html, "list");
  assert.ok(textOf(none).includes(mineOf(FIX.values[0], "riders")[0]), "첫 subject 의 말이 서야 한다");
  assert.ok(!textOf(none).includes(mineOf(FIX.values[2], "riders")[0]));

  // **값에 붙은 말을 본문 아래에 펴는 자리(line · list)도 같은 규칙을 따른다.**
  // 여기가 감춰지지 않고 펴지는 유일한 자리라, 규칙이 갈리면 화면에서 바로 드러난다.
  const curve = "갱신 예상표를 그대로 옮겼습니다."; // proposal-a 의 premium-curve
  const riders = "특약 목록은 비어 있습니다."; // proposal-c 의 rider-list
  assert.ok(textOf(sectionOf(fix({ focus: "proposal-a" }).html, "line")).includes(curve));
  assert.ok(!textOf(sectionOf(fix({ focus: "proposal-c" }).html, "line")).includes(curve),
    "line: 고르지 않은 subject 의 값에 붙은 말이 펴져 있다");
  assert.ok(textOf(sectionOf(fix({ focus: "proposal-c" }).html, "list")).includes(riders));
  assert.ok(!textOf(sectionOf(fix({ focus: "proposal-a" }).html, "list")).includes(riders),
    "list: 고르지 않은 subject 의 값에 붙은 말이 펴져 있다");

  // **facet 에 붙은 말은 그대로 전부 선다** — 그건 subject 의 것이 아니다.
  for (const doc of FIX.values) {
    const html = fix({ focus: doc.subjectId }).html;
    for (const facet of FIX.template.facets) {
      for (const note of facet.notes ?? []) {
        assert.ok(textOf(sectionOf(html, facet.element)).includes(note.text),
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

test("템플릿 주석은 아직 분석된 subject 가 하나도 없어도 남는다", () => {
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
  // 상태 선언은 셋뿐이고 이름이 렌더의 갈래와 같다 — 하나 더 끼워 넣을 자리가 없다.
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
  for (const html of [fix({ focus: "proposal-a" }).html, ...sampleNames.map((n) => drawSample(sample(n)).html)]) {
    for (const [, style] of html.matchAll(/style="([^"]*)"/g)) {
      assert.match(style, /^width:[\d.]+%$/, `값이 시각을 정한다: ${style}`);
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
  // 갈래 넷이 모두 그려진다.
  const icons = [...fix().html.matchAll(/<svg class="kind-icon note-([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(icons)].sort(), [...kinds].sort());

  // 4. 순위·경고를 뜻하는 기호가 없다.
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

test("list 의 열은 균일하고 표만 옆으로 굴린다", () => {
  const css = fs.readFileSync(path.join(ROOT, "viewer/style.css"), "utf-8");
  // **고른 열은 통째로 잡히고 잘리지 않는다.** 칸마다 두르면 열 안에 가로선이 생기고,
  // 스크롤 상자는 한 축만 굴릴 수 없어 여백이 없으면 테두리가 모서리에서 잘린다.
  assert.match(css, /col\.is-focus \{[^}]*border:\d+px solid var\(--ink\)/);
  assert.match(css, /\.table-scroll \{[^}]*padding:\d/);
  // 표는 자기 스크롤 상자 안에 있다 — 페이지 전체가 옆으로 밀리면 띠도 목차도 사라진다.
  assert.match(sectionOf(fix().html, "list"), /<div class="table-scroll"><table class="items"/);
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
  assert.ok(!/text-align:\s*center/.test(css), "가운데 정렬");
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

test("샘플은 서로 다른 템플릿 짜임으로 갈린다", () => {
  // 수는 python 쪽이 센다 — 두 군데서 세면 샘플을 늘릴 때마다 두 군데를 고쳐야 한다.
  assert.ok(sampleNames.length >= 4, `샘플이 너무 적다: ${sampleNames.length}`);
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
  const pages = sampleNames.map((name) => spokenOf(drawSample(sample(name)).html));
  assert.ok(pages.some((p) => p.includes(NO_VALUE)), "값 없음이 어느 샘플에도 없다");
  assert.ok(sampleNames.some((name) => drawSample(sample(name)).html.includes(NO_VALUE_MARK)),
    "값이 없다는 표기가 어느 샘플에도 서지 않는다");
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
