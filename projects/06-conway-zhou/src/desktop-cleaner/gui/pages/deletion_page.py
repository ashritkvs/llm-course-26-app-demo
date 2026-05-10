"""
Deletion review page — lets the user review and optionally move stale files.
"""
import logging
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QCheckBox,
    QAbstractItemView, QMessageBox,
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont, QColor

logger = logging.getLogger(__name__)


class DeletionPage(QWidget):
    """
    Table-based review page for files flagged as deletion candidates.

    - Each row has a checkbox, file name, last accessed date, days since access.
    - "Move Selected to Trash Folder" moves checked files to "Review for Deletion".
    - "Keep All" closes without moving anything.
    - Files are NEVER permanently deleted.
    """

    navigate_back = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._flagged_files: list = []
        self._build_ui()

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------

    def _build_ui(self):
        self.setStyleSheet("background: transparent;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(30, 20, 30, 20)
        layout.setSpacing(12)

        # Title
        title = QLabel("Review for Deletion")
        title.setFont(QFont("Segoe UI", 18, QFont.Bold))
        title.setStyleSheet("color: #E2E8F0;")
        layout.addWidget(title)

        desc = QLabel(
            "These files have not been accessed recently. "
            "Check the ones you'd like to move to the Review for Deletion folder.\n"
            "Nothing will be permanently deleted."
        )
        desc.setStyleSheet("color: #94A3B8; font-size: 9pt;")
        desc.setWordWrap(True)
        layout.addWidget(desc)

        # Summary label
        self._summary_label = QLabel("No files loaded.")
        self._summary_label.setStyleSheet(
            "color: #60A5FA; font-size: 9pt; font-weight: bold;"
        )
        layout.addWidget(self._summary_label)

        # Table
        self._table = QTableWidget(0, 4)
        self._table.setHorizontalHeaderLabels(
            ["", "File Name", "Last Accessed", "Days Since Access"]
        )
        self._table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Stretch)
        self._table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Fixed)
        self._table.setColumnWidth(0, 30)
        self._table.setColumnWidth(2, 140)
        self._table.setColumnWidth(3, 120)
        self._table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self._table.setEditTriggers(QAbstractItemView.NoEditTriggers)
        self._table.setStyleSheet(_TABLE_STYLE)
        self._table.verticalHeader().setVisible(False)
        layout.addWidget(self._table, stretch=1)

        # Select-all row
        sel_row = QHBoxLayout()
        sel_all_btn = QPushButton("Select All")
        sel_all_btn.setFixedHeight(30)
        sel_all_btn.setStyleSheet(_SMALL_BTN)
        sel_all_btn.clicked.connect(self._select_all)
        sel_none_btn = QPushButton("Select None")
        sel_none_btn.setFixedHeight(30)
        sel_none_btn.setStyleSheet(_SMALL_BTN)
        sel_none_btn.clicked.connect(self._select_none)
        sel_row.addWidget(sel_all_btn)
        sel_row.addWidget(sel_none_btn)
        sel_row.addStretch()
        layout.addLayout(sel_row)

        # Navigation / action buttons
        btn_row = QHBoxLayout()
        btn_row.setSpacing(12)

        back_btn = QPushButton("← Back")
        back_btn.setFixedHeight(40)
        back_btn.setStyleSheet(_SECONDARY_BTN)
        back_btn.clicked.connect(self.navigate_back)
        btn_row.addWidget(back_btn)

        btn_row.addStretch()

        keep_btn = QPushButton("Keep All")
        keep_btn.setFixedHeight(40)
        keep_btn.setStyleSheet(_SECONDARY_BTN)
        keep_btn.clicked.connect(self._on_keep_all)
        btn_row.addWidget(keep_btn)

        move_btn = QPushButton("Move Selected to Review Folder")
        move_btn.setFixedHeight(40)
        move_btn.setMinimumWidth(220)
        move_btn.setStyleSheet(_WARN_BTN)
        move_btn.clicked.connect(self._on_move_selected)
        btn_row.addWidget(move_btn)

        layout.addLayout(btn_row)

    # ------------------------------------------------------------------
    # Public: load data
    # ------------------------------------------------------------------

    def load_flagged_files(self, flagged_files: list):
        """
        Populates the table with flagged file entries.

        Args:
            flagged_files: List of {file_metadata, days_since_access, flagged_for_deletion} dicts.
        """
        self._flagged_files = flagged_files
        self._table.setRowCount(0)

        for item in flagged_files:
            meta = item.get("file_metadata", {})
            name = meta.get("name", "Unknown") if isinstance(meta, dict) else str(meta)
            days = item.get("days_since_access", "?")
            last_accessed = meta.get("last_accessed") if isinstance(meta, dict) else None

            if last_accessed:
                try:
                    from datetime import datetime
                    if isinstance(last_accessed, str):
                        last_accessed = datetime.fromisoformat(last_accessed)
                    date_str = last_accessed.strftime("%Y-%m-%d")
                except Exception:
                    date_str = str(last_accessed)
            else:
                date_str = "Unknown"

            row = self._table.rowCount()
            self._table.insertRow(row)

            # Checkbox cell
            chk_widget = QWidget()
            chk_layout = QHBoxLayout(chk_widget)
            chk_layout.setContentsMargins(4, 0, 4, 0)
            chk_layout.setAlignment(Qt.AlignCenter)
            chk = QCheckBox()
            chk_layout.addWidget(chk)
            self._table.setCellWidget(row, 0, chk_widget)

            self._table.setItem(row, 1, QTableWidgetItem(name))
            self._table.setItem(row, 2, QTableWidgetItem(date_str))
            days_item = QTableWidgetItem(str(days))
            days_item.setTextAlignment(Qt.AlignCenter)
            self._table.setItem(row, 3, days_item)

        count = len(flagged_files)
        self._summary_label.setText(
            f"{count} file{'s' if count != 1 else ''} flagged for review."
        )

    # ------------------------------------------------------------------
    # Slots
    # ------------------------------------------------------------------

    def _select_all(self):
        for row in range(self._table.rowCount()):
            chk = self._get_checkbox(row)
            if chk:
                chk.setChecked(True)

    def _select_none(self):
        for row in range(self._table.rowCount()):
            chk = self._get_checkbox(row)
            if chk:
                chk.setChecked(False)

    def _on_keep_all(self):
        self._select_none()
        self.navigate_back.emit()

    def _on_move_selected(self):
        selected_paths = []
        for row in range(self._table.rowCount()):
            chk = self._get_checkbox(row)
            if chk and chk.isChecked():
                if row < len(self._flagged_files):
                    meta = self._flagged_files[row].get("file_metadata", {})
                    path = meta.get("path", "") if isinstance(meta, dict) else ""
                    if path:
                        selected_paths.append(path)

        if not selected_paths:
            QMessageBox.information(
                self, "Nothing Selected",
                "Please check at least one file to move."
            )
            return

        reply = QMessageBox.question(
            self, "Confirm Move",
            f"Move {len(selected_paths)} file(s) to the Review for Deletion folder?\n\n"
            "Files will NOT be permanently deleted.",
            QMessageBox.Yes | QMessageBox.No,
        )
        if reply != QMessageBox.Yes:
            return

        try:
            import json, os, shutil
            from src.utils import get_project_root, get_desktop_path, ensure_dir, log_action

            cfg_path = os.path.join(get_project_root(), "config", "settings.json")
            review_folder = "Review for Deletion"
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    review_folder = json.load(f).get("deletion_review_folder", review_folder)
            except Exception:
                pass

            desktop = get_desktop_path()
            review_dir = os.path.join(desktop, review_folder)
            ensure_dir(review_dir)

            moved, errors = 0, 0
            for src_path in selected_paths:
                try:
                    fname = os.path.basename(src_path)
                    dest = os.path.join(review_dir, fname)
                    if os.path.exists(dest):
                        base, ext = os.path.splitext(fname)
                        counter = 1
                        while os.path.exists(dest):
                            dest = os.path.join(review_dir, f"{base} ({counter}){ext}")
                            counter += 1
                    shutil.move(src_path, dest)
                    log_action("MOVE_TO_REVIEW", src_path, review_folder)
                    moved += 1
                except Exception as exc:
                    logger.error("Move error for %s: %s", src_path, exc)
                    errors += 1

            QMessageBox.information(
                self, "Done",
                f"Moved: {moved}\nErrors: {errors}"
            )
            # Reload to remove moved files from table
            # (filter out moved paths)
            remaining = [
                f for f in self._flagged_files
                if f.get("file_metadata", {}).get("path", "") not in selected_paths
            ]
            self.load_flagged_files(remaining)

        except Exception as exc:
            QMessageBox.critical(self, "Error", str(exc))

    def _get_checkbox(self, row: int) -> QCheckBox | None:
        widget = self._table.cellWidget(row, 0)
        if widget:
            for child in widget.findChildren(QCheckBox):
                return child
        return None


# ---------------------------------------------------------------------------
# Stylesheets
# ---------------------------------------------------------------------------
_TABLE_STYLE = (
    "QTableWidget {"
    "  background: #1E2A3A; color: #CBD5E1;"
    "  border: 1px solid #2D3F55; border-radius: 4px;"
    "  gridline-color: #2D3F55; font-size: 9pt;"
    "}"
    "QTableWidget::item:selected { background: #1D4ED8; }"
    "QHeaderView::section {"
    "  background: #162032; color: #94A3B8;"
    "  border: none; padding: 5px; font-size: 8pt;"
    "}"
)

_SMALL_BTN = (
    "QPushButton {"
    "  background: #1E2A3A; color: #94A3B8;"
    "  border: 1px solid #2D3F55; border-radius: 4px;"
    "  padding: 0 10px; font-size: 8pt;"
    "}"
    "QPushButton:hover { background: #263445; }"
)

_SECONDARY_BTN = (
    "QPushButton {"
    "  background: #1E2A3A; color: #94A3B8;"
    "  border: 1px solid #2D3F55; border-radius: 5px; font-size: 9pt;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #263445; color: #CBD5E1; }"
)

_WARN_BTN = (
    "QPushButton {"
    "  background: #78350F; color: #FDE68A;"
    "  border: 1px solid #92400E; border-radius: 5px; font-size: 9pt; font-weight: bold;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #92400E; }"
)
