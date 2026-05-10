"""
Tests for src/organizer.py
"""
import sys
import os
import shutil
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def tmp_desktop(tmp_path):
    """A temporary directory acting as the desktop."""
    return tmp_path


@pytest.fixture
def sample_files(tmp_desktop):
    """Creates some actual files on the fake desktop and returns classified dicts."""
    names = ["game.exe", "photo.png", "report.pdf"]
    classified = []
    for name in names:
        filepath = tmp_desktop / name
        filepath.write_bytes(b"fake content")
        meta = {
            "name": name,
            "path": str(filepath),
            "extension": os.path.splitext(name)[1].lower(),
            "size_bytes": 12,
            "last_accessed": datetime.now(),
            "last_modified": datetime.now(),
            "created": datetime.now(),
            "is_shortcut": False,
            "shortcut_target": None,
        }
        categories = {"game.exe": "Games", "photo.png": "Images", "report.pdf": "Documents"}
        classified.append({
            "file_metadata": meta,
            "category": categories[name],
            "pass_number": 2,
        })
    return classified


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestFileOrganizer:

    def test_organize_moves_files(self, tmp_desktop, sample_files):
        from src.organizer import FileOrganizer
        organizer = FileOrganizer()
        summary = organizer.organize(sample_files, str(tmp_desktop), dry_run=False)

        assert summary["moved"] == 3
        assert summary["errors"] == 0

        # Check files actually moved
        assert (tmp_desktop / "Games" / "game.exe").exists()
        assert (tmp_desktop / "Images" / "photo.png").exists()
        assert (tmp_desktop / "Documents" / "report.pdf").exists()

    def test_organize_dry_run_does_not_move(self, tmp_desktop, sample_files):
        from src.organizer import FileOrganizer
        organizer = FileOrganizer()
        summary = organizer.organize(sample_files, str(tmp_desktop), dry_run=True)

        assert summary["moved"] == 3  # counted as "would move"
        # Files should NOT have moved
        for item in sample_files:
            assert os.path.exists(item["file_metadata"]["path"])

    def test_organize_creates_category_folders(self, tmp_desktop, sample_files):
        from src.organizer import FileOrganizer
        organizer = FileOrganizer()
        organizer.organize(sample_files, str(tmp_desktop), dry_run=False)

        assert (tmp_desktop / "Games").is_dir()
        assert (tmp_desktop / "Images").is_dir()
        assert (tmp_desktop / "Documents").is_dir()

    def test_organize_skips_missing_file(self, tmp_desktop):
        from src.organizer import FileOrganizer
        classified = [{
            "file_metadata": {
                "name": "ghost.exe",
                "path": str(tmp_desktop / "ghost.exe"),  # does not exist
                "extension": ".exe",
                "size_bytes": 0,
                "last_accessed": None,
                "last_modified": None,
                "created": None,
                "is_shortcut": False,
                "shortcut_target": None,
            },
            "category": "Games",
            "pass_number": 2,
        }]
        organizer = FileOrganizer()
        summary = organizer.organize(classified, str(tmp_desktop), dry_run=False)
        assert summary["skipped"] == 1
        assert summary["moved"] == 0

    def test_organize_handles_name_collision(self, tmp_desktop):
        from src.organizer import FileOrganizer

        # Create two files with the same name in different source locations
        src1 = tmp_desktop / "a" / "file.txt"
        src1.parent.mkdir()
        src1.write_text("v1")

        # Pre-place a file at the destination so a collision occurs
        dest_dir = tmp_desktop / "Docs"
        dest_dir.mkdir()
        (dest_dir / "file.txt").write_text("existing")

        classified = [{
            "file_metadata": {
                "name": "file.txt",
                "path": str(src1),
                "extension": ".txt",
                "size_bytes": 2,
                "last_accessed": None,
                "last_modified": None,
                "created": None,
                "is_shortcut": False,
                "shortcut_target": None,
            },
            "category": "Docs",
            "pass_number": 2,
        }]
        organizer = FileOrganizer()
        summary = organizer.organize(classified, str(tmp_desktop), dry_run=False)

        assert summary["moved"] == 1
        # Original should remain; renamed copy should also exist
        assert (dest_dir / "file.txt").exists()
        assert (dest_dir / "file (1).txt").exists()

    def test_preview_returns_planned_moves(self, tmp_desktop, sample_files):
        from src.organizer import FileOrganizer
        organizer = FileOrganizer()
        planned = organizer.preview(sample_files, str(tmp_desktop))

        assert len(planned) == 3
        for entry in planned:
            assert "name" in entry
            assert "src" in entry
            assert "dest" in entry
            assert "category" in entry

    def test_preview_does_not_move_files(self, tmp_desktop, sample_files):
        from src.organizer import FileOrganizer
        organizer = FileOrganizer()
        organizer.preview(sample_files, str(tmp_desktop))
        # Original files must still be at their source paths
        for item in sample_files:
            assert os.path.exists(item["file_metadata"]["path"])
