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

//
// **subject 를 한 좌표에 겹친다.** 순위 문법을 스키마에서 뺀 대신 비교를 시각이 맡기로 했으므로
// (glossary §3.14 원칙 7), 나란히 늘어놓아 사람이 머릿속에서 견주게 하면 안 된다.
// 한 좌표란 **값이 같은 자로 재어지는 자리**다 — 한 필드, 한 열, 한 항목.
// 잴 자가 없는 것(참거짓·글)만 나란히 가른다 (원칙 9).

/** 한 자로 잴 수 있는 타입. 이것들만 겹칠 수 있다. */
const MEASURABLE = new Set(["number", "money", "ratio", "duration", "age", "date"]);

function axisNumberOf(type, raw) {
  if (type === "date") {
    const ms = Date.parse(`${raw}T00:00:00Z`);
    return Number.isNaN(ms) ? null : ms / 86400000;
  }
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

/** 글의 너비를 어림잡는다. 한글은 글자 크기만큼, 나머지는 그 절반쯤. */
function textWidth(text, size) {
  let w = 0;
  for (const ch of String(text)) w += /[ᄀ-ᇿ㄰-㆏가-힯一-鿿]/.test(ch) ? size : size * 0.56;
  return w;
}

/** 이름표가 겹치지 않게 줄을 나눠 준다. 자리는 값이 정하고 줄만 비켜 준다. */
function intoLanes(marks, width) {
  const ends = [];
  return marks
    .slice()
    .sort((a, b) => a.x - b.x)
    .map((mark) => {
      const w = mark.w ?? textWidth(mark.text, 11);
      const left = Math.max(2, Math.min(width - w - 2, mark.x - w / 2));
      let lane = 0;
      while (ends[lane] !== undefined && ends[lane] + 8 > left) lane += 1;
      ends[lane] = left + w;
      return { ...mark, left, lane };
    });
}

/** 좌표에 못 얹은 subject. **겹친 자리에서도 사라지면 안 된다** — 없다는 것 자체가 정보다. */
function blankRow(blanks) {
  if (blanks.length === 0) return "";
  const said = blanks
    .map((b) => `<span class="off ${b.focused ? "is-focus" : ""}"><b class="who">${esc(b.name)}</b> ${b.said}</span>`)
    .join("");
  return `<div class="offs">${said}</div>`;
}

/**
 * **겹치는 좌표 하나.** subject 마다 자리를 주지 않고 같은 축에 얹는다.
 * `zero` 면 0 을 왼쪽 끝으로 잡아 크기가 길이로 읽히고, 아니면 값들이 놓인 범위를 편다.
 */
function overlayAxis(ctx, facet, reads, decl, { zero = false, big = false } = {}) {
  // 좌표의 폭은 실제로 그려지는 폭에 가깝게 잡는다. 크게 잡으면 글자가 줄어 안 읽힌다.
  const W = 600;
  const pad = big ? 16 : 10;
  const marks = [];
  const blanks = [];
  for (const { subject, state, entry } of reads) {
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    if (state !== "filled") {
      blanks.push({ ...subject, said: stateSpan() });
      continue;
    }
    const raw = entry.value;
    const lo = axisNumberOf(decl.type, decl.shape === "range" ? raw?.min ?? raw?.max : raw);
    const hi = axisNumberOf(decl.type, decl.shape === "range" ? raw?.max ?? raw?.min : raw);
    const shown = formatValue(decl, raw);
    // 값은 있는데 좌표에 못 얹는다. **조용히 「값 없음」으로 삼키지 않는다** — 무엇이 이상한지 적는다.
    if (lo === null || hi === null || shown === null) {
      const why = `선언한 모양(${decl.shape ?? "없음"})과 값의 생김새가 다르다`;
      blanks.push({ ...subject, said: undrawable(ctx.report, where, why, JSON.stringify(raw)) });
      continue;
    }
    marks.push({ subject, lo: Math.min(lo, hi), hi: Math.max(lo, hi), shown });
  }
  if (marks.length === 0) {
    return `<div class="blank">${stateSpan()}</div>${blankRow(blanks)}`;
  }

  const values = marks.flatMap((m) => [m.lo, m.hi]);
  const useZero = zero && decl.type !== "date" && Math.min(...values) >= 0;
  const lo = useZero ? 0 : Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const inner = W - pad * 2;
  const at = (v) => pad + ((v - lo) / span) * inner;

  const axisY = big ? 46 : 18;
  const labelTop = big ? 64 : 34;
  // big 이면 값과 이름이 위아래로 한 자리를 쓴다. 넓은 쪽으로 자리를 잡아야 둘 다 안 겹친다.
  const placed = intoLanes(
    marks.map((m) => {
      const text = big ? m.subject.name : `${m.subject.name} ${m.shown}`;
      const w = big ? Math.max(textWidth(text, 11), textWidth(m.shown, 17)) : textWidth(text, 11);
      return { ...m, x: at((m.lo + m.hi) / 2), text, w };
    }),
    W,
  );
  const height = labelTop + (Math.max(...placed.map((p) => p.lane)) + 1) * 15;

  const parts = [`<line class="rule" x1="${pad}" y1="${axisY}" x2="${W - pad}" y2="${axisY}"/>`];
  if (useZero) parts.push(`<text class="origin" x="${pad}" y="${axisY + 12}">0</text>`);
  for (const mark of placed) {
    const focused = mark.subject.focused ? " is-focus" : "";
    if (mark.hi > mark.lo) {
      parts.push(`<line class="span${focused}" x1="${at(mark.lo).toFixed(1)}" y1="${axisY}" x2="${at(mark.hi).toFixed(1)}" y2="${axisY}"/>`);
      for (const end of [mark.lo, mark.hi]) {
        parts.push(`<line class="cap${focused}" x1="${at(end).toFixed(1)}" y1="${axisY - 4}" x2="${at(end).toFixed(1)}" y2="${axisY + 4}"/>`);
      }
    } else {
      parts.push(`<circle class="dot${focused}" cx="${mark.x.toFixed(1)}" cy="${axisY}" r="${mark.subject.focused ? 4.5 : 3.2}"/>`);
    }
    const y = labelTop + mark.lane * 15;
    if (mark.lane > 0) {
      parts.push(`<line class="lead" x1="${mark.x.toFixed(1)}" y1="${axisY + 6}" x2="${mark.x.toFixed(1)}" y2="${y - 9}"/>`);
    }
    // 값은 이름과 같은 자리에서 위로 선다. 자리를 함께 잡았으므로 겹치지 않는다.
    if (big) {
      parts.push(`<text class="big-value${focused}" x="${mark.left.toFixed(1)}" y="${axisY - 14}">${esc(mark.shown)}</text>`);
    }
    parts.push(`<text class="tag${focused}" x="${mark.left.toFixed(1)}" y="${y}">${esc(mark.text)}</text>`);
  }
  return (
    `<svg class="overlay" viewBox="0 0 ${W} ${height}" role="img">${parts.join("")}</svg>` + blankRow(blanks)
  );
}

/** 잴 자가 없어 겹칠 수 없는 값들. 나란히 두되 한 줄에 모은다 (원칙 9). */
function sideBySide(ctx, facet, reads, decl) {
  const said = reads.map(({ subject, state, entry }) => {
    const where = `${facet.id}/${decl.key}/${subject.id}`;
    const shown = state === "filled" ? drawCell(ctx.report, where, decl, entry.value) : stateSpan();
    return (
      `<span class="pair ${subject.focused ? "is-focus" : ""}">` +
      `<b class="who">${esc(subject.name)}</b> ${shown}</span>`
    );
  });
  return `<div class="pairs">${said.join("")}</div>`;
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

// ---------------------------------------------------------------- primitive element 다섯

function stat(ctx, facet) {
  const decl = facet.fields[0];
  const reads = readsOf(ctx, facet, decl);
  const body = MEASURABLE.has(decl.type)
    ? overlayAxis(ctx, facet, reads, decl, { zero: true, big: true })
    : sideBySide(ctx, facet, reads, decl); // 참거짓·글은 잴 자가 없다
  return `<div class="field-label">${esc(decl.label ?? decl.key)}</div>${body}${fieldNotes(reads)}`;
}

function facts(ctx, facet) {
  return facet.fields
    .map((decl) => {
      const reads = readsOf(ctx, facet, decl);
      const body = MEASURABLE.has(decl.type)
        ? overlayAxis(ctx, facet, reads, decl)
        : sideBySide(ctx, facet, reads, decl);
      return `<div class="row"><div class="field-label">${esc(decl.label ?? decl.key)}</div>${body}${fieldNotes(reads)}</div>`;
    })
    .join("");
}

function bars(ctx, facet) {
  return facet.fields
    .map((decl) => {
      const reads = readsOf(ctx, facet, decl);
      // 크기 비교라 0 을 왼쪽 끝으로 잡는다. 거리가 곧 크기다.
      return `<div class="row"><div class="field-label">${esc(decl.label ?? decl.key)}</div>${overlayAxis(ctx, facet, reads, decl, { zero: true })}${fieldNotes(reads)}</div>`;
    })
    .join("");
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
    head.push(`<th class="${subject.focused ? "is-focus" : ""}">${esc(subject.name)}</th>`);
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
function viewState(seats, focus, wanted) {
  return {
    seats,
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
 *   - focus 는 subject 의 id. null 이면 아무것도 강조하지 않고, 없는 id 면 focus 만 사라진다.
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
  const seats = [...byId.entries()].map(([id, doc]) => ({ id, name: doc.subjectLabel || id }));

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

  return { html, report, view: viewState(seats, seated, wanted) };
}
