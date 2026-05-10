"""
Settings page — view and update application configuration.
"""
import json
import os
import logging
from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QSpinBox, QCheckBox, QComboBox, QGroupBox, QMessageBox,
    QFormLayout,
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont

logger = logging.getLogger(__name__)


class SettingsPage(QWidget):
    """
    Settings page:
    - Age threshold (days)
    - Dry run toggle
    - Log level dropdown
    - Save Settings button
    - View Log button (opens log file in default editor)
    - Back button
    """

    navigate_back = pyqtSignal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._build_ui()
        self._load_settings()

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------

    def _build_ui(self):
        self.setStyleSheet("background: transparent;")
        outer = QVBoxLayout(self)
        outer.setContentsMargins(40, 30, 40, 30)
        outer.setSpacing(20)

        # Title
        title = QLabel("Settings")
        title.setFont(QFont("Segoe UI", 20, QFont.Bold))
        title.setStyleSheet("color: #E2E8F0;")
        outer.addWidget(title)

        # Settings group box
        group = QGroupBox("Application Settings")
        group.setStyleSheet(
            "QGroupBox {"
            "  background: #1E2A3A; border: 1px solid #2D3F55; border-radius: 6px;"
            "  color: #94A3B8; font-size: 9pt; margin-top: 10px; padding: 10px;"
            "}"
            "QGroupBox::title { subcontrol-origin: margin; left: 12px; padding: 0 4px; }"
        )
        form = QFormLayout(group)
        form.setContentsMargins(16, 20, 16, 16)
        form.setSpacing(14)
        form.setLabelAlignment(Qt.AlignRight)

        label_style = "color: #CBD5E1; font-size: 9pt;"

        # Age threshold
        age_label = QLabel("Age threshold (days):")
        age_label.setStyleSheet(label_style)
        self._age_spin = QSpinBox()
        self._age_spin.setRange(1, 3650)
        self._age_spin.setValue(90)
        self._age_spin.setFixedWidth(100)
        self._age_spin.setStyleSheet(_SPIN_STYLE)
        form.addRow(age_label, self._age_spin)

        # Log level
        log_label = QLabel("Log level:")
        log_label.setStyleSheet(label_style)
        self._log_combo = QComboBox()
        self._log_combo.addItems(["DEBUG", "INFO", "WARNING", "ERROR"])
        self._log_combo.setCurrentText("INFO")
        self._log_combo.setFixedWidth(120)
        self._log_combo.setStyleSheet(_COMBO_STYLE)
        form.addRow(log_label, self._log_combo)

        outer.addWidget(group)
        outer.addStretch()

        # Bottom buttons
        btn_row = QHBoxLayout()
        btn_row.setSpacing(12)

        back_btn = QPushButton("← Back")
        back_btn.setFixedHeight(40)
        back_btn.setStyleSheet(_SECONDARY_BTN)
        back_btn.clicked.connect(self._on_back)
        btn_row.addWidget(back_btn)

        btn_row.addStretch()

        view_log_btn = QPushButton("View Log")
        view_log_btn.setFixedHeight(40)
        view_log_btn.setStyleSheet(_SECONDARY_BTN)
        view_log_btn.clicked.connect(self._on_view_log)
        btn_row.addWidget(view_log_btn)

        save_btn = QPushButton("Save Settings")
        save_btn.setFixedHeight(40)
        save_btn.setMinimumWidth(130)
        save_btn.setStyleSheet(_PRIMARY_BTN)
        save_btn.clicked.connect(self._on_save)
        btn_row.addWidget(save_btn)

        outer.addLayout(btn_row)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _settings_path(self) -> str:
        from src.utils import get_project_root
        return os.path.join(get_project_root(), "config", "settings.json")

    def _log_path(self) -> str:
        from src.utils import get_project_root
        return os.path.join(get_project_root(), "logs", "cleaner_log.txt")

    def _load_settings(self):
        try:
            path = self._settings_path()
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self._age_spin.setValue(int(data.get("age_threshold_days", 90)))
                log_level = data.get("log_level", "INFO").upper()
                idx = self._log_combo.findText(log_level)
                if idx >= 0:
                    self._log_combo.setCurrentIndex(idx)
        except Exception as exc:
            logger.warning("Could not load settings: %s", exc)

    def _save_settings_to_disk(self):
        existing = {}
        path = self._settings_path()
        try:
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    existing = json.load(f)
        except Exception:
            pass

        existing["age_threshold_days"] = self._age_spin.value()
        existing["log_level"] = self._log_combo.currentText()

        with open(path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

    # ------------------------------------------------------------------
    # Slots
    # ------------------------------------------------------------------

    def _on_save(self):
        try:
            self._save_settings_to_disk()
            QMessageBox.information(self, "Saved", "Settings saved successfully.")
        except Exception as exc:
            QMessageBox.critical(self, "Error", f"Could not save settings:\n{exc}")

    def _on_view_log(self):
        log_path = self._log_path()
        if not os.path.exists(log_path):
            QMessageBox.information(self, "No Log", "Log file does not exist yet.")
            return
        try:
            os.startfile(log_path)
        except Exception:
            try:
                import subprocess
                subprocess.Popen(["notepad", log_path])
            except Exception as exc:
                QMessageBox.warning(self, "Cannot Open", f"Could not open log file:\n{exc}")

    def _on_back(self):
        self.navigate_back.emit()


# ---------------------------------------------------------------------------
# Stylesheets
# ---------------------------------------------------------------------------
_SPIN_STYLE = (
    "QSpinBox {"
    "  background: #1E2A3A; color: #E2E8F0;"
    "  border: 1px solid #2D3F55; border-radius: 4px;"
    "  padding: 2px 6px; font-size: 9pt;"
    "}"
)

_COMBO_STYLE = (
    "QComboBox {"
    "  background: #1E2A3A; color: #E2E8F0;"
    "  border: 1px solid #2D3F55; border-radius: 4px;"
    "  padding: 2px 6px; font-size: 9pt;"
    "}"
    "QComboBox::drop-down { border: none; }"
    "QComboBox QAbstractItemView {"
    "  background: #1E2A3A; color: #E2E8F0; selection-background-color: #1D4ED8;"
    "}"
)

_PRIMARY_BTN = (
    "QPushButton {"
    "  background: #1D4ED8; color: white;"
    "  border: none; border-radius: 5px; font-size: 9pt; font-weight: bold;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #2563EB; }"
)

_SECONDARY_BTN = (
    "QPushButton {"
    "  background: #1E2A3A; color: #94A3B8;"
    "  border: 1px solid #2D3F55; border-radius: 5px; font-size: 9pt;"
    "  padding: 0 14px;"
    "}"
    "QPushButton:hover { background: #263445; color: #CBD5E1; }"
)
