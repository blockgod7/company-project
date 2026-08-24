-- 2026-08 confirmed leave-policy and delegated authority model.
-- Additive/idempotent: approval and ledger history is preserved.

ALTER TABLE emp ADD COLUMN IF NOT EXISTS work_category VARCHAR(20) NOT NULL DEFAULT 'FIELD';
ALTER TABLE emp DROP CONSTRAINT IF EXISTS chk_emp_work_category;
ALTER TABLE emp ADD CONSTRAINT chk_emp_work_category CHECK (work_category IN ('MANAGEMENT', 'FIELD'));

ALTER TABLE emp_permission DROP CONSTRAINT IF EXISTS chk_emp_permission_code;
ALTER TABLE emp_permission ADD CONSTRAINT chk_emp_permission_code CHECK (
    permission_code IN (
        'FULL_ADMIN', 'LEAVE_ADMIN', 'LEAVE_POLICY_ADMIN',
        'EMPLOYEE_ADMIN', 'WORK_CATEGORY_ADMIN', 'ACCOUNT_ADMIN',
        'WORK_REQUEST_ADMIN', 'WORK_REQUEST_DELEGATE'
    )
);

-- 임정식 부장은 초기 전권 관리자다. 전권은 시스템관리자 또는 다른 전권 관리자가 추가 부여할 수 있다.
INSERT INTO emp_permission (emp_id, permission_code, active_yn, reason)
SELECT emp_id, 'FULL_ADMIN', 'Y', '초기 전권 관리자 지정'
FROM emp
WHERE (login_id = 'e0015' OR emp_name = '임정식')
  AND status = 'ACTIVE' AND account_status = 'ACTIVE' AND use_yn = 'Y'
ON CONFLICT (emp_id, permission_code) DO NOTHING;

-- 허인성 대리는 직군관리 권한만 기본 부여한다. 그 밖의 권한은 전권 관리자가 개별 부여한다.
INSERT INTO emp_permission (emp_id, permission_code, active_yn, reason)
SELECT emp_id, 'WORK_CATEGORY_ADMIN', 'Y', '직군관리 개별 권한'
FROM emp
WHERE (login_id = 'e7016' OR emp_name = '허인성')
  AND status = 'ACTIVE' AND account_status = 'ACTIVE' AND use_yn = 'Y'
ON CONFLICT (emp_id, permission_code) DO NOTHING;

UPDATE emp_permission permission
SET active_yn = 'N', revoked_at = NOW(), reason = '기존 자동 기본 권한 해제 후 개별 부여 방식 전환'
FROM emp
WHERE permission.emp_id = emp.emp_id
  AND (emp.login_id = 'e7016' OR emp.emp_name = '허인성')
  AND permission.permission_code IN ('LEAVE_ADMIN', 'EMPLOYEE_ADMIN')
  AND permission.reason = '기본 권한자';

-- Removed request types remain in history but cannot be selected for a new request.
UPDATE leave_policy
SET active_yn = 'N', change_reason = '운영 제외 휴가 유형', updated_at = NOW()
WHERE leave_type IN ('자녀돌봄휴가', '특별유급휴가', '가족돌봄휴가')
  AND active_yn <> 'N';

-- Evidence is mandatory; the service validates attachment presence only.
UPDATE leave_policy
SET evidence_required_yn = 'Y', change_reason = '필수 증빙 첨부 확인', updated_at = NOW()
WHERE leave_type IN ('병가', '난임치료휴가')
  AND evidence_required_yn <> 'Y';

INSERT INTO leave_policy (
    leave_type, display_name, active_yn, pay_type, annual_deduction_days, unit_type,
    max_days, period_before_days, period_after_days, gender_restriction,
    evidence_required_yn, max_segments, admin_override_allowed_yn,
    effective_from, change_reason
) VALUES
    ('조퇴', '조퇴', 'Y', 'SEPARATE', 0.0, 'BOTH', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', DATE '2026-01-01', '관리직 유급·현장직 무급, 시작시간 필수'),
    ('공상', '공상 휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', DATE '2026-01-01', '유급·연차 미차감, 사유 필수')
ON CONFLICT (leave_type, effective_from) DO UPDATE
SET display_name = EXCLUDED.display_name,
    active_yn = EXCLUDED.active_yn,
    pay_type = EXCLUDED.pay_type,
    annual_deduction_days = EXCLUDED.annual_deduction_days,
    unit_type = EXCLUDED.unit_type,
    admin_override_allowed_yn = EXCLUDED.admin_override_allowed_yn,
    change_reason = EXCLUDED.change_reason,
    updated_at = NOW();

-- Existing compensatory-time credits become usable through the occurrence-year end.
UPDATE comp_time_credit
SET expires_on = make_date(EXTRACT(YEAR FROM work_date)::int, 12, 31),
    expiration_notified_at = NULL,
    updated_at = NOW()
WHERE expires_on <> make_date(EXTRACT(YEAR FROM work_date)::int, 12, 31);

-- Childbirth is handled by dedicated leave types, not bereavement leave.
UPDATE bereavement_policy
SET active_yn = 'N', change_reason = '출산 전용 휴가로 분리', updated_at = NOW()
WHERE event_type = 'BIRTH' AND active_yn = 'Y';

-- Company-paid weekday bereavement defaults. Rows remain editable in the admin screen.
INSERT INTO bereavement_policy (
    event_type, family_relation, allowed_days, pay_type, evidence_required_yn,
    effective_from, effective_to, active_yn, change_reason, last_changed_by
)
SELECT defaults.event_type, defaults.family_relation, defaults.allowed_days, 'PAID', 'N',
       DATE '2026-01-01', NULL, 'Y', '2026-08 확정 경조휴가 기본 기준', NULL
FROM (VALUES
    ('MARRIAGE', 'SELF', 5.0::numeric),
    ('MARRIAGE', 'CHILD', 1.0::numeric),
    ('DEATH', 'SPOUSE', 5.0::numeric),
    ('DEATH', 'PARENT', 5.0::numeric),
    ('DEATH', 'SPOUSE_PARENT', 5.0::numeric),
    ('DEATH', 'CHILD', 5.0::numeric),
    ('DEATH', 'GRANDPARENT', 2.0::numeric),
    ('DEATH', 'SIBLING', 2.0::numeric)
) AS defaults(event_type, family_relation, allowed_days)
ON CONFLICT (event_type, family_relation, effective_from) DO UPDATE
SET allowed_days = EXCLUDED.allowed_days,
    pay_type = 'PAID',
    active_yn = 'Y',
    change_reason = EXCLUDED.change_reason,
    updated_at = NOW()
WHERE bereavement_policy.last_changed_by IS NULL
   OR bereavement_policy.change_reason IN ('사내 사망 경조휴가 기본 기준', '2026-08 확정 경조휴가 기본 기준');
