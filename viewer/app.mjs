// weave 설명서. 이 한 장이 설명서이고 플레이그라운드는 그 안의 한 자리다.
//
// 왼쪽에 목차, 가운데에 본문. element 쪽 본문은 제약과 최소 템플릿 조각과 **그 자리에서 그린 모습**이다.
// 목차의 정본은 카탈로그다 — primitive element 가 늘거나 줄면 목차가 따라 바뀐다.
//
// **판정하지 않는다.** JSON 으로 읽히는지만 보고 스키마 판정은 Python 검사기가 갖는다.

import { esc, renderView } from "./render.mjs";
import { SAMPLES } from "./samples.mjs";
import { PAGES } from "./catalog.mjs";
import { ICON } from "./icons.mjs";

const $ = (id) => document.getElementById(id);

// 목차의 primitive element 표시. **구조를 가리킬 뿐 도메인을 가리키지 않는다** —
// 돈·병원·서류 같은 그림을 두지 않는다. 다섯이 같은 크기·같은 선 굵기다.
function elementIcon(id) {
  const body = ICON[id];
  if (!body) return "";
  return `<svg class="toc-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">${body}</svg>`;
}
const pretty = (doc) => JSON.stringify(doc, null, 2);

const state = {
  page: PAGES[0].id,
  sample: null,
  templateText: "", // 템플릿 하나. 모든 값이 여기 매인다
  values: [], // 값 한 벌들의 글. **subject 마다 정확히 하나이고 이것이 곧 명단이다**
  active: 0, // 0 은 템플릿, 1 부터는 values 의 자리
  focus: null,
  // **바로 전에 보던 subject.** 값에서 유도할 수 없는 상호작용 이력이라 앱이 갖는다 —
  // 겹치는 선은 이것으로 「지금 보는 것 · 직전에 보던 것 · 나머지」를 가른다.
  previousFocus: null,
  // 고르는 자리마다 무엇을 골랐는지. 사람이 누른 것이라 값이 아니라 여기 산다.
  choices: {},
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
    link.className = page.kind === "element" ? "toc-link has-icon" : "toc-link";
    link.innerHTML = `${elementIcon(page.id)}${escapeText(page.title)}`;
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
  const draw = (focus) => renderView({ template: page.demo.template, values: page.demo.values, focus }).html;
  const types = page.everyType
    ? `${page.types.length} 가지 전부`
    : page.types.map((t) => `<code>${esc(t)}</code>`).join(" · ");

  // focus 를 따라 바뀌는 것은 정지 화면 하나로 못 보인다. 고른 것을 달리한 두 장을 나란히 둔다.
  const shots =
    page.compare === "focus"
      ? page.demo.values
          .map((doc) => {
            const who = doc.subjectLabel || doc.subjectId;
            return `<div class="shot"><div class="shot-said">고른 것 — ${esc(who)}</div>` +
              `<div class="demo">${draw(doc.subjectId)}</div></div>`;
          })
          .join("")
      : `<div class="demo">${draw(null)}</div>`;

  return (
    `<header class="page-head"><h1><code>${esc(page.title)}</code></h1>` +
    `<p class="lead">${esc(page.draws)}</p></header>` +
    `<dl class="limits">` +
    `<dt>비교</dt><dd>${esc(page.compareSaid)}</dd>` +
    `<dt>아무도 없을 때</dt><dd>${esc(page.blank)}</dd>` +
    `<dt>필드 수</dt><dd>${esc(page.fields)}</dd>` +
    `<dt>shape</dt><dd>${page.shapes.map((x) => `<code>${esc(x)}</code>`).join(" · ")}</dd>` +
    `<dt>type</dt><dd>${types}</dd>` +
    `</dl>` +
    `<p class="note-line">${esc(page.note)}</p>` +
    `<h2>그려진 모습</h2>${shots}` +
    `<h2>그것을 만든 템플릿</h2>` +
    `<pre>${esc(JSON.stringify(page.demo.template.facets[0], null, 2))}</pre>`
  );
}

// ---------------------------------------------------------------- 플레이그라운드
//
// **탭은 값 한 벌마다 하나다.** subject 마다 값 한 벌이 정확히 하나 있으므로 탭이 곧 subject 다.
// 값 한 벌이 없는 subject 라는 것이 없으니 자리와 값을 가르던 상태도 없다.
// 아직 분석하지 않았다는 것은 **전부 비어 있는 값 한 벌과 주석**이 말한다.

function loadSample(key) {
  const sample = SAMPLES[key];
  state.sample = key;
  state.templateText = sample.template;
  state.values = sample.values.map((v) => v.text);
  state.focus = sample.args.focus ?? null;
  state.previousFocus = sample.args.previousFocus ?? null;
  state.choices = { ...(sample.args.choices ?? {}) };
  state.active = 0;
  state.seq = state.values.length;
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

/** 탭 이름. 값 한 벌이 스스로 말한다 — 명단을 따로 두지 않는다. */
function nameOf(text, index) {
  const { doc } = parse(text);
  return doc?.subjectLabel || doc?.subjectId || `값 한 벌 ${index + 1}`;
}

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
  state.values.forEach((text, index) => {
    const doc = take(nameOf(text, index), text);
    if (doc) values.push(doc);
  });
  return { template, values, problems };
}

function escapeText(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function stash() {
  if (state.active === 0) state.templateText = $("editor").value;
  else state.values[state.active - 1] = $("editor").value;
}

function drawTabs() {
  const bar = $("tabs");
  bar.innerHTML = "";
  const tabs = [
    { name: "템플릿", text: state.templateText, template: true },
    ...state.values.map((text, index) => ({ name: nameOf(text, index), text, template: false })),
  ];
  tabs.forEach((tab, index) => {
    const button = document.createElement("button");
    button.className = tab.template ? "tab tab-template" : "tab tab-subject";
    button.type = "button";
    button.setAttribute("aria-pressed", String(index === state.active));
    const broken = tab.text && tab.text.trim() !== "" && parse(tab.text).error;
    button.innerHTML = `${escapeText(tab.name)}${broken ? ' <span class="bad">!</span>' : ""}`;
    button.addEventListener("click", () => {
      stash();
      state.active = index;
      drawTabs();
      drawEditor();
    });
    bar.appendChild(button);
  });
}

function drawEditor() {
  const editor = $("editor");
  editor.value = state.active === 0 ? state.templateText : state.values[state.active - 1];
  editor.setAttribute("aria-label", state.active === 0 ? "템플릿" : nameOf(editor.value, state.active - 1));
}

/** focus 를 짧게 나열한다. 항목은 none 과 각 subject 의 이름이다. */
function drawFocus(seats) {
  const box = $("focus-buttons");
  box.innerHTML = "";
  // 이름만 선다. subject 를 색으로 가르지 않으므로 색 조각을 앞에 두지 않는다.
  const add = (label, value, title) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pick";
    button.textContent = label;
    if (title) button.setAttribute("title", title);
    button.setAttribute("aria-pressed", String(state.focus === value));
    button.addEventListener("click", () => {
      // 누르는 순간 지금 보던 것이 직전이 된다. 같은 것을 다시 누르면 아무 일도 없다.
      if (value === state.focus) return;
      state.previousFocus = state.focus;
      state.focus = value;
      refresh();
    });
    box.appendChild(button);
  };
  add("none", null, "아무도 고르지 않음 — 겹치는 것은 강조를 풀고, 고르는 것은 첫 subject 로 돌아간다");
  for (const seat of seats) add(seat.name, seat.id, seat.id);
}

function refresh() {
  const { template, values, problems } = read();
  const { html, report, view } = renderView({
    template,
    values,
    focus: state.focus,
    previousFocus: state.previousFocus,
    choices: state.choices,
  });
  // 오른쪽 판은 분석뷰뿐이다. 이름표는 CSS 가 붙이므로 렌더가 낸 글은 그대로다.
  $("view").className = state.showElements ? "viewport show-elements" : "viewport";
  $("view").innerHTML = html;
  drawFocus(view?.seats ?? []);
  // 무엇을 보고 있는지는 화면에 한 번. 고른 것이 있으면 눌린 버튼이 이미 말하므로,
  // 말해 주지 못할 때(고른 것 없음)만 적는다.
  const watching = (view?.seats ?? []).find((s) => s.id === view?.shown);
  $("watching").innerHTML =
    watching && state.focus === null ? `보는 중 <b>${escapeText(watching.name)}</b>` : "";

  const all = [...problems, ...report];
  const strip = $("strip");
  strip.innerHTML = all.length
    ? `<b>렌더가 그리지 못한 자리 ${all.length}</b><ul>${all.map((l) => `<li>${escapeText(l)}</li>`).join("")}</ul>`
    : "";
  drawTabs();
}

// ------------------------------------------------ subject 를 더하고 빼는 것은 화면의 동작이다

/** 더하는 것도 지우는 것도 subject 하나뿐이다. 더할 때 값 한 벌은 **전부 비어** 있다. */
function addSubject() {
  stash();
  const { doc } = parse(state.templateText);
  state.seq += 1;
  const id = `subject-${state.seq}`;
  const blank = { weave: "1", templateId: doc?.id ?? "", subjectId: id, subjectLabel: id, facets: {} };
  for (const facet of doc?.facets ?? []) {
    blank.facets[facet.id] = {
      fields: Object.fromEntries((facet.fields ?? []).map((f) => [f.key, { state: "empty" }])),
      notes: [{ kind: "caution", text: "아직 분석하지 않았습니다." }],
    };
  }
  state.values.push(pretty(blank));
  state.active = state.values.length;
  drawTabs();
  drawEditor();
  refresh();
}

function dropSubject() {
  stash();
  const index = state.active === 0 ? state.values.length - 1 : state.active - 1;
  if (index < 0) return;
  const { doc } = parse(state.values[index]);
  if (doc?.subjectId && state.focus === doc.subjectId) state.focus = null;
  if (doc?.subjectId && state.previousFocus === doc.subjectId) state.previousFocus = null;
  state.values.splice(index, 1);
  if (state.active > state.values.length) state.active = state.values.length;
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

  // **붙은 말을 여는 길 셋.** 가리키기와 초점은 CSS 가 맡고, **누르기는 여기서 맡는다** —
  // 손가락에는 가리키기가 없고, 글자 위의 초점은 기기마다 달리 돈다. 눌러서 켜는 표시를
  // 따로 두면 어느 기기에서나 같은 길이 된다.
  const shut = (mark) => {
    mark?.classList.remove("is-open");
    mark?.blur();
  };
  const shutAll = () => document.querySelectorAll(".note-mark.is-open").forEach(shut);
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".pop-close")) {
      shut(event.target.closest(".note-mark"));
      return;
    }
    // 열린 판 안을 누르는 것은 읽는 일이다. 닫지 않는다.
    if (event.target.closest?.(".note-pop")) return;
    const mark = event.target.closest?.(".note-mark");
    const open = mark?.classList.contains("is-open");
    shutAll(); // 한 번에 하나만 열린다 — 판이 겹치면 어느 값의 말인지 알 수 없다
    if (mark && !open) mark.classList.add("is-open");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    shut(document.activeElement?.closest?.(".note-mark"));
    shutAll();
  });
  // **축은 분석뷰 안에 선다.** 렌더가 낸 자리를 눌러 고른다 — 앱은 상태만 갖는다.
  $("view").addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-option]");
    const slot = button?.closest?.("[data-choice]");
    if (!slot) return;
    state.choices = { ...state.choices, [slot.dataset.choice]: button.dataset.option };
    refresh();
  });

  // 전화기에서 어느 판을 세울지. 넓은 화면에서는 이 줄이 CSS 로 감춰져 뜻이 없다.
  $("pane-pick").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-pane]");
    if (!button) return;
    const editing = button.dataset.pane === "edit";
    $("playground").classList.toggle("editing", editing);
    for (const one of $("pane-pick").querySelectorAll("button[data-pane]")) {
      one.setAttribute("aria-pressed", String((one.dataset.pane === "edit") === editing));
    }
  });
  $("add-subject").addEventListener("click", addSubject);
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
