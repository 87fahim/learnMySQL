# Frontend setup (React + Vite)

The **frontend** lives in `src/` at the **repository root**. It is a React application built with **Vite**. In development, it calls the backend through relative URLs like `/api/...`, and **Vite proxies** those requests to your Express server (by default `http://localhost:4000`).

If you are new to web development, treat this document as a checklist: install tools → install packages → optional env file → start the dev server.

---

## What you will have when you are done

- **Node.js** and **npm** installed.
- Project dependencies in `node_modules/` at the repo root.
- (Recommended) Backend running so the UI can load real data — see **[server/README.md](./server/README.md)**.
- A command you can run to open the app (usually **http://localhost:5173**).

---

## Step 1 — Get the project on your computer

If you already cloned the repo for the backend, you can skip this.

1. Install **Git** from [https://git-scm.com/downloads](https://git-scm.com/downloads) if needed.
2. Clone the repository and enter it:

   ```bash
   git clone https://github.com/87fahim/learnMySQL.git
   cd learnMySQL
   ```

Confirm you see `package.json`, `vite.config.ts`, and a `src/` folder at the **top level** of the project.

---

## Step 2 — Install Node.js (required)

1. Download the **LTS** version from [https://nodejs.org/](https://nodejs.org/) (use **Node 20+** if possible).
2. Install with default options.
3. Open a terminal and verify:

   ```bash
   node -v
   npm -v
   ```

---

## Step 3 — Install editor (optional but helpful)

You can use **VS Code** or **Cursor**. Both work well with TypeScript and React.

- VS Code: [https://code.visualstudio.com/](https://code.visualstudio.com/)

No extra global tools are **required** beyond Node/npm for this project (Vite and ESLint come from npm dependencies).

---

## Step 4 — Install frontend npm dependencies

From the **repository root** (same folder as the root `package.json`):

```bash
npm install
```

What this does:

- Reads `package.json` and downloads packages into `./node_modules`.
- installs **Vite**, **React**, TypeScript typings, ESLint, **concurrently** (used by `npm run dev` at repo root when you run the full stack).

**If `npm install` fails:** delete `node_modules` and try again (`rm -rf node_modules` on macOS/Linux, or remove the folder in Explorer on Windows), then rerun `npm install`.

---

## Step 5 — (Recommended) Install backend dependencies too

The UI expects an API during normal use. From the repo root:

```bash
npm --prefix ./server install
```

Full backend setup is described in **[server/README.md](./server/README.md)** (MySQL installation, `server/.env`, etc.).

---

## Step 6 — Environment file at the repo root (`optional` for beginners)

Most local development works **without** creating `.env`. The frontend calls `/api/...` and Vite forwards that to `http://localhost:4000` by default (`vite.config.ts`).

### When you might create `.env`

1. Copy the example:

   ```bash
   cp .env.example .env
   ```

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` only if you **change ports** or need a specific setup:

   | Variable | Purpose |
   |----------|---------|
   | `VITE_API_PROXY_TARGET` | Where Vite proxies `/api` during `npm run dev`. Default backend: `http://localhost:4000`. |
   | `VITE_API_BASE_URL` | Usually **omit in dev**; the comments in `.env.example` explain proxy behavior. |

**Credentials for MySQL never go in this file.** They belong in **`server/.env`** only.

---

## Step 7 — Start the frontend (two common ways)

### Option A — Full stack from repo root (simplest day-to-day)

Starts MySQL auto-helper (Windows), backend watch mode, **and** Vite together:

```bash
npm run dev
```

Then open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Option B — Frontend only (for UI work when API is already running elsewhere)

Terminal 1 (backend):

```bash
npm --prefix ./server run dev
```

Terminal 2 (frontend):

```bash
npx vite
```

(or `npm run dev` minus the concurrently part is not wired — so use **`npx vite`** from root for frontend-only.)

If the API is **not** on port 4000, set **`VITE_API_PROXY_TARGET`** in `.env` to match **`PORT`** in `server/.env`, then restart Vite.

---

## Step 8 — Build production assets (later / optional)

From repo root:

```bash
npm run build
npm run preview
```

`preview` serves the optimized build locally so you can sanity-check production output.

---

## Step 9 — Linting (optional)

```bash
npm run lint
```

Fix reported issues before opening a PR or when ESLint warns in CI.

---

## Step 10 — Common problems

| Symptom | What to try |
|---------|--------------|
| Blank data / network errors | Is the backend running on the port expected by `VITE_API_PROXY_TARGET`? See **[server/README.md](./server/README.md)**. |
| `concurrently is not recognized` (Windows) | Run `npm install` at repo root so `node_modules` includes dev tools; the root `npm run dev` uses `npx concurrently`. |
| CORS errors in browser | Prefer dev proxy (`/api`) rather than pointing the browser straight at another origin; backend `CORS_ORIGIN` is optional for local work. |
| Port 5173 already in use | Stop the other dev server or run Vite with a different port (`npx vite --port 5174`). |

---

## Where important files live

| Path | Purpose |
|------|---------|
| `src/main.tsx` | React entry |
| `src/App.tsx` | Top-level UI layout |
| `src/api/` | Fetch helpers (`runQuery`, schema explorer clients) |
| `src/components/` | Database explorer, diagram, workspace |
| `vite.config.ts` | Dev server & `/api` proxy target |
| `.env.example` | Documented optional frontend variables |

---

## Next steps

- **Backend + MySQL:** **[server/README.md](./server/README.md)**  
- **Project overview (features, API list, screenshots):** **[README.md](./README.md)**  
