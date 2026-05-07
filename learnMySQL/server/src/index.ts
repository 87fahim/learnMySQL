import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import mysql from 'mysql2/promise'
import { loadEnv } from './env.js'
import { sanitizeAndGuardSql } from './queryGuard.js'
import { cellValue } from './serializeRow.js'

type QuerySuccessBody = {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  meta: { rowCount: number; truncated: boolean; executionMs: number }
}

type SchemaSuccessBody = {
  database: string
  tables: string[]
}

type SchemaDetailsBody = {
  database: string
  tableColumns: Record<string, string[]>
}

type DatabaseCatalogBody = {
  currentDatabase: string
  databases: string[]
}

type TablePreviewBody = QuerySuccessBody & {
  database: string
  table: string
  columnMeta: { name: string; type: string; key: string }[]
  foreignKeys: { column: string; referencedTable: string; referencedColumn: string }[]
}

type TableRelation = {
  constraintName: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

type SchemaRelationsBody = {
  database: string
  tables: string[]
  relations: TableRelation[]
  tableColumns: Record<
    string,
    { name: string; type: string; isPrimaryKey: boolean; isForeignKey: boolean }[]
  >
}

const env = loadEnv()

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 8,
})

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '128kb' }))

const corsOrigin = env.CORS_ORIGIN?.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: corsOrigin?.length ? corsOrigin : undefined,
    credentials: true,
  }),
)

async function setSessionTimeout(connection: mysql.PoolConnection): Promise<void> {
  try {
    const ms = Math.min(env.QUERY_TIMEOUT_MS, 4_294_967_295)
    await connection.query('SET SESSION max_execution_time = ?', [ms])
  } catch {
    // Older MySQL / MariaDB may not support this variable; queries still run.
  }
}

function toQuerySuccessBody(
  rowObjects: mysql.RowDataPacket[],
  fields: mysql.FieldPacket[] | undefined,
  started: number,
): QuerySuccessBody {
  const cols = Array.isArray(fields) ? fields.map((field) => String(field.name)) : []
  const max = env.MAX_ROWS
  let truncated = false
  let slice = rowObjects

  if (rowObjects.length > max) {
    truncated = true
    slice = rowObjects.slice(0, max)
  }

  const tableRows =
    cols.length === 0
      ? slice.map(() => [] as (string | number | boolean | null)[])
      : slice.map((row) => cols.map((col) => cellValue(row[col])))

  return {
    columns: cols,
    rows: tableRows,
    meta: {
      rowCount: rowObjects.length,
      truncated,
      executionMs: Math.round(performance.now() - started),
    },
  }
}

function parseOptionalDatabase(
  raw: unknown,
): { ok: true; database?: string } | { ok: false; message: string } {
  if (raw == null) return { ok: true }
  if (typeof raw !== 'string') {
    return { ok: false, message: 'Database must be a string when provided.' }
  }

  const database = raw.trim()
  if (!database) {
    return { ok: false, message: 'Database name cannot be empty.' }
  }

  return { ok: true, database }
}

async function selectDatabase(
  connection: mysql.PoolConnection,
  database?: string,
): Promise<string> {
  if (database) {
    await connection.changeUser({ database })
    return database
  }

  return env.DB_NAME
}

async function currentDatabaseName(connection: mysql.PoolConnection): Promise<string> {
  const [rows] = await connection.query('SELECT DATABASE() AS current_database')
  return Array.isArray(rows)
    ? String((rows[0] as mysql.RowDataPacket | undefined)?.current_database ?? env.DB_NAME)
    : env.DB_NAME
}

app.post('/api/v1/query', async (req, res) => {
  const started = performance.now()

  const body = req.body as { sql?: unknown; database?: unknown }
  const rawSql = body?.sql
  if (typeof rawSql !== 'string') {
    res.status(400).json({
      code: 'VALIDATION',
      message: 'Body must include a string sql field.',
    })
    return
  }

  const guard = sanitizeAndGuardSql(rawSql)
  if (!guard.ok) {
    res.status(400).json({ code: 'POLICY', message: guard.message })
    return
  }

  const requestedDatabase = parseOptionalDatabase(body?.database)
  if (!requestedDatabase.ok) {
    res.status(400).json({ code: 'VALIDATION', message: requestedDatabase.message })
    return
  }

  let connection: mysql.PoolConnection | undefined

  try {
    connection = await pool.getConnection()
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({
      code: 'DB_UNAVAILABLE',
      message: `Could not connect to MySQL: ${detail}`,
    })
    return
  }

  try {
    await selectDatabase(connection, requestedDatabase.database)
    await setSessionTimeout(connection)

    const [rows, fields] = await connection.query(guard.sql)

    if (!Array.isArray(rows)) {
      res.status(400).json({
        code: 'NOT_SELECT',
        message:
          'Statement did not return a result set. Use SELECT / SHOW / EXPLAIN forms that return rows.',
      })
      return
    }

    const payload = toQuerySuccessBody(
      rows as mysql.RowDataPacket[],
      fields as mysql.FieldPacket[] | undefined,
      started,
    )
    res.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Query failed.'
    res.status(400).json({ code: 'SQL_ERROR', message: msg })
  } finally {
    connection.release()
  }
})

app.get('/api/v1/databases', async (_req, res) => {
  let connection: mysql.PoolConnection | undefined

  try {
    connection = await pool.getConnection()
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({
      code: 'DB_UNAVAILABLE',
      message: `Could not connect to MySQL: ${detail}`,
    })
    return
  }

  try {
    const currentDatabase = await currentDatabaseName(connection)
    const [databaseRows] = await connection.query('SHOW DATABASES')

    const databases = Array.isArray(databaseRows)
      ? (databaseRows as mysql.RowDataPacket[])
          .map((row) => {
            const [value] = Object.values(row)
            return typeof value === 'string' ? value : String(value ?? '')
          })
          .filter(Boolean)
      : []

    const payload: DatabaseCatalogBody = { currentDatabase, databases }
    res.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load databases.'
    res.status(400).json({ code: 'DATABASES_ERROR', message: msg })
  } finally {
    connection.release()
  }
})

app.get('/api/v1/schema', async (req, res) => {
  const requestedDatabase = parseOptionalDatabase(req.query.database)
  if (!requestedDatabase.ok) {
    res.status(400).json({ code: 'VALIDATION', message: requestedDatabase.message })
    return
  }

  let connection: mysql.PoolConnection | undefined

  try {
    connection = await pool.getConnection()
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({
      code: 'DB_UNAVAILABLE',
      message: `Could not connect to MySQL: ${detail}`,
    })
    return
  }

  try {
    const database = await selectDatabase(connection, requestedDatabase.database)
    const [tableRows] = await connection.query('SHOW TABLES')

    const tables = Array.isArray(tableRows)
      ? (tableRows as mysql.RowDataPacket[])
          .map((row) => {
            const [value] = Object.values(row)
            return typeof value === 'string' ? value : String(value ?? '')
          })
          .filter(Boolean)
      : []

    const payload: SchemaSuccessBody = { database, tables }
    res.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load schema.'
    res.status(400).json({ code: 'SCHEMA_ERROR', message: msg })
  } finally {
    connection.release()
  }
})

app.get('/api/v1/schema/details', async (req, res) => {
  const requestedDatabase = parseOptionalDatabase(req.query.database)
  if (!requestedDatabase.ok) {
    res.status(400).json({ code: 'VALIDATION', message: requestedDatabase.message })
    return
  }

  let connection: mysql.PoolConnection | undefined

  try {
    connection = await pool.getConnection()
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({
      code: 'DB_UNAVAILABLE',
      message: `Could not connect to MySQL: ${detail}`,
    })
    return
  }

  try {
    const database = await selectDatabase(connection, requestedDatabase.database)
    const tableColumns: Record<string, string[]> = {}
    const [tableRows] = await connection.query('SHOW TABLES')
    const tables = Array.isArray(tableRows)
      ? (tableRows as mysql.RowDataPacket[])
          .map((row) => {
            const [value] = Object.values(row)
            return typeof value === 'string' ? value : String(value ?? '')
          })
          .filter(Boolean)
      : []

    for (const table of tables) {
      const [columnsRows] = await connection.query(`SHOW COLUMNS FROM ${mysql.escapeId(table)}`)
      tableColumns[table] = Array.isArray(columnsRows)
        ? (columnsRows as mysql.RowDataPacket[])
            .map((row) => String(row.Field ?? ''))
            .filter(Boolean)
        : []
    }

    const payload: SchemaDetailsBody = { database, tableColumns }
    res.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load schema details.'
    res.status(400).json({ code: 'SCHEMA_DETAILS_ERROR', message: msg })
  } finally {
    connection.release()
  }
})

app.get('/api/v1/schema/:table/preview', async (req, res) => {
  const table = req.params.table?.trim()
  if (!table) {
    res.status(400).json({
      code: 'VALIDATION',
      message: 'A table name is required.',
    })
    return
  }

  const requestedDatabase = parseOptionalDatabase(req.query.database)
  if (!requestedDatabase.ok) {
    res.status(400).json({ code: 'VALIDATION', message: requestedDatabase.message })
    return
  }

  const limitValue = Number(req.query.limit)
  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(Math.trunc(limitValue), 1), Math.min(env.MAX_ROWS, 100))
    : 25

  let connection: mysql.PoolConnection | undefined

  try {
    connection = await pool.getConnection()
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({
      code: 'DB_UNAVAILABLE',
      message: `Could not connect to MySQL: ${detail}`,
    })
    return
  }

  const started = performance.now()

  try {
    const database = await selectDatabase(connection, requestedDatabase.database)
    await setSessionTimeout(connection)

    const sql = `SELECT * FROM ${mysql.escapeId(table)} LIMIT ${limit}`
    const [rows, fields] = await connection.query(sql)
    const [describeRows] = await connection.query(`DESCRIBE ${mysql.escapeId(table)}`)
    const [foreignKeyRows] = await connection.query(
      `SELECT
        column_name AS columnName,
        referenced_table_name AS referencedTableName,
        referenced_column_name AS referencedColumnName
      FROM information_schema.key_column_usage
      WHERE table_schema = ?
        AND table_name = ?
        AND referenced_table_name IS NOT NULL
      ORDER BY ordinal_position`,
      [database, table],
    )

    if (!Array.isArray(rows)) {
      res.status(400).json({
        code: 'NOT_SELECT',
        message: 'Selected table could not be previewed.',
      })
      return
    }

    const payload: TablePreviewBody = {
      database,
      table,
      columnMeta: Array.isArray(describeRows)
        ? (describeRows as mysql.RowDataPacket[]).map((row) => ({
            name: String(row.Field ?? ''),
            type: String(row.Type ?? ''),
            key: String(row.Key ?? ''),
          }))
        : [],
      foreignKeys: Array.isArray(foreignKeyRows)
        ? (foreignKeyRows as mysql.RowDataPacket[]).map((row) => ({
            column: String(row.columnName ?? ''),
            referencedTable: String(row.referencedTableName ?? ''),
            referencedColumn: String(row.referencedColumnName ?? ''),
          }))
        : [],
      ...toQuerySuccessBody(
        rows as mysql.RowDataPacket[],
        fields as mysql.FieldPacket[] | undefined,
        started,
      ),
    }
    res.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not preview table.'
    res.status(400).json({ code: 'TABLE_PREVIEW_ERROR', message: msg })
  } finally {
    connection.release()
  }
})

app.get('/api/v1/schema/relations', async (req, res) => {
  const requestedDatabase = parseOptionalDatabase(req.query.database)
  if (!requestedDatabase.ok) {
    res.status(400).json({ code: 'VALIDATION', message: requestedDatabase.message })
    return
  }

  let connection: mysql.PoolConnection | undefined

  try {
    connection = await pool.getConnection()
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'Unknown error'
    res.status(503).json({
      code: 'DB_UNAVAILABLE',
      message: `Could not connect to MySQL: ${detail}`,
    })
    return
  }

  try {
    const database = await selectDatabase(connection, requestedDatabase.database)
    const [tableRows] = await connection.query('SHOW TABLES')
    const tables = Array.isArray(tableRows)
      ? (tableRows as mysql.RowDataPacket[])
          .map((row) => {
            const [value] = Object.values(row)
            return typeof value === 'string' ? value : String(value ?? '')
          })
          .filter(Boolean)
      : []

    const [relationRows] = await connection.query(
      `SELECT
        constraint_name AS constraintName,
        table_name AS fromTable,
        column_name AS fromColumn,
        referenced_table_name AS toTable,
        referenced_column_name AS toColumn
      FROM information_schema.key_column_usage
      WHERE table_schema = ?
        AND referenced_table_name IS NOT NULL
      ORDER BY table_name, column_name`,
      [database],
    )

    const relations = Array.isArray(relationRows)
      ? (relationRows as mysql.RowDataPacket[]).map((row) => ({
          constraintName: String(row.constraintName ?? ''),
          fromTable: String(row.fromTable ?? ''),
          fromColumn: String(row.fromColumn ?? ''),
          toTable: String(row.toTable ?? ''),
          toColumn: String(row.toColumn ?? ''),
        }))
          .filter((relation) => relation.fromTable && relation.fromColumn && relation.toTable && relation.toColumn)
      : []

    const foreignKeyLookup = new Set(relations.map((relation) => `${relation.fromTable}.${relation.fromColumn}`))
    const tableColumns = tables.reduce<SchemaRelationsBody['tableColumns']>((acc, table) => {
      acc[table] = []
      return acc
    }, {})

    // Use SHOW COLUMNS for each table for better compatibility.
    for (const table of tables) {
      const [fallbackRows] = await connection.query(`SHOW COLUMNS FROM ${mysql.escapeId(table)}`)
      tableColumns[table] = Array.isArray(fallbackRows)
        ? (fallbackRows as mysql.RowDataPacket[]).map((row) => {
            const name = String(row.Field ?? '')
            return {
              name,
              type: String(row.Type ?? ''),
              isPrimaryKey: String(row.Key ?? '') === 'PRI',
              isForeignKey: foreignKeyLookup.has(`${table}.${name}`),
            }
          })
        : []
    }

    const payload: SchemaRelationsBody = { database, tables, relations, tableColumns }
    res.json(payload)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not load schema relationships.'
    res.status(400).json({ code: 'SCHEMA_RELATION_ERROR', message: msg })
  } finally {
    connection.release()
  }
})

app.get('/healthz', (_req, res) => {
  res.json({ ok: true })
})

app.listen(env.PORT, () => {
  console.info(`learnmysql-api listening on http://localhost:${env.PORT}`)
})
