-- Education workflow v1. Existing documents and their template snapshots are untouched.
BEGIN;
LOCK TABLE approval_template IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO approval_template (template_code, template_name, version, description, fields_json, print_layout_json, active_yn, sort_order, created_at, updated_at)
SELECT incoming.* FROM (VALUES
('TRAINING_REQUEST', '교육신청서', 2, '교육 신청 및 개인 캘린더 연동',
 '[{"name":"trainingName","label":"교육명","type":"text","required":true},{"name":"institution","label":"교육기관","type":"text","required":true},{"name":"trainingStartDate","label":"교육 시작일","type":"date","required":true},{"name":"trainingEndDate","label":"교육 종료일","type":"date","required":true},{"name":"reason","label":"신청 사유","type":"textarea","required":true}]',
 '{"layout":"training-request","educationWorkflowVersion":1}', 'Y', 50, NOW(), NOW()),
('TRAINING_CHANGE', '교육 변경·취소 신청서', 1, '최종 승인된 교육 변경 또는 취소 신청',
 '[{"name":"sourceTrainingApprovalId","label":"원 교육신청서","type":"text","required":true},{"name":"changeAction","label":"처리 구분","type":"select","options":["CHANGE","CANCEL"],"required":true},{"name":"changeReason","label":"변경·취소 사유","type":"textarea","required":true}]',
 '{"educationWorkflowVersion":1}', 'Y', 51, NOW(), NOW()),
('TRAINING_REPORT', '교육훈련보고서', 2, '교육 종료 후 보고 및 수신자 접수 완료',
 '[{"name":"sourceTrainingApprovalId","label":"원 교육신청서","type":"text","required":true},{"name":"mainContent","label":"주요 교육 내용","type":"textarea","required":true}]',
 '{"layout":"training-report","educationWorkflowVersion":1}', 'Y', 52, NOW(), NOW())
) AS incoming(template_code, template_name, version, description, fields_json, print_layout_json, active_yn, sort_order, created_at, updated_at)
WHERE NOT EXISTS (SELECT 1 FROM approval_template existing WHERE existing.template_code = incoming.template_code AND existing.version = incoming.version);
UPDATE approval_template SET active_yn = 'N', updated_at = NOW()
WHERE template_code IN ('TRAINING_REQUEST', 'TRAINING_REPORT') AND version < 2 AND active_yn = 'Y';
COMMIT;
