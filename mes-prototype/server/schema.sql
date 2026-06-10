-- MES Prototype PostgreSQL schema (matches application models)

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  reg_no INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  photo_path TEXT,
  photo_data TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  code INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS articles (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  display TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cost_centers (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activity_cost_center_maps (
  id SERIAL PRIMARY KEY,
  activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  cost_center_code TEXT NOT NULL REFERENCES cost_centers(code) ON DELETE CASCADE,
  UNIQUE(activity_id, cost_center_code)
);

CREATE TABLE IF NOT EXISTS product_master (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  base_uom TEXT,
  type TEXT,
  product_type TEXT,
  product_nature TEXT,
  vat_category TEXT NOT NULL CHECK(vat_category IN ('standard_13','zero_0','exempt')) DEFAULT 'standard_13',
  hs_code TEXT,
  buy_price REAL,
  buy_disc_pct REAL,
  sales_price REAL,
  sales_disc_pct REAL,
  mrp REAL,
  warranty_rate REAL,
  product_harmonic TEXT,
  double_qty INTEGER DEFAULT 0,
  alt_uom TEXT,
  fix_conversion INTEGER DEFAULT 0,
  base_value REAL,
  alt_value REAL,
  location TEXT,
  alternative_code TEXT,
  max_stock REAL,
  min_stock REAL,
  reorder_level REAL,
  additional_desc_change INTEGER DEFAULT 0,
  additional_desc1 TEXT,
  additional_desc2 TEXT,
  additional_desc3 TEXT,
  additional_desc4 TEXT,
  additional_desc5 TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  created_by TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS product_account_mapping (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES product_master(id) ON DELETE CASCADE,
  group_name TEXT,
  subgroup_name TEXT,
  sales_account TEXT,
  sales_return_account TEXT,
  purchase_account TEXT,
  purchase_return_account TEXT,
  opening_stock_account TEXT,
  closing_stock_pl_account TEXT,
  stock_in_hand_account TEXT
);

CREATE TABLE IF NOT EXISTS product_excise_mappings (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES product_master(id) ON DELETE CASCADE,
  excise_code TEXT,
  rate REAL,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS grading_standards (
  id SERIAL PRIMARY KEY,
  prod_code TEXT NOT NULL,
  prod_name TEXT NOT NULL,
  cost_center_code TEXT NOT NULL,
  cost_center_name TEXT NOT NULL,
  product_master_id INTEGER REFERENCES product_master(id),
  standard_min INTEGER DEFAULT 420,
  std_qty REAL NOT NULL,
  c_value REAL NOT NULL,
  b_value REAL NOT NULL,
  a_value REAL NOT NULL,
  aplus_value REAL NOT NULL,
  effective_date TEXT,
  created_by TEXT,
  updated_by TEXT,
  UNIQUE(prod_code, cost_center_code, effective_date)
);

CREATE TABLE IF NOT EXISTS daily_grading (
  id SERIAL PRIMARY KEY,
  entry_date TEXT NOT NULL,
  staff_id INTEGER NOT NULL REFERENCES staff(id),
  prod_code TEXT NOT NULL,
  cost_center_code TEXT NOT NULL,
  quantity REAL NOT NULL,
  per_day_qty REAL,
  working_min REAL,
  c_time_min REAL,
  p_hour REAL,
  w_hour REAL,
  w_min REAL,
  grade TEXT,
  remarks TEXT,
  entered_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by TEXT,
  deleted_at TIMESTAMP,
  deleted_by TEXT,
  UNIQUE(entry_date, staff_id, prod_code, cost_center_code)
);

CREATE TABLE IF NOT EXISTS daily_grading_audit (
  id SERIAL PRIMARY KEY,
  entry_id INTEGER REFERENCES daily_grading(id),
  action TEXT NOT NULL CHECK(action IN ('create','update','delete','restore','hard_delete')),
  actor TEXT,
  at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  old_values TEXT,
  new_values TEXT
);

CREATE TABLE IF NOT EXISTS missing_standards (
  id SERIAL PRIMARY KEY,
  entry_date TEXT NOT NULL,
  department TEXT,
  staff_id INTEGER REFERENCES staff(id),
  staff_name TEXT,
  activity_id INTEGER,
  activity_name TEXT,
  cost_center_code TEXT,
  cost_center_name TEXT,
  prod_code TEXT,
  prod_name TEXT,
  reported_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('operator', 'supervisor', 'admin')),
  display_name TEXT NOT NULL,
  department TEXT,
  is_active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family TEXT,
  group_name TEXT,
  parent_item_no TEXT,
  uom TEXT,
  ref_department TEXT,
  source TEXT NOT NULL CHECK(source IN ('auto','manual')) DEFAULT 'auto',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_components (
  id SERIAL PRIMARY KEY,
  product_code TEXT NOT NULL REFERENCES products(code) ON DELETE CASCADE,
  component_type TEXT NOT NULL CHECK(component_type IN ('article','free_text')),
  component_code TEXT,
  component_name TEXT,
  component_text TEXT,
  qty_per_assembly REAL NOT NULL DEFAULT 1,
  uom TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_grading_standards_prod_code ON grading_standards(prod_code);
CREATE INDEX IF NOT EXISTS idx_grading_standards_product_master_id ON grading_standards(product_master_id);
CREATE INDEX IF NOT EXISTS idx_daily_grading_prod_code ON daily_grading(prod_code);
CREATE INDEX IF NOT EXISTS idx_daily_grading_entry_date ON daily_grading(entry_date);
CREATE INDEX IF NOT EXISTS idx_daily_grading_staff_id ON daily_grading(staff_id);
CREATE INDEX IF NOT EXISTS idx_product_master_description ON product_master(description);
CREATE INDEX IF NOT EXISTS idx_product_master_hs_code ON product_master(hs_code);
CREATE INDEX IF NOT EXISTS idx_product_master_alternative_code ON product_master(alternative_code);
CREATE INDEX IF NOT EXISTS idx_staff_reg_no ON staff(reg_no);
