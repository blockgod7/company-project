-- Phase 7 approval delegation first pass

CREATE TABLE IF NOT EXISTS approval_delegation (
    delegation_id BIGSERIAL PRIMARY KEY,
    owner_emp_id BIGINT NOT NULL,
    delegate_emp_id BIGINT NOT NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NULL,
    reason TEXT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT chk_approval_delegation_active CHECK (active_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_delegation_deleted CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_delegation_period CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT chk_approval_delegation_not_self CHECK (owner_emp_id <> delegate_emp_id),
    CONSTRAINT fk_approval_delegation_owner FOREIGN KEY (owner_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_delegation_delegate FOREIGN KEY (delegate_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_delegation_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_delegation_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_delegation_owner
    ON approval_delegation(owner_emp_id, active_yn, deleted_yn);

CREATE INDEX IF NOT EXISTS idx_approval_delegation_delegate
    ON approval_delegation(delegate_emp_id, active_yn, deleted_yn, start_date, end_date);

DROP TRIGGER IF EXISTS trg_approval_delegation_updated_at ON approval_delegation;
CREATE TRIGGER trg_approval_delegation_updated_at
BEFORE UPDATE ON approval_delegation
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();
