-- Local development seed data for an existing PostgreSQL groupware database.
-- All sample accounts use the temporary password: admin1234

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
ON CONFLICT (login_id) DO UPDATE SET
    emp_name = EXCLUDED.emp_name,
    email = EXCLUDED.email,
    dept_id = EXCLUDED.dept_id,
    position_name = EXCLUDED.position_name,
    job_title = EXCLUDED.job_title,
    role_code = EXCLUDED.role_code,
    status = EXCLUDED.status,
    account_locked_yn = 'N',
    use_yn = 'Y';

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
ON CONFLICT (login_id) DO UPDATE SET
    emp_no = EXCLUDED.emp_no,
    password_hash = EXCLUDED.password_hash,
    emp_name = EXCLUDED.emp_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    dept_id = EXCLUDED.dept_id,
    position_name = EXCLUDED.position_name,
    job_title = EXCLUDED.job_title,
    manager_emp_id = EXCLUDED.manager_emp_id,
    role_code = EXCLUDED.role_code,
    hire_date = EXCLUDED.hire_date,
    status = EXCLUDED.status,
    login_fail_count = 0,
    account_locked_yn = 'N',
    use_yn = 'Y',
    password_changed_at = NOW();

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

INSERT INTO board (board_code, board_name, dept_id, use_yn, created_by)
VALUES
    ('GENERAL', '전사 게시판', NULL, 'Y', (SELECT emp_id FROM emp WHERE login_id = 'admin')),
    ('FREE', '자유 게시판', NULL, 'Y', (SELECT emp_id FROM emp WHERE login_id = 'admin'))
ON CONFLICT (board_code) DO NOTHING;
