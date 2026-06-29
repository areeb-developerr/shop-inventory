// Cloud mirror DDL — kept in electron/ so it ships with the app build.
const CLOUD_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  stock_qty REAL,
  cost_price BIGINT,
  sell_price BIGINT,
  supplier_id BIGINT,
  low_stock_at REAL,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  balance BIGINT DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS suppliers (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  balance BIGINT DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  balance BIGINT DEFAULT 0,
  is_default INT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT PRIMARY KEY,
  invoice_no TEXT,
  customer_id BIGINT,
  date TEXT,
  subtotal BIGINT,
  paid_amount BIGINT,
  due_amount BIGINT,
  payment_type TEXT,
  notes TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT PRIMARY KEY,
  invoice_id BIGINT,
  product_id BIGINT,
  name TEXT,
  qty REAL,
  unit_price BIGINT,
  line_total BIGINT
);

CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT PRIMARY KEY,
  supplier_id BIGINT,
  date TEXT,
  total BIGINT,
  paid_amount BIGINT,
  due_amount BIGINT,
  notes TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id BIGINT PRIMARY KEY,
  purchase_id BIGINT,
  product_id BIGINT,
  name TEXT,
  qty REAL,
  unit_cost BIGINT,
  line_total BIGINT
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id BIGINT PRIMARY KEY,
  date TEXT,
  type TEXT,
  account_id BIGINT,
  party_type TEXT,
  party_id BIGINT,
  amount BIGINT,
  ref_type TEXT,
  ref_id BIGINT,
  notes TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id BIGINT PRIMARY KEY,
  date TEXT,
  generated_at TEXT,
  file_path TEXT,
  summary_json TEXT,
  synced_at TEXT
);
`;

const RLS_SQL = `
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
`;

async function ensureCloudSchema(client) {
  const { rows } = await client.query(
    "SELECT to_regclass('public.products') IS NOT NULL AS ready"
  );
  if (rows[0]?.ready) return false;

  await client.query(CLOUD_SCHEMA_SQL);
  try {
    await client.query(RLS_SQL);
  } catch {
    // RLS may already be enabled
  }
  return true;
}

module.exports = { ensureCloudSchema };
