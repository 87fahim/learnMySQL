import { useEffect, useMemo, useRef, useState } from 'react'
import type { DatabaseRelations } from '../api/types'
import { buildRelationLines } from './relationshipDiagram/buildRelationLines'
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  CONNECTOR_CORNER_RADIUS,
  GRID_GAP_X,
  GRID_GAP_Y,
  type RelationLine,
  type RouteAdjustment,
  type TablePosition,
} from './relationshipDiagram/model'
import { buildRoundedElbowPath } from './relationshipDiagram/pathUtils'
import './RelationshipDiagram.css'

type Props = {
  data: DatabaseRelations
}

export function RelationshipDiagram({ data }: Props) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [lines, setLines] = useState<RelationLine[]>([])
  const [positions, setPositions] = useState<Record<string, TablePosition>>({})
  const [activeDragTable, setActiveDragTable] = useState<string | null>(null)
  const [focusedTable, setFocusedTable] = useState<string | null>(null)
  const [draggingEnabled, setDraggingEnabled] = useState(false)
  const [routeAdjustments, setRouteAdjustments] = useState<Record<string, RouteAdjustment>>({})

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
    setFocusedTable((prev) => (prev && seeded[prev] ? prev : sortedTables[0] ?? null))
  }, [sortedTables])

  useEffect(() => {
    if (activeDragTable) return
    const timer = window.setTimeout(() => setDraggingEnabled(true), 0)
    return () => window.clearTimeout(timer)
  }, [activeDragTable, positions])

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

  useEffect(() => {
    const refreshLines = () => {
      const root = canvasRef.current
      const grid = gridRef.current
      if (!root || !grid) return
      setLines(
        buildRelationLines({
          root,
          grid,
          data,
          routeAdjustments,
          canvasWidth: canvasSize.width,
        }),
      )
    }

    const frame = requestAnimationFrame(refreshLines)
    window.addEventListener('resize', refreshLines)
    window.addEventListener('scroll', refreshLines, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', refreshLines)
      window.removeEventListener('scroll', refreshLines, true)
    }
  }, [data, positions, activeDragTable, draggingEnabled, routeAdjustments, canvasSize.width])

  const startDrag = (table: string, event: React.PointerEvent<HTMLElement>) => {
    const root = canvasRef.current
    const current = positions[table]
    if (!root || !current) return

    event.preventDefault()
    setFocusedTable(table)
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

  const startRouteDrag = (
    event: React.PointerEvent<SVGCircleElement>,
    key: string,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    ;(event.currentTarget as SVGCircleElement).setPointerCapture(event.pointerId)

    const startX = event.clientX
    const initial = routeAdjustments[key] ?? { x: 0 }

    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      setRouteAdjustments((prev) => ({
        ...prev,
        [key]: { x: initial.x + dx },
      }))
    }

    const stop = () => {
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
            const d = buildRoundedElbowPath(
              line.x1,
              line.y1,
              line.laneX,
              line.x2,
              line.y2,
              CONNECTOR_CORNER_RADIUS,
            )
            const minHandleSegment = 34
            const leftHorizontalLen = Math.abs(line.laneX - line.x1)
            const rightHorizontalLen = Math.abs(line.x2 - line.laneX)
            const verticalLen = Math.abs(line.y2 - line.y1)

            // Anchor only on interior vertical segment; never on table-edge segments.
            // Hide if any connected segment is too short.
            const showXHandle =
              leftHorizontalLen >= minHandleSegment &&
              rightHorizontalLen >= minHandleSegment &&
              verticalLen >= minHandleSegment
            return (
              <g key={line.key}>
                <path d={d} />
                {showXHandle ? (
                  <circle
                    className="relation-handle axis-x"
                    cx={line.laneX}
                    cy={(line.y1 + line.y2) / 2}
                    r={4}
                    onPointerDown={(event) => startRouteDrag(event, line.key)}
                  />
                ) : null}
              </g>
            )
          })}
        </svg>
        {sortedTables.map((table) => {
          const columns = data.tableColumns[table] ?? []
          const position = positions[table] ?? { x: 0, y: 0 }
          return (
            <article
              key={table}
              className={`relation-table-card${activeDragTable === table ? ' dragging' : ''}${focusedTable === table ? ' focused' : ''}`}
              style={{ left: `${position.x}px`, top: `${position.y}px`, width: `${CARD_WIDTH}px` }}
              onMouseDown={() => setFocusedTable(table)}
              data-table-name={table}
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

