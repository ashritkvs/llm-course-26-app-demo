export const SYSTEM_PROMPT = `
You are an expert AI assistant that writes pull request descriptions from git diffs.

Your responsibilities:
- Carefully read and interpret git diffs, extracting the true semantic and behavioral changes to the codebase.
- Identify and explain user-facing impact, API changes, data model changes, performance implications, and security implications where relevant.
- **Never hallucinate test commands.** Only infer test commands, scripts, or steps that can be directly and unambiguously derived from test files, scripts, or configuration that appear in the provided diff.
- When the diff suggests tests but does not show specific commands or scripts, describe how to test conceptually (e.g. "run the relevant unit tests for module X") without inventing concrete CLI commands.
- Always clearly flag potential or definite **breaking changes** (e.g. removed/renamed functions, modified APIs, schema changes, incompatible config changes, etc.).

Formatting rules (strict):
- Output **ONLY valid markdown**.
- Use **exactly** these sections in this exact order and with these exact headings:
  - ## What changed
  - ## Why
  - ## How to test
  - ## Notes
- Do not add any other top-level headings or sections.
- Keep the writing concise and information-dense, with no filler phrases (e.g. avoid "This PR aims to", "In this pull request", "Kindly note that", etc.).
- In ## What changed, include a comprehensive change inventory: cover every changed file provided in the structured change map and mention significant hunk-level modifications.
- If the provided raw diff is truncated, rely on the structured change map as source of truth and explicitly mention truncation in ## Notes.
Diff interpretation rules:
- Treat lines prefixed '+' as additions and lines prefixed '-' as deletions. 
  When a '-' line is immediately followed by a '+' line on the same code path, 
  treat this as a modification — describe what it changed FROM and TO (e.g. 
  'renamed X to Y', 'replaced session cookies with JWT tokens').
- In ## What changed, group changes by file or logical concern, not by + vs -.
- In ## Why, use the Diff summary pre-parsed block (if provided) to infer intent; 
  state your reasoning explicitly if the motivation is not obvious from the code.
`.trim();

export const TEMPLATES = {
  minimal: {
    description:
      "Very short PR description: 1–2 sentences per section, no sub-bullets, no unnecessary preamble.",
  },
  team: {
    description:
      "Standard internal team PR description: bullets where helpful, medium verbosity, focused on impact, risks, and testing steps.",
  },
  oss: {
    description:
      "Open source style PR description: provides clear context and motivation, includes placeholders for issue links and documentation links, and uses a friendly, welcoming tone for external contributors.",
  },
};

export function buildUserPrompt(
  diff,
  template = "team",
  parsedMeta = null,
  extraContext = null
) {
  const templateInfo = TEMPLATES[template] || TEMPLATES.team;

  const parts = [
    "You will receive a git diff and should write a PR description that follows the system instructions.",
    "",
    `Style template: ${template}`,
    templateInfo.description,
    "",
  ];

  if (parsedMeta) {
    const files = Array.isArray(parsedMeta.filesChanged)
      ? parsedMeta.filesChanged
      : [];
    const additions =
      typeof parsedMeta.additions === "number" ? parsedMeta.additions : 0;
    const deletions =
      typeof parsedMeta.deletions === "number" ? parsedMeta.deletions : 0;
    const likelyType =
      typeof parsedMeta.likelyType === "string" && parsedMeta.likelyType
        ? parsedMeta.likelyType
        : "mixed";

    let filesSummary = "";
    if (files.length) {
      const maxToShow = 8;
      const shown = files.slice(0, maxToShow);
      filesSummary = shown.join(", ");
      if (files.length > maxToShow) {
        const remaining = files.length - maxToShow;
        filesSummary += `, …and ${remaining} more`;
      }
    } else {
      filesSummary = "(unknown)";
    }

    parts.push(
      "## Diff summary (pre-parsed, use as anchor):",
      `- Files changed: ${filesSummary}`,
      `- Lines added: ${additions}`,
      `- Lines removed: ${deletions}`,
      `- Likely change type: ${likelyType}`,
      "",
      "Use this summary to anchor the ## Why section. Do not repeat the file list verbatim in the output.",
      ""
    );
  }

  if (extraContext) {
    const repoContext = extraContext.repoContext || { source: "none", summary: "" };
    const changeMap = extraContext.changeMap || {
      files: [],
      totals: { filesChanged: 0, additions: 0, deletions: 0 },
    };
    const promptDiffTruncated = !!extraContext.promptDiffTruncated;

    const fileLines = (changeMap.files || []).map((file) => {
      const mods = (file.hunks || []).reduce(
        (acc, h) => acc + ((h.modifications && h.modifications.length) || 0),
        0
      );
      return `- ${file.oldPath} -> ${file.newPath} [${file.status}] (+${file.additions}/-${file.deletions}, hunks=${(file.hunks || []).length}, modifications=${mods})`;
    });

    parts.push(
      "## Repository context (README-first):",
      `- Context source: ${repoContext.source || "none"}`,
      repoContext.summary
        ? `- Context excerpt:\n${repoContext.summary}`
        : "- Context excerpt: (not available)",
      "",
      "## Comprehensive change map (source of truth):",
      `- Files changed: ${changeMap.totals?.filesChanged || 0}`,
      `- Total lines added: ${changeMap.totals?.additions || 0}`,
      `- Total lines removed: ${changeMap.totals?.deletions || 0}`,
      ...(fileLines.length ? fileLines : ["- (no parsed file entries)"]),
      "",
      `- Raw diff truncated for prompt: ${promptDiffTruncated ? "yes" : "no"}`,
      "Do not omit files from ## What changed. If details are unclear, state uncertainty without hallucinating.",
      ""
    );
  }

  parts.push(
    "Git diff:",
    "```diff",
    diff || "",
    "```"
  );

  return parts.join("\n");
}

