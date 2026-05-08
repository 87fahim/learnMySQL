import {
  QueryApiError,
  type ApiErrorBody,
  type QuerySuccess,
} from './types'

type RunQueryOptions = {
  signal?: AbortSignal
  database?: string
}

function queryUrl(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    '',
  )
  return `${base ?? ''}/api/v1/query`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function mockRunQuery(sql: string): Promise<QuerySuccess> {
  await sleep(250)
  const trimmed = sql.trim().toLowerCase()
  if (trimmed.startsWith('select') && trimmed.includes('error')) {
    throw new QueryApiError('Mock failure: query contains the word "error".', 400, {
      code: 'MOCK_ERROR',
      message: 'Replace "error" in your query to see mock success rows.',
    })
  }
  return {
    columns: ['message', 'note'],
    rows: [
      [
        'Mock API is enabled',
        'Set VITE_USE_MOCK_API=false and start your API to hit real MySQL.',
      ],
    ],
    meta: { rowCount: 1, truncated: false, executionMs: 12 },
  }
}

export async function runQuery(
  sql: string,
  options: RunQueryOptions = {},
): Promise<QuerySuccess> {
  const { signal, database } = options
  const text = sql.trim()
  if (!text) {
    throw new QueryApiError('Empty query', 400, {
      code: 'VALIDATION',
      message: 'Write a SQL statement before running.',
    })
  }

  if (import.meta.env.VITE_USE_MOCK_API === 'true') {
    return mockRunQuery(text)
  }

  let res: Response
  try {
    res = await fetch(queryUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: text, database }),
      signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    const msg =
      e instanceof Error ? e.message : 'Could not reach the API.'
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

  if (!isJson || !payload || typeof payload !== 'object') {
    throw new QueryApiError('Unexpected response from server', 502)
  }

  const data = payload as Partial<QuerySuccess>
  if (!Array.isArray(data.columns) || !Array.isArray(data.rows) || !data.meta) {
    throw new QueryApiError('Malformed success payload from server', 502)
  }

  return data as QuerySuccess
}
