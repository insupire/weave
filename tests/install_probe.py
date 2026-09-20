"""**설치본만으로 검사기가 도는가.** `make install-check` 가 깨끗한 venv 안에서 부른다.

저장소 안에서 도는 것은 든 쪽이 겪는 것이 아니다. 여기서 보는 것은 셋이다 —
읽은 것이 저장소 나무가 아니라 설치본인가, 정본 스키마가 함께 실려 판정이 서는가,
든 쪽이 「무엇으로 쟀는가」에 적을 판이 값으로 나오는가.

고정 케이스는 저장소의 것을 그대로 쓴다. **자료는 저장소에서 오고 코드와 스키마는 설치본에서
온다** — 그것이 이 검사가 가르려는 자리다.
"""

from __future__ import annotations

import json
import pathlib

import weave
from weave import check_valueset

FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures" / "ok"

where = pathlib.Path(weave.__file__).resolve()
assert "site-packages" in where.parts, f"설치본이 아니라 저장소 나무를 읽었다: {where}"
assert weave.__version__, "판이 비어 있다 — 든 쪽이 무엇으로 쟀는지 적을 수 없다"

template = json.loads((FIXTURES / "template.json").read_text(encoding="utf-8"))
values = json.loads((FIXTURES / "values-filled.json").read_text(encoding="utf-8"))

passed = check_valueset(values, template)
assert passed.ok, f"정상 사례가 막혔다: {[str(p) for p in passed.problems]}"

# **결함 사례도 함께 본다.** 늘 통과하는 검사기는 통과와 구별되지 않는다 — 스키마를 못 읽어
# 아무것도 못 보는 설치본이 정확히 그렇게 보인다.
broken = json.loads(json.dumps(values))
broken["templateId"] = "없는-템플릿"
blocked = check_valueset(broken, template)
assert not blocked.ok, "결함 사례가 지나갔다 — 판정이 서 있지 않다"

print(f"설치본으로 검사기가 돈다 — weave {weave.__version__} · {where.parent}")
