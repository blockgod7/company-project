-- Phase 5 default approval line patch.
-- Apply after approval_phase1_patch.sql.

CREATE TABLE IF NOT EXISTS approval_default_line (
    default_line_id BIGSERIAL PRIMARY KEY,
    owner_emp_id BIGINT NULL,
    template_code VARCHAR(50) NULL,
    line_name VARCHAR(100) NOT NULL,
    default_type VARCHAR(30) NOT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    CONSTRAINT chk_approval_default_line_type CHECK (default_type IN ('PERSONAL', 'TEMPLATE')),
    CONSTRAINT chk_approval_default_line_active CHECK (active_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_default_line_deleted CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT fk_approval_default_line_owner FOREIGN KEY (owner_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_default_line_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_default_line_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_default_line_owner
ON approval_default_line(owner_emp_id, default_type, active_yn, deleted_yn);

CREATE INDEX IF NOT EXISTS idx_approval_default_line_template
ON approval_default_line(template_code, default_type, active_yn, deleted_yn);

CREATE TABLE IF NOT EXISTS approval_default_line_step (
    default_line_step_id BIGSERIAL PRIMARY KEY,
    default_line_id BIGINT NOT NULL,
    step_order INT NOT NULL,
    approver_emp_id BIGINT NOT NULL,
    line_type VARCHAR(30) NOT NULL,
    required_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL,
    created_by BIGINT NULL,
    updated_by BIGINT NULL,
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    CONSTRAINT chk_approval_default_line_step_type CHECK (line_type IN ('AGREEMENT', 'APPROVAL', 'RECEIVER', 'REFERENCE', 'READER')),
    CONSTRAINT chk_approval_default_line_step_required CHECK (required_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_default_line_step_deleted CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT fk_approval_default_line_step_line FOREIGN KEY (default_line_id) REFERENCES approval_default_line(default_line_id),
    CONSTRAINT fk_approval_default_line_step_approver FOREIGN KEY (approver_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_default_line_step_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_default_line_step_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_default_line_step_line
ON approval_default_line_step(default_line_id, deleted_yn, step_order);
