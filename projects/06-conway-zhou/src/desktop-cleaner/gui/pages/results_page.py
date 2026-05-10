"""
Results page — shows scan/classification results and lets the user
confirm which files to move before anything happens.
"""
import logging
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QScrollArea, QSplitter, QMessageBox,
)
from PyQt5.QtCore import Qt, pyqtSignal, QThread, pyqtSlot
from PyQt5.QtGui import QFont

from gui.components.progress_bar import ProgressBarWidget
from gui.components.folder_tree import FolderTree
from gui.components.file_card import FileCard

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

class ScanWorker(QThread):
    """
    Runs DesktopScanner + LLMClassifier in a background thread so the
    GUI stays responsive.
    """
    progress = pyqtSignal(int, int, str)   # current, total, message
    finished = pyqtSignal(list)            # classified_files list
    error = pyqtSignal(str)               # error message

    def __init__(self, user_categories: list, parent=None):
        super().__init__(parent)
        self._categories = user_categories

    def run(self):
        try:
            self.progress.emit(0, 0, "Scanning desktop…")

            from src.scanner import DesktopScanner
            scanner = DesktopScanner()
            raw_files = scanner.scan()

            total = len(raw_files)
            self.progress.emit(0, total, f"Found {total} items. Classifying…")

            from src.classifier import LLMClassifier
            classifier = LLMClassifier()
            classified = classifier.classify_files(raw_files, self._categories)

            self.progress.emit(total, total, "Classification complete.")
            self.finished.emit(classified)

        except Exception as exc:
            logger.error("ScanWorker error: %s", exc, exc_info=True)
            self.error.emit(str(exc))


# ---------------------------------------------------------------------------
# Results page
# ---------------------------------------------------------------------------

class ResultsPage(QWidget):
    """
    Page that:
    1. Runs the background scan + classification.
    2. Shows a progress bar while working.
    3. Displays every file with a checkbox — checked = will be moved,
       unchecked = stays on the desktop untouched.
    4. "Confirm & Apply" moves only the checked files.
    """

    navigate_back = pyqtSignal()
    navigate_to_deletion = pyqtSignal()
    close_app = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._classified_files: list = []
        self._file_cards: list[FileCard] = []
        self._category_cards: dict[str, list[FileCard]] = {}
        self._checked_categories: set[str] = set()
        self._worker: ScanWorker | None = None
        self._build_ui()

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------

    def _build_ui(self):
        self.setStyleSheet("background: transparent;")
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(30, 20, 30, 20)
        self._layout.setSpacing(12)

        # Title row
        title_row = QHBoxLayout()
        title = QLabel("Review & Confirm")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet("color: #E2E8F0;")
        title_row.addWidget(title)
        title_row.addStretch()
        self._status_badge = QLabel("")
        self._status_badge.setStyleSheet("color: #94A3B8; font-size: 8pt;")
        title_row.addWidget(self._status_badge)
        self._layout.addLayout(title_row)

        # Subtitle
        self._subtitle = QLabel("Uncheck any file you want to leave on the desktop.")
        self._subtitle.setStyleSheet("color: #64748B; font-size: 9pt;")
        self._subtitle.hide()
        self._layout.addWidget(self._subtitle)

        # Progress bar (shown during scan)
        self._progress = ProgressBarWidget()
        self._layout.addWidget(self._progress)

        # Splitter: folder tree | file cards
        self._splitter = QSplitter(Qt.Horizontal)
        self._splitter.setStyleSheet(
            "QSplitter::handle { background: #2D3F55; width: 3px; }"
        )

        # Left: folder tree
        self._folder_tree = FolderTree()
        self._splitter.addWidget(self._folder_tree)

        # Right: scrollable file cards
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setStyleSheet(
            "QScrollArea { background: transparent; border: none; }"
            "QScrollBar:vertical { background: #1E2A3A; width: 8px; border-radius: 4px; }"
            "QScrollBar::handle:vertical { background: #2D3F55; border-radius: 4px; }"
        )
        self._cards_container = QWidget()
        self._cards_container.setStyleSheet("background: transparent;")
        self._cards_layout = QVBoxLayout(self._cards_container)
        self._cards_layout.setContentsMargins(4, 4, 4, 4)
        self._cards_layout.setSpacing(4)
        self._cards_layout.addStretch()
        scroll.setWidget(self._cards_container)
        self._splitter.addWidget(scroll)

        self._splitter.setSizes([280, 600])
        self._layout.addWidget(self._splitter, stretch=1)

        # Wire folder checkbox changes → file card visibility
        self._folder_tree.category_toggled.connect(self._on_category_toggled)

        # Bottom controls
        ctrl_row = QHBoxLayout()
        ctrl_row.setSpacing(12)

        self._back_btn = QPushButton("← Back")
        self._back_btn.setFixedHeight(38)
        self._back_btn.setStyleSheet(_SECONDARY_BTN)
        self._back_btn.clicked.connect(self._on_back)
        ctrl_row.addWidget(self._back_btn)

        # Select all / deselect all folders
        self._select_all_btn = QPushButton("Select All Folders")
        self._select_all_btn.setFixedHeight(38)
        self._select_all_btn.setStyleSheet(_SECONDARY_BTN)
        self._select_all_btn.setEnabled(False)
        self._select_all_btn.clicked.connect(
            lambda: self._folder_tree.set_all_folders_checked(True)
        )
        ctrl_row.addWidget(self._select_all_btn)

        self._deselect_all_btn = QPushButton("Deselect All Folders")
        self._deselect_all_btn.setFixedHeight(38)
        self._deselect_all_btn.setStyleSheet(_SECONDARY_BTN)
        self._deselect_all_btn.setEnabled(False)
        self._deselect_all_btn.clicked.connect(
            lambda: self._folder_tree.set_all_folders_checked(False)
        )
        ctrl_row.addWidget(self._deselect_all_btn)

        ctrl_row.addStretch()

        self._deletion_btn = QPushButton("Review Deletions")
        self._deletion_btn.setFixedHeight(38)
        self._deletion_btn.setStyleSheet(_SECONDARY_BTN)
        self._deletion_btn.setEnabled(False)
        self._deletion_btn.clicked.connect(self.navigate_to_deletion)
        ctrl_row.addWidget(self._deletion_btn)

        self._apply_btn = QPushButton("Apply")
        self._apply_btn.setFixedHeight(38)
        self._apply_btn.setMinimumWidth(150)
        self._apply_btn.setStyleSheet(_PRIMARY_BTN)
        self._apply_btn.setEnabled(False)
        self._apply_btn.clicked.connect(self._on_apply)
        ctrl_row.addWidget(self._apply_btn)

        self._layout.addLayout(ctrl_row)

        # Hide results panel until scan done
        self._splitter.hide()

    # ------------------------------------------------------------------
    # Public: called by app.py when navigating here
    # ------------------------------------------------------------------

    def start_scan(self, user_categories: list):
        """Starts the background scan worker."""
        self._classified_files = []
        self._file_cards = []
        self._apply_btn.setEnabled(False)
        self._deletion_btn.setEnabled(False)
        self._select_all_btn.setEnabled(False)
        self._deselect_all_btn.setEnabled(False)
        self._splitter.hide()
        self._subtitle.hide()
        self._progress.show()
        self._progress.reset()
        self._progress.set_indeterminate(True)
        self._progress.set_message("Starting scan…")
        self._status_badge.setText("")

        self._worker = ScanWorker(user_categories, parent=self)
        self._worker.progress.connect(self._on_progress)
        self._worker.finished.connect(self._on_scan_done)
        self._worker.error.connect(self._on_scan_error)
        self._worker.start()

    # ------------------------------------------------------------------
    # Slots
    # ------------------------------------------------------------------

    @pyqtSlot(int, int, str)
    def _on_progress(self, current: int, total: int, message: str):
        self._progress.update_progress(current, total, message)

    @pyqtSlot(list)
    def _on_scan_done(self, classified_files: list):
        self._classified_files = classified_files
        self._populate_results()
        self._progress.hide()
        self._splitter.show()
        self._subtitle.show()
        self._apply_btn.setEnabled(True)
        self._deletion_btn.setEnabled(True)
        self._select_all_btn.setEnabled(True)
        self._deselect_all_btn.setEnabled(True)

        total = len(classified_files)
        cats = len({item.get("category", "") for item in classified_files})
        self._status_badge.setText(f"{total} files  |  {cats} categories")

        self._notify_if_stale_files(classified_files)

    @pyqtSlot(str)
    def _on_scan_error(self, message: str):
        self._progress.set_message(f"Error: {message}")
        QMessageBox.critical(self, "Scan Error", message)

    def _on_back(self):
        if self._worker and self._worker.isRunning():
            self._worker.terminate()
            self._worker.wait()
        self.navigate_back.emit()

    def _on_apply(self):
        if not self._checked_categories:
            QMessageBox.warning(self, "Nothing Selected",
                                "No folders are selected. Check at least one folder to apply.")
            return

        selected = [
            f for f in self._classified_files
            if f.get("category") in self._checked_categories
        ]
        skipped_count = len(self._classified_files) - len(selected)

        confirm_msg = f"Move {len(selected)} file(s) into {len(self._checked_categories)} folder(s)?"
        if skipped_count:
            confirm_msg += f"\n{skipped_count} file(s) in unchecked folders will be left on the desktop."

        reply = QMessageBox.question(
            self, "Confirm", confirm_msg,
            QMessageBox.Yes | QMessageBox.Cancel,
        )
        if reply != QMessageBox.Yes:
            return

        try:
            from src.organizer import FileOrganizer
            from src.utils import get_desktop_path
            organizer = FileOrganizer()
            summary = organizer.organize(selected, get_desktop_path(), dry_run=False)

            if summary["errors"] > 0:
                # Show errors but don't close
                QMessageBox.warning(
                    self, "Completed with Errors",
                    f"Moved:   {summary['moved']}\n"
                    f"Skipped: {summary['skipped']}\n"
                    f"Errors:  {summary['errors']}\n\n"
                    f"Check logs/cleaner_log.txt for details."
                )
            else:
                # All good — close the app
                QMessageBox.information(
                    self, "Done",
                    f"Desktop cleaned successfully.\n\n"
                    f"Moved:   {summary['moved']} file(s)\n"
                    f"Skipped: {summary['skipped']} file(s)\n\n"
                    f"The app will now close."
                )
                self.close_app.emit()

        except Exception as exc:
            QMessageBox.critical(self, "Error", str(exc))

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _notify_if_stale_files(self, classified_files: list):
        try:
            import json, os
            from src.deletion_checker import DeletionChecker
            from src.utils import get_project_root

            cfg_path = os.path.join(get_project_root(), "config", "settings.json")
            age_threshold = 90
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    age_threshold = int(json.load(f).get("age_threshold_days", 90))
            except Exception:
                pass

            raw_files = [item["file_metadata"] for item in classified_files if "file_metadata" in item]
            checker = DeletionChecker()
            results = checker.check_files(raw_files, age_threshold)
            flagged_count = sum(1 for r in results if r["flagged_for_deletion"])

            if flagged_count > 0:
                QMessageBox.information(
                    self,
                    "Files to Review",
                    f"{flagged_count} file(s) haven't been accessed in over {age_threshold} days.\n\n"
                    f"Use the 'Review Deletions' button to decide what to keep."
                )
        except Exception as exc:
            logger.warning("Could not check for stale files: %s", exc)

    def _on_category_toggled(self, category: str, checked: bool):
        """Called when a folder checkbox is toggled — tracks selected categories."""
        if checked:
            self._checked_categories.add(category)
        else:
            self._checked_categories.discard(category)

    def _populate_results(self):
        """Fills the folder tree and the file card list."""
        self._file_cards = []
        self._category_cards = {}

        # All categories checked by default
        self._checked_categories = {
            item.get("category", "Other Files") for item in self._classified_files
        }

        # Clear existing cards
        while self._cards_layout.count() > 1:  # keep the stretch at end
            item = self._cards_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        self._folder_tree.load_classified_files(self._classified_files)

        for item in self._classified_files:
            if "file_metadata" in item:
                meta = item["file_metadata"]
            else:
                meta = item.get("file", {})
            category = item.get("category", "Other Files")
            card = FileCard(meta if isinstance(meta, dict) else meta.__dict__, category)
            self._file_cards.append(card)
            self._category_cards.setdefault(category, []).append(card)
            self._cards_layout.insertWidget(self._cards_layout.count() - 1, card)


# ---------------------------------------------------------------------------
# Stylesheets
# ---------------------------------------------------------------------------
_PRIMARY_BTN = (
    "QPushButton {"
    "  background: #1D4ED8; color: white;"
    "  border: none; border-radius: 5px; font-size: 9pt; font-weight: bold;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #2563EB; }"
    "QPushButton:disabled { background: #374151; color: #6B7280; }"
)

_SECONDARY_BTN = (
    "QPushButton {"
    "  background: #1E2A3A; color: #94A3B8;"
    "  border: 1px solid #2D3F55; border-radius: 5px; font-size: 9pt;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #263445; color: #CBD5E1; }"
    "QPushButton:disabled { color: #4B5563; }"
)
