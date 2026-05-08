# Backend setup (Express + MySQL)

This folder is the **API server** for Learn MySQL. It talks to your local MySQL instance and exposes read-only HTTP endpoints to the React app.

If you have never set up a database or a Node server before, follow the steps **in order**. Skipping MySQL or environment configuration is the most common reason the app “cannot connect”.

---

## What you will have when you are done

- MySQL Server **installed** and **running** on your computer.
- At least **one database** your MySQL user can read (the app can list many databases; you pick one as the default in config).
- A `server/.env` file with correct **host, port, username, password, and default database name**.
- Node.js dependencies installed in `server/node_modules`.
- A running API you can check with `GET /healthz` (for example `http://localhost:4000/healthz`).

---

## Step 1 — Clone the repository

If you do not have the project yet:

1. Install **Git** from [https://git-scm.com/downloads](https://git-scm.com/downloads) (if you do not have it).
2. Open **Terminal** (macOS/Linux) or **PowerShell** / **Command Prompt** (Windows).
3. Go to the folder where you keep projects, for example:

   ```bash
   cd Desktop/Coding
   ```

4. Clone (replace the URL with your fork or this repo):

   ```bash
   git clone https://github.com/87fahim/learnMySQL.git
   cd learnMySQL
   ```

You should see `server/` at the top level of the project (not nested twice).

---

## Step 2 — Install Node.js (required)

The backend is written in **TypeScript** and runs on **Node.js**.

1. Download the **LTS** version of Node.js from [https://nodejs.org/](https://nodejs.org/) (version **20 or newer** is recommended).
2. Run the installer and accept the defaults (this also installs **npm**).
3. Verify:

   ```bash
   node -v
   npm -v
   ```

You should see version numbers, not an error.

---

## Step 3 — Install MySQL Server

The API does not bundle MySQL. You must install the real MySQL server on your machine (or use an existing one you control).

### Windows (recommended for beginners: MySQL Installer)

1. Go to the MySQL Installer download page: [https://dev.mysql.com/downloads/installer/](https://dev.mysql.com/downloads/installer/).
2. Download the **MySQL Installer** (the web or full installer is fine).
3. Run the installer and choose a setup that includes **MySQL Server**.
4. During configuration:
   - Pick **Standalone MySQL Server**.
   - Remember the **root password** you set (you will put it in `server/.env`).
   - Default port **3306** is fine unless you changed it on purpose.
5. Finish the wizard and ensure the **MySQL** Windows service is **Running** (Services app, or the installer’s final screen).

**Note:** The root `npm run dev` script includes a small Windows helper that tries to start services named `MySQL80` or `MySQL`. If auto-start fails, open **Services**, find MySQL, and start it manually (sometimes you need “Run as administrator”).

### macOS

- Easiest via Homebrew:

  ```bash
  brew install mysql
  brew services start mysql
  ```

Or install from [https://dev.mysql.com/downloads/mysql/](https://dev.mysql.com/downloads/mysql/) and follow Apple’s/MySQL’s GUI installer.

### Linux (Debian/Ubuntu example)

```bash
sudo apt update
sudo apt install mysql-server
sudo systemctl enable --now mysql
```

Exact package names vary by distro; use your distribution’s MySQL packages if different.

---

## Step 4 — Confirm MySQL is running

Pick one approach:

### A) Command line (`mysql` client)

If the `mysql` command exists:

```bash
mysql -u root -p -e "SELECT VERSION();"
```

Enter your password when prompted. If you see a version string, the server is up.

### B) GUI

Use **MySQL Workbench**, **Beekeeper Studio**, **DBeaver**, or similar. Create a connection to `127.0.0.1` port `3306` with your user/password.

---

## Step 5 — Know which databases exist (and optional samples)

After login, run:

```sql
SHOW DATABASES;
```

Typical outputs include:

| Database   | Typical use                                                |
|-----------|------------------------------------------------------------|
| `mysql`   | System schema; always exists. OK for smoke tests—**prefer a non-system DB for learning.** |
| `information_schema`, `performance_schema`, `sys` | System metadata; readable but not ideal “practice sandboxes”. |

### Optional sample databases for learning

If you want richer tables for the **Database explorer** (preview + relationships), import a official sample:

- **Sakila** (DVD rental sample): documented in MySQL’s “Example Databases”.
- **World** database: lightweight geography sample offered by Oracle/MySQL tutorials.

Installation steps vary by ZIP/SQL bundle you choose; generally you download a `.sql` file and import it:

```bash
mysql -u root -p < path/to/sakila-schema.sql
mysql -u root -p < path/to/sakila-data.sql
```

After import, `SHOW DATABASES;` should list `sakila` (and/or `world`).

### What **you** should have

**Minimum:** one database name you can type into `DB_NAME` in `server/.env` where your user has **read** access (`SELECT`, `SHOW`, metadata via `information_schema`).

**Recommended:** a **non-system** practice database (empty DB you create, or a sample like Sakila).

Create an empty database if you want a clean slate:

```sql
CREATE DATABASE learn_mysql_practice;
```

---

## Step 6 — Install backend npm dependencies

From the **project root**:

```bash
npm --prefix ./server install
```

Or:

```bash
cd server
npm install
```

This creates `server/node_modules` and installs Express, mysql2, TypeScript tooling, etc.

---

## Step 7 — Configure `server/.env`

1. In the `server/` folder, copy the example env file:

   ```bash
   # From project root
   cp server/.env.example server/.env
   ```

   Windows PowerShell (same idea):

   ```powershell
   Copy-Item server\.env.example server\.env
   ```

2. Open `server/.env` in a text editor.

3. Set these to match **your MySQL**:

   | Variable       | Meaning |
   |---------------|---------|
   | `DB_HOST`     | Usually `127.0.0.1` for local. |
   | `DB_PORT`     | Usually `3306`. |
   | `DB_USER`     | Often `root` on a dev machine, or a dedicated user. |
   | `DB_PASSWORD` | The password for that user. |
   | `DB_NAME`     | A database that exists (`SHOW DATABASES;`). |
   | `PORT`        | API port; default `4000` matches the frontend dev proxy. |

4. Save the file.

**Security:** never commit `server/.env` to Git. It should stay on your machine only.

---

## Step 8 — Run the API (development)

From `server/`:

```bash
npm run dev
```

You should see a log line similar to:

```text
learnmysql-api listening on http://localhost:4000
```

### Quick health check

Open a browser or use curl:

```bash
curl http://localhost:4000/healthz
```

If you get a successful response, the server process is up (MySQL connectivity is exercised when you hit schema/query routes).

---

## Step 9 — Common problems

| Symptom | What to check |
|--------|----------------|
| `ECONNREFUSED` / cannot connect to MySQL | MySQL service not running; wrong `DB_HOST`/`DB_PORT`. |
| `Access denied for user` | Wrong `DB_USER` / `DB_PASSWORD`. |
| App loads but explorers are empty | `DB_NAME` misspelled; user lacks privileges; database has no tables. |
| Wrong API port | If you changed `PORT`, update frontend `VITE_API_PROXY_TARGET` (see **[FRONTEND.md](../FRONTEND.md)**). |
| Cannot start MySQL service on Windows | Run terminal as Administrator or start the service manually in **Services**. |

---

## Useful API endpoints (overview)

Detailed list stays in the main **[README](../README.md#api-endpoints)**. Highlights:

- `GET /healthz` — lightweight health check  
- `POST /api/v1/query` — read-only guarded SQL execution  
- `GET /api/v1/databases` — list databases your user may see  

---

## Next step

Configure and run the **React frontend**, which proxies `/api` to this server during development: **[FRONTEND.md](../FRONTEND.md)**.

For **both** servers with one command from the repo root, see **`npm run dev`** in the main README.
