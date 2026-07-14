CREATE TABLE IF NOT EXISTS equipment (
    equipment_id BIGSERIAL PRIMARY KEY,
    equipment_no VARCHAR(50) NOT NULL UNIQUE,
    equipment_name VARCHAR(200) NOT NULL,
    location VARCHAR(200) NULL,
    owner_dept_id BIGINT NULL REFERENCES dept(dept_id),
    maintenance_dept_id BIGINT NULL REFERENCES dept(dept_id),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL, updated_by BIGINT NULL REFERENCES emp(emp_id)
);

CREATE TABLE IF NOT EXISTS equipment_report (
    report_id BIGSERIAL PRIMARY KEY,
    equipment_id BIGINT NOT NULL REFERENCES equipment(equipment_id),
    reporter_emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    assignee_emp_id BIGINT NULL REFERENCES emp(emp_id),
    assigned_by_emp_id BIGINT NULL REFERENCES emp(emp_id),
    title VARCHAR(200) NOT NULL, symptom TEXT NOT NULL, request_content TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL', occurred_on DATE NULL,
    planned_start_on DATE NULL, planned_end_on DATE NULL, assignment_instruction TEXT NULL,
    work_result TEXT NULL, cause_analysis TEXT NULL, action_taken TEXT NULL,
    state VARCHAR(40) NOT NULL, initial_approval_id BIGINT NULL REFERENCES approval_document(approval_id),
    completion_approval_id BIGINT NULL REFERENCES approval_document(approval_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL, updated_by BIGINT NULL REFERENCES emp(emp_id)
);

CREATE TABLE IF NOT EXISTS equipment_history_event (
    event_id BIGSERIAL PRIMARY KEY, equipment_id BIGINT NOT NULL REFERENCES equipment(equipment_id),
    report_id BIGINT NOT NULL REFERENCES equipment_report(report_id), actor_emp_id BIGINT NULL REFERENCES emp(emp_id),
    event_type VARCHAR(50) NOT NULL, message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL, updated_by BIGINT NULL REFERENCES emp(emp_id)
);

CREATE INDEX IF NOT EXISTS idx_equipment_report_equipment ON equipment_report(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_report_state ON equipment_report(state);
CREATE INDEX IF NOT EXISTS idx_equipment_history_equipment ON equipment_history_event(equipment_id, event_id DESC);

INSERT INTO approval_template (created_at, template_code, template_name, version, description, fields_json, print_layout_json, active_yn, sort_order)
SELECT NOW(), 'EQUIPMENT_ABNORMAL_REPORT', '설비 이상보고서', 1, '설비 이상 발생과 부서장 결재를 위한 보고서',
 '[{"name":"equipmentNo","label":"설비번호","type":"text","required":true},{"name":"equipmentName","label":"설비명","type":"text","required":true},{"name":"symptom","label":"이상 증상","type":"textarea","required":true},{"name":"occurredOn","label":"발생일","type":"date","required":true}]',
 '{"sections":["meta","fields","approvalLines","signatures"]}', 'Y', 95
WHERE NOT EXISTS (SELECT 1 FROM approval_template WHERE template_code = 'EQUIPMENT_ABNORMAL_REPORT' AND version = 1);

INSERT INTO approval_template (created_at, template_code, template_name, version, description, fields_json, print_layout_json, active_yn, sort_order)
SELECT NOW(), 'EQUIPMENT_WORK_COMPLETION', '설비 작업완료 보고서', 1, '보전 담당자의 조치결과와 생산기술팀장 완료 결재를 위한 보고서',
 '[{"name":"equipmentNo","label":"설비번호","type":"text","required":true},{"name":"workResult","label":"작업 결과","type":"textarea","required":true},{"name":"actionTaken","label":"조치 내용","type":"textarea","required":true}]',
 '{"sections":["meta","fields","approvalLines","signatures"]}', 'Y', 96
WHERE NOT EXISTS (SELECT 1 FROM approval_template WHERE template_code = 'EQUIPMENT_WORK_COMPLETION' AND version = 1);
