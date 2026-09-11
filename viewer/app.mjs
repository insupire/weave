// 실시간 편집·렌더. 왼쪽에서 쓰면 오른쪽이 그 자리에서 바뀐다.
//
// **판정하지 않는다.** JSON 으로 읽히는지만 보고, 스키마 판정은 Python 검사기가 갖는다.
// 여기서 통과처럼 보인다고 통과가 아니다 — 아래 안내가 그 명령을 적어 둔다.

import { renderView } from "./render.mjs";

// 빌드가 여기에 samples/ 를 박아 넣는다. file:// 에서 fetch 가 막히기 때문이다.
import { SAMPLES } from "./samples.mjs";

const $ = (id) => document.getElementById(id);
const pretty = (doc) => JSON.stringify(doc, null, 2);

/** 편집 중인 것. 문서는 전부 글로 들고 있다 — 사람이 깨진 JSON 을 지나갈 수 있어야 한다. */
const state = {
  sample: null,
  tabs: [], // { id, label, text }
  active: 0,
  focus: null,
  seq: 0, // 더한 값 한 벌의 탭 id 가 겹치지 않게 센다
  showElements: false, // 원시 요소 배지. 분석뷰의 것이 아니라 뷰어의 것이라 기본은 끔
};

function loadSample(key) {
  const sample = SAMPLES[key];
  state.sample = key;
  state.tabs = [
    { id: "template", label: "템플릿", text: sample.template },
    { id: "subjects", label: "명단", text: sample.subjects },
    ...sample.values.map((v, i) => ({ id: `values-${i}`, label: v.label, text: v.text })),
  ];
  state.active = 0;
  state.seq = state.tabs.length;
  state.focus = sample.focus ?? null;
  $("about").textContent = sample.about;
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

function tabOf(id) {
  return state.tabs.find((t) => t.id === id);
}

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
  const subjects = take(tabOf("subjects"));
  const values = [];
  for (const tab of state.tabs) {
    if (!tab.id.startsWith("values-")) continue;
    const doc = take(tab);
    if (doc) values.push(doc);
  }
  return { template, values, subjects: Array.isArray(subjects) ? subjects : null, problems };
}

// ---------------------------------------------------------------- 그리기

function drawTabs() {
  const bar = $("tabs");
  bar.innerHTML = "";
  state.tabs.forEach((tab, index) => {
    const button = document.createElement("button");
    button.className = "tab";
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

function escapeText(text) {
  const node = document.createElement("span");
  node.textContent = text;
  return node.innerHTML;
}

function drawEditor() {
  const editor = $("editor");
  editor.value = state.tabs[state.active].text;
  editor.setAttribute("aria-label", state.tabs[state.active].label);
}

function drawFocusControls(seats) {
  const box = $("focus-buttons");
  box.innerHTML = "";
  const add = (label, value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", String(state.focus === value));
    button.addEventListener("click", () => {
      state.focus = value;
      $("focus-free").value = "";
      refresh();
    });
    box.appendChild(button);
  };
  add("없음 (null)", null);
  for (const seat of seats) add(seat.name, seat.id);
}

/** 분석뷰에서 걷어낸 도구의 표시들. 없애는 게 아니라 자리를 옮긴 것이다. */
function drawStatus(view) {
  const node = $("status");
  if (!view) {
    node.textContent = "템플릿을 읽지 못해 분석뷰를 그리지 못했다.";
    return;
  }
  const analysed = view.seats.filter((s) => s.analysed).length;
  const parts = [
    `템플릿 ${view.templateId ?? "?"}`,
    `subject ${view.seats.length} 중 ${analysed} 분석됨`,
    `focus ${view.focus ?? "없음"}`,
  ];
  // 없는 id 는 결함이 아니다. 분석뷰는 focus 를 놓은 것과 똑같고 그 사실만 여기서 알린다.
  if (view.focusMissing) parts.push(`${view.focusMissing} 은 명단에 없어 focus 가 사라졌다`);
  node.textContent = parts.join(" · ");
}

function refresh() {
  const { template, values, subjects, problems } = read();
  const { html, report, view } = renderView({ template, values, subjects, focus: state.focus });
  // 오른쪽 판은 분석뷰뿐이다. 배지는 CSS 가 붙이므로 렌더가 낸 글은 그대로다.
  $("view").className = state.showElements ? "viewport show-elements" : "viewport";
  $("view").innerHTML = html;
  drawStatus(view);

  const seats =
    subjects?.filter((s) => s && typeof s.id === "string").map((s) => ({ id: s.id, name: s.label || s.id })) ??
    values.map((v) => ({ id: v.subjectId, name: v.subjectLabel || v.subjectId }));
  drawFocusControls(seats);

  const all = [...problems, ...report];
  const strip = $("strip");
  if (all.length === 0) {
    strip.innerHTML = "";
  } else {
    const items = all.map((line) => `<li>${escapeText(line)}</li>`).join("");
    strip.innerHTML = `<b>렌더가 그리지 못한 자리 ${all.length}</b><ul>${items}</ul>`;
  }
  drawTabs();
}

// ---------------------------------------------------------------- 붙이기

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

  $("show-elements").addEventListener("change", (event) => {
    state.showElements = Boolean(event.target.checked);
    refresh();
  });

  $("focus-free").addEventListener("input", (event) => {
    const raw = event.target.value.trim();
    state.focus = raw === "" ? null : raw;
    refresh();
  });

  $("add-values").addEventListener("click", () => {
    state.tabs[state.active].text = $("editor").value;
    const { doc } = parse(tabOf("template").text);
    state.seq += 1;
    const id = `subject-${state.seq}`;
    const skeleton = { weave: "1", templateId: doc?.id ?? "", subjectId: id, subjectLabel: id, facets: {} };
    for (const facet of doc?.facets ?? []) {
      skeleton.facets[facet.id] = { fields: {} };
      for (const field of facet.fields ?? []) skeleton.facets[facet.id].fields[field.key] = { state: "empty" };
    }
    state.tabs.push({ id: `values-${state.seq}`, label: `값: ${id}`, text: pretty(skeleton) });
    state.active = state.tabs.length - 1;
    drawTabs();
    drawEditor();
    refresh();
  });

  $("drop-values").addEventListener("click", () => {
    const tab = state.tabs[state.active];
    if (!tab.id.startsWith("values-")) return;
    state.tabs.splice(state.active, 1);
    state.active = 0;
    drawTabs();
    drawEditor();
    refresh();
  });

  const first = Object.keys(SAMPLES)[0];
  picker.value = first;
  loadSample(first);
}
