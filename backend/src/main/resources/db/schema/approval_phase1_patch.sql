-- Phase 1 electronic approval foundation patch.
-- Apply after the existing schema/template patch on databases that already contain approval tables.

ALTER TABLE approval_document
    ALTER COLUMN document_no DROP NOT NULL;

ALTER TABLE approval_document
    ALTER COLUMN document_no TYPE VARCHAR(50);

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS content_snapshot_json TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS approval_line_snapshot_json TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS signature_snapshot_json TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS correction_reason TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS origin_document_id BIGINT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS revision_no INT NOT NULL DEFAULT 0;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS resubmit_reason TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS draft_dept_id BIGINT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS draft_dept_code VARCHAR(50) NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS draft_dept_name VARCHAR(100) NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS current_stage VARCHAR(50) NOT NULL DEFAULT 'DRAFT';

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL';

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS first_submitted_at TIMESTAMP NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS last_submitted_at TIMESTAMP NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS submit_count INT NOT NULL DEFAULT 0;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS withdraw_reason TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS pdf_generated_by BIGINT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE approval_document
    DROP CONSTRAINT IF EXISTS chk_approval_document_status;

UPDATE approval_document
SET status = 'IN_PROGRESS'
WHERE status = 'PENDING';

UPDATE approval_document
SET current_stage = CASE
    WHEN status = 'DRAFT' THEN 'DRAFT'
    WHEN status = 'IN_PROGRESS' THEN 'APPROVAL_PROGRESS'
    WHEN status = 'APPROVED' THEN 'COMPLETED'
    WHEN status = 'REJECTED' THEN 'REJECTED'
    WHEN status = 'WITHDRAWN' THEN 'WITHDRAWN'
    WHEN status = 'CANCELED' THEN 'CANCELED'
    ELSE current_stage
END;

UPDATE approval_document d
SET draft_dept_id = e.dept_id,
    draft_dept_code = dept.dept_code,
    draft_dept_name = dept.dept_name
FROM emp e
LEFT JOIN dept ON dept.dept_id = e.dept_id
WHERE d.requester_emp_id = e.emp_id
  AND d.draft_dept_id IS NULL;

UPDATE approval_document
SET first_submitted_at = requested_at,
    last_submitted_at = requested_at,
    submit_count = CASE WHEN status = 'DRAFT' THEN 0 ELSE 1 END
WHERE first_submitted_at IS NULL;

ALTER TABLE approval_document
    ADD CONSTRAINT chk_approval_document_status CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELED'));

ALTER TABLE approval_document
    DROP CONSTRAINT IF EXISTS chk_approval_document_stage;

ALTER TABLE approval_document
    ADD CONSTRAINT chk_approval_document_stage CHECK (current_stage IN ('DRAFT', 'AGREEMENT_PROGRESS', 'APPROVAL_PROGRESS', 'RECEIVER_PROGRESS', 'COMPLETED', 'REJECTED', 'WITHDRAWN', 'CANCELED'));

ALTER TABLE approval_document
    DROP CONSTRAINT IF EXISTS chk_approval_document_priority;

ALTER TABLE approval_document
    ADD CONSTRAINT chk_approval_document_priority CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_document_no_idx
ON approval_document(document_no);

CREATE INDEX IF NOT EXISTS idx_approval_document_no
ON approval_document(document_no);

CREATE INDEX IF NOT EXISTS idx_approval_document_status_stage
ON approval_document(status, current_stage);

CREATE INDEX IF NOT EXISTS idx_approval_document_draft_dept
ON approval_document(draft_dept_id);

CREATE INDEX IF NOT EXISTS idx_approval_document_submitted
ON approval_document(last_submitted_at);

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS line_type VARCHAR(30) NOT NULL DEFAULT 'APPROVAL';

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS target_type VARCHAR(30) NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS target_id BIGINT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS assigned_emp_id BIGINT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS acted_emp_id BIGINT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMP NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMP NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS read_at TIMESTAMP NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS emp_no_snapshot VARCHAR(50) NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS emp_name_snapshot VARCHAR(100) NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS dept_id_snapshot BIGINT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS dept_code_snapshot VARCHAR(50) NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS dept_name_snapshot VARCHAR(100) NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS position_snapshot VARCHAR(100) NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS sign_image_file_id BIGINT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS sign_snapshot_file_id BIGINT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

UPDATE approval_line l
SET line_type = 'APPROVAL',
    assigned_emp_id = l.approver_emp_id,
    target_type = 'EMPLOYEE',
    target_id = l.approver_emp_id,
    emp_no_snapshot = e.emp_no,
    emp_name_snapshot = e.emp_name,
    dept_id_snapshot = e.dept_id,
    dept_code_snapshot = d.dept_code,
    dept_name_snapshot = d.dept_name,
    position_snapshot = e.position_name
FROM emp e
LEFT JOIN dept d ON d.dept_id = e.dept_id
WHERE l.approver_emp_id = e.emp_id
  AND l.assigned_emp_id IS NULL;

ALTER TABLE approval_line
    DROP CONSTRAINT IF EXISTS chk_approval_line_type;

ALTER TABLE approval_line
    ADD CONSTRAINT chk_approval_line_type CHECK (line_type IN ('AGREEMENT', 'APPROVAL', 'RECEIVER', 'REFERENCE', 'READER'));

ALTER TABLE approval_line
    DROP CONSTRAINT IF EXISTS chk_approval_line_status;

ALTER TABLE approval_line
    ADD CONSTRAINT chk_approval_line_status CHECK (status IN ('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'RECEIVED', 'READ', 'RECEIPT_COMPLETED'));

CREATE INDEX IF NOT EXISTS idx_approval_line_emp_type_status
ON approval_line(assigned_emp_id, line_type, status);

CREATE INDEX IF NOT EXISTS idx_approval_line_target
ON approval_line(target_type, target_id);
