"""정본 스키마 파일을 읽어 검증기를 만든다. 스키마 지식은 여기에 없다."""

from __future__ import annotations

import json
import pathlib
from functools import lru_cache

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

# 정본은 저장소 최상위 `schema/` 다. 설치본에는 그것이 `weave/schema/` 로 함께 실린다
# (`pyproject.toml` 의 force-include) — 판정이 읽는 자리는 어느 쪽이든 하나다.
# 설치본 쪽을 먼저 본다: 체크아웃 안에서는 그 자리가 없어 최상위로 떨어진다.
SCHEMA_DIR = pathlib.Path(__file__).resolve().parent / "schema"
if not SCHEMA_DIR.is_dir():
    SCHEMA_DIR = SCHEMA_DIR.parent.parent / "schema"

COMMON = "weave-common.schema.json"
TEMPLATE = "weave-template.schema.json"
VALUESET = "weave-valueset.schema.json"
RENDER_ARGS = "weave-render-args.schema.json"


@lru_cache(maxsize=1)
def documents() -> dict[str, dict]:
    docs: dict[str, dict] = {}
    for path in sorted(SCHEMA_DIR.glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        docs[doc["$id"]] = doc
    if not docs:
        # 조용히 빈 채로 가면 「아무 결함도 없다」로 보인다 — 통과와 구별되지 않는다.
        raise FileNotFoundError(f"정본 스키마를 찾지 못했다: {SCHEMA_DIR}")
    return docs


@lru_cache(maxsize=1)
def registry() -> Registry:
    pairs = [
        (schema_id, Resource(contents=doc, specification=DRAFT202012))
        for schema_id, doc in documents().items()
    ]
    return Registry().with_resources(pairs)


@lru_cache(maxsize=None)
def validator(schema_id: str, pointer: str = "") -> Draft202012Validator:
    """``weave-valueset.schema.json`` 또는 그 안의 ``#/$defs/...`` 에 대한 검증기."""
    ref = schema_id + pointer
    schema = {"$id": "weave-checker-anchor.json", "$ref": ref}
    return Draft202012Validator(schema, registry=registry())
