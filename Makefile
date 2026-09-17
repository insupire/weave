PY := .venv/bin/python
# 무엇과 견줘 바뀐 자리를 고르는가. `make relevant BASE=<ref>` 로 바꾼다.
BASE ?= origin/develop

.PHONY: all relevant setup test check types types-check viewer viewer-check \
        node-check viewer-test guard-test clean

all: test types-check check viewer-check viewer-test guard-test

# 변경에 필요한 검사만. 고르는 표의 정본은 tools/relevant.py 이고 AGENTS.md 가 그것을 사람 말로 적는다.
# **확인하는 동사만 고른다** — 산출물을 다시 쓰는 viewer·types 는 사람이 부른다.
relevant: setup
	@changed="$$(git diff --name-only $(BASE)...HEAD; git diff --name-only; \
	             git ls-files --others --exclude-standard)"; \
	targets="$$(printf '%s\n' "$$changed" | python3 tools/relevant.py)"; \
	if [ -z "$$targets" ]; then echo "관련 검사 없음 — 바뀐 자리가 없다"; \
	else echo "관련 검사: $$targets"; $(MAKE) $$targets; fi

setup: .venv/.stamp

.venv/.stamp: requirements.txt
	python3 -m venv .venv
	.venv/bin/pip install --quiet -r requirements.txt
	touch $@

# 고정 케이스. 정상 사례가 통과하고 결함 사례가 막히는 것을 함께 본다.
test: setup
	$(PY) -m unittest discover -s tests -t .

# 검사기를 고정 케이스와 샘플 전부에 직접 돌린다. CLI 가 사는지 본다.
check: setup
	$(PY) -m weave template tests/fixtures/ok/template.json
	$(PY) -m weave values --template tests/fixtures/ok/template.json \
		tests/fixtures/ok/values-filled.json \
		tests/fixtures/ok/values-empty.json \
		tests/fixtures/ok/values-mixed.json
	@for d in samples/*/; do \
		$(PY) -m weave template $$d/template.json || exit 1; \
		$(PY) -m weave values --template $$d/template.json $$d/values-*.json || exit 1; \
	done

# 닫힌 어휘를 소비자 둘의 언어로 다시 쓴다.
types:
	python3 tools/emit_types.py

# generated/ 가 스키마와 갈렸는지 본다.
types-check:
	python3 tools/emit_types.py --check

# render/ 와 viewer/ 와 samples/ 를 의존성 없는 한 장으로 묶는다.
viewer:
	python3 tools/build_viewer.py

# viewer.html 이 소스·샘플과 갈렸는지 본다.
viewer-check:
	python3 tools/build_viewer.py --check

# node 를 쓰는 고정 케이스의 선행 조건. 없으면 이름을 대고 실패한다 —
# 조용히 건너뛰면 통과와 구별되지 않는다 (개발용이고 런타임 의존이 아니다).
node-check:
	@command -v node >/dev/null 2>&1 || { \
		echo "node 가 없어 node 쪽 고정 케이스를 돌리지 못했다. 건너뛰지 않는다 — node 를 깔거나 CI 에서 돌린다" >&2; \
		exit 1; }

# 그리는 쪽의 고정 케이스.
viewer-test: node-check
	node --test tests/viewer.test.mjs

# 작업공간 가드가 무엇을 물고 무엇을 지나 보내는가.
guard-test: node-check
	node --test tests/workspace-guard.test.mjs

clean:
	rm -rf .venv
