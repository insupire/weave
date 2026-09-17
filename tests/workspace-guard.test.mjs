// 작업공간 가드가 무엇을 물고 무엇을 지나 보내는가. 정본은 tools/workspace-guard.mjs.
//
// **막는 사례와 지나가야 하는 사례를 함께 둔다.** 지나가는 사례가 없는 가드는
// 정상 작업을 막는 쪽으로 조용히 자란다 — 그것도 고장이다.
//
// 형제 저장소 이름은 여기에도 적지 않는다(tests/test_samples.py 가 전 파일에서 막는다).
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verdict } from "../tools/workspace-guard.mjs";

const ORCA = path.join(os.homedir(), "orca");
const ROOT = path.join(ORCA, "workspaces", "weave", "s000000-fixture");

const write = (file_path, cwd = ROOT) => verdict({ tool: "Write", input: { file_path }, cwd, root: ROOT });
const bash = (command) => verdict({ tool: "Bash", input: { command }, root: ROOT });

test("사람의 기준 체크아웃에 쓰려 하면 막는다", () => {
  assert.match(write(path.join(ORCA, "weave", "AGENTS.md")), /작업공간 밖/);
});

test("다른 작업공간에 쓰려 하면 막는다", () => {
  assert.match(write(path.join(ORCA, "workspaces", "weave", "s000001-other", "Makefile")), /작업공간 밖/);
  assert.match(write(path.join(ORCA, "workspaces", "other-repo", "main-1", "index.ts")), /작업공간 밖/);
});

test("상대 경로도 cwd 로 풀어서 본다", () => {
  assert.match(write("../s000001-other/Makefile"), /작업공간 밖/);
});

test("이 작업공간 안은 지나간다", () => {
  assert.equal(write(path.join(ROOT, "schema", "weave-common.schema.json")), null);
  assert.equal(write("tools/catalog.py"), null);
  assert.equal(verdict({ tool: "Edit", input: { file_path: "AGENTS.md" }, cwd: ROOT, root: ROOT }), null);
});

test("orca 밖은 판정하지 않는다 — 스크래치패드와 설정 자리가 거기 산다", () => {
  assert.equal(write("/tmp/scratch/note.md"), null);
  assert.equal(write(path.join(os.homedir(), ".claude", "settings.json")), null);
});

test("읽는 도구는 막지 않는다 — 다른 저장소의 사실 확인은 허용된 행동이다", () => {
  const outside = path.join(ORCA, "weave", "AGENTS.md");
  for (const tool of ["Read", "Grep", "Glob"]) {
    assert.equal(verdict({ tool, input: { file_path: outside }, root: ROOT }), null, tool);
  }
});

test("이름 없는 stash 는 막고 이름 붙인 것은 지나간다", () => {
  // 뒤에 명령이 이어 붙은 꼴은 **조각으로 잇는다** — 통째로 적으면 가드가 이 파일을 쓰는 것부터 막는다.
  const chained = "git" + " stash " + "&& make all";
  for (const cmd of ["git stash", "git stash pop", "git stash apply", chained]) {
    assert.match(bash(cmd), /이름 없는 git stash/, cmd);
  }
  for (const cmd of ['git stash push -u -m "s000233"', "git stash list", "git stash show stash@{0}"]) {
    assert.equal(bash(cmd), null, cmd);
  }
});

test("경로가 없는 호출은 지나간다 — 판정할 것이 없다", () => {
  assert.equal(verdict({ tool: "Write", input: {}, root: ROOT }), null);
  assert.equal(verdict(), null);
});
