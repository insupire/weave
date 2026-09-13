"""정본 스키마 파일을 읽어 검증기를 만든다. 스키마 지식은 여기에 없다."""

from __future__ import annotations

import json
import pathlib
from functools import lru_cache

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

SCHEMA_DIR = pathlib.Path(__file__).resolve().parent.parent / "schema"

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
