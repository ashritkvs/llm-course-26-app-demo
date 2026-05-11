"""
Main PyQt5 application window for Desktop Cleaner.
"""
import logging
from PyQt5.QtWidgets import (
    QMainWindow, QStackedWidget, QWidget, QVBoxLayout, QApplication,
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QPalette, QColor

from gui.pages.home_page import HomePage
from gui.pages.category_page import CategoryPage
from gui.pages.results_page import ResultsPage
from gui.pages.deletion_page import DeletionPage
from gui.pages.settings_page import SettingsPage

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Dark theme stylesheet
# ---------------------------------------------------------------------------
_DARK_STYLESHEET = """
QMainWindow, QWidget {
    background-color: #0D1B2A;
    color: #E2E8F0;
    font-family: "Segoe UI", sans-serif;
}
QToolTip {
    background: #1E2A3A;
    color: #E2E8F0;
    border: 1px solid #2D3F55;
    padding: 4px;
}
QScrollBar:vertical {
    background: #0D1B2A;
    width: 10px;
    border-radius: 5px;
}
QScrollBar::handle:vertical {
    background: #2D3F55;
    border-radius: 5px;
    min-height: 20px;
}
QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}
QScrollBar:horizontal {
    background: #0D1B2A;
    height: 10px;
    border-radius: 5px;
}
QScrollBar::handle:horizontal {
    background: #2D3F55;
    border-radius: 5px;
    min-width: 20px;
}
QScrollBar::add-line:horizontal, QScrollBar::sub-line:horizontal {
    width: 0px;
}
"""


class MainWindow(QMainWindow):
    """
    Main application window using a QStackedWidget for page navigation.

    Pages (indices):
        0 — Home
        1 — Categories
        2 — Results
        3 — Deletion
        4 — Settings
    """

    _PAGE_HOME = 0
    _PAGE_CATEGORIES = 1
    _PAGE_RESULTS = 2
    _PAGE_DELETION = 3
    _PAGE_SETTINGS = 4

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Desktop Cleaner")
        self.setMinimumSize(900, 650)
        self.setStyleSheet(_DARK_STYLESHEET)
        self._build_ui()
        self._connect_signals()
        logger.info("MainWindow initialised.")

    # ------------------------------------------------------------------
    # Build
    # ------------------------------------------------------------------

    def _build_ui(self):
        central = QWidget()
        central.setObjectName("CentralWidget")
        self.setCentralWidget(central)

        layout = QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        self._stack = QStackedWidget()
        layout.addWidget(self._stack)

        # Instantiate pages
        self._home_page = HomePage()
        self._category_page = CategoryPage()
        self._results_page = ResultsPage()
        self._deletion_page = DeletionPage()
        self._settings_page = SettingsPage()

        # Add pages to stack (order must match _PAGE_* constants)
        self._stack.addWidget(self._home_page)       # 0
        self._stack.addWidget(self._category_page)   # 1
        self._stack.addWidget(self._results_page)    # 2
        self._stack.addWidget(self._deletion_page)   # 3
        self._stack.addWidget(self._settings_page)   # 4

        self._stack.setCurrentIndex(self._PAGE_HOME)

    def _connect_signals(self):
        # Home
        self._home_page.navigate_to_categories.connect(self.show_categories)
        self._home_page.navigate_to_settings.connect(self.show_settings)

        # Categories
        self._category_page.navigate_back.connect(self.show_home)
        self._category_page.navigate_to_results.connect(self._start_scan_and_show_results)

        # Results
        self._results_page.navigate_back.connect(self.show_categories)
        self._results_page.navigate_to_deletion.connect(self._show_deletion_from_results)
        self._results_page.close_app.connect(QApplication.instance().quit)

        # Deletion
        self._deletion_page.navigate_back.connect(self.show_results)

        # Settings
        self._settings_page.navigate_back.connect(self.show_home)

    # ------------------------------------------------------------------
    # Navigation methods
    # ------------------------------------------------------------------

    def show_home(self):
        logger.debug("Navigating to Home.")
        self._stack.setCurrentIndex(self._PAGE_HOME)

    def show_categories(self):
        logger.debug("Navigating to Categories.")
        self._stack.setCurrentIndex(self._PAGE_CATEGORIES)

    def show_results(self):
        logger.debug("Navigating to Results.")
        self._stack.setCurrentIndex(self._PAGE_RESULTS)

    def show_deletion(self):
        logger.debug("Navigating to Deletion.")
        self._stack.setCurrentIndex(self._PAGE_DELETION)

    def show_settings(self):
        logger.debug("Navigating to Settings.")
        self._stack.setCurrentIndex(self._PAGE_SETTINGS)

    # ------------------------------------------------------------------
    # Internal navigation helpers
    # ------------------------------------------------------------------

    def _start_scan_and_show_results(self, user_categories: list):
        """Called when the user clicks 'Start Scan' on the categories page."""
        self._stack.setCurrentIndex(self._PAGE_RESULTS)
        self._results_page.start_scan(user_categories)

    def _show_deletion_from_results(self):
        """
        Loads flagged files from DeletionChecker and navigates to the deletion page.
        """
        try:
            import json, os
            from src.scanner import DesktopScanner
            from src.deletion_checker import DeletionChecker
            from src.utils import get_project_root

            cfg_path = os.path.join(get_project_root(), "config", "settings.json")
            age_threshold = 90
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    age_threshold = json.load(f).get("age_threshold_days", 90)
            except Exception:
                pass

            scanner = DesktopScanner()
            raw_files = scanner.scan()
            checker = DeletionChecker()
            results = checker.check_files(raw_files, int(age_threshold))
            flagged = [r for r in results if r["flagged_for_deletion"]]
            self._deletion_page.load_flagged_files(flagged)
        except Exception as exc:
            logger.error("Could not load flagged files: %s", exc)
            self._deletion_page.load_flagged_files([])

        self._stack.setCurrentIndex(self._PAGE_DELETION)
