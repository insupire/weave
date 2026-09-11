PY := .venv/bin/python

.PHONY: all setup test check types types-check clean

all: test types-check check

setup: .venv/.stamp

.venv/.stamp: requirements.txt
	python3 -m venv .venv
	.venv/bin/pip install --quiet -r requirements.txt
	touch $@

# 고정 케이스. 정상 사례가 통과하고 결함 사례가 막히는 것을 함께 본다.
test: setup
	$(PY) -m unittest discover -s tests -t .

# 검사기를 예시에 직접 돌린다. CLI 가 사는지 본다.
check: setup
	$(PY) -m weave template tests/fixtures/ok/template.json
	$(PY) -m weave values --template tests/fixtures/ok/template.json \
		tests/fixtures/ok/values-filled.json \
		tests/fixtures/ok/values-empty.json \
		tests/fixtures/ok/values-mixed.json

# 닫힌 어휘를 소비자 둘의 언어로 다시 쓴다.
types:
	python3 tools/emit_types.py

# generated/ 가 스키마와 갈렸는지 본다.
types-check:
	python3 tools/emit_types.py --check

clean:
	rm -rf .venv
