"""Tests for health/readiness probes, Docker configuration, and OpenAPI export.

Run with:
    pytest ai/tests/test_health_and_docker.py -v
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

_AI_DIR = Path(__file__).resolve().parent.parent
_MODELS_DIR = _AI_DIR / "models"


class TestHealthProbe:
    """Tests for GET /health."""

    def test_health_returns_200(self) -> None:
        response = client.get("/health")
        assert response.status_code == 200

    def test_health_status_ok(self) -> None:
        data = client.get("/health").json()
        assert data["status"] == "ok"

    def test_health_has_uptime(self) -> None:
        data = client.get("/health").json()
        assert "uptime_seconds" in data
        assert isinstance(data["uptime_seconds"], (int, float))
        assert data["uptime_seconds"] >= 0.0

    def test_health_has_api_version(self) -> None:
        data = client.get("/health").json()
        assert "api_version" in data
        assert isinstance(data["api_version"], str)
        assert len(data["api_version"]) > 0

    def test_health_has_timestamp(self) -> None:
        data = client.get("/health").json()
        assert "timestamp" in data
        assert isinstance(data["timestamp"], (int, float))
        assert data["timestamp"] > 0.0

    def test_health_response_matches_model(self) -> None:
        from main import HealthResponse

        data = client.get("/health").json()
        parsed = HealthResponse(**data)
        assert parsed.status == "ok"


class TestReadinessProbe:
    """Tests for GET /ready."""

    def test_ready_returns_200_when_models_loaded(self) -> None:
        response = client.get("/ready")
        assert response.status_code == 200

    def test_ready_status_ready(self) -> None:
        data = client.get("/ready").json()
        assert data["status"] == "ready"

    def test_ready_models_loaded_true(self) -> None:
        data = client.get("/ready").json()
        assert data["models_loaded"] is True

    def test_ready_has_manifest_version(self) -> None:
        data = client.get("/ready").json()
        assert "manifest_version" in data
        assert isinstance(data["manifest_version"], str)

    def test_ready_response_matches_model(self) -> None:
        from main import ReadyResponse

        data = client.get("/ready").json()
        parsed = ReadyResponse(**data)
        assert parsed.status == "ready"
        assert parsed.models_loaded is True

    def test_ready_returns_503_when_manifest_missing(self, tmp_path: Path) -> None:
        import main as _main

        original = _main._MANIFEST_PATH
        try:
            _main._MANIFEST_PATH = tmp_path / "nonexistent.json"
            response = client.get("/ready")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "not_ready"
            assert data["models_loaded"] is False
            assert len(data["errors"]) > 0
        finally:
            _main._MANIFEST_PATH = original

    def test_ready_returns_503_when_manifest_corrupt(self, tmp_path: Path) -> None:
        import main as _main

        corrupt = tmp_path / "model_manifest.json"
        corrupt.write_text("NOT VALID JSON {{{", encoding="utf-8")
        original = _main._MANIFEST_PATH
        try:
            _main._MANIFEST_PATH = corrupt
            response = client.get("/ready")
            assert response.status_code == 503
            data = response.json()
            assert any("unreadable" in e for e in data["errors"])
        finally:
            _main._MANIFEST_PATH = original

    def test_ready_returns_503_when_rent_estimator_none(self) -> None:
        import main as _main

        original = _main._rent_estimator
        try:
            _main._rent_estimator = None
            response = client.get("/ready")
            assert response.status_code == 503
            data = response.json()
            assert any("rent estimator" in e for e in data["errors"])
        finally:
            _main._rent_estimator = original


class TestDockerfile:
    """Static checks on the Dockerfile and .dockerignore."""

    def test_dockerfile_exists(self) -> None:
        assert (_AI_DIR / "Dockerfile").exists()

    def test_dockerignore_exists(self) -> None:
        assert (_AI_DIR / ".dockerignore").exists()

    def test_dockerfile_uses_slim_base(self) -> None:
        content = (_AI_DIR / "Dockerfile").read_text(encoding="utf-8")
        assert "python:3.12-slim" in content

    def test_dockerfile_exposes_8000(self) -> None:
        content = (_AI_DIR / "Dockerfile").read_text(encoding="utf-8")
        assert "EXPOSE 8000" in content

    def test_dockerfile_runs_uvicorn(self) -> None:
        content = (_AI_DIR / "Dockerfile").read_text(encoding="utf-8")
        assert "uvicorn" in content
        assert "main:app" in content

    def test_dockerignore_excludes_pycache(self) -> None:
        content = (_AI_DIR / ".dockerignore").read_text(encoding="utf-8")
        assert "__pycache__" in content

    def test_dockerignore_excludes_tests(self) -> None:
        content = (_AI_DIR / ".dockerignore").read_text(encoding="utf-8")
        assert "tests/" in content

    def test_dockerignore_excludes_venv(self) -> None:
        content = (_AI_DIR / ".dockerignore").read_text(encoding="utf-8")
        assert ".venv" in content


class TestOpenAPIExport:
    """Tests for the static OpenAPI export script and generated file."""

    def test_export_script_exists(self) -> None:
        assert (_AI_DIR / "src" / "export_openapi.py").exists()

    def test_openapi_json_exists(self) -> None:
        """Run the exporter and verify the file is written."""
        from src.export_openapi import export

        path = export()
        assert path.exists()
        assert path.stat().st_size > 0

    def test_openapi_json_valid_json(self) -> None:
        from src.export_openapi import export

        path = export()
        data = json.loads(path.read_text(encoding="utf-8"))
        assert isinstance(data, dict)

    def test_openapi_json_has_openapi_version(self) -> None:
        from src.export_openapi import export

        data = json.loads(export().read_text(encoding="utf-8"))
        assert "openapi" in data
        assert data["openapi"].startswith("3.")

    def test_openapi_json_has_all_routes(self) -> None:
        from src.export_openapi import export

        data = json.loads(export().read_text(encoding="utf-8"))
        paths = data.get("paths", {})
        expected_paths = [
            "/health",
            "/ready",
            "/",
            "/api/v1/estimate-rent",
            "/api/v1/recommend",
            "/api/v1/detect-fraud",
        ]
        for ep in expected_paths:
            assert ep in paths, f"Missing endpoint {ep} in openapi.json"
