"""
ProgressBar — PyQt5 widget combining a QProgressBar with a status label.
"""
from PyQt5.QtWidgets import QWidget, QVBoxLayout, QHBoxLayout, QProgressBar, QLabel, QPushButton
from PyQt5.QtCore import Qt


class ProgressBarWidget(QWidget):
    """
    A progress-bar widget with:
    - A QProgressBar
    - A status text label
    - Start / Cancel buttons

    Usage:
        pb = ProgressBarWidget()
        pb.update_progress(current=5, total=20, message="Classifying files...")
    """

    def __init__(self, parent=None):
        super().__init__(parent)
        self._cancelled = False
        self._build_ui()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def update_progress(self, current: int, total: int, message: str = "") -> None:
        """
        Updates the progress bar and status label.

        Args:
            current: Number of items processed so far.
            total:   Total number of items.
            message: Optional status message to display.
        """
        if total > 0:
            self._bar.setMaximum(total)
            self._bar.setValue(current)
            pct = int(current / total * 100)
            self._bar.setFormat(f"{pct}%  ({current}/{total})")
        else:
            self._bar.setMaximum(0)
            self._bar.setValue(0)
            self._bar.setFormat("")

        if message:
            self._status_label.setText(message)

    def set_message(self, message: str) -> None:
        """Sets the status label text."""
        self._status_label.setText(message)

    def reset(self) -> None:
        """Resets the progress bar to zero and clears the status label."""
        self._bar.setValue(0)
        self._bar.setMaximum(100)
        self._bar.setFormat("")
        self._status_label.setText("")
        self._cancelled = False

    def set_indeterminate(self, indeterminate: bool) -> None:
        """Switches the bar between indeterminate (animated) and determinate mode."""
        if indeterminate:
            self._bar.setMaximum(0)
            self._bar.setValue(0)
        else:
            self._bar.setMaximum(100)

    @property
    def is_cancelled(self) -> bool:
        return self._cancelled

    # ------------------------------------------------------------------
    # Private
    # ------------------------------------------------------------------

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        self._status_label = QLabel("")
        self._status_label.setAlignment(Qt.AlignLeft)
        self._status_label.setStyleSheet("color: #94A3B8; font-size: 8pt;")
        layout.addWidget(self._status_label)

        self._bar = QProgressBar()
        self._bar.setMinimum(0)
        self._bar.setMaximum(100)
        self._bar.setValue(0)
        self._bar.setTextVisible(True)
        self._bar.setStyleSheet(
            "QProgressBar {"
            "  background: #1E2A3A;"
            "  border: 1px solid #2D3F55;"
            "  border-radius: 4px;"
            "  height: 16px;"
            "  color: white;"
            "  text-align: center;"
            "  font-size: 8pt;"
            "}"
            "QProgressBar::chunk {"
            "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0,"
            "    stop:0 #1D4ED8, stop:1 #3B82F6);"
            "  border-radius: 4px;"
            "}"
        )
        layout.addWidget(self._bar)

        # Buttons row
        btn_row = QHBoxLayout()
        btn_row.setSpacing(8)

        self._cancel_btn = QPushButton("Cancel")
        self._cancel_btn.setStyleSheet(
            "QPushButton {"
            "  background: #7F1D1D; color: #FCA5A5;"
            "  border: 1px solid #991B1B; border-radius: 4px;"
            "  padding: 3px 12px; font-size: 8pt;"
            "}"
            "QPushButton:hover { background: #991B1B; }"
            "QPushButton:disabled { background: #374151; color: #6B7280; border-color: #4B5563; }"
        )
        self._cancel_btn.clicked.connect(self._on_cancel)

        btn_row.addStretch()
        btn_row.addWidget(self._cancel_btn)
        layout.addLayout(btn_row)

    def _on_cancel(self):
        self._cancelled = True
        self._status_label.setText("Cancelling…")
        self._cancel_btn.setEnabled(False)
