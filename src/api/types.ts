export type QueryMeta = {
  rowCount: number
  truncated: boolean
  executionMs: number
}

export type QuerySuccess = {
  columns: string[]
  rows: (string | number | boolean | null)[][]
  meta: QueryMeta
}

export type DatabaseSchema = {
  database: string
  tables: string[]
}

export type DatabaseSchemaDetails = {
  database: string
  tableColumns: Record<string, string[]>
}

export type DatabaseCatalog = {
  currentDatabase: string
  databases: string[]
}

export type TablePreview = QuerySuccess & {
  database: string
  table: string
  columnMeta?: {
    name: string
    type: string
    key: string
  }[]
  foreignKeys?: {
    column: string
    referencedTable: string
    referencedColumn: string
  }[]
}

export type TableRelation = {
  constraintName: string
  fromTable: string
  fromColumn: string
  toTable: string
  toColumn: string
}

export type RelationTableColumn = {
  name: string
  type: string
  isPrimaryKey: boolean
  isForeignKey: boolean
}

export type DatabaseRelations = {
  database: string
  tables: string[]
  relations: TableRelation[]
  tableColumns: Record<string, RelationTableColumn[]>
}

export type ApiErrorBody = {
  code: string
  message: string
  details?: unknown
}

export class QueryApiError extends Error {
  readonly status: number
  readonly body?: ApiErrorBody

  constructor(message: string, status: number, body?: ApiErrorBody) {
    super(message)
    this.name = 'QueryApiError'
    this.status = status
    this.body = body
  }
}
