import {
  QueryApiError,
  type ApiErrorBody,
  type DatabaseCatalog,
  type DatabaseRelations,
  type DatabaseSchemaDetails,
  type DatabaseSchema,
  type TablePreview,
} from './types'

type MockPreview = {
  columns: string[]
  rows: (string | number | boolean | null)[][]
}

const MOCK_TABLES: Record<string, MockPreview> = {
  customers: {
    columns: ['id', 'name', 'email', 'city'],
    rows: [
      [1, 'Aisha Khan', 'aisha@example.com', 'Cairo'],
      [2, 'Mason Lee', 'mason@example.com', 'Toronto'],
      [3, 'Nina Rossi', 'nina@example.com', 'Rome'],
    ],
  },
  orders: {
    columns: ['id', 'customer_id', 'status', 'total'],
    rows: [
      [501, 1, 'paid', 129.5],
      [502, 2, 'pending', 42.0],
      [503, 1, 'shipped', 315.99],
    ],
  },
  products: {
    columns: ['id', 'sku', 'name', 'price'],
    rows: [
      [11, 'KB-100', 'Keyboard', 79.99],
      [12, 'MS-200', 'Mouse', 24.5],
      [13, 'MN-300', 'Monitor', 199.0],
    ],
  },
}

const MOCK_DATABASES = ['learn_mysql_demo', 'sales_demo', 'warehouse_demo']

const MOCK_SCHEMA_TABLES: Record<string, string[]> = {
  learn_mysql_demo: ['customers', 'orders', 'products'],
  sales_demo: ['customers', 'orders'],
  warehouse_demo: ['products'],
}

function apiBaseUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
  return base ?? ''
}

function schemaUrl(): string {
  return `${apiBaseUrl()}/api/v1/schema`
}

function databasesUrl(): string {
  return `${apiBaseUrl()}/api/v1/databases`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response

  try {
    res = await fetch(url, { signal })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    const msg = e instanceof Error ? e.message : 'Could not reach the API.'
    throw new QueryApiError(`${msg} Start the local API (see Vite proxy).`, 0, {
      code: 'NETWORK',
      message: msg,
    })
  }

  const contentType = res.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? ((await res.json()) as unknown) : await res.text()

  if (!res.ok) {
    const body =
      isJson && payload && typeof payload === 'object'
        ? (payload as ApiErrorBody)
        : undefined
    const rawMessage =
      body?.message ??
      (typeof payload === 'string' && payload ? payload : res.statusText) ??
      'Request failed'
    const message =
      res.status === 502
        ? 'API server is not reachable. Start with `npm run dev` and verify MySQL is running.'
        : rawMessage
    throw new QueryApiError(message, res.status, body)
  }

  if (!isJson || payload == null || typeof payload !== 'object') {
    throw new QueryApiError('Unexpected response from server', 502)
  }

  return payload as T
}

async function mockDatabaseCatalog(): Promise<DatabaseCatalog> {
  await sleep(160)
  return {
    currentDatabase: 'learn_mysql_demo',
    databases: MOCK_DATABASES,
  }
}

async function mockDatabaseSchemaFor(database: string): Promise<DatabaseSchema> {
  await sleep(180)
  return {
    database,
    tables: MOCK_SCHEMA_TABLES[database] ?? [],
  }
}

async function mockDatabaseSchemaDetailsFor(database: string): Promise<DatabaseSchemaDetails> {
  await sleep(180)
  const tables = MOCK_SCHEMA_TABLES[database] ?? []
  const tableColumns = Object.fromEntries(
    tables.map((table) => [table, MOCK_TABLES[table]?.columns ?? ['id']]),
  )
  return { database, tableColumns }
}

async function mockTablePreview(table: string, limit: number): Promise<TablePreview> {
  await sleep(180)
  const data = MOCK_TABLES[table]

  if (!data) {
    throw new QueryApiError(`Mock table "${table}" was not found.`, 404, {
      code: 'NOT_FOUND',
      message: 'Choose one of the tables returned by Show tables.',
    })
  }

  const rows = data.rows.slice(0, limit)

  return {
    database: 'learn_mysql_demo',
    table,
    columns: data.columns,
    rows,
    columnMeta: data.columns.map((name) => ({ name, type: 'varchar(255)', key: '' })),
    foreignKeys: table === 'orders' ? [{ column: 'customer_id', referencedTable: 'customers', referencedColumn: 'id' }] : [],
    meta: {
      rowCount: data.rows.length,
      truncated: rows.length < data.rows.length,
      executionMs: 9,
    },
  }
}

async function mockDatabaseRelations(database: string): Promise<DatabaseRelations> {
  await sleep(180)
  const tables = MOCK_SCHEMA_TABLES[database] ?? []
  const relations =
    database === 'learn_mysql_demo'
      ? [
          {
            constraintName: 'orders_ibfk_1',
            fromTable: 'orders',
            fromColumn: 'customer_id',
            toTable: 'customers',
            toColumn: 'id',
          },
        ]
      : []
  const tableColumns = Object.fromEntries(
    tables.map((table) => {
      const columns = MOCK_TABLES[table]?.columns ?? ['id']
      return [
        table,
        columns.map((name) => ({
          name,
          type: 'varchar(255)',
          isPrimaryKey: name === 'id',
          isForeignKey: relations.some((relation) => relation.fromTable === table && relation.fromColumn === name),
        })),
      ]
    }),
  )

  return {
    database,
    tables,
    relations,
    tableColumns,
  }
}

export async function fetchDatabaseCatalog(signal?: AbortSignal): Promise<DatabaseCatalog> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return mockDatabaseCatalog()
  }

  const data = await requestJson<Partial<DatabaseCatalog>>(databasesUrl(), signal)
  if (typeof data.currentDatabase !== 'string' || !Array.isArray(data.databases)) {
    throw new QueryApiError('Malformed database catalog payload from server', 502)
  }

  return {
    currentDatabase: data.currentDatabase,
    databases: data.databases.map((database) => String(database)),
  }
}

export async function fetchDatabaseSchema(
  database: string,
  signal?: AbortSignal,
): Promise<DatabaseSchema> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return mockDatabaseSchemaFor(database)
  }

  const url = `${schemaUrl()}?database=${encodeURIComponent(database)}`
  const data = await requestJson<Partial<DatabaseSchema>>(url, signal)
  if (typeof data.database !== 'string' || !Array.isArray(data.tables)) {
    throw new QueryApiError('Malformed schema payload from server', 502)
  }

  return {
    database: data.database,
    tables: data.tables.map((table) => String(table)),
  }
}

export async function fetchDatabaseSchemaDetails(
  database: string,
  signal?: AbortSignal,
): Promise<DatabaseSchemaDetails> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return mockDatabaseSchemaDetailsFor(database)
  }

  const url = `${schemaUrl()}/details?database=${encodeURIComponent(database)}`
  const data = await requestJson<Partial<DatabaseSchemaDetails>>(url, signal)
  if (typeof data.database !== 'string' || !data.tableColumns || typeof data.tableColumns !== 'object') {
    throw new QueryApiError('Malformed schema details payload from server', 502)
  }

  const tableColumns = Object.fromEntries(
    Object.entries(data.tableColumns).map(([table, columns]) => [
      String(table),
      Array.isArray(columns) ? columns.map((column) => String(column)) : [],
    ]),
  )

  return { database: data.database, tableColumns }
}

export async function fetchTablePreview(
  table: string,
  database: string,
  signal?: AbortSignal,
  limit = 25,
): Promise<TablePreview> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return mockTablePreview(table, limit)
  }

  const url = `${schemaUrl()}/${encodeURIComponent(table)}/preview?database=${encodeURIComponent(database)}&limit=${limit}`
  const data = await requestJson<Partial<TablePreview>>(url, signal)

  if (
    typeof data.database !== 'string' ||
    typeof data.table !== 'string' ||
    !Array.isArray(data.columns) ||
    !Array.isArray(data.rows) ||
    !data.meta
  ) {
    throw new QueryApiError('Malformed table preview payload from server', 502)
  }

  return {
    ...data,
    columnMeta: Array.isArray(data.columnMeta)
      ? data.columnMeta.map((col) => ({
          name: String(col?.name ?? ''),
          type: String(col?.type ?? ''),
          key: String(col?.key ?? ''),
        }))
      : [],
    foreignKeys: Array.isArray(data.foreignKeys)
      ? data.foreignKeys.map((fk) => ({
          column: String(fk?.column ?? ''),
          referencedTable: String(fk?.referencedTable ?? ''),
          referencedColumn: String(fk?.referencedColumn ?? ''),
        }))
      : [],
  } as TablePreview
}

export async function fetchDatabaseRelations(
  database: string,
  signal?: AbortSignal,
): Promise<DatabaseRelations> {
  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return mockDatabaseRelations(database)
  }

  const url = `${schemaUrl()}/relations?database=${encodeURIComponent(database)}`
  const data = await requestJson<Partial<DatabaseRelations>>(url, signal)

  if (
    typeof data.database !== 'string' ||
    !Array.isArray(data.tables) ||
    !Array.isArray(data.relations) ||
    !data.tableColumns ||
    typeof data.tableColumns !== 'object'
  ) {
    throw new QueryApiError('Malformed schema relations payload from server', 502)
  }

  const tableColumns = Object.fromEntries(
    Object.entries(data.tableColumns).map(([table, columns]) => [
      String(table),
      Array.isArray(columns)
        ? columns.map((column) => ({
            name: String(column?.name ?? ''),
            type: String(column?.type ?? ''),
            isPrimaryKey: Boolean(column?.isPrimaryKey),
            isForeignKey: Boolean(column?.isForeignKey),
          }))
        : [],
    ]),
  )

  return {
    database: data.database,
    tables: data.tables.map((table) => String(table)),
    relations: data.relations.map((relation) => ({
      constraintName: String(relation?.constraintName ?? ''),
      fromTable: String(relation?.fromTable ?? ''),
      fromColumn: String(relation?.fromColumn ?? ''),
      toTable: String(relation?.toTable ?? ''),
      toColumn: String(relation?.toColumn ?? ''),
    })),
    tableColumns,
  }
}