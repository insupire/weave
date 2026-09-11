// weave 설명서. 이 한 장이 설명서이고 플레이그라운드는 그 안의 한 자리다.
//
// 왼쪽에 목차, 가운데에 본문. element 쪽 본문은 제약과 최소 템플릿 조각과 **그 자리에서 그린 모습**이다.
// 목차의 정본은 카탈로그다 — primitive element 가 늘거나 줄면 목차가 따라 바뀐다.
//
// **판정하지 않는다.** JSON 으로 읽히는지만 보고 스키마 판정은 Python 검사기가 갖는다.

import { esc, renderView } from "./render.mjs";
import { SAMPLES } from "./samples.mjs";
import { PAGES } from "./catalog.mjs";

const $ = (id) => document.getElementById(id);
const pretty = (doc) => JSON.stringify(doc, null, 2);

const state = {
  page: PAGES[0].id,
  sample: null,
  templateText: "", // 템플릿 하나. 모든 값이 여기 매인다
  values: {}, // subjectId → 값 한 벌의 글. 없는 자리는 키가 없다
  subjects: [], // 명단. weave-render-args 의 subjects 다
  active: "template", // "template" 또는 subject 의 id. 탭은 subject 단위다
  focus: null,
  seq: 0,
  showElements: false, // primitive element 이름. 분석뷰의 것이 아니라 설명서의 것이라 기본은 끔
};

const pageOf = (id) => PAGES.find((p) => p.id === id) ?? PAGES[0];

// ---------------------------------------------------------------- 목차

function drawToc() {
  const toc = $("toc");
  toc.innerHTML = "";
  let group = null;
  for (const page of PAGES) {
    if (page.group !== group) {
      group = page.group;
      const head = document.createElement("div");
      head.className = "group";
      head.textContent = group;
      toc.appendChild(head);
    }
    const link = document.createElement("button");
    link.type = "button";
    link.className = "toc-link";
    link.textContent = page.title;
    link.setAttribute("aria-pressed", String(page.id === state.page));
    link.addEventListener("click", () => {
      state.page = page.id;
      draw();
    });
    toc.appendChild(link);
  }
}

// ---------------------------------------------------------------- 설명서 본문

function guidePage(page) {
  return (
    `<header class="page-head"><h1>${esc(page.title)}</h1><p class="lead">${esc(page.lead)}</p></header>` +
    page.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")
  );
}

function elementPage(page) {
  const { html } = renderView({
    template: page.demo.template,
    values: page.demo.values,
    subjects: page.demo.subjects,
    focus: null,
  });
  const types = page.everyType
    ? `${page.types.length} 가지 전부`
    : page.types.map((t) => `<code>${esc(t)}</code>`).join(" · ");
  return (
    `<header class="page-head"><h1><code>${esc(page.title)}</code></h1>` +
    `<p class="lead">${esc(page.draws)}</p></header>` +
    `<dl class="limits">` +
    `<dt>필드 수</dt><dd>${esc(page.fields)}</dd>` +
    `<dt>shape</dt><dd>${page.shapes.map((x) => `<code>${esc(x)}</code>`).join(" · ")}</dd>` +
    `<dt>type</dt><dd>${types}</dd>` +
    `</dl>` +
    `<p class="note-line">${esc(page.note)}</p>` +
    `<h2>그려진 모습</h2><div class="demo">${html}</div>` +
    `<h2>그것을 만든 템플릿</h2>` +
    `<pre>${esc(JSON.stringify(page.demo.template.facets[0], null, 2))}</pre>`
  );
}

// ---------------------------------------------------------------- 플레이그라운드
//
// **탭은 subject 단위다.** 명단에 있는 subject 는 값 한 벌이 있든 없든 전부 탭을 갖는다.
// 탭 하나가 곧 subject 이므로 「값 한 벌」이라고 또 적지 않는다.
//
// 계약은 그대로다 — subject 는 비교 대상 자체이고 값 한 벌은 그것에 대해 분석이 알아낸 것이다.
// 둘이 같다면 「subject 는 있는데 값이 아직 없다」를 말할 수 없다. 합친 것은 화면의 탭뿐이다.

function loadSample(key) {
  const sample = SAMPLES[key];
  state.sample = key;
  state.templateText = sample.template;
  state.values = Object.fromEntries(sample.values.map((v) => [v.id, v.text]));
  state.subjects = sample.args.subjects.map((s) => ({ ...s }));
  state.focus = sample.args.focus ?? null;
  state.active = "template";
  state.seq = state.subjects.length;
  // 플레이그라운드의 DOM 은 쪽을 보고 있지 않아도 채워 둔다 — 옮겨 가도 편집 중인 글이 산다.
  drawTabs();
  drawEditor();
  refresh();
}

function parse(text) {
  try {
    return { doc: JSON.parse(text), error: null };
  } catch (exc) {
    return { doc: null, error: exc.message };
  }
}

const seatOf = (id) => state.subjects.find((s) => s.id === id);
const hasValues = (id) => Object.prototype.hasOwnProperty.call(state.values, id);
/** 탭 이름. 명단의 이름을 쓰고, 없으면 값 한 벌의 것을, 그것도 없으면 id 를 쓴다. */
const seatName = (seat) => seat.label || parse(state.values[seat.id] ?? "").doc?.subjectLabel || seat.id;
/** 지금 보고 있는 subject. 템플릿 탭이면 마지막 자리. */
const aimedSeat = () => seatOf(state.active) ?? state.subjects[state.subjects.length - 1];

function read() {
  const problems = [];
  const take = (label, text) => {
    if (!text || text.trim() === "") return null;
    const { doc, error } = parse(text);
    if (error) problems.push(`${label}: JSON 으로 읽지 못했다 — ${error}`);
    return doc;
  };
  const template = take("템플릿", state.templateText);
  const values = [];
  for (const seat of state.subjects) {
    if (!hasValues(seat.id)) continue;
    const doc = take(seatName(seat), state.values[seat.id]);
    if (doc) values.push(doc);
  }
  return { template, values, problems };
}

function escapeText(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function stash() {
  if (state.active === "template") state.templateText = $("editor").value;
  else if (hasValues(state.active)) state.values[state.active] = $("editor").value;
}

function drawTabs() {
  const bar = $("tabs");
  bar.innerHTML = "";
  const tabs = [
    { id: "template", name: "템플릿", blank: false, text: state.templateText },
    ...state.subjects.map((seat) => ({
      id: seat.id,
      name: seatName(seat),
      blank: !hasValues(seat.id),
      text: state.values[seat.id],
    })),
  ];
  for (const tab of tabs) {
    const button = document.createElement("button");
    button.className = tab.id === "template" ? "tab tab-template" : "tab tab-subject";
    button.type = "button";
    button.setAttribute("aria-pressed", String(tab.id === state.active));
    const broken = !tab.blank && tab.text && tab.text.trim() !== "" && parse(tab.text).error;
    // 아직 분석 전임을 장식이 아니라 글로 말한다.
    const state_mark = tab.blank ? ' <small class="tab-state">분석 전</small>' : "";
    button.innerHTML = `${escapeText(tab.name)}${state_mark}${broken ? ' <span class="bad">!</span>' : ""}`;
    button.addEventListener("click", () => {
      stash();
      state.active = tab.id;
      drawTabs();
      drawEditor();
      refresh();
    });
    bar.appendChild(button);
  }
}

function drawEditor() {
  const blank = state.active !== "template" && !hasValues(state.active);
  $("editor").hidden = blank;
  $("no-values").hidden = !blank;
  $("drop-values").hidden = blank || state.active === "template";
  if (blank) {
    const seat = seatOf(state.active);
    // 「에」는 받침을 타지 않아 어느 이름 뒤에도 붙는다.
    $("no-values-said").textContent =
      `아직 분석 전입니다. 「${seat ? seatName(seat) : state.active}」에 값 한 벌이 없어 분석뷰에서 「아직 분석 중」으로 섭니다.`;
    return;
  }
  const editor = $("editor");
  editor.value = state.active === "template" ? state.templateText : state.values[state.active];
  editor.setAttribute("aria-label", state.active === "template" ? "템플릿" : state.active);
}

/** focus 를 짧게 나열한다. 항목은 none 과 각 subject 의 이름이다. */
function drawFocus(seats) {
  const box = $("focus-buttons");
  box.innerHTML = "";
  const add = (label, value, title) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pick";
    button.textContent = label;
    if (title) button.setAttribute("title", title);
    button.setAttribute("aria-pressed", String(state.focus === value));
    button.addEventListener("click", () => {
      state.focus = value;
      refresh();
    });
    box.appendChild(button);
  };
  add("none", null);
  for (const seat of seats) add(seat.name, seat.id, seat.id);
}

function refresh() {
  const { template, values, problems } = read();
  const { html, report, view } = renderView({
    template,
    values,
    subjects: state.subjects,
    focus: state.focus,
  });
  // 오른쪽 판은 분석뷰뿐이다. 이름표는 CSS 가 붙이므로 렌더가 낸 글은 그대로다.
  $("view").className = state.showElements ? "viewport show-elements" : "viewport";
  $("view").innerHTML = html;
  drawFocus(view?.seats ?? state.subjects.map((s) => ({ id: s.id, name: seatName(s) })));

  const all = [...problems, ...report];
  const strip = $("strip");
  strip.innerHTML = all.length
    ? `<b>렌더가 그리지 못한 자리 ${all.length}</b><ul>${all.map((l) => `<li>${escapeText(l)}</li>`).join("")}</ul>`
    : "";
  drawTabs();
}

// ------------------------------------------------ subject 를 더하고 빼는 것은 화면의 동작이다

function skeleton(seat) {
  const { doc } = parse(state.templateText);
  const out = { weave: "1", templateId: doc?.id ?? "", subjectId: seat.id, subjectLabel: seatName(seat), facets: {} };
  for (const facet of doc?.facets ?? []) {
    out.facets[facet.id] = { fields: {} };
    for (const field of facet.fields ?? []) out.facets[facet.id].fields[field.key] = { state: "empty" };
  }
  return pretty(out);
}

/** 더하는 동작은 하나다 — 자리와 값 한 벌이 함께 생긴다. */
function addSubject() {
  stash();
  state.seq += 1;
  const seat = { id: `subject-${state.seq}`, label: `subject-${state.seq}` };
  state.subjects.push(seat);
  state.values[seat.id] = skeleton(seat);
  state.active = seat.id;
  drawTabs();
  drawEditor();
  refresh();
}

/** 자리까지 지운다. */
function dropSubject() {
  stash();
  const seat = aimedSeat();
  if (!seat) return;
  state.subjects = state.subjects.filter((s) => s.id !== seat.id);
  delete state.values[seat.id];
  if (state.focus === seat.id) state.focus = null;
  if (state.active === seat.id) state.active = "template";
  drawTabs();
  drawEditor();
  refresh();
}

/** 값 한 벌만 지운다. **자리가 남아 아직 분석 중이 된다** — 그 상태를 만들어 보는 길이다. */
function dropValues() {
  stash();
  const seat = seatOf(state.active);
  if (!seat || !hasValues(seat.id)) return;
  delete state.values[seat.id];
  drawTabs();
  drawEditor();
  refresh();
}

/** 그 자리에서 값 한 벌을 만든다. 위의 되돌리기이지 두 번째 더하기가 아니다. */
function makeValues() {
  const seat = seatOf(state.active);
  if (!seat || hasValues(seat.id)) return;
  state.values[seat.id] = skeleton(seat);
  drawTabs();
  drawEditor();
  refresh();
}

// ---------------------------------------------------------------- 그리기

function draw() {
  const page = pageOf(state.page);
  const playing = page.kind === "playground";
  $("page").hidden = playing;
  $("playground").hidden = !playing;
  if (playing) {
    $("pg-title").textContent = page.title;
    $("pg-lead").textContent = page.lead;
    drawTabs();
    drawEditor();
    refresh();
  } else {
    $("page").innerHTML = page.kind === "element" ? elementPage(page) : guidePage(page);
  }
  drawToc();
}

let timer = null;
function scheduleRefresh() {
  stash();
  clearTimeout(timer);
  timer = setTimeout(refresh, 140);
}

export function start() {
  const picker = $("sample");
  for (const [key, sample] of Object.entries(SAMPLES)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = sample.name;
    picker.appendChild(option);
  }
  picker.addEventListener("change", () => loadSample(picker.value));
  $("editor").addEventListener("input", scheduleRefresh);
  $("add-subject").addEventListener("click", addSubject);
  $("drop-subject").addEventListener("click", dropSubject);
  $("drop-values").addEventListener("click", dropValues);
  $("make-values").addEventListener("click", makeValues);
  $("show-elements").addEventListener("change", (event) => {
    state.showElements = Boolean(event.target.checked);
    refresh();
  });

  const first = Object.keys(SAMPLES)[0];
  picker.value = first;
  loadSample(first);
  draw();
}
