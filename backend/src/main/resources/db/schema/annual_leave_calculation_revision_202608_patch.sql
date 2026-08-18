-- Annual leave policy revision (2026-08): confirmed hire-date corrections and
-- current-year AUTO balances for employees hired in 2026.

UPDATE emp
SET hire_date = DATE '2016-09-01'
WHERE emp_no = 'E9024'
  AND hire_date IS DISTINCT FROM DATE '2016-09-01';

UPDATE emp_employment_history history
SET start_date = DATE '2016-09-01'
FROM emp
WHERE history.emp_id = emp.emp_id
  AND emp.emp_no = 'E9024'
  AND history.end_date IS NULL
  AND history.rehire_yn = 'N'
  AND history.start_date IS DISTINCT FROM DATE '2016-09-01';

UPDATE emp
SET hire_date = DATE '2024-01-15'
WHERE emp_no = 'E9064'
  AND hire_date IS DISTINCT FROM DATE '2024-01-15';

UPDATE emp_employment_history history
SET start_date = DATE '2024-01-15'
FROM emp
WHERE history.emp_id = emp.emp_id
  AND emp.emp_no = 'E9064'
  AND history.end_date IS NULL
  AND history.rehire_yn = 'N'
  AND history.start_date IS DISTINCT FROM DATE '2024-01-15';

WITH expected(emp_no, expected_days) AS (
    VALUES
        ('E9086', 11.0::NUMERIC),
        ('E9087', 11.0::NUMERIC),
        ('E9088',  9.0::NUMERIC),
        ('E9089',  8.0::NUMERIC),
        ('E9090',  7.0::NUMERIC),
        ('E9092',  7.0::NUMERIC),
        ('E9093',  7.0::NUMERIC),
        ('E9094',  7.0::NUMERIC),
        ('E9095',  7.0::NUMERIC),
        ('E9096',  7.0::NUMERIC),
        ('E9097',  7.0::NUMERIC),
        ('E9098',  6.0::NUMERIC),
        ('E9099',  6.0::NUMERIC)
)
INSERT INTO annual_leave_ledger (
    annual_leave_id, emp_id, leave_year, transaction_type,
    before_days, change_days, after_days, reason, source_type, source_id, created_by
)
SELECT leave.annual_leave_id, leave.emp_id, leave.leave_year, 'POLICY_MIGRATION',
       leave.final_days, expected.expected_days - leave.final_days, expected.expected_days,
       '2026-08 연차 계산식 개정에 따른 입사 당해 전체 근무월 재산정',
       'ANNUAL_LEAVE_POLICY', NULL, NULL
FROM expected
JOIN emp ON emp.emp_no = expected.emp_no
JOIN emp_annual_leave leave ON leave.emp_id = emp.emp_id AND leave.leave_year = 2026
WHERE leave.calculation_mode = 'AUTO'
  AND leave.final_days IS DISTINCT FROM expected.expected_days;

WITH expected(emp_no, expected_days) AS (
    VALUES
        ('E9086', 11.0::NUMERIC),
        ('E9087', 11.0::NUMERIC),
        ('E9088',  9.0::NUMERIC),
        ('E9089',  8.0::NUMERIC),
        ('E9090',  7.0::NUMERIC),
        ('E9092',  7.0::NUMERIC),
        ('E9093',  7.0::NUMERIC),
        ('E9094',  7.0::NUMERIC),
        ('E9095',  7.0::NUMERIC),
        ('E9096',  7.0::NUMERIC),
        ('E9097',  7.0::NUMERIC),
        ('E9098',  6.0::NUMERIC),
        ('E9099',  6.0::NUMERIC)
)
UPDATE emp_annual_leave leave
SET granted_days = expected.expected_days,
    adjustment_days = 0,
    auto_calculated_days = expected.expected_days,
    final_days = expected.expected_days,
    calculation_mode = 'AUTO',
    confirmation_status = 'CONFIRMED',
    calculation_basis = '입사 당해 전체 근무월 기준 자동 산정(입사일이 1일이면 해당 월 포함)',
    adjustment_reason = NULL,
    confirmed_at = NOW(),
    confirmed_by = NULL,
    reset_at = NOW(),
    updated_at = NOW(),
    updated_by = NULL
FROM expected
JOIN emp ON emp.emp_no = expected.emp_no
WHERE leave.emp_id = emp.emp_id
  AND leave.leave_year = 2026
  AND leave.calculation_mode = 'AUTO'
  AND leave.final_days IS DISTINCT FROM expected.expected_days;
