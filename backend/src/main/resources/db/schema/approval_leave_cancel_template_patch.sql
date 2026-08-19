-- Persists the leave-cancellation template that the frontend previously
-- supplied as a fallback when the backend template list did not contain it.

UPDATE approval_template
SET template_name = '휴가 취소계',
    description = '승인 완료된 휴가 취소 신청',
    fields_json = '[{"name":"startDate","label":"취소 시작일","type":"date","required":false,"systemManaged":true},{"name":"endDate","label":"취소 종료일","type":"date","required":false,"systemManaged":true},{"name":"days","label":"취소 일수","type":"number","required":false,"systemManaged":true},{"name":"annualLeaveDays","label":"복원 연차일수","type":"number","required":false,"systemManaged":true},{"name":"leaveType","label":"취소 구분","type":"text","required":false,"systemManaged":true},{"name":"leaveSelectionsJson","label":"원본 휴가별 취소 항목","type":"json","required":true}]',
    print_layout_json = NULL,
    active_yn = 'Y',
    sort_order = 999,
    updated_at = NOW()
WHERE template_code = 'LEAVE_CANCEL'
  AND version = 1;

INSERT INTO approval_template (
    template_code,
    template_name,
    version,
    description,
    fields_json,
    print_layout_json,
    active_yn,
    sort_order,
    created_at,
    updated_at
)
SELECT
    'LEAVE_CANCEL',
    '휴가 취소계',
    1,
    '승인 완료된 휴가 취소 신청',
    '[{"name":"startDate","label":"취소 시작일","type":"date","required":false,"systemManaged":true},{"name":"endDate","label":"취소 종료일","type":"date","required":false,"systemManaged":true},{"name":"days","label":"취소 일수","type":"number","required":false,"systemManaged":true},{"name":"annualLeaveDays","label":"복원 연차일수","type":"number","required":false,"systemManaged":true},{"name":"leaveType","label":"취소 구분","type":"text","required":false,"systemManaged":true},{"name":"leaveSelectionsJson","label":"원본 휴가별 취소 항목","type":"json","required":true}]',
    NULL,
    'Y',
    999,
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM approval_template
    WHERE template_code = 'LEAVE_CANCEL'
      AND version = 1
);
