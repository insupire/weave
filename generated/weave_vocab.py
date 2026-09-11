# schema/weave-common.schema.json 에서 생성된다. 직접 고치지 않는다.

from typing import Literal

# 값의 타입. 렌더는 이 여덟에만 의존한다.
Type = Literal["number", "money", "ratio", "duration", "age", "boolean", "text", "date"]
TYPES: tuple[Type, ...] = ("number", "money", "ratio", "duration", "age", "boolean", "text", "date",)

# 크기를 견줄 수 있는 타입.
NumericType = Literal["number", "money", "ratio", "duration", "age"]
NUMERICTYPES: tuple[NumericType, ...] = ("number", "money", "ratio", "duration", "age",)

# 순서를 매길 수 있는 타입. range 와 series 축이 쓴다.
OrderedType = Literal["number", "money", "ratio", "duration", "age", "date"]
ORDEREDTYPES: tuple[OrderedType, ...] = ("number", "money", "ratio", "duration", "age", "date",)

# series 의 가로축이 될 수 있는 타입.
AxisType = Literal["age", "date", "duration", "number"]
AXISTYPES: tuple[AxisType, ...] = ("age", "date", "duration", "number",)

# 한 필드가 담는 값의 모양.
Shape = Literal["single", "range", "series", "items"]
SHAPES: tuple[Shape, ...] = ("single", "range", "series", "items",)

# 원시 요소. 렌더가 구현하는 것은 이 다섯이다.
Element = Literal["stat", "facts", "bars", "line", "list"]
ELEMENTS: tuple[Element, ...] = ("stat", "facts", "bars", "line", "list",)

# 주석의 갈래. 넷뿐이고 확실성 수치는 없다.
AnnotationKind = Literal["quote", "tip", "note", "caution"]
ANNOTATIONKINDS: tuple[AnnotationKind, ...] = ("quote", "tip", "note", "caution",)

__all__ = [
    "Type",
    "NumericType",
    "OrderedType",
    "AxisType",
    "Shape",
    "Element",
    "AnnotationKind",
    "TYPES",
    "NUMERICTYPES",
    "ORDEREDTYPES",
    "AXISTYPES",
    "SHAPES",
    "ELEMENTS",
    "ANNOTATIONKINDS",
]
