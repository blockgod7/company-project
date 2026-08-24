-- 2026-08 직원 소속표 기준 부서 및 생산계열 상급자 정비

BEGIN;

INSERT INTO dept (dept_code, dept_name, parent_dept_id, sort_order)
SELECT code, name, parent_id, ordering
FROM (VALUES
    ('MOBILITY_SINTERING', '모빌리티 - 소성',
        (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520'), 3),
    ('ULSAN_SALES', '울산영업소',
        (SELECT dept_id FROM dept WHERE dept_code = 'SALES'), 3)
) AS d(code, name, parent_id, ordering)
WHERE parent_id IS NOT NULL
ON CONFLICT (dept_code) DO UPDATE
SET dept_name = EXCLUDED.dept_name,
    parent_dept_id = EXCLUDED.parent_dept_id,
    sort_order = EXCLUDED.sort_order,
    use_yn = 'Y',
    updated_at = NOW();

UPDATE dept
SET sort_order = 4,
    updated_at = NOW()
WHERE dept_code = 'MOBILITY_PRETREAT';

-- PDF 표기와 DB 이름이 다른 직원도 사번으로 식별한다.
-- C9035: PDF 강동수 / DB 조성진
-- E9096: PDF 최성락 / DB 최성진
-- E9024: PDF 장지혁 / DB 이정민
-- E9089: PDF 오혁진 / DB 최현준 (기존 소속과 같아 아래 이동 목록에는 없음)
-- E9037: PDF 김종현 / DB 김종현a
WITH affiliation_map(emp_no, dept_code) AS (
    VALUES
        ('D8011', 'MOBILITY_BU520'),
        ('E9048', 'MOBILITY_BU520'),

        ('D5028', 'MOBILITY_PRETREAT'),
        ('D3014', 'MOBILITY_PRETREAT'),
        ('E6004', 'MOBILITY_PRETREAT'),
        ('E6012', 'MOBILITY_PRETREAT'),
        ('E6034', 'MOBILITY_PRETREAT'),
        ('E9047', 'MOBILITY_PRETREAT'),
        ('E9073', 'MOBILITY_PRETREAT'),
        ('E9076', 'MOBILITY_PRETREAT'),
        ('E9072', 'MOBILITY_PRETREAT'),

        ('C7011', 'MOBILITY_PROCESSING'),
        ('D5029', 'MOBILITY_PROCESSING'),
        ('E0056', 'MOBILITY_PROCESSING'),
        ('C7008', 'MOBILITY_PROCESSING'),
        ('D5039', 'MOBILITY_PROCESSING'),
        ('E9044', 'MOBILITY_PROCESSING'),
        ('E9059', 'MOBILITY_PROCESSING'),
        ('E0058', 'MOBILITY_PROCESSING'),
        ('E5049', 'MOBILITY_PROCESSING'),
        ('E2009', 'MOBILITY_PROCESSING'),
        ('E3015', 'MOBILITY_PROCESSING'),
        ('E1005', 'MOBILITY_PROCESSING'),
        ('E0025', 'MOBILITY_PROCESSING'),
        ('E5035', 'MOBILITY_PROCESSING'),
        ('D7021', 'MOBILITY_PROCESSING'),
        ('E5033', 'MOBILITY_PROCESSING'),
        ('E9010', 'MOBILITY_PROCESSING'),
        ('E9022', 'MOBILITY_PROCESSING'),
        ('E9092', 'MOBILITY_PROCESSING'),
        ('C9035', 'MOBILITY_PROCESSING'),

        ('D2008', 'MOBILITY_SINTERING'),
        ('E2031', 'MOBILITY_SINTERING'),

        ('C9017', 'MOBILITY_FORMING'),
        ('D2024', 'MOBILITY_FORMING'),
        ('E3020', 'MOBILITY_FORMING'),
        ('D7020', 'MOBILITY_FORMING'),
        ('D7013', 'MOBILITY_FORMING'),
        ('E4036', 'MOBILITY_FORMING'),
        ('D7002', 'MOBILITY_FORMING'),
        ('D7014', 'MOBILITY_FORMING'),
        ('E1028', 'MOBILITY_FORMING'),
        ('E5037', 'MOBILITY_FORMING'),
        ('E0051', 'MOBILITY_FORMING'),
        ('E2029', 'MOBILITY_FORMING'),
        ('E1029', 'MOBILITY_FORMING'),
        ('E5020', 'MOBILITY_FORMING'),
        ('E2030', 'MOBILITY_FORMING'),
        ('E2014', 'MOBILITY_FORMING'),
        ('E9064', 'MOBILITY_FORMING'),
        ('E9096', 'MOBILITY_FORMING'),

        ('D0018', 'ULSAN_SALES'),
        ('E9003', 'ULSAN_SALES'),
        ('D9004', 'ULSAN_SALES'),
        ('D7006', 'ULSAN_SALES'),
        ('E5003', 'ULSAN_SALES'),

        ('D2014', 'VCB_CHEONGJU'),
        ('E9093', 'VCB_CHEONGJU'),
        ('E9094', 'VCB_CHEONGJU'),
        ('E9095', 'VCB_CHEONGJU'),
        ('E9099', 'VCB_CHEONGJU'),
        ('E9024', 'VCB_CHEONGJU')
)
UPDATE emp employee
SET dept_id = department.dept_id,
    updated_at = NOW()
FROM affiliation_map mapping
JOIN dept department ON department.dept_code = mapping.dept_code
WHERE employee.emp_no = mapping.emp_no
  AND employee.dept_id IS DISTINCT FROM department.dept_id;

-- 각 생산계열 책임자는 생산 총괄에게, 그 외 구성원은 지정 책임자에게 연결한다.
WITH leader_map(leader_emp_no, manager_emp_no) AS (
    VALUES
        ('D8011', 'C0002'),
        ('C3008', 'C0002'),
        ('E0055', 'C0002'),
        ('D2014', 'C0002')
)
UPDATE emp leader
SET manager_emp_id = manager.emp_id,
    updated_at = NOW()
FROM leader_map mapping
JOIN emp manager ON manager.emp_no = mapping.manager_emp_no
WHERE leader.emp_no = mapping.leader_emp_no
  AND leader.manager_emp_id IS DISTINCT FROM manager.emp_id;

WITH family_manager(leader_emp_no, dept_code) AS (
    VALUES
        ('D8011', 'MOBILITY_BU520'),
        ('D8011', 'MOBILITY_PROCESSING'),
        ('D8011', 'MOBILITY_FORMING'),
        ('D8011', 'MOBILITY_SINTERING'),
        ('D8011', 'MOBILITY_PRETREAT'),
        ('C3008', 'IND_BU127'),
        ('C3008', 'INDUSTRY_PROCESSING'),
        ('E0055', 'EC_TRANSIT_BU349'),
        ('E0055', 'EC_TRANSIT_MATERIAL'),
        ('E0055', 'EC_TRANSIT_PROCESSING'),
        ('E0055', 'EC_TRANSIT_TRANSIT'),
        ('D2014', 'VCB_CHEONGJU')
)
UPDATE emp employee
SET manager_emp_id = leader.emp_id,
    updated_at = NOW()
FROM family_manager mapping
JOIN dept department ON department.dept_code = mapping.dept_code
JOIN emp leader ON leader.emp_no = mapping.leader_emp_no
WHERE employee.dept_id = department.dept_id
  AND employee.emp_id <> leader.emp_id
  AND employee.manager_emp_id IS DISTINCT FROM leader.emp_id;

-- 연구소 팀장은 정은영 과장이며, 연구소 구성원은 모두 정은영 과장에게 연결한다.
UPDATE emp employee
SET manager_emp_id = leader.emp_id,
    updated_at = NOW()
FROM dept department
JOIN emp leader ON leader.emp_no = 'E3048'
WHERE department.dept_code = 'RND'
  AND employee.dept_id = department.dept_id
  AND employee.emp_id <> leader.emp_id
  AND employee.manager_emp_id IS DISTINCT FROM leader.emp_id;

COMMIT;
