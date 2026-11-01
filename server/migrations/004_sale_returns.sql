CREATE TABLE returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sale_id uuid NOT NULL REFERENCES sales(id),
  kind text NOT NULL CHECK (kind IN ('return','cancel')), reason text NOT NULL CHECK (btrim(reason)<>''),
  disposition text NOT NULL CHECK (disposition IN ('available','quarantine')),
  method text NOT NULL CHECK (method IN ('cash','bank')),
  total money_vnd NOT NULL, cost money_vnd NOT NULL, refund money_vnd NOT NULL, debt_reduction money_vnd NOT NULL,
  CHECK (total::numeric=refund::numeric+debt_reduction::numeric),
  actor uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id,sale_id), UNIQUE(id,method,refund)
);
CREATE INDEX returns_sale_idx ON returns(sale_id,created_at);
CREATE UNIQUE INDEX returns_cancel_unique ON returns(sale_id) WHERE kind='cancel';
ALTER TABLE sale_lines ADD CONSTRAINT sale_line_document_unique UNIQUE(id,sale_id,product_id);
CREATE TABLE return_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), return_id uuid NOT NULL REFERENCES returns(id),
  sale_id uuid NOT NULL REFERENCES sales(id), sale_line_id uuid NOT NULL REFERENCES sale_lines(id),
  product_id uuid NOT NULL REFERENCES products(id), position integer NOT NULL CHECK (position>=0),
  quantity integer NOT NULL CHECK (quantity>0), value money_vnd NOT NULL, cost money_vnd NOT NULL,
  FOREIGN KEY(return_id,sale_id) REFERENCES returns(id,sale_id),
  FOREIGN KEY(sale_line_id,sale_id,product_id) REFERENCES sale_lines(id,sale_id,product_id),
  UNIQUE(return_id,sale_line_id), UNIQUE(return_id,position), UNIQUE(id,sale_line_id), UNIQUE(id,sale_line_id,product_id)
);
CREATE INDEX return_lines_sale_line_idx ON return_lines(sale_line_id);
CREATE INDEX return_lines_product_idx ON return_lines(product_id);
CREATE INDEX return_lines_sale_idx ON return_lines(sale_id);
ALTER TABLE sale_allocations ADD CONSTRAINT sale_allocation_line_unique UNIQUE(id,sale_line_id);
CREATE TABLE return_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), return_line_id uuid NOT NULL REFERENCES return_lines(id),
  sale_line_id uuid NOT NULL REFERENCES sale_lines(id), sale_allocation_id uuid NOT NULL REFERENCES sale_allocations(id),
  quantity integer NOT NULL CHECK (quantity>0), cost money_vnd NOT NULL,
  FOREIGN KEY(return_line_id,sale_line_id) REFERENCES return_lines(id,sale_line_id),
  FOREIGN KEY(sale_allocation_id,sale_line_id) REFERENCES sale_allocations(id,sale_line_id),
  UNIQUE(return_line_id,sale_allocation_id)
);
CREATE INDEX return_allocations_source_idx ON return_allocations(sale_allocation_id);
CREATE INDEX return_allocations_line_idx ON return_allocations(sale_line_id);
ALTER TABLE stock_movements ADD COLUMN return_line_id uuid REFERENCES return_lines(id);
ALTER TABLE stock_movements ADD CONSTRAINT stock_return_source_fk FOREIGN KEY(return_line_id,sale_line_id,product_id) REFERENCES return_lines(id,sale_line_id,product_id);
ALTER TABLE stock_movements ADD CONSTRAINT stock_return_direction CHECK (return_line_id IS NULL OR (sale_line_id IS NOT NULL AND quantity>0));
CREATE INDEX stock_movements_return_idx ON stock_movements(return_line_id);
ALTER TABLE cash_entries ALTER COLUMN payment_id DROP NOT NULL;
ALTER TABLE cash_entries ADD COLUMN return_id uuid UNIQUE REFERENCES returns(id);
ALTER TABLE cash_entries ADD CONSTRAINT cash_source_check CHECK (num_nonnulls(payment_id,return_id)=1);
ALTER TABLE cash_entries DROP CONSTRAINT cash_entries_category_check;
ALTER TABLE cash_entries ADD CONSTRAINT cash_entries_category_check CHECK (category IN ('purchase','supplier_payment','sale','customer_payment','sale_refund'));
ALTER TABLE cash_entries ADD CONSTRAINT cash_refund_amount_fk FOREIGN KEY(return_id,method,amount) REFERENCES returns(id,method,refund);
CREATE TRIGGER returns_append_only BEFORE UPDATE OR DELETE ON returns FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER return_lines_append_only BEFORE UPDATE OR DELETE ON return_lines FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();
CREATE TRIGGER return_allocations_append_only BEFORE UPDATE OR DELETE ON return_allocations FOR EACH ROW EXECUTE FUNCTION forbid_history_mutation();

CREATE FUNCTION validate_sale_return() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original sales%ROWTYPE; previous_total numeric; previous_cost numeric; previous_reduction numeric; paid numeric; debt numeric;
BEGIN
  SELECT * INTO original FROM sales WHERE id=NEW.sale_id FOR UPDATE;
  SELECT coalesce(sum(total),0),coalesce(sum(cost),0),coalesce(sum(debt_reduction),0)
    INTO previous_total,previous_cost,previous_reduction FROM returns WHERE sale_id=NEW.sale_id;
  SELECT coalesce(sum(amount),0) INTO paid FROM payments WHERE sale_id=NEW.sale_id;
  debt:=original.total-paid-previous_reduction;
  IF original.id IS NULL OR previous_total+NEW.total>original.total OR previous_cost+NEW.cost>original.cost
    OR NEW.debt_reduction<>least(NEW.total,debt) OR EXISTS (SELECT 1 FROM returns WHERE sale_id=NEW.sale_id AND kind='cancel') THEN
    RAISE EXCEPTION 'Invalid return balance' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER return_balance BEFORE INSERT ON returns FOR EACH ROW EXECUTE FUNCTION validate_sale_return();
CREATE FUNCTION validate_return_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original sale_lines%ROWTYPE; previous_quantity bigint; expected_value numeric;
BEGIN
  SELECT * INTO original FROM sale_lines WHERE id=NEW.sale_line_id;
  PERFORM 1 FROM sales WHERE id=original.sale_id FOR UPDATE;
  SELECT coalesce(sum(quantity),0) INTO previous_quantity FROM return_lines WHERE sale_line_id=NEW.sale_line_id;
  expected_value:=floor(original.total::numeric*(previous_quantity+NEW.quantity)/original.quantity)
    -floor(original.total::numeric*previous_quantity/original.quantity);
  IF original.id IS NULL OR previous_quantity+NEW.quantity>original.quantity OR NEW.value<>expected_value
    OR (original.device_id IS NOT NULL AND NEW.cost<>original.cost) THEN
    RAISE EXCEPTION 'Invalid cumulative return line' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER return_quantity BEFORE INSERT ON return_lines FOR EACH ROW EXECUTE FUNCTION validate_return_line();
CREATE FUNCTION validate_return_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original sale_allocations%ROWTYPE; previous_quantity bigint;
BEGIN
  SELECT * INTO original FROM sale_allocations WHERE id=NEW.sale_allocation_id;
  PERFORM 1 FROM sales WHERE id=(SELECT sale_id FROM sale_lines WHERE id=original.sale_line_id) FOR UPDATE;
  SELECT coalesce(sum(quantity),0) INTO previous_quantity FROM return_allocations WHERE sale_allocation_id=NEW.sale_allocation_id;
  IF original.id IS NULL OR previous_quantity+NEW.quantity>original.quantity OR NEW.cost::numeric<>NEW.quantity::numeric*original.unit_cost THEN
    RAISE EXCEPTION 'Invalid original cost allocation' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER return_allocation_quantity BEFORE INSERT ON return_allocations FOR EACH ROW EXECUTE FUNCTION validate_return_allocation();

CREATE OR REPLACE FUNCTION validate_document_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE document_total bigint; already_paid numeric; reduction numeric:=0;
BEGIN
  IF NEW.purchase_id IS NOT NULL THEN
    SELECT total INTO document_total FROM purchases WHERE id=NEW.purchase_id FOR UPDATE;
    SELECT coalesce(sum(amount),0) INTO already_paid FROM payments WHERE purchase_id=NEW.purchase_id;
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
    IF NEW.direction<>'out' OR NEW.category<>'sale_refund' THEN
      RAISE EXCEPTION 'Invalid refund direction/category' USING ERRCODE='23514';
    END IF;
  ELSE
    SELECT purchase_id INTO purchase FROM payments WHERE id=NEW.payment_id;
    IF (purchase IS NOT NULL AND (NEW.direction<>'out' OR NEW.category NOT IN ('purchase','supplier_payment')))
      OR (purchase IS NULL AND (NEW.direction<>'in' OR NEW.category NOT IN ('sale','customer_payment'))) THEN
      RAISE EXCEPTION 'Cash direction/category disagrees with document' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
