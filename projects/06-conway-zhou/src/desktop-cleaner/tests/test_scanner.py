"""
Tests for src/scanner.py
"""
import sys
import os
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime

# Ensure project root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def fake_desktop(tmp_path):
    """Creates a temporary directory that acts as a fake desktop."""
    (tmp_path / "SomeApp.lnk").write_bytes(b"")
    (tmp_path / "document.pdf").write_bytes(b"%PDF fake")
    (tmp_path / "image.png").write_bytes(b"\x89PNG fake")
    (tmp_path / "desktop.ini").write_bytes(b"")
    (tmp_path / "desktop-cleaner").mkdir()
    return tmp_path


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestDesktopScanner:

    def test_scan_returns_list(self, fake_desktop):
        from src.scanner import DesktopScanner
        with patch("src.scanner.DesktopScanner._resolve_shortcut", return_value=None), \
             patch("src.utils.get_desktop_path", return_value=str(fake_desktop)):
            scanner = DesktopScanner()
            with patch("src.utils.get_desktop_path", return_value=str(fake_desktop)):
                # Monkey-patch get_desktop_path inside scanner module
                import src.utils as utils_mod
                original = utils_mod.get_desktop_path
                utils_mod.get_desktop_path = lambda: str(fake_desktop)
                try:
                    result = scanner.scan()
                finally:
                    utils_mod.get_desktop_path = original

        assert isinstance(result, list)

    def test_scan_skips_desktop_ini(self, fake_desktop):
        from src.scanner import DesktopScanner
        import src.utils as utils_mod
        original = utils_mod.get_desktop_path
        utils_mod.get_desktop_path = lambda: str(fake_desktop)
        try:
            scanner = DesktopScanner()
            result = scanner.scan()
        finally:
            utils_mod.get_desktop_path = original

        names = [r["name"] for r in result]
        assert "desktop.ini" not in names

    def test_scan_skips_self_folder(self, fake_desktop):
        from src.scanner import DesktopScanner
        import src.utils as utils_mod
        original = utils_mod.get_desktop_path
        utils_mod.get_desktop_path = lambda: str(fake_desktop)
        try:
            scanner = DesktopScanner()
            result = scanner.scan()
        finally:
            utils_mod.get_desktop_path = original

        names = [r["name"] for r in result]
        assert "desktop-cleaner" not in names

    def test_metadata_fields_present(self, fake_desktop):
        from src.scanner import DesktopScanner
        import src.utils as utils_mod
        original = utils_mod.get_desktop_path
        utils_mod.get_desktop_path = lambda: str(fake_desktop)
        try:
            scanner = DesktopScanner()
            result = scanner.scan()
        finally:
            utils_mod.get_desktop_path = original

        expected_keys = {
            "name", "path", "extension", "size_bytes",
            "last_accessed", "last_modified", "created",
            "is_shortcut", "shortcut_target",
        }
        for item in result:
            assert expected_keys.issubset(set(item.keys())), f"Missing keys in {item}"

    def test_lnk_files_flagged_as_shortcut(self, fake_desktop):
        from src.scanner import DesktopScanner
        import src.utils as utils_mod
        original = utils_mod.get_desktop_path
        utils_mod.get_desktop_path = lambda: str(fake_desktop)
        try:
            scanner = DesktopScanner()
            result = scanner.scan()
        finally:
            utils_mod.get_desktop_path = original

        lnk_items = [r for r in result if r["extension"] == ".lnk"]
        for item in lnk_items:
            assert item["is_shortcut"] is True

    def test_nonexistent_desktop_returns_empty(self):
        from src.scanner import DesktopScanner
        import src.utils as utils_mod
        original = utils_mod.get_desktop_path
        utils_mod.get_desktop_path = lambda: "/this/path/does/not/exist"
        try:
            scanner = DesktopScanner()
            result = scanner.scan()
        finally:
            utils_mod.get_desktop_path = original

        assert result == []

    def test_ts_to_dt_valid_timestamp(self):
        from src.scanner import DesktopScanner
        ts = 1700000000.0
        dt = DesktopScanner._ts_to_dt(ts)
        assert isinstance(dt, datetime)

    def test_ts_to_dt_invalid_returns_none(self):
        from src.scanner import DesktopScanner
        dt = DesktopScanner._ts_to_dt(float("inf"))
        assert dt is None
