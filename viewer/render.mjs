// 참조 렌더. 무엇이 올바른 렌더인지의 기준이다.
//
// 순수 함수다 — 문서를 받아 HTML 문자열을 낸다. DOM 을 모른다. 그래서 브라우저 없이도
// 고정 케이스를 걸 수 있다 (`tests/viewer.test.mjs`).
//
// **facet 종류를 아는 분기가 없다.** element 로만 고른다 (ELEMENTS 표).
// **판정하지 않는다.** 스키마 판정의 정본은 Python 검사기 하나다. 여기서는 그리지 못하는
// 자리를 표시하고 무엇이 이상한지 적기만 한다.

// 주석 갈래 넷의 **정본 이름**이다(glossary §2.4). 참조 뷰어는 언어를 배우는 자리라
// 읽기 좋은 딴 이름을 쓰지 않는다 — 제품 화면의 라벨은 앱이 따로 정한다.
export const KIND_LABEL = { quote: "인용", tip: "팁", note: "보충", caution: "주의" };

export const NO_VALUE = "값 없음";
export const UNANALYZED = "아직 분석 중";
export const NO_ITEMS = "항목 없음";
export const UNDRAWABLE = "그리지 못한다";

// 선을 subject 별로 구별하는 방법. 색이 아니라 점선 무늬다 — 무늬는 우열을 말하지 않는다.
const DASHES = ["", "7 4", "2 3", "10 4 2 4", "1 4", "6 3 1 3"];

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
  if (!valueset) return { state: "unanalyzed", entry: null };
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

function notesHtml(notes, where = "") {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  const rows = notes.map((note) => {
    const kind = note?.kind ?? "note";
    const label = KIND_LABEL[kind] ?? kind;
    const prefix = where ? `<b class="who">${esc(where)}</b> ` : "";
    return (
      `<li class="note note-${esc(kind)}"><span class="kind">${esc(label)}</span>` +
      `<span class="text">${prefix}${esc(note?.text ?? "")}</span></li>`
    );
  });
  return `<ul class="notes">${rows.join("")}</ul>`;
}

function stateSpan(state) {
  return state === "unanalyzed"
    ? `<span class="miss unanalyzed">${UNANALYZED}</span>`
    : `<span class="miss empty">${NO_VALUE}</span>`;
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

function stat(ctx, facet) {
  const decl = facet.fields[0];
  const cards = ctx.subjects.map((subject) => {
    const { state, entry } = cell(ctx.byId.get(subject.id), facet.id, decl.key);
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    const body =
      state === "filled" ? drawCell(ctx.report, where, decl, entry.value) : stateSpan(state);
    return (
      `<div class="card ${subClass(subject, ctx.focus)}">` +
      `<div class="who">${esc(subject.name)}</div><div class="big">${body}</div>` +
      `${notesHtml(entry?.notes)}</div>`
    );
  });
  return `<div class="stat-row"><div class="field-label">${esc(decl.label ?? decl.key)}</div>${cards.join("")}</div>`;
}

function facts(ctx, facet) {
  const head = ['<th class="corner">항목</th>'];
  for (const subject of ctx.subjects) {
    const badge = ctx.byId.has(subject.id) ? "" : `<span class="badge">${UNANALYZED}</span>`;
    head.push(`<th class="${subClass(subject, ctx.focus)}">${esc(subject.name)}${badge}</th>`);
  }
  const rows = facet.fields.map((decl) => {
    const cells = [`<th class="row-label" scope="row">${esc(decl.label ?? decl.key)}</th>`];
    for (const subject of ctx.subjects) {
      const { state, entry } = cell(ctx.byId.get(subject.id), facet.id, decl.key);
      const where = `${facet.id}/${decl.key}/${subject.id}`;
      let inner;
      if (state === "filled") inner = drawCell(ctx.report, where, decl, entry.value);
      else if (state === "unanalyzed") inner = `<span class="dash" title="${UNANALYZED}">—</span>`;
      else inner = stateSpan(state);
      const focused = subject.id === ctx.focus ? " is-focus" : "";
      cells.push(`<td class="cell ${state}${focused}">${inner}${notesHtml(entry?.notes)}</td>`);
    }
    return `<tr>${cells.join("")}</tr>`;
  });
  return `<table class="facts"><thead><tr>${head.join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
}

function bars(ctx, facet) {
  const groups = facet.fields.map((decl) => {
    const reads = ctx.subjects.map((subject) => ({ subject, ...cell(ctx.byId.get(subject.id), facet.id, decl.key) }));
    const numbers = reads
      .filter((r) => r.state === "filled" && typeof r.entry.value === "number" && Number.isFinite(r.entry.value))
      .map((r) => r.entry.value);
    // 눈금은 필드마다 따로 잡는다. 비교 축이 필드이기 때문이다.
    const top = numbers.length ? Math.max(...numbers) : 0;
    const rows = reads.map(({ subject, state, entry }) => {
      const where = `${facet.id}/${decl.key}/${subject.id}`;
      let mark = '<span class="track"></span>';
      let text;
      if (state === "filled") {
        const value = entry.value;
        if (typeof value === "number" && Number.isFinite(value)) {
          const width = top > 0 && value > 0 ? (value / top) * 100 : 0;
          mark = `<span class="track"><span class="fill" style="width:${width.toFixed(4)}%"></span></span>`;
          text = esc(formatScalar(decl.type, value));
        } else {
          text = undrawable(ctx.report, where, "막대는 수를 요구한다", JSON.stringify(value));
        }
      } else {
        text = stateSpan(state);
      }
      return (
        `<div class="bar-row ${subClass(subject, ctx.focus)}">` +
        `<span class="who">${esc(subject.name)}</span>${mark}<span class="val">${text}</span>` +
        `${notesHtml(entry?.notes)}</div>`
      );
    });
    return `<div class="bar-group"><div class="field-label">${esc(decl.label ?? decl.key)}</div>${rows.join("")}</div>`;
  });
  return groups.join("");
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
          `<span class="who">${esc(subject.name)}</span>${stateSpan(state)}${notesHtml(entry?.notes)}</div>`,
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
    : `<div class="empty-frame">${stateSpan("empty")}</div>`;
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
    const klass = focused ? "series is-focus" : "series";
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
      `<text class="series-label${focused ? " is-focus" : ""}" x="${(px(last.x) + 8).toFixed(1)}" ` +
        `y="${(py(last.y) + 4).toFixed(1)}">${esc(subject.name)}</text>`,
    );
  });
  return `<svg class="line" viewBox="0 0 ${W} ${H}" role="img">${parts.join("")}</svg>`;
}

function list(ctx, facet) {
  const decl = facet.fields[0];
  const columns = Array.isArray(decl.columns) ? decl.columns : [];
  const blocks = ctx.subjects.map((subject) => {
    const { state, entry } = cell(ctx.byId.get(subject.id), facet.id, decl.key);
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    let body;
    if (state !== "filled") {
      body = `<div class="empty-frame">${stateSpan(state)}</div>`;
    } else if (!Array.isArray(entry.value)) {
      body = `<div class="empty-frame">${undrawable(ctx.report, where, "목록은 항목의 배열을 요구한다", JSON.stringify(entry.value).slice(0, 80))}</div>`;
    } else if (entry.value.length === 0) {
      body = `<div class="empty-frame"><span class="miss empty">${NO_ITEMS}</span></div>`;
    } else {
      const head = columns.map((c) => `<th>${esc(c.label ?? c.key)}</th>`).join("");
      const rows = entry.value.map((item) => {
        const cells = columns.map((column) =>
          column.key in (item ?? {})
            ? `<td>${esc(formatScalar(column.type, item[column.key]))}</td>`
            : '<td><span class="dash">·</span></td>',
        );
        const extra = Object.keys(item ?? {}).filter((k) => !columns.some((c) => c.key === k));
        if (extra.length) ctx.report.push(`${where}: 템플릿에 없는 열이라 그리지 않았다 — ${extra.join(", ")}`);
        return `<tr>${cells.join("")}</tr>`;
      });
      body = `<table class="items"><thead><tr>${head}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
    }
    return (
      `<div class="list-block ${subClass(subject, ctx.focus)}">` +
      `<div class="who">${esc(subject.name)}</div>${body}${notesHtml(entry?.notes)}</div>`
    );
  });
  return `<div class="field-label">${esc(decl.label ?? decl.key)}</div>${blocks.join("")}`;
}

// primitive element 다섯. 이 표가 렌더의 분기 전부다.
export const ELEMENTS = { stat, facts, bars, line, list };

// ---------------------------------------------------------------- 페이지

/** 뷰어가 왼쪽에 적을 것. **분석뷰에 섞이지 않는다.** 자리 계산이 두 벌이 되지 않게 여기서 낸다. */
function viewState(seats, byId, focus, wanted) {
  return {
    seats: seats.map((s) => ({ ...s, analysed: byId.has(s.id) })),
    focus,
    // 없는 id 는 결함이 아니다. 분석뷰는 focus 를 놓은 것과 똑같고, 그 사실만 왼쪽이 알린다.
    focusMissing: wanted && !focus ? wanted : null,
  };
}

/**
 * 분석뷰 하나를 HTML 로 그린다.
 *
 * @param {object} input  { template, values, subjects, focus }
 *   - subjects 를 주면 그 순서와 명단대로 자리를 잡는다. 값 한 벌이 없는 subject 는 「아직 분석 중」이다.
 *   - focus 는 subject 의 id. null 이면 아무것도 강조하지 않고, 없는 id 면 focus 만 사라진다.
 * @returns {{html: string, report: string[], view: object|null}}
 *   html 은 **분석뷰뿐**이다 — 템플릿 제목과 facet 들. 도구가 덧붙이는 것은 하나도 들어가지 않는다.
 *   report 는 그리지 못한 자리들, view 는 뷰어가 왼쪽에 적을 화면 상태.
 */
export function renderView({ template, values = [], subjects = null, focus = null } = {}) {
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

  let roll = subjects;
  if (!Array.isArray(roll) || roll.length === 0) {
    roll = [...byId.values()].map((v) => ({ id: v.subjectId, label: v.subjectLabel }));
  }
  const seats = roll
    .filter((s) => s && typeof s.id === "string")
    .map((s) => ({ id: s.id, name: s.label || byId.get(s.id)?.subjectLabel || s.id }));

  const wanted = focus;
  const seated = seats.some((s) => s.id === wanted) ? wanted : null;
  const ctx = { subjects: seats, byId, focus: seated, report };

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

  return { html, report, view: viewState(seats, byId, seated, wanted) };
}
