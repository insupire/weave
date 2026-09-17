// lucide 아이콘. **실물을 그대로 옮겼다** — 기억으로 그리지 않는다.
//
//   출처   npm lucide-static@1.44.0 의 icons/<name>.svg
//   라이선스 ISC — Copyright (c) 2026 Lucide Icons and Contributors
//            https://github.com/lucide-icons/lucide/blob/main/LICENSE
//   다시 받기 npm pack lucide-static@1.44.0 로 풀어 icons/ 에서 아래 이름을 꺼낸다
//
// CDN 도 아이콘 폰트도 쓰지 않는다 — 파일 하나로 열려야 하므로 여기 인라인한다.
// 주석 갈래는 **통용되는 UI 시맨틱**을 따른다 — 주의는 warning, 보충은 info.
// primitive element 는 구조를 가리킨다. 도메인(돈·병원·서류) 그림은 두지 않는다.

export const LUCIDE_VERSION = "1.44.0";

export const ICON = {
  // 주석 갈래 — 인용. 근거·출처라 상태가 아니다 (lucide `quote`)
  quote: "<path d=\"M16 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\" /> <path d=\"M5 3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2 1 1 0 0 1 1 1v1a2 2 0 0 1-2 2 1 1 0 0 0-1 1v2a1 1 0 0 0 1 1 6 6 0 0 0 6-6V5a2 2 0 0 0-2-2z\" />",
  // 주석 갈래 — 팁. 도움말의 통용 표시 (lucide `lightbulb`)
  tip: "<path d=\"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5\" /> <path d=\"M9 18h6\" /> <path d=\"M10 22h4\" />",
  // 주석 갈래 — 보충. info 의 통용 표시 (lucide `info`)
  note: "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <path d=\"M12 16v-4\" /> <path d=\"M12 8h.01\" />",
  // 주석 갈래 — 주의. warning 의 통용 표시 (lucide `circle-alert`)
  caution: "<circle cx=\"12\" cy=\"12\" r=\"10\" /> <line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\" /> <line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\" />",
  // primitive element — stat (lucide `hash`)
  stat: "<line x1=\"4\" x2=\"20\" y1=\"9\" y2=\"9\" /> <line x1=\"4\" x2=\"20\" y1=\"15\" y2=\"15\" /> <line x1=\"10\" x2=\"8\" y1=\"3\" y2=\"21\" /> <line x1=\"16\" x2=\"14\" y1=\"3\" y2=\"21\" />",
  // primitive element — facts (lucide `table-properties`)
  facts: "<path d=\"M15 3v18\" /> <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M21 9H3\" /> <path d=\"M21 15H3\" />",
  // primitive element — bars (lucide `chart-bar`)
  bars: "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /> <path d=\"M7 16h8\" /> <path d=\"M7 11h12\" /> <path d=\"M7 6h3\" />",
  // primitive element — line (lucide `chart-line`)
  line: "<path d=\"M3 3v16a2 2 0 0 0 2 2h16\" /> <path d=\"m19 9-5 5-4-4-3 3\" />",
  // primitive element — rows (lucide `rows-3`)
  rows: "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" /> <path d=\"M21 9H3\" /> <path d=\"M21 15H3\" />",
  // primitive element — parts (lucide `chart-pie`)
  parts: "<path d=\"M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z\" /> <path d=\"M21.21 15.89A10 10 0 1 1 8 2.83\" />",
};
