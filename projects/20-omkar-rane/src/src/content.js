(() => {
  const BUTTON_ID = "pr-writer-btn";
  const OVERLAY_ID = "pr-writer-overlay";
  const BADGE_ID = "pr-writer-badge";
  const WARNING_ID = "pr-writer-warning";

  let currentTextarea = null;
  let overlayEl = null;
  let badgeEl = null;
  let streamActive = false;

  function findPrTextarea() {
    return (
      document.querySelector("#pull_request_body") ||
      document.querySelector('[name="pull_request[body]"]')
    );
  }

  function injectButton() {
    const textarea = findPrTextarea();
    if (!textarea) return;

    // If we've already injected the button, do nothing.
    if (document.getElementById(BUTTON_ID)) {
      return;
    }

    ensureButton(textarea);
  }

  function ensureButton(textarea) {
    if (!textarea) return;

    currentTextarea = textarea;

    let existing = document.getElementById(BUTTON_ID);
    if (existing && existing.parentElement === textarea.parentElement) {
      return;
    }

    if (existing && !existing.isConnected) {
      existing = null;
    }

    const button = existing || document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "✨ Generate PR Description";
    button.style.display = "inline-flex";
    button.style.alignItems = "center";
    button.style.gap = "4px";
    button.style.marginBottom = "6px";
    button.style.padding = "4px 10px";
    button.style.fontSize = "12px";
    button.style.borderRadius = "999px";
    button.style.border = "1px solid rgba(31, 111, 235, 0.6)";
    button.style.background = "rgba(31, 111, 235, 0.08)";
    button.style.color = "#0969da";
    button.style.cursor = "pointer";

    button.onclick = handleGenerateClick;

    const parent = textarea.parentElement;
    if (!parent) return;

    parent.insertBefore(button, textarea);
  }

  function createOverlay(textarea) {
    removeOverlay();

    overlayEl = document.createElement("div");
    overlayEl.id = OVERLAY_ID;
    overlayEl.textContent = "Generating description with GPT…";
    overlayEl.style.position = "absolute";
    overlayEl.style.top = "6px";
    overlayEl.style.right = "10px";
    overlayEl.style.padding = "2px 8px";
    overlayEl.style.fontSize = "11px";
    overlayEl.style.borderRadius = "999px";
    overlayEl.style.background =
      "linear-gradient(90deg, rgba(31,111,235,.12), rgba(56,139,253,.18))";
    overlayEl.style.color = "#0969da";
    overlayEl.style.boxShadow = "0 0 0 1px rgba(9,105,218,0.15)";
    overlayEl.style.zIndex = "10";
    overlayEl.style.animation =
      "pr-writer-pulse 1.4s ease-in-out 0s infinite alternate";

    const container = textarea.closest("div") || textarea.parentElement;
    if (!container) return;

    const originalPosition = getComputedStyle(container).position;
    if (originalPosition === "static" || !originalPosition) {
      container.dataset.prWriterOriginalPosition = originalPosition;
      container.style.position = "relative";
    }

    container.appendChild(overlayEl);

    const styleId = "pr-writer-overlay-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
@keyframes pr-writer-pulse {
  from { opacity: 0.6; transform: translateY(0); }
  to { opacity: 1; transform: translateY(-1px); }
}
`;
      document.head.appendChild(style);
    }
  }

  function removeOverlay() {
    if (overlayEl && overlayEl.parentElement) {
      const container = overlayEl.parentElement;
      overlayEl.remove();
      overlayEl = null;

      if (container.dataset.prWriterOriginalPosition !== undefined) {
        container.style.position = container.dataset.prWriterOriginalPosition;
        delete container.dataset.prWriterOriginalPosition;
      }
    }
  }

  function showEditBadge(textarea) {
    if (!textarea) return;
    if (badgeEl && badgeEl.isConnected) {
      badgeEl.textContent = "✏ Edit mode";
      return;
    }

    badgeEl = document.createElement("span");
    badgeEl.id = BADGE_ID;
    badgeEl.textContent = "✏ Edit mode";
    badgeEl.style.marginLeft = "8px";
    badgeEl.style.fontSize = "11px";
    badgeEl.style.color = "#57606a";
    badgeEl.style.background = "rgba(175,184,193,0.24)";
    badgeEl.style.borderRadius = "999px";
    badgeEl.style.padding = "2px 6px";

    const button = document.getElementById(BUTTON_ID);
    if (button && button.parentElement) {
      button.parentElement.insertBefore(badgeEl, button.nextSibling);
    }
  }

  function showInlineError(textarea, message) {
    if (!textarea) return;
    const id = "pr-writer-error";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.marginTop = "4px";
      el.style.fontSize = "12px";
      el.style.color = "#d1242f";
      textarea.parentElement?.appendChild(el);
    }
    el.textContent = message;
  }

  function showLargePrWarningBanner(filesUsed) {
    const button = document.getElementById(BUTTON_ID);
    if (!button || !button.parentElement) return;

    let banner = document.getElementById(WARNING_ID);
    if (!banner) {
      banner = document.createElement("div");
      banner.id = WARNING_ID;
      banner.style.display = "flex";
      banner.style.alignItems = "center";
      banner.style.justifyContent = "space-between";
      banner.style.gap = "8px";
      banner.style.marginBottom = "6px";
      banner.style.padding = "4px 8px";
      banner.style.fontSize = "11px";
      banner.style.borderRadius = "6px";
      banner.style.background = "#fff8c5";
      banner.style.color = "#3b2300";
      banner.style.border = "1px solid #e3b341";

      const textSpan = document.createElement("span");
      textSpan.id = `${WARNING_ID}-text`;
      banner.appendChild(textSpan);

      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.textContent = "×";
      closeBtn.style.border = "none";
      closeBtn.style.background = "transparent";
      closeBtn.style.color = "inherit";
      closeBtn.style.cursor = "pointer";
      closeBtn.style.fontSize = "12px";
      closeBtn.style.padding = "0 2px";
      closeBtn.addEventListener("click", () => {
        banner.remove();
      });

      banner.appendChild(closeBtn);
      button.parentElement.insertBefore(banner, button);
    }

    const textEl = document.getElementById(`${WARNING_ID}-text`);
    if (textEl) {
      textEl.textContent = `⚠ Large PR detected — generating description from first ${filesUsed} files. Consider splitting this PR.`;
    }
  }

  function extractDomDiff() {
    function getFileContainers() {
      let containers = Array.from(
        document.querySelectorAll("div[data-tagsearch-path]")
      );
      if (containers.length) return containers;

      containers = Array.from(document.querySelectorAll(".file.js-file"));
      if (containers.length) return containers;

      const tables = Array.from(document.querySelectorAll(".diff-table"));
      if (!tables.length) return [];

      const seen = new Set();
      const fallbackContainers = [];

      tables.forEach((table) => {
        const container =
          table.closest("div[data-tagsearch-path], .file.js-file") || table;
        if (!seen.has(container)) {
          seen.add(container);
          fallbackContainers.push(container);
        }
      });

      return fallbackContainers;
    }

    function getFilePath(container) {
      const tagsearchPath = container.getAttribute("data-tagsearch-path");
      if (tagsearchPath) {
        return tagsearchPath.trim();
      }

      const headerWithTitle = container.querySelector(".file-header [title]");
      if (headerWithTitle && headerWithTitle.title) {
        return headerWithTitle.title.trim();
      }

      const infoLink = container.querySelector(".file-info .Link--primary");
      if (infoLink && infoLink.textContent) {
        return infoLink.textContent.trim();
      }

      return "";
    }

    function getCodeText(row) {
      const innerCell = row.querySelector("td.blob-code-inner");
      let sourceCell = innerCell;

      if (!sourceCell) {
        const tds = row.querySelectorAll("td");
        if (tds.length) {
          sourceCell = tds[tds.length - 1];
        }
      }

      if (!sourceCell) return "";

      const text = sourceCell.textContent || "";
      return text.replace(/\s+$/, "");
    }

    const fileContainers = getFileContainers();
    if (!fileContainers.length) return "";

    const lines = [];

    fileContainers.forEach((container) => {
      const filePath = getFilePath(container);
      if (!filePath) return;

      lines.push(`diff --git a/${filePath} b/${filePath}`);
      lines.push(`--- a/${filePath}`);
      lines.push(`+++ b/${filePath}`);

      let tables = Array.from(container.querySelectorAll(".diff-table"));
      if (!tables.length && container.matches(".diff-table")) {
        tables = [container];
      }

      tables.forEach((table) => {
        const rows = Array.from(table.querySelectorAll("tr"));

        rows.forEach((row) => {
          if (
            row.classList.contains("blob-expanded") ||
            row.classList.contains("js-blob-expanded")
          ) {
            return;
          }

          const hasLineNumber = !!row.querySelector(
            ".blob-num[data-line-number]"
          );
          const hunkCell = row.querySelector(
            ".blob-code-hunk, .js-skip-tagsearch"
          );

          let prefix = "";

          if (!hasLineNumber && hunkCell) {
            const raw = getCodeText(row).trim();
            let content = raw || "";
            if (!content.startsWith("@@")) {
              content = `@@ ${content} @@`;
            }
            lines.push(content);
            return;
          }

          if (row.querySelector("td.blob-code-addition")) {
            prefix = "+";
          } else if (row.querySelector("td.blob-code-deletion")) {
            prefix = "-";
          } else if (row.querySelector("td.blob-code-context")) {
            prefix = " ";
          } else {
            return;
          }

          const code = getCodeText(row);
          if (!code) return;

          lines.push(`${prefix}${code}`);
        });
      });
    });

    return lines.join("\n");
  }

  function parseRepoFromLocation() {
    try {
      const url = new URL(window.location.href);
      const path = url.pathname.replace(/^\/+/, "");
      const segments = path.split("/");
      if (segments.length < 4) return "";

      const [owner, repo, type, ...rest] = segments;
      if (type !== "compare" && type !== "pull") return "";

      let base = "";
      let head = "";

      if (type === "compare" && rest[0] && rest[0].includes("...")) {
        [base, head] = rest[0].split("...");
      } else if (type === "pull" && rest[0] === "new" && rest[1]) {
        // /owner/repo/pull/new/base...head
        if (rest[1].includes("...")) {
          [base, head] = rest[1].split("...");
        }
      }

      if (!owner || !repo || !base || !head) return "";
      return { owner, repo, base, head };
    } catch {
      return "";
    }
  }

  async function fetchRepoContext() {
    const repoInfo = parseRepoFromLocation();
    if (!repoInfo) {
      return { source: "none", summary: "" };
    }

    const { owner, repo } = repoInfo;

    const readmeCandidates = ["README.md", "README", "readme.md"];
    const fallbackDocs = [
      "docs/README.md",
      "CONTRIBUTING.md",
      "ARCHITECTURE.md",
      "docs/ARCHITECTURE.md",
    ];
    const MAX_CONTEXT_CHARS = 8000;

    async function fetchText(path) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.github+json",
        },
      });
      if (!res.ok) return "";
      const json = await res.json();
      if (!json || typeof json.content !== "string") return "";
      try {
        return atob(json.content.replace(/\n/g, ""));
      } catch {
        return "";
      }
    }

    for (const path of readmeCandidates) {
      const text = await fetchText(path);
      if (text) {
        return {
          source: path,
          summary: text.slice(0, MAX_CONTEXT_CHARS),
        };
      }
    }

    let fallbackCombined = "";
    for (const path of fallbackDocs) {
      const text = await fetchText(path);
      if (!text) continue;
      fallbackCombined += `\n\n# ${path}\n${text}`;
      if (fallbackCombined.length >= MAX_CONTEXT_CHARS) break;
    }

    if (fallbackCombined) {
      return {
        source: "fallback_docs",
        summary: fallbackCombined.slice(0, MAX_CONTEXT_CHARS),
      };
    }

    return { source: "none", summary: "" };
  }

  async function extractApiDiff() {
    const repoInfo = parseRepoFromLocation();
    if (!repoInfo) return "";
    const { owner, repo, base, head } = repoInfo;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`;
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/vnd.github.v3.diff",
      },
    });
    if (!res.ok) return "";
    return await res.text();
  }

  async function extractDiff() {
    let diff = await extractApiDiff();
    if (!diff.trim()) {
      diff = extractDomDiff();
    }
    return diff || "";
  }

  function parseComprehensiveChangeMap(diffText) {
    const result = {
      files: [],
      totals: {
        filesChanged: 0,
        additions: 0,
        deletions: 0,
      },
    };

    if (!diffText || !diffText.includes("diff --git")) {
      return result;
    }

    const blocks = diffText.split(/^diff --git /m).filter(Boolean);

    blocks.forEach((rawBlock) => {
      const block = `diff --git ${rawBlock}`;
      const lines = block.split("\n");
      const header = lines[0] || "";
      const headerMatch = header.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (!headerMatch) return;

      const fileEntry = {
        oldPath: headerMatch[1],
        newPath: headerMatch[2],
        status: "modified",
        additions: 0,
        deletions: 0,
        hunks: [],
      };

      let currentHunk = null;
      let pendingDeletion = null;

      for (const line of lines.slice(1)) {
        if (line.startsWith("new file mode")) fileEntry.status = "added";
        if (line.startsWith("deleted file mode")) fileEntry.status = "deleted";
        if (line.startsWith("rename from ")) {
          fileEntry.status = "renamed";
          fileEntry.oldPath = line.replace("rename from ", "").trim();
        }
        if (line.startsWith("rename to ")) {
          fileEntry.newPath = line.replace("rename to ", "").trim();
        }

        if (line.startsWith("@@")) {
          currentHunk = {
            header: line,
            additions: 0,
            deletions: 0,
            modifications: [],
          };
          fileEntry.hunks.push(currentHunk);
          pendingDeletion = null;
          continue;
        }

        if (!currentHunk) continue;

        if (/^\+(?!\+\+\+)/.test(line)) {
          currentHunk.additions += 1;
          fileEntry.additions += 1;
          if (pendingDeletion) {
            currentHunk.modifications.push({
              from: pendingDeletion,
              to: line.slice(1),
            });
            pendingDeletion = null;
          }
          continue;
        }

        if (/^-(?!---)/.test(line)) {
          currentHunk.deletions += 1;
          fileEntry.deletions += 1;
          pendingDeletion = line.slice(1);
          continue;
        }

        pendingDeletion = null;
      }
      result.files.push(fileEntry);
      result.totals.additions += fileEntry.additions;
      result.totals.deletions += fileEntry.deletions;
    });

    result.totals.filesChanged = result.files.length;
    return result;
  }

  function parseDiffMeta(diffText) {
    const filesChangedSet = new Set();
    let additions = 0;
    let deletions = 0;

    if (!diffText) {
      return {
        filesChanged: [],
        additions: 0,
        deletions: 0,
        likelyType: "mixed",
      };
    }

    const lines = diffText.split("\n");
    const hasUnifiedHunks = lines.some((line) => line.startsWith("@@"));

    const diffHeaderRegex = /^diff --git a\/(.+?) b\//;

    let inHunk = false;

    lines.forEach((line) => {
      const headerMatch = line.match(diffHeaderRegex);
      if (headerMatch && headerMatch[1]) {
        filesChangedSet.add(headerMatch[1]);
      }

      if (line.startsWith("diff --git ")) {
        inHunk = false;
        return;
      }

      if (line.startsWith("@@")) {
        inHunk = true;
        return;
      }

      if (!inHunk && hasUnifiedHunks) return;

      if (/^\+(?!\+\+\+)/.test(line)) {
        additions += 1;
      } else if (/^-(?!---)/.test(line)) {
        deletions += 1;
      }
    });

    const filesChanged = Array.from(filesChangedSet);

    const lowerFiles = filesChanged.map((f) => f.toLowerCase());

    let likelyType = "mixed";

    if (lowerFiles.some((f) => /test|spec|__tests__/.test(f))) {
      likelyType = "test";
    } else if (
      lowerFiles.some((f) =>
        /readme|changelog|\.md$|docs?\//.test(f)
      )
    ) {
      likelyType = "docs";
    } else if (
      lowerFiles.some((f) =>
        /\.config\.|webpack|vite|rollup|tsconfig|\.env/i.test(f)
      )
    ) {
      likelyType = "config";
    } else {
      const total = additions + deletions;
      const deletionRatio = total > 0 ? deletions / total : 0;

      if (additions > 0 && deletions === 0) {
        likelyType = "feature";
      } else if (deletions > 0 && additions <= deletions * 0.4) {
        likelyType = "bugfix";
      } else if (total > 0 && deletionRatio > 0.6 && additions < 30) {
        likelyType = "refactor";
      } else if (additions > 0 && deletions > 0) {
        likelyType = "refactor";
      }
    }

    return {
      filesChanged,
      additions,
      deletions,
      likelyType,
    };
  }

  async function handleGenerateClick() {
    if (streamActive) return;
    const textarea = findPrTextarea();
    if (!textarea) return;

    const diffText = await extractDiff();
    const diffMeta = parseDiffMeta(diffText);
    const changeMap = parseComprehensiveChangeMap(diffText);
    const repoContext = await fetchRepoContext();
    if (!diffText.trim()) {
      showInlineError(
        textarea,
        "Could not detect any diff. Make sure you're on a compare or new pull request page with changes."
      );
      return;
    }

    streamActive = true;
    textarea.value = "";
    createOverlay(textarea);

    let SYSTEM_PROMPT_VALUE = "";
    let selectedTemplate = "team";
    let userPrompt = "";
    const MAX_PROMPT_DIFF_CHARS = 60000;
    const promptDiff = diffText.slice(0, MAX_PROMPT_DIFF_CHARS);
    const promptDiffTruncated = diffText.length > MAX_PROMPT_DIFF_CHARS;
    if (promptDiffTruncated) {
      showLargePrWarningBanner(changeMap.totals.filesChanged || 1);
    }

    const stored = await new Promise((resolve) =>
      chrome.storage.local.get("TEMPLATE", (r) => resolve(r))
    );
    selectedTemplate = stored.TEMPLATE || "team";

    try {
      const mod = await import(chrome.runtime.getURL("src/prompt.js"));
      const { SYSTEM_PROMPT, buildUserPrompt } = mod;
      SYSTEM_PROMPT_VALUE = SYSTEM_PROMPT;
      userPrompt = buildUserPrompt(promptDiff, selectedTemplate, diffMeta, {
        repoContext,
        changeMap,
        promptDiffTruncated,
      });
    } catch (err) {
      SYSTEM_PROMPT_VALUE =
        "You are an AI assistant that writes concise, markdown-formatted PR descriptions.";
      userPrompt = diffText;
    }

    const systemPrompt = SYSTEM_PROMPT_VALUE;

    chrome.runtime.sendMessage(
      {
        type: "GENERATE_DESCRIPTION",
        diff: diffText,
        template: selectedTemplate,
        system: systemPrompt,
        systemPrompt,
        prompt: userPrompt,
        userPrompt,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showInlineError(
            textarea,
            `Error talking to extension: ${chrome.runtime.lastError.message}`
          );
          removeOverlay();
          streamActive = false;
          return;
        }

        if (response && response.error === "NO_KEY") {
          showInlineError(
            textarea,
            "⚙ Add your OpenAI API key in the extension popup first."
          );
          removeOverlay();
          streamActive = false;
          return;
        }
      }
    );
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!currentTextarea) return;

    if (message.type === "STREAM_CHUNK") {
      currentTextarea.value += message.text;
    } else if (message.type === "STREAM_DONE") {
      removeOverlay();
      streamActive = false;
      currentTextarea.focus();
      showEditBadge(currentTextarea);
    } else if (message.type === "STREAM_ERROR") {
      removeOverlay();
      streamActive = false;
      showInlineError(
        currentTextarea,
        message.message || "Unexpected error while generating description."
      );
    }
  });

  const observer = new MutationObserver(() => {
    // Handle GitHub SPA-style navigation where the PR textarea is added/removed
    // without a full page reload.
    injectButton();
  });

  function init() {
    // Initial check on page load.
    injectButton();

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();


