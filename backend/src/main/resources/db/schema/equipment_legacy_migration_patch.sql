CREATE TABLE IF NOT EXISTS equipment_migration_run (
    migration_run_id BIGSERIAL PRIMARY KEY,
    source_system VARCHAR(30) NOT NULL,
    source_path TEXT NOT NULL,
    source_hash VARCHAR(64),
    dry_run_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    status VARCHAR(30) NOT NULL,
    equipment_total INTEGER NOT NULL DEFAULT 0,
    equipment_imported INTEGER NOT NULL DEFAULT 0,
    work_order_total INTEGER NOT NULL DEFAULT 0,
    work_order_imported INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    warning_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    summary_json JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    started_by BIGINT NULL REFERENCES emp(emp_id)
);

CREATE TABLE IF NOT EXISTS equipment_migration_issue (
    migration_issue_id BIGSERIAL PRIMARY KEY,
    migration_run_id BIGINT NOT NULL REFERENCES equipment_migration_run(migration_run_id) ON DELETE CASCADE,
    severity VARCHAR(20) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    source_record_id VARCHAR(100),
    source_row_no INTEGER,
    issue_code VARCHAR(60) NOT NULL,
    issue_message TEXT NOT NULL,
    source_value TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS equipment_migration_user_map (
    migration_run_id BIGINT NOT NULL REFERENCES equipment_migration_run(migration_run_id) ON DELETE CASCADE,
    source_user_id VARCHAR(50) NOT NULL,
    source_user_name VARCHAR(100),
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    match_method VARCHAR(30) NOT NULL,
    applied_by VARCHAR(100) NOT NULL DEFAULT CURRENT_USER,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (migration_run_id, source_user_id)
);

ALTER TABLE equipment_migration_issue
    ADD COLUMN IF NOT EXISTS resolved_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS resolution_note TEXT;

ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS source_system VARCHAR(30),
    ADD COLUMN IF NOT EXISTS source_record_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS source_row_no INTEGER,
    ADD COLUMN IF NOT EXISTS source_payload_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_payload JSONB,
    ADD COLUMN IF NOT EXISTS migration_run_id BIGINT REFERENCES equipment_migration_run(migration_run_id);

ALTER TABLE equipment_report
    ADD COLUMN IF NOT EXISTS cancel_stage VARCHAR(30),
    ADD COLUMN IF NOT EXISTS cancelled_by_emp_id BIGINT REFERENCES emp(emp_id),
    ADD COLUMN IF NOT EXISTS cancelled_on DATE,
    ADD COLUMN IF NOT EXISTS source_system VARCHAR(30),
    ADD COLUMN IF NOT EXISTS source_record_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS source_status VARCHAR(20),
    ADD COLUMN IF NOT EXISTS source_row_no INTEGER,
    ADD COLUMN IF NOT EXISTS source_payload_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_payload JSONB,
    ADD COLUMN IF NOT EXISTS source_request_user_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_work_user_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_cancel_user_id VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_request_dept_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_assignment_dept_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS migration_run_id BIGINT REFERENCES equipment_migration_run(migration_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_source_record
    ON equipment(source_system, source_record_id)
    WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_report_source_record
    ON equipment_report(source_system, source_record_id)
    WHERE source_system IS NOT NULL AND source_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_migration_run_status
    ON equipment_migration_run(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_equipment_migration_issue_run
    ON equipment_migration_issue(migration_run_id, severity, migration_issue_id);

CREATE INDEX IF NOT EXISTS idx_equipment_report_cancelled
    ON equipment_report(state, cancel_stage, cancelled_on);
