-- Applies confirmed contract terms supplied by HR in 2026-08.
-- Contract start dates are exactly one year before the supplied end dates.
-- Original hire dates and position/job-title data are intentionally preserved.

DO $$
DECLARE
    matched_employees INT;
    matched_leave_rows INT;
BEGIN
    WITH expected(emp_no, emp_name_hex) AS (
        VALUES
            ('C0002', 'eca1b0ed9884ecb2a0'),
            ('D4035', 'ec9ca4eca3bcec9b90'),
            ('E5031', 'ec8690eca095eba3a1'),
            ('C1006', 'eab3a0ed9895ebaaa8'),
            ('C7008', 'ec9691ec9881ec889c'),
            ('C6013', 'ec9691ed9aa8ec849d')
    )
    SELECT COUNT(*) INTO matched_employees
    FROM expected
    JOIN emp
      ON emp.emp_no = expected.emp_no
     AND encode(convert_to(emp.emp_name, 'UTF8'), 'hex') = expected.emp_name_hex
     AND emp.status = 'ACTIVE';

    IF matched_employees <> 6 THEN
        RAISE EXCEPTION 'Contract employee patch expected 6 unique active employee matches, found %.', matched_employees;
    END IF;

    WITH expected(emp_no) AS (
        VALUES ('C0002'), ('D4035'), ('E5031'), ('C1006'), ('C7008'), ('C6013')
    )
    SELECT COUNT(*) INTO matched_leave_rows
    FROM expected
    JOIN emp ON emp.emp_no = expected.emp_no
    JOIN emp_annual_leave leave
      ON leave.emp_id = emp.emp_id
     AND leave.leave_year = 2026;

    IF matched_leave_rows <> 6 THEN
        RAISE EXCEPTION 'Contract employee patch expected 6 annual-leave rows for 2026, found %.', matched_leave_rows;
    END IF;
END $$;

WITH expected(emp_no, contract_start_date, contract_end_date) AS (
    VALUES
        ('C0002', DATE '2026-06-30', DATE '2027-06-30'),
        ('D4035', DATE '2026-06-30', DATE '2027-06-30'),
        ('E5031', DATE '2025-10-31', DATE '2026-10-31'),
        ('C1006', DATE '2025-08-31', DATE '2026-08-31'),
        ('C7008', DATE '2025-12-31', DATE '2026-12-31'),
        ('C6013', DATE '2026-01-31', DATE '2027-01-31')
)
UPDATE emp
SET employment_type = 'CONTRACT',
    contract_start_date = expected.contract_start_date,
    contract_end_date = expected.contract_end_date,
    updated_at = NOW(),
    updated_by = NULL
FROM expected
WHERE emp.emp_no = expected.emp_no
  AND (
      emp.employment_type,
      emp.contract_start_date,
      emp.contract_end_date
  ) IS DISTINCT FROM (
      'CONTRACT'::VARCHAR,
      expected.contract_start_date,
      expected.contract_end_date
  );

WITH expected(emp_no) AS (
    VALUES ('C0002'), ('D4035'), ('E5031'), ('C1006'), ('C7008'), ('C6013')
)
UPDATE emp_employment_history history
SET employment_type = 'CONTRACT',
    updated_at = NOW(),
    updated_by = NULL
FROM expected
JOIN emp ON emp.emp_no = expected.emp_no
WHERE history.emp_id = emp.emp_id
  AND history.end_date IS NULL
  AND history.employment_type IS DISTINCT FROM 'CONTRACT';

WITH expected(emp_no, final_days) AS (
    VALUES
        ('C0002', 30.0::NUMERIC),
        ('D4035', 30.0::NUMERIC),
        ('E5031', 15.0::NUMERIC),
        ('C1006', 15.0::NUMERIC),
        ('C7008', 15.0::NUMERIC),
        ('C6013', 15.0::NUMERIC)
)
INSERT INTO annual_leave_ledger (
    annual_leave_id,
    emp_id,
    leave_year,
    transaction_type,
    before_days,
    change_days,
    after_days,
    reason,
    source_type,
    source_id,
    created_by
)
SELECT
    leave.annual_leave_id,
    leave.emp_id,
    leave.leave_year,
    'CONTRACT_TERM_CONFIRM',
    leave.final_days,
    expected.final_days - leave.final_days,
    expected.final_days,
    '인사 원본 계약기간 및 2026년 연차 확정값 반영',
    'EMPLOYMENT_CONTRACT',
    leave.emp_id,
    NULL
FROM expected
JOIN emp ON emp.emp_no = expected.emp_no
JOIN emp_annual_leave leave ON leave.emp_id = emp.emp_id AND leave.leave_year = 2026
WHERE NOT EXISTS (
    SELECT 1
    FROM annual_leave_ledger ledger
    WHERE ledger.emp_id = leave.emp_id
      AND ledger.leave_year = 2026
      AND ledger.transaction_type = 'CONTRACT_TERM_CONFIRM'
      AND ledger.source_type = 'EMPLOYMENT_CONTRACT'
      AND ledger.source_id = leave.emp_id
);

WITH expected(emp_no, final_days) AS (
    VALUES
        ('C0002', 30.0::NUMERIC),
        ('D4035', 30.0::NUMERIC),
        ('E5031', 15.0::NUMERIC),
        ('C1006', 15.0::NUMERIC),
        ('C7008', 15.0::NUMERIC),
        ('C6013', 15.0::NUMERIC)
)
UPDATE emp_annual_leave leave
SET granted_days = 15.0,
    adjustment_days = expected.final_days - 15.0,
    auto_calculated_days = 15.0,
    final_days = expected.final_days,
    calculation_mode = 'MANUAL',
    confirmation_status = 'CONFIRMED',
    calculation_basis = '계약직 기본 15일 · 인사 원본 계약기간 및 최종 연차 확인',
    adjustment_reason = '2026년 계약직 연차 확정',
    confirmed_at = NOW(),
    confirmed_by = NULL,
    updated_at = NOW(),
    updated_by = NULL
FROM expected
JOIN emp ON emp.emp_no = expected.emp_no
WHERE leave.emp_id = emp.emp_id
  AND leave.leave_year = 2026
  AND (
      leave.granted_days,
      leave.adjustment_days,
      leave.auto_calculated_days,
      leave.final_days,
      leave.calculation_mode,
      leave.confirmation_status
  ) IS DISTINCT FROM (
      15.0::NUMERIC,
      expected.final_days - 15.0,
      15.0::NUMERIC,
      expected.final_days,
      'MANUAL'::VARCHAR,
      'CONFIRMED'::VARCHAR
  );
