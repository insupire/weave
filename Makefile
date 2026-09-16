PY := .venv/bin/python

.PHONY: all setup test check types types-check viewer viewer-check viewer-test clean

all: test types-check check viewer-check viewer-test

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

# 그리는 쪽의 고정 케이스. node 가 있어야 돈다 (개발용이고 런타임 의존이 아니다).
# 없으면 이름을 대고 실패한다 — 조용히 건너뛰면 통과와 구별되지 않는다.
viewer-test:
	@command -v node >/dev/null 2>&1 || { \
		echo "node 가 없어 그리는 쪽의 고정 케이스를 돌리지 못했다. 건너뛰지 않는다 — node 를 깔거나 CI 에서 돌린다" >&2; \
		exit 1; }
	node --test tests/viewer.test.mjs

clean:
	rm -rf .venv
