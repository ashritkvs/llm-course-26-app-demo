const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4.1-mini";

const textDecoder = new TextDecoder("utf-8");

function getApiKey() {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.get("OPENAI_API_KEY", (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        resolve(result.OPENAI_API_KEY || null);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function sendStreamMessage(tabId, payload) {
  if (tabId == null) return;
  try {
    chrome.tabs.sendMessage(tabId, payload, () => {
      // Ignore errors from closed/unreachable tabs.
      void chrome.runtime.lastError;
    });
  } catch (err) {
    // Swallow send errors in service worker context.
  }
}

async function streamOpenAI({ apiKey, system, userContent, tabId }) {
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1800,
      stream: true,
      messages: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const reader = response.body.getReader();
  let buffer = "";

  try {
    // Basic SSE parsing loop: chunks separated by double newlines, `data:` lines contain JSON payloads.
    // We only care about chat completion delta chunks from OpenAI.
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += textDecoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;

          const dataStr = trimmed.slice("data:".length).trim();
          if (!dataStr) continue;
          if (dataStr === "[DONE]") {
            // Stream finished.
            continue;
          }

          let parsed;
          try {
            parsed = JSON.parse(dataStr);
          } catch {
            continue;
          }

          const choice = parsed.choices && parsed.choices[0];
          const delta = choice && choice.delta;
          const chunkText =
            delta && typeof delta.content === "string"
              ? delta.content
              : Array.isArray(delta?.content)
              ? delta.content
                  .map((c) => (typeof c.text === "string" ? c.text : ""))
                  .join("")
              : "";

          if (chunkText) {
            sendStreamMessage(tabId, {
              type: "STREAM_CHUNK",
              text: chunkText,
            });
          }
        }
      }
    }
  } finally {
    sendStreamMessage(tabId, { type: "STREAM_DONE" });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "GENERATE_DESCRIPTION") {
    return;
  }

  const tabId = sender.tab && sender.tab.id;

  (async () => {
    try {
      const apiKey = await getApiKey();

      if (!apiKey) {
        sendResponse({ error: "NO_KEY" });
        return;
      }

      // Acknowledge that streaming has started; actual content is sent via `chrome.tabs.sendMessage`.
      sendResponse({ ok: true });

      await streamOpenAI({
        apiKey,
        system: message.system,
        userContent: message.prompt,
        tabId,
      });
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error(String(err ?? "Unknown error"));

      if (tabId != null) {
        sendStreamMessage(tabId, {
          type: "STREAM_ERROR",
          message: error.message,
        });
      }
    }
  })();

  // Keep the message channel open for the async work.
  return true;
});


