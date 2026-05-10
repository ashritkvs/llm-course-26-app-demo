"""
FileCard — a compact PyQt5 widget that displays metadata for a single desktop file.
"""
from PyQt5.QtWidgets import (
    QWidget, QHBoxLayout, QVBoxLayout, QLabel, QSizePolicy,
)
from PyQt5.QtCore import Qt
from PyQt5.QtGui import QFont

# Map common extensions to a simple text icon
_EXT_ICONS = {
    ".exe": "⚙",
    ".lnk": "🔗",
    ".url": "🌐",
    ".pdf": "📄",
    ".doc": "📝",
    ".docx": "📝",
    ".xls": "📊",
    ".xlsx": "📊",
    ".ppt": "📊",
    ".pptx": "📊",
    ".txt": "📄",
    ".zip": "🗜",
    ".rar": "🗜",
    ".7z": "🗜",
    ".jpg": "🖼",
    ".jpeg": "🖼",
    ".png": "🖼",
    ".gif": "🖼",
    ".bmp": "🖼",
    ".mp3": "🎵",
    ".wav": "🎵",
    ".mp4": "🎬",
    ".avi": "🎬",
    ".mkv": "🎬",
    ".py": "🐍",
    ".js": "📜",
    ".html": "🌐",
    ".css": "🎨",
}

# Palette for category badge background colours (cycles through the list)
_CATEGORY_COLOURS = [
    "#3B82F6",  # blue
    "#10B981",  # green
    "#F59E0B",  # amber
    "#EF4444",  # red
    "#8B5CF6",  # purple
    "#EC4899",  # pink
    "#14B8A6",  # teal
    "#F97316",  # orange
]

_colour_index: int = 0
_category_colour_map: dict[str, str] = {}


def _colour_for_category(category: str) -> str:
    """Returns a consistent colour for a given category label."""
    global _colour_index
    if category not in _category_colour_map:
        _category_colour_map[category] = _CATEGORY_COLOURS[
            _colour_index % len(_CATEGORY_COLOURS)
        ]
        _colour_index += 1
    return _category_colour_map[category]


class FileCard(QWidget):
    """
    A compact card widget displaying:
    - File icon (based on extension)
    - File name (bold)
    - Extension badge
    - Assigned category (coloured label)
    - Last accessed date
    """

    def __init__(self, file_metadata: dict, category: str, parent=None):
        super().__init__(parent)
        self._file_metadata = file_metadata
        self._category = category
        self._build_ui()

    def _build_ui(self):
        self.setObjectName("FileCard")
        self.setStyleSheet(
            "#FileCard {"
            "  background: #1E2A3A;"
            "  border: 1px solid #2D3F55;"
            "  border-radius: 6px;"
            "  padding: 4px;"
            "}"
            "#FileCard:hover { border-color: #4A90D9; }"
        )
        self.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Fixed)

        outer = QHBoxLayout(self)
        outer.setContentsMargins(8, 6, 8, 6)
        outer.setSpacing(10)

        # --- Icon ---
        ext = self._file_metadata.get("extension", "").lower()
        icon_char = _EXT_ICONS.get(ext, "📁")
        icon_label = QLabel(icon_char)
        icon_label.setFixedWidth(28)
        icon_label.setAlignment(Qt.AlignCenter)
        icon_label.setFont(QFont("Segoe UI Emoji", 14))
        outer.addWidget(icon_label)

        # --- Centre block: name + dates ---
        centre = QVBoxLayout()
        centre.setSpacing(2)

        name = self._file_metadata.get("name", "Unknown")
        name_label = QLabel(name)
        name_label.setFont(QFont("Segoe UI", 9, QFont.Bold))
        name_label.setStyleSheet("color: #E2E8F0;")
        name_label.setToolTip(self._file_metadata.get("path", ""))
        centre.addWidget(name_label)

        last_accessed = self._file_metadata.get("last_accessed")
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

        date_label = QLabel(f"Last accessed: {date_str}")
        date_label.setStyleSheet("color: #94A3B8; font-size: 8pt;")
        centre.addWidget(date_label)

        outer.addLayout(centre, stretch=1)

        # --- Right block: extension badge + category badge ---
        right = QVBoxLayout()
        right.setSpacing(4)
        right.setAlignment(Qt.AlignRight | Qt.AlignVCenter)

        if ext:
            ext_badge = QLabel(ext.upper().lstrip("."))
            ext_badge.setAlignment(Qt.AlignCenter)
            ext_badge.setStyleSheet(
                "background: #374151; color: #9CA3AF; font-size: 7pt;"
                "padding: 1px 5px; border-radius: 3px;"
            )
            right.addWidget(ext_badge)

        colour = _colour_for_category(self._category)
        cat_badge = QLabel(self._category)
        cat_badge.setAlignment(Qt.AlignCenter)
        cat_badge.setStyleSheet(
            f"background: {colour}; color: white; font-size: 7pt; font-weight: bold;"
            "padding: 2px 6px; border-radius: 3px;"
        )
        right.addWidget(cat_badge)

        outer.addLayout(right)
