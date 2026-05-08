/** Practice mode: single read-style statement only (no multi-statements, no DDL/DML here). */

const LEADING_COMMENT = /^(\s*\/\*[\s\S]*?\*\/\s*|(\s*(--|#)[^\n]*\n)+\s*)*/

function stripLeadingComments(sql: string): string {
  let s = sql
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(LEADING_COMMENT, '')
  }
  return s.trim()
}

export type GuardResult = { ok: true; sql: string } | { ok: false; message: string }

export function sanitizeAndGuardSql(raw: string): GuardResult {
  const trimmedEnd = raw.trim().replace(/;+\s*$/u, '').trim()
  if (!trimmedEnd) return { ok: false, message: 'Empty query.' }

  if (trimmedEnd.includes(';')) {
    return { ok: false, message: 'Only one statement is allowed.' }
  }

  const cleaned = stripLeadingComments(trimmedEnd)
  const firstToken = cleaned.split(/\s+/u)[0]?.toLowerCase()

  if (firstToken !== 'select' && firstToken !== 'with' && firstToken !== 'show' && firstToken !== 'describe' && firstToken !== 'explain' && firstToken !== 'desc') {
    return {
      ok: false,
      message: 'Only read-only queries are allowed (SELECT, WITH, SHOW, DESCRIBE, EXPLAIN).',
    }
  }

  return { ok: true, sql: trimmedEnd }
}
