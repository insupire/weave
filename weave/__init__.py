"""weave — the schema that declares an analysis view, and its checker.

The canonical form is the JSON Schema under ``schema/``. This package only reads it
and decides against it.

Everything this package emits is English: the defect messages reach three consumers
and a model, so the shared contract does not speak any one consumer's language.
"""

from weave.check import Problem, Result, check_render_args, check_template, check_valueset

#: **One version covers the schema and the checker together.** The checker only reads the
#: schema and decides, so the two cannot move apart. Whoever depends on this reads the value
#: and records what it measured with.
#:
#: Vocabulary, shape or constraint changes bump the minor; a decision-only fix bumps the
#: patch. Before 1.0 the minor is where breaks land.
__version__ = "0.1.1"

__all__ = [
    "Problem",
    "Result",
    "__version__",
    "check_render_args",
    "check_template",
    "check_valueset",
]
