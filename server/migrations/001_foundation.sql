CREATE DOMAIN money_vnd AS bigint CHECK (VALUE >= 0 AND VALUE <= 9007199254740991);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton),
  username text NOT NULL UNIQUE CHECK (length(username) BETWEEN 1 AND 100),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
  token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id uuid NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE CHECK (length(btrim(sku)) BETWEEN 1 AND 100),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (kind IN ('PHONE','ACCESSORY')),
  brand text NOT NULL DEFAULT '', model text NOT NULL DEFAULT '', variant text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '', storage text NOT NULL DEFAULT '',
  sale_price money_vnd NOT NULL,
  min_stock integer NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  phone text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '', note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE suppliers (LIKE customers INCLUDING ALL);
CREATE TABLE devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imei text NOT NULL UNIQUE CHECK (imei ~ '^[0-9]{15}$'),
  product_id uuid NOT NULL REFERENCES products(id),
  condition text NOT NULL CHECK (condition IN ('NEW','USED')),
  cosmetic text NOT NULL DEFAULT '', battery integer CHECK (battery BETWEEN 0 AND 100),
  defects text NOT NULL DEFAULT '', included_accessories text NOT NULL DEFAULT '',
  cost money_vnd NOT NULL, sale_price money_vnd NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','sold','quarantine','returned_supplier')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX devices_product_status_idx ON devices(product_id,status);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor uuid NOT NULL REFERENCES users(id),
  action text NOT NULL, entity_type text NOT NULL, entity_id uuid NOT NULL,
  details jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type,entity_id,created_at);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at);
CREATE TABLE idempotency (
  key uuid PRIMARY KEY, actor uuid NOT NULL REFERENCES users(id),
  operation text NOT NULL, payload_hash text NOT NULL, status_code integer NOT NULL CHECK (status_code BETWEEN 200 AND 299),
  response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION forbid_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'History is append-only' USING ERRCODE = '23514'; END $$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER idempotency_append_only BEFORE UPDATE OR DELETE ON idempotency FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE FUNCTION protect_product_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.sku IS DISTINCT FROM OLD.sku OR NEW.kind IS DISTINCT FROM OLD.kind THEN
    RAISE EXCEPTION 'Product SKU and kind are immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER product_identity BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION protect_product_identity();
