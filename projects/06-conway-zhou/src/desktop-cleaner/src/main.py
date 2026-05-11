#!/usr/bin/env python3
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils import setup_logging


def run_gui():
    from PyQt5.QtWidgets import QApplication
    from gui.app import MainWindow
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec_())


if __name__ == "__main__":
    setup_logging()
    run_gui()
