"""weave — 분석뷰를 선언하는 스키마와 그 검사기.

정본은 ``schema/`` 의 JSON Schema 다. 이 패키지는 그것을 읽어 판정하기만 한다.
"""

from weave.check import Problem, Result, check_render_args, check_template, check_valueset

#: **판 하나가 스키마와 검사기를 함께 가리킨다.** 검사기는 스키마를 읽어 판정하기만 해서 둘이
#: 따로 움직일 수 없다. 든 쪽은 이 값을 읽어 「무엇으로 쟀는가」에 적는다.
#:
#: 어휘·모양·제약이 바뀌면 minor, 판정만 고치면 patch 다. 1.0 전이라 minor 가 어긋나는 자리다.
__version__ = "0.1.0"

__all__ = [
    "Problem",
    "Result",
    "__version__",
    "check_render_args",
    "check_template",
    "check_valueset",
]
