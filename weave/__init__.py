"""weave — 분석뷰를 선언하는 스키마와 그 검사기.

정본은 ``schema/`` 의 JSON Schema 다. 이 패키지는 그것을 읽어 판정하기만 한다.
"""

from weave.check import Problem, Result, check_template, check_valueset

__all__ = ["Problem", "Result", "check_template", "check_valueset"]
