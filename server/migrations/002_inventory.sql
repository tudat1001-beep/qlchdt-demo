CREATE SEQUENCE purchase_number_seq;
CREATE TABLE purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE DEFAULT ('PN-' || nextval('purchase_number_seq')::text),
  supplier_id uuid NOT NULL REFERENCES suppliers(id), supplier_name text NOT NULL,
  extra_cost money_vnd NOT NULL, total money_vnd NOT NULL, note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'posted' CHECK (status='posted'),
  actor uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX purchases_supplier_idx ON purchases(supplier_id,created_at);
CREATE INDEX purchases_created_idx ON purchases(created_at);
CREATE TABLE purchase_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases(id),
  position integer NOT NULL CHECK (position>=0), product_id uuid NOT NULL REFERENCES products(id),
  product_name text NOT NULL, sku text NOT NULL, kind text NOT NULL CHECK (kind IN ('PHONE','ACCESSORY')),
  product_snapshot jsonb NOT NULL,
  quantity integer NOT NULL CHECK (quantity>0), unit_cost money_vnd NOT NULL,
  extra_cost money_vnd NOT NULL, cost money_vnd NOT NULL,
  CHECK (cost::numeric=quantity::numeric*unit_cost::numeric+extra_cost::numeric),
  UNIQUE(purchase_id,position), UNIQUE(id,product_id)
);
CREATE INDEX purchase_lines_product_idx ON purchase_lines(product_id);
ALTER TABLE devices ADD COLUMN purchase_line_id uuid REFERENCES purchase_lines(id);
ALTER TABLE devices ADD CONSTRAINT devices_purchase_product_fk FOREIGN KEY(purchase_line_id,product_id) REFERENCES purchase_lines(id,product_id);
ALTER TABLE devices ADD CONSTRAINT devices_id_product_unique UNIQUE(id,product_id);
CREATE INDEX devices_purchase_line_idx ON devices(purchase_line_id);
CREATE TABLE accessory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_line_id uuid NOT NULL REFERENCES purchase_lines(id),
  product_id uuid NOT NULL REFERENCES products(id), quantity integer NOT NULL CHECK (quantity>0),
  remaining_quantity integer NOT NULL CHECK (remaining_quantity>=0 AND remaining_quantity<=quantity),
  unit_cost money_vnd NOT NULL,
  CHECK (quantity::numeric*unit_cost::numeric<=9007199254740991),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(purchase_line_id,product_id) REFERENCES purchase_lines(id,product_id), UNIQUE(id,product_id)
);
CREATE INDEX accessory_lots_fifo_idx ON accessory_lots(product_id,created_at,id) WHERE remaining_quantity>0;
CREATE INDEX accessory_lots_purchase_idx ON accessory_lots(purchase_line_id);
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases(id),
  method text NOT NULL CHECK (method IN ('cash','bank')), amount money_vnd NOT NULL CHECK (amount>0),
  note text NOT NULL DEFAULT '', actor uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), UNIQUE(id,method,amount)
);
CREATE INDEX payments_purchase_idx ON payments(purchase_id,created_at);
CREATE TABLE cash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL UNIQUE REFERENCES payments(id),
  direction text NOT NULL CHECK (direction IN ('in','out')), method text NOT NULL CHECK (method IN ('cash','bank')),
  amount money_vnd NOT NULL CHECK (amount>0),
  category text NOT NULL CHECK (category IN ('purchase','supplier_payment','sale','customer_payment')),
  note text NOT NULL DEFAULT '', actor uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(payment_id,method,amount) REFERENCES payments(id,method,amount)
);
CREATE INDEX cash_entries_created_idx ON cash_entries(created_at);
CREATE TABLE stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES products(id),
  purchase_line_id uuid NOT NULL REFERENCES purchase_lines(id),
  device_id uuid REFERENCES devices(id), lot_id uuid REFERENCES accessory_lots(id),
  quantity integer NOT NULL CHECK (quantity<>0), cost bigint NOT NULL CHECK (cost BETWEEN -9007199254740991 AND 9007199254740991),
  CHECK (num_nonnulls(device_id,lot_id)=1), CHECK (device_id IS NULL OR abs(quantity::bigint)=1),
  CHECK ((quantity>0 AND cost>=0) OR (quantity<0 AND cost<=0)),
  FOREIGN KEY(purchase_line_id,product_id) REFERENCES purchase_lines(id,product_id),
  FOREIGN KEY(device_id,product_id) REFERENCES devices(id,product_id),
  FOREIGN KEY(lot_id,product_id) REFERENCES accessory_lots(id,product_id),
  note text NOT NULL DEFAULT '', actor uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX stock_movements_product_idx ON stock_movements(product_id,created_at);
CREATE INDEX stock_movements_purchase_idx ON stock_movements(purchase_line_id);
CREATE INDEX stock_movements_device_idx ON stock_movements(device_id);
CREATE INDEX stock_movements_lot_idx ON stock_movements(lot_id);
CREATE INDEX stock_movements_created_idx ON stock_movements(created_at);

CREATE TRIGGER purchases_append_only BEFORE UPDATE OR DELETE ON purchases FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER purchase_lines_append_only BEFORE UPDATE OR DELETE ON purchase_lines FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER cash_append_only BEFORE UPDATE OR DELETE ON cash_entries FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER stock_append_only BEFORE UPDATE OR DELETE ON stock_movements FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER devices_no_delete BEFORE DELETE ON devices FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER lots_no_delete BEFORE DELETE ON accessory_lots FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE FUNCTION protect_stock_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='devices' THEN
    IF TG_OP='UPDATE' AND (NEW.id,NEW.imei,NEW.product_id,NEW.purchase_line_id,NEW.cost) IS DISTINCT FROM (OLD.id,OLD.imei,OLD.product_id,OLD.purchase_line_id,OLD.cost) THEN
      RAISE EXCEPTION 'Device identity and cost are immutable' USING ERRCODE='23514';
    END IF;
    IF (SELECT kind FROM products WHERE id=NEW.product_id)<>'PHONE' THEN
      RAISE EXCEPTION 'Devices require a phone product' USING ERRCODE='23514';
    END IF;
  ELSE
    IF TG_OP='UPDATE' AND to_jsonb(NEW)-'remaining_quantity' IS DISTINCT FROM to_jsonb(OLD)-'remaining_quantity' THEN
      RAISE EXCEPTION 'Lot source is immutable' USING ERRCODE='23514';
    END IF;
    IF (SELECT kind FROM products WHERE id=NEW.product_id)<>'ACCESSORY' THEN
      RAISE EXCEPTION 'Lots require an accessory product' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER devices_source BEFORE INSERT OR UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION protect_stock_source();
CREATE TRIGGER lots_source BEFORE INSERT OR UPDATE ON accessory_lots FOR EACH ROW EXECUTE FUNCTION protect_stock_source();
CREATE FUNCTION validate_document_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_total bigint; already_paid numeric;
BEGIN
  SELECT total INTO document_total FROM purchases WHERE id=NEW.purchase_id FOR UPDATE;
  SELECT coalesce(sum(amount),0) INTO already_paid FROM payments WHERE purchase_id=NEW.purchase_id;
  IF document_total IS NULL OR already_paid+NEW.amount>document_total THEN
    RAISE EXCEPTION 'Payment exceeds outstanding amount' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER payment_balance BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION validate_document_payment();
CREATE FUNCTION validate_cash_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.direction<>'out' OR NEW.category NOT IN ('purchase','supplier_payment') THEN
    RAISE EXCEPTION 'Cash direction/category disagrees with document' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cash_payment BEFORE INSERT ON cash_entries FOR EACH ROW EXECUTE FUNCTION validate_cash_payment();
