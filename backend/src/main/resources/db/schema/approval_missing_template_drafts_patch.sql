-- Adds approval-template drafts that are already exposed by the frontend
-- but were not present as active backend templates in existing databases.

ALTER TABLE approval_template
    ALTER COLUMN created_at SET DEFAULT NOW();

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
    'MONTHLY_MAINTENANCE',
    '월간보전계획서',
    1,
    '월간 설비 보전 계획과 작업 범위를 승인받는 문서',
    '[
      {"name":"planMonth","label":"계획월","type":"text","required":true},
      {"name":"targetArea","label":"대상 공정/라인","type":"text","required":true},
      {"name":"targetEquipment","label":"대상 설비","type":"text","required":true},
      {"name":"maintenanceType","label":"보전 구분","type":"select","options":["정기점검","예방보전","개선보전","법정점검","기타"],"required":true},
      {"name":"workSummary","label":"작업 개요","type":"textarea","required":true},
      {"name":"workSchedule","label":"작업 일정","type":"textarea","required":true},
      {"name":"requiredResources","label":"필요 인원/자재/공구","type":"textarea"},
      {"name":"riskAndCountermeasure","label":"위험요인 및 안전대책","type":"textarea"},
      {"name":"expectedEffect","label":"기대 효과","type":"textarea"}
    ]',
    '{"sections":["meta","fields","approvalLines","signatures"],"draft":true}',
    'Y',
    70
WHERE NOT EXISTS (
    SELECT 1 FROM approval_template WHERE template_code = 'MONTHLY_MAINTENANCE' AND version = 1
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
    'ANNUAL_MAINTENANCE',
    '연간보전계획서',
    1,
    '연간 설비 보전 방향, 예산, 주요 일정을 승인받는 문서',
    '[
      {"name":"planYear","label":"계획연도","type":"text","required":true},
      {"name":"scope","label":"대상 공정/설비 범위","type":"textarea","required":true},
      {"name":"maintenanceStrategy","label":"보전 추진 방향","type":"textarea","required":true},
      {"name":"majorSchedule","label":"주요 일정","type":"textarea","required":true},
      {"name":"budgetPlan","label":"예산 계획","type":"textarea"},
      {"name":"sparePartPlan","label":"예비품/소모품 계획","type":"textarea"},
      {"name":"outsourcingPlan","label":"외주/전문업체 활용 계획","type":"textarea"},
      {"name":"kpi","label":"관리 지표","type":"textarea"},
      {"name":"remark","label":"비고","type":"textarea"}
    ]',
    '{"sections":["meta","fields","approvalLines","signatures"],"draft":true}',
    'Y',
    80
WHERE NOT EXISTS (
    SELECT 1 FROM approval_template WHERE template_code = 'ANNUAL_MAINTENANCE' AND version = 1
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
    'EQUIPMENT_REPAIR',
    '설비수리보고서',
    1,
    '설비 고장, 수리 내용, 재발 방지 대책을 보고하는 문서',
    '[
      {"name":"equipmentName","label":"설비명","type":"text","required":true},
      {"name":"equipmentNo","label":"설비번호","type":"text"},
      {"name":"failureDate","label":"고장 발생일","type":"date","required":true},
      {"name":"repairDate","label":"수리 완료일","type":"date"},
      {"name":"failureSymptom","label":"고장 현상","type":"textarea","required":true},
      {"name":"causeAnalysis","label":"원인 분석","type":"textarea","required":true},
      {"name":"repairAction","label":"수리 조치 내용","type":"textarea","required":true},
      {"name":"usedParts","label":"사용 부품/자재","type":"textarea"},
      {"name":"downtime","label":"정지 시간","type":"text"},
      {"name":"preventiveAction","label":"재발 방지 대책","type":"textarea"},
      {"name":"repairOwner","label":"수리 담당자","type":"text"}
    ]',
    '{"sections":["meta","fields","approvalLines","signatures"],"draft":true}',
    'Y',
    90
WHERE NOT EXISTS (
    SELECT 1 FROM approval_template WHERE template_code = 'EQUIPMENT_REPAIR' AND version = 1
);
