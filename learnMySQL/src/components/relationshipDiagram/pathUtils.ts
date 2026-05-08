import type { Rect } from './model'

export function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: Rect,
): boolean {
  const minX = Math.min(x1, x2)
  const maxX = Math.max(x1, x2)
  const minY = Math.min(y1, y2)
  const maxY = Math.max(y1, y2)
  const overlapsX = maxX >= rect.left && minX <= rect.right
  const overlapsY = maxY >= rect.top && minY <= rect.bottom
  return overlapsX && overlapsY
}

export function buildRoundedElbowPath(
  x1: number,
  y1: number,
  cornerX: number,
  x2: number,
  y2: number,
  radius: number,
): string {
  const verticalDelta = Math.abs(y2 - y1)
  const inDelta = Math.abs(cornerX - x1)
  const outDelta = Math.abs(x2 - cornerX)
  const minElbowSegment = 24

  if (verticalDelta < minElbowSegment || inDelta < minElbowSegment || outDelta < minElbowSegment) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  const verticalDirection = Math.sign(y2 - y1) || 1
  const horizontalInDirection = Math.sign(cornerX - x1) || 1
  const horizontalOutDirection = Math.sign(x2 - cornerX) || 1
  const r1 = Math.min(radius, inDelta, verticalDelta)
  const r2 = Math.min(radius, outDelta, verticalDelta)

  const p1x = cornerX - horizontalInDirection * r1
  const p1y = y1
  const p2x = cornerX
  const p2y = y1 + verticalDirection * r1

  const p3x = cornerX
  const p3y = y2 - verticalDirection * r2
  const p4x = cornerX + horizontalOutDirection * r2
  const p4y = y2

  return [
    `M ${x1} ${y1}`,
    `L ${p1x} ${p1y}`,
    `Q ${cornerX} ${y1} ${p2x} ${p2y}`,
    `L ${p3x} ${p3y}`,
    `Q ${cornerX} ${y2} ${p4x} ${p4y}`,
    `L ${x2} ${y2}`,
  ].join(' ')
}
