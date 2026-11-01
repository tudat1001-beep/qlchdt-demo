CREATE SEQUENCE sale_number_seq;
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number text NOT NULL UNIQUE DEFAULT ('BH-' || nextval('sale_number_seq')::text),
  customer_id uuid REFERENCES customers(id), customer_name text NOT NULL DEFAULT '', customer_snapshot jsonb,
  subtotal money_vnd NOT NULL, discount money_vnd NOT NULL, total money_vnd NOT NULL, cost money_vnd NOT NULL,
  CHECK (subtotal::numeric=total::numeric+discount::numeric),
  note text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'posted' CHECK (status='posted'),
  actor uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX sales_customer_idx ON sales(customer_id,created_at);
CREATE INDEX sales_created_idx ON sales(created_at);
CREATE TABLE sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id),
  position integer NOT NULL CHECK (position>=0), product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL, sku text NOT NULL, kind text NOT NULL CHECK (kind IN ('PHONE','ACCESSORY')),
  product_snapshot jsonb NOT NULL, device_id uuid REFERENCES devices(id), imei text,
  quantity integer NOT NULL CHECK (quantity>0), unit_price money_vnd NOT NULL,
  discount money_vnd NOT NULL, total money_vnd NOT NULL, cost money_vnd NOT NULL,
  CHECK (quantity::numeric*unit_price::numeric<=9007199254740991),
  CHECK (total::numeric+discount::numeric=quantity::numeric*unit_price::numeric),
  CHECK ((kind='PHONE' AND device_id IS NOT NULL AND quantity=1 AND imei IS NOT NULL AND imei ~ '^[0-9]{15}$') OR (kind='ACCESSORY' AND device_id IS NULL AND imei IS NULL)),
  UNIQUE(sale_id,position), UNIQUE(sale_id,device_id), UNIQUE(id,product_id),
  FOREIGN KEY(device_id,product_id) REFERENCES devices(id,product_id)
);
CREATE UNIQUE INDEX sale_accessory_line_unique ON sale_lines(sale_id,product_id) WHERE device_id IS NULL;
CREATE INDEX sale_lines_product_idx ON sale_lines(product_id);
CREATE INDEX sale_lines_device_idx ON sale_lines(device_id);
CREATE TABLE sale_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_line_id uuid NOT NULL REFERENCES sale_lines(id),
  lot_id uuid NOT NULL REFERENCES accessory_lots(id), product_id uuid NOT NULL REFERENCES products(id),
  position integer NOT NULL CHECK (position>=0),
  quantity integer NOT NULL CHECK (quantity>0), unit_cost money_vnd NOT NULL, cost money_vnd NOT NULL,
  CHECK (cost::numeric=quantity::numeric*unit_cost::numeric),
  FOREIGN KEY(sale_line_id,product_id) REFERENCES sale_lines(id,product_id),
  FOREIGN KEY(lot_id,product_id) REFERENCES accessory_lots(id,product_id), UNIQUE(sale_line_id,lot_id), UNIQUE(sale_line_id,position)
);
CREATE INDEX sale_allocations_lot_idx ON sale_allocations(lot_id);
ALTER TABLE stock_movements ADD COLUMN sale_line_id uuid REFERENCES sale_lines(id);
ALTER TABLE stock_movements ADD CONSTRAINT stock_sale_product_fk FOREIGN KEY(sale_line_id,product_id) REFERENCES sale_lines(id,product_id);
CREATE INDEX stock_movements_sale_idx ON stock_movements(sale_line_id);
ALTER TABLE payments ALTER COLUMN purchase_id DROP NOT NULL;
ALTER TABLE payments ADD COLUMN sale_id uuid REFERENCES sales(id);
ALTER TABLE payments ADD CONSTRAINT payment_document_check CHECK (num_nonnulls(purchase_id,sale_id)=1);
CREATE INDEX payments_sale_idx ON payments(sale_id,created_at);
CREATE TRIGGER sales_append_only BEFORE UPDATE OR DELETE ON sales FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER sale_lines_append_only BEFORE UPDATE OR DELETE ON sale_lines FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER allocations_append_only BEFORE UPDATE OR DELETE ON sale_allocations FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();

CREATE OR REPLACE FUNCTION validate_document_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_total bigint; already_paid numeric;
BEGIN
  IF NEW.purchase_id IS NOT NULL THEN
    SELECT total INTO document_total FROM purchases WHERE id=NEW.purchase_id FOR UPDATE;
    SELECT coalesce(sum(amount),0) INTO already_paid FROM payments WHERE purchase_id=NEW.purchase_id;
  ELSE
    SELECT total INTO document_total FROM sales WHERE id=NEW.sale_id FOR UPDATE;
    SELECT coalesce(sum(amount),0) INTO already_paid FROM payments WHERE sale_id=NEW.sale_id;
  END IF;
  IF document_total IS NULL OR already_paid+NEW.amount>document_total THEN
    RAISE EXCEPTION 'Payment exceeds outstanding amount' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION validate_cash_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase uuid;
BEGIN
  SELECT purchase_id INTO purchase FROM payments WHERE id=NEW.payment_id;
  IF (purchase IS NOT NULL AND (NEW.direction<>'out' OR NEW.category NOT IN ('purchase','supplier_payment')))
    OR (purchase IS NULL AND (NEW.direction<>'in' OR NEW.category NOT IN ('sale','customer_payment'))) THEN
    RAISE EXCEPTION 'Cash direction/category disagrees with document' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
