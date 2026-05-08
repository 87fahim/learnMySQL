export type RelationLine = {
  key: string
  x1: number
  y1: number
  x2: number
  y2: number
  startSide: 'left' | 'right'
  endSide: 'left' | 'right'
  mode: 'opposite' | 'same-side'
  laneX: number
}

export type TablePosition = {
  x: number
  y: number
}

export type RouteAdjustment = {
  x: number
}

export type Rect = {
  left: number
  right: number
  top: number
  bottom: number
}

export const CARD_WIDTH = 240
export const CARD_HEIGHT = 260
export const GRID_GAP_X = 20
export const GRID_GAP_Y = 20
export const CONNECTOR_CORNER_RADIUS = 16
