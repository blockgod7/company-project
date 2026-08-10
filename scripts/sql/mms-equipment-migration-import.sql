\set ON_ERROR_STOP on
\encoding UTF8

BEGIN;

CREATE TEMP TABLE stage_legacy_equipment (
    source_record_id TEXT,
    source_row_no TEXT,
    equipment_no TEXT,
    equipment_name TEXT,
    equipment_type TEXT,
    asset_no TEXT,
    model_name TEXT,
    introduced_year TEXT,
    introduced_price TEXT,
    manufacturer TEXT,
    status TEXT,
    source_status TEXT,
    source_payload_hash TEXT,
    source_payload TEXT,
    created_at TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stage_legacy_work_order (
    source_record_id TEXT,
    source_row_no TEXT,
    equipment_no TEXT,
    title TEXT,
    symptom TEXT,
    request_content TEXT,
    priority TEXT,
    occurred_on TEXT,
    state TEXT,
    reporter_source_user_id TEXT,
    assignee_source_user_id TEXT,
    assigned_by_source_user_id TEXT,
    planned_start_on TEXT,
    planned_end_on TEXT,
    assignment_instruction TEXT,
    work_result TEXT,
    cause_analysis TEXT,
    action_taken TEXT,
    completed_on TEXT,
    work_duration_hours TEXT,
    cancel_stage TEXT,
    cancel_source_user_id TEXT,
    cancelled_on TEXT,
    source_status TEXT,
    source_request_dept_code TEXT,
    source_assignment_dept_code TEXT,
    source_payload_hash TEXT,
    source_payload TEXT,
    created_at TEXT
) ON COMMIT DROP;

CREATE TEMP TABLE stage_legacy_work_order_reject (
    source_record_id TEXT,
    source_row_no TEXT,
    issue_code TEXT,
    source_value TEXT
) ON COMMIT DROP;

\copy stage_legacy_equipment FROM '__EQUIPMENT_CSV__' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stage_legacy_work_order FROM '__WORK_ORDER_CSV__' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')
\copy stage_legacy_work_order_reject FROM '__REJECT_CSV__' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8')

INSERT INTO dept (dept_code, dept_name, sort_order, use_yn)
VALUES ('__DEFAULT_DEPT_CODE_SQL__', '__DEFAULT_DEPT_NAME_SQL__', 9999, 'N')
ON CONFLICT (dept_code) DO NOTHING;

INSERT INTO equipment_process (process_name, use_yn)
VALUES ('__DEFAULT_PROCESS_NAME_SQL__', 'Y')
ON CONFLICT (process_name) DO NOTHING;

INSERT INTO emp (
    emp_no,
    login_id,
    password_hash,
    emp_name,
    dept_id,
    position_name,
    role_code,
    status,
    account_locked_yn,
    use_yn
)
SELECT
    '__LEGACY_EMP_NO_SQL__',
    '__LEGACY_LOGIN_ID_SQL__',
    '{noop}disabled',
    '__LEGACY_EMP_NAME_SQL__',
    dept_id,
    '__DEFAULT_DEPT_NAME_SQL__',
    'USER',
    'RETIRED',
    'Y',
    'N'
FROM dept
WHERE dept_code = '__DEFAULT_DEPT_CODE_SQL__'
ON CONFLICT (emp_no) DO NOTHING;

INSERT INTO equipment_migration_run (
    source_system,
    source_path,
    source_hash,
    dry_run_yn,
    status,
    equipment_total,
    work_order_total,
    summary_json,
    started_by
)
SELECT
    '__SOURCE_SYSTEM_SQL__',
    '__SOURCE_PATH_SQL__',
    '__SOURCE_HASH_SQL__',
    'N',
    'RUNNING',
    (SELECT COUNT(*) FROM stage_legacy_equipment),
    (SELECT COUNT(*) FROM stage_legacy_work_order) + (SELECT COUNT(*) FROM stage_legacy_work_order_reject),
    jsonb_build_object(
        'mappingHash', '__MAPPING_HASH_SQL__',
        'preparedEquipment', (SELECT COUNT(*) FROM stage_legacy_equipment),
        'preparedWorkOrders', (SELECT COUNT(*) FROM stage_legacy_work_order),
        'rejectedWorkOrders', (SELECT COUNT(*) FROM stage_legacy_work_order_reject)
    ),
    (SELECT emp_id FROM emp WHERE emp_no = '__LEGACY_EMP_NO_SQL__')
RETURNING migration_run_id \gset

INSERT INTO equipment_migration_issue (
    migration_run_id,
    severity,
    entity_type,
    source_record_id,
    source_row_no,
    issue_code,
    issue_message,
    source_value
)
SELECT
    :migration_run_id,
    'ERROR',
    'WORK_ORDER',
    NULLIF(source_record_id, ''),
    NULLIF(source_row_no, '')::INTEGER,
    issue_code,
    'Source work order was excluded from import because a required relationship is missing.',
    NULLIF(source_value, '')
FROM stage_legacy_work_order_reject;

INSERT INTO equipment_migration_issue (
    migration_run_id,
    severity,
    entity_type,
    source_record_id,
    source_row_no,
    issue_code,
    issue_message,
    source_value
)
SELECT
    :migration_run_id,
    'WARNING',
    'EQUIPMENT',
    source_record_id,
    NULLIF(source_row_no, '')::INTEGER,
    'TARGET_EQUIPMENT_ALREADY_EXISTS',
    'The target equipment number already exists; the existing target record was retained.',
    equipment_no
FROM stage_legacy_equipment stage
WHERE EXISTS (
    SELECT 1
    FROM equipment target
    WHERE target.equipment_no = stage.equipment_no
);

INSERT INTO equipment (
    equipment_no,
    equipment_name,
    location,
    process_id,
    owner_dept_id,
    equipment_type,
    asset_no,
    model_name,
    introduced_year,
    introduced_price,
    manufacturer,
    status,
    created_at,
    source_system,
    source_record_id,
    source_status,
    source_row_no,
    source_payload_hash,
    source_payload,
    migration_run_id
)
SELECT
    stage.equipment_no,
    stage.equipment_name,
    process.process_name,
    process.process_id,
    CASE WHEN stage.equipment_type = 'UTILITY' THEN NULL ELSE default_dept.dept_id END,
    stage.equipment_type,
    CASE
        WHEN NULLIF(stage.asset_no, '') IS NULL THEN NULL
        WHEN EXISTS (SELECT 1 FROM equipment target WHERE target.asset_no = stage.asset_no) THEN NULL
        ELSE stage.asset_no
    END,
    NULLIF(stage.model_name, ''),
    NULLIF(stage.introduced_year, '')::INTEGER,
    NULLIF(stage.introduced_price, '')::NUMERIC(15, 2),
    NULLIF(stage.manufacturer, ''),
    stage.status,
    COALESCE(NULLIF(stage.created_at, '')::DATE::TIMESTAMP, NOW()),
    '__SOURCE_SYSTEM_SQL__',
    stage.source_record_id,
    NULLIF(stage.source_status, ''),
    NULLIF(stage.source_row_no, '')::INTEGER,
    NULLIF(stage.source_payload_hash, ''),
    NULLIF(stage.source_payload, '')::JSONB,
    :migration_run_id
FROM stage_legacy_equipment stage
CROSS JOIN equipment_process process
CROSS JOIN dept default_dept
WHERE process.process_name = '__DEFAULT_PROCESS_NAME_SQL__'
  AND default_dept.dept_code = '__DEFAULT_DEPT_CODE_SQL__'
  AND NOT EXISTS (
      SELECT 1
      FROM equipment target
      WHERE target.equipment_no = stage.equipment_no
  );

INSERT INTO equipment_migration_issue (
    migration_run_id,
    severity,
    entity_type,
    source_record_id,
    source_row_no,
    issue_code,
    issue_message,
    source_value
)
SELECT
    :migration_run_id,
    'WARNING',
    'WORK_ORDER',
    stage.source_record_id,
    NULLIF(stage.source_row_no, '')::INTEGER,
    'REQUEST_USER_NOT_MAPPED',
    'The source requester was not found in the current employee master; the legacy record employee was used.',
    stage.reporter_source_user_id
FROM stage_legacy_work_order stage
WHERE NULLIF(stage.reporter_source_user_id, '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM emp current_emp WHERE UPPER(current_emp.emp_no) = UPPER(stage.reporter_source_user_id)
  );

INSERT INTO equipment_migration_issue (
    migration_run_id,
    severity,
    entity_type,
    source_record_id,
    source_row_no,
    issue_code,
    issue_message,
    source_value
)
SELECT
    :migration_run_id,
    'WARNING',
    'WORK_ORDER',
    stage.source_record_id,
    NULLIF(stage.source_row_no, '')::INTEGER,
    'WORK_USER_NOT_MAPPED',
    'The source work employee was not found in the current employee master.',
    stage.assignee_source_user_id
FROM stage_legacy_work_order stage
WHERE NULLIF(stage.assignee_source_user_id, '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM emp current_emp WHERE UPPER(current_emp.emp_no) = UPPER(stage.assignee_source_user_id)
  );

INSERT INTO equipment_migration_issue (
    migration_run_id,
    severity,
    entity_type,
    source_record_id,
    source_row_no,
    issue_code,
    issue_message,
    source_value
)
SELECT
    :migration_run_id,
    'WARNING',
    'WORK_ORDER',
    stage.source_record_id,
    NULLIF(stage.source_row_no, '')::INTEGER,
    'CANCEL_USER_NOT_MAPPED',
    'The source cancellation employee was not found in the current employee master.',
    stage.cancel_source_user_id
FROM stage_legacy_work_order stage
WHERE NULLIF(stage.cancel_source_user_id, '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM emp current_emp WHERE UPPER(current_emp.emp_no) = UPPER(stage.cancel_source_user_id)
  );

INSERT INTO equipment_migration_issue (
    migration_run_id,
    severity,
    entity_type,
    source_record_id,
    source_row_no,
    issue_code,
    issue_message,
    source_value
)
SELECT
    :migration_run_id,
    'WARNING',
    'WORK_ORDER',
    stage.source_record_id,
    NULLIF(stage.source_row_no, '')::INTEGER,
    'ACTIVE_ASSIGNEE_REVIEW_REQUIRED',
    'The active work order has no employee mapping and requires administrator review before continuation.',
    stage.assignee_source_user_id
FROM stage_legacy_work_order stage
WHERE stage.state IN ('IN_PROGRESS', 'PENDING_COMPLETION_APPROVAL')
  AND (
      NULLIF(stage.assignee_source_user_id, '') IS NULL
      OR NOT EXISTS (
          SELECT 1 FROM emp current_emp WHERE UPPER(current_emp.emp_no) = UPPER(stage.assignee_source_user_id)
      )
  );

INSERT INTO equipment_report (
    equipment_id,
    reporter_emp_id,
    assignee_emp_id,
    assigned_by_emp_id,
    title,
    symptom,
    request_content,
    priority,
    occurred_on,
    planned_start_on,
    planned_end_on,
    assignment_instruction,
    work_result,
    cause_analysis,
    action_taken,
    completed_on,
    work_duration_hours,
    state,
    cancel_stage,
    cancelled_by_emp_id,
    cancelled_on,
    created_at,
    source_system,
    source_record_id,
    source_status,
    source_row_no,
    source_payload_hash,
    source_payload,
    source_request_user_id,
    source_work_user_id,
    source_cancel_user_id,
    source_request_dept_code,
    source_assignment_dept_code,
    migration_run_id
)
SELECT
    equipment.equipment_id,
    COALESCE(request_emp.emp_id, legacy_emp.emp_id),
    work_emp.emp_id,
    assigned_by_emp.emp_id,
    stage.title,
    stage.symptom,
    stage.request_content,
    stage.priority,
    NULLIF(stage.occurred_on, '')::DATE,
    NULLIF(stage.planned_start_on, '')::DATE,
    NULLIF(stage.planned_end_on, '')::DATE,
    NULLIF(stage.assignment_instruction, ''),
    NULLIF(stage.work_result, ''),
    NULLIF(stage.cause_analysis, ''),
    NULLIF(stage.action_taken, ''),
    NULLIF(stage.completed_on, '')::DATE,
    NULLIF(stage.work_duration_hours, '')::NUMERIC(6, 2),
    stage.state,
    NULLIF(stage.cancel_stage, ''),
    cancel_emp.emp_id,
    NULLIF(stage.cancelled_on, '')::DATE,
    COALESCE(NULLIF(stage.created_at, '')::DATE::TIMESTAMP, NOW()),
    '__SOURCE_SYSTEM_SQL__',
    stage.source_record_id,
    stage.source_status,
    NULLIF(stage.source_row_no, '')::INTEGER,
    NULLIF(stage.source_payload_hash, ''),
    NULLIF(stage.source_payload, '')::JSONB,
    NULLIF(stage.reporter_source_user_id, ''),
    NULLIF(stage.assignee_source_user_id, ''),
    NULLIF(stage.cancel_source_user_id, ''),
    NULLIF(stage.source_request_dept_code, ''),
    NULLIF(stage.source_assignment_dept_code, ''),
    :migration_run_id
FROM stage_legacy_work_order stage
JOIN equipment ON equipment.equipment_no = stage.equipment_no
CROSS JOIN emp legacy_emp
LEFT JOIN emp request_emp ON UPPER(request_emp.emp_no) = UPPER(stage.reporter_source_user_id)
LEFT JOIN emp work_emp ON UPPER(work_emp.emp_no) = UPPER(stage.assignee_source_user_id)
LEFT JOIN emp assigned_by_emp ON UPPER(assigned_by_emp.emp_no) = UPPER(stage.assigned_by_source_user_id)
LEFT JOIN emp cancel_emp ON UPPER(cancel_emp.emp_no) = UPPER(stage.cancel_source_user_id)
WHERE legacy_emp.emp_no = '__LEGACY_EMP_NO_SQL__'
  AND NOT EXISTS (
      SELECT 1
      FROM equipment_report target
      WHERE target.source_system = '__SOURCE_SYSTEM_SQL__'
        AND target.source_record_id = stage.source_record_id
  );

INSERT INTO equipment_history_event (
    equipment_id,
    report_id,
    actor_emp_id,
    event_type,
    message,
    created_at
)
SELECT
    report.equipment_id,
    report.report_id,
    NULL,
    'HISTORY_REGISTERED',
    '업무 이력이 등록되었습니다.',
    report.created_at
FROM equipment_report report
WHERE report.migration_run_id = :migration_run_id;

UPDATE equipment_migration_run run
SET equipment_imported = (
        SELECT COUNT(*) FROM equipment WHERE migration_run_id = :migration_run_id
    ),
    work_order_imported = (
        SELECT COUNT(*) FROM equipment_report WHERE migration_run_id = :migration_run_id
    ),
    duplicate_count = (
        SELECT COUNT(*) FROM equipment_migration_issue
        WHERE migration_run_id = :migration_run_id
          AND issue_code = 'TARGET_EQUIPMENT_ALREADY_EXISTS'
    ),
    warning_count = (
        SELECT COUNT(*) FROM equipment_migration_issue
        WHERE migration_run_id = :migration_run_id
          AND severity = 'WARNING'
    ),
    error_count = (
        SELECT COUNT(*) FROM equipment_migration_issue
        WHERE migration_run_id = :migration_run_id
          AND severity = 'ERROR'
    ),
    status = CASE
        WHEN EXISTS (
            SELECT 1 FROM equipment_migration_issue
            WHERE migration_run_id = :migration_run_id
        ) THEN 'COMPLETED_WITH_ISSUES'
        ELSE 'COMPLETED'
    END,
    completed_at = NOW()
WHERE run.migration_run_id = :migration_run_id;

COMMIT;

SELECT
    migration_run_id,
    status,
    equipment_total,
    equipment_imported,
    work_order_total,
    work_order_imported,
    duplicate_count,
    warning_count,
    error_count
FROM equipment_migration_run
WHERE migration_run_id = :migration_run_id;
