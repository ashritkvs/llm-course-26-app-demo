/* ============================================================
   DBSchemaViz — parser.js
   SQL parser: handles CREATE TABLE across PostgreSQL, MySQL,
   SQLite, MSSQL — including schema prefixes, named CONSTRAINTs,
   composite PKs, inline and table-level FK declarations.
   ============================================================ */

/**
 * Strips the schema prefix from a qualified table name.
 * "company.departments" → "departments"
 * Also removes backtick / double-quote / single-quote wrapping.
 */
function stripSchema(name) {
  const clean = name.replace(/[`"']/g, '').trim();
  const parts = clean.split('.');
  return parts[parts.length - 1];
}

/**
 * Parse raw SQL containing CREATE TABLE statements.
 *
 * Returns:
 *   {
 *     tables: [{ name, fullName, schema, columns: [{ name, type, isPK, isFK,
 *               fkRef, isUnique, isNullable, hasDefault, schema }] }],
 *     relationships: [{ from, fromCol, to, toCol }]
 *   }
 */
function parseSQL(sql) {
  const result = { tables: [], relationships: [] };

  // ── Normalize: strip comments, unify line endings ──────────
  let normalized = sql
    .replace(/--[^\n]*/g, '')           // single-line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\r\n/g, '\n')
    .trim();

  // ── Match each CREATE TABLE (...) block ────────────────────
  // Supports: schema.table, `quoted`, "quoted", IF NOT EXISTS
  const createTableRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:[`"']?\w+[`"']?\.)?[`"']?\w+[`"']?)\s*\(/gi;
  let match;

  while ((match = createTableRe.exec(normalized)) !== null) {
    const rawName    = match[1];
    const tableName  = stripSchema(rawName);
    const schemaName = rawName.includes('.')
      ? rawName.replace(/[`"']/g, '').split('.')[0]
      : null;

    // Walk bracket depth to find the matching closing paren —
    // avoids regex backtracking issues with nested parens in CHECK(...)
    let depth = 1;
    let i = createTableRe.lastIndex; // right after opening '('
    const bodyStart = i;
    while (i < normalized.length && depth > 0) {
      if      (normalized[i] === '(') depth++;
      else if (normalized[i] === ')') depth--;
      i++;
    }
    const body = normalized.slice(bodyStart, i - 1);
    createTableRe.lastIndex = i; // advance past this block

    const columns = [];
    const pks     = new Set();
    const fks     = []; // { col, refTable, refCol }

    // ── Table-level PRIMARY KEY (col1, col2, ...) ────────────
    const tablePKMatch = body.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
    if (tablePKMatch) {
      tablePKMatch[1]
        .split(',')
        .forEach(c => pks.add(c.trim().replace(/[`"']/g, '')));
    }

    // ── FOREIGN KEY constraints (named + unnamed) ────────────
    // Handles both:
    //   FOREIGN KEY (col) REFERENCES tbl(col)
    //   CONSTRAINT fk_name FOREIGN KEY (col) REFERENCES schema.tbl(col)
    const fkRe = /(?:CONSTRAINT\s+\w+\s+)?FOREIGN\s+KEY\s*\(\s*[`"']?(\w+)[`"']?\s*\)\s+REFERENCES\s+((?:[`"']?\w+[`"']?\.)?[`"']?\w+[`"']?)\s*\(\s*[`"']?(\w+)[`"']?\s*\)/gi;
    let fkMatch;
    while ((fkMatch = fkRe.exec(body)) !== null) {
      const fkCol    = fkMatch[1];
      const refTable = stripSchema(fkMatch[2]); // strip schema prefix
      const refCol   = fkMatch[3];
      fks.push({ col: fkCol, refTable, refCol });
      result.relationships.push({
        from: tableName, fromCol: fkCol,
        to:   refTable,  toCol:   refCol,
      });
    }

    // ── Parse individual column definitions ──────────────────
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      // Skip pure constraint/index lines — not column definitions
      if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE\s*\(|INDEX\s|KEY\s|CONSTRAINT\s|CHECK\s*\()/i.test(line)) continue;

      // col_name  DATATYPE[(size)]  [modifiers...]
      const colMatch = line.match(/^[`"']?(\w+)[`"']?\s+(\w+(?:\s*\([^)]*\))?)/i);
      if (!colMatch) continue;

      const colName = colMatch[1];

      // Guard against SQL keywords appearing at line start
      if (/^(PRIMARY|FOREIGN|UNIQUE|INDEX|KEY|CONSTRAINT|CHECK|CREATE|ALTER|DROP)$/i.test(colName)) continue;

      const colType    = colMatch[2].toUpperCase();
      const isNotNull  = /NOT\s+NULL/i.test(line);
      const isUnique   = /\bUNIQUE\b/i.test(line);
      const isInlinePK = /PRIMARY\s+KEY/i.test(line);
      const hasDefault = /\bDEFAULT\b/i.test(line);
      const isAutoInc  = /AUTO_INCREMENT|AUTOINCREMENT|\bSERIAL\b/i.test(line) || isInlinePK;

      if (isInlinePK) pks.add(colName);

      // Check for inline REFERENCES on the same column line
      let fkInfo = fks.find(f => f.col === colName) || null;
      if (!fkInfo) {
        const inlineFK = line.match(
          /REFERENCES\s+((?:[`"']?\w+[`"']?\.)?[`"']?\w+[`"']?)\s*\(\s*[`"']?(\w+)[`"']?\s*\)/i
        );
        if (inlineFK) {
          const refTable = stripSchema(inlineFK[1]);
          const refCol   = inlineFK[2];
          fkInfo = { refTable, refCol };
          result.relationships.push({
            from: tableName, fromCol: colName,
            to:   refTable,  toCol:   refCol,
          });
        }
      }

      columns.push({
        name:       colName,
        type:       colType,
        isPK:       pks.has(colName) || isInlinePK,
        isFK:       !!fkInfo,
        fkRef:      fkInfo,
        isUnique,
        isNullable: !isNotNull && !pks.has(colName) && !isAutoInc,
        hasDefault,
        schema:     schemaName,
      });
    }

    // Re-resolve PKs collected after inline declarations
    columns.forEach(col => { if (pks.has(col.name)) col.isPK = true; });

    if (columns.length > 0) {
      result.tables.push({
        name:     tableName,
        fullName: rawName.replace(/[`"']/g, ''),
        schema:   schemaName,
        columns,
      });
    }
  }

  // ── Deduplicate relationships ─────────────────────────────
  const seen = new Set();
  result.relationships = result.relationships.filter(r => {
    const key = `${r.from}.${r.fromCol}->${r.to}.${r.toCol}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return result;
}
