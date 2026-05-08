import type { QuerySuccess } from '../api/types'

type Props = {
  result: QuerySuccess
  foreignKeyTargets?: Record<string, string>
  onForeignKeyClick?: (column: string, targetTable: string) => void
  columnMeta?: Record<string, { type: string; key: string }>
}

const LONG_TEXT_LIMIT = 42
const LONG_TYPE_LIMIT = 32
const IMAGE_COLUMN_HINTS = ['image', 'img', 'photo', 'picture', 'avatar', 'icon', 'logo', 'thumbnail']

function cellValue(v: string | number | boolean | null): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function isImageColumn(column: string): boolean {
  const lower = column.toLowerCase()
  return IMAGE_COLUMN_HINTS.some((hint) => lower.includes(hint))
}

function isLikelyImageValue(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  if (value.startsWith('data:image/')) return true
  if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(value)) return true
  if (/^[0-9a-f]+$/i.test(value) && value.length > 120) return true
  if (/^[A-Za-z0-9+/=]+$/.test(value) && value.length > 180) return true
  return false
}

function shortText(text: string): string {
  if (text.length <= LONG_TEXT_LIMIT) return text
  return `${text.slice(0, LONG_TEXT_LIMIT - 3)}...`
}

function shortType(text: string): string {
  if (text.length <= LONG_TYPE_LIMIT) return text
  return `${text.slice(0, LONG_TYPE_LIMIT - 3)}...`
}

function displayCell(column: string, value: string | number | boolean | null): string {
  const text = cellValue(value)
  if (!text) return ''
  if (isImageColumn(column) || isLikelyImageValue(text)) return 'picture...'
  return shortText(text)
}

export function Table({ result, foreignKeyTargets, onForeignKeyClick, columnMeta }: Props) {
  const { columns, rows, meta } = result

  if (columns.length === 0) {
    return (
      <p className="table-empty" role="status">
        Query returned no columns.
        {meta.rowCount === 0 ? ' (0 rows)' : null}
      </p>
    )
  }

  return (
    <div className="table-wrap">
      <div
        className="table-scroll"
        role="region"
        aria-label="Query result"
        tabIndex={0}
      >
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col">
                  {columnMeta?.[c] ? (
                    <span
                      className="table-col-type"
                      title={`${columnMeta[c].type}${columnMeta[c].key ? ` (${columnMeta[c].key})` : ''}`}
                    >
                      {shortType(columnMeta[c].type)}
                      {columnMeta[c].key === 'PRI' ? ' · PK' : ''}
                      {columnMeta[c].key === 'MUL' ? ' · FK' : ''}
                    </span>
                  ) : null}
                  {foreignKeyTargets?.[c] && onForeignKeyClick ? (
                    <button
                      type="button"
                      className="table-col-link"
                      title={`Open related table ${foreignKeyTargets[c]}`}
                      onClick={() => onForeignKeyClick(c, foreignKeyTargets[c])}
                    >
                      {c}
                    </button>
                  ) : (
                    c
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty-cell">
                  No rows
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const cells = [...row]
                while (cells.length < columns.length) cells.push('')
                const display = cells.slice(0, columns.length)
                return (
                  <tr key={i}>
                    {display.map((cell, j) => {
                      const fullValue = cellValue(cell)
                      const shown = displayCell(columns[j], cell)
                      return (
                        <td key={j} title={fullValue || undefined}>
                          <span className="table-cell-text">{shown}</span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="table-meta">
        {meta.rowCount} row{meta.rowCount === 1 ? '' : 's'}
        {meta.truncated ? ' (truncated)' : ''}
        {meta.executionMs != null ? ` · ${meta.executionMs} ms` : ''}
      </p>
    </div>
  )
}
