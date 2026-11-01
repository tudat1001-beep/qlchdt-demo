ALTER TABLE cash_entries DROP CONSTRAINT cash_source_check;
ALTER TABLE cash_entries ADD CONSTRAINT cash_source_check CHECK (
  (category IN ('other_income','expense') AND num_nonnulls(payment_id,return_id,purchase_return_id)=0)
  OR (category NOT IN ('other_income','expense') AND num_nonnulls(payment_id,return_id,purchase_return_id)=1)
);
ALTER TABLE cash_entries DROP CONSTRAINT cash_entries_category_check;
ALTER TABLE cash_entries ADD CONSTRAINT cash_entries_category_check CHECK (
  category IN ('purchase','supplier_payment','sale','customer_payment','sale_refund','purchase_refund','other_income','expense')
);

CREATE OR REPLACE FUNCTION validate_cash_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE purchase uuid;
BEGIN
  IF NEW.category IN ('other_income','expense') THEN
    IF num_nonnulls(NEW.payment_id,NEW.return_id,NEW.purchase_return_id)<>0
      OR (NEW.category='other_income' AND NEW.direction<>'in')
      OR (NEW.category='expense' AND NEW.direction<>'out') THEN
      RAISE EXCEPTION 'Invalid manual cash entry' USING ERRCODE='23514';
    END IF;
  ELSIF NEW.return_id IS NOT NULL THEN
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
