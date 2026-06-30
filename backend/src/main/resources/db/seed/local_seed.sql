-- Local development seed data for an existing PostgreSQL groupware database.
-- All sample accounts use the temporary password: admin1234

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
VALUES
    ('DRAFT', '기안서', 1, '일반 안건, 공지, 업무 진행 요청',
     '[{"name":"documentNo","label":"문서 번호","type":"text"},{"name":"department","label":"기안 부서","type":"text"},{"name":"cooperation","label":"경유/협조","type":"text"},{"name":"purpose","label":"기안 목적","type":"textarea"},{"name":"details","label":"상세 내용","type":"textarea"},{"name":"expectedEffect","label":"기대 효과","type":"textarea"}]',
     '{"sections":["meta","fields","approvalLines","signatures"]}', 'Y', 10),
    ('CONSULT', '품의서', 1, '예산, 구매, 계약 등 의사결정 품의',
     '[{"name":"category","label":"품의 구분","type":"select","options":["예산","구매","계약","수리","기타"]},{"name":"amount","label":"예상 금액","type":"number"},{"name":"vendor","label":"거래처/대상","type":"text"},{"name":"reason","label":"품의 사유","type":"textarea"},{"name":"alternatives","label":"검토 내용","type":"textarea"},{"name":"schedule","label":"진행 일정","type":"text"}]',
     '{"sections":["meta","fields","approvalLines","signatures"]}', 'N', 90),
    ('LEAVE', '휴가계', 1, '연차, 반차, 교육, 병가 등 근태 신청',
     '[{"name":"leaveType","label":"휴가 구분","type":"select","options":["연차","오전 반차","오후 반차","교육","병가","경조","기타"]},{"name":"startDate","label":"시작일","type":"date"},{"name":"endDate","label":"종료일","type":"date"},{"name":"days","label":"사용 일수","type":"number"},{"name":"contact","label":"비상 연락처","type":"text"},{"name":"reason","label":"신청 사유","type":"textarea"},{"name":"handover","label":"업무 인수인계","type":"textarea"}]',
     '{"sections":["meta","fields","approvalLines","signatures"]}', 'Y', 30),
    ('PURCHASE', '구매요구서', 1, '구매 품목, 요구일, BU 비용분할을 작성하는 구매요구서',
     '[{"name":"requiredDate","label":"요구일","type":"date","required":true},{"name":"purchaseItemsJson","label":"품목 내역","type":"table","required":true},{"name":"buSplit","label":"BU 비용분할","type":"percent-split","required":true},{"name":"deliveryDate","label":"입고일","type":"date"}]',
     '{"layout":"purchase-request","sections":["meta","items","buSplit","approvalLines","attachments"]}', 'Y', 40),
    ('TRAINING_REQUEST', '교육신청서', 1, '사내외 교육 신청과 비용 승인',
     '[{"name":"trainingType","label":"교육 구분","type":"select","options":["사내","사외","법정","직무","기타"]},{"name":"trainingName","label":"교육명","type":"text"},{"name":"institution","label":"교육 기관","type":"text"},{"name":"startDate","label":"시작일","type":"date"},{"name":"endDate","label":"종료일","type":"date"},{"name":"cost","label":"교육비","type":"number"},{"name":"reason","label":"신청 사유/교육 목적","type":"textarea"},{"name":"expectedUse","label":"업무 활용 계획","type":"textarea"}]',
     '{"sections":["meta","fields","approvalLines","signatures"]}', 'Y', 50),
    ('TRAINING_REPORT', '교육 훈련보고서', 1, '교육 결과, 효과, 후속 계획 보고',
     '[{"name":"trainingName","label":"교육명","type":"text"},{"name":"institution","label":"교육 기관","type":"text"},{"name":"period","label":"교육 기간","type":"text"},{"name":"participants","label":"참석자","type":"text"},{"name":"summary","label":"주요 교육 내용","type":"textarea"},{"name":"jobImpact","label":"업무 수행 반영 사항","type":"textarea"},{"name":"takeaways","label":"교육 소감","type":"textarea"},{"name":"followUp","label":"후속 조치/전파 계획","type":"textarea"}]',
     '{"sections":["meta","fields","approvalLines","signatures"]}', 'Y', 60),
    ('EQUIPMENT_PROPOSAL', '설비 품의서', 1, '사용부서, 생산기술팀, 구매팀이 단계별로 작성하는 설비 품의서',
     '[{"name":"requestDeptName","label":"요청부서","type":"text","required":true},{"name":"equipmentName","label":"설비명","type":"text","required":true},{"name":"requiredCompletionDate","label":"완료요구일","type":"date","required":true},{"name":"equipmentCapacity","label":"설비용량(능력)","type":"text"},{"name":"requestType","label":"구분","type":"select","options":["구입","제작","개선","수리","매각","폐기"],"required":true},{"name":"currentState","label":"현상","type":"textarea","required":true},{"name":"requirements","label":"요구사항","type":"textarea","required":true},{"name":"instructions","label":"지시 사항","type":"textarea"},{"name":"userEconomicReview","label":"경제성 검토 - 사용부서","type":"textarea"}]',
     '{"layout":"equipment-proposal","sections":["user","pe","purchase","attachments"]}', 'Y', 20)
ON CONFLICT (template_code, version) DO NOTHING;

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
    ('EMP-010', 'lim.purchase', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '임나영', 'lim.purchase@schunk.local', '010-2000-1010', (SELECT dept_id FROM dept WHERE dept_code = 'PURCHASE'), '대리', '구매 담당', (SELECT emp_id FROM emp WHERE login_id = 'kim.manager'), 'USER', DATE '2023-09-04', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('MGR-005', 'cho.pe', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '조태민', 'cho.pe@schunk.local', '010-1000-1005', (SELECT dept_id FROM dept WHERE dept_code = 'PROD_TECH'), '팀장', '생산기술팀장', (SELECT emp_id FROM emp WHERE login_id = 'admin'), 'MANAGER', DATE '2020-06-01', 'ACTIVE', 0, 'N', 'Y', NOW()),
    ('EMP-011', 'han.pe', '$2a$10$STCx2vSXUihXSvJV5soudOLiyOR5FjIB4d7JkQlG6819nLIKK45vW', '한지수', 'han.pe@schunk.local', '010-2000-1011', (SELECT dept_id FROM dept WHERE dept_code = 'PROD_TECH'), '대리', '생산기술 담당', (SELECT emp_id FROM emp WHERE login_id = 'cho.pe'), 'USER', DATE '2022-10-04', 'ACTIVE', 0, 'N', 'Y', NOW())
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
