"""
Utility functions for Desktop Cleaner.
"""
import os
import sys
import logging
from datetime import datetime
from pathlib import Path


def get_desktop_path() -> str:
    """
    Returns the Windows desktop path using pywin32.
    Falls back to os.path.expanduser("~/Desktop") if pywin32 is unavailable.
    """
    try:
        import win32com.client
        from win32com.shell import shell, shellcon
        desktop = shell.SHGetFolderPath(0, shellcon.CSIDL_DESKTOP, None, 0)
        return str(desktop)
    except Exception:
        pass

    # Fallback: try OneDrive Desktop first (common on modern Windows)
    onedrive_desktop = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
    if os.path.isdir(onedrive_desktop):
        return onedrive_desktop

    return os.path.expanduser(os.path.join("~", "Desktop"))


def get_project_root() -> str:
    """
    Returns the absolute path to the desktop-cleaner project root directory.
    """
    # This file lives at <root>/src/utils.py, so go up two levels.
    return str(Path(__file__).resolve().parent.parent)


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configures logging to logs/cleaner_log.txt with timestamps.
    Also logs to stdout.
    """
    root = get_project_root()
    log_dir = os.path.join(root, "logs")
    ensure_dir(log_dir)
    log_file = os.path.join(log_dir, "cleaner_log.txt")

    level = getattr(logging, log_level.upper(), logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)
    file_handler.setLevel(level)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)
    stream_handler.setLevel(level)

    logging.basicConfig(level=level, handlers=[file_handler, stream_handler])


def log_action(action: str, file_path: str, category: str) -> None:
    """
    Logs a timestamped action to the application logger.

    Args:
        action: Description of the action (e.g. "MOVE", "SKIP", "FLAG").
        file_path: Full path of the file being acted on.
        category: The category assigned to the file.
    """
    logger = logging.getLogger("desktop_cleaner.actions")
    timestamp = format_timestamp(datetime.now())
    logger.info("[%s] %s | file=%s | category=%s", timestamp, action, file_path, category)


def format_timestamp(dt: datetime) -> str:
    """
    Formats a datetime object to a human-readable string.

    Args:
        dt: The datetime to format.

    Returns:
        Formatted string like "2025-03-16 14:30:00".
    """
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def ensure_dir(path: str) -> None:
    """
    Creates the directory (and any missing parents) if it doesn't already exist.

    Args:
        path: The directory path to create.
    """
    os.makedirs(path, exist_ok=True)
