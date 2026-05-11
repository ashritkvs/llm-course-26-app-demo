const fs = require("fs");
const path = require("path");
const vm = require("vm");

function extractFunction(code, functionName) {
  const signature = `function ${functionName}(`;
  const start = code.indexOf(signature);
  if (start === -1) {
    throw new Error(`Could not find ${functionName} in source`);
  }

  const braceStart = code.indexOf("{", start);
  if (braceStart === -1) {
    throw new Error(`Could not find function body for ${functionName}`);
  }

  let depth = 0;
  let end = -1;
  for (let i = braceStart; i < code.length; i += 1) {
    const ch = code[i];
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error(`Could not parse ${functionName} body`);
  }

  return code.slice(start, end);
}

function loadDiffHelpers() {
  const contentPath = path.join(__dirname, "..", "src", "content.js");
  const contentCode = fs.readFileSync(contentPath, "utf8");
  const parseDiffMetaCode = extractFunction(contentCode, "parseDiffMeta");
  const parseComprehensiveChangeMapCode = extractFunction(
    contentCode,
    "parseComprehensiveChangeMap"
  );

  const context = {};
  vm.createContext(context);
  vm.runInContext(
    `${parseDiffMetaCode}; ${parseComprehensiveChangeMapCode}; this.parseDiffMeta = parseDiffMeta; this.parseComprehensiveChangeMap = parseComprehensiveChangeMap;`,
    context
  );
  return {
    parseDiffMeta: context.parseDiffMeta,
    parseComprehensiveChangeMap: context.parseComprehensiveChangeMap,
  };
}

async function loadBuildUserPrompt() {
  const promptPath = path.join(__dirname, "..", "src", "prompt.js");
  const promptCode = fs.readFileSync(promptPath, "utf8");
  const dataUrl =
    "data:text/javascript;base64," +
    Buffer.from(promptCode, "utf8").toString("base64");
  const mod = await import(dataUrl);
  return mod.buildUserPrompt;
}

function runCase(parseDiffMeta, parseComprehensiveChangeMap, buildUserPrompt, testCase) {
  const meta = parseDiffMeta(testCase.diff);
  const changeMap = parseComprehensiveChangeMap(testCase.diff);
  const prompt = buildUserPrompt(testCase.diff, "team", meta, {
    repoContext: { source: "README.md", summary: "Sample repository context" },
    changeMap,
    promptDiffTruncated: false,
  });

  const errors = [];
  if (typeof meta.additions !== "number" || typeof meta.deletions !== "number") {
    errors.push("Counts are not numeric");
  }
  if (!Array.isArray(meta.filesChanged)) {
    errors.push("filesChanged is not an array");
  }
  if (!prompt.includes("## Diff summary (pre-parsed, use as anchor):")) {
    errors.push("Prompt missing pre-parsed summary section");
  }
  if (!prompt.includes("Git diff:")) {
    errors.push("Prompt missing Git diff section");
  }
  if (!prompt.includes("## Comprehensive change map (source of truth):")) {
    errors.push("Prompt missing comprehensive change map section");
  }
  if (!prompt.includes("## Repository context (README-first):")) {
    errors.push("Prompt missing repository context section");
  }
  if (!Array.isArray(changeMap.files)) {
    errors.push("Comprehensive change map files is not an array");
  }

  return {
    name: testCase.name,
    expectedLikelyType: testCase.expectedLikelyType,
    actualLikelyType: meta.likelyType,
    additions: meta.additions,
    deletions: meta.deletions,
    filesChanged: meta.filesChanged,
    changeMapFiles: changeMap.totals.filesChanged,
    errors,
  };
}

function printReport(results) {
  console.log("=== Diff Workflow Test Report ===");
  console.log(`Total cases: ${results.length}\n`);

  for (const r of results) {
    console.log(`Case: ${r.name}`);
    console.log(`  likelyType: expected=${r.expectedLikelyType}, actual=${r.actualLikelyType}`);
    console.log(`  additions=${r.additions}, deletions=${r.deletions}`);
    console.log(`  files=[${r.filesChanged.join(", ")}]`);
    if (r.errors.length) {
      console.log(`  structural-errors: ${r.errors.join("; ")}`);
    }
    if (r.actualLikelyType !== r.expectedLikelyType) {
      console.log("  mismatch: likelyType differs from expectation");
    }
    console.log("");
  }

  const mismatches = results.filter(
    (r) => r.actualLikelyType !== r.expectedLikelyType || r.errors.length
  );
  console.log(`Failures detected: ${mismatches.length}`);
  if (mismatches.length) {
    console.log("Failing cases:");
    mismatches.forEach((m) => console.log(`  - ${m.name}`));
  }
}

async function main() {
  const { parseDiffMeta, parseComprehensiveChangeMap } = loadDiffHelpers();
  const buildUserPrompt = await loadBuildUserPrompt();

  const cases = [
    {
      name: "feature-only additions",
      expectedLikelyType: "feature",
      diff: [
        "diff --git a/src/api/newFeature.js b/src/api/newFeature.js",
        "--- a/src/api/newFeature.js",
        "+++ b/src/api/newFeature.js",
        "@@ -0,0 +1,3 @@",
        "+export function createFeature() {",
        '+  return "ok";',
        "+}",
      ].join("\n"),
    },
    {
      name: "bugfix mostly deletions",
      expectedLikelyType: "bugfix",
      diff: [
        "diff --git a/src/auth/session.js b/src/auth/session.js",
        "--- a/src/auth/session.js",
        "+++ b/src/auth/session.js",
        "@@ -1,5 +1,2 @@",
        "-const oldA = true;",
        "-const oldB = true;",
        "-const oldC = true;",
        "+const fixed = true;",
      ].join("\n"),
    },
    {
      name: "test file change",
      expectedLikelyType: "test",
      diff: [
        "diff --git a/src/user/user.spec.js b/src/user/user.spec.js",
        "--- a/src/user/user.spec.js",
        "+++ b/src/user/user.spec.js",
        "@@ -2,1 +2,2 @@",
        " const a = 1;",
        "+expect(a).toBe(1);",
      ].join("\n"),
    },
    {
      name: "docs change",
      expectedLikelyType: "docs",
      diff: [
        "diff --git a/README.md b/README.md",
        "--- a/README.md",
        "+++ b/README.md",
        "@@ -1,2 +1,2 @@",
        "-Old docs",
        "+New docs",
      ].join("\n"),
    },
    {
      name: "config change",
      expectedLikelyType: "config",
      diff: [
        "diff --git a/tsconfig.json b/tsconfig.json",
        "--- a/tsconfig.json",
        "+++ b/tsconfig.json",
        "@@ -3,1 +3,1 @@",
        '-  "strict": false,',
        '+  "strict": true,',
      ].join("\n"),
    },
    {
      name: "refactor mixed edits",
      expectedLikelyType: "refactor",
      diff: [
        "diff --git a/src/core/a.js b/src/core/a.js",
        "--- a/src/core/a.js",
        "+++ b/src/core/a.js",
        "@@ -1,2 +1,2 @@",
        '-const mode = "old";',
        '+const mode = "new";',
      ].join("\n"),
    },
    {
      name: "non-unified dom-only diff",
      expectedLikelyType: "refactor",
      diff: ["+new line", "-old line", " context line"].join("\n"),
    },
    {
      name: "renamed and modified file",
      expectedLikelyType: "refactor",
      diff: [
        "diff --git a/src/oldName.js b/src/newName.js",
        "similarity index 92%",
        "rename from src/oldName.js",
        "rename to src/newName.js",
        "@@ -1,2 +1,2 @@",
        "-const value = oldCall();",
        "+const value = newCall();",
      ].join("\n"),
    },
    {
      name: "deleted file",
      expectedLikelyType: "bugfix",
      diff: [
        "diff --git a/src/unused.js b/src/unused.js",
        "deleted file mode 100644",
        "--- a/src/unused.js",
        "+++ /dev/null",
        "@@ -1,2 +0,0 @@",
        "-export const oldThing = 1;",
        "-export const oldThing2 = 2;",
      ].join("\n"),
    },
    {
      name: "large multi-file unified diff",
      expectedLikelyType: "feature",
      diff: [
        "diff --git a/src/a.js b/src/a.js",
        "--- a/src/a.js",
        "+++ b/src/a.js",
        "@@ -0,0 +1,1 @@",
        "+export const a = 1;",
        "diff --git a/src/b.js b/src/b.js",
        "--- a/src/b.js",
        "+++ b/src/b.js",
        "@@ -0,0 +1,1 @@",
        "+export const b = 1;",
        "diff --git a/src/c.js b/src/c.js",
        "--- a/src/c.js",
        "+++ b/src/c.js",
        "@@ -0,0 +1,1 @@",
        "+export const c = 1;",
      ].join("\n"),
    },
  ];

  const results = cases.map((c) =>
    runCase(parseDiffMeta, parseComprehensiveChangeMap, buildUserPrompt, c)
  );
  printReport(results);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
