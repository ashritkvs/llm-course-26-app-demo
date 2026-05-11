"""
File organizer — moves classified files into labelled folders on the desktop.
"""
import os
import shutil
import logging
from typing import List, Dict, Any

from src.utils import ensure_dir, log_action

logger = logging.getLogger(__name__)


class FileOrganizer:
    """
    Moves classified desktop files into named category folders.
    Supports dry-run mode (no files are moved; only actions are logged).
    """

    def organize(
        self,
        classified_files: List[Dict[str, Any]],
        desktop_path: str,
        dry_run: bool = False,
    ) -> Dict[str, int]:
        """
        Moves files to their assigned category folders on the desktop.

        Args:
            classified_files: Output from LLMClassifier — list of
                              {file_metadata, category, pass_number} dicts.
            desktop_path:     Absolute path to the Windows desktop.
            dry_run:          If True, log planned moves but don't execute them.

        Returns:
            Summary dict: {moved, skipped, errors}
        """
        moved = 0
        skipped = 0
        errors = 0

        mode_tag = "[DRY RUN] " if dry_run else ""

        for item in classified_files:
            file_meta = item.get("file_metadata", {})
            category = item.get("category", "Miscellaneous")
            src_path = file_meta.get("path", "")
            name = file_meta.get("name", os.path.basename(src_path))

            if not src_path or not os.path.exists(src_path):
                logger.warning("Skipping missing file: %s", src_path)
                skipped += 1
                continue

            target_dir = os.path.join(desktop_path, category)
            target_path = os.path.join(target_dir, name)

            # Avoid moving a file to its own current location
            if os.path.normpath(src_path) == os.path.normpath(target_path):
                logger.debug("Already in place, skipping: %s", src_path)
                skipped += 1
                continue

            logger.info("%sMOVE %s → %s", mode_tag, src_path, target_path)
            log_action(f"{mode_tag}MOVE", src_path, category)

            if dry_run:
                moved += 1  # Count as "would move"
                continue

            try:
                ensure_dir(target_dir)

                # Handle name collisions
                target_path = self._unique_path(target_path)

                shutil.move(src_path, target_path)
                moved += 1
                logger.debug("Moved successfully: %s", name)

            except Exception as exc:
                logger.error("Error moving %s: %s", src_path, exc)
                log_action("ERROR", src_path, category)
                errors += 1

        summary = {"moved": moved, "skipped": skipped, "errors": errors}
        logger.info(
            "Organise complete%s. moved=%d skipped=%d errors=%d",
            " (dry run)" if dry_run else "",
            moved,
            skipped,
            errors,
        )
        return summary

    def preview(
        self,
        classified_files: List[Dict[str, Any]],
        desktop_path: str,
    ) -> List[Dict[str, str]]:
        """
        Returns the list of planned moves without executing any of them.

        Returns:
            List of {name, src, dest, category} dicts.
        """
        planned: List[Dict[str, str]] = []

        for item in classified_files:
            file_meta = item.get("file_metadata", {})
            category = item.get("category", "Miscellaneous")
            src_path = file_meta.get("path", "")
            name = file_meta.get("name", os.path.basename(src_path))
            target_dir = os.path.join(desktop_path, category)
            target_path = os.path.join(target_dir, name)

            planned.append(
                {
                    "name": name,
                    "src": src_path,
                    "dest": target_path,
                    "category": category,
                }
            )

        return planned

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _unique_path(path: str) -> str:
        """
        If `path` already exists, appends a numeric suffix to make it unique.
        E.g. "file.txt" → "file (1).txt"
        """
        if not os.path.exists(path):
            return path

        base, ext = os.path.splitext(path)
        counter = 1
        while True:
            candidate = f"{base} ({counter}){ext}"
            if not os.path.exists(candidate):
                return candidate
            counter += 1
