CREATE TABLE IF NOT EXISTS approval_equipment_proposal (
    approval_id BIGINT PRIMARY KEY REFERENCES approval_document(approval_id),
    workflow_stage VARCHAR(40) NOT NULL DEFAULT 'USER_APPROVAL',
    request_dept_name VARCHAR(100) NULL,
    equipment_name VARCHAR(200) NULL,
    required_completion_date VARCHAR(30) NULL,
    equipment_capacity VARCHAR(200) NULL,
    request_type VARCHAR(50) NULL,
    current_state TEXT NULL,
    requirements TEXT NULL,
    instructions TEXT NULL,
    user_economic_review TEXT NULL,
    pe_opinion TEXT NULL,
    design_opinion TEXT NULL,
    pe_economic_review TEXT NULL,
    purchase_opinion TEXT NULL,
    vendor_name VARCHAR(200) NULL,
    delivery_due_date VARCHAR(30) NULL,
    purchase_item_name VARCHAR(200) NULL,
    purchase_usage VARCHAR(300) NULL,
    quantity VARCHAR(100) NULL,
    price VARCHAR(100) NULL,
    purchase_note TEXT NULL,
    attachment_contract_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_quote_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_drawing_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_spec_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    attachment_etc VARCHAR(200) NULL,
    pe_assignee_emp_id BIGINT NULL REFERENCES emp(emp_id),
    purchase_assignee_emp_id BIGINT NULL REFERENCES emp(emp_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT chk_approval_equipment_stage CHECK (workflow_stage IN ('USER_APPROVAL', 'PE_INPUT', 'PE_APPROVAL', 'PURCHASE_INPUT', 'PURCHASE_APPROVAL', 'COMPLETED')),
    CONSTRAINT chk_approval_equipment_contract CHECK (attachment_contract_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_equipment_quote CHECK (attachment_quote_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_equipment_drawing CHECK (attachment_drawing_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_equipment_spec CHECK (attachment_spec_yn IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_approval_equipment_stage ON approval_equipment_proposal(workflow_stage);
CREATE INDEX IF NOT EXISTS idx_approval_equipment_pe ON approval_equipment_proposal(pe_assignee_emp_id);
CREATE INDEX IF NOT EXISTS idx_approval_equipment_purchase ON approval_equipment_proposal(purchase_assignee_emp_id);

ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS mold_fixture_type VARCHAR(20) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS product_name VARCHAR(200) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS usage_text VARCHAR(300) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS part_name VARCHAR(200) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS cavity VARCHAR(100) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS material VARCHAR(100) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS mold_no VARCHAR(100) NULL;
ALTER TABLE approval_equipment_proposal ADD COLUMN IF NOT EXISTS mold_parts_json TEXT NULL;

INSERT INTO approval_template (
    created_at,
    template_code,
    template_name,
    version,
    description,
    fields_json,
    print_layout_json,
    active_yn,
    sort_order
)
SELECT
    NOW(),
    'EQUIPMENT_PROPOSAL',
    '설비 품의서',
    1,
    '사용부서, 생산기술팀, 구매팀이 단계별로 작성하는 설비 품의서',
    '[{"name":"requestDeptName","label":"요청부서","type":"text","required":true},{"name":"equipmentName","label":"설비명","type":"text","required":true},{"name":"requiredCompletionDate","label":"완료요구일","type":"date","required":true},{"name":"equipmentCapacity","label":"설비용량(능력)","type":"text"},{"name":"requestType","label":"구분","type":"select","options":["구입","제작","개선","수리","매각","폐기"],"required":true},{"name":"currentState","label":"현상","type":"textarea","required":true},{"name":"requirements","label":"요구사항","type":"textarea","required":true},{"name":"instructions","label":"지시 사항","type":"textarea"},{"name":"userEconomicReview","label":"경제성 검토 - 사용부서","type":"textarea"}]',
    '{"layout":"equipment-proposal","sections":["user","pe","purchase","attachments"]}',
    'Y',
    25
WHERE NOT EXISTS (
    SELECT 1 FROM approval_template WHERE template_code = 'EQUIPMENT_PROPOSAL' AND version = 1
);

INSERT INTO approval_template (
    created_at,
    template_code,
    template_name,
    version,
    description,
    fields_json,
    print_layout_json,
    active_yn,
    sort_order
)
SELECT
    NOW(),
    'MOLD_FIXTURE_PROPOSAL',
    '금형 치공구 품의서',
    1,
    '설비 품의서와 동일한 단계로 사용부서, 주관부서, 구매부서가 작성하는 금형 치공구 품의서',
    '[{"name":"moldFixtureType","label":"품목","type":"select","options":["금형","치공구"],"required":true},{"name":"customerName","label":"고객사","type":"text"},{"name":"productName","label":"제품(기종)명","type":"text","required":true},{"name":"usageText","label":"용도","type":"text"},{"name":"requestDeptName","label":"사용부서","type":"text","required":true},{"name":"requiredCompletionDate","label":"완료요구일","type":"date","required":true},{"name":"requestType","label":"구분","type":"select","options":["고객지급","투자","설계 및 제작","구매","수리","매각","폐기"],"required":true},{"name":"currentState","label":"사유","type":"textarea","required":true},{"name":"partName","label":"부품명","type":"text"},{"name":"cavity","label":"CAVITY","type":"text"},{"name":"material","label":"재질","type":"text"},{"name":"quantity","label":"수량","type":"text"},{"name":"moldNo","label":"금형번호","type":"text"},{"name":"requirements","label":"요구사항","type":"textarea"},{"name":"instructions","label":"지시사항","type":"textarea"},{"name":"userEconomicReview","label":"경제성 검토 - 사용부서","type":"textarea"}]',
    '{"layout":"equipment-proposal","sections":["user","pe","purchase","attachments"],"variant":"mold-fixture"}',
    'Y',
    26
WHERE NOT EXISTS (
    SELECT 1 FROM approval_template WHERE template_code = 'MOLD_FIXTURE_PROPOSAL' AND version = 1
);
