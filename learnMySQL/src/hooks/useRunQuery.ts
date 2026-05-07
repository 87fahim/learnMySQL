import { useCallback, useRef, useState } from 'react'
import { runQuery } from '../api/runQuery'
import { QueryApiError, type QuerySuccess } from '../api/types'

type RunState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'success'; data: QuerySuccess }
  | { status: 'error'; error: QueryApiError | Error }

export function useRunQuery() {
  const [state, setState] = useState<RunState>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  const run = useCallback(async (sql: string, database?: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setState({ status: 'running' })

    try {
      const data = await runQuery(sql, { signal: ctrl.signal, database })
      if (!ctrl.signal.aborted) setState({ status: 'success', data })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (!ctrl.signal.aborted) {
        setState({
          status: 'error',
          error: e instanceof Error ? e : new Error(String(e)),
        })
      }
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setState({ status: 'idle' })
  }, [])

  return { state, run, reset }
}
