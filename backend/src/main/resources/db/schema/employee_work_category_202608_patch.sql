-- 직급이 명확한 직원의 직군을 일괄 보정한다.
-- 사원 및 규칙에 없는 직급은 관리직/현장직이 혼재할 수 있으므로 기존 선택을 유지한다.

UPDATE emp
SET work_category = 'MANAGEMENT',
    updated_at = CURRENT_TIMESTAMP
WHERE (
    trim(position_name) IN ('기원', '기장', '대리', '과장', '차장', '부장')
    OR trim(position_name) LIKE '%이사'
)
  AND work_category <> 'MANAGEMENT';

UPDATE emp
SET work_category = 'FIELD',
    updated_at = CURRENT_TIMESTAMP
WHERE trim(position_name) IN ('조장', '반장')
  AND work_category <> 'FIELD';
