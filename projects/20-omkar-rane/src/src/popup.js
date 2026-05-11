document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveBtn");
  const clearLink = document.getElementById("clearLink");
  const templateSelect = document.getElementById("templateSelect");
  const statusEl = document.getElementById("status");

  function setStatus(message, type) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("ok", "error");
    if (type) {
      statusEl.classList.add(type);
    }
  }

  // Load saved values
  chrome.storage.local.get(
    ["OPENAI_API_KEY", "TEMPLATE"],
    (result) => {
      if (chrome.runtime.lastError) {
        setStatus(
          `Error loading settings: ${chrome.runtime.lastError.message}`,
          "error"
        );
        return;
      }

      if (result.OPENAI_API_KEY) {
        apiKeyInput.value = result.OPENAI_API_KEY;
      }
      if (result.TEMPLATE) {
        templateSelect.value = result.TEMPLATE;
      }
    }
  );

  saveBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      setStatus("Please enter an API key.", "error");
      return;
    }
    if (!key.startsWith("sk-")) {
      setStatus("Invalid key: expected to start with \"sk-\".", "error");
      return;
    }

    chrome.storage.local.set(
      { OPENAI_API_KEY: key },
      () => {
        if (chrome.runtime.lastError) {
          setStatus(
            `Error saving key: ${chrome.runtime.lastError.message}`,
            "error"
          );
          return;
        }
        setStatus("Key saved!", "ok");
      }
    );
  });

  clearLink.addEventListener("click", (e) => {
    e.preventDefault();
    apiKeyInput.value = "";
    chrome.storage.local.remove("OPENAI_API_KEY", () => {
      if (chrome.runtime.lastError) {
        setStatus(
          `Error clearing key: ${chrome.runtime.lastError.message}`,
          "error"
        );
        return;
      }
      setStatus("Key cleared.", "ok");
    });
  });

  templateSelect.addEventListener("change", () => {
    const value = templateSelect.value;
    chrome.storage.local.set({ TEMPLATE: value }, () => {
      if (chrome.runtime.lastError) {
        setStatus(
          `Error saving template: ${chrome.runtime.lastError.message}`,
          "error"
        );
        return;
      }
      setStatus(`Template set to "${value}".`, "ok");
    });
  });
});

