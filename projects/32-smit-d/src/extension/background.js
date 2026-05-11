const LUCENT_BACKEND_URL = "http://localhost:8000/analyze";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "ANALYZE_LISTING") {
    return false;
  }

  fetch(LUCENT_BACKEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message.payload)
  })
    .then(async (response) => {
      const contentType = response.headers.get("content-type") || "";
      const payload = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      if (!response.ok) {
        const detail =
          typeof payload === "object" && payload !== null
            ? payload.detail || JSON.stringify(payload)
            : payload;
        throw new Error(detail || `Backend request failed with status ${response.status}`);
      }

      return payload;
    })
    .then((data) => {
      sendResponse({ ok: true, data });
    })
    .catch((error) => {
      console.error("[Lucent] Backend request failed", error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});
