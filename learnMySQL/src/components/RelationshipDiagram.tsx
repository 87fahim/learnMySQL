import { useEffect, useMemo, useRef, useState } from 'react'
import type { DatabaseRelations } from '../api/types'

type Props = {
  data: DatabaseRelations
}

type RelationLine = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  startSide: 'left' | 'right'
  endSide: 'left' | 'right'
}

type TablePosition = {
  x: number
  y: number
}

const CARD_WIDTH = 240
const CARD_HEIGHT = 260
const GRID_GAP_X = 20
const GRID_GAP_Y = 20

export function RelationshipDiagram({ data }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [lines, setLines] = useState<RelationLine[]>([])
  const [positions, setPositions] = useState<Record<string, TablePosition>>({})
  const [activeDragTable, setActiveDragTable] = useState<string | null>(null)
  const [draggingEnabled, setDraggingEnabled] = useState(false)

  const sortedTables = useMemo(() => [...data.tables].sort((a, b) => a.localeCompare(b)), [data.tables])

  useEffect(() => {
    const columnCount = Math.max(1, Math.ceil(Math.sqrt(sortedTables.length)))
    const seeded = sortedTables.reduce<Record<string, TablePosition>>((acc, table, index) => {
      const col = index % columnCount
      const row = Math.floor(index / columnCount)
      acc[table] = {
        x: col * (CARD_WIDTH + GRID_GAP_X),
        y: row * (CARD_HEIGHT + GRID_GAP_Y),
      }
      return acc
    }, {})
    setPositions(seeded)
  }, [sortedTables])

  useEffect(() => {
    if (activeDragTable) return
    const timer = window.setTimeout(() => setDraggingEnabled(true), 0)
    return () => window.clearTimeout(timer)
  }, [activeDragTable, positions])

  useEffect(() => {
    const refreshLines = () => {
      const root = canvasRef.current
      const grid = gridRef.current
      if (!root || !grid) return

      const gridRect = grid.getBoundingClientRect()
      const nextLines = data.relations
        .map((relation) => {
          const fromEl = root.querySelector<HTMLElement>(
            `[data-column-key="${cssEscape(`${relation.fromTable}.${relation.fromColumn}`)}"]`,
          )
          const toEl = root.querySelector<HTMLElement>(
            `[data-column-key="${cssEscape(`${relation.toTable}.${relation.toColumn}`)}"]`,
          )
          if (!fromEl || !toEl) return null

          const fromRect = fromEl.getBoundingClientRect()
          const toRect = toEl.getBoundingClientRect()
          const fromCenterX = fromRect.left + fromRect.width / 2
          const toCenterX = toRect.left + toRect.width / 2
          const startSide: 'left' | 'right' = fromCenterX <= toCenterX ? 'right' : 'left'
          const endSide: 'left' | 'right' = startSide === 'right' ? 'left' : 'right'
          return {
            key: `${relation.fromTable}.${relation.fromColumn}->${relation.toTable}.${relation.toColumn}`,
            x1: (startSide === 'right' ? fromRect.right : fromRect.left) - gridRect.left,
            y1: fromRect.top + fromRect.height / 2 - gridRect.top,
            x2: (endSide === 'right' ? toRect.right : toRect.left) - gridRect.left,
            y2: toRect.top + toRect.height / 2 - gridRect.top,
            startSide,
            endSide,
          }
        })
        .filter((line): line is RelationLine => line !== null)

      setLines(nextLines)
    }

    const frame = requestAnimationFrame(refreshLines)
    window.addEventListener('resize', refreshLines)
    window.addEventListener('scroll', refreshLines, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', refreshLines)
      window.removeEventListener('scroll', refreshLines, true)
    }
  }, [data, positions, activeDragTable, draggingEnabled])

  const canvasSize = useMemo(() => {
    const values = Object.values(positions)
    if (values.length === 0) {
      return { width: CARD_WIDTH + GRID_GAP_X, height: CARD_HEIGHT + GRID_GAP_Y }
    }
    const maxX = Math.max(...values.map((value) => value.x))
    const maxY = Math.max(...values.map((value) => value.y))
    return {
      width: maxX + CARD_WIDTH + GRID_GAP_X,
      height: maxY + CARD_HEIGHT + GRID_GAP_Y,
    }
  }, [positions])

  const startDrag = (table: string, event: React.PointerEvent<HTMLElement>) => {
    const root = canvasRef.current
    const current = positions[table]
    if (!root || !current) return

    event.preventDefault()
    setActiveDragTable(table)
    setDraggingEnabled(false)
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)

    const rootRect = root.getBoundingClientRect()
    const startOffsetX = event.clientX - rootRect.left - current.x
    const startOffsetY = event.clientY - rootRect.top - current.y

    const move = (moveEvent: PointerEvent) => {
      const nextX = Math.max(0, moveEvent.clientX - rootRect.left - startOffsetX)
      const nextY = Math.max(0, moveEvent.clientY - rootRect.top - startOffsetY)
      setPositions((prev) => ({
        ...prev,
        [table]: { x: nextX, y: nextY },
      }))
    }

    const stop = () => {
      setActiveDragTable(null)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
  }

  return (
    <div className="relation-diagram" ref={canvasRef}>
      <div
        className="relation-table-grid"
        ref={gridRef}
        style={{ width: canvasSize.width, height: canvasSize.height }}
      >
        <svg className="relation-lines" aria-hidden="true" style={{ width: canvasSize.width, height: canvasSize.height }}>
          {lines.map((line) => {
            const dx = Math.abs(line.x2 - line.x1)
            const controlOffset = Math.max(20, Math.min(90, dx * 0.4))
            const startDirection = line.startSide === 'right' ? 1 : -1
            const endDirection = line.endSide === 'right' ? 1 : -1
            const c1x = line.x1 + startDirection * controlOffset
            const c2x = line.x2 + endDirection * controlOffset
            const d = `M ${line.x1} ${line.y1} C ${c1x} ${line.y1}, ${c2x} ${line.y2}, ${line.x2} ${line.y2}`
            return <path key={line.key} d={d} />
          })}
        </svg>
        {sortedTables.map((table) => {
          const columns = data.tableColumns[table] ?? []
          const position = positions[table] ?? { x: 0, y: 0 }
          return (
            <article
              key={table}
              className={`relation-table-card${activeDragTable === table ? ' dragging' : ''}`}
              style={{ left: `${position.x}px`, top: `${position.y}px`, width: `${CARD_WIDTH}px` }}
            >
              <h3
                className="relation-table-handle"
                onPointerDown={(event) => startDrag(table, event)}
                title="Drag table"
              >
                {table}
              </h3>
              <ul>
                {columns.length > 0 ? (
                  columns.map((column) => (
                    <li key={column.name} data-column-key={`${table}.${column.name}`}>
                      <div className="relation-col-name-wrap">
                        <code>{column.name}</code>
                        {column.isPrimaryKey ? <span className="relation-pill pk">PK</span> : null}
                        {column.isForeignKey ? <span className="relation-pill fk">FK</span> : null}
                      </div>
                      <span className="relation-col-type">{column.type}</span>
                    </li>
                  ))
                ) : (
                  <li className="relation-empty">No columns returned.</li>
                )}
              </ul>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function cssEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
