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

INSERT INTO approval_template (
    template_code,
    template_name,
    version,
    description,
    fields_json,
    print_layout_json,
    active_yn,
    sort_order
)
VALUES (
    'EQUIPMENT_PROPOSAL',
    '설비 품의서',
    1,
    '사용부서, 생산기술팀, 구매팀이 단계별로 작성하는 설비 품의서',
    '[{"name":"requestDeptName","label":"요청부서","type":"text","required":true},{"name":"equipmentName","label":"설비명","type":"text","required":true},{"name":"requiredCompletionDate","label":"완료요구일","type":"date","required":true},{"name":"equipmentCapacity","label":"설비용량(능력)","type":"text"},{"name":"requestType","label":"구분","type":"select","options":["구입","제작","개선","수리","매각","폐기"],"required":true},{"name":"currentState","label":"현상","type":"textarea","required":true},{"name":"requirements","label":"요구사항","type":"textarea","required":true},{"name":"instructions","label":"지시 사항","type":"textarea"},{"name":"userEconomicReview","label":"경제성 검토 - 사용부서","type":"textarea"}]',
    '{"layout":"equipment-proposal","sections":["user","pe","purchase","attachments"]}',
    'Y',
    25
)
ON CONFLICT (template_code, version) DO NOTHING;
