# PR Description Writer

A **Chrome extension** (Manifest V3) that turns a GitHub compare or “new pull request” view into a **draft PR description** by reading the **git diff**, enriching it with **repository context** (README-first via the GitHub API), and calling the **OpenAI Chat Completions API** with streaming. The generated markdown is written live into the PR description field so you can edit before submitting.

## Features

- **One-click generation** — Injects **“✨ Generate PR Description”** above the PR body on supported GitHub URLs.
- **Robust diff sourcing** — Prefers the [compare API](https://docs.github.com/en/rest/commits/commits#compare-two-commits) (`Accept: application/vnd.github.v3.diff`); falls back to parsing the diff rendered in the page if needed.
- **Structured prompting** — Supplies a parsed diff summary, a per-file change map, and optional README/docs excerpts to reduce omissions and vague summaries.
- **Templates** — **minimal**, **team** (default), and **oss** styles, configurable from the extension popup.
- **Streaming output** — Text appears incrementally in the textarea while the model responds.
- **Large PR guardrails** — Very large diffs are truncated for the prompt, with an on-page warning when truncation applies.

## Requirements

- **Google Chrome** (or another Chromium browser that supports unpacked extensions).
- A valid **OpenAI API key** with access to the configured model (`gpt-4.1-mini` in `src/background.js`).
- A GitHub repository where you can open:
  - Compare: `https://github.com/<owner>/<repo>/compare/...`
  - New PR: `https://github.com/<owner>/<repo>/pull/new/...`

Ensure the `icons/` directory contains `icon16.png`, `icon48.png`, and `icon128.png` as referenced in `manifest.json` (add assets if they are missing, or Chrome may report load errors).

## Setting up Chrome (end-to-end)

Follow these steps once per machine to run the project from source through a real GitHub PR draft.

### 1. Get the code

Clone or download this repository and note the **folder that contains `manifest.json`** — that directory is your **extension root**. You do not need `npm install` for the browser workflow unless you are running the optional `test:diff` script (see below).

### 2. Icons

`manifest.json` references `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`. If those files are missing, add PNGs with those names under an `icons/` folder at the extension root. Chrome may refuse to load the extension or show broken toolbar icons without them.

### 3. OpenAI API access

Create or copy an [OpenAI API key](https://platform.openai.com/api-keys) that can call the Chat Completions API. The extension expects keys that start with `sk-` (as validated in the popup). Usage is billed to your OpenAI account. The model is set in `src/background.js` (`gpt-4.1-mini` by default).

### 4. Load the unpacked extension in Chrome

1. Open **Google Chrome**.
2. In the address bar, go to `chrome://extensions`.
3. Turn **Developer mode** **on** (toggle in the top-right on recent Chrome versions).
4. Click **Load unpacked**.
5. In the file picker, select the **extension root** folder (the one that contains `manifest.json`), then confirm.

Chrome should list **PR Description Writer** with version `1.0.0`. If load fails, read the red error text on the card — it usually points to a bad path, a JSON typo in `manifest.json`, or missing icon files.

**Optional:** Click the puzzle icon in the toolbar → **PR Description Writer** → **pin** so the icon stays visible for quick access to settings.

### 5. Configure the extension

1. Click the **PR Description Writer** toolbar icon to open the popup.
2. Paste your **OpenAI API key** and click **Save Key**. You should see **Key saved!** in green. The key is stored in `chrome.storage.local` only on this browser profile.
3. Choose a **Template** (**minimal**, **team**, or **oss**). Changing the dropdown saves immediately; **team** is the default if you never set one.

To remove the key from this profile, click **Clear** in the popup.

### 6. Run through GitHub

1. **Push a branch** to a GitHub repository you can open in the browser (fork or your own repo is fine).
2. Open one of these pages (the content script only runs on these patterns):
   - **Compare:** `https://github.com/<owner>/<repo>/compare/<base>...<head>` (or the compare UI GitHub shows when you pick two branches).
   - **New pull request:** `https://github.com/<owner>/<repo>/pull/new/<base>...<head>`.

   You need the **pull request description** textarea visible (the same page where you would type the PR body before creating the PR).

3. Above the description box you should see **✨ Generate PR Description**. Click it once.
4. The extension fetches the diff (API first, DOM fallback), shows a short **generating** overlay, then **streams** markdown into the textarea. When it stops, edit the text, add links or reviewer notes, then create or update the PR as you normally would.

### 7. Troubleshooting

| Symptom | What to try |
|--------|-------------|
| No **Generate** button | Confirm the URL is a **compare** or **pull/new** page on `github.com`, refresh, or navigate away and back (GitHub is a SPA). |
| Red text: add API key in the popup | Open the popup, save a valid `sk-...` key. |
| OpenAI / network errors | Check billing and key permissions on OpenAI; confirm no corporate proxy blocks `api.openai.com`. |
| Empty or wrong diff | Ensure the compare actually has commits; for private repos, stay logged into GitHub in the same browser. |
| Yellow **large PR** banner | The raw diff was truncated for the prompt; consider splitting the PR or editing the draft to mention anything not fully shown. |

No build step is required: the extension loads plain HTML, CSS, and JavaScript from this repo as-is.

## Project layout

| Path | Role |
|------|------|
| `manifest.json` | Extension metadata, permissions, content script matches, CSP |
| `src/background.js` | OpenAI streaming request and message relay to the tab |
| `src/content.js` | UI injection, diff extraction, GitHub API context, messaging |
| `src/prompt.js` | System prompt, templates, and `buildUserPrompt` |
| `src/popup.html` / `src/popup.js` | Settings UI |
| `styles/content.css` | Content script styles (may be minimal) |
| `scripts/test-diff-workflow.cjs` | Local sanity checks for diff parsing and prompt structure |

## Local development: diff workflow test

The extension does not require Node to run in the browser. To exercise diff parsing and prompt assembly offline:

```bash
npm install
npm run test:diff
```

This runs `scripts/test-diff-workflow.cjs`, which loads helpers from `src/content.js` and `src/prompt.js` and prints a small report. The `canvas` package is listed in `package.json` but is not used by the browser extension bundle.

## Permissions (why they exist)

- **storage** — Save API key and template.
- **activeTab** / **scripting** — Interact with the current GitHub tab as needed.
- **Host access** — `github.com` and `api.github.com` for diffs and repo files; `api.openai.com` for the model.

## Security and privacy

- Your **API key** is stored locally in the browser profile via Chrome’s extension storage; it is not sent anywhere except to **OpenAI** as the `Authorization` header.
- **Diff content** and any fetched README snippets are sent to OpenAI as part of the chat request. Review your org’s policies before use on private code.

## License

See `package.json` (`license` field) unless you add a dedicated license file.
