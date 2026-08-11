-- 휴가 신청·취소 문서의 기본 수신자를 운영 설정으로 관리한다.
-- 로컬 기본값은 기존 업무 담당자 계정(e7016)이며, 관리 화면에서 변경할 수 있다.
INSERT INTO approval_operation_setting (setting_key, setting_value, description)
SELECT
    'LEAVE_DEFAULT_RECEIVER_EMP_ID',
    emp.emp_id::text,
    '휴가 신청·취소 문서 기본 수신자 사번'
FROM emp
WHERE emp.login_id = 'e7016'
  AND emp.use_yn = 'Y'
  AND emp.status = 'ACTIVE'
  AND emp.account_status = 'ACTIVE'
ON CONFLICT (setting_key) DO NOTHING;
