-- Persists the leave-cancellation template that the frontend previously
-- supplied as a fallback when the backend template list did not contain it.

UPDATE approval_template
SET template_name = '휴가 취소계',
    description = '승인 완료된 휴가 취소 신청',
    fields_json = '[]',
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
    '[]',
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
