CREATE TABLE IF NOT EXISTS approval_template (
    template_id BIGSERIAL PRIMARY KEY,
    template_code VARCHAR(50) NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    version INT NOT NULL,
    description VARCHAR(500) NULL,
    fields_json TEXT NOT NULL,
    print_layout_json TEXT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT uq_approval_template_version UNIQUE (template_code, version)
);

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS template_code VARCHAR(50) NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS document_no VARCHAR(30) NULL;

UPDATE approval_document
SET document_no = 'APP-' || EXTRACT(YEAR FROM COALESCE(requested_at, NOW()))::INT || '-' || lpad(approval_id::TEXT, 6, '0')
WHERE document_no IS NULL;

ALTER TABLE approval_document
    ALTER COLUMN document_no SET NOT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS form_data_json TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS template_version INT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS template_snapshot_json TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS search_text TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS correction_of_approval_id BIGINT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS pdf_status VARCHAR(20) NOT NULL DEFAULT 'NONE';

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS pdf_file_id BIGINT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS pdf_generated_at TIMESTAMP NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS pdf_error_message TEXT NULL;

ALTER TABLE approval_document
    ADD COLUMN IF NOT EXISTS pdf_hash VARCHAR(128) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_approval_document_no_idx ON approval_document(document_no);
CREATE INDEX IF NOT EXISTS idx_approval_document_template ON approval_document(template_code);
CREATE INDEX IF NOT EXISTS idx_approval_document_search_text ON approval_document USING gin(to_tsvector('simple', coalesce(search_text, '')));

ALTER TABLE approval_document
    DROP CONSTRAINT IF EXISTS chk_approval_document_status;

ALTER TABLE approval_document
    ADD CONSTRAINT chk_approval_document_status CHECK (status IN ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELED'));

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS signature_snapshot_file_id BIGINT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS signature_snapshot_json TEXT NULL;

ALTER TABLE approval_line
    ADD COLUMN IF NOT EXISTS signed_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS emp_signature (
    signature_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    signature_file_id BIGINT NULL REFERENCES attach_file(file_id),
    display_name VARCHAR(100) NOT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_signature_emp_active ON emp_signature(emp_id, active_yn);

CREATE TABLE IF NOT EXISTS approval_pdf_history (
    id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL REFERENCES approval_document(approval_id),
    old_pdf_file_id BIGINT NULL REFERENCES attach_file(file_id),
    new_pdf_file_id BIGINT NOT NULL REFERENCES attach_file(file_id),
    old_pdf_hash VARCHAR(128) NULL,
    new_pdf_hash VARCHAR(128) NOT NULL,
    regenerated_by BIGINT NOT NULL REFERENCES emp(emp_id),
    regenerated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_pdf_history_document ON approval_pdf_history(approval_id);
