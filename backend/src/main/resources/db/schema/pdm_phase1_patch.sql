-- PDM / Drawing Management phase 1 schema.

CREATE TABLE IF NOT EXISTS pdm_drawing (
    drawing_id BIGSERIAL PRIMARY KEY,
    category VARCHAR(30) NOT NULL,
    drawing_no VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    company_name VARCHAR(150) NULL,
    project_name VARCHAR(150) NULL,
    business_unit VARCHAR(150) NULL,
    process_name VARCHAR(150) NULL,
    equipment_name VARCHAR(150) NULL,
    group_name VARCHAR(150) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    current_revision_id BIGINT NULL,
    description TEXT NULL,
    created_by_emp_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT uk_pdm_drawing_no UNIQUE (drawing_no),
    CONSTRAINT chk_pdm_drawing_category CHECK (category IN ('PRODUCT', 'EQUIPMENT')),
    CONSTRAINT chk_pdm_drawing_status CHECK (status IN ('ACTIVE', 'OLD_VERSION', 'VOIDED', 'ON_HOLD')),
    CONSTRAINT fk_pdm_drawing_created_by_emp FOREIGN KEY (created_by_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_drawing_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_drawing_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

ALTER TABLE pdm_drawing ADD COLUMN IF NOT EXISTS project_name VARCHAR(150) NULL;
ALTER TABLE pdm_drawing ADD COLUMN IF NOT EXISTS business_unit VARCHAR(150) NULL;
ALTER TABLE pdm_drawing ADD COLUMN IF NOT EXISTS process_name VARCHAR(150) NULL;

CREATE TABLE IF NOT EXISTS pdm_folder (
    folder_id BIGSERIAL PRIMARY KEY,
    category VARCHAR(30) NOT NULL,
    company_name VARCHAR(150) NULL,
    project_name VARCHAR(150) NULL,
    business_unit VARCHAR(150) NULL,
    process_name VARCHAR(150) NULL,
    folder_kind VARCHAR(30) NOT NULL,
    folder_name VARCHAR(150) NOT NULL,
    created_by_emp_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT chk_pdm_folder_category CHECK (category IN ('PRODUCT', 'EQUIPMENT')),
    CONSTRAINT chk_pdm_folder_kind CHECK (folder_kind IN ('COMPANY', 'PROJECT', 'BUSINESS', 'PROCESS', 'COMMON', 'EQUIPMENT')),
    CONSTRAINT fk_pdm_folder_created_by_emp FOREIGN KEY (created_by_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_folder_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_folder_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE TABLE IF NOT EXISTS pdm_drawing_revision (
    revision_id BIGSERIAL PRIMARY KEY,
    drawing_id BIGINT NOT NULL,
    revision_label VARCHAR(50) NOT NULL,
    revision_order INT NOT NULL DEFAULT 0,
    revision_date DATE NULL,
    received_date DATE NULL,
    file_id BIGINT NULL,
    latest_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    void_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    change_note TEXT NULL,
    created_by_emp_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT fk_pdm_revision_drawing FOREIGN KEY (drawing_id) REFERENCES pdm_drawing(drawing_id),
    CONSTRAINT fk_pdm_revision_file FOREIGN KEY (file_id) REFERENCES attach_file(file_id),
    CONSTRAINT chk_pdm_revision_latest CHECK (latest_yn IN ('Y', 'N')),
    CONSTRAINT chk_pdm_revision_void CHECK (void_yn IN ('Y', 'N')),
    CONSTRAINT fk_pdm_revision_created_by_emp FOREIGN KEY (created_by_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_revision_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_revision_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_pdm_drawing_current_revision'
    ) THEN
        ALTER TABLE pdm_drawing
            ADD CONSTRAINT fk_pdm_drawing_current_revision
            FOREIGN KEY (current_revision_id) REFERENCES pdm_drawing_revision(revision_id);
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS pdm_drawing_permission (
    permission_id BIGSERIAL PRIMARY KEY,
    category VARCHAR(30) NULL,
    drawing_id BIGINT NULL,
    dept_id BIGINT NULL,
    emp_id BIGINT NULL,
    can_register_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    can_revise_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    can_view_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    can_download_request_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    can_download_approve_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT fk_pdm_permission_drawing FOREIGN KEY (drawing_id) REFERENCES pdm_drawing(drawing_id),
    CONSTRAINT fk_pdm_permission_dept FOREIGN KEY (dept_id) REFERENCES dept(dept_id),
    CONSTRAINT fk_pdm_permission_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id),
    CONSTRAINT chk_pdm_permission_category CHECK (category IS NULL OR category IN ('PRODUCT', 'EQUIPMENT')),
    CONSTRAINT chk_pdm_permission_target CHECK (dept_id IS NOT NULL OR emp_id IS NOT NULL),
    CONSTRAINT chk_pdm_permission_register CHECK (can_register_yn IN ('Y', 'N')),
    CONSTRAINT chk_pdm_permission_revise CHECK (can_revise_yn IN ('Y', 'N')),
    CONSTRAINT chk_pdm_permission_view CHECK (can_view_yn IN ('Y', 'N')),
    CONSTRAINT chk_pdm_permission_request CHECK (can_download_request_yn IN ('Y', 'N')),
    CONSTRAINT chk_pdm_permission_approve CHECK (can_download_approve_yn IN ('Y', 'N')),
    CONSTRAINT fk_pdm_permission_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_permission_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE TABLE IF NOT EXISTS pdm_download_request (
    request_id BIGSERIAL PRIMARY KEY,
    drawing_id BIGINT NOT NULL,
    revision_id BIGINT NOT NULL,
    requester_emp_id BIGINT NOT NULL,
    approval_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT fk_pdm_download_drawing FOREIGN KEY (drawing_id) REFERENCES pdm_drawing(drawing_id),
    CONSTRAINT fk_pdm_download_revision FOREIGN KEY (revision_id) REFERENCES pdm_drawing_revision(revision_id),
    CONSTRAINT fk_pdm_download_requester FOREIGN KEY (requester_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_download_approval FOREIGN KEY (approval_id) REFERENCES approval_document(approval_id),
    CONSTRAINT fk_pdm_download_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_pdm_download_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE TABLE IF NOT EXISTS pdm_download_log (
    download_log_id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    file_id BIGINT NOT NULL,
    downloaded_by BIGINT NOT NULL,
    ip_address VARCHAR(100) NULL,
    user_agent VARCHAR(500) NULL,
    downloaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_pdm_download_log_request FOREIGN KEY (request_id) REFERENCES pdm_download_request(request_id),
    CONSTRAINT fk_pdm_download_log_file FOREIGN KEY (file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_pdm_download_log_emp FOREIGN KEY (downloaded_by) REFERENCES emp(emp_id)
);

CREATE INDEX IF NOT EXISTS idx_pdm_drawing_category ON pdm_drawing(category);
CREATE INDEX IF NOT EXISTS idx_pdm_drawing_status ON pdm_drawing(status);
CREATE INDEX IF NOT EXISTS idx_pdm_folder_category ON pdm_folder(category);
CREATE INDEX IF NOT EXISTS idx_pdm_revision_drawing ON pdm_drawing_revision(drawing_id);
CREATE INDEX IF NOT EXISTS idx_pdm_permission_emp ON pdm_drawing_permission(emp_id);
CREATE INDEX IF NOT EXISTS idx_pdm_permission_dept ON pdm_drawing_permission(dept_id);
CREATE INDEX IF NOT EXISTS idx_pdm_download_requester ON pdm_download_request(requester_emp_id);
CREATE INDEX IF NOT EXISTS idx_pdm_download_approval ON pdm_download_request(approval_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pdm_drawing_updated_at') THEN
        CREATE TRIGGER trg_pdm_drawing_updated_at
        BEFORE UPDATE ON pdm_drawing
        FOR EACH ROW
        EXECUTE FUNCTION fn_update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pdm_revision_updated_at') THEN
        CREATE TRIGGER trg_pdm_revision_updated_at
        BEFORE UPDATE ON pdm_drawing_revision
        FOR EACH ROW
        EXECUTE FUNCTION fn_update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pdm_permission_updated_at') THEN
        CREATE TRIGGER trg_pdm_permission_updated_at
        BEFORE UPDATE ON pdm_drawing_permission
        FOR EACH ROW
        EXECUTE FUNCTION fn_update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pdm_folder_updated_at') THEN
        CREATE TRIGGER trg_pdm_folder_updated_at
        BEFORE UPDATE ON pdm_folder
        FOR EACH ROW
        EXECUTE FUNCTION fn_update_updated_at();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pdm_download_request_updated_at') THEN
        CREATE TRIGGER trg_pdm_download_request_updated_at
        BEFORE UPDATE ON pdm_download_request
        FOR EACH ROW
        EXECUTE FUNCTION fn_update_updated_at();
    END IF;
END;
$$;

INSERT INTO approval_template (
    template_code,
    template_name,
    version,
    description,
    fields_json,
    print_layout_json,
    active_yn,
    sort_order
)
SELECT
    'PDM_DOWNLOAD',
    '도면 다운로드 요청',
    1,
    '도면관리에서 시작되는 도면 다운로드 승인 요청',
    '[{"name":"drawingNo","label":"도면번호","type":"text","required":true},{"name":"drawingTitle","label":"도면명","type":"text","required":true},{"name":"category","label":"구분","type":"text","required":true},{"name":"revisionLabel","label":"리비전","type":"text","required":true},{"name":"reason","label":"요청 사유","type":"textarea","required":true}]',
    '{"layout":"pdm-download","sections":["meta","fields","approvalLines"]}',
    'Y',
    70
WHERE NOT EXISTS (
    SELECT 1 FROM approval_template
    WHERE template_code = 'PDM_DOWNLOAD'
      AND version = 1
);
