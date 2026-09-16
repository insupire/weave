#!/usr/bin/env node
/**
 * 작업공간 가드 — 도구를 부르는 시점에 막는다.
 *
 * 「쓰기는 배정된 작업공간 안에서만」은 AGENTS.md 와 PM 규약이 함께 적은 규칙인데
 * 글로만 있었다. 글은 어겨도 아무것도 실패하지 않는다. 이 자리가 실패시킨다.
 *
 * 막는 것은 둘뿐이다.
 *   1. 이 워크트리 밖의 `~/orca` 경로에 파일 도구로 쓰기 — 사람의 기준 체크아웃과 남의 작업공간
 *   2. 이름 없는 `git stash` · `stash pop` · `stash apply` — 스택은 워크트리들이 함께 쓴다
 *
 * ⚠️ **셸 안의 쓰기는 못 잡는다.** `sed -i`, 리다이렉션, `cp`, `python -c` 는 그대로 지나간다 —
 *    임의의 셸을 해석하는 값이 그 비용보다 작다. 파일 도구의 경로와 stash 두 자리가
 *    실제로 사고가 난 자리라 거기만 문다. 촘촘한 척하지 않는다.
 *
 * 읽기는 판정하지 않는다. 다른 저장소의 사실 확인은 허용된 행동이고, 읽는 도구도 `file_path` 를 갖는다.
 *
 * PreToolUse 훅. 페이로드를 stdin 으로 받고 exit 2 로 막는다. 선언은 `.claude/settings.json`.
 */
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ORCA = path.join(os.homedir(), "orca");

const WRITERS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

// 이름 없는 stash 만 문다. `git stash push -m` 과 `git stash list` 는 지나간다.
const BARE_STASH = /\bgit\s+stash\s*(?:$|[;&|])|\bgit\s+stash\s+(?:pop|apply)\s*(?:$|[;&|])/;

/** 순수 판정. 막을 까닭이 있으면 글, 없으면 null. 파일을 읽지 않는다 — 그래야 고정 케이스가 붙는다. */
export function verdict({ tool, input = {}, cwd = ROOT, root = ROOT } = {}) {
  if (tool === "Bash") {
    return BARE_STASH.test(input.command ?? "")
      ? "이름 없는 git stash — 스택은 다른 워크트리와 함께 쓴다. 남의 작업을 뽑는다. `git stash push -u -m \"<태그>\"` 로 이름을 붙여라."
      : null;
  }
  if (!WRITERS.has(tool)) return null;
  const target = input.file_path ?? input.notebook_path;
  if (!target) return null;
  const resolved = path.resolve(cwd, target);
  const inside = (dir) => resolved === dir || resolved.startsWith(dir + path.sep);
  if (!inside(ORCA)) return null; // 스크래치패드와 설정 자리는 여기 밖이다
  if (inside(root)) return null;
  return `배정된 작업공간 밖의 orca 경로에 쓰려 한다 — ${resolved}\n쓸 수 있는 자리는 ${root} 뿐이다. 다른 저장소가 필요하면 그 repo 의 owner 에게 PM 이 배정한다.`;
}

const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (invokedDirectly) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  let payload = {};
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString() || "{}");
  } catch {
    process.exit(0); // 읽지 못한 페이로드로 일을 막지 않는다
  }
  const reason = verdict({
    tool: payload.tool_name,
    input: payload.tool_input,
    cwd: payload.cwd ?? ROOT,
  });
  if (reason) {
    process.stderr.write(`[작업공간 가드] ${reason}\n`);
    process.exit(2);
  }
}
