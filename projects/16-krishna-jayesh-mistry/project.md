---
slug: 16-krishna-jayesh-mistry
title: DBSchemaViz
students:
  - Krishna Jayesh Mistry
tags:
  - developer-tools
  - visualizer
  - database
category: other
tagline: From CREATE TABLE to clarity.
featuredEligible: true

semester: "Spring 2026"

shortTitle: "DBSchemaViz"
studentId: "116781723"
videoUrl: "https://drive.google.com/file/d/1-Dri1mW4j66L5z1IsIV2S_grvb9i-c9o/view?usp=drive_link"
thumbnail: /thumbnails/16-krishna-jayesh-mistry.jpg
githubUrl: "https://github.com/KrishnaMistry189"
---
## 1. Title

**DBSchemaViz** — browser-based visualization of relational database schemas from `CREATE TABLE` SQL.

---

## 2. Executive summary / abstract

This project delivers a client-only web application where users paste SQL containing `CREATE TABLE` statements and receive an interactive ER-style diagram: tables as draggable cards, primary/foreign key indicators on columns, relationship edges with cardinality-style markers, lightweight schema-health metrics, and exports to SVG/PNG. No server, authentication, or database connection is required; parsing and rendering run entirely in the browser.

---

## 3. Problem statement / motivation

Database schemas expressed as SQL can be difficult to read at scale—especially relationships across many tables—when reviewing designs, onboarding teammates, or documenting systems. Turning portable `CREATE TABLE` scripts into a clear visual map lowers cognitive load and supports design review without installing specialized modeling tools.

---

## 4. Objectives / goals

- Parse dialect-flavored SQL for **`CREATE TABLE`** across **PostgreSQL, MySQL, SQLite,** and **Microsoft SQL Server** idioms commonly found in DDL.
- Recover **tables, columns (types), primary keys inline and composite, foreign keys inline and constraint blocks,** qualified names (`schema.table`), and **`IF NOT EXISTS`** forms.
- Render an **interactive canvas**: grid layout, manual repositioning, Bézier FK edges with labels.
- Provide **guided examples** (e-commerce, blog, SaaS, hospital, multi-schema) for demonstration and testing.
- Surface **basic schema quality signals** (orphan tables, nullable FKs, tables without PK, aggregate “health”).
- Offer **diagram export** (SVG and PNG).

---

## 5. Approach / methodology

1. **Lexical preprocessing**: strip `--` and `/* … */` comments; normalize line endings.
2. **Structural parsing** (`parser.js`): identify each `CREATE TABLE` block via bracket-aware scanning; derive column definitions (skipping standalone constraint-only lines); collect table-level PKs and FK constraints; deduplicate relationship edges.
3. **Presentation** (`renderer.js`): compute a sqrt-grid layout; build DOM nodes per table with optional schema badges; draw SVG paths between tables with offsets for parallel edges; column tooltips reflect nullability and FK references.
4. **Design system** (`styles.css` in codebase; shipped file may be renamed locally): typography (Syne / Space Mono), dark-first theme with light toggle via CSS variables.
5. **Qualitative verification**: validate behavior using bundled example schemas spanning self-referencing FKs, composite PK junction tables, multi-schema DDL, and naming constraints.

---

## 6. Implementation / deliverables

| Component           | Role |
|---------------------|------|
| `index.html` *(entry HTML in repo may be saved as `index (2).html`)* | Page shell: SQL textarea, visualize/clear controls, canvas toolbar, stats, schema-health panel, script includes. |
| `parser.js`         | SQL → `{ tables[], relationships[] }` model. |
| `examples.js`       | Named DDL strings (`ecommerce`, `blog`, `saas`, `hospital`, `multischema`) loaded into the editor. |
| `renderer.js`       | Layout, DOM/SVG rendering, drag-and-drop, tooltips, analysis panel, exports, loading/error UX. |
| `styles.css` *(may be saved as `styles (1).css`)* | Global layout and component styling; theme toggle updates CSS variables. |
| `dbschemaviz (1).html` | Alternate HTML asset in workspace *(appears supplementary / duplicate-purpose; align with instructor expectations if citing a single canonical entry).* |

**Feature checklist (implemented in current codebase):**

- SQL input pane with placeholder guidance.
- Buttons: Visualize Schema, Clear, example loaders.
- Post-parse statistics: counts of tables, columns, relations (FK edges), PK column count.
- Canvas tools: Auto Layout, Fit viewport, Types on/off, dark/light Theme, Export SVG / Export PNG.
- Legend for PK/FK/unique indicators and FK direction semantics.
- Schema health indicators: orphan tables, nullable FK columns, tables without PK, summary health tier.
- Error toasts when input is empty or unparsable; brief loading overlay during parse pass.

---

## 7. Technology stack

- **Languages:** HTML5, CSS3, JavaScript (plain ES syntax; no transpiler assumed).
- **Runtime:** Modern browser (DOM APIs, `<canvas>` for PNG rasterization pipeline, Blob/URL downloads).
- **Fonts:** Google Fonts (**Syne**, **Space Mono**).
- **Dependencies:** No package manager manifests in repo; standalone static assets only.

---

## 8. How to run / reproduce

1. Ensure the HTML entry file references existing asset names locally: the codebase links `href="styles.css"` and `<script src="parser.js">` … If your copies use Windows-style names (`index (2).html`, `styles (1).css`), **rename files** so links resolve, or adjust the `<link>` and `<script>` paths to match.
2. Serve or open statically:
   - **Simplest:** drag `index.html` into Chrome/Edge/Firefox; for full export behavior some browsers tolerate `file://`, but a local static server (e.g., `python -m http.server` or VS Code Live Server) is recommended if any feature is blocked by file-origin policies.
3. Paste DDL or choose an example, then click **Visualize Schema**.

---

## 9. Known limitations **(explicitly supported vs. approximate)**

Implemented parser focuses on **`CREATE TABLE` parsing** demonstrated in bundled examples—not a complete SQL dialect engine. DDL features **outside column lines and common PK/FK forms** may be skipped (see `parser.js` line filters for constraint-only statements). MSSQL/MySQL specifics beyond common patterns used in classroom DDL may require extension. Export paths simplify DOM content into SVG/raster composites; fidelity may differ subtly from live screen styling.

---

## 10. Future work

- Fuller dialect coverage (**ALTER TABLE** migrations, partitioned tables, triggers, views/materialized views as read-only artifacts).
- Import from connection strings **(optional server or local-only drivers)** vs. pasted SQL only.
- Persistent saved layouts/projects in **localStorage** or shareable URLs (compressed DDL hash).
- Edge routing improvements (orthogonal routing, manual anchor points).

---

## 11. Repository / file manifest (workspace)

```
AMS 691 PROJECT/
├── parser.js
├── renderer.js
├── examples.js
├── styles (1).css     ← intended as styles.css per HTML reference
├── index (2).html     ← canonical app shell (title: DBSchemaViz)
├── dbschemaviz (1).html
└── project.md
```

---


