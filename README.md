# Shop Ledger

A desktop app for pesticide shops (~50 items): inventory, sales invoices, cash/bank accounts, customer udhar (receivables), and supplier payables. Includes daily reports and optional cloud sync for remote viewing from home.

## Features

- **Items** — product catalog with stock, cost/sell price, supplier link
- **New Sale** — invoice with cash, bank, udhar, or mixed payment
- **Invoices** — sales history with detail view
- **People** — customers (udhar to collect) and suppliers (payables); stock-in purchases
- **Accounts** — cash drawer and bank balances, transfers, adjustments
- **Reports** — daily summary (manual or auto at end of day)
- **Cloud sync** — push data to Supabase for remote read-only dashboard

## Tech Stack

- **Desktop:** Electron 30 + React 18 + Vite + Tailwind
- **Database:** SQLite (`better-sqlite3`) — local, fast, no server setup
- **Cloud:** Supabase (optional) for sync + remote dashboard

## Prerequisites

- Node.js 20+
- Windows (primary target; Electron also supports Mac/Linux)

## Development

```bash
npm install
npm run dev
```

This starts Vite on port 5173 and launches Electron. The UI only works inside Electron (SQLite runs in the main process).

## Production Build

```bash
npm run dist
```

Installer output goes to `dist-electron/`.

## Data Location

SQLite database: `%APPDATA%/ShopLedger/shop.db` (Windows)

Backup anytime from **Settings → Backup Database**.

## Daily Workflow

1. Add items and suppliers (one-time setup)
2. **Stock In** (People → Suppliers) when buying from company
3. **New Sale** for each customer purchase
4. **Collect** udhar from customers / **Pay** suppliers from People page
5. **Generate Report** at end of day (or enable auto at 9 PM in Settings)

## Cloud Sync (Remote Access)

### Shop setup

1. Create a free [Supabase](https://supabase.com) project
2. Copy `.env.example` to `.env` in the project root
3. Set `SUPABASE_URI` to your Postgres connection string (Supabase → Project Settings → Database)
   - **Windows / home networks:** prefer the **Session pooler** URI (`…pooler.supabase.com:5432`) — the direct `db.*.supabase.co` host is IPv6-only and often fails
4. Optionally set `SYNC_TIMES=13:00,18:00,21:00` for scheduled sync while the app is open
5. Restart the app — on first sync, cloud tables are created automatically (or run `supabase/schema.sql` manually in the SQL Editor)
6. Sync runs 10s after startup, on schedule, after writes (debounced), and via the header sync chip

Credentials stay in `.env` only (never in Settings UI). Keep `.env` out of git.

### Sync troubleshooting

| Error | Likely cause | What to do |
|-------|----------------|------------|
| `ENOTFOUND` / `ENETUNREACH` on `db.xxx.supabase.co` | Direct DB host is **IPv6-only**; your network may not support IPv6 | Use the **Session pooler** connection string in `SUPABASE_URI` instead (Supabase → Database → Connection string → Session mode) |
| `password authentication failed` | Wrong DB password in URI | Reset database password in Supabase → Settings → Database, update `.env`, restart app |
| `relation "products" does not exist` | Cloud tables not created yet | Restart app and sync again (tables auto-create), or run `supabase/schema.sql` in Supabase SQL Editor |
| Connection timeout | Slow or unstable network | Wait and tap the header sync chip to retry; app auto-retries in the background |

**Offline behavior:** Sales, inventory, and reports always save to local SQLite first. Failed syncs never delete local data. Pending changes stay queued until a sync succeeds (manual retry, automatic retries after failure, next scheduled time, or after new sales).

### Remote dashboard

```bash
cd dashboard
npm install
cp .env.example .env   # add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

Deploy to Vercel/Netlify for access from home. Create a Supabase Auth user for login.

## Project Structure

```
shop-inventory/
├── main.js              # Electron entry
├── preload.js           # IPC bridge (window.shopLedger)
├── electron/
│   ├── ipc.js           # IPC handlers
│   └── db/              # SQLite schema, repositories, sync, reports
├── src/                 # React UI
├── dashboard/           # Remote read-only web app
└── supabase/schema.sql  # Cloud mirror tables
```

## Money Storage

All amounts are stored as **integer paisa** (×100) in the database. The UI displays as `Rs 1,250`.

## License

Private — for shop use.
