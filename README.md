# Learn MySQL

Learn MySQL is a local-first SQL practice app with:

- a React + Vite frontend
- an Express + MySQL backend API
- safe read-only query guardrails
- a visual schema relationship explorer (draggable tables + FK links)

---

## Features

- Run read-only SQL from a clean editor (`SELECT`, `WITH`, `SHOW`, `DESCRIBE`, `EXPLAIN`)
- View results in a scrollable table with metadata
- SQL auto-suggestions for tables and columns
- Database explorer:
  - table preview mode
  - relationship diagram mode
  - draggable relationship cards and link routing
  - maximize / restore explorer panel
- Backend safety:
  - blocks write/DDL statements
  - enforces single statement
  - query timeout and max row limits

---

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Express, TypeScript, mysql2, Zod
- Tooling: ESLint, TS project references

---

## Project Structure

```text
learnMySQL/
  src/                    # frontend app
    api/                  # frontend API clients
    components/           # UI components
    styles/               # modular CSS
    assets/               # README screenshots
  server/
    src/
      index.ts            # Express API + schema/query routes
      queryGuard.ts       # SQL safety rules
      env.ts              # validated env loading
```

---

## Setup

### 1) Prerequisites

- Node.js 20+
- npm 10+
- MySQL running locally

### 2) Install dependencies

```bash
npm install
npm --prefix ./server install
```

### 3) Configure environment

Copy examples and edit values:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Important:

- frontend `.env`: usually keep `VITE_API_BASE_URL` unset in dev (Vite proxy handles `/api`)
- backend `server/.env`: set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`

### 4) Run app

```bash
npm run dev
```

This starts both:

- API server (default `http://localhost:4000`)
- frontend dev server (default `http://localhost:5173`)

---

## Scripts

### Frontend root

- `npm run dev` - start MySQL helper + API + frontend
- `npm run build` - typecheck and build frontend
- `npm run lint` - run frontend lint
- `npm run preview` - preview production build

### Backend (`server/`)

- `npm --prefix ./server run dev` - backend watch mode
- `npm --prefix ./server run start` - backend start
- `npm --prefix ./server run lint` - backend typecheck

---

## API Endpoints

- `POST /api/v1/query` - execute guarded read-only SQL
- `GET /api/v1/databases` - list databases
- `GET /api/v1/schema?database=<db>` - list tables
- `GET /api/v1/schema/details?database=<db>` - table->column mapping
- `GET /api/v1/schema/:table/preview?database=<db>&limit=<n>` - preview rows + column metadata
- `GET /api/v1/schema/relations?database=<db>` - table relationship graph data
- `GET /healthz` - health check

---

## Security and Safety Notes

- Query guard only allows read-oriented SQL prefixes.
- Multiple statements are rejected.
- Backend sets per-session query timeout (`QUERY_TIMEOUT_MS`).
- Response rows are capped (`MAX_ROWS`).
- Frontend never connects directly to MySQL; all access goes through API.
- Keep secrets only in `server/.env`, never commit credentials.

---

## UI Walkthrough (Screenshots)

### Entire application

![Learn MySQL full app](./src/assets/All%20Together.png)

### SQL auto suggestion

![SQL auto suggestion](./src/assets/Auto%20Suggest.png)

### Query section (valid)

![Query section valid query](./src/assets/Query%20Section%20Valid%20Query.png)

### Query section (invalid)

![Query section invalid query](./src/assets/Query%20Section%20Invalid%20Query.png)

### Database explorer - table preview

![Database explorer table preview](./src/assets/Database%20Explorer%20TableView.png)

### Database explorer - relationships

![Database explorer relationships](./src/assets/Database%20Explorer%20Relationship.png)

---

## Troubleshooting

- If API is unreachable, verify `server/.env` credentials and MySQL status.
- If frontend cannot hit API in dev, confirm Vite proxy target and backend `PORT`.
- If relationships look stale, refresh after changing selected database.
- If MySQL permission errors appear, ensure your DB user can `SHOW` schema metadata.

---

## License

Internal / personal project unless you add a dedicated license file.
