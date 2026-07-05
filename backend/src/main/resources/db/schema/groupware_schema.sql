-- =========================================================
-- Company Integrated Groupware - Phase 1 Schema
-- Target DB: PostgreSQL
-- Version: 1.0
-- Created: 2026-06-16
-- Scope:
--   01_Groupware_Master_Plan
--   - DEPT / EMP
--   - ROLE / EMP_ROLE
--   - MENU / MENU_ROLE
--   - COMMON_CODE
--   - NOTICE / BOARD
--   - COMMENT / READ
--   - ATTACH_FILE
--   - NOTIFICATION
--   - AUDIT_LOG / VIEW_LOG / SYSTEM_LOG
-- Note:
--   02_Approval_System_Design and 03_PDM_System_Design are excluded.
-- =========================================================

-- =========================================================
-- 0. Common function: updated_at auto update
-- =========================================================

CREATE OR REPLACE FUNCTION fn_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- 1. DEPT - Department Master
-- =========================================================

CREATE TABLE dept (
    dept_id BIGSERIAL PRIMARY KEY,
    dept_code VARCHAR(30) NOT NULL UNIQUE,
    dept_name VARCHAR(100) NOT NULL,
    parent_dept_id BIGINT NULL,
    sort_order INT DEFAULT 0,
    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_dept_use_yn CHECK (use_yn IN ('Y', 'N')),
    CONSTRAINT fk_dept_parent FOREIGN KEY (parent_dept_id) REFERENCES dept(dept_id)
);

CREATE INDEX idx_dept_parent ON dept(parent_dept_id);
CREATE INDEX idx_dept_use_yn ON dept(use_yn);

CREATE TRIGGER trg_dept_updated_at
BEFORE UPDATE ON dept
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


-- =========================================================
-- 2. EMP - Employee Master
-- =========================================================

CREATE TABLE emp (
    emp_id BIGSERIAL PRIMARY KEY,
    emp_no VARCHAR(30) NOT NULL UNIQUE,
    login_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    emp_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(50) NULL,

    dept_id BIGINT NULL,
    position_name VARCHAR(50) NULL,
    job_title VARCHAR(50) NULL,
    manager_emp_id BIGINT NULL,

    role_code VARCHAR(30) NOT NULL DEFAULT 'USER',

    hire_date DATE NULL,
    retire_date DATE NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMP NULL,
    login_fail_count INT NOT NULL DEFAULT 0,
    account_locked_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    password_changed_at TIMESTAMP NULL,

    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_emp_use_yn CHECK (use_yn IN ('Y', 'N')),
    CONSTRAINT chk_emp_account_locked_yn CHECK (account_locked_yn IN ('Y', 'N')),
    CONSTRAINT chk_emp_status CHECK (status IN ('ACTIVE', 'LEAVE', 'RETIRED')),
    CONSTRAINT fk_emp_dept FOREIGN KEY (dept_id) REFERENCES dept(dept_id),
    CONSTRAINT fk_emp_manager FOREIGN KEY (manager_emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_emp_dept ON emp(dept_id);
CREATE INDEX idx_emp_manager ON emp(manager_emp_id);
CREATE INDEX idx_emp_status ON emp(status);
CREATE INDEX idx_emp_use_yn ON emp(use_yn);

CREATE TRIGGER trg_emp_updated_at
BEFORE UPDATE ON emp
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TABLE auth_refresh_token (
    refresh_token_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP NULL,
    created_ip VARCHAR(100) NULL,
    created_user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_auth_refresh_token_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_auth_refresh_token_emp ON auth_refresh_token(emp_id);
CREATE INDEX idx_auth_refresh_token_expires ON auth_refresh_token(expires_at);


-- Add audit columns foreign keys after EMP creation
ALTER TABLE dept
    ADD CONSTRAINT fk_dept_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    ADD CONSTRAINT fk_dept_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id);

ALTER TABLE emp
    ADD CONSTRAINT fk_emp_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    ADD CONSTRAINT fk_emp_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id);


-- =========================================================
-- 3. COMMON_CODE - Common Code Master
-- =========================================================

CREATE TABLE common_code (
    code_id BIGSERIAL PRIMARY KEY,
    code_group VARCHAR(50) NOT NULL,
    code VARCHAR(50) NOT NULL,
    code_name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    sort_order INT DEFAULT 0,
    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT uq_common_code UNIQUE (code_group, code),
    CONSTRAINT chk_common_code_use_yn CHECK (use_yn IN ('Y', 'N')),
    CONSTRAINT fk_common_code_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_common_code_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_common_code_group ON common_code(code_group);
CREATE INDEX idx_common_code_use_yn ON common_code(use_yn);

CREATE TRIGGER trg_common_code_updated_at
BEFORE UPDATE ON common_code
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


-- =========================================================
-- 4. ROLE / EMP_ROLE
-- =========================================================

CREATE TABLE role (
    role_id BIGSERIAL PRIMARY KEY,
    role_code VARCHAR(30) NOT NULL UNIQUE,
    role_name VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_role_use_yn CHECK (use_yn IN ('Y', 'N')),
    CONSTRAINT fk_role_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_role_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE TRIGGER trg_role_updated_at
BEFORE UPDATE ON role
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


CREATE TABLE emp_role (
    emp_role_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_emp_role_use_yn CHECK (use_yn IN ('Y', 'N')),
    CONSTRAINT fk_emp_role_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_emp_role_role FOREIGN KEY (role_id) REFERENCES role(role_id),
    CONSTRAINT fk_emp_role_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_emp_role_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_emp_role_emp ON emp_role(emp_id);
CREATE INDEX idx_emp_role_role ON emp_role(role_id);

CREATE TRIGGER trg_emp_role_updated_at
BEFORE UPDATE ON emp_role
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


-- =========================================================
-- 5. MENU / MENU_ROLE
-- =========================================================

CREATE TABLE menu (
    menu_id BIGSERIAL PRIMARY KEY,
    menu_name VARCHAR(100) NOT NULL,
    menu_path VARCHAR(255) NULL,
    parent_menu_id BIGINT NULL,
    sort_order INT DEFAULT 0,
    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_menu_use_yn CHECK (use_yn IN ('Y', 'N')),
    CONSTRAINT fk_menu_parent FOREIGN KEY (parent_menu_id) REFERENCES menu(menu_id),
    CONSTRAINT fk_menu_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_menu_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_menu_parent ON menu(parent_menu_id);
CREATE INDEX idx_menu_use_yn ON menu(use_yn);

CREATE TRIGGER trg_menu_updated_at
BEFORE UPDATE ON menu
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


CREATE TABLE menu_role (
    menu_role_id BIGSERIAL PRIMARY KEY,
    menu_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    can_read VARCHAR(1) NOT NULL DEFAULT 'N',
    can_write VARCHAR(1) NOT NULL DEFAULT 'N',
    can_update VARCHAR(1) NOT NULL DEFAULT 'N',
    can_delete VARCHAR(1) NOT NULL DEFAULT 'N',
    can_approve VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT uq_menu_role UNIQUE (menu_id, role_id),
    CONSTRAINT chk_menu_role_can_read CHECK (can_read IN ('Y', 'N')),
    CONSTRAINT chk_menu_role_can_write CHECK (can_write IN ('Y', 'N')),
    CONSTRAINT chk_menu_role_can_update CHECK (can_update IN ('Y', 'N')),
    CONSTRAINT chk_menu_role_can_delete CHECK (can_delete IN ('Y', 'N')),
    CONSTRAINT chk_menu_role_can_approve CHECK (can_approve IN ('Y', 'N')),
    CONSTRAINT fk_menu_role_menu FOREIGN KEY (menu_id) REFERENCES menu(menu_id),
    CONSTRAINT fk_menu_role_role FOREIGN KEY (role_id) REFERENCES role(role_id),
    CONSTRAINT fk_menu_role_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_menu_role_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_menu_role_menu ON menu_role(menu_id);
CREATE INDEX idx_menu_role_role ON menu_role(role_id);

CREATE TRIGGER trg_menu_role_updated_at
BEFORE UPDATE ON menu_role
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


-- =========================================================
-- 6. NOTICE / NOTICE_COMMENT / NOTICE_READ
-- =========================================================

CREATE TABLE notice (
    notice_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    writer_emp_id BIGINT NOT NULL,
    view_count INT NOT NULL DEFAULT 0,
    pinned_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_notice_pinned_yn CHECK (pinned_yn IN ('Y', 'N')),
    CONSTRAINT chk_notice_deleted_yn CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT fk_notice_writer FOREIGN KEY (writer_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_notice_deleted_by FOREIGN KEY (deleted_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_notice_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_notice_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_notice_writer ON notice(writer_emp_id);
CREATE INDEX idx_notice_deleted_yn ON notice(deleted_yn);
CREATE INDEX idx_notice_created_at ON notice(created_at);

CREATE TRIGGER trg_notice_updated_at
BEFORE UPDATE ON notice
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


CREATE TABLE notice_comment (
    comment_id BIGSERIAL PRIMARY KEY,
    notice_id BIGINT NOT NULL,
    writer_emp_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_notice_comment_deleted_yn CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT fk_notice_comment_notice FOREIGN KEY (notice_id) REFERENCES notice(notice_id),
    CONSTRAINT fk_notice_comment_writer FOREIGN KEY (writer_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_notice_comment_deleted_by FOREIGN KEY (deleted_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_notice_comment_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_notice_comment_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_notice_comment_notice ON notice_comment(notice_id);
CREATE INDEX idx_notice_comment_writer ON notice_comment(writer_emp_id);

CREATE TRIGGER trg_notice_comment_updated_at
BEFORE UPDATE ON notice_comment
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


CREATE TABLE notice_read (
    notice_id BIGINT NOT NULL,
    emp_id BIGINT NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (notice_id, emp_id),
    CONSTRAINT fk_notice_read_notice FOREIGN KEY (notice_id) REFERENCES notice(notice_id),
    CONSTRAINT fk_notice_read_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_notice_read_emp ON notice_read(emp_id);


-- =========================================================
-- 7. BOARD / BOARD_POST / BOARD_COMMENT / BOARD_POST_READ
-- =========================================================

CREATE TABLE board (
    board_id BIGSERIAL PRIMARY KEY,
    board_code VARCHAR(50) NOT NULL UNIQUE,
    board_name VARCHAR(100) NOT NULL,
    dept_id BIGINT NULL,
    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_board_use_yn CHECK (use_yn IN ('Y', 'N')),
    CONSTRAINT fk_board_dept FOREIGN KEY (dept_id) REFERENCES dept(dept_id),
    CONSTRAINT fk_board_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_board_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_board_dept ON board(dept_id);
CREATE INDEX idx_board_use_yn ON board(use_yn);

CREATE TRIGGER trg_board_updated_at
BEFORE UPDATE ON board
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


CREATE TABLE board_post (
    post_id BIGSERIAL PRIMARY KEY,
    board_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    writer_emp_id BIGINT NOT NULL,
    view_count INT NOT NULL DEFAULT 0,
    draft_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_board_post_draft_yn CHECK (draft_yn IN ('Y', 'N')),
    CONSTRAINT chk_board_post_deleted_yn CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT fk_board_post_board FOREIGN KEY (board_id) REFERENCES board(board_id),
    CONSTRAINT fk_board_post_writer FOREIGN KEY (writer_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_board_post_deleted_by FOREIGN KEY (deleted_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_board_post_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_board_post_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_board_post_board ON board_post(board_id);
CREATE INDEX idx_board_post_writer ON board_post(writer_emp_id);
CREATE INDEX idx_board_post_deleted_yn ON board_post(deleted_yn);
CREATE INDEX idx_board_post_created_at ON board_post(created_at);

CREATE TRIGGER trg_board_post_updated_at
BEFORE UPDATE ON board_post
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


CREATE TABLE board_comment (
    comment_id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    writer_emp_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_board_comment_deleted_yn CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT fk_board_comment_post FOREIGN KEY (post_id) REFERENCES board_post(post_id),
    CONSTRAINT fk_board_comment_writer FOREIGN KEY (writer_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_board_comment_deleted_by FOREIGN KEY (deleted_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_board_comment_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_board_comment_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_board_comment_post ON board_comment(post_id);
CREATE INDEX idx_board_comment_writer ON board_comment(writer_emp_id);

CREATE TRIGGER trg_board_comment_updated_at
BEFORE UPDATE ON board_comment
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();


CREATE TABLE board_post_read (
    post_id BIGINT NOT NULL,
    emp_id BIGINT NOT NULL,
    read_at TIMESTAMP NOT NULL DEFAULT NOW(),

    PRIMARY KEY (post_id, emp_id),
    CONSTRAINT fk_board_post_read_post FOREIGN KEY (post_id) REFERENCES board_post(post_id),
    CONSTRAINT fk_board_post_read_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_board_post_read_emp ON board_post_read(emp_id);


-- =========================================================
-- 8. ATTACH_FILE
-- =========================================================

CREATE TABLE attach_file (
    file_id BIGSERIAL PRIMARY KEY,
    target_type VARCHAR(50) NOT NULL,
    target_id BIGINT NOT NULL,
    original_file_name VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    file_ext VARCHAR(30) NULL,
    file_hash VARCHAR(128) NULL,
    mime_type VARCHAR(100) NULL,
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,

    CONSTRAINT chk_attach_file_deleted_yn CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT fk_attach_file_deleted_by FOREIGN KEY (deleted_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_attach_file_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_attach_file_target ON attach_file(target_type, target_id);
CREATE INDEX idx_attach_file_hash ON attach_file(file_hash);
CREATE INDEX idx_attach_file_deleted_yn ON attach_file(deleted_yn);


-- =========================================================
-- 9. NOTIFICATION
-- =========================================================

CREATE TABLE notification (
    notification_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NULL,
    target_type VARCHAR(50) NULL,
    target_id BIGINT NULL,
    read_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    notification_status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    retry_count INT NOT NULL DEFAULT 0,
    last_error_message TEXT NULL,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notification_read_yn CHECK (read_yn IN ('Y', 'N')),
    CONSTRAINT chk_notification_status CHECK (notification_status IN ('PENDING', 'SENT', 'FAILED')),
    CONSTRAINT fk_notification_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_notification_emp ON notification(emp_id);
CREATE INDEX idx_notification_read_yn ON notification(read_yn);
CREATE INDEX idx_notification_status ON notification(notification_status);
CREATE INDEX idx_notification_created_at ON notification(created_at);


-- =========================================================
-- 9-1. APPROVAL - Electronic Approval
-- =========================================================

CREATE TABLE approval_template (
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

    CONSTRAINT uq_approval_template_version UNIQUE (template_code, version),
    CONSTRAINT chk_approval_template_active_yn CHECK (active_yn IN ('Y', 'N')),
    CONSTRAINT fk_approval_template_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_template_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_approval_template_code_active ON approval_template(template_code, active_yn);

CREATE TRIGGER trg_approval_template_updated_at
BEFORE UPDATE ON approval_template
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TABLE approval_document (
    approval_id BIGSERIAL PRIMARY KEY,
    document_no VARCHAR(50) NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    template_code VARCHAR(50) NULL,
    template_version INT NULL,
    template_snapshot_json TEXT NULL,
    form_data_json TEXT NULL,
    content_snapshot_json TEXT NULL,
    approval_line_snapshot_json TEXT NULL,
    signature_snapshot_json TEXT NULL,
    search_text TEXT NULL,
    correction_of_approval_id BIGINT NULL,
    correction_reason TEXT NULL,
    origin_document_id BIGINT NULL,
    revision_no INT NOT NULL DEFAULT 0,
    resubmit_reason TEXT NULL,
    requester_emp_id BIGINT NOT NULL,
    draft_dept_id BIGINT NULL,
    draft_dept_code VARCHAR(50) NULL,
    draft_dept_name VARCHAR(100) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    current_stage VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    priority VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    first_submitted_at TIMESTAMP NULL,
    last_submitted_at TIMESTAMP NULL,
    submit_count INT NOT NULL DEFAULT 0,
    completed_at TIMESTAMP NULL,
    withdrawn_at TIMESTAMP NULL,
    withdraw_reason TEXT NULL,
    pdf_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
    pdf_file_id BIGINT NULL,
    pdf_generated_at TIMESTAMP NULL,
    pdf_generated_by BIGINT NULL,
    pdf_error_message TEXT NULL,
    pdf_hash VARCHAR(128) NULL,
    deleted_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    deleted_at TIMESTAMP NULL,
    deleted_by BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT chk_approval_document_status CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELED')),
    CONSTRAINT chk_approval_document_stage CHECK (current_stage IN ('DRAFT', 'AGREEMENT_PROGRESS', 'APPROVAL_PROGRESS', 'RECEIVER_PROGRESS', 'COMPLETED', 'REJECTED', 'WITHDRAWN', 'CANCELED')),
    CONSTRAINT chk_approval_document_priority CHECK (priority IN ('NORMAL', 'IMPORTANT', 'URGENT')),
    CONSTRAINT chk_approval_document_pdf_status CHECK (pdf_status IN ('NONE', 'GENERATING', 'GENERATED', 'FAILED')),
    CONSTRAINT chk_approval_document_deleted_yn CHECK (deleted_yn IN ('Y', 'N')),
    CONSTRAINT uq_approval_document_no UNIQUE (document_no),
    CONSTRAINT fk_approval_document_requester FOREIGN KEY (requester_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_document_correction FOREIGN KEY (correction_of_approval_id) REFERENCES approval_document(approval_id),
    CONSTRAINT fk_approval_document_origin FOREIGN KEY (origin_document_id) REFERENCES approval_document(approval_id),
    CONSTRAINT fk_approval_document_draft_dept FOREIGN KEY (draft_dept_id) REFERENCES dept(dept_id),
    CONSTRAINT fk_approval_document_pdf_file FOREIGN KEY (pdf_file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_approval_document_pdf_generated_by FOREIGN KEY (pdf_generated_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_document_deleted_by FOREIGN KEY (deleted_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_document_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_document_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_approval_document_requester ON approval_document(requester_emp_id);
CREATE INDEX idx_approval_document_status ON approval_document(status);
CREATE INDEX idx_approval_document_status_stage ON approval_document(status, current_stage);
CREATE INDEX idx_approval_document_requested_at ON approval_document(requested_at);
CREATE INDEX idx_approval_document_submitted ON approval_document(last_submitted_at);
CREATE INDEX idx_approval_document_template ON approval_document(template_code);
CREATE INDEX idx_approval_document_draft_dept ON approval_document(draft_dept_id);
CREATE INDEX idx_approval_document_search_text ON approval_document USING gin(to_tsvector('simple', coalesce(search_text, '')));

CREATE TRIGGER trg_approval_document_updated_at
BEFORE UPDATE ON approval_document
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TABLE approval_line (
    line_id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL,
    approver_emp_id BIGINT NOT NULL,
    line_type VARCHAR(30) NOT NULL DEFAULT 'APPROVAL',
    target_type VARCHAR(30) NULL,
    target_id BIGINT NULL,
    assigned_emp_id BIGINT NULL,
    acted_emp_id BIGINT NULL,
    line_order INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
    comment TEXT NULL,
    acted_at TIMESTAMP NULL,
    due_at TIMESTAMP NULL,
    reminded_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    emp_no_snapshot VARCHAR(50) NULL,
    emp_name_snapshot VARCHAR(100) NULL,
    dept_id_snapshot BIGINT NULL,
    dept_code_snapshot VARCHAR(50) NULL,
    dept_name_snapshot VARCHAR(100) NULL,
    position_snapshot VARCHAR(100) NULL,
    sign_image_file_id BIGINT NULL,
    sign_snapshot_file_id BIGINT NULL,
    signature_snapshot_file_id BIGINT NULL,
    signature_snapshot_json TEXT NULL,
    signed_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    version BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT uq_approval_line_order UNIQUE (approval_id, line_order),
    CONSTRAINT chk_approval_line_type CHECK (line_type IN ('AGREEMENT', 'APPROVAL', 'RECEIVER', 'REFERENCE', 'READER')),
    CONSTRAINT chk_approval_line_status CHECK (status IN ('WAITING', 'PENDING', 'APPROVED', 'REJECTED', 'SKIPPED', 'RECEIVED', 'READ', 'RECEIPT_COMPLETED')),
    CONSTRAINT fk_approval_line_document FOREIGN KEY (approval_id) REFERENCES approval_document(approval_id),
    CONSTRAINT fk_approval_line_approver FOREIGN KEY (approver_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_line_assigned_emp FOREIGN KEY (assigned_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_line_acted_emp FOREIGN KEY (acted_emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_line_dept_snapshot FOREIGN KEY (dept_id_snapshot) REFERENCES dept(dept_id),
    CONSTRAINT fk_approval_line_sign_image_file FOREIGN KEY (sign_image_file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_approval_line_sign_snapshot_file FOREIGN KEY (sign_snapshot_file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_approval_line_signature_file FOREIGN KEY (signature_snapshot_file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_approval_line_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_line_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_approval_line_document ON approval_line(approval_id);
CREATE INDEX idx_approval_line_approver ON approval_line(approver_emp_id);
CREATE INDEX idx_approval_line_status ON approval_line(status);
CREATE INDEX idx_approval_line_emp_type_status ON approval_line(assigned_emp_id, line_type, status);
CREATE INDEX idx_approval_line_target ON approval_line(target_type, target_id);

CREATE TRIGGER trg_approval_line_updated_at
BEFORE UPDATE ON approval_line
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TABLE approval_default_line (
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

CREATE INDEX idx_approval_default_line_owner ON approval_default_line(owner_emp_id, default_type, active_yn, deleted_yn);
CREATE INDEX idx_approval_default_line_template ON approval_default_line(template_code, default_type, active_yn, deleted_yn);

CREATE TABLE approval_default_line_step (
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

CREATE INDEX idx_approval_default_line_step_line ON approval_default_line_step(default_line_id, deleted_yn, step_order);

CREATE TABLE approval_delegation (
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

CREATE INDEX idx_approval_delegation_owner ON approval_delegation(owner_emp_id, active_yn, deleted_yn);
CREATE INDEX idx_approval_delegation_delegate ON approval_delegation(delegate_emp_id, active_yn, deleted_yn, start_date, end_date);

CREATE TRIGGER trg_approval_delegation_updated_at
BEFORE UPDATE ON approval_delegation
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TABLE approval_operation_setting (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(500) NOT NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT fk_approval_operation_setting_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_operation_setting_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE TRIGGER trg_approval_operation_setting_updated_at
BEFORE UPDATE ON approval_operation_setting
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

INSERT INTO approval_operation_setting (setting_key, setting_value, description)
VALUES
    ('DECISION_DUE_HOURS', '72', '결재/합의 라인이 열린 뒤 처리 기한까지의 시간'),
    ('REMINDER_FIXED_DELAY_MS', '300000', '지연 알림 스캔 최소 실행 간격(ms)'),
    ('DELETED_DOCUMENT_RETENTION_DAYS', '1825', '보존삭제 문서를 영구보존 검토 전까지 보관할 최소 일수'),
    ('PERMANENT_DELETE_ENABLED', 'false', '전자결재 영구삭제 실행 허용 여부')
ON CONFLICT (setting_key) DO NOTHING;

CREATE TABLE emp_signature (
    signature_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL,
    signature_file_id BIGINT NULL,
    display_name VARCHAR(100) NOT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,

    CONSTRAINT chk_emp_signature_active_yn CHECK (active_yn IN ('Y', 'N')),
    CONSTRAINT fk_emp_signature_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_emp_signature_file FOREIGN KEY (signature_file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_emp_signature_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_emp_signature_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_emp_signature_emp_active ON emp_signature(emp_id, active_yn);

CREATE TRIGGER trg_emp_signature_updated_at
BEFORE UPDATE ON emp_signature
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TABLE approval_pdf_history (
    id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL,
    old_pdf_file_id BIGINT NULL,
    new_pdf_file_id BIGINT NOT NULL,
    old_pdf_hash VARCHAR(128) NULL,
    new_pdf_hash VARCHAR(128) NOT NULL,
    regenerated_by BIGINT NOT NULL,
    regenerated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reason TEXT NULL,

    CONSTRAINT fk_approval_pdf_history_document FOREIGN KEY (approval_id) REFERENCES approval_document(approval_id),
    CONSTRAINT fk_approval_pdf_history_old_file FOREIGN KEY (old_pdf_file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_approval_pdf_history_new_file FOREIGN KEY (new_pdf_file_id) REFERENCES attach_file(file_id),
    CONSTRAINT fk_approval_pdf_history_regenerated_by FOREIGN KEY (regenerated_by) REFERENCES emp(emp_id)
);

CREATE INDEX idx_approval_pdf_history_document ON approval_pdf_history(approval_id);

CREATE TABLE approval_equipment_proposal (
    approval_id BIGINT PRIMARY KEY REFERENCES approval_document(approval_id),
    workflow_stage VARCHAR(40) NOT NULL DEFAULT 'USER_APPROVAL',
    request_dept_name VARCHAR(100) NULL,
    equipment_name VARCHAR(200) NULL,
    required_completion_date VARCHAR(30) NULL,
    equipment_capacity VARCHAR(200) NULL,
    request_type VARCHAR(50) NULL,
    current_state TEXT NULL,
    requirements TEXT NULL,
    instructions TEXT NULL,
    user_economic_review TEXT NULL,
    pe_opinion TEXT NULL,
    design_opinion TEXT NULL,
    pe_economic_review TEXT NULL,
    purchase_opinion TEXT NULL,
    vendor_name VARCHAR(200) NULL,
    delivery_due_date VARCHAR(30) NULL,
    purchase_item_name VARCHAR(200) NULL,
    purchase_usage VARCHAR(300) NULL,
    quantity VARCHAR(100) NULL,
    price VARCHAR(100) NULL,
    purchase_note TEXT NULL,
    attachment_contract_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_quote_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_drawing_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_spec_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_etc VARCHAR(200) NULL,
    pe_assignee_emp_id BIGINT NULL REFERENCES emp(emp_id),
    purchase_assignee_emp_id BIGINT NULL REFERENCES emp(emp_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT chk_approval_equipment_stage CHECK (workflow_stage IN ('USER_APPROVAL', 'PE_INPUT', 'PE_APPROVAL', 'PURCHASE_INPUT', 'PURCHASE_APPROVAL', 'COMPLETED')),
    CONSTRAINT chk_approval_equipment_contract CHECK (attachment_contract_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_equipment_quote CHECK (attachment_quote_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_equipment_drawing CHECK (attachment_drawing_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_equipment_spec CHECK (attachment_spec_yn IN ('Y', 'N'))
);

CREATE INDEX idx_approval_equipment_stage ON approval_equipment_proposal(workflow_stage);
CREATE INDEX idx_approval_equipment_pe ON approval_equipment_proposal(pe_assignee_emp_id);
CREATE INDEX idx_approval_equipment_purchase ON approval_equipment_proposal(purchase_assignee_emp_id);

-- =========================================================
-- 10. LOG TABLES
-- =========================================================

CREATE TABLE audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NULL,
    action_type VARCHAR(50) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_id BIGINT NULL,
    before_json JSONB NULL,
    after_json JSONB NULL,
    ip_address VARCHAR(50) NULL,
    user_agent VARCHAR(500) NULL,
    reason TEXT NULL,
    success_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_audit_log_success_yn CHECK (success_yn IN ('Y', 'N')),
    CONSTRAINT fk_audit_log_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_audit_log_emp ON audit_log(emp_id);
CREATE INDEX idx_audit_log_target ON audit_log(target_table, target_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);


CREATE TABLE view_log (
    view_log_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id BIGINT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(50) NULL,
    user_agent VARCHAR(500) NULL,
    viewed_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_view_log_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_view_log_emp ON view_log(emp_id);
CREATE INDEX idx_view_log_target ON view_log(target_type, target_id);
CREATE INDEX idx_view_log_viewed_at ON view_log(viewed_at);


CREATE TABLE system_log (
    log_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NULL,
    action_type VARCHAR(50) NOT NULL,
    message TEXT NULL,
    ip_address VARCHAR(50) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_system_log_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_system_log_emp ON system_log(emp_id);
CREATE INDEX idx_system_log_action_type ON system_log(action_type);
CREATE INDEX idx_system_log_created_at ON system_log(created_at);


-- =========================================================
-- 11. BACKUP_LOG
-- =========================================================

CREATE TABLE backup_log (
    backup_id BIGSERIAL PRIMARY KEY,
    backup_type VARCHAR(50) NOT NULL,
    backup_path VARCHAR(500) NULL,
    status VARCHAR(30) NOT NULL,
    message TEXT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP NULL
);

CREATE INDEX idx_backup_log_type ON backup_log(backup_type);
CREATE INDEX idx_backup_log_started_at ON backup_log(started_at);


-- =========================================================
-- 12. Initial Data
-- =========================================================

INSERT INTO role (role_code, role_name, description)
VALUES
    ('ADMIN', '시스템 관리자', '전체 시스템 관리자'),
    ('MANAGER', '부서 관리자', '부서 단위 관리자'),
    ('USER', '일반 사용자', '일반 사용자')
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO common_code (code_group, code, code_name, sort_order)
VALUES
    ('EMP_STATUS', 'ACTIVE', '재직', 1),
    ('EMP_STATUS', 'LEAVE', '휴직', 2),
    ('EMP_STATUS', 'RETIRED', '퇴사', 3),
    ('USE_YN', 'Y', '사용', 1),
    ('USE_YN', 'N', '미사용', 2),
    ('DELETE_YN', 'N', '정상', 1),
    ('DELETE_YN', 'Y', '삭제', 2),
    ('POSITION', 'STAFF', '사원', 1),
    ('POSITION', 'SENIOR_STAFF', '주임', 2),
    ('POSITION', 'ASSISTANT_MANAGER', '대리', 3),
    ('POSITION', 'MANAGER', '과장', 4),
    ('POSITION', 'DEPUTY_GENERAL_MANAGER', '차장', 5),
    ('POSITION', 'GENERAL_MANAGER', '부장', 6)
ON CONFLICT (code_group, code) DO NOTHING;

INSERT INTO dept (dept_code, dept_name, parent_dept_id, sort_order)
VALUES
    ('SALES', '영업', NULL, 1),
    ('PROD', '생산', NULL, 2),
    ('RND', 'R&D', NULL, 3),
    ('HR_ADMIN', '인사총무', NULL, 4),
    ('ACCOUNTING', '회계', NULL, 5),
    ('QA', 'QA', NULL, 6),
    ('PURCHASE', '구매', NULL, 7),
    ('PROD_TECH', '생산기술', NULL, 8)
ON CONFLICT (dept_code) DO NOTHING;

INSERT INTO dept (dept_code, dept_name, parent_dept_id, sort_order)
VALUES
    ('IND_TRANSIT', '인더스트리/트랜짓', (SELECT dept_id FROM dept WHERE dept_code = 'SALES'), 1),
    ('MOBILITY_SALES', '모빌리티', (SELECT dept_id FROM dept WHERE dept_code = 'SALES'), 2),
    ('IND_BU127', '인더스트리(BU1,2,7)', (SELECT dept_id FROM dept WHERE dept_code = 'PROD'), 1),
    ('MOBILITY_BU520', '모빌리티(BU5,20)', (SELECT dept_id FROM dept WHERE dept_code = 'PROD'), 2),
    ('EC_TRANSIT_BU349', 'EC/트랜짓(BU3,4,9)', (SELECT dept_id FROM dept WHERE dept_code = 'PROD'), 3)
ON CONFLICT (dept_code) DO NOTHING;

INSERT INTO emp (
    emp_no,
    login_id,
    password_hash,
    emp_name,
    email,
    dept_id,
    position_name,
    job_title,
    role_code,
    status,
    login_fail_count,
    account_locked_yn,
    use_yn,
    password_changed_at
)
VALUES (
    'ADMIN-001',
    'admin',
    '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW',
    '시스템 관리자',
    'admin@schunk.local',
    (SELECT dept_id FROM dept WHERE dept_code = 'HR_ADMIN'),
    'ADMIN',
    'System Administrator',
    'ADMIN',
    'ACTIVE',
    0,
    'N',
    'Y',
    NOW()
)
ON CONFLICT (login_id) DO NOTHING;

INSERT INTO emp (
    emp_no,
    login_id,
    password_hash,
    emp_name,
    email,
    phone,
    dept_id,
    position_name,
    job_title,
    manager_emp_id,
    role_code,
    hire_date,
    status,
    login_fail_count,
    account_locked_yn,
    use_yn,
    password_changed_at
)
VALUES
    ('MGR-001', 'kim.manager', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '김민수', 'kim.manager@schunk.local', '010-1000-1001', (SELECT dept_id FROM dept WHERE dept_code = 'HR_ADMIN'), '부장', '경영지원팀장', (SELECT emp_id FROM emp WHERE login_id = 'admin'), 'MANAGER', DATE '2021-01-04', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('MGR-002', 'lee.sales', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '이서연', 'lee.sales@schunk.local', '010-1000-1002', (SELECT dept_id FROM dept WHERE dept_code = 'SALES'), '차장', '영업팀장', (SELECT emp_id FROM emp WHERE login_id = 'admin'), 'MANAGER', DATE '2020-03-02', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('MGR-003', 'park.prod', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '박준호', 'park.prod@schunk.local', '010-1000-1003', (SELECT dept_id FROM dept WHERE dept_code = 'PROD'), '차장', '생산팀장', (SELECT emp_id FROM emp WHERE login_id = 'admin'), 'MANAGER', DATE '2019-09-16', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('MGR-004', 'choi.qa', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '최유진', 'choi.qa@schunk.local', '010-1000-1004', (SELECT dept_id FROM dept WHERE dept_code = 'QA'), '과장', '품질팀장', (SELECT emp_id FROM emp WHERE login_id = 'admin'), 'MANAGER', DATE '2022-02-07', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-001', 'hong.gildong', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '홍길동', 'hong.gildong@schunk.local', '010-2000-1001', (SELECT dept_id FROM dept WHERE dept_code = 'HR_ADMIN'), '대리', '인사 담당', (SELECT emp_id FROM emp WHERE login_id = 'kim.manager'), 'USER', DATE '2023-01-09', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-002', 'jang.hana', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '장하나', 'jang.hana@schunk.local', '010-2000-1002', (SELECT dept_id FROM dept WHERE dept_code = 'ACCOUNTING'), '대리', '회계 담당', (SELECT emp_id FROM emp WHERE login_id = 'kim.manager'), 'USER', DATE '2023-05-15', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-003', 'yoon.sales1', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '윤지훈', 'yoon.sales1@schunk.local', '010-2000-1003', (SELECT dept_id FROM dept WHERE dept_code = 'IND_TRANSIT'), '과장', '인더스트리 영업', (SELECT emp_id FROM emp WHERE login_id = 'lee.sales'), 'USER', DATE '2021-11-01', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-004', 'seo.sales2', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '서민재', 'seo.sales2@schunk.local', '010-2000-1004', (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_SALES'), '대리', '모빌리티 영업', (SELECT emp_id FROM emp WHERE login_id = 'lee.sales'), 'USER', DATE '2022-08-22', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-005', 'kang.prod1', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '강도현', 'kang.prod1@schunk.local', '010-2000-1005', (SELECT dept_id FROM dept WHERE dept_code = 'IND_BU127'), '주임', 'BU1 생산', (SELECT emp_id FROM emp WHERE login_id = 'park.prod'), 'USER', DATE '2024-01-02', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-006', 'shin.prod2', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '신예린', 'shin.prod2@schunk.local', '010-2000-1006', (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520'), '사원', 'BU5 생산', (SELECT emp_id FROM emp WHERE login_id = 'park.prod'), 'USER', DATE '2024-04-01', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-007', 'oh.qa1', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '오세훈', 'oh.qa1@schunk.local', '010-2000-1007', (SELECT dept_id FROM dept WHERE dept_code = 'QA'), '대리', '수입검사', (SELECT emp_id FROM emp WHERE login_id = 'choi.qa'), 'USER', DATE '2022-12-05', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-008', 'moon.qa2', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '문소라', 'moon.qa2@schunk.local', '010-2000-1008', (SELECT dept_id FROM dept WHERE dept_code = 'QA'), '사원', '공정품질', (SELECT emp_id FROM emp WHERE login_id = 'choi.qa'), 'USER', DATE '2024-02-13', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-009', 'baek.rnd', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '백승우', 'baek.rnd@schunk.local', '010-2000-1009', (SELECT dept_id FROM dept WHERE dept_code = 'RND'), '과장', '소재개발', (SELECT emp_id FROM emp WHERE login_id = 'admin'), 'USER', DATE '2021-06-21', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-010', 'lim.purchase', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '임나영', 'lim.purchase@schunk.local', '010-2000-1010', (SELECT dept_id FROM dept WHERE dept_code = 'PURCHASE'), '대리', '구매 담당', (SELECT emp_id FROM emp WHERE login_id = 'kim.manager'), 'USER', DATE '2023-09-04', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('MGR-005', 'cho.pe', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '조태민', 'cho.pe@schunk.local', '010-1000-1005', (SELECT dept_id FROM dept WHERE dept_code = 'PROD_TECH'), '팀장', '생산기술팀장', (SELECT emp_id FROM emp WHERE login_id = 'admin'), 'MANAGER', DATE '2020-06-01', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-011', 'han.pe', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '한지수', 'han.pe@schunk.local', '010-2000-1011', (SELECT dept_id FROM dept WHERE dept_code = 'PROD_TECH'), '대리', '생산기술 담당', (SELECT emp_id FROM emp WHERE login_id = 'cho.pe'), 'USER', DATE '2022-10-04', 'ACTIVE', 0, 'N', 'Y', NOW())
ON CONFLICT (login_id) DO NOTHING;

INSERT INTO emp_role (emp_id, role_id, start_date, use_yn, created_by)
SELECT e.emp_id, r.role_id, CURRENT_DATE, 'Y', (SELECT emp_id FROM emp WHERE login_id = 'admin')
FROM emp e
JOIN role r ON r.role_code = e.role_code
WHERE e.login_id IN (
    'admin',
    'kim.manager',
    'lee.sales',
    'park.prod',
    'choi.qa',
    'hong.gildong',
    'jang.hana',
    'yoon.sales1',
    'seo.sales2',
    'kang.prod1',
    'shin.prod2',
    'oh.qa1',
    'moon.qa2',
    'baek.rnd',
    'lim.purchase',
    'cho.pe',
    'han.pe'
)
AND NOT EXISTS (
    SELECT 1 FROM emp_role er
    WHERE er.emp_id = e.emp_id
      AND er.role_id = r.role_id
      AND er.use_yn = 'Y'
);

INSERT INTO menu (menu_name, menu_path, parent_menu_id, sort_order)
VALUES
    ('대시보드', '/', NULL, 1),
    ('공지사항', '/notices', NULL, 2),
    ('게시판', '/boards', NULL, 3),
    ('조직도', '/organization', NULL, 4),
    ('알림', '/notifications', NULL, 5),
    ('감사 로그', '/admin/audit-logs', NULL, 99)
ON CONFLICT DO NOTHING;

INSERT INTO board (board_code, board_name, dept_id, use_yn, created_by)
VALUES
    ('GENERAL', '전사 게시판', NULL, 'Y', (SELECT emp_id FROM emp WHERE login_id = 'admin')),
    ('FREE', '자유 게시판', NULL, 'Y', (SELECT emp_id FROM emp WHERE login_id = 'admin'))
ON CONFLICT (board_code) DO NOTHING;

-- =========================================================
-- PDM / Drawing Management Phase 1
-- =========================================================

CREATE TABLE pdm_drawing (
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

CREATE TABLE pdm_drawing_revision (
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

ALTER TABLE pdm_drawing
    ADD CONSTRAINT fk_pdm_drawing_current_revision FOREIGN KEY (current_revision_id) REFERENCES pdm_drawing_revision(revision_id);

CREATE TABLE pdm_folder (
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

CREATE TABLE pdm_drawing_permission (
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

CREATE TABLE pdm_download_request (
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

CREATE TABLE pdm_download_log (
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

CREATE INDEX idx_pdm_drawing_category ON pdm_drawing(category);
CREATE INDEX idx_pdm_drawing_status ON pdm_drawing(status);
CREATE INDEX idx_pdm_folder_category ON pdm_folder(category);
CREATE INDEX idx_pdm_revision_drawing ON pdm_drawing_revision(drawing_id);
CREATE INDEX idx_pdm_permission_emp ON pdm_drawing_permission(emp_id);
CREATE INDEX idx_pdm_permission_dept ON pdm_drawing_permission(dept_id);
CREATE INDEX idx_pdm_download_requester ON pdm_download_request(requester_emp_id);
CREATE INDEX idx_pdm_download_approval ON pdm_download_request(approval_id);

CREATE TRIGGER trg_pdm_drawing_updated_at
BEFORE UPDATE ON pdm_drawing
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_pdm_revision_updated_at
BEFORE UPDATE ON pdm_drawing_revision
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_pdm_permission_updated_at
BEFORE UPDATE ON pdm_drawing_permission
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_pdm_folder_updated_at
BEFORE UPDATE ON pdm_folder
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_pdm_download_request_updated_at
BEFORE UPDATE ON pdm_download_request
FOR EACH ROW
EXECUTE FUNCTION fn_update_updated_at();

-- =========================================================
-- End of Schema
-- =========================================================
