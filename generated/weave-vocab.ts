// schema/weave-common.schema.json 에서 생성된다. 직접 고치지 않는다.

/** 값의 타입. 렌더는 이 닫힌 목록에만 의존한다. */
export type WeaveType = "number" | "money" | "ratio" | "multiple" | "duration" | "age" | "boolean" | "text" | "date";
export const WEAVE_TYPES = ["number", "money", "ratio", "multiple", "duration", "age", "boolean", "text", "date"] as const satisfies readonly WeaveType[];

/** 크기를 견줄 수 있는 타입. */
export type WeaveNumericType = "number" | "money" | "ratio" | "multiple" | "duration" | "age";
export const WEAVE_NUMERIC_TYPES = ["number", "money", "ratio", "multiple", "duration", "age"] as const satisfies readonly WeaveNumericType[];

/** 순서를 매길 수 있는 타입. range 와 series 축이 쓴다. */
export type WeaveOrderedType = "number" | "money" | "ratio" | "multiple" | "duration" | "age" | "date";
export const WEAVE_ORDERED_TYPES = ["number", "money", "ratio", "multiple", "duration", "age", "date"] as const satisfies readonly WeaveOrderedType[];

/** series 의 가로축이 될 수 있는 타입. */
export type WeaveAxisType = "age" | "date" | "duration" | "number";
export const WEAVE_AXIS_TYPES = ["age", "date", "duration", "number"] as const satisfies readonly WeaveAxisType[];

/** 한 필드가 담는 값의 모양. */
export type WeaveShape = "single" | "range" | "series" | "items";
export const WEAVE_SHAPES = ["single", "range", "series", "items"] as const satisfies readonly WeaveShape[];

/** primitive element. 렌더가 구현하는 것은 이 목록뿐이다. */
export type WeaveElement = "stat" | "facts" | "bars" | "line" | "rows" | "parts";
export const WEAVE_ELEMENTS = ["stat", "facts", "bars", "line", "rows", "parts"] as const satisfies readonly WeaveElement[];

/** 주석의 갈래. 넷뿐이고 확실성 수치는 없다. */
export type WeaveAnnotationKind = "quote" | "tip" | "note" | "caution";
export const WEAVE_ANNOTATION_KINDS = ["quote", "tip", "note", "caution"] as const satisfies readonly WeaveAnnotationKind[];
