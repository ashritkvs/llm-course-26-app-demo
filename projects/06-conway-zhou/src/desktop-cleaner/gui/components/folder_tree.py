"""
FolderTree — PyQt5 QTreeWidget showing the planned desktop folder structure.
Each folder has a checkbox; toggling it emits a signal so the file cards
on the right panel can be checked/unchecked in sync.
"""
from collections import defaultdict
from PyQt5.QtWidgets import (
    QTreeWidget, QTreeWidgetItem, QPushButton, QVBoxLayout,
    QWidget, QHBoxLayout,
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QFont, QBrush, QColor


class FolderTree(QWidget):
    """
    Displays a visual tree of the output folder structure.

    Each top-level node is a checkable category folder.
    Toggling a folder emits category_toggled(category_name, is_checked).
    """

    category_toggled = pyqtSignal(str, bool)   # (category, checked)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._folder_items: dict[str, QTreeWidgetItem] = {}  # category → tree item
        self._build_ui()

    # ------------------------------------------------------------------
    # UI
    # ------------------------------------------------------------------

    def _build_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        # Control buttons
        btn_row = QHBoxLayout()
        btn_expand = QPushButton("Expand All")
        btn_collapse = QPushButton("Collapse All")
        btn_expand.setStyleSheet(_BTN_STYLE)
        btn_collapse.setStyleSheet(_BTN_STYLE)
        btn_row.addWidget(btn_expand)
        btn_row.addWidget(btn_collapse)
        btn_row.addStretch()
        layout.addLayout(btn_row)

        self._tree = QTreeWidget()
        self._tree.setHeaderLabels(["Folder / File", "Count"])
        self._tree.setColumnWidth(0, 230)
        self._tree.setStyleSheet(_TREE_STYLE)
        self._tree.setAlternatingRowColors(True)
        layout.addWidget(self._tree)

        btn_expand.clicked.connect(self._tree.expandAll)
        btn_collapse.clicked.connect(self._tree.collapseAll)

        # Only emit signal when a folder checkbox changes
        self._tree.itemChanged.connect(self._on_item_changed)

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def load_classified_files(self, classified_files: list):
        """Rebuilds the tree from classified file dicts."""
        # Block signals while building to avoid spurious emissions
        self._tree.blockSignals(True)
        self._tree.clear()
        self._folder_items.clear()

        groups: dict[str, list] = defaultdict(list)
        for item in classified_files:
            if "file_metadata" in item:
                meta = item["file_metadata"]
            elif "file" in item:
                meta = item["file"]
            else:
                meta = {}
            category = item.get("category", "Other Files")
            name = meta.get("name", "") if isinstance(meta, dict) else getattr(meta, "name", "")
            groups[category].append(name)

        for category in sorted(groups.keys()):
            files = groups[category]
            folder_item = QTreeWidgetItem(self._tree, [f"📁 {category}", str(len(files))])
            folder_item.setFont(0, QFont("Segoe UI", 9, QFont.Bold))
            folder_item.setForeground(0, QBrush(QColor("#60A5FA")))
            folder_item.setExpanded(True)
            # Make the folder row checkable, checked by default
            folder_item.setFlags(folder_item.flags() | Qt.ItemIsUserCheckable)
            folder_item.setCheckState(0, Qt.Checked)
            # Store category name on the item for lookup in signal handler
            folder_item.setData(0, Qt.UserRole, category)
            self._folder_items[category] = folder_item

            for fname in sorted(files):
                file_item = QTreeWidgetItem(folder_item, [f"  {fname}", ""])
                file_item.setForeground(0, QBrush(QColor("#CBD5E1")))
                # File rows are NOT checkable — controlled by the folder checkbox

        self._tree.resizeColumnToContents(0)
        self._tree.blockSignals(False)

    def set_all_folders_checked(self, checked: bool):
        """Checks or unchecks every folder at once."""
        self._tree.blockSignals(True)
        state = Qt.Checked if checked else Qt.Unchecked
        for item in self._folder_items.values():
            item.setCheckState(0, state)
        self._tree.blockSignals(False)
        # Emit one signal per folder so file cards update
        for category in self._folder_items:
            self.category_toggled.emit(category, checked)

    # ------------------------------------------------------------------
    # Slots
    # ------------------------------------------------------------------

    def _on_item_changed(self, item: QTreeWidgetItem, column: int):
        if column != 0:
            return
        category = item.data(0, Qt.UserRole)
        if category is None:
            return  # file row, ignore
        checked = item.checkState(0) == Qt.Checked
        # Update folder label colour to give visual feedback
        colour = "#60A5FA" if checked else "#4B5563"
        item.setForeground(0, QBrush(QColor(colour)))
        self.category_toggled.emit(category, checked)


# ---------------------------------------------------------------------------
# Stylesheets
# ---------------------------------------------------------------------------
_BTN_STYLE = (
    "QPushButton {"
    "  background: #1E3A5F;"
    "  color: #93C5FD;"
    "  border: 1px solid #2D5A8E;"
    "  border-radius: 4px;"
    "  padding: 3px 10px;"
    "  font-size: 8pt;"
    "}"
    "QPushButton:hover { background: #2D5A8E; }"
)

_TREE_STYLE = (
    "QTreeWidget {"
    "  background: #0F1E2E;"
    "  color: #CBD5E1;"
    "  border: 1px solid #2D3F55;"
    "  border-radius: 4px;"
    "  font-size: 9pt;"
    "}"
    "QTreeWidget::item:selected { background: #1E3A5F; }"
    "QTreeWidget::item:alternate { background: #131F2E; }"
    "QHeaderView::section {"
    "  background: #162032;"
    "  color: #94A3B8;"
    "  border: none;"
    "  padding: 4px;"
    "  font-size: 8pt;"
    "}"
)
