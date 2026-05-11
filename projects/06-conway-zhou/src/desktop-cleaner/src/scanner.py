"""
Desktop scanner — collects metadata for every item on the Windows desktop.
"""
import os
import logging
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class DesktopScanner:
    """
    Scans the Windows desktop and returns metadata for each item found.
    Skips the desktop-cleaner folder itself if it lives on the desktop.
    """

    # Name of the project folder so we can skip it during scanning
    _SELF_FOLDER_NAME = "desktop-cleaner"

    def scan(self) -> List[Dict[str, Any]]:
        """
        Scans the Windows desktop.

        Returns:
            A list of metadata dicts, one per desktop item.  Each dict has:
                name            – file/folder name
                path            – full absolute path
                extension       – lower-case extension including dot, or ""
                size_bytes      – file size in bytes (0 for directories)
                last_accessed   – datetime or None
                last_modified   – datetime or None
                created         – datetime or None
                is_shortcut     – True if the item is a .lnk or .url file
                shortcut_target – resolved target path string, or None
        """
        from src.utils import get_desktop_path

        desktop_path = get_desktop_path()
        logger.info("Scanning desktop at: %s", desktop_path)

        if not os.path.isdir(desktop_path):
            logger.error("Desktop path does not exist: %s", desktop_path)
            return []

        results: List[Dict[str, Any]] = []

        try:
            entries = os.listdir(desktop_path)
        except PermissionError as exc:
            logger.error("Cannot list desktop directory: %s", exc)
            return []

        for entry_name in entries:
            # Skip the project folder itself
            if entry_name.lower() == self._SELF_FOLDER_NAME.lower():
                logger.debug("Skipping self-folder: %s", entry_name)
                continue

            # Skip Windows desktop.ini
            if entry_name.lower() == "desktop.ini":
                continue

            full_path = os.path.join(desktop_path, entry_name)

            # Skip existing directories — Desktop Cleaner only organises files
            # and shortcuts, never moves pre-existing folders.
            if os.path.isdir(full_path):
                logger.debug("Skipping existing folder: %s", entry_name)
                continue
            try:
                metadata = self._build_metadata(full_path, entry_name)
                results.append(metadata)
                logger.debug("Scanned: %s", full_path)
            except Exception as exc:
                logger.warning("Skipping %s — error reading metadata: %s", full_path, exc)

        logger.info("Scan complete. Found %d items.", len(results))
        return results

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _build_metadata(self, full_path: str, name: str) -> Dict[str, Any]:
        """
        Builds the metadata dict for a single desktop item.
        """
        stat = os.stat(full_path)

        extension = ""
        if os.path.isfile(full_path):
            _, ext = os.path.splitext(name)
            extension = ext.lower()

        is_shortcut = extension in (".lnk", ".url")
        shortcut_target = None

        if is_shortcut:
            shortcut_target = self._resolve_shortcut(full_path, extension)

        size_bytes = stat.st_size if os.path.isfile(full_path) else 0

        last_accessed = self._ts_to_dt(stat.st_atime)
        last_modified = self._ts_to_dt(stat.st_mtime)
        created = self._ts_to_dt(stat.st_ctime)

        return {
            "name": name,
            "path": full_path,
            "extension": extension,
            "size_bytes": size_bytes,
            "last_accessed": last_accessed,
            "last_modified": last_modified,
            "created": created,
            "is_shortcut": is_shortcut,
            "shortcut_target": shortcut_target,
        }

    @staticmethod
    def _resolve_shortcut(path: str, extension: str) -> str | None:
        """
        Resolves the target path of a Windows shortcut (.lnk) or URL (.url) file.
        """
        if extension == ".lnk":
            try:
                import win32com.client
                shell = win32com.client.Dispatch("WScript.Shell")
                shortcut = shell.CreateShortCut(path)
                return shortcut.Targetpath or None
            except Exception as exc:
                logger.debug("Could not resolve .lnk %s: %s", path, exc)
                return None

        if extension == ".url":
            try:
                import configparser
                cp = configparser.ConfigParser()
                cp.read(path, encoding="utf-8")
                url = cp.get("InternetShortcut", "URL", fallback=None)
                return url
            except Exception as exc:
                logger.debug("Could not resolve .url %s: %s", path, exc)
                return None

        return None

    @staticmethod
    def _ts_to_dt(ts: float) -> datetime | None:
        """
        Converts a POSIX timestamp to a naive local datetime.
        Returns None if conversion fails.
        """
        try:
            return datetime.fromtimestamp(ts)
        except Exception:
            return None
