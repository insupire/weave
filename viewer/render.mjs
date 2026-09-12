// 참조 렌더. 무엇이 올바른 렌더인지의 기준이다.
//
// 순수 함수다 — 문서를 받아 HTML 문자열을 낸다. DOM 을 모른다. 그래서 브라우저 없이도
// 고정 케이스를 걸 수 있다 (`tests/viewer.test.mjs`).
//
// **facet 종류를 아는 분기가 없다.** element 로만 고른다 (ELEMENTS 표).
// **subject 마다 값 한 벌이 정확히 하나 있다.** 비어 있을 수 있고, 누가 자리에 서는지는 그 값 한 벌들이
// 말한다 — 명단을 따로 받지 않는다. 아직 분석되지 않았다는 것도 특별한 상태가 아니라
// **전부 비어 있는 값 한 벌과 주석**이 말한다.
// **판정하지 않는다.** 스키마 판정의 정본은 Python 검사기 하나다. 여기서는 그리지 못하는
// 자리를 표시하고 무엇이 이상한지 적기만 한다.

import { ICON } from "./icons.mjs";

// 주석 갈래 넷의 **정본 이름**이다(glossary §2.4). 참조 뷰어는 언어를 배우는 자리라
// 읽기 좋은 딴 이름을 쓰지 않는다 — 제품 화면의 라벨은 앱이 따로 정한다.
export const KIND_LABEL = { quote: "인용", tip: "팁", note: "보충", caution: "주의" };

// **없다는 말 넷.** 뜻이 다르면 표기도 달라야 한다 — 뭉개면 「모른다」와 「없다」가 같아진다.
export const NO_VALUE = "값 없음"; // 그 필드에 값이 없다
export const NO_ITEM = "없음"; // 목록은 읽었는데 그 항목이 여기 없다
export const NO_ITEMS = "항목 없음"; // 목록 자체가 비었다 — 아무 subject 도 항목이 없다
export const UNDRAWABLE = "그리지 못한다"; // 값의 문제가 아니라 템플릿과 값이 어긋났다

/**
 * **표기는 「모른다」를 가리킨다. 아는 사실은 글로 말한다.**
 *
 * 「값 없음」이라는 글은 값보다 길어 자리를 먹고 여러 개가 모이면 화면을 덮는다. 그래서
 * 표기로 줄였다. 하지만 줄일 수 있는 것은 **값이 없다는 것 하나뿐**이다 — 나머지는 전부
 * 우리가 **아는 사실**이라 글이 제값을 한다.
 *
 * - 「없음」 — 목록을 읽었고 그 항목이 없다는 것을 **안다**
 * - 「항목 없음」 — 목록이 비었다는 것을 **안다**
 * - 「있음」 — 있다는 것을 **안다**
 * - 「그리지 못한다: …」 — 무엇이 어긋났는지 **안다**
 *
 * 표기 둘을 눈으로 가르려다 쓰다 만 글자처럼 보이느니, 아는 것은 말하게 두는 편이 낫다.
 * **빈 칸으로 두지 않는다** — 아무것도 없으면 렌더가 깨진 것과 구별되지 않는다.
 * **읽어 주는 기계에는 말이 남는다** — 표기는 이름표로 제 뜻을 말한다.
 */
export const NO_VALUE_MARK = "—"; // 표에서 빈 자리를 가리키는 통용 표기

/**
 * **선이 갈리는 세 갈래.** subject 가 아니라 **상태**다 — 같은 subject 라도 focus 가
 * 옮겨 가면 갈래가 바뀐다. 걷어낸 subject 팔레트를 되살리는 것이 아니다.
 *
 * 색으로 가르되 **색에만 기대지 않는다** — 굵기와 진하기가 같은 순서를 함께 말한다.
 * 색을 못 보는 사람에게도 지금 무엇을 보고 있는지가 갈려야 한다.
 * 누가 누구인지는 여전히 **선 끝의 이름**이 말한다.
 *
 * 평가가 아니다. 뚜렷한 것이 「더 좋은 것」이 아니라 **보고 있는 것**이다 —
 * 그래서 경고색·성공색 계열을 쓰지 않는다.
 */
export const TRACE = ["now", "prior", "rest"];

/** 선 하나가 어느 갈래인지. **오직 화면 상태에서만 나온다** — id 도 차례도 보지 않는다. */
export function traceOf(id, focus, prior) {
  if (focus !== null && id === focus) return "now";
  // 직전이 현재와 같을 수는 없다. 같은 id 가 들어오면 직전이 없는 것으로 본다.
  if (prior !== null && prior !== focus && id === prior) return "prior";
  return "rest";
}

export function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

// ---------------------------------------------------------------- 값 읽기

/**
 * 값 한 자리를 읽는다.
 *
 * **고르는 자리를 타는 필드면 고른 것의 값을 읽는다.** 고른 것이 바뀌어도 읽는 자리는
 * 그대로이고 값만 달라진다 — 이 한 줄이 「고르는 자리는 facet 구성을 바꾸지 않는다」를
 * 구조로 지킨다. 어느 자리를 타는지는 **템플릿의 필드 선언**이 말한다.
 */
function cell(valueset, facetId, decl, chosen) {
  const key = typeof decl === "string" ? decl : decl?.key;
  if (!valueset) return { state: "empty", entry: null };
  const facet = valueset.facets?.[facetId];
  if (!facet) return { state: "empty", entry: null };
  const slot = facet.fields?.[key];
  const rides = typeof decl === "string" ? null : decl?.choice;
  const entry = slot?.byOption ? (rides ? slot.byOption[chosen?.[rides]] : null) : slot;
  if (!entry || entry.state !== "filled") return { state: "empty", entry: entry ?? null };
  return { state: "filled", entry };
}

function facetNotes(valueset, facetId) {
  return valueset?.facets?.[facetId]?.notes ?? [];
}

// ---------------------------------------------------------------- 값 쓰기

function grouped(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  return value.toLocaleString("en-US", { maximumFractionDigits: 10 });
}

export function formatScalar(type, value) {
  if (type === "boolean") return value ? "예" : "아니오";
  if (type === "text" || type === "date") return String(value);
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  if (type === "money") return `${grouped(value)}원`;
  if (type === "ratio") return `${grouped(Math.round(value * 1e10) / 1e8)}%`;
  // 배수는 비율이 아니다 — 0.049 가 4.9% 이고 4.9 가 4.9 배다. 단위를 글로 열지 않고 타입을 하나 둔다.
  if (type === "multiple") return `${grouped(value)}배`;
  if (type === "duration") return `${grouped(value)}개월`;
  if (type === "age") return `${grouped(value)}세`;
  return grouped(value);
}

export function formatValue(decl, value) {
  if (decl.shape === "single") return formatScalar(decl.type, value);
  if (decl.shape === "range") {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
    const low = "min" in value ? formatScalar(decl.type, value.min) : null;
    const high = "max" in value ? formatScalar(decl.type, value.max) : null;
    if (low !== null && high !== null) return `${low} ~ ${high}`;
    if (low !== null) return `${low} 이상`;
    if (high !== null) return `${high} 이하`;
    return null;
  }
  return null;
}

function axisNumber(axis, raw) {
  if (axis === "date") {
    const ms = Date.parse(`${raw}T00:00:00Z`);
    return Number.isNaN(ms) ? null : ms / 86400000;
  }
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

// ---------------------------------------------------------------- HTML 조각

/** 갈래 표시. **통용되는 UI 시맨틱을 따른다** — 주의는 warning, 보충은 info.
 *  색은 갈래(`note-<kind>`)에서만 나온다. 값이나 subject 에서는 나오지 않는다. */
function kindIcon(kind) {
  const body = ICON[kind];
  if (!body) return "";
  return (
    `<svg class="kind-icon note-${esc(kind)}" viewBox="0 0 24 24" width="14" height="14" ` +
    `aria-hidden="true">${body}</svg>`
  );
}

/**
 * **필드에 붙는 주석.** 본문에 펼치지 않고 표시를 세워 그 자리에서 연다.
 *
 * **표시는 하나이고 중립이다.** 갈래를 값 옆에 늘어놓지 않는다 — 표시가 갈래를 따라
 * 달라지면 값이 갈래로 물들고, 그것은 「평가를 색으로 말하지 않는다」에서 걷어낸 자리다.
 * 값 옆의 표시가 하는 말은 **「여기 붙은 말이 있다」** 하나뿐이다.
 * **갈래는 툴팁 안에서 산다** — 열면 줄마다 자기 갈래 표시와 색을 갖는다.
 *
 * 여는 길 셋 — 가리키기(hover) · 초점(키보드) · 좁은 화면에서는 아래에서 올라오는 판.
 */
function markPop(inside, aria, kind = "") {
  return (
    `<span class="note-mark${kind ? ` ${kind}` : ""}" tabindex="0" role="button" ` +
    `aria-label="${esc(aria)}">` +
    `<svg class="mark-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">${ICON.note}</svg>` +
    `<span class="note-pop" role="tooltip">${inside}` +
    `<button type="button" class="pop-close">닫기</button></span></span>`
  );
}

function notePop(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  // **수를 적지 않는다.** 값 옆에 서는 것은 표시 하나뿐이다 — 몇 개인지는 열면 보인다.
  // 세는 것은 읽는 사람의 일이 아니고, 수가 붙으면 값 옆이 다시 붐빈다.
  // (기계가 읽는 이름표에는 남는다. 눈에 보이는 글이 아니다.)
  return markPop(notesHtml(notes), `붙은 말 ${notes.length}`);
}

/**
 * 주석 묶음 하나.
 *
 * `where` 는 **지금 아무도 주지 않는다** — 주석이 늘 고른 subject 것만 나오므로 이름이
 * 그 사실을 두 번 말하고, 두 묶음을 가르는 일은 짧은 선이 맡는다. 자리를 남겨 둔 것은
 * **되돌리기 쉽게** 하려는 것이다: subject 것을 내는 호출에 이름을 둘째 인자로 주면 된다.
 */
/**
 * **이 필드가 무엇인지.** 필드 **이름 옆**의 표시를 열면 나온다.
 *
 * **자리가 뜻을 가른다** — 이름 옆은 템플릿의 것(모든 subject 에 같다), 값 옆은 그 subject 의
 * 값에 대한 말이다. 양끝으로 갈리니 섞이지 않는다.
 *
 * 여는·닫는 길은 값 주석이 쓰는 것과 **같은 것**이다 — 길 두 벌을 만들지 않는다.
 */
function hintMark(decl) {
  return decl?.hint ? markPop(`<p class="hint">${esc(decl.hint)}</p>`, "이 필드가 무엇인지", "hint-mark") : "";
}

function notesHtml(notes, where = "") {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  const rows = notes.map((note) => {
    const kind = note?.kind ?? "note";
    const label = KIND_LABEL[kind] ?? kind;
    const prefix = where ? `<b class="who">${esc(where)}</b> ` : "";
    return (
      `<li class="note note-${esc(kind)}"><span class="kind">${kindIcon(kind)}${esc(label)}</span>` +
      `<span class="text">${prefix}${esc(note?.text ?? "")}</span></li>`
    );
  });
  return `<ul class="notes">${rows.join("")}</ul>`;
}

/**
 * **아직 아무도 오지 않은 자리.**
 *
 * subject 가 하나도 없을 때 값이 설 곳에 선다. 표기(`—`)를 쓰지 않는다 — 그것은
 * **어떤 subject 의 값을 모른다**는 말인데, 여기엔 모를 subject 자체가 없다.
 *
 * **가짜 값을 그리지 않는다.** 예시 숫자나 흐린 더미 값은 진짜 값으로 읽히는 순간
 * 우리가 지켜온 것이 무너진다. 그려도 되는 것은 **자리**뿐이라 빈 칸에 줄만 긋는다.
 * 깜빡이거나 움직이지 않는다 — 「기다리는 중」은 앱이 얹을 말이고 언어의 것이 아니다.
 */
function slot(said = "값이 올 자리") {
  return `<span class="slot" role="img" aria-label="${esc(said)}"></span>`;
}

/** 모른다는 **표기**. 왜 없는지는 주석이 글로 말한다. */
function missMark() {
  return (
    `<span class="miss value" role="img" aria-label="${esc(NO_VALUE)}" title="${esc(NO_VALUE)}">` +
    `${NO_VALUE_MARK}</span>`
  );
}

// 그리지 못한 자리. 렌더는 멈추지 않고 자리를 표시하고 까닭을 적는다.
function undrawable(report, where, why, shown) {
  report.push(`${where}: ${why}`);
  // **조용해지지 않는다.** 값이 없는 것이 아니라 템플릿과 값이 어긋난 것이라 표기로 줄이지
  // 않는다 — 글이 서고 무엇이 어긋났는지 적는다. 가름표는 표기(—)와 섞이지 않게 쌍점이다.
  return `<span class="undrawable" title="${esc(why)}">${UNDRAWABLE}: ${esc(shown ?? why)}</span>`;
}

function drawCell(report, where, decl, value) {
  const shown = formatValue(decl, value);
  if (shown === null) {
    return undrawable(report, where, `선언한 모양(${decl.shape ?? "없음"})과 값의 생김새가 다르다`, JSON.stringify(value));
  }
  return esc(shown);
}

// ---------------------------------------------------------------- primitive element 다섯

// ---------------------------------------------------------------- 비교하는 법 둘
//
// 순위 문법을 스키마에서 뺀 대신 **비교를 시각이 맡는다**(glossary §3.14 원칙 7).
// 다만 방법이 하나가 아니다 — **primitive element 마다 다르게 비교한다.**
//
// - **겹친다** (`line` · `list`) — 축이나 항목이라는 공유하는 자리가 있어 겹칠수록 읽을 것이 많아진다.
// - **focus 를 따라 바뀐다** (`stat` · `facts` · `bars`) — 겹칠 자리가 없어 억지로 늘어놓는 대신
//   **무엇을 그릴지 focus 가 고른다.** focus 가 강조 장치에서 고르는 자리로 커진다.
//
// **focus 가 없으면 첫 subject 를 그린다.** 늘어놓기로 돌아가지 않고, 빈 화면을 내지 않고,
// 무엇을 보고 있는지 이름으로 늘 말한다. 차례는 값 한 벌이 넘어온 차례이고 배치일 뿐 우열이 아니다.
export const COMPARE = {
  stat: "focus", facts: "focus", bars: "focus", rows: "focus", parts: "focus",
  line: "overlay", list: "overlay",
};

/**
 * 겹치는 쪽에서 **고른 subject** 가 자리에 못 섰다는 말.
 *
 * **범례가 아니다.** 못 선 subject 를 줄줄이 적으면 그것이 범례다 — 안 보고 있는 것까지
 * 이름을 늘어놓게 된다. 지금 보고 있는 것에 값이 없으면 그건 알아야 하므로 **그때만**
 * 선다. 「말은 언제나 고른 subject 것」과 같은 줄이고, 이름을 적지 않는 까닭도 같다 —
 * 고른 것 하나뿐이라 이름이 그 사실을 두 번 말한다.
 */
function blankRow(missing, ctx) {
  const mine = missing.find((one) => one.id === ctx.shown);
  if (!mine) return "";
  return `<div class="offs"><span class="off-said">${esc(NO_VALUE)}</span>${mine.mark ?? ""}</div>`;
}

/**
 * **자를 잴 때 보는 값 전부.** 그 필드의 모든 subject × 모든 고를 것.
 *
 * `cell` 은 **지금 고른 것**을 읽지만 자는 그것만 보면 안 된다 — 무엇을 누르든 자가
 * 안 움직여야 길이가 뜻을 지킨다. focus 를 옮겨도 자가 안 움직이게 subject 전체로
 * 잰 것과 같은 까닭이고, 고르는 자리가 들어오면서 잴 것이 한 겹 늘었을 뿐이다.
 */
function everyValue(ctx, facet, decl) {
  const out = [];
  for (const subject of ctx.subjects) {
    const slot = ctx.byId.get(subject.id)?.facets?.[facet.id]?.fields?.[decl.key];
    if (!slot) continue;
    for (const entry of slot.byOption ? Object.values(slot.byOption) : [slot]) {
      if (entry?.state === "filled") out.push(entry.value);
    }
  }
  return out;
}

/** 자가 0 이 아닌 값을 길이 0 으로 지우지 않게 두는 바닥. 「값이 없다」와 구별되어야 한다. */
const FLOOR = 0.8;

function readsOf(ctx, facet, decl) {
  return ctx.subjects.map((subject) => ({
    subject: { ...subject, focused: subject.id === ctx.focus },
    ...cell(ctx.byId.get(subject.id), facet.id, decl, ctx.chosen),
  }));
}

/** 값에 붙은 말을 본문 아래에 편다. **고른 subject 것뿐이다** — 말의 규칙은 하나다. */
/**
 * **값에 붙은 말은 어느 element 에서나 같은 자리에 선다** — 라벨 옆 표시를 가리키면 열린다.
 *
 * 겹치는 쪽만 본문 아래에 펴고 있었는데, 그것이 subject 이름을 달고 facet 주석 **위에**
 * 서니 subject 주석처럼 읽혀 순서가 뒤집힌 것처럼 보였다. 화면에 규칙이 둘이었던 것이다.
 * 고른 subject 것만 낸다 — 말의 규칙도 하나다.
 */
function fieldMark(ctx, facet, decl) {
  const { entry } = cell(ctx.byId.get(ctx.shown), facet.id, decl, ctx.chosen);
  return notePop(entry?.notes);
}

/** focus 를 따라 바뀌는 쪽이 지금 그리는 subject. 없으면 첫째다. */
function shownOf(ctx) {
  return ctx.subjects.find((s) => s.id === ctx.shown) ?? null;
}

function oneRead(ctx, facet, decl, subject) {
  return { subject, ...cell(ctx.byId.get(subject.id), facet.id, decl, ctx.chosen) };
}

// ---------------------------------------------------------------- primitive element 다섯

/** 값 하나를 크게. focus 가 고른 subject 의 것을 그린다. */
function stat(ctx, facet) {
  const decl = facet.fields[0];
  // **수 하나가 크게 설 자리.** 그 자리의 크기 그대로 비워 둔다.
  if (ctx.subjects.length === 0) {
    return `<div class="field-label">${esc(decl.label ?? decl.key)}${hintMark(decl)}</div>` +
      `<div class="big">${slot()}</div>`;
  }
  const subject = shownOf(ctx);
  if (!subject) return `<div class="blank">${missMark()}</div>`;
  const where = `${facet.id}/${decl.key}/${subject.id}`;
  const { state, entry } = oneRead(ctx, facet, decl, subject);
  const value = state === "filled" ? drawCell(ctx.report, where, decl, entry.value) : missMark();
  return (
    `<div class="field-label">${esc(decl.label ?? decl.key)}${hintMark(decl)}</div>` +
    `<div class="big">${value}${notePop(entry?.notes)}</div>`
  );
}

/** 라벨과 값 여럿. 한 facet 안에 타입이 섞여도 읽는 규칙은 하나다 — 고른 subject 의 것. */
function facts(ctx, facet) {
  // **라벨이 그대로 선다.** 사용자가 선언한 줄들이 이 facet 의 내용이고 지금 보러 온 것이다.
  if (ctx.subjects.length === 0) {
    const empty = facet.fields.map((decl) =>
      `<div class="fact"><dt>${esc(decl.label ?? decl.key)}${hintMark(decl)}</dt>` +
      `<dd>${slot()}</dd></div>`);
    return `<dl class="facts">${empty.join("")}</dl>`;
  }
  const subject = shownOf(ctx);
  if (!subject) return `<div class="blank">${missMark()}</div>`;
  const rows = facet.fields.map((decl) => {
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    const { state, entry } = oneRead(ctx, facet, decl, subject);
    const value = state === "filled" ? drawCell(ctx.report, where, decl, entry.value) : missMark();
    return (
      `<div class="fact"><dt>${esc(decl.label ?? decl.key)}${hintMark(decl)}</dt>` +
      `<dd>${value}${notePop(entry?.notes)}</dd></div>`
    );
  });
  return `<dl class="facts">${rows.join("")}</dl>`;
}

/** 크기 비교. **자는 subject 전체의 최대값으로 고정한다** — focus 를 옮겨도 길이를 견줄 수 있어야 한다. */
/**
 * 크기 비교. **자는 facet 하나에 하나다.**
 *
 * 필드마다 따로 재면 3등급 1,000만이 1등급 3,000만보다 길어진다 — 그림이 거짓말을 한다.
 * 「한 facet 은 비교 축 하나여야 한다」가 이미 언어의 규칙이니 같은 축이면 같은 자를
 * 쓰는 것이 맞고, 그래야 그 규칙이 **시각으로 강제된다.**
 *
 * 자는 이 facet 의 **모든 필드 × 모든 subject × 모든 고를 것**을 덮는다. 무엇을 누르든
 * 자가 안 움직인다. 범위가 크게 다른 필드가 섞이면 작은 것이 짧아지는데, 그것이
 * **「이 facet 은 축이 둘이다」라는 신호**다 — 감추지 않는다.
 */
function bars(ctx, facet) {
  // **빈 자가 그대로 선다.** `.track` 이 이미 「막대가 여기까지 갈 수 있다」는 자리라
  // 채우지 않은 자만 두면 된다 — 길이 0 의 막대를 그리는 것이 아니다.
  if (ctx.subjects.length === 0) {
    return facet.fields.map((decl) =>
      `<div class="bar-row"><span class="who">${esc(decl.label ?? decl.key)}${hintMark(decl)}</span>` +
      `<span class="track"></span><span class="val">${slot()}</span></div>`).join("");
  }
  const subject = shownOf(ctx);
  if (!subject) return `<div class="blank">${missMark()}</div>`;
  const numbers = facet.fields
    .flatMap((decl) => everyValue(ctx, facet, decl))
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const top = numbers.length ? Math.max(...numbers) : 0;

  const rows = facet.fields.map((decl) => {
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    const { state, entry } = oneRead(ctx, facet, decl, subject);
    let mark = '<span class="track"></span>';
    let text;
    if (state !== "filled") {
      text = missMark();
    } else if (typeof entry.value === "number" && Number.isFinite(entry.value)) {
      // 0 은 길이 0 이다 — 진짜 0 이니까. 0 이 아닌 값은 바닥을 둔다: 길이 0 으로
      // 사라지면 「값이 없다」와 구별이 안 된다. 정확한 수는 옆에 늘 적혀 있다.
      const share = top > 0 && entry.value > 0 ? (entry.value / top) * 100 : 0;
      const width = share > 0 ? Math.max(share, FLOOR) : 0;
      mark = `<span class="track"><span class="fill" style="width:${width.toFixed(4)}%"></span></span>`;
      text = esc(formatScalar(decl.type, entry.value));
    } else {
      text = undrawable(ctx.report, where, "막대는 수를 요구한다", JSON.stringify(entry.value));
    }
    return (
      // **이름 옆은 hint, 값 옆은 그 값에 대한 말.** 자리가 뜻을 가른다.
      `<div class="bar-row"><span class="who">${esc(decl.label ?? decl.key)}` +
      `${hintMark(decl)}</span>${mark}<span class="val">${text}${notePop(entry?.notes)}</span></div>`
    );
  });
  return rows.join("");
}

function line(ctx, facet) {
  const decl = facet.fields[0];
  const axis = decl.axis;
  const series = [];
  const missing = []; // 값이 없어 못 그린 subject — 줄 머리가 한 번 말한다
  const broken = []; // 값은 있으나 그리지 못한 것 — 저마다 까닭을 적는다
  for (const subject of ctx.subjects) {
    const { state, entry } = cell(ctx.byId.get(subject.id), facet.id, decl, ctx.chosen);
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    if (state !== "filled") {
      missing.push({ ...subject, mark: notePop(entry?.notes) });
      continue;
    }
    const raw = entry.value;
    const points = [];
    let bad = null;
    if (!Array.isArray(raw)) bad = "선은 점의 배열을 요구한다";
    else
      for (const point of raw) {
        const x = axisNumber(axis, point?.at);
        const y = typeof point?.value === "number" && Number.isFinite(point.value) ? point.value : null;
        if (x === null || y === null) {
          bad = `축(${axis ?? "없음"})이나 값에 그릴 수 없는 것이 있다`;
          break;
        }
        points.push({ x, y, at: point.at });
      }
    if (bad || points.length === 0) {
      broken.push(
        `<span class="off${subject.id === ctx.focus ? " is-focus" : ""}">` +
          `<b class="who">${esc(subject.name)}</b> ` +
          `${undrawable(ctx.report, where, bad ?? "점이 하나도 없다", JSON.stringify(raw).slice(0, 80))}</span>`,
      );
      continue;
    }
    series.push({ subject, points, notes: entry.notes });
  }
  // **그림도 표처럼 자기 상자에서 굴러간다.** 좁은 화면에서 통째로 줄이면 축 라벨과 선 끝
  // 이름이 읽을 수 없게 작아진다 — 그림은 제 크기를 지키고 상자가 굴러간다.
  // **자는 고를 것까지 덮는다.** 축을 옮겨도 그림의 자가 안 움직여야 앞뒤를 견줄 수 있다.
  const span = { x: [], y: [] };
  for (const value of everyValue(ctx, facet, decl)) {
    if (!Array.isArray(value)) continue;
    for (const point of value) {
      const x = axisNumber(axis, point?.at);
      const y = typeof point?.value === "number" && Number.isFinite(point.value) ? point.value : null;
      if (x !== null && y !== null) { span.x.push({ x, at: point.at }); span.y.push(y); }
    }
  }
  // **축만 남는다.** 값이 없으면 눈금도 없다 — 눈금을 지어내면 그것이 가짜 값이다.
  // 두 축이 서는 것만으로 「여기에 선이 그려진다」가 읽힌다.
  const body = ctx.subjects.length === 0
    ? `<div class="chart-scroll">${emptyAxes()}</div>`
    : series.length
      ? `<div class="chart-scroll">${lineSvg(series, axis, decl.type, ctx.focus, ctx.prior, span)}</div>`
      : `<div class="blank">${missMark()}</div>`;
  return (
    // 값에 붙은 말은 다른 element 와 같은 자리에 — 라벨 옆 표시를 가리키면 열린다.
    // 값이 설 한 자리가 없는 element 다 — 값 주석 표시가 이름 줄에 함께 선다.
    // 앞이 hint, 뒤가 값 주석. 차례가 고정이라 여는 것이 무엇인지 갈린다.
    `<div class="field-label">${esc(decl.label ?? decl.key)}${hintMark(decl)}` +
    `${fieldMark(ctx, facet, decl)}</div>` + body +
    // 선 끝에 이름이 붙으므로 **아래에 범례를 두지 않는다.** 고른 것이 못 섰을 때만 말한다.
    blankRow(missing, ctx) +
    // 어긋난 값은 범례가 아니라 결함 신호다. 누구 것인지 적어야 고칠 수 있어 전원을 낸다.
    (broken.length ? `<div class="offs">${broken.join("")}</div>` : "")
  );
}

/** 아직 아무도 오지 않은 축. 눈금도 선도 없다 — 자리만 있다. */
function emptyAxes() {
  const W = 760, H = 240, L = 78, R = 130, T = 18, B = 34;
  return (
    `<svg class="line" viewBox="0 0 ${W} ${H}" role="img" aria-label="선이 올 자리">` +
    `<line class="axis" x1="${L}" y1="${H - B}" x2="${W - R}" y2="${H - B}"/>` +
    `<line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/></svg>`
  );
}

function lineSvg(series, axis, type, focus, prior, span) {
  const W = 760, H = 240, L = 78, R = 130, T = 18, B = 34;
  // **그린 것이 아니라 잴 것 전부로 자를 잡는다** — 무엇을 눌러도 축이 안 움직인다.
  const edge = span.x.length ? span.x : series.flatMap((s) => s.points.map((p) => ({ x: p.x, at: p.at })));
  const xs = edge.map((one) => one.x);
  const ys = span.y.length ? span.y : series.flatMap((s) => s.points.map((p) => p.y));
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys, 0), ymax = Math.max(...ys);
  const xspan = xmax - xmin || 1;
  const yspan = ymax - ymin || 1;
  const px = (x) => L + ((x - xmin) / xspan) * (W - L - R);
  const py = (y) => H - B - ((y - ymin) / yspan) * (H - T - B);

  // 축 양끝의 글도 자에서 온다 — 그린 것만 보면 눌렀을 때 눈금이 달라진다.
  const firstAt = edge.reduce((a, p) => (p.x < a.x ? p : a), edge[0]).at;
  const lastAt = edge.reduce((a, p) => (p.x > a.x ? p : a), edge[0]).at;

  const parts = [
    `<line class="axis" x1="${L}" y1="${py(ymin).toFixed(1)}" x2="${W - R}" y2="${py(ymin).toFixed(1)}"/>`,
    `<line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>`,
    `<text class="tick ty" x="${L - 8}" y="${py(ymax).toFixed(1)}">${esc(formatScalar(type, ymax))}</text>`,
    `<text class="tick ty" x="${L - 8}" y="${py(ymin).toFixed(1)}">${esc(formatScalar(type, ymin))}</text>`,
    `<text class="tick tx" x="${L}" y="${H - B + 18}">${esc(formatScalar(axis, firstAt))}</text>`,
    `<text class="tick tx end" x="${W - R}" y="${H - B + 18}">${esc(formatScalar(axis, lastAt))}</text>`,
  ];
  series.forEach(({ subject, points }) => {
    const focused = subject.id === focus;
    // 무늬를 쓰지 않는다. 갈래는 상태에서 나오고 CSS 가 색·굵기·진하기로 함께 말한다.
    const klass = `series trace-${traceOf(subject.id, focus, prior)}${focused ? " is-focus" : ""}`;
    if (points.length === 1) {
      parts.push(`<circle class="${klass}" cx="${px(points[0].x).toFixed(1)}" cy="${py(points[0].y).toFixed(1)}" r="3.5"/>`);
    } else {
      const coords = points.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
      parts.push(`<polyline class="${klass}" points="${coords}"/>`);
    }
    for (const p of points) {
      parts.push(`<circle class="dot ${klass}" cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="2.5"/>`);
    }
    const last = points[points.length - 1];
    parts.push(
      `<text class="series-label trace-${traceOf(subject.id, focus, prior)}${focused ? " is-focus" : ""}" ` +
        `x="${(px(last.x) + 8).toFixed(1)}" y="${(py(last.y) + 4).toFixed(1)}">${esc(subject.name)}</text>`,
    );
  });
  return `<svg class="line" viewBox="0 0 ${W} ${H}" role="img">${parts.join("")}</svg>`;
}

/**
 * 겹치는 좌표가 **항목**이다. subject 마다 표를 따로 두지 않고 목록을 하나로 합친다 —
 * 누가 무엇을 갖고 누가 안 갖는지가 한 줄에서 읽힌다.
 * 한 항목의 여러 열은 하나의 자로 줄일 수 없어 그 안에서만 나란히 선다 (원칙 9).
 */
function list(ctx, facet) {
  const decl = facet.fields[0];
  const columns = Array.isArray(decl.columns) ? decl.columns : [];
  if (columns.length === 0) return `<div class="blank">${missMark()}</div>`;
  const [key, ...rest] = columns;

  const reads = readsOf(ctx, facet, decl);
  const rows = new Map(); // 항목 이름 → subjectId → 항목
  const unread = new Set(); // 목록 자체를 못 읽은 subject
  for (const { subject, state, entry } of reads) {
    if (state !== "filled" || !Array.isArray(entry.value)) {
      unread.add(subject.id);
      continue;
    }
    for (const item of entry.value) {
      const name = item?.[key.key];
      if (name === undefined) continue;
      const at = String(name);
      if (!rows.has(at)) rows.set(at, new Map());
      rows.get(at).set(subject.id, item);
    }
  }

  const blanks = reads
    .filter(({ subject }) => unread.has(subject.id))
    .map(({ subject }) => ({ ...subject }));
  // list 는 값이 subject 열에 선다 — 값 주석 표시는 그 열 머리로 간다.
  const label = `<div class="field-label">${esc(decl.label ?? decl.key)}${hintMark(decl)}</div>`;
  // **열은 subject 가 만든다.** 아직 아무도 없으니 키 열만 서고 그 옆 한 칸이
  // 「제안서가 오면 여기에 한 열씩 선다」는 자리로 비어 있는다. 이름을 지어내지 않는다.
  if (ctx.subjects.length === 0) {
    return (
      label +
      `<div class="table-scroll"><table class="items"><colgroup><col><col></colgroup>` +
      `<thead><tr><th class="corner">${esc(key.label ?? key.key)}</th>` +
      `<th>${slot("제안서가 올 자리")}</th></tr></thead>` +
      `<tbody><tr><th class="row-label" scope="row">${slot("항목이 올 자리")}</th>` +
      `<td>${slot()}</td></tr></tbody></table></div>`
    );
  }
  if (rows.size === 0) {
    return label +
      // 목록 **전체**가 비었다는 말은 값 하나의 자리가 아니라 표가 설 자리다. 글로 선다.
      `<div class="blank"><span class="miss">${NO_ITEMS}</span></div>${blankRow(blanks, ctx)}`;
  }

  // **고른 열은 통째로 잡는다.** 칸마다 테두리를 두르면 열 안에 가로선이 생겨 한 덩어리로
  // 읽히지 않는다. 열 선언(`<col>`)에 테두리를 주면 머리부터 끝까지 한 상자가 된다.
  const cols = [`<col>`, ...reads.map(({ subject }) => (subject.focused ? `<col class="is-focus">` : `<col>`))];
  const head = [`<th class="corner">${esc(key.label ?? key.key)}</th>`];
  for (const { subject } of reads) {
    const said = subject.id === ctx.shown ? fieldMark(ctx, facet, decl) : "";
    head.push(`<th>${esc(subject.name)}${said}</th>`);
  }
  const body = [...rows.entries()].map(([name, held]) => {
    const cells = reads.map(({ subject }) => {
      if (unread.has(subject.id)) return `<td>${missMark()}</td>`;
      const item = held.get(subject.id);
      // **아는 사실이라 글이 선다.** 목록을 읽었고 그 항목이 여기 없다 — 모르는 것이 아니다.
      if (!item) return `<td><span class="miss">${esc(NO_ITEM)}</span></td>`;
      const pairs = rest.map((column) =>
        column.key in item
          ? `<span class="cell-pair"><b class="who">${esc(column.label ?? column.key)}</b> ${esc(formatScalar(column.type, item[column.key]))}</span>`
          : "",
      );
      const extra = Object.keys(item).filter((k) => !columns.some((c) => c.key === k));
      if (extra.length) ctx.report.push(`${facet.id}/${name}: 템플릿에 없는 열이라 그리지 않았다 — ${extra.join(", ")}`);
      // **있다는 것은 없다는 것이 아니다.** 표기는 빈 자리를 가리키는 것이라 여기엔 글이 선다.
      return `<td>${pairs.join("") || '<span class="miss">있음</span>'}</td>`;
    });
    return `<tr><th class="row-label" scope="row">${esc(name)}</th>${cells.join("")}</tr>`;
  });

  return (
    label +
    // **표만 옆으로 굴린다.** subject 가 늘수록 넓어지는 유일한 자리라, 페이지 전체가 밀리는
    // 대신 표가 자기 상자 안에서 굴러간다. 열 너비는 균일하다 — 넓이가 우열을 말하지 않는다.
    `<div class="table-scroll"><table class="items"><colgroup>${cols.join("")}</colgroup>` +
    `<thead><tr>${head.join("")}</tr></thead>` +
    `<tbody>${body.join("")}</tbody></table></div>`
    // 문장을 덧붙이지 않는다 — 그 subject 의 칸이 이미 없다고 말한다.
  );
}

/**
 * **고른 subject 의 항목을 행으로 편다.** `list` 와 같은 값(항목 배열)을 받지만 비교하는
 * 법이 다르다 — `list` 는 여럿을 한 표에 겹치고, `rows` 는 지금 보고 있는 하나만 편다.
 *
 * 둘을 한 element 로 두고 템플릿이 고르게 하면 「비교 방법은 primitive element 가 정한다」가
 * 깨진다. 같은 이름이 화면마다 다르게 굴면 이름만 보고 알 수 없다. 그래서 이름을 가른다.
 */
function rows(ctx, facet) {
  const decl = facet.fields[0];
  const columns = Array.isArray(decl.columns) ? decl.columns : [];
  if (columns.length === 0) return `<div class="blank">${missMark()}</div>`;
  const subject = shownOf(ctx);
  // rows 도 값이 설 한 자리가 없다 — 이름 줄에 hint 다음으로 선다.
  const label = `<div class="field-label">${esc(decl.label ?? decl.key)}${hintMark(decl)}` +
    `${fieldMark(ctx, facet, decl)}</div>`;
  // **열 머리가 전부 선다.** 열은 템플릿이 선언한 것이라 subject 가 없어도 안다 —
  // 사용자가 무엇을 담기로 했는지가 여기서 그대로 읽힌다.
  if (ctx.subjects.length === 0) {
    const head = columns.map((c) => `<th>${esc(c.label ?? c.key)}</th>`).join("");
    const blank = columns.map(() => `<td>${slot()}</td>`).join("");
    return (
      label +
      `<div class="table-scroll"><table class="items"><thead><tr>${head}</tr></thead>` +
      `<tbody><tr>${blank}</tr></tbody></table></div>`
    );
  }
  if (!subject) return `${label}<div class="blank">${missMark()}</div>`;

  const { state, entry } = oneRead(ctx, facet, decl, subject);
  if (state !== "filled" || !Array.isArray(entry.value)) {
    return `${label}<div class="blank">${missMark()}</div>`;
  }
  if (entry.value.length === 0) {
    return `${label}<div class="blank"><span class="miss">${NO_ITEMS}</span></div>`;
  }
  const head = columns.map((c) => `<th>${esc(c.label ?? c.key)}</th>`).join("");
  const body = entry.value.map((item, index) => {
    const extra = Object.keys(item ?? {}).filter((k) => !columns.some((c) => c.key === k));
    if (extra.length) ctx.report.push(`${facet.id}[${index}]: 템플릿에 없는 열이라 그리지 않았다 — ${extra.join(", ")}`);
    const cells = columns.map((column) =>
      column.key in (item ?? {})
        ? `<td>${esc(formatScalar(column.type, item[column.key]))}</td>`
        : `<td>${missMark()}</td>`,
    );
    return `<tr>${cells.join("")}</tr>`;
  });
  return (
    label +
    // 표는 자기 상자에서 굴러간다. 열이 늘어도 페이지가 밀리지 않는다.
    `<div class="table-scroll"><table class="items"><thead><tr>${head}</tr></thead>` +
    `<tbody>${body.join("")}</tbody></table></div>`
  );
}

/**
 * **하나를 쪼갠 것.** 조각들이 합쳐 한 덩어리가 된다 — 「내 보험료가 어디에 쓰이나」.
 *
 * `bars` 와 다르다. 막대는 **서로 다른 것들의 크기**를 견주고, 여기 조각들은 **한 덩어리의
 * 안쪽**이다. 합이 전체라는 사실이 `bars` 로는 보이지 않는다.
 *
 * **겹칠 수 없다** — 한 subject 의 안을 나눈 것이라 두 subject 의 안이 한 덩어리가 될 수
 * 없다. 그래서 focus 를 따른다.
 *
 * **파이가 아니라 띠로 그린다.** 우리는 색으로 가르지 않는데, 색 없는 파이는 조각을 가를
 * 길이 각도뿐이라 읽히지 않는다. 띠는 조각마다 이름을 옆에 세울 수 있고 길이가 각도보다
 * 정확히 읽힌다. 조각은 자리 차례로 두 무채색을 번갈아 쓴다 — 크기와 무관하고 우열이 없다.
 */
function parts(ctx, facet) {
  const decl = facet.fields[0];
  const columns = Array.isArray(decl.columns) ? decl.columns : [];
  const subject = shownOf(ctx);
  const label = `<div class="field-label">${esc(decl.label ?? decl.key)}${hintMark(decl)}` +
    `${fieldMark(ctx, facet, decl)}</div>`;
  if (columns.length < 2) return `${label}<div class="blank">${missMark()}</div>`;
  const [name, share] = columns;
  // **빈 띠가 자리를 말한다.** 조각의 이름은 값이 갖고 오는 것이라 지어내지 않는다.
  if (ctx.subjects.length === 0) {
    return `${label}<div class="band" role="img" aria-label="조각이 올 자리"></div>`;
  }
  if (!subject) return `${label}<div class="blank">${missMark()}</div>`;

  const { state, entry } = oneRead(ctx, facet, decl, subject);
  if (state !== "filled" || !Array.isArray(entry.value)) {
    return `${label}<div class="blank">${missMark()}</div>`;
  }
  // **0 인 조각도 목록에 남는다.** 띠에서 사라진다고 값까지 사라지면 안 된다 —
  // 「0 원이다」와 「그런 조각이 없다」는 다른 말이다.
  const all = entry.value
    .map((item) => ({ said: item?.[name.key], size: item?.[share.key] }))
    .filter((one) => typeof one.size === "number" && Number.isFinite(one.size));
  const slices = all.filter((one) => one.size > 0);
  if (all.length === 0) {
    return `${label}<div class="blank"><span class="miss">${NO_ITEMS}</span></div>`;
  }
  const whole = slices.reduce((sum, one) => sum + one.size, 0);
  const band = slices
    .map((one) =>
      // 조각도 바닥을 둔다 — 0 이 아닌 몫이 길이 0 으로 사라지면 없는 것과 같아진다.
      `<span class="slice" style="width:${Math.max((one.size / whole) * 100, FLOOR).toFixed(4)}%" ` +
      `title="${esc(one.said ?? "")}"></span>`)
    .join("");
  const rows = all
    .map((one) =>
      `<div class="slice-row"><span class="who">${esc(one.said ?? "")}</span>` +
      `<span class="val">${esc(formatScalar(share.type, one.size))}</span></div>`)
    .join("");
  return (
    label +
    (slices.length ? `<div class="band">${band}</div>` : "") +
    `<div class="slices">${rows}</div>`
  );
}

export const ELEMENTS = { stat, facts, bars, line, list, rows, parts };

// ---------------------------------------------------------------- 페이지

/**
 * **facet 이 타는 축의 선택자가 설 자리.**
 *
 * 축은 그 facet 이 **무엇에 대한 값인지**를 말한다 — 그래서 facet 의 내용이고 렌더가 낸다.
 * 화면 전체에 걸리는 것(focus·명단·상태 줄)은 여전히 껍데기라 밖에 남는다. 선이 거기다.
 *
 * **어느 축을 타는지는 facet 이 제 필드로 말한다** — 따로 적지 않는다. 두 군데 적으면
 * 어긋날 수 있고, 필드가 이미 말한 것을 되풀이하는 것뿐이다.
 *
 * **모양은 말하지 않는다.** 고를 것과 고른 것을 자리로 낼 뿐, 칩인지 드롭다운인지는 앱이
 * 제 것으로 갈아 끼운다 — 꼴을 가리키는 이름을 붙이지 않는다.
 *
 * 타는 facet 마다 제 선택자를 낸다. 첫 facet 에만 두면 나머지 둘이 까닭 없이 바뀌고
 * facet 차례가 뜻을 지게 된다 — 그러면 차례가 배치일 뿐이라는 규칙이 깨진다.
 */
function choiceSlots(facet, picks, chosen) {
  const rides = [];
  for (const decl of facet.fields ?? []) {
    if (decl?.choice && !rides.includes(decl.choice)) rides.push(decl.choice);
  }
  return rides
    .map((id) => picks.find((one) => one.id === id))
    .filter(Boolean)
    .map((pick) => {
      const buttons = (pick.options ?? []).map((option) =>
        `<button type="button" data-option="${esc(option.id)}" ` +
        `aria-pressed="${option.id === chosen[pick.id]}">${esc(option.label ?? option.id)}</button>`,
      );
      return (
        `<div class="choice" data-choice="${esc(pick.id)}" role="group" ` +
        `aria-label="${esc(pick.label ?? pick.id)}">${buttons.join("")}</div>`
      );
    })
    .join("");
}

/** 뷰어가 왼쪽에 적을 것. **분석뷰에 섞이지 않는다.** 자리 계산이 두 벌이 되지 않게 여기서 낸다. */
function viewState(seats, focus, prior, shown, wanted, picks) {
  return {
    seats,
    // 고를 수 있는 것과 고른 것. **앱이 그 자리를 그린다** — 모양은 언어가 말하지 않고
    // 분석뷰에도 들어가지 않는다. 우리가 내는 것은 무엇을 고를 수 있는가뿐이다.
    ...picks,
    shown, // focus 를 따라 바뀌는 element 가 지금 그리는 subject

    focus,
    prior, // 직전에 보고 있던 subject. 겹치는 선이 갈래를 여기서 받는다
    // 없는 id 는 결함이 아니다. 분석뷰는 focus 를 놓은 것과 똑같고, 그 사실만 왼쪽이 알린다.
    focusMissing: wanted && !focus ? wanted : null,
  };
}

/**
 * 분석뷰 하나를 HTML 로 그린다.
 *
 * @param {object} input  { template, values, focus, previousFocus }
 *   - 자리와 그 차례는 **값 한 벌들이 정한다.** 명단을 따로 받지 않는다.
 *   - focus 는 subject 의 id. null 이거나 없는 id 면 겹치는 element 는 강조를 풀고,
 *     focus 를 따라 바뀌는 element 는 **첫 subject** 를 그린다.
 *   - previousFocus 는 바로 전에 보고 있던 subject. **값에서 유도할 수 없어** 인자로 받는다.
 *     같은 규칙이다 — 없는 id 면 그 상태만 사라지고, focus 와 같으면 직전이 없는 것으로 본다.
 *   - choices 는 고르는 자리마다 무엇을 골랐는지의 지도. 빠졌거나 없는 id 면 **첫 option**.
 *     고른 것이 바뀌면 값이 바뀔 뿐 **어떤 facet 이 서는지는 달라지지 않는다.**
 * @returns {{html: string, report: string[], view: object|null}}
 *   html 은 **분석뷰뿐**이다 — 템플릿 제목과 facet 들. 도구가 덧붙이는 것은 하나도 들어가지 않는다.
 *   report 는 그리지 못한 자리들, view 는 뷰어가 왼쪽에 적을 화면 상태.
 */
export function renderView({
  template,
  values = [],
  focus = null,
  previousFocus = null,
  choices = null,
} = {}) {
  const report = [];
  if (!template || typeof template !== "object" || Array.isArray(template)) {
    // 그릴 분석뷰가 없다. 빈 판을 내고 무슨 일인지는 왼쪽이 말한다.
    return { html: "", report: ["템플릿이 객체가 아니다"], view: null };
  }
  const byId = new Map();
  for (const doc of values) {
    if (doc && typeof doc === "object" && typeof doc.subjectId === "string") byId.set(doc.subjectId, doc);
    else report.push("값 한 벌에 subjectId 가 없어 어느 subject 인지 알 수 없다");
    if (doc?.templateId && template.id && doc.templateId !== template.id) {
      report.push(`${doc.subjectId}: 값 한 벌의 templateId 가 템플릿과 다르다 (${doc.templateId} ≠ ${template.id})`);
    }
  }

  // 자리는 값 한 벌들이 정한다. 차례는 넘어온 차례이고 배치일 뿐 우열이 아니다.
  // **자리에 색을 붙이지 않는다.** subject 를 가르는 것은 이름이고, 겹치는 선은 무늬다.
  const seats = [...byId.entries()].map(([id, doc]) => ({ id, name: doc.subjectLabel || id }));

  // **고르는 자리.** 무엇을 고를 수 있는지는 템플릿이 말한다 — 골격이라 subject 마다
  // 달라서는 안 된다. **고른 것만** 사람이 누른 것이라 인자로 온다.
  // 빠졌거나 없는 id 면 첫 option 이다 — 빈 화면을 내지 않는다.
  const picks = Array.isArray(template.choices) ? template.choices.filter((c) => c?.id) : [];
  const chosen = {};
  for (const one of picks) {
    const options = Array.isArray(one.options) ? one.options : [];
    const wantedOption = choices?.[one.id];
    chosen[one.id] = options.find((o) => o?.id === wantedOption)?.id ?? options[0]?.id ?? null;
  }

  const wanted = focus;
  const seated = seats.some((s) => s.id === wanted) ? wanted : null;
  // focus 를 따라 바뀌는 element 가 그릴 subject. 고른 것이 없으면 첫째다 —
  // 늘어놓기로 돌아가지 않고 빈 화면도 내지 않는다.
  const shown = seated ?? seats[0]?.id ?? null;
  // 직전도 같은 규칙이다 — 없는 id 면 사라지고, 현재와 같으면 직전이 없는 것으로 본다.
  const prior = seats.some((s) => s.id === previousFocus) && previousFocus !== seated
    ? previousFocus
    : null;
  const ctx = { subjects: seats, byId, focus: seated, prior, shown, chosen, report };

  for (const [id, doc] of byId) {
    const known = new Set((template.facets ?? []).map((f) => f?.id));
    for (const key of Object.keys(doc.facets ?? {})) {
      if (!known.has(key)) report.push(`${id}: 템플릿에 없는 facet 이라 그리지 않았다 — ${key}`);
    }
  }

  const facets = Array.isArray(template.facets) ? template.facets : [];
  if (facets.length === 0) report.push("템플릿에 facet 이 하나도 없다");

  /**
   * **아무에게도 값이 없고 할 말도 없는 facet 은 서지 않는다.**
   *
   * 선이 어디인지가 중요하다. subject **하나**가 비는 것은 그대로 표기가 말한다 — 숨기면
   * subject 마다 골격이 달라져 견줄 수 없다. **전원이 비었을 때만** 빠진다: 견줄 것이
   * 없으니 골격이 달라질 일도 없고, 남는 것은 빈 카드뿐이다.
   *
   * 다만 **말이 붙어 있으면 선다.** 「이 제안서엔 이 항목이 없습니다」라고 적힌 카드는
   * 빈 카드가 아니다 — 전부 비어 있는 값 한 벌이 「아직 분석하지 않았다」를 말하는 길이
   * 그것이라, 말까지 지우면 그 자리가 사라진다.
   *
   * subject 가 하나도 없으면 이 규칙을 쓰지 않는다. 견줄 대상이 없는 것과 전원이 빈 것은
   * 다르다 — 템플릿만으로 골격을 보는 자리가 남아야 한다.
   */
  const stands = (facet) => {
    if (seats.length === 0 || !facet || typeof facet !== "object") return true;
    if ((facet.notes ?? []).length > 0) return true;
    for (const seat of seats) {
      const doc = byId.get(seat.id);
      if (facetNotes(doc, facet.id).length > 0) return true;
      for (const decl of facet.fields ?? []) {
        if (!decl || typeof decl.key !== "string") return true; // 그리지 못하는 것은 말해야 한다
        const { state, entry } = cell(doc, facet.id, decl, chosen);
        if (state === "filled" || (entry?.notes ?? []).length > 0) return true;
      }
    }
    return false;
  };
  const dropped = facets.filter((facet) => !stands(facet)).map((facet, i) => facet?.id ?? `facets[${i}]`);

  const sections = facets.filter(stands).map((facet, index) => {
    const at = `facets[${index}]`;
    if (!facet || typeof facet !== "object") {
      return `<section class="facet broken">${undrawable(report, at, "facet 이 객체가 아니다")}</section>`;
    }
    const title = esc(facet.title ?? facet.id ?? at);
    const draw = ELEMENTS[facet.element];
    // primitive element 이름은 분석뷰에 나올 자리가 없다. 구조로만 남긴다 —
    // 참조 뷰어의 배지는 이 속성을 읽어 CSS 가 그리므로 렌더가 낸 글에는 들어가지 않는다.
    // **제목은 짧은 이름이고 설명은 hint 가 진다.** facet 은 화면에 서넛뿐이라 한 줄씩
    // 붙어도 길어지지 않는다 — 필드가 열 개씩이라 표시 뒤로 숨긴 것과 갈리는 자리다.
    const head = `<h2 data-element="${esc(facet.element ?? "")}">${title}</h2>` +
      (facet.hint ? `<p class="facet-hint">${esc(facet.hint)}</p>` : "");
    let body;
    if (!draw) {
      body = undrawable(report, facet.id ?? at, `모르는 primitive element 다 — ${JSON.stringify(facet.element)}`);
    } else if (!Array.isArray(facet.fields) || facet.fields.length === 0) {
      body = undrawable(report, facet.id ?? at, "필드가 하나도 없다");
    } else if (facet.fields.some((f) => !f || typeof f.key !== "string")) {
      body = undrawable(report, facet.id ?? at, "key 가 없는 필드가 있다");
    } else {
      body = draw(ctx, facet);
    }
    // **말은 데이터 뒤에 선다.** facet 에 붙은 것과 subject 에 붙은 것이 한자리에 모인다 —
    // 예외를 두지 않는다. 읽는 규칙이 둘이면 매번 어디 있는지 찾게 된다.
    // 둘을 가르는 것은 띠도 상자도 아니고 **자리와 글**이다: subject 것은 이름이 앞에 선다.
    //
    // **subject 의 말은 언제나 고른 subject 것이다.** element 로 갈리지 않는다 — 규칙이 하나다.
    // 겹쳐 그리는 facet 이라도 아래에 서는 말은 지금 고른 subject 것이고, focus 를 옮기면
    // 말이 따라온다. 고른 것이 없으면 첫 subject 이며, 그것이 화면이 그리고 있는 subject 다.
    // **facet 에 붙은 말은 전부 선다** — 그건 subject 의 것이 아니다.
    const mine = seats.find((s) => s.id === shown);
    // **이름표를 붙이지 않는다.** 주석은 늘 고른 subject 것만 나오므로 이름이 그 사실을 두 번
    // 말한다. 무엇을 고른 상태인지는 앱의 띠가 말하고, 두 묶음을 가르는 일은 짧은 선이 맡는다.
    // (되돌리려면 아래 호출에 `mine.name` 을 둘째 인자로 다시 주면 된다.)
    const ours = notesHtml(facet.notes);
    const yours = mine ? notesHtml(facetNotes(byId.get(mine.id), facet.id)) : "";
    // **두 묶음 사이에만 짧은 선이 선다.** 이름이 가르는 것을 거들 뿐이라 판을 가로지르지
    // 않고 글머리 쪽에 짧게 놓인다. 가를 것이 없으면(한쪽이 비면) 서지 않는다.
    // 줄과 같은 자로 재어진다 — 앞뒤 간격이 `--row` 하나다.
    const cut = ours && yours ? `<hr class="said-cut">` : "";
    const said = ours + cut + yours;
    return (
      `<section class="facet element-${esc(facet.element ?? "unknown")}">${head}` +
      // 축은 제목 바로 아래 — 이 facet 이 무엇에 대한 값인지를 먼저 말하고 그 값을 그린다.
      choiceSlots(facet, picks, chosen) +
      `<div class="body">${body}</div>` +
      (said ? `<div class="said">${said}</div>` : "") +
      "</section>"
    );
  });

  // 제목은 템플릿이 선언한 내용이라 렌더의 것이다. 그 밖의 머리말은 전부 뷰어 몫이다.
  const html = `<h1>${esc(template.title ?? template.id ?? "제목 없음")}</h1>` + sections.join("");

  return {
    html,
    report,
    view: viewState(seats, seated, prior, shown, wanted, { choices: picks, chosen, dropped }),
  };
}
