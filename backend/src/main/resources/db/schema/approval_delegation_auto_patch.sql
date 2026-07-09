ALTER TABLE approval_delegation
    ADD COLUMN IF NOT EXISTS start_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS end_at TIMESTAMP NULL,
    ADD COLUMN IF NOT EXISTS delegation_type VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS source_approval_id BIGINT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_approval_delegation_type'
    ) THEN
        ALTER TABLE approval_delegation
            ADD CONSTRAINT chk_approval_delegation_type
            CHECK (delegation_type IN ('MANUAL', 'DEFAULT', 'AUTO'));
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_approval_delegation_datetime_period'
    ) THEN
        ALTER TABLE approval_delegation
            ADD CONSTRAINT chk_approval_delegation_datetime_period
            CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_approval_delegation_source'
    ) THEN
        ALTER TABLE approval_delegation
            ADD CONSTRAINT fk_approval_delegation_source
            FOREIGN KEY (source_approval_id) REFERENCES approval_document(approval_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_approval_delegation_delegate_at
    ON approval_delegation(delegate_emp_id, active_yn, deleted_yn, delegation_type, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_approval_delegation_source
    ON approval_delegation(source_approval_id);
