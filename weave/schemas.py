"""Read the canonical schema files and build validators. No schema knowledge lives here."""

from __future__ import annotations

import json
import pathlib
from functools import lru_cache

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

# The canonical place is the repository's top-level `schema/`. An installed build carries
# the same files at `weave/schema/` (force-include in `pyproject.toml`) — either way the
# checker reads one place. Look at the installed place first: inside a checkout it does not
# exist, so this falls through to the top level.
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
        # Going on silently empty would look like "no defects at all" — indistinguishable
        # from passing.
        raise FileNotFoundError(f"canonical schemas not found: {SCHEMA_DIR}")
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
    """A validator for ``weave-valueset.schema.json`` or a ``#/$defs/...`` inside it."""
    ref = schema_id + pointer
    schema = {"$id": "weave-checker-anchor.json", "$ref": ref}
    return Draft202012Validator(schema, registry=registry())
