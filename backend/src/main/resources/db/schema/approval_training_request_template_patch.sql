-- Align TRAINING_REQUEST with the education application form and receiver-routed workflow.

UPDATE approval_template
SET
    template_name = '교육신청서',
    description = '교육 수강, 변경, 불참 신청',
    fields_json = '[
      {"name":"requestType","label":"신청 구분","type":"select","options":["수강","변경","불참"],"required":true},
      {"name":"deptName","label":"소속","type":"text","required":true},
      {"name":"positionName","label":"직위","type":"text","required":true},
      {"name":"requesterName","label":"성명","type":"text","required":true},
      {"name":"trainingName","label":"교육명","type":"text","required":true},
      {"name":"institution","label":"교육기관","type":"text","required":true},
      {"name":"reason","label":"사유(구체적)","type":"textarea","required":true},
      {"name":"requestDate","label":"신청일","type":"date","required":true}
    ]',
    print_layout_json = '{"layout":"training-request","sections":["requestDeptApproval","receiverDeptApproval","meta","reason","closing","attachments"]}'
WHERE template_code = 'TRAINING_REQUEST'
  AND active_yn = 'Y';

-- Align TRAINING_REPORT with the uploaded education training report form and receiver-routed workflow.

UPDATE approval_template
SET
    template_name = '교육훈련보고서',
    description = '교육 결과 및 업무 반영 보고',
    fields_json = '[
      {"name":"reportDate","label":"작성일","type":"date","required":true},
      {"name":"empNo","label":"사번","type":"text","required":true},
      {"name":"requesterName","label":"성명","type":"text","required":true},
      {"name":"signatureName","label":"서명","type":"text","required":true},
      {"name":"trainingName","label":"교육명","type":"text","required":true},
      {"name":"institution","label":"교육기관","type":"text","required":true},
      {"name":"trainingPeriod","label":"교육기간","type":"text","required":true},
      {"name":"mainContent","label":"주요교육 내용","type":"textarea"},
      {"name":"jobApplication","label":"업무수행 방안","type":"textarea"},
      {"name":"impression","label":"교육 소감","type":"textarea"},
      {"name":"nextTraining","label":"차기에 받고 싶은 교육(업무효과가능)","type":"textarea"},
      {"name":"effectiveness","label":"유효성 평가(시급,속도,균형)","type":"textarea"},
      {"name":"hrRecordCheck","label":"총무 인사카드기록 확인","type":"textarea"}
    ]',
    print_layout_json = '{"layout":"training-report","sections":["requestDeptApproval","receiverDeptApproval","meta","training","content","effectiveness","hrRecord","signature"]}'
WHERE template_code = 'TRAINING_REPORT'
  AND active_yn = 'Y';
