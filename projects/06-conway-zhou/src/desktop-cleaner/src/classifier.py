"""
LLM-based file classifier using Google Gemini.
"""
import os
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Maps file extensions to a human-readable category folder name.
# Files with unrecognised extensions fall back to "Other Files".
EXTENSION_CATEGORIES: Dict[str, str] = {
    # Documents
    ".pdf":  "Documents", ".doc": "Documents", ".docx": "Documents",
    ".txt":  "Documents", ".rtf": "Documents", ".odt":  "Documents",
    ".xls":  "Documents", ".xlsx": "Documents", ".csv": "Documents",
    ".ppt":  "Documents", ".pptx": "Documents", ".odp": "Documents",
    ".md":   "Documents",
    # Images
    ".jpg":  "Images", ".jpeg": "Images", ".png":  "Images",
    ".gif":  "Images", ".bmp":  "Images", ".webp": "Images",
    ".svg":  "Images", ".ico":  "Images", ".tiff": "Images", ".raw": "Images",
    # Videos
    ".mp4":  "Videos", ".mkv": "Videos", ".avi":  "Videos",
    ".mov":  "Videos", ".wmv": "Videos", ".flv":  "Videos", ".webm": "Videos",
    # Audio
    ".mp3":  "Audio", ".wav": "Audio", ".flac": "Audio",
    ".aac":  "Audio", ".ogg": "Audio", ".m4a":  "Audio",
    # Archives
    ".zip":  "Archives", ".rar": "Archives", ".7z":  "Archives",
    ".tar":  "Archives", ".gz":  "Archives", ".iso": "Archives",
    # Executables & Installers
    ".exe":  "Programs", ".msi": "Programs", ".bat": "Programs",
    ".cmd":  "Programs", ".ps1": "Programs",
    # Shortcuts
    ".lnk":  "Shortcuts", ".url": "Shortcuts",
    # Code & Dev
    ".py":   "Code", ".js":   "Code", ".ts":  "Code", ".html": "Code",
    ".css":  "Code", ".json": "Code", ".xml": "Code", ".yaml": "Code",
    ".yml":  "Code", ".sh":   "Code", ".cpp": "Code", ".c":    "Code",
    ".java": "Code", ".cs":   "Code",
}


class LLMClassifier:
    """
    Classifies desktop files into categories.

    Two-pass approach:
        Pass 1 — LLM checks whether any user-defined category fits the file.
        Pass 2 — extension-based fallback (no API call needed).
    """

    MODEL = "llama3.2"

    # System prompts
    _PASS1_SYSTEM = (
        "You are a file organiser. Given a list of filenames and user-defined categories, "
        "match each file to the best category using your knowledge of software, games, "
        "applications, and file types. Be confident — game launchers, game shortcuts, "
        "game clients, and game-related tools all belong to a Games category if one exists. "
        "Assign NONE only if no category clearly fits."
    )
    _PASS2_SYSTEM = (
        "You are a file classifier. Given a filename, return ONLY a short category name "
        "(2-3 words max) describing what type of software or file this is. Examples: "
        "Games, Editing Tools, Browsers, Documents, Images, Development Tools, Utilities. "
        "Return only the category name, nothing else."
    )

    def __init__(self):
        logger.info("LLMClassifier ready (model: %s)", self.MODEL)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def classify_files(
        self,
        file_list: List[Dict[str, Any]],
        user_categories: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Batch-classifies all files in two API calls total (one per pass).

        Args:
            file_list: List of file metadata dicts (from DesktopScanner).
            user_categories: List of user-defined category names.

        Returns:
            List of dicts: {file_metadata, category, pass_number}
        """
        results: List[Dict[str, Any]] = []
        unmatched: List[Dict[str, Any]] = []

        # --- Pass 1: match all files against user categories in one call ---
        if user_categories:
            pass1_map = self._pass1_classify_batch(
                [f["name"] for f in file_list], user_categories
            )
        else:
            pass1_map = {}

        for file_meta in file_list:
            category = pass1_map.get(file_meta["name"], "NONE")
            if category and category.upper() != "NONE":
                results.append({
                    "file_metadata": file_meta,
                    "category": category,
                    "pass_number": 1,
                })
                logger.debug("Pass 1 matched '%s' → '%s'", file_meta["name"], category)
            else:
                unmatched.append(file_meta)

        # --- Pass 2: extension-based fallback (no API call) ---
        for file_meta in unmatched:
            category = self._classify_by_extension(
                file_meta.get("extension", ""),
                file_meta["name"],
            )
            results.append({
                "file_metadata": file_meta,
                "category": category,
                "pass_number": 2,
            })
            logger.debug("Pass 2 (extension) classified '%s' → '%s'", file_meta["name"], category)

        return results

    def classify_single_file(
        self,
        file_metadata: Dict[str, Any],
        user_categories: List[str],
    ) -> Dict[str, Any]:
        """
        Classifies a single file.

        Returns:
            Dict: {file_metadata, category, pass_number}
        """
        if user_categories:
            category = self._pass1_classify(file_metadata["name"], user_categories)
        else:
            category = "NONE"

        if category and category.upper() != "NONE":
            return {"file_metadata": file_metadata, "category": category, "pass_number": 1}

        category = self._classify_by_extension(
            file_metadata.get("extension", ""), file_metadata["name"]
        )
        return {"file_metadata": file_metadata, "category": category, "pass_number": 2}

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _call_llm_raw(self, prompt: str) -> str:
        """
        Calls the local Ollama model with a fully-formed prompt.
        Returns the text response stripped of whitespace, or "" on error.
        """
        try:
            import ollama
            response = ollama.generate(model=self.MODEL, prompt=prompt)
            return response.response.strip()
        except Exception as exc:
            logger.error("LLM API call failed: %s", exc)
            return ""

    def _pass1_classify_batch(self, filenames: List[str], categories: List[str]) -> Dict[str, str]:
        """
        Sends all filenames to the LLM in one call for Pass 1.
        Returns a dict mapping filename → matched category (or "NONE").
        """
        categories_str = ", ".join(categories)
        filenames_str = "\n".join(f"- {name}" for name in filenames)
        prompt = (
            f"{self._PASS1_SYSTEM}\n\n"
            f"Categories: {categories_str}\n\n"
            f"For each filename below, output exactly one line using this format:\n"
            f"filename | category\n\n"
            f"Example:\n"
            f"game.exe | Games\n"
            f"notes.txt | NONE\n\n"
            f"Use NONE if no category fits. Output only the lines, nothing else.\n\n"
            f"Filenames:\n{filenames_str}"
        )
        raw = self._call_llm_raw(prompt)
        logger.info("LLM raw response:\n%s", raw)
        return self._parse_batch_response(raw, filenames, "NONE")

    def _pass1_classify(self, filename: str, categories: List[str]) -> str:
        """Single-file Pass 1 (used by classify_single_file)."""
        result = self._pass1_classify_batch([filename], categories)
        return result.get(filename, "NONE")

    @staticmethod
    def _classify_by_extension(extension: str, filename: str) -> str:
        """
        Returns a category name based on the file extension.
        Falls back to 'Other Files' for unrecognised extensions.
        """
        ext = extension.lower() if extension else os.path.splitext(filename)[1].lower()
        return EXTENSION_CATEGORIES.get(ext, "Other Files")

    @staticmethod
    def _parse_batch_response(
        raw: str, filenames: List[str], fallback: str
    ) -> Dict[str, str]:
        """
        Parses the LLM's batch response (one "filename | category" line per file).
        Handles both "filename | category" and "category | filename" orderings.
        Falls back gracefully if the LLM returns unexpected formatting.
        """
        result = {name: fallback for name in filenames}
        if not raw:
            return result

        filenames_lower = {f.lower(): f for f in filenames}

        for line in raw.splitlines():
            line = line.strip().lstrip("-• ").strip()
            if "|" not in line:
                continue
            parts = line.split("|", 1)
            left = parts[0].strip()
            right = parts[1].strip() if len(parts) > 1 else fallback

            # Try left as filename, then right as filename
            if left.lower() in filenames_lower:
                original = filenames_lower[left.lower()]
                result[original] = right if right else fallback
            elif right.lower() in filenames_lower:
                original = filenames_lower[right.lower()]
                result[original] = left if left else fallback

        return result
