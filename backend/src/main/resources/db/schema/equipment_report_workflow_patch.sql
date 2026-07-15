CREATE TABLE IF NOT EXISTS equipment_assignment_authority (
    authority_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL UNIQUE REFERENCES emp(emp_id),
    granted_by_emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id)
);

ALTER TABLE equipment_report ADD COLUMN IF NOT EXISTS completed_on DATE NULL;
ALTER TABLE equipment_report ADD COLUMN IF NOT EXISTS work_duration_hours NUMERIC(6,2) NULL;
