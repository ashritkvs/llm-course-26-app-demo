"""
Deletion checker — flags files that haven't been accessed recently.
"""
import logging
from datetime import datetime
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class DeletionChecker:
    """
    Inspects file metadata and flags items that haven't been accessed
    within the configured age threshold.
    """

    def check_files(
        self,
        file_list: List[Dict[str, Any]],
        age_threshold_days: int = 90,
    ) -> List[Dict[str, Any]]:
        """
        Checks each file's last_accessed date and flags stale files.

        Args:
            file_list: List of file metadata dicts (from DesktopScanner).
            age_threshold_days: Number of days since last access before a file
                                is considered a deletion candidate.

        Returns:
            List of dicts for ALL files, each containing:
                file_metadata        – original metadata dict
                days_since_access    – int (or None if date unavailable)
                flagged_for_deletion – True if days_since_access > threshold
        """
        now = datetime.now()
        results: List[Dict[str, Any]] = []

        for file_meta in file_list:
            last_accessed = file_meta.get("last_accessed")
            days_since_access = None
            flagged = False

            if last_accessed is not None:
                try:
                    # Ensure we have a naive datetime for comparison
                    if hasattr(last_accessed, "tzinfo") and last_accessed.tzinfo is not None:
                        # Convert aware datetime to naive local time
                        from datetime import timezone
                        last_accessed_naive = last_accessed.astimezone(tz=None).replace(tzinfo=None)
                    else:
                        last_accessed_naive = last_accessed

                    delta = now - last_accessed_naive
                    days_since_access = delta.days
                    flagged = days_since_access > age_threshold_days

                    if flagged:
                        logger.debug(
                            "Flagged for deletion: %s (last accessed %d days ago)",
                            file_meta.get("name"),
                            days_since_access,
                        )
                except Exception as exc:
                    logger.warning(
                        "Could not compute age for %s: %s",
                        file_meta.get("name"),
                        exc,
                    )

            results.append(
                {
                    "file_metadata": file_meta,
                    "days_since_access": days_since_access,
                    "flagged_for_deletion": flagged,
                }
            )

        flagged_count = sum(1 for r in results if r["flagged_for_deletion"])
        logger.info(
            "Deletion check complete. %d / %d files flagged (threshold: %d days).",
            flagged_count,
            len(results),
            age_threshold_days,
        )
        return results
