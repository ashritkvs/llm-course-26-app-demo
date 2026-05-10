"""
Tests for GUI components and pages.
Uses pytest-qt (or falls back to basic instantiation tests without a display).
"""
import sys
import os
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Skip all GUI tests if PyQt5 is not available or no display is present
pytest.importorskip("PyQt5")

try:
    from PyQt5.QtWidgets import QApplication
    _app = QApplication.instance() or QApplication(sys.argv)
    _QT_AVAILABLE = True
except Exception:
    _QT_AVAILABLE = False

pytestmark = pytest.mark.skipif(not _QT_AVAILABLE, reason="PyQt5 not available or no display")


# ---------------------------------------------------------------------------
# Component tests
# ---------------------------------------------------------------------------

class TestFileCard:

    def test_instantiation(self):
        from gui.components.file_card import FileCard
        meta = {
            "name": "Steam.lnk",
            "path": "C:/Desktop/Steam.lnk",
            "extension": ".lnk",
            "size_bytes": 1024,
            "last_accessed": None,
            "last_modified": None,
            "created": None,
            "is_shortcut": True,
            "shortcut_target": None,
        }
        card = FileCard(meta, "Games")
        assert card is not None

    def test_card_has_no_crash_with_missing_fields(self):
        from gui.components.file_card import FileCard
        card = FileCard({}, "Unknown")
        assert card is not None


class TestProgressBarWidget:

    def test_instantiation(self):
        from gui.components.progress_bar import ProgressBarWidget
        pb = ProgressBarWidget()
        assert pb is not None

    def test_update_progress(self):
        from gui.components.progress_bar import ProgressBarWidget
        pb = ProgressBarWidget()
        pb.update_progress(5, 10, "Testing…")
        assert pb._bar.value() == 5
        assert pb._bar.maximum() == 10

    def test_reset(self):
        from gui.components.progress_bar import ProgressBarWidget
        pb = ProgressBarWidget()
        pb.update_progress(8, 10, "done")
        pb.reset()
        assert pb._bar.value() == 0

    def test_cancel_flag(self):
        from gui.components.progress_bar import ProgressBarWidget
        pb = ProgressBarWidget()
        assert not pb.is_cancelled
        pb._cancel_btn.click()
        assert pb.is_cancelled


class TestFolderTree:

    def test_instantiation(self):
        from gui.components.folder_tree import FolderTree
        ft = FolderTree()
        assert ft is not None

    def test_load_classified_files(self):
        from gui.components.folder_tree import FolderTree
        ft = FolderTree()
        classified = [
            {"file_metadata": {"name": "game.exe"}, "category": "Games", "pass_number": 2},
            {"file_metadata": {"name": "doc.pdf"}, "category": "Documents", "pass_number": 2},
            {"file_metadata": {"name": "game2.exe"}, "category": "Games", "pass_number": 2},
        ]
        ft.load_classified_files(classified)
        # Should have 2 top-level folders (Games, Documents)
        assert ft._tree.topLevelItemCount() == 2


# ---------------------------------------------------------------------------
# Page tests
# ---------------------------------------------------------------------------

class TestHomePage:

    def test_instantiation(self):
        from gui.pages.home_page import HomePage
        page = HomePage()
        assert page is not None


class TestCategoryPage:

    def test_instantiation(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            from gui.pages.category_page import CategoryPage
            page = CategoryPage()
            assert page is not None

    def test_add_and_remove_category(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            from gui.pages.category_page import CategoryPage
            page = CategoryPage()

        page._input.setText("Games")
        with patch.object(page, "_save_categories"):
            page._add_category()

        assert page._list.count() == 1
        assert page._list.item(0).text() == "Games"

        page._list.setCurrentRow(0)
        with patch.object(page, "_save_categories"):
            page._remove_category()

        assert page._list.count() == 0


class TestSettingsPage:

    def test_instantiation(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            from gui.pages.settings_page import SettingsPage
            page = SettingsPage()
            assert page is not None

    def test_default_age_threshold(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            from gui.pages.settings_page import SettingsPage
            page = SettingsPage()
        assert page._age_spin.value() == 90


class TestDeletionPage:

    def test_instantiation(self):
        from gui.pages.deletion_page import DeletionPage
        page = DeletionPage()
        assert page is not None

    def test_load_flagged_files(self):
        from gui.pages.deletion_page import DeletionPage
        from datetime import datetime
        page = DeletionPage()
        flagged = [
            {
                "file_metadata": {
                    "name": "old_file.txt",
                    "path": "C:/Desktop/old_file.txt",
                    "last_accessed": datetime(2020, 1, 1),
                },
                "days_since_access": 400,
                "flagged_for_deletion": True,
            }
        ]
        page.load_flagged_files(flagged)
        assert page._table.rowCount() == 1
