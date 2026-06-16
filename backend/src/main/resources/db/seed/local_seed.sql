-- Local development seed data for an existing PostgreSQL groupware database.

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

INSERT INTO board (board_code, board_name, dept_id, use_yn, created_by)
VALUES
    ('GENERAL', '전사 게시판', NULL, 'Y', (SELECT emp_id FROM emp WHERE login_id = 'admin')),
    ('FREE', '자유 게시판', NULL, 'Y', (SELECT emp_id FROM emp WHERE login_id = 'admin'))
ON CONFLICT (board_code) DO NOTHING;
