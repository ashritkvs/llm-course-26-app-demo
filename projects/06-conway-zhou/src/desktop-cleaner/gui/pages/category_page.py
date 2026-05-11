"""
Category page — lets the user define custom categories before scanning.
"""
import json
import os
import logging
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QListWidget, QListWidgetItem, QMessageBox,
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont

logger = logging.getLogger(__name__)


class CategoryPage(QWidget):
    """
    Page that allows the user to:
    - Add / remove custom category names
    - Persist them to user_categories.json
    - Proceed to the scan

    Signals:
        navigate_back           — go to home page
        navigate_to_results     — start scan and go to results page
    """

    navigate_back = pyqtSignal()
    navigate_to_results = pyqtSignal(list)  # emits category list

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build_ui()
        self._load_categories()

    # ------------------------------------------------------------------
    # UI Construction
    # ------------------------------------------------------------------

    def _build_ui(self):
        self.setStyleSheet("background: transparent;")
        layout = QVBoxLayout(self)
        layout.setContentsMargins(40, 30, 40, 30)
        layout.setSpacing(16)

        # Title
        title = QLabel("Define Your Categories")
        title.setFont(QFont("Segoe UI", 20, QFont.Bold))
        title.setStyleSheet("color: #E2E8F0;")
        layout.addWidget(title)

        subtitle = QLabel(
            "Add category names that will be used to match your files first (Pass 1).\n"
            "Files that don't match will be auto-categorised by AI (Pass 2)."
        )
        subtitle.setStyleSheet("color: #94A3B8; font-size: 9pt;")
        layout.addWidget(subtitle)

        layout.addSpacing(8)

        # Input row
        input_row = QHBoxLayout()
        input_row.setSpacing(8)

        self._input = QLineEdit()
        self._input.setPlaceholderText("e.g. Games, Documents, Work Projects...")
        self._input.setFixedHeight(36)
        self._input.setStyleSheet(_INPUT_STYLE)
        self._input.returnPressed.connect(self._add_category)
        input_row.addWidget(self._input, stretch=1)

        add_btn = QPushButton("Add")
        add_btn.setFixedHeight(36)
        add_btn.setMinimumWidth(80)
        add_btn.setStyleSheet(_PRIMARY_BTN)
        add_btn.clicked.connect(self._add_category)
        input_row.addWidget(add_btn)

        layout.addLayout(input_row)

        # Category list
        list_label = QLabel("Your categories:")
        list_label.setStyleSheet("color: #94A3B8; font-size: 8pt;")
        layout.addWidget(list_label)

        self._list = QListWidget()
        self._list.setStyleSheet(_LIST_STYLE)
        layout.addWidget(self._list, stretch=1)

        # Remove button
        remove_row = QHBoxLayout()
        remove_row.addStretch()
        remove_btn = QPushButton("Remove Selected")
        remove_btn.setFixedHeight(32)
        remove_btn.setStyleSheet(_DANGER_BTN)
        remove_btn.clicked.connect(self._remove_category)
        remove_row.addWidget(remove_btn)
        layout.addLayout(remove_row)

        layout.addSpacing(8)

        # Navigation buttons
        nav_row = QHBoxLayout()
        nav_row.setSpacing(12)

        back_btn = QPushButton("← Back")
        back_btn.setFixedHeight(40)
        back_btn.setStyleSheet(_SECONDARY_BTN)
        back_btn.clicked.connect(self._on_back)
        nav_row.addWidget(back_btn)

        nav_row.addStretch()

        scan_btn = QPushButton("Start Scan →")
        scan_btn.setFixedHeight(40)
        scan_btn.setMinimumWidth(140)
        scan_btn.setStyleSheet(_PRIMARY_BTN)
        scan_btn.clicked.connect(self._on_scan)
        nav_row.addWidget(scan_btn)

        layout.addLayout(nav_row)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _categories_path(self) -> str:
        from src.utils import get_project_root
        return os.path.join(get_project_root(), "config", "user_categories.json")

    def _load_categories(self):
        try:
            path = self._categories_path()
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for cat in data.get("categories", []):
                    self._list.addItem(cat)
        except Exception as exc:
            logger.warning("Could not load categories: %s", exc)

    def _save_categories(self):
        categories = self._get_category_list()
        try:
            path = self._categories_path()
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"categories": categories}, f, indent=2)
        except Exception as exc:
            logger.warning("Could not save categories: %s", exc)

    def _get_category_list(self) -> list:
        return [
            self._list.item(i).text()
            for i in range(self._list.count())
        ]

    # ------------------------------------------------------------------
    # Slots
    # ------------------------------------------------------------------

    def _add_category(self):
        text = self._input.text().strip()
        if not text:
            return
        # Prevent duplicates
        existing = self._get_category_list()
        if text.lower() in [c.lower() for c in existing]:
            QMessageBox.information(self, "Duplicate", f'"{text}" is already in the list.')
            return
        self._list.addItem(text)
        self._input.clear()
        self._save_categories()

    def _remove_category(self):
        selected = self._list.selectedItems()
        if not selected:
            QMessageBox.information(self, "Nothing selected", "Please select a category to remove.")
            return
        for item in selected:
            self._list.takeItem(self._list.row(item))
        self._save_categories()

    def _on_back(self):
        self._save_categories()
        self.navigate_back.emit()

    def _on_scan(self):
        self._save_categories()
        self.navigate_to_results.emit(self._get_category_list())


# ---------------------------------------------------------------------------
# Stylesheets
# ---------------------------------------------------------------------------
_INPUT_STYLE = (
    "QLineEdit {"
    "  background: #1E2A3A; color: #E2E8F0;"
    "  border: 1px solid #2D3F55; border-radius: 4px;"
    "  padding: 0 10px; font-size: 9pt;"
    "}"
    "QLineEdit:focus { border-color: #3B82F6; }"
)

_LIST_STYLE = (
    "QListWidget {"
    "  background: #1E2A3A; color: #E2E8F0;"
    "  border: 1px solid #2D3F55; border-radius: 4px;"
    "  font-size: 9pt;"
    "}"
    "QListWidget::item { padding: 6px 10px; }"
    "QListWidget::item:selected { background: #1D4ED8; }"
    "QListWidget::item:hover { background: #263445; }"
)

_PRIMARY_BTN = (
    "QPushButton {"
    "  background: #1D4ED8; color: white;"
    "  border: none; border-radius: 5px; font-size: 9pt; font-weight: bold;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #2563EB; }"
    "QPushButton:pressed { background: #1E40AF; }"
)

_SECONDARY_BTN = (
    "QPushButton {"
    "  background: #1E2A3A; color: #94A3B8;"
    "  border: 1px solid #2D3F55; border-radius: 5px; font-size: 9pt;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #263445; color: #CBD5E1; }"
)

_DANGER_BTN = (
    "QPushButton {"
    "  background: #7F1D1D; color: #FCA5A5;"
    "  border: 1px solid #991B1B; border-radius: 5px; font-size: 8pt;"
    "  padding: 0 12px;"
    "}"
    "QPushButton:hover { background: #991B1B; }"
)
