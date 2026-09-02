"""Export the FastAPI OpenAPI schema to a static JSON file.

Usage from the ``ai/`` directory::

    python -m src.export_openapi              # writes ai/openapi.json
    python -m src.export_openapi --output out.json

The script imports the ``app`` object from ``main.py`` so all routes and
Pydantic models are included in the generated schema.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import sys as _sys

# Ensure ``ai/`` is on sys.path so that ``main`` and ``src`` are importable.
_AI_DIR = Path(__file__).resolve().parent.parent
if str(_AI_DIR) not in _sys.path:
    _sys.path.insert(0, str(_AI_DIR))

from main import app  # noqa: E402


def export(output: Path = _AI_DIR / "openapi.json") -> Path:
    """Write the OpenAPI 3.1 schema to *output* and return its path."""
    schema = app.openapi()
    output.write_text(json.dumps(schema, indent=2, ensure_ascii=False), encoding="utf-8")
    return output


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export HomeLink AI Engine OpenAPI schema to JSON.",
    )
    parser.add_argument(
        "--output",
        "-o",
        type=Path,
        default=_AI_DIR / "openapi.json",
        help="Output file path (default: ai/openapi.json).",
    )
    args = parser.parse_args()

    path = export(args.output)
    print(f"OpenAPI schema written to {path}")


if __name__ == "__main__":
    main()
