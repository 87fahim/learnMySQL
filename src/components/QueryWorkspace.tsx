import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { fetchDatabaseSchemaDetails } from '../api/schemaExplorer'
import type { DatabaseSchemaDetails } from '../api/types'
import { useRunQuery } from '../hooks/useRunQuery'
import { QueryApiError } from '../api/types'
import { DatabaseExplorer } from './DatabaseExplorer'
import { Table } from './Table'

const DEFAULT_SQL = 'SELECT 1 AS ok'
type SuggestionItem = { value: string; kind: 'table' | 'column' }
type SuggestionContext =
  | { mode: 'table'; start: number; end: number }
  | { mode: 'column'; start: number; end: number }
  | { mode: 'dot-table'; prefix: string }

export function QueryWorkspace() {
  const hintId = useId()
  const [sql, setSql] = useState(DEFAULT_SQL)
  const [selectedDatabase, setSelectedDatabase] = useState<string | null>(null)
  const [isExplorerMaximized, setIsExplorerMaximized] = useState(false)
  const [schemaDetails, setSchemaDetails] = useState<DatabaseSchemaDetails | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [suggestionContext, setSuggestionContext] = useState<SuggestionContext | null>(null)
  const aliasToTableRef = useRef<Record<string, string>>({})
  const detailsAbortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const previousDatabaseRef = useRef<string | null>(null)
  const { state, run, reset } = useRunQuery()

  const onRun = useCallback(() => {
    aliasToTableRef.current = {}
    setSuggestions([])
    setSuggestionContext(null)
    void run(sql, selectedDatabase ?? undefined)
  }, [run, selectedDatabase, sql])

  const normalizeCursorPos = useCallback((value: number | null | undefined, text: string): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) return text.length
    return Math.min(Math.max(value, 0), text.length)
  }, [])

  const refreshSuggestions = useCallback(
    (nextSql: string, cursorPosRaw: number | null | undefined) => {
      if (!schemaDetails) {
        setSuggestions([])
        setSuggestionContext(null)
        return
      }

      const cursorPos = normalizeCursorPos(cursorPosRaw, nextSql)
      const beforeCursor = nextSql.slice(0, cursorPos)
      const tables = Object.keys(schemaDetails.tableColumns)
      const tableLookup = Object.fromEntries(tables.map((table) => [table.toLowerCase(), table]))
      const dotMatch = beforeCursor.match(/(?:`?([a-zA-Z_][\w]*)`?)\.(?:`?(\w*)`?)$/)
      if (dotMatch) {
        const qualifier = dotMatch[1]
        const columnToken = dotMatch[2] ?? ''
        const realTableName = tableLookup[qualifier.toLowerCase()]
        const aliasTable = aliasToTableRef.current[qualifier] ?? aliasToTableRef.current[qualifier.toLowerCase()]
        const tableForQualifier =
          realTableName ?? (aliasTable ? tableLookup[aliasTable.toLowerCase()] ?? aliasTable : undefined)

        if (tableForQualifier) {
          const columns = schemaDetails.tableColumns[tableForQualifier] ?? []
          const items = columns
            .filter((column) => column.toLowerCase().startsWith(columnToken.toLowerCase()))
            .map((column) => ({ value: column, kind: 'column' as const }))
          if (items.length > 0) {
            setSuggestions(items)
            setSuggestionIndex(0)
            setSuggestionContext({
              mode: 'column',
              start: cursorPos - columnToken.length,
              end: cursorPos,
            })
            return
          }
        } else {
          const items = tables
            .filter((table) => table.toLowerCase().startsWith(qualifier.toLowerCase()))
            .map((table) => ({ value: table, kind: 'table' as const }))
          if (items.length > 0) {
            setSuggestions(items)
            setSuggestionIndex(0)
            setSuggestionContext({ mode: 'dot-table', prefix: qualifier })
            return
          }
        }
      }

      const wordMatch = beforeCursor.match(/([a-zA-Z_][\w]*)$/)
      if (wordMatch) {
        const token = wordMatch[1]
        const items = tables
          .filter((table) => table.toLowerCase().startsWith(token.toLowerCase()))
          .map((table) => ({ value: table, kind: 'table' as const }))
        if (items.length > 0) {
          setSuggestions(items)
          setSuggestionIndex(0)
          setSuggestionContext({
            mode: 'table',
            start: cursorPos - token.length,
            end: cursorPos,
          })
          return
        }
      }

      setSuggestions([])
      setSuggestionContext(null)
    },
    [normalizeCursorPos, schemaDetails],
  )

  const onSqlChange = useCallback(
    (nextSql: string, cursorPos?: number) => {
      setSql(nextSql)
      const cursor = cursorPos ?? inputRef.current?.selectionStart ?? nextSql.length
      refreshSuggestions(nextSql, cursor)
    },
    [refreshSuggestions],
  )

  const applySuggestion = useCallback(
    (item: SuggestionItem) => {
      if (!suggestionContext) return
      const cursorPos = inputRef.current?.selectionStart ?? sql.length

      if (suggestionContext.mode === 'dot-table') {
        const aliasKey = suggestionContext.prefix.toLowerCase()
        aliasToTableRef.current = {
          ...aliasToTableRef.current,
          [aliasKey]: item.value,
        }
        refreshSuggestions(sql, cursorPos)
        return
      }

      const before = sql.slice(0, suggestionContext.start)
      const after = sql.slice(suggestionContext.end)
      const nextSql = `${before}${item.value}${after}`
      const nextCursor = suggestionContext.start + item.value.length
      setSql(nextSql)
      setSuggestions([])
      setSuggestionContext(null)

      requestAnimationFrame(() => {
        if (!inputRef.current) return
        inputRef.current.focus()
        inputRef.current.selectionStart = nextCursor
        inputRef.current.selectionEnd = nextCursor
        refreshSuggestions(nextSql, nextCursor)
      })
    },
    [refreshSuggestions, sql, suggestionContext],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (suggestions.length > 0 && !e.ctrlKey && !e.metaKey) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setSuggestionIndex((prev) => (prev + 1) % suggestions.length)
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setSuggestionIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
          return
        }
        if (e.key === 'Enter') {
          e.preventDefault()
          applySuggestion(suggestions[suggestionIndex])
          return
        }
        if (e.key === 'Escape') {
          e.preventDefault()
          setSuggestions([])
          setSuggestionContext(null)
          return
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void run(sql, selectedDatabase ?? undefined)
      }
    },
    [applySuggestion, run, selectedDatabase, sql, suggestionIndex, suggestions],
  )

  useEffect(() => {
    if (
      previousDatabaseRef.current &&
      selectedDatabase &&
      previousDatabaseRef.current !== selectedDatabase
    ) {
      reset()
    }

    previousDatabaseRef.current = selectedDatabase
  }, [reset, selectedDatabase])

  useEffect(() => {
    detailsAbortRef.current?.abort()
    if (!selectedDatabase) {
      setSchemaDetails(null)
      setSuggestions([])
      setSuggestionContext(null)
      aliasToTableRef.current = {}
      return
    }

    const ctrl = new AbortController()
    detailsAbortRef.current = ctrl
    void fetchDatabaseSchemaDetails(selectedDatabase, ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setSchemaDetails(data)
        }
      })
      .catch(() => {
        if (!ctrl.signal.aborted) {
          setSchemaDetails(null)
        }
      })

    aliasToTableRef.current = {}
    return () => ctrl.abort()
  }, [selectedDatabase])

  useEffect(() => {
    const aliases = aliasToTableRef.current
    const kept = Object.fromEntries(
      Object.entries(aliases).filter(([alias]) => sql.toLowerCase().includes(`${alias.toLowerCase()}.`)),
    )
    aliasToTableRef.current = kept
  }, [sql])

  useEffect(() => {
    if (!schemaDetails) return
    const cursorPos = inputRef.current?.selectionStart ?? sql.length
    refreshSuggestions(sql, cursorPos)
  }, [refreshSuggestions, schemaDetails, sql])

  return (
    <div className={`workspace${isExplorerMaximized ? ' explorer-maximized' : ''}`}>
      {!isExplorerMaximized ? (
        <div className="workspace-main">
        <div className="workspace-editor">
          <label className="editor-label" htmlFor={hintId}>
            SQL
          </label>
          <div className="sql-input-wrap">
            <textarea
              id={hintId}
              ref={inputRef}
              className="sql-input"
              spellCheck={false}
              value={sql}
              onChange={(e) => onSqlChange(e.target.value, e.currentTarget.selectionStart)}
              onKeyDown={onKeyDown}
              onClick={(e) => refreshSuggestions(e.currentTarget.value, e.currentTarget.selectionStart)}
            onKeyUp={(e) => {
              if (['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) return
              refreshSuggestions(e.currentTarget.value, e.currentTarget.selectionStart)
            }}
              rows={10}
              aria-describedby="sql-hint"
              autoComplete="off"
              autoCorrect="off"
            />
            {suggestions.length > 0 ? (
              <div className="sql-suggest inside-input" role="listbox" aria-label="SQL suggestions">
                {suggestions.map((item, idx) => (
                  <button
                    type="button"
                    key={`${item.kind}:${item.value}`}
                    className={`sql-suggest-item${idx === suggestionIndex ? ' active' : ''}`}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      applySuggestion(item)
                    }}
                  >
                    <span>{item.value}</span>
                    <small>{item.kind}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <p className="query-database-status">
            Database: <strong>{selectedDatabase ?? 'Loading available databases…'}</strong>
          </p>
          <p id="sql-hint" className="sql-hint">
            Run with the button or <kbd>Ctrl</kbd>+<kbd>Enter</kbd> (⌘+Enter on Mac).
          </p>
          <div className="workspace-actions">
            <button
              type="button"
              className="btn primary"
              onClick={onRun}
              disabled={state.status === 'running'}
            >
              {state.status === 'running' ? 'Running…' : 'Run query'}
            </button>
            {state.status !== 'idle' ? (
              <button type="button" className="btn ghost" onClick={reset}>
                Clear result
              </button>
            ) : null}
          </div>
        </div>

        <div className="workspace-result">
          <h2 className="result-heading">Query result</h2>
          {state.status === 'idle' ? (
            <p className="result-placeholder">
              Run a query to see rows here under the editor.
            </p>
          ) : null}
          {state.status === 'running' ? (
            <p className="result-loading" role="status">
              Executing…
            </p>
          ) : null}
          {state.status === 'success' ? <Table result={state.data} /> : null}
          {state.status === 'error' ? (
            <div className="result-error" role="alert">
              <strong>{errorTitle(state.error)}</strong>
              <p>{state.error.message}</p>
              {state.error instanceof QueryApiError && state.error.status === 0 ? (
                <p className="result-error-hint">
                  The app calls your API over HTTP (see Vite proxy). Browsers cannot open a raw
                  MySQL connection—once the API exists, it will talk to MySQL on your machine.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        </div>
      ) : null}
      <DatabaseExplorer
        selectedDatabase={selectedDatabase}
        onDatabaseChange={setSelectedDatabase}
        isMaximized={isExplorerMaximized}
        onToggleMaximize={() => setIsExplorerMaximized((prev) => !prev)}
      />
    </div>
  )
}

function errorTitle(err: Error): string {
  if (err instanceof QueryApiError) {
    if (err.status === 0) return 'Network error'
    return `Error ${err.status}`
  }
  return 'Something went wrong'
}
