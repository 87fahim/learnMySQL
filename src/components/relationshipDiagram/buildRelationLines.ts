import type { DatabaseRelations } from '../../api/types'
import type { Rect, RelationLine, RouteAdjustment } from './model'
import { segmentIntersectsRect } from './pathUtils'

type BuildLinesArgs = {
  root: HTMLDivElement
  grid: HTMLDivElement
  data: DatabaseRelations
  routeAdjustments: Record<string, RouteAdjustment>
  canvasWidth: number
}

export function buildRelationLines({
  root,
  grid,
  data,
  routeAdjustments,
  canvasWidth,
}: BuildLinesArgs): RelationLine[] {
  const gridRect = grid.getBoundingClientRect()
  const tableRects = readTableRects(root, gridRect)

  return data.relations
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
      const overlapInX = Math.min(fromRect.right, toRect.right) - Math.max(fromRect.left, toRect.left)
      const closeInX = overlapInX > 0 || Math.abs(fromCenterX - toCenterX) < 120

      let startSide: 'left' | 'right'
      let endSide: 'left' | 'right'
      let mode: 'opposite' | 'same-side'
      let baseLaneX: number

      if (closeInX) {
        const evaluateSide = (side: 'left' | 'right') => {
          const x1 = (side === 'right' ? fromRect.right : fromRect.left) - gridRect.left
          const y1 = fromRect.top + fromRect.height / 2 - gridRect.top
          const x2 = (side === 'right' ? toRect.right : toRect.left) - gridRect.left
          const y2 = toRect.top + toRect.height / 2 - gridRect.top
          const bend = Math.max(36, Math.min(120, Math.abs(y2 - y1) * 0.35 + 24))
          const outerX = side === 'right' ? Math.max(x1, x2) + bend : Math.min(x1, x2) - bend

          let intersections = 0
          for (const [tableName, rect] of tableRects.entries()) {
            if (tableName === relation.fromTable || tableName === relation.toTable) continue
            if (
              segmentIntersectsRect(x1, y1, outerX, y1, rect) ||
              segmentIntersectsRect(outerX, y1, outerX, y2, rect) ||
              segmentIntersectsRect(outerX, y2, x2, y2, rect)
            ) {
              intersections += 1
            }
          }

          const clearance =
            side === 'right'
              ? gridRect.right - Math.max(fromRect.right, toRect.right)
              : Math.min(fromRect.left, toRect.left) - gridRect.left
          return { intersections, clearance }
        }

        const leftCandidate = evaluateSide('left')
        const rightCandidate = evaluateSide('right')
        const sharedSide =
          leftCandidate.intersections !== rightCandidate.intersections
            ? leftCandidate.intersections < rightCandidate.intersections
              ? 'left'
              : 'right'
            : leftCandidate.clearance > rightCandidate.clearance
              ? 'left'
              : 'right'

        startSide = sharedSide
        endSide = sharedSide
        mode = 'same-side'
        const bend = Math.max(
          36,
          Math.min(
            120,
            Math.abs(toRect.top + toRect.height / 2 - (fromRect.top + fromRect.height / 2)) * 0.35 + 24,
          ),
        )
        baseLaneX =
          sharedSide === 'right'
            ? Math.max(fromRect.right, toRect.right) - gridRect.left + bend
            : Math.min(fromRect.left, toRect.left) - gridRect.left - bend
      } else {
        startSide = fromCenterX <= toCenterX ? 'right' : 'left'
        endSide = startSide === 'right' ? 'left' : 'right'
        mode = 'opposite'
        baseLaneX =
          ((startSide === 'right' ? fromRect.right : fromRect.left) - gridRect.left +
            (endSide === 'right' ? toRect.right : toRect.left) - gridRect.left) /
          2
      }

      const key = `${relation.fromTable}.${relation.fromColumn}->${relation.toTable}.${relation.toColumn}`
      const adjustment = routeAdjustments[key] ?? { x: 0 }
      const laneX = Math.min(Math.max(baseLaneX + adjustment.x, 2), canvasWidth - 2)

      return {
        key,
        x1: (startSide === 'right' ? fromRect.right : fromRect.left) - gridRect.left,
        y1: fromRect.top + fromRect.height / 2 - gridRect.top,
        x2: (endSide === 'right' ? toRect.right : toRect.left) - gridRect.left,
        y2: toRect.top + toRect.height / 2 - gridRect.top,
        startSide,
        endSide,
        mode,
        laneX,
      } as RelationLine
    })
    .filter((line): line is RelationLine => line !== null)
}

function readTableRects(
  root: HTMLDivElement,
  gridRect: DOMRect,
): Map<string, Rect> {
  const tableRects = new Map<string, Rect>()
  const tableCards = root.querySelectorAll<HTMLElement>('[data-table-name]')
  tableCards.forEach((card) => {
    const tableName = card.dataset.tableName
    if (!tableName) return
    const rect = card.getBoundingClientRect()
    tableRects.set(tableName, {
      left: rect.left - gridRect.left,
      right: rect.right - gridRect.left,
      top: rect.top - gridRect.top,
      bottom: rect.bottom - gridRect.top,
    })
  })
  return tableRects
}

function cssEscape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
