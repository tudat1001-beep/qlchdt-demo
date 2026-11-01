CREATE TABLE purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_id uuid NOT NULL REFERENCES purchases(id),
  reason text NOT NULL CHECK (btrim(reason)<>''), method text NOT NULL CHECK (method IN ('cash','bank')),
  total money_vnd NOT NULL, refund money_vnd NOT NULL, debt_reduction money_vnd NOT NULL,
  CHECK (total::numeric=refund::numeric+debt_reduction::numeric),
  actor uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,purchase_id), UNIQUE(id,method,refund)
);
CREATE INDEX purchase_returns_document_idx ON purchase_returns(purchase_id,created_at);
CREATE TABLE purchase_return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_return_id uuid NOT NULL, purchase_id uuid NOT NULL,
  purchase_line_id uuid NOT NULL, product_id uuid NOT NULL, position integer NOT NULL CHECK (position>=0),
  quantity integer NOT NULL CHECK (quantity>0), value money_vnd NOT NULL,
  FOREIGN KEY(purchase_return_id,purchase_id) REFERENCES purchase_returns(id,purchase_id),
  FOREIGN KEY(purchase_line_id,product_id) REFERENCES purchase_lines(id,product_id),
  UNIQUE(purchase_return_id,purchase_line_id), UNIQUE(id,purchase_line_id,product_id),
  UNIQUE(id,purchase_return_id,purchase_id,purchase_line_id,product_id), UNIQUE(purchase_return_id,position)
);
CREATE INDEX purchase_return_lines_source_idx ON purchase_return_lines(purchase_line_id);
CREATE TABLE purchase_return_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_return_line_id uuid NOT NULL,
  purchase_line_id uuid NOT NULL, product_id uuid NOT NULL, device_id uuid NOT NULL UNIQUE REFERENCES devices(id), cost money_vnd NOT NULL,
  FOREIGN KEY(purchase_return_line_id,purchase_line_id,product_id) REFERENCES purchase_return_lines(id,purchase_line_id,product_id),
  FOREIGN KEY(device_id,product_id) REFERENCES devices(id,product_id), UNIQUE(purchase_return_line_id,device_id)
);
CREATE TABLE purchase_return_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), purchase_return_line_id uuid NOT NULL,
  purchase_line_id uuid NOT NULL, product_id uuid NOT NULL, lot_id uuid NOT NULL,
  quantity integer NOT NULL CHECK(quantity>0), unit_cost money_vnd NOT NULL, cost money_vnd NOT NULL,
  FOREIGN KEY(purchase_return_line_id,purchase_line_id,product_id) REFERENCES purchase_return_lines(id,purchase_line_id,product_id),
  FOREIGN KEY(purchase_line_id,product_id) REFERENCES purchase_lines(id,product_id),
  FOREIGN KEY(lot_id,product_id) REFERENCES accessory_lots(id,product_id), UNIQUE(purchase_return_line_id,lot_id)
);
CREATE INDEX purchase_return_allocations_lot_idx ON purchase_return_allocations(lot_id);
ALTER TABLE purchase_return_lines ADD CONSTRAINT purchase_return_line_document_unique UNIQUE(id,purchase_id,product_id);
ALTER TABLE stock_movements ADD COLUMN purchase_return_line_id uuid REFERENCES purchase_return_lines(id);
ALTER TABLE stock_movements ADD COLUMN purchase_return_id uuid REFERENCES purchase_returns(id);
ALTER TABLE stock_movements ADD COLUMN purchase_id uuid REFERENCES purchases(id);
ALTER TABLE stock_movements ADD CONSTRAINT stock_purchase_return_source_fk
  FOREIGN KEY(purchase_return_line_id,purchase_return_id,purchase_id,purchase_line_id,product_id)
  REFERENCES purchase_return_lines(id,purchase_return_id,purchase_id,purchase_line_id,product_id);
CREATE INDEX stock_movements_purchase_return_idx ON stock_movements(purchase_return_line_id);
ALTER TABLE cash_entries ADD COLUMN purchase_return_id uuid UNIQUE REFERENCES purchase_returns(id);
ALTER TABLE cash_entries ADD CONSTRAINT cash_purchase_return_source FOREIGN KEY(purchase_return_id,method,amount)
  REFERENCES purchase_returns(id,method,refund);
ALTER TABLE cash_entries DROP CONSTRAINT cash_source_check;
ALTER TABLE cash_entries ADD CONSTRAINT cash_source_check CHECK (num_nonnulls(payment_id,return_id,purchase_return_id)=1);
ALTER TABLE cash_entries DROP CONSTRAINT cash_entries_category_check;
ALTER TABLE cash_entries ADD CONSTRAINT cash_entries_category_check CHECK (category IN ('purchase','supplier_payment','sale','customer_payment','sale_refund','purchase_refund'));
CREATE TRIGGER purchase_returns_append_only BEFORE UPDATE OR DELETE ON purchase_returns FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER purchase_return_lines_append_only BEFORE UPDATE OR DELETE ON purchase_return_lines FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER purchase_return_devices_append_only BEFORE UPDATE OR DELETE ON purchase_return_devices FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER purchase_return_allocations_append_only BEFORE UPDATE OR DELETE ON purchase_return_allocations FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();

CREATE FUNCTION validate_purchase_return() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original purchases%ROWTYPE; prior_total numeric; prior_reduction numeric; prior_refund numeric; paid numeric; debt numeric;
BEGIN
  SELECT * INTO original FROM purchases WHERE id=NEW.purchase_id FOR UPDATE;
  SELECT coalesce(sum(total),0),coalesce(sum(debt_reduction),0),coalesce(sum(refund),0)
    INTO prior_total,prior_reduction,prior_refund FROM purchase_returns WHERE purchase_id=NEW.purchase_id;
  SELECT coalesce(sum(amount),0) INTO paid FROM payments WHERE purchase_id=NEW.purchase_id;
  debt:=original.total-paid-prior_reduction;
  IF original.id IS NULL OR prior_total+NEW.total>original.total OR NEW.debt_reduction<>least(NEW.total,debt)
    OR NEW.refund>paid-prior_refund THEN
    RAISE EXCEPTION 'Invalid purchase return balance' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_return_balance BEFORE INSERT ON purchase_returns FOR EACH ROW EXECUTE FUNCTION validate_purchase_return();
CREATE FUNCTION validate_purchase_return_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source purchase_lines%ROWTYPE; prior_quantity bigint;
BEGIN
  SELECT * INTO source FROM purchase_lines WHERE id=NEW.purchase_line_id;
  PERFORM 1 FROM purchases WHERE id=NEW.purchase_id FOR UPDATE;
  SELECT coalesce(sum(quantity),0) INTO prior_quantity FROM purchase_return_lines WHERE purchase_line_id=NEW.purchase_line_id;
  IF source.id IS NULL OR NEW.quantity::bigint+prior_quantity>source.quantity THEN
    RAISE EXCEPTION 'Purchase return exceeds original quantity' USING ERRCODE='23514';
  END IF;
  IF source.kind='PHONE' AND NEW.value>(SELECT coalesce(sum(cost),0) FROM devices WHERE purchase_line_id=source.id AND status='available') THEN
    RAISE EXCEPTION 'Phone return exceeds available original stock' USING ERRCODE='23514';
  END IF;
  IF source.kind='ACCESSORY' AND (NEW.quantity>(SELECT coalesce(sum(remaining_quantity),0) FROM accessory_lots WHERE purchase_line_id=source.id)
    OR NEW.value>(SELECT coalesce(sum(remaining_quantity::numeric*unit_cost),0) FROM accessory_lots WHERE purchase_line_id=source.id)) THEN
    RAISE EXCEPTION 'Accessory return exceeds available original stock' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_return_line_quantity BEFORE INSERT ON purchase_return_lines FOR EACH ROW EXECUTE FUNCTION validate_purchase_return_line();
CREATE FUNCTION validate_purchase_return_device() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM devices WHERE id=NEW.device_id AND purchase_line_id=NEW.purchase_line_id AND status='available' AND cost=NEW.cost) THEN
    RAISE EXCEPTION 'Device is not available from this purchase' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_return_device_source BEFORE INSERT ON purchase_return_devices FOR EACH ROW EXECUTE FUNCTION validate_purchase_return_device();
CREATE FUNCTION validate_purchase_return_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source accessory_lots%ROWTYPE; prior_quantity bigint;
BEGIN
  SELECT * INTO source FROM accessory_lots WHERE id=NEW.lot_id FOR UPDATE;
  PERFORM 1 FROM purchases WHERE id=(SELECT purchase_id FROM purchase_lines WHERE id=NEW.purchase_line_id) FOR UPDATE;
  SELECT coalesce(sum(quantity),0) INTO prior_quantity FROM purchase_return_allocations WHERE lot_id=NEW.lot_id;
  IF source.purchase_line_id<>NEW.purchase_line_id OR NEW.unit_cost<>source.unit_cost OR NEW.quantity>source.remaining_quantity
    OR prior_quantity+NEW.quantity>source.quantity OR NEW.cost::numeric<>NEW.quantity::numeric*source.unit_cost THEN
    RAISE EXCEPTION 'Invalid original lot allocation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER purchase_return_allocation_source BEFORE INSERT ON purchase_return_allocations FOR EACH ROW EXECUTE FUNCTION validate_purchase_return_allocation();

CREATE OR REPLACE FUNCTION validate_document_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_total bigint; already_paid numeric; reduction numeric:=0;
BEGIN
  IF NEW.purchase_id IS NOT NULL THEN
    SELECT total INTO document_total FROM purchases WHERE id=NEW.purchase_id FOR UPDATE;
    SELECT coalesce(sum(amount),0) INTO already_paid FROM payments WHERE purchase_id=NEW.purchase_id;
    SELECT coalesce(sum(debt_reduction),0) INTO reduction FROM purchase_returns WHERE purchase_id=NEW.purchase_id;
  ELSE
    SELECT total INTO document_total FROM sales WHERE id=NEW.sale_id FOR UPDATE;
    SELECT coalesce(sum(amount),0) INTO already_paid FROM payments WHERE sale_id=NEW.sale_id;
    SELECT coalesce(sum(debt_reduction),0) INTO reduction FROM returns WHERE sale_id=NEW.sale_id;
  END IF;
  IF document_total IS NULL OR already_paid+reduction+NEW.amount>document_total THEN
    RAISE EXCEPTION 'Payment exceeds outstanding amount' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION validate_cash_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase uuid;
BEGIN
  IF NEW.return_id IS NOT NULL THEN
    IF NEW.direction<>'out' OR NEW.category<>'sale_refund' THEN RAISE EXCEPTION 'Invalid refund' USING ERRCODE='23514'; END IF;
  ELSIF NEW.purchase_return_id IS NOT NULL THEN
    IF NEW.direction<>'in' OR NEW.category<>'purchase_refund' THEN RAISE EXCEPTION 'Invalid supplier refund' USING ERRCODE='23514'; END IF;
  ELSE
    SELECT purchase_id INTO purchase FROM payments WHERE id=NEW.payment_id;
    IF (purchase IS NOT NULL AND (NEW.direction<>'out' OR NEW.category NOT IN ('purchase','supplier_payment')))
      OR (purchase IS NULL AND (NEW.direction<>'in' OR NEW.category NOT IN ('sale','customer_payment'))) THEN
      RAISE EXCEPTION 'Cash direction/category disagrees with document' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE warranties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), device_id uuid NOT NULL REFERENCES devices(id),
  customer_id uuid REFERENCES customers(id), sale_id uuid REFERENCES sales(id),
  issue text NOT NULL CHECK (btrim(issue)<>''), resolution text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('received','processing','completed','cancelled')),
  actor uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(device_id,sale_id) REFERENCES sale_lines(device_id,sale_id)
);
ALTER TABLE sale_lines ADD CONSTRAINT sale_line_device_sale_unique UNIQUE(device_id,sale_id);
CREATE UNIQUE INDEX warranties_one_active_device ON warranties(device_id) WHERE status IN ('received','processing');
CREATE INDEX warranties_customer_idx ON warranties(customer_id,created_at);
CREATE INDEX warranties_status_idx ON warranties(status,created_at);
CREATE TRIGGER warranties_no_delete BEFORE DELETE ON warranties FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE FUNCTION validate_warranty_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE device_status text;
BEGIN
  SELECT status INTO device_status FROM devices WHERE id=NEW.device_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    IF NEW.status<>'received' OR device_status NOT IN ('quarantine','sold') OR (device_status='quarantine' AND NEW.sale_id IS NOT NULL)
      OR (device_status='sold' AND NEW.sale_id IS NULL) THEN RAISE EXCEPTION 'Invalid warranty ownership' USING ERRCODE='23514'; END IF;
    IF device_status='sold' AND NOT EXISTS (SELECT 1 FROM sale_lines l JOIN sales s ON s.id=l.sale_id WHERE l.device_id=NEW.device_id AND l.sale_id=NEW.sale_id
      AND l.quantity>(SELECT coalesce(sum(quantity),0) FROM return_lines WHERE sale_line_id=l.id)
      AND s.customer_id IS NOT DISTINCT FROM NEW.customer_id) THEN RAISE EXCEPTION 'Warranty owner is not current' USING ERRCODE='23514'; END IF;
  ELSE
    IF (NEW.device_id,NEW.customer_id,NEW.sale_id,NEW.issue,NEW.created_at,NEW.actor) IS DISTINCT FROM
       (OLD.device_id,OLD.customer_id,OLD.sale_id,OLD.issue,OLD.created_at,OLD.actor)
      OR NOT ((OLD.status='received' AND NEW.status='processing') OR (OLD.status='processing' AND NEW.status IN ('completed','cancelled'))) THEN
      RAISE EXCEPTION 'Invalid warranty transition' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER warranty_transition BEFORE INSERT OR UPDATE ON warranties FOR EACH ROW EXECUTE FUNCTION validate_warranty_transition();
