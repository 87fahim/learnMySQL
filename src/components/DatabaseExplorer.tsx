import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchDatabaseCatalog,
  fetchDatabaseRelations,
  fetchDatabaseSchema,
  fetchTablePreview,
} from '../api/schemaExplorer'
import {
  QueryApiError,
  type DatabaseCatalog,
  type DatabaseRelations,
  type DatabaseSchema,
  type TablePreview,
} from '../api/types'
import { RelationshipDiagram } from './RelationshipDiagram'
import { Table } from './Table'

type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: QueryApiError | Error }

type Props = {
  selectedDatabase: string | null
  onDatabaseChange: (database: string) => void
  isMaximized: boolean
  onToggleMaximize: () => void
}

export function DatabaseExplorer({
  selectedDatabase,
  onDatabaseChange,
  isMaximized,
  onToggleMaximize,
}: Props) {
  const [catalogState, setCatalogState] = useState<LoadState<DatabaseCatalog>>({ status: 'idle' })
  const [schemaState, setSchemaState] = useState<LoadState<DatabaseSchema>>({ status: 'idle' })
  const [relationsState, setRelationsState] = useState<LoadState<DatabaseRelations>>({ status: 'idle' })
  const [previewState, setPreviewState] = useState<LoadState<TablePreview>>({ status: 'idle' })
  const [activeTab, setActiveTab] = useState<'preview' | 'relations'>('preview')
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const catalogAbortRef = useRef<AbortController | null>(null)
  const schemaAbortRef = useRef<AbortController | null>(null)
  const relationsAbortRef = useRef<AbortController | null>(null)
  const previewAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      catalogAbortRef.current?.abort()
      schemaAbortRef.current?.abort()
      relationsAbortRef.current?.abort()
      previewAbortRef.current?.abort()
    }
  }, [])

  const loadCatalog = useCallback(async () => {
    catalogAbortRef.current?.abort()
    const ctrl = new AbortController()
    catalogAbortRef.current = ctrl
    setCatalogState({ status: 'loading' })

    try {
      const data = await fetchDatabaseCatalog(ctrl.signal)
      if (!ctrl.signal.aborted) {
        setCatalogState({ status: 'success', data })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (!ctrl.signal.aborted) {
        setCatalogState({
          status: 'error',
          error: e instanceof Error ? e : new Error(String(e)),
        })
      }
    }
  }, [])

  const loadSchema = useCallback(async (database: string) => {
    schemaAbortRef.current?.abort()
    const ctrl = new AbortController()
    schemaAbortRef.current = ctrl
    setSchemaState({ status: 'loading' })

    try {
      const data = await fetchDatabaseSchema(database, ctrl.signal)
      if (ctrl.signal.aborted) return

      setSchemaState({ status: 'success', data })

      if (selectedTable && !data.tables.includes(selectedTable)) {
        setSelectedTable(null)
        previewAbortRef.current?.abort()
        setPreviewState({ status: 'idle' })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (!ctrl.signal.aborted) {
        setSchemaState({
          status: 'error',
          error: e instanceof Error ? e : new Error(String(e)),
        })
      }
    }
  }, [selectedTable])

  const loadPreview = useCallback(async (database: string, table: string) => {
    previewAbortRef.current?.abort()
    const ctrl = new AbortController()
    previewAbortRef.current = ctrl
    setSelectedTable(table)
    setPreviewState({ status: 'loading' })

    try {
      const data = await fetchTablePreview(table, database, ctrl.signal)
      if (!ctrl.signal.aborted) {
        setPreviewState({ status: 'success', data })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (!ctrl.signal.aborted) {
        setPreviewState({
          status: 'error',
          error: e instanceof Error ? e : new Error(String(e)),
        })
      }
    }
  }, [])

  const loadRelations = useCallback(async (database: string) => {
    relationsAbortRef.current?.abort()
    const ctrl = new AbortController()
    relationsAbortRef.current = ctrl
    setRelationsState({ status: 'loading' })

    try {
      const data = await fetchDatabaseRelations(database, ctrl.signal)
      if (!ctrl.signal.aborted) {
        setRelationsState({ status: 'success', data })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (!ctrl.signal.aborted) {
        setRelationsState({
          status: 'error',
          error: e instanceof Error ? e : new Error(String(e)),
        })
      }
    }
  }, [])

  useEffect(() => {
    void loadCatalog()
  }, [loadCatalog])

  useEffect(() => {
    if (catalogState.status !== 'success') return
    if (selectedDatabase && catalogState.data.databases.includes(selectedDatabase)) return

    const nextDatabase =
      catalogState.data.currentDatabase || catalogState.data.databases[0] || null
    if (nextDatabase) {
      onDatabaseChange(nextDatabase)
    }
  }, [catalogState, onDatabaseChange, selectedDatabase])

  useEffect(() => {
    if (!selectedDatabase) {
      setSchemaState({ status: 'idle' })
      setRelationsState({ status: 'idle' })
      setSelectedTable(null)
      setPreviewState({ status: 'idle' })
      return
    }

    void loadSchema(selectedDatabase)
    void loadRelations(selectedDatabase)
  }, [loadRelations, loadSchema, selectedDatabase])

  useEffect(() => {
    if (schemaState.status !== 'success') return
    if (schemaState.data.tables.length === 0) {
      setSelectedTable(null)
      setPreviewState({ status: 'idle' })
      return
    }

    if (!selectedTable || !schemaState.data.tables.includes(selectedTable)) {
      setSelectedTable(schemaState.data.tables[0])
    }
  }, [schemaState, selectedTable])

  useEffect(() => {
    if (schemaState.status !== 'success') return
    if (!selectedTable) return
    if (!schemaState.data.tables.includes(selectedTable)) return
    void loadPreview(schemaState.data.database, selectedTable)
  }, [loadPreview, schemaState, selectedTable])

  const handleDatabaseChange = useCallback(
    (database: string) => {
      if (database === selectedDatabase) return
      setSelectedTable(null)
      setRelationsState({ status: 'idle' })
      relationsAbortRef.current?.abort()
      previewAbortRef.current?.abort()
      setPreviewState({ status: 'idle' })
      onDatabaseChange(database)
    },
    [onDatabaseChange, selectedDatabase],
  )

  const apiStatus =
    catalogState.status === 'success'
      ? { label: 'API connected', tone: 'ok' as const }
      : catalogState.status === 'error'
        ? { label: 'API disconnected', tone: 'error' as const }
        : { label: 'Checking API...', tone: 'pending' as const }
  const foreignKeyTargets =
    previewState.status === 'success'
      ? Object.fromEntries(
          (previewState.data.foreignKeys ?? [])
            .filter((fk) => fk.column && fk.referencedTable)
            .map((fk) => [fk.column, fk.referencedTable]),
        )
      : undefined
  const columnMetaByName =
    previewState.status === 'success'
      ? Object.fromEntries(
          (previewState.data.columnMeta ?? [])
            .filter((col) => col.name)
            .map((col) => [col.name, { type: col.type, key: col.key }]),
        )
      : undefined

  return (
    <aside className={`workspace-sidebar${isMaximized ? ' maximized' : ''}`} aria-label="Current database explorer">
      <div className="sidebar-top">
        <div className="sidebar-title-row">
          <button
            type="button"
            className="explorer-size-toggle"
            onClick={onToggleMaximize}
            aria-label={isMaximized ? 'Restore database explorer size' : 'Maximize database explorer'}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? '↙' : '↗'}
          </button>
          <h2 className="sidebar-title">Database explorer</h2>
        </div>
        <span className={`api-status ${apiStatus.tone}`} role="status" aria-live="polite">
          {apiStatus.label}
        </span>
      </div>

      <div className="explorer-tabs" role="tablist" aria-label="Database explorer views">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'preview'}
          className={`explorer-tab${activeTab === 'preview' ? ' active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Table preview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'relations'}
          className={`explorer-tab${activeTab === 'relations' ? ' active' : ''}`}
          onClick={() => setActiveTab('relations')}
        >
          Relationships
        </button>
      </div>

      <section className={`schema-section selector-row${activeTab === 'relations' ? ' single' : ''}`}>
        <div className="selector-field">
          <label className="sidebar-section-title" htmlFor="database-select">
            Database
          </label>

          {catalogState.status === 'success' ? (
            <select
              id="database-select"
              className="compact-select"
              value={selectedDatabase ?? ''}
              onChange={(e) => handleDatabaseChange(e.target.value)}
            >
              {catalogState.data.databases.map((database) => (
                <option key={database} value={database}>
                  {database}
                </option>
              ))}
            </select>
          ) : (
            <select id="database-select" className="compact-select" disabled>
              <option>Loading...</option>
            </select>
          )}
        </div>

        {activeTab === 'preview' ? (
          <div className="selector-field">
            <label className="sidebar-section-title" htmlFor="table-select">
              Table
            </label>

            {schemaState.status === 'success' && schemaState.data.tables.length > 0 ? (
              <select
                id="table-select"
                className="compact-select"
                value={selectedTable ?? ''}
                onChange={(e) => void loadPreview(schemaState.data.database, e.target.value)}
              >
                {schemaState.data.tables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </select>
            ) : (
              <select id="table-select" className="compact-select" disabled>
                <option>{schemaState.status === 'loading' ? 'Loading...' : 'No tables'}</option>
              </select>
            )}
          </div>
        ) : null}
      </section>

      {catalogState.status === 'loading' ? (
        <p className="schema-loading" role="status">
          Loading databases...
        </p>
      ) : null}

      {catalogState.status === 'error' ? (
        <div className="result-error" role="alert">
          <strong>{errorTitle(catalogState.error)}</strong>
          <p>{catalogState.error.message}</p>
        </div>
      ) : null}

      {schemaState.status === 'error' ? (
        <div className="result-error" role="alert">
          <strong>{errorTitle(schemaState.error)}</strong>
          <p>{schemaState.error.message}</p>
        </div>
      ) : null}

      {schemaState.status === 'success' && activeTab === 'preview' ? (
        <section className="schema-section schema-preview">
          {schemaState.data.tables.length === 0 ? (
            <p className="schema-hint">No tables were returned for this database.</p>
          ) : (
            <>
              {previewState.status === 'idle' ? (
                <p className="schema-hint">Select a table to preview rows.</p>
              ) : null}

              {previewState.status === 'loading' ? (
                <p className="schema-loading" role="status">
                  Loading preview...
                </p>
              ) : null}

              {previewState.status === 'error' ? (
                <div className="result-error" role="alert">
                  <strong>{errorTitle(previewState.error)}</strong>
                  <p>{previewState.error.message}</p>
                </div>
              ) : null}

              {previewState.status === 'success' ? (
                <Table
                  result={previewState.data}
                  columnMeta={columnMetaByName}
                  foreignKeyTargets={foreignKeyTargets}
                  onForeignKeyClick={(_column, targetTable) =>
                    void loadPreview(previewState.data.database, targetTable)
                  }
                />
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {activeTab === 'relations' ? (
        <section className="schema-section schema-preview">
          {relationsState.status === 'loading' ? (
            <p className="schema-loading" role="status">
              Loading relationships...
            </p>
          ) : null}

          {relationsState.status === 'error' ? (
            <div className="result-error" role="alert">
              <strong>{errorTitle(relationsState.error)}</strong>
              <p>{relationsState.error.message}</p>
            </div>
          ) : null}

          {relationsState.status === 'success' ? (
            relationsState.data.tables.length > 0 ? (
              <RelationshipDiagram data={relationsState.data} />
            ) : (
              <p className="schema-hint">No tables were returned for this database.</p>
            )
          ) : null}
        </section>
      ) : null}

      {schemaState.status !== 'success' ? (
        <section className="schema-section schema-preview">
          {schemaState.status === 'loading' ? (
            <p className="schema-loading" role="status">
              Loading schema...
            </p>
          ) : (
            <p className="schema-hint">Pick a database to load tables.</p>
          )}
        </section>
      ) : null}
    </aside>
  )
}

function errorTitle(err: Error): string {
  if (err instanceof QueryApiError) {
    if (err.status === 0) return 'Network error'
    return `Error ${err.status}`
  }
  return 'Something went wrong'
}