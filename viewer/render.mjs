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

// 주석 갈래 넷의 **정본 이름**이다(glossary §2.4). 참조 뷰어는 언어를 배우는 자리라
// 읽기 좋은 딴 이름을 쓰지 않는다 — 제품 화면의 라벨은 앱이 따로 정한다.
export const KIND_LABEL = { quote: "인용", tip: "팁", note: "보충", caution: "주의" };

export const NO_VALUE = "값 없음";
export const NO_ITEMS = "항목 없음";
export const UNDRAWABLE = "그리지 못한다";

// 선을 subject 별로 구별하는 방법. 색이 아니라 점선 무늬다 — 무늬는 우열을 말하지 않는다.
const DASHES = ["", "7 4", "2 3", "10 4 2 4", "1 4", "6 3 1 3"];

/** subject 를 가르는 색의 가짓수. **자리 차례로 돌려 쓴다 — 값의 크기와 무관하다.**
 *  색만으로 가르지 않는다. 선은 무늬로도 갈리고 이름은 늘 글로 적힌다. */
export const TONES = 6;

export function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#x27;");
}

// ---------------------------------------------------------------- 값 읽기

function cell(valueset, facetId, key) {
  if (!valueset) return { state: "empty", entry: null };
  const facet = valueset.facets?.[facetId];
  if (!facet) return { state: "empty", entry: null };
  const entry = facet.fields?.[key];
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

// 주석 갈래의 표. **넷이 같은 크기·같은 선 굵기**다 — 「주의」가 더 위험해 보이면 안 된다.
// 도형만 다르고 뜻은 옆의 말이 진다. 도메인을 가리키는 그림을 두지 않는다.
const KIND_MARK = {
  quote: '<path d="M4 4v4M7.5 4v4"/>',
  tip: '<path d="M6 2.5 9.5 6 6 9.5 2.5 6z"/>',
  note: '<circle cx="6" cy="6" r="3.2"/>',
  caution: '<rect x="3" y="3" width="6" height="6"/>',
};

function kindIcon(kind) {
  const mark = KIND_MARK[kind];
  if (!mark) return "";
  return `<svg class="kind-icon" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">${mark}</svg>`;
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

/** 값이 없다는 말. 갈래가 하나뿐이다 — 왜 없는지는 주석이 글로 말한다. */
function stateSpan() {
  return `<span class="miss empty">${NO_VALUE}</span>`;
}

function subClass(subject, focus) {
  return subject.id === focus ? "subject is-focus" : "subject";
}

// 그리지 못한 자리. 렌더는 멈추지 않고 자리를 표시하고 까닭을 적는다.
function undrawable(report, where, why, shown) {
  report.push(`${where}: ${why}`);
  return `<span class="undrawable" title="${esc(why)}">${UNDRAWABLE} — ${esc(shown ?? why)}</span>`;
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
export const COMPARE = { stat: "focus", facts: "focus", bars: "focus", line: "overlay", list: "overlay" };

/** 값이 없어 자리에 못 선 subject. 겹치는 쪽에서 축 아래에 적는다. */
function blankRow(blanks) {
  if (blanks.length === 0) return "";
  const said = blanks
    .map((b) => `<span class="off ${b.tone}${b.focused ? " is-focus" : ""}">` +
      `<span class="swatch" aria-hidden="true"></span><b class="who">${esc(b.name)}</b> ${b.said}</span>`)
    .join("");
  return `<div class="offs">${said}</div>`;
}

function readsOf(ctx, facet, decl) {
  return ctx.subjects.map((subject) => ({
    subject: { ...subject, focused: subject.id === ctx.focus },
    ...cell(ctx.byId.get(subject.id), facet.id, decl.key),
  }));
}

function fieldNotes(reads) {
  return reads.map(({ subject, entry }) => notesHtml(entry?.notes, subject.name)).join("");
}

/** focus 를 따라 바뀌는 쪽이 지금 그리는 subject. 없으면 첫째다. */
function shownOf(ctx) {
  return ctx.subjects.find((s) => s.id === ctx.shown) ?? null;
}

function oneRead(ctx, facet, decl, subject) {
  return { subject, ...cell(ctx.byId.get(subject.id), facet.id, decl.key) };
}

// ---------------------------------------------------------------- primitive element 다섯

/** 값 하나를 크게. focus 가 고른 subject 의 것을 그린다. */
function stat(ctx, facet) {
  const decl = facet.fields[0];
  const subject = shownOf(ctx);
  if (!subject) return `<div class="blank">${stateSpan()}</div>`;
  const where = `${facet.id}/${decl.key}/${subject.id}`;
  const { state, entry } = oneRead(ctx, facet, decl, subject);
  const value = state === "filled" ? drawCell(ctx.report, where, decl, entry.value) : stateSpan();
  return (
    `<div class="field-label">${esc(decl.label ?? decl.key)}</div>` +
    `<div class="big">${value}</div>` +
    notesHtml(entry?.notes)
  );
}

/** 라벨과 값 여럿. 한 facet 안에 타입이 섞여도 읽는 규칙은 하나다 — 고른 subject 의 것. */
function facts(ctx, facet) {
  const subject = shownOf(ctx);
  if (!subject) return `<div class="blank">${stateSpan()}</div>`;
  const rows = facet.fields.map((decl) => {
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    const { state, entry } = oneRead(ctx, facet, decl, subject);
    const value = state === "filled" ? drawCell(ctx.report, where, decl, entry.value) : stateSpan();
    return (
      `<div class="fact"><dt>${esc(decl.label ?? decl.key)}</dt>` +
      `<dd>${value}${notesHtml(entry?.notes)}</dd></div>`
    );
  });
  return `<dl class="facts">${rows.join("")}</dl>`;
}

/** 크기 비교. **자는 subject 전체의 최대값으로 고정한다** — focus 를 옮겨도 길이를 견줄 수 있어야 한다. */
function bars(ctx, facet) {
  const subject = shownOf(ctx);
  if (!subject) return `<div class="blank">${stateSpan()}</div>`;
  const rows = facet.fields.map((decl) => {
    const all = readsOf(ctx, facet, decl)
      .filter((r) => r.state === "filled" && typeof r.entry.value === "number" && Number.isFinite(r.entry.value))
      .map((r) => r.entry.value);
    const top = all.length ? Math.max(...all) : 0;

    const where = `${facet.id}/${decl.key}/${subject.id}`;
    const { state, entry } = oneRead(ctx, facet, decl, subject);
    let mark = '<span class="track"></span>';
    let text;
    if (state !== "filled") {
      text = stateSpan();
    } else if (typeof entry.value === "number" && Number.isFinite(entry.value)) {
      const width = top > 0 && entry.value > 0 ? (entry.value / top) * 100 : 0;
      mark = `<span class="track"><span class="fill" style="width:${width.toFixed(4)}%"></span></span>`;
      text = esc(formatScalar(decl.type, entry.value));
    } else {
      text = undrawable(ctx.report, where, "막대는 수를 요구한다", JSON.stringify(entry.value));
    }
    return (
      `<div class="bar-row"><span class="who">${esc(decl.label ?? decl.key)}</span>${mark}` +
      `<span class="val">${text}</span>${notesHtml(entry?.notes)}</div>`
    );
  });
  return rows.join("");
}

function line(ctx, facet) {
  const decl = facet.fields[0];
  const axis = decl.axis;
  const series = [];
  const misses = [];
  for (const subject of ctx.subjects) {
    const { state, entry } = cell(ctx.byId.get(subject.id), facet.id, decl.key);
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    if (state !== "filled") {
      misses.push(
        `<div class="${subClass(subject, ctx.focus)} miss-row">` +
          `<span class="who">${esc(subject.name)}</span>${stateSpan()}${notesHtml(entry?.notes)}</div>`,
      );
      continue;
    }
    const raw = entry.value;
    const points = [];
    let broken = null;
    if (!Array.isArray(raw)) broken = "선은 점의 배열을 요구한다";
    else
      for (const point of raw) {
        const x = axisNumber(axis, point?.at);
        const y = typeof point?.value === "number" && Number.isFinite(point.value) ? point.value : null;
        if (x === null || y === null) {
          broken = `축(${axis ?? "없음"})이나 값에 그릴 수 없는 것이 있다`;
          break;
        }
        points.push({ x, y, at: point.at });
      }
    if (broken || points.length === 0) {
      misses.push(
        `<div class="${subClass(subject, ctx.focus)} miss-row"><span class="who">${esc(subject.name)}</span>` +
          `${undrawable(ctx.report, where, broken ?? "점이 하나도 없다", JSON.stringify(raw).slice(0, 80))}</div>`,
      );
      continue;
    }
    series.push({ subject, points, notes: entry.notes });
  }
  const body = series.length
    ? lineSvg(series, axis, decl.type, ctx.focus)
    : `<div class="blank">${stateSpan("empty")}</div>`;
  const notes = series
    .map(({ subject, notes: n }) => notesHtml(n, subject.name))
    .join("");
  return (
    `<div class="field-label">${esc(decl.label ?? decl.key)}</div>${body}` +
    (misses.length ? `<div class="miss-rows">${misses.join("")}</div>` : "") +
    notes
  );
}

function lineSvg(series, axis, type, focus) {
  const W = 760, H = 240, L = 78, R = 130, T = 18, B = 34;
  const xs = series.flatMap((s) => s.points.map((p) => p.x));
  const ys = series.flatMap((s) => s.points.map((p) => p.y));
  const xmin = Math.min(...xs), xmax = Math.max(...xs);
  const ymin = Math.min(...ys, 0), ymax = Math.max(...ys);
  const xspan = xmax - xmin || 1;
  const yspan = ymax - ymin || 1;
  const px = (x) => L + ((x - xmin) / xspan) * (W - L - R);
  const py = (y) => H - B - ((y - ymin) / yspan) * (H - T - B);

  const firstAt = series.flatMap((s) => s.points).reduce((a, p) => (p.x < a.x ? p : a)).at;
  const lastAt = series.flatMap((s) => s.points).reduce((a, p) => (p.x > a.x ? p : a)).at;

  const parts = [
    `<line class="axis" x1="${L}" y1="${py(ymin).toFixed(1)}" x2="${W - R}" y2="${py(ymin).toFixed(1)}"/>`,
    `<line class="axis" x1="${L}" y1="${T}" x2="${L}" y2="${H - B}"/>`,
    `<text class="tick ty" x="${L - 8}" y="${py(ymax).toFixed(1)}">${esc(formatScalar(type, ymax))}</text>`,
    `<text class="tick ty" x="${L - 8}" y="${py(ymin).toFixed(1)}">${esc(formatScalar(type, ymin))}</text>`,
    `<text class="tick tx" x="${L}" y="${H - B + 18}">${esc(formatScalar(axis, firstAt))}</text>`,
    `<text class="tick tx end" x="${W - R}" y="${H - B + 18}">${esc(formatScalar(axis, lastAt))}</text>`,
  ];
  series.forEach(({ subject, points }, index) => {
    const focused = subject.id === focus;
    const klass = `series ${subject.tone}${focused ? " is-focus" : ""}`;
    if (points.length === 1) {
      parts.push(`<circle class="${klass}" cx="${px(points[0].x).toFixed(1)}" cy="${py(points[0].y).toFixed(1)}" r="3.5"/>`);
    } else {
      const dash = DASHES[index % DASHES.length];
      const coords = points.map((p) => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`).join(" ");
      parts.push(`<polyline class="${klass}" points="${coords}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`);
    }
    for (const p of points) {
      parts.push(`<circle class="dot ${klass}" cx="${px(p.x).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="2.5"/>`);
    }
    const last = points[points.length - 1];
    parts.push(
      `<text class="series-label ${subject.tone}${focused ? " is-focus" : ""}" x="${(px(last.x) + 8).toFixed(1)}" ` +
        `y="${(py(last.y) + 4).toFixed(1)}">${esc(subject.name)}</text>`,
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
  if (columns.length === 0) return `<div class="blank">${stateSpan()}</div>`;
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
    .map(({ subject }) => ({ ...subject, said: stateSpan() }));
  if (rows.size === 0) {
    return `<div class="field-label">${esc(decl.label ?? decl.key)}</div>` +
      `<div class="blank"><span class="miss empty">${NO_ITEMS}</span></div>${blankRow(blanks)}${fieldNotes(reads)}`;
  }

  const head = [`<th class="corner">${esc(key.label ?? key.key)}</th>`];
  for (const { subject } of reads) {
    head.push(
      `<th class="${subject.tone}${subject.focused ? " is-focus" : ""}">` +
        `<span class="swatch" aria-hidden="true"></span>${esc(subject.name)}</th>`,
    );
  }
  const body = [...rows.entries()].map(([name, held]) => {
    const cells = reads.map(({ subject }) => {
      if (unread.has(subject.id)) return `<td>${stateSpan()}</td>`;
      const item = held.get(subject.id);
      if (!item) return '<td><span class="miss">없음</span></td>';
      const pairs = rest.map((column) =>
        column.key in item
          ? `<span class="cell-pair"><b class="who">${esc(column.label ?? column.key)}</b> ${esc(formatScalar(column.type, item[column.key]))}</span>`
          : "",
      );
      const extra = Object.keys(item).filter((k) => !columns.some((c) => c.key === k));
      if (extra.length) ctx.report.push(`${facet.id}/${name}: 템플릿에 없는 열이라 그리지 않았다 — ${extra.join(", ")}`);
      return `<td class="${subject.focused ? "is-focus" : ""}">${pairs.join("") || "<span class=\"miss\">있음</span>"}</td>`;
    });
    return `<tr><th class="row-label" scope="row">${esc(name)}</th>${cells.join("")}</tr>`;
  });

  return (
    `<div class="field-label">${esc(decl.label ?? decl.key)}</div>` +
    `<table class="items"><thead><tr>${head.join("")}</tr></thead><tbody>${body.join("")}</tbody></table>` +
    blankRow(blanks) + fieldNotes(reads)
  );
}

export const ELEMENTS = { stat, facts, bars, line, list };

// ---------------------------------------------------------------- 페이지

/** 뷰어가 왼쪽에 적을 것. **분석뷰에 섞이지 않는다.** 자리 계산이 두 벌이 되지 않게 여기서 낸다. */
function viewState(seats, focus, shown, wanted) {
  return {
    seats,
    shown, // focus 를 따라 바뀌는 element 가 지금 그리는 subject

    focus,
    // 없는 id 는 결함이 아니다. 분석뷰는 focus 를 놓은 것과 똑같고, 그 사실만 왼쪽이 알린다.
    focusMissing: wanted && !focus ? wanted : null,
  };
}

/**
 * 분석뷰 하나를 HTML 로 그린다.
 *
 * @param {object} input  { template, values, focus }
 *   - 자리와 그 차례는 **값 한 벌들이 정한다.** 명단을 따로 받지 않는다.
 *   - focus 는 subject 의 id. null 이거나 없는 id 면 겹치는 element 는 강조를 풀고,
 *     focus 를 따라 바뀌는 element 는 **첫 subject** 를 그린다.
 * @returns {{html: string, report: string[], view: object|null}}
 *   html 은 **분석뷰뿐**이다 — 템플릿 제목과 facet 들. 도구가 덧붙이는 것은 하나도 들어가지 않는다.
 *   report 는 그리지 못한 자리들, view 는 뷰어가 왼쪽에 적을 화면 상태.
 */
export function renderView({ template, values = [], focus = null } = {}) {
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
  // **가르는 색은 그 차례로만 배정한다** — 값의 크기와 아무 관계가 없다.
  const seats = [...byId.entries()].map(([id, doc], index) => ({
    id,
    name: doc.subjectLabel || id,
    tone: `sub-${(index % TONES) + 1}`,
  }));

  const wanted = focus;
  const seated = seats.some((s) => s.id === wanted) ? wanted : null;
  // focus 를 따라 바뀌는 element 가 그릴 subject. 고른 것이 없으면 첫째다 —
  // 늘어놓기로 돌아가지 않고 빈 화면도 내지 않는다.
  const shown = seated ?? seats[0]?.id ?? null;
  const ctx = { subjects: seats, byId, focus: seated, shown, report };

  for (const [id, doc] of byId) {
    const known = new Set((template.facets ?? []).map((f) => f?.id));
    for (const key of Object.keys(doc.facets ?? {})) {
      if (!known.has(key)) report.push(`${id}: 템플릿에 없는 facet 이라 그리지 않았다 — ${key}`);
    }
  }

  const facets = Array.isArray(template.facets) ? template.facets : [];
  if (facets.length === 0) report.push("템플릿에 facet 이 하나도 없다");

  const sections = facets.map((facet, index) => {
    const at = `facets[${index}]`;
    if (!facet || typeof facet !== "object") {
      return `<section class="facet broken">${undrawable(report, at, "facet 이 객체가 아니다")}</section>`;
    }
    const title = esc(facet.title ?? facet.id ?? at);
    const draw = ELEMENTS[facet.element];
    // primitive element 이름은 분석뷰에 나올 자리가 없다. 구조로만 남긴다 —
    // 참조 뷰어의 배지는 이 속성을 읽어 CSS 가 그리므로 렌더가 낸 글에는 들어가지 않는다.
    const head = `<h2 data-element="${esc(facet.element ?? "")}">${title}</h2>` + notesHtml(facet.notes);
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
    const subjectNotes = seats.map((s) => notesHtml(facetNotes(byId.get(s.id), facet.id), s.name)).join("");
    return (
      `<section class="facet element-${esc(facet.element ?? "unknown")}">${head}` +
      `<div class="body">${body}</div>` +
      (subjectNotes ? `<div class="subject-notes">${subjectNotes}</div>` : "") +
      "</section>"
    );
  });

  // 제목은 템플릿이 선언한 내용이라 렌더의 것이다. 그 밖의 머리말은 전부 뷰어 몫이다.
  const html = `<h1>${esc(template.title ?? template.id ?? "제목 없음")}</h1>` + sections.join("");

  return { html, report, view: viewState(seats, seated, shown, wanted) };
}
