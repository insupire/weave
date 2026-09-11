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
  tabs: [], // { id, label, text } — 템플릿 하나와 값 한 벌들
  active: 0,
  subjects: [], // 명단. weave-render-args 의 subjects 다
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

function loadSample(key) {
  const sample = SAMPLES[key];
  state.sample = key;
  state.tabs = [
    { id: "template", label: "템플릿", text: sample.template },
    ...sample.values.map((v, i) => ({ id: `values-${i}`, label: v.label, text: v.text })),
  ];
  state.active = 0;
  state.seq = state.tabs.length;
  state.subjects = sample.args.subjects.map((s) => ({ ...s }));
  state.focus = sample.args.focus ?? null;
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

const tabOf = (id) => state.tabs.find((t) => t.id === id);
const valueTabs = () => state.tabs.filter((t) => t.id.startsWith("values-"));

function read() {
  const problems = [];
  // 탭을 id 로 되찾지 않고 그 자리에서 읽는다 — 값 한 벌을 지웠다 더하면 id 가 겹칠 수 있다.
  const take = (tab) => {
    if (!tab || tab.text.trim() === "") return null;
    const { doc, error } = parse(tab.text);
    if (error) problems.push(`${tab.label}: JSON 으로 읽지 못했다 — ${error}`);
    return doc;
  };
  const template = take(tabOf("template"));
  const values = [];
  for (const tab of valueTabs()) {
    const doc = take(tab);
    if (doc) values.push(doc);
  }
  return { template, values, problems };
}

function escapeText(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function drawTabs() {
  const bar = $("tabs");
  bar.innerHTML = "";
  let grouped = false;
  state.tabs.forEach((tab, index) => {
    // 템플릿은 하나, 값 한 벌은 여럿. 말 하나가 뒤를 묶어 종류를 가른다.
    if (!grouped && tab.id.startsWith("values-")) {
      grouped = true;
      const mark = document.createElement("span");
      mark.className = "tab-group";
      mark.textContent = "값 한 벌";
      bar.appendChild(mark);
    }
    const button = document.createElement("button");
    button.className = tab.id === "template" ? "tab tab-template" : "tab tab-values";
    button.type = "button";
    button.setAttribute("aria-pressed", String(index === state.active));
    const broken = tab.text.trim() !== "" && parse(tab.text).error;
    button.innerHTML = `${escapeText(tab.label)}${broken ? ' <span class="bad">!</span>' : ""}`;
    button.addEventListener("click", () => {
      state.tabs[state.active].text = $("editor").value;
      state.active = index;
      drawTabs();
      drawEditor();
    });
    bar.appendChild(button);
  });
}

function drawEditor() {
  const editor = $("editor");
  editor.value = state.tabs[state.active].text;
  editor.setAttribute("aria-label", state.tabs[state.active].label);
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
  drawFocus(view?.seats ?? state.subjects.map((s) => ({ id: s.id, name: s.label || s.id })));

  const all = [...problems, ...report];
  const strip = $("strip");
  strip.innerHTML = all.length
    ? `<b>렌더가 그리지 못한 자리 ${all.length}</b><ul>${all.map((l) => `<li>${escapeText(l)}</li>`).join("")}</ul>`
    : "";
  drawTabs();
}

// ---------------------------------------------------------------- subject 를 더하고 뺀다

/** 더하는 동작은 하나다 — 자리와 값 한 벌이 함께 생긴다. 흔한 경우에 같은 일이기 때문이다. */
function addSubject() {
  state.tabs[state.active].text = $("editor").value;
  const { doc } = parse(tabOf("template").text);
  state.seq += 1;
  const seat = { id: `subject-${state.seq}`, label: `subject-${state.seq}` };
  state.subjects.push(seat);

  const skeleton = { weave: "1", templateId: doc?.id ?? "", subjectId: seat.id, subjectLabel: seat.label, facets: {} };
  for (const facet of doc?.facets ?? []) {
    skeleton.facets[facet.id] = { fields: {} };
    for (const field of facet.fields ?? []) skeleton.facets[facet.id].fields[field.key] = { state: "empty" };
  }
  state.seq += 1;
  state.tabs.push({ id: `values-${state.seq}`, label: seat.label, text: pretty(skeleton) });
  state.active = state.tabs.length - 1;
  drawTabs();
  drawEditor();
  refresh();
}

/** 지금 보고 있는 탭이 값 한 벌이면 그 subject, 아니면 마지막 자리. */
function aimedSeat() {
  const tab = state.tabs[state.active];
  const id = tab.id.startsWith("values-") ? parse(tab.text).doc?.subjectId : null;
  return state.subjects.find((s) => s.id === id) ?? state.subjects[state.subjects.length - 1];
}

function dropTabOf(seatId) {
  const index = state.tabs.findIndex((t) => t.id.startsWith("values-") && parse(t.text).doc?.subjectId === seatId);
  if (index < 0) return false;
  state.tabs.splice(index, 1);
  if (state.active >= state.tabs.length) state.active = state.tabs.length - 1;
  return true;
}

/** 값 한 벌만 지운다. **자리가 남아 아직 분석 중이 된다** — 그 상태를 만들어 보는 길이다. */
function dropValues() {
  const seat = aimedSeat();
  if (!seat || !dropTabOf(seat.id)) return;
  drawTabs();
  drawEditor();
  refresh();
}

/** 자리까지 지운다. */
function dropSubject() {
  const seat = aimedSeat();
  if (!seat) return;
  dropTabOf(seat.id);
  state.subjects = state.subjects.filter((s) => s.id !== seat.id);
  if (state.focus === seat.id) state.focus = null;
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
    refresh();
  } else {
    $("page").innerHTML = page.kind === "element" ? elementPage(page) : guidePage(page);
  }
  drawToc();
}

let timer = null;
function scheduleRefresh() {
  state.tabs[state.active].text = $("editor").value;
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
  $("drop-values").addEventListener("click", dropValues);
  $("drop-subject").addEventListener("click", dropSubject);
  $("show-elements").addEventListener("change", (event) => {
    state.showElements = Boolean(event.target.checked);
    refresh();
  });

  const first = Object.keys(SAMPLES)[0];
  picker.value = first;
  loadSample(first);
  draw();
}
