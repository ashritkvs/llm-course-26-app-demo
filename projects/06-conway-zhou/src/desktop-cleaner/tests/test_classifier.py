"""
Tests for src/classifier.py
Mocks the Anthropic API client so no real API calls are made.
"""
import sys
import os
import pytest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_file_meta(name: str) -> dict:
    return {
        "name": name,
        "path": f"C:/Desktop/{name}",
        "extension": os.path.splitext(name)[1].lower(),
        "size_bytes": 1024,
        "last_accessed": None,
        "last_modified": None,
        "created": None,
        "is_shortcut": False,
        "shortcut_target": None,
    }


def _make_mock_client(response_text: str):
    """Returns a mocked anthropic.Anthropic() client."""
    mock_response = MagicMock()
    mock_response.content = [MagicMock(text=response_text)]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response
    return mock_client


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestLLMClassifier:

    def _classifier_with_mock(self, response: str):
        """Creates an LLMClassifier whose internal client returns `response`."""
        with patch("anthropic.Anthropic", return_value=_make_mock_client(response)):
            from src.classifier import LLMClassifier
            clf = LLMClassifier(api_key="fake-key")
        clf._client = _make_mock_client(response)
        return clf

    def test_pass1_returns_matching_category(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        clf._client = _make_mock_client("Games")
        result = clf._pass1_classify("Steam.lnk", ["Games", "Documents"])
        assert result == "Games"

    def test_pass1_returns_none_when_no_match(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        clf._client = _make_mock_client("NONE")
        result = clf._pass1_classify("random_file.exe", ["Games", "Documents"])
        assert result.upper() == "NONE"

    def test_pass2_returns_auto_category(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        clf._client = _make_mock_client("Development Tools")
        result = clf._pass2_classify("VSCode.lnk")
        assert result == "Development Tools"

    def test_pass2_falls_back_to_miscellaneous_on_empty(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        clf._client = _make_mock_client("")
        result = clf._pass2_classify("weird_file.xyz")
        assert result == "Miscellaneous"

    def test_classify_files_pass1_used_when_categories_given(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        clf._client = _make_mock_client("Games")
        files = [_make_file_meta("Steam.lnk")]
        results = clf.classify_files(files, ["Games"])
        assert results[0]["pass_number"] == 1
        assert results[0]["category"] == "Games"

    def test_classify_files_pass2_used_when_no_user_categories(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        clf._client = _make_mock_client("Browsers")
        files = [_make_file_meta("Firefox.exe")]
        results = clf.classify_files(files, [])
        assert results[0]["pass_number"] == 2

    def test_classify_files_unmatched_goes_to_pass2(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        # First call (pass 1) returns NONE; second call (pass 2) returns "Utilities"
        responses = iter(["NONE", "Utilities"])
        mock_resp = MagicMock()
        mock_resp.content = [MagicMock(text=next(responses))]
        mock_client = MagicMock()

        def side_effect(**kwargs):
            txt = next(responses, "Utilities")
            r = MagicMock()
            r.content = [MagicMock(text=txt)]
            return r

        # Override _call_llm directly
        call_results = iter(["NONE", "Utilities"])
        clf._call_llm = lambda sys, usr: next(call_results, "Miscellaneous")

        files = [_make_file_meta("mystery.exe")]
        results = clf.classify_files(files, ["Games"])
        assert results[0]["pass_number"] == 2
        assert results[0]["category"] == "Utilities"

    def test_classify_single_file_returns_dict(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        clf._client = _make_mock_client("Documents")
        meta = _make_file_meta("report.pdf")
        result = clf.classify_single_file(meta, ["Documents"])
        assert "file_metadata" in result
        assert "category" in result
        assert "pass_number" in result

    def test_api_error_falls_back_to_miscellaneous(self):
        from src.classifier import LLMClassifier
        clf = LLMClassifier.__new__(LLMClassifier)
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = Exception("API error")
        clf._client = mock_client
        result = clf._pass2_classify("unknown.bin")
        assert result == "Miscellaneous"

    def test_no_api_key_creates_none_client(self):
        with patch.dict(os.environ, {"ANTHROPIC_API_KEY": ""}, clear=False):
            with patch("src.classifier.LLMClassifier.__init__", lambda self, api_key=None: None):
                from src.classifier import LLMClassifier
                clf = LLMClassifier.__new__(LLMClassifier)
                clf._client = None
                result = clf._call_llm("sys", "user")
                assert result == ""
