-- 통합 근무신청서, 변경·취소계, 생산 조직/교대 속성

ALTER TABLE emp ADD COLUMN IF NOT EXISTS shift_type VARCHAR(20) NULL;
ALTER TABLE emp ADD COLUMN IF NOT EXISTS shift_anchor_date DATE NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_emp_shift_type') THEN
        ALTER TABLE emp ADD CONSTRAINT chk_emp_shift_type
            CHECK (shift_type IS NULL OR shift_type IN ('A', 'B', 'DAY_FIXED'));
    END IF;
END $$;

UPDATE dept SET dept_name = '모빌리티', sort_order = 1, updated_at = NOW()
WHERE dept_code = 'MOBILITY_BU520';
UPDATE dept SET dept_name = '인더스트릿', sort_order = 2, updated_at = NOW()
WHERE dept_code = 'IND_BU127';
UPDATE dept SET dept_name = 'EC/트랜짓', sort_order = 3, updated_at = NOW()
WHERE dept_code = 'EC_TRANSIT_BU349';
UPDATE dept SET dept_name = '영업 - 모빌리티', sort_order = 2, updated_at = NOW()
WHERE dept_code = 'MOBILITY_SALES';
UPDATE dept SET dept_name = '영업 - 인더스트릿/트랜짓', sort_order = 1, updated_at = NOW()
WHERE dept_code = 'IND_TRANSIT';

INSERT INTO dept (dept_code, dept_name, parent_dept_id, sort_order)
SELECT code, name, parent_id, ordering
FROM (VALUES
    ('MOBILITY_PROCESSING', '모빌리티 - 가공', (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520'), 1),
    ('MOBILITY_FORMING', '모빌리티 - 성형', (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520'), 2),
    ('MOBILITY_PRETREAT', '모빌리티 - 전처리', (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520'), 3),
    ('INDUSTRY_PROCESSING', '인더스트릿 - 가공', (SELECT dept_id FROM dept WHERE dept_code = 'IND_BU127'), 1),
    ('EC_TRANSIT_MATERIAL', 'EC/트랜짓 - 소재', (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_BU349'), 1),
    ('EC_TRANSIT_PROCESSING', 'EC/트랜짓 - 가공', (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_BU349'), 2),
    ('EC_TRANSIT_TRANSIT', 'EC/트랜짓 - 트랜짓', (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_BU349'), 3),
    ('VCB_CHEONGJU', 'VCB(청주)', (SELECT dept_id FROM dept WHERE dept_code = 'PROD'), 4)
) AS d(code, name, parent_id, ordering)
WHERE parent_id IS NOT NULL
ON CONFLICT (dept_code) DO UPDATE
SET dept_name = EXCLUDED.dept_name,
    parent_dept_id = EXCLUDED.parent_dept_id,
    sort_order = EXCLUDED.sort_order,
    use_yn = 'Y',
    updated_at = NOW();

-- 기존 조직도에서 공정이 명확한 인원만 하위 공정으로 이동한다.
UPDATE emp SET dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_PROCESSING'), updated_at = NOW()
WHERE emp_name IN ('박진수', '최용석', '김휘범')
  AND dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520');
UPDATE emp SET dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_FORMING'), updated_at = NOW()
WHERE emp_name = '배규권'
  AND dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520');
UPDATE emp SET dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_PRETREAT'), updated_at = NOW()
WHERE emp_name = '신지호'
  AND dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'MOBILITY_BU520');
UPDATE emp SET dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'INDUSTRY_PROCESSING'), updated_at = NOW()
WHERE work_category = 'FIELD'
  AND dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'IND_BU127');
UPDATE emp SET dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_PROCESSING'), updated_at = NOW()
WHERE emp_name IN ('장재훈', '박용준')
  AND dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_BU349');
UPDATE emp SET dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_TRANSIT'), updated_at = NOW()
WHERE emp_name = '오영훈'
  AND dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_BU349');
UPDATE emp SET dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'VCB_CHEONGJU'), updated_at = NOW()
WHERE emp_name = '김진학'
  AND dept_id = (SELECT dept_id FROM dept WHERE dept_code = 'EC_TRANSIT_BU349');

CREATE TABLE IF NOT EXISTS work_request_entry (
    work_entry_id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL REFERENCES approval_document(approval_id),
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    requester_emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    dept_id BIGINT NULL REFERENCES dept(dept_id),
    emp_name_snapshot VARCHAR(100) NOT NULL,
    dept_name_snapshot VARCHAR(100) NULL,
    work_category_snapshot VARCHAR(20) NOT NULL,
    shift_type_snapshot VARCHAR(20) NULL,
    shift_anchor_date_snapshot DATE NULL,
    work_type VARCHAR(20) NOT NULL,
    work_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    work_minutes INT NOT NULL,
    work_content VARCHAR(1000) NOT NULL,
    comp_time_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    canceled_by_approval_id BIGINT NULL REFERENCES approval_document(approval_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_work_entry_type CHECK (work_type IN ('OVERTIME', 'SPECIAL', 'EMERGENCY_CALL')),
    CONSTRAINT chk_work_entry_comp CHECK (comp_time_yn IN ('Y', 'N')),
    CONSTRAINT chk_work_entry_status CHECK (status IN ('PENDING', 'PLANNED', 'COMPLETED', 'CANCEL_PENDING', 'CANCELED')),
    CONSTRAINT chk_work_entry_minutes CHECK (work_minutes > 0 AND work_minutes <= 1440),
    CONSTRAINT uk_work_entry_approval_emp_date_time UNIQUE (approval_id, emp_id, work_date, start_time, end_time)
);

CREATE INDEX IF NOT EXISTS idx_work_entry_emp_calendar
    ON work_request_entry(emp_id, work_date, status);
CREATE INDEX IF NOT EXISTS idx_work_entry_approval ON work_request_entry(approval_id);

CREATE TABLE IF NOT EXISTS work_request_change (
    work_change_id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL REFERENCES approval_document(approval_id),
    source_work_entry_id BIGINT NOT NULL REFERENCES work_request_entry(work_entry_id),
    action_type VARCHAR(20) NOT NULL,
    new_work_date DATE NULL,
    new_start_time TIME NULL,
    new_end_time TIME NULL,
    new_work_content VARCHAR(1000) NULL,
    new_comp_time_yn VARCHAR(1) NULL,
    reason VARCHAR(1000) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_work_change_action CHECK (action_type IN ('CANCEL', 'CHANGE')),
    CONSTRAINT chk_work_change_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
    CONSTRAINT chk_work_change_comp CHECK (new_comp_time_yn IS NULL OR new_comp_time_yn IN ('Y', 'N')),
    CONSTRAINT uk_work_change_document_source UNIQUE (approval_id, source_work_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_work_change_source ON work_request_change(source_work_entry_id, status);

ALTER TABLE comp_time_credit ADD COLUMN IF NOT EXISTS source_work_entry_id BIGINT NULL;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comp_time_credit_work_entry') THEN
        ALTER TABLE comp_time_credit ADD CONSTRAINT fk_comp_time_credit_work_entry
            FOREIGN KEY (source_work_entry_id) REFERENCES work_request_entry(work_entry_id);
    END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uk_comp_time_credit_source_work_entry
    ON comp_time_credit(source_work_entry_id) WHERE source_work_entry_id IS NOT NULL;

UPDATE comp_time_credit
SET expires_on = make_date(EXTRACT(YEAR FROM work_date)::int + 1, 1, 31),
    expiration_notified_at = NULL,
    updated_at = NOW()
WHERE EXTRACT(MONTH FROM work_date) = 12
  AND EXTRACT(DAY FROM work_date) >= 15
  AND expires_on <> make_date(EXTRACT(YEAR FROM work_date)::int + 1, 1, 31);

UPDATE approval_template SET template_name = '근무신청서', description = '잔업·특근 근무 신청',
    fields_json = '[{"name":"workEntriesJson","label":"근무 신청 내역","type":"json","required":true,"systemManaged":true}]',
    active_yn = 'Y', sort_order = 40, updated_at = NOW()
WHERE template_code = 'WORK_REQUEST' AND version = 1;

UPDATE approval_template SET template_name = '비상호출 신청서', description = '비상호출 근무 신청',
    fields_json = '[{"name":"workEntriesJson","label":"비상호출 신청 내역","type":"json","required":true,"systemManaged":true}]',
    active_yn = 'Y', sort_order = 41, updated_at = NOW()
WHERE template_code = 'EMERGENCY_CALL_REQUEST' AND version = 1;

UPDATE approval_template SET template_name = '근무 변경·취소계', description = '승인 완료된 근무신청의 변경 또는 취소 신청',
    fields_json = '[{"name":"workChangesJson","label":"변경·취소 내역","type":"json","required":true,"systemManaged":true}]',
    active_yn = 'Y', sort_order = 42, updated_at = NOW()
WHERE template_code = 'WORK_REQUEST_CHANGE' AND version = 1;

INSERT INTO approval_template (template_code, template_name, version, description, fields_json,
    print_layout_json, active_yn, sort_order, created_at, updated_at)
SELECT 'WORK_REQUEST', '근무신청서', 1, '잔업·특근 근무 신청',
    '[{"name":"workEntriesJson","label":"근무 신청 내역","type":"json","required":true,"systemManaged":true}]',
    NULL, 'Y', 40, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM approval_template WHERE template_code = 'WORK_REQUEST' AND version = 1);

INSERT INTO approval_template (template_code, template_name, version, description, fields_json,
    print_layout_json, active_yn, sort_order, created_at, updated_at)
SELECT 'EMERGENCY_CALL_REQUEST', '비상호출 신청서', 1, '비상호출 근무 신청',
    '[{"name":"workEntriesJson","label":"비상호출 신청 내역","type":"json","required":true,"systemManaged":true}]',
    NULL, 'Y', 41, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM approval_template WHERE template_code = 'EMERGENCY_CALL_REQUEST' AND version = 1);

INSERT INTO approval_template (template_code, template_name, version, description, fields_json,
    print_layout_json, active_yn, sort_order, created_at, updated_at)
SELECT 'WORK_REQUEST_CHANGE', '근무 변경·취소계', 1, '승인 완료된 근무신청의 변경 또는 취소 신청',
    '[{"name":"workChangesJson","label":"변경·취소 내역","type":"json","required":true,"systemManaged":true}]',
    NULL, 'Y', 42, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM approval_template WHERE template_code = 'WORK_REQUEST_CHANGE' AND version = 1);
