CREATE TABLE IF NOT EXISTS emp_annual_leave (
    annual_leave_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    leave_year INT NOT NULL,
    granted_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    adjustment_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    adjustment_reason VARCHAR(500) NULL,
    reset_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT uq_emp_annual_leave_year UNIQUE (emp_id, leave_year)
);

CREATE INDEX IF NOT EXISTS idx_emp_annual_leave_year ON emp_annual_leave(leave_year, emp_id);
ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS manual_used_days NUMERIC(5,1) NOT NULL DEFAULT 0;
