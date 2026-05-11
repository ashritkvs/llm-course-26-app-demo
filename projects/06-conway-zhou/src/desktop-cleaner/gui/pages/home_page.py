"""
Home page — landing screen for Desktop Cleaner.
"""
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, QSpacerItem,
    QSizePolicy,
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont


class HomePage(QWidget):
    """
    Landing page with:
    - App title and description
    - "Start Scan" button  → emits navigate_to_categories
    - "Settings" button    → emits navigate_to_settings
    """

    navigate_to_categories = pyqtSignal()
    navigate_to_settings = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build_ui()

    def _build_ui(self):
        self.setStyleSheet("background: transparent;")

        outer = QVBoxLayout(self)
        outer.setAlignment(Qt.AlignCenter)
        outer.setSpacing(0)
        outer.setContentsMargins(60, 40, 60, 40)

        # ---- Title block ----
        outer.addStretch(2)

        icon_label = QLabel("🗂")
        icon_label.setAlignment(Qt.AlignCenter)
        icon_label.setFont(QFont("Segoe UI Emoji", 52))
        outer.addWidget(icon_label)

        outer.addSpacing(12)

        title = QLabel("Desktop Cleaner")
        title.setAlignment(Qt.AlignCenter)
        title.setFont(QFont("Segoe UI", 28, QFont.Bold))
        title.setStyleSheet("color: #E2E8F0; letter-spacing: 1px;")
        outer.addWidget(title)

        outer.addSpacing(16)

        description = QLabel(
            "Intelligently organise every file, shortcut, and application\n"
            "on your desktop into neatly labelled folders using AI."
        )
        description.setAlignment(Qt.AlignCenter)
        description.setFont(QFont("Segoe UI", 11))
        description.setStyleSheet("color: #94A3B8; line-height: 1.6;")
        outer.addWidget(description)

        outer.addSpacing(40)

        # ---- Feature bullets ----
        bullets_container = QWidget()
        bullets_container.setStyleSheet(
            "background: #1E2A3A; border: 1px solid #2D3F55; border-radius: 8px;"
        )
        bullets_layout = QVBoxLayout(bullets_container)
        bullets_layout.setContentsMargins(24, 16, 24, 16)
        bullets_layout.setSpacing(8)

        bullets = [
            ("✦", "Two-pass AI classification — matches your categories first"),
            ("✦", "Dry-run preview before moving any file"),
            ("✦", "Flags old files for review — never permanently deletes"),
            ("✦", "Full audit log of every action taken"),
        ]
        for symbol, text in bullets:
            row = QHBoxLayout()
            sym_lbl = QLabel(symbol)
            sym_lbl.setStyleSheet("color: #3B82F6; font-size: 10pt; min-width: 16px;")
            txt_lbl = QLabel(text)
            txt_lbl.setStyleSheet("color: #CBD5E1; font-size: 9pt;")
            row.addWidget(sym_lbl)
            row.addWidget(txt_lbl)
            row.addStretch()
            bullets_layout.addLayout(row)

        outer.addWidget(bullets_container)
        outer.addSpacing(36)

        # ---- Buttons ----
        btn_row = QHBoxLayout()
        btn_row.setSpacing(16)
        btn_row.setAlignment(Qt.AlignCenter)

        start_btn = QPushButton("  Start Scan  ")
        start_btn.setFont(QFont("Segoe UI", 11, QFont.Bold))
        start_btn.setFixedHeight(44)
        start_btn.setMinimumWidth(160)
        start_btn.setStyleSheet(
            "QPushButton {"
            "  background: #1D4ED8; color: white;"
            "  border: none; border-radius: 6px;"
            "}"
            "QPushButton:hover { background: #2563EB; }"
            "QPushButton:pressed { background: #1E40AF; }"
        )
        start_btn.clicked.connect(self.navigate_to_categories)

        settings_btn = QPushButton("  Settings  ")
        settings_btn.setFont(QFont("Segoe UI", 11))
        settings_btn.setFixedHeight(44)
        settings_btn.setMinimumWidth(130)
        settings_btn.setStyleSheet(
            "QPushButton {"
            "  background: #1E2A3A; color: #94A3B8;"
            "  border: 1px solid #2D3F55; border-radius: 6px;"
            "}"
            "QPushButton:hover { background: #263445; color: #CBD5E1; }"
            "QPushButton:pressed { background: #1A2433; }"
        )
        settings_btn.clicked.connect(self.navigate_to_settings)

        btn_row.addWidget(start_btn)
        btn_row.addWidget(settings_btn)
        outer.addLayout(btn_row)

        outer.addStretch(3)
