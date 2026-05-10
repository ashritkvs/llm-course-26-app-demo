"""
Tests for the FastAPI API layer.
Uses httpx AsyncClient + TestClient to exercise routes with mocked core logic.
"""
import sys
import os
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def client():
    from api.server import app
    return TestClient(app)


def _make_raw_file(name: str, category: str = "Games") -> dict:
    return {
        "file_metadata": {
            "name": name,
            "path": f"C:/Desktop/{name}",
            "extension": os.path.splitext(name)[1].lower(),
            "size_bytes": 1024,
            "last_accessed": datetime.now().isoformat(),
            "last_modified": datetime.now().isoformat(),
            "created": datetime.now().isoformat(),
            "is_shortcut": name.endswith(".lnk"),
            "shortcut_target": None,
        },
        "category": category,
        "pass_number": 2,
    }


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

class TestHealth:

    def test_health_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Settings routes
# ---------------------------------------------------------------------------

class TestSettingsRoutes:

    def test_get_settings_returns_200(self, client):
        with patch("api.routes.settings._settings_path",
                   return_value=os.path.join(
                       os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "config", "settings.json"
                   )):
            response = client.get("/settings")
        assert response.status_code == 200
        data = response.json()
        assert "age_threshold_days" in data

    def test_put_settings_saves_and_returns(self, client, tmp_path):
        tmp_settings = tmp_path / "settings.json"
        with patch("api.routes.settings._settings_path", return_value=str(tmp_settings)):
            payload = {
                "age_threshold_days": 60,
                "dry_run": True,
                "log_level": "DEBUG",
                "output_dir": "desktop",
                "deletion_review_folder": "Review",
                "miscellaneous_folder": "Misc",
            }
            response = client.put("/settings", json=payload)
        assert response.status_code == 200
        assert response.json()["age_threshold_days"] == 60
        assert response.json()["dry_run"] is True


# ---------------------------------------------------------------------------
# Categories routes
# ---------------------------------------------------------------------------

class TestCategoriesRoutes:

    def test_get_categories_empty(self, client, tmp_path):
        cats_file = tmp_path / "user_categories.json"
        cats_file.write_text(json.dumps({"categories": []}))
        with patch("api.routes.categories._categories_path", return_value=str(cats_file)):
            response = client.get("/categories")
        assert response.status_code == 200
        assert response.json()["categories"] == []

    def test_post_categories_saves(self, client, tmp_path):
        cats_file = tmp_path / "user_categories.json"
        with patch("api.routes.categories._categories_path", return_value=str(cats_file)):
            response = client.post("/categories", json={"categories": ["Games", "Work"]})
        assert response.status_code == 200
        assert "Games" in response.json()["categories"]
        saved = json.loads(cats_file.read_text())
        assert "Games" in saved["categories"]


# ---------------------------------------------------------------------------
# Scan route
# ---------------------------------------------------------------------------

class TestScanRoute:

    def test_scan_returns_scan_result(self, client):
        mock_files = [
            {
                "name": "Steam.lnk",
                "path": "C:/Desktop/Steam.lnk",
                "extension": ".lnk",
                "size_bytes": 512,
                "last_accessed": datetime.now(),
                "last_modified": datetime.now(),
                "created": datetime.now(),
                "is_shortcut": True,
                "shortcut_target": "C:/Steam/steam.exe",
            }
        ]
        mock_classified = [
            {
                "file_metadata": mock_files[0],
                "category": "Games",
                "pass_number": 1,
            }
        ]
        with patch("api.routes.scan._load_user_categories", return_value=["Games"]), \
             patch("src.scanner.DesktopScanner.scan", return_value=mock_files), \
             patch("src.classifier.LLMClassifier.classify_files", return_value=mock_classified):
            response = client.post("/scan")

        assert response.status_code == 200
        data = response.json()
        assert data["total_files"] == 1
        assert "Games" in data["categories_found"]


# ---------------------------------------------------------------------------
# Organize route
# ---------------------------------------------------------------------------

class TestOrganizeRoute:

    def test_organize_dry_run(self, client):
        payload = {
            "classified_files": [
                {
                    "file": {
                        "name": "game.exe",
                        "path": "C:/Desktop/game.exe",
                        "extension": ".exe",
                        "size_bytes": 1024,
                        "last_accessed": None,
                        "last_modified": None,
                        "created": None,
                        "is_shortcut": False,
                        "shortcut_target": None,
                    },
                    "category": "Games",
                    "pass_number": 2,
                }
            ]
        }
        mock_summary = {"moved": 1, "skipped": 0, "errors": 0}
        with patch("src.organizer.FileOrganizer.organize", return_value=mock_summary), \
             patch("src.utils.get_desktop_path", return_value="C:/Desktop"):
            response = client.post("/organize?dry_run=true", json=payload)

        assert response.status_code == 200
        data = response.json()
        assert data["dry_run"] is True


# ---------------------------------------------------------------------------
# Deletion routes
# ---------------------------------------------------------------------------

class TestDeletionRoutes:

    def test_get_deletion_returns_result(self, client, tmp_path):
        mock_files = []
        cfg_path = tmp_path / "settings.json"
        cfg_path.write_text(json.dumps({"age_threshold_days": 90}))

        with patch("src.scanner.DesktopScanner.scan", return_value=mock_files), \
             patch("api.routes.deletion._load_settings",
                   return_value={"age_threshold_days": 90, "deletion_review_folder": "Review"}):
            response = client.get("/deletion")

        assert response.status_code == 200
        data = response.json()
        assert "flagged_files" in data
        assert data["total_flagged"] == 0
