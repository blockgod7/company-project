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
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notification_read_yn CHECK (read_yn IN ('Y', 'N')),
    CONSTRAINT fk_notification_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id)
);

CREATE INDEX idx_notification_emp ON notification(emp_id);
CREATE INDEX idx_notification_read_yn ON notification(read_yn);
CREATE INDEX idx_notification_created_at ON notification(created_at);


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
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

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
    ('EMP-010', 'lim.purchase', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '임나영', 'lim.purchase@schunk.local', '010-2000-1010', (SELECT dept_id FROM dept WHERE dept_code = 'PURCHASE'), '대리', '구매 담당', (SELECT emp_id FROM emp WHERE login_id = 'kim.manager'), 'USER', DATE '2023-09-04', 'ACTIVE', 0, 'N', 'Y', NOW())
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
    'lim.purchase'
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
-- End of Schema
-- =========================================================
