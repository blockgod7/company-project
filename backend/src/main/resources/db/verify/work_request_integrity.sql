-- Safe for an existing database: consistent snapshot, no repairs or seed writes.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

DO $$
DECLARE
    relation_name TEXT;
    type_definition TEXT;
    actual_types TEXT[];
    expected_types TEXT[];
    issue_count BIGINT;
BEGIN
    FOREACH relation_name IN ARRAY ARRAY[
        'work_request_entry', 'work_request_change', 'comp_time_credit', 'comp_time_allocation'
    ] LOOP
        IF to_regclass('public.' || relation_name) IS NULL THEN
            RAISE EXCEPTION 'Missing table: %; apply the prerequisite DB patches first.', relation_name;
        END IF;
    END LOOP;
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_request_entry'
          AND column_name = 'work_type' AND data_type = 'character varying'
          AND character_maximum_length = 30
    ) THEN
        RAISE EXCEPTION 'work_request_entry.work_type must be VARCHAR(30); apply work_request_type_20260831_patch.sql.';
    END IF;
    SELECT pg_get_constraintdef(oid) INTO type_definition
    FROM pg_constraint
    WHERE conrelid = 'public.work_request_entry'::regclass
      AND conname = 'chk_work_entry_type' AND contype = 'c' AND convalidated;
    SELECT array_agg(value ORDER BY value) INTO expected_types
    FROM unnest(ARRAY['OVERTIME', 'NIGHT', 'NIGHT_OVERTIME', 'SPECIAL',
                     'SPECIAL_OVERTIME', 'SPECIAL_NIGHT', 'SPECIAL_NIGHT_OVERTIME', 'EMERGENCY_CALL']) AS value;
    SELECT array_agg(capture[1] ORDER BY capture[1]) INTO actual_types
    FROM regexp_matches(type_definition, '''([A-Z_]+)''', 'g') AS capture;
    IF actual_types IS DISTINCT FROM expected_types THEN
        RAISE EXCEPTION 'Work-type constraint does not match all eight application types; apply work_request_type_20260831_patch.sql.';
    END IF;
    RAISE NOTICE '[OK] work_type length and eight allowed types';

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.comp_time_credit'::regclass
          AND confrelid = 'public.work_request_entry'::regclass
          AND contype = 'f' AND convalidated
          AND pg_get_constraintdef(oid) = 'FOREIGN KEY (source_work_entry_id) REFERENCES work_request_entry(work_entry_id)'
    ) THEN
        RAISE EXCEPTION 'Missing validated compensatory-time source-work foreign key.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_index i
        WHERE i.indrelid = 'public.comp_time_credit'::regclass
          AND i.indexrelid = to_regclass('public.uk_comp_time_credit_source_work_entry')
          AND i.indisunique AND i.indisvalid AND i.indisready AND i.indnkeyatts = 1
          AND pg_get_indexdef(i.indexrelid, 1, true) = 'source_work_entry_id'
          AND pg_get_expr(i.indpred, i.indrelid) = '(source_work_entry_id IS NOT NULL)'
    ) THEN
        RAISE EXCEPTION 'Missing valid unique index on compensatory-time source_work_entry_id.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint c JOIN pg_index i ON i.indexrelid = c.conindid
        WHERE c.conrelid = 'public.comp_time_credit'::regclass AND c.contype = 'u'
          AND i.indisvalid AND i.indisunique
          AND pg_get_constraintdef(c.oid) = 'UNIQUE (emp_id, work_date)'
    ) THEN
        RAISE EXCEPTION 'Missing existing one-credit-per-employee/date constraint; policy was not changed.';
    END IF;
    RAISE NOTICE '[OK] source foreign key and both duplicate-credit protections';

    SELECT count(*) INTO issue_count FROM public.work_request_entry
    WHERE work_minutes <= 0 OR work_minutes > 1440
       OR work_minutes <> floor((extract(epoch FROM (end_time - start_time))
                          + CASE WHEN end_time <= start_time THEN 86400 ELSE 0 END) / 60);
    IF issue_count > 0 THEN
        RAISE EXCEPTION 'Work duration mismatch: % rows; no rows were changed.', issue_count;
    END IF;
    SELECT count(*) INTO issue_count
    FROM public.comp_time_credit c
    LEFT JOIN public.work_request_entry e ON e.work_entry_id = c.source_work_entry_id
    WHERE c.source_work_entry_id IS NOT NULL
      AND (e.work_entry_id IS NULL OR e.emp_id <> c.emp_id OR e.work_date <> c.work_date
           OR e.comp_time_yn <> 'Y' OR e.status <> 'COMPLETED');
    IF issue_count > 0 THEN
        RAISE EXCEPTION 'Invalid compensatory-time source links: % rows; no rows were changed.', issue_count;
    END IF;
    SELECT count(*) INTO issue_count
    FROM public.comp_time_allocation a
    LEFT JOIN public.comp_time_credit c ON c.credit_id = a.credit_id
    LEFT JOIN public.approval_document d ON d.approval_id = a.approval_id
    WHERE c.credit_id IS NULL OR d.approval_id IS NULL OR c.emp_id <> d.requester_emp_id
       OR a.allocated_days <= 0 OR a.allocated_days > 1
       OR a.status NOT IN ('RESERVED', 'USED', 'RELEASED', 'RESTORED');
    IF issue_count > 0 THEN
        RAISE EXCEPTION 'Invalid compensatory-time allocations: % rows.', issue_count;
    END IF;
    SELECT count(*) INTO issue_count
    FROM public.comp_time_credit c
    LEFT JOIN (
        SELECT credit_id,
               COALESCE(sum(allocated_days) FILTER (WHERE status = 'RESERVED'), 0) AS reserved,
               COALESCE(sum(allocated_days) FILTER (WHERE status = 'USED'), 0) AS used
        FROM public.comp_time_allocation GROUP BY credit_id
    ) a USING (credit_id)
    WHERE c.granted_days <= 0 OR c.granted_days > 1 OR c.reserved_days < 0 OR c.used_days < 0
       OR c.reserved_days + c.used_days > c.granted_days
       OR c.reserved_days <> COALESCE(a.reserved, 0) OR c.used_days <> COALESCE(a.used, 0);
    IF issue_count > 0 THEN
        RAISE EXCEPTION 'Compensatory-time ledger balance mismatch: % rows.', issue_count;
    END IF;
    SELECT count(*) INTO issue_count FROM public.comp_time_credit
    WHERE expires_on < work_date OR expires_on > CASE
        WHEN extract(month FROM work_date) = 12 AND extract(day FROM work_date) >= 15
            THEN make_date(extract(year FROM work_date)::int + 1, 1, 31)
        ELSE make_date(extract(year FROM work_date)::int, 12, 31)
    END;
    IF issue_count > 0 THEN
        RAISE EXCEPTION 'Compensatory-time expiry outside allowed range: % rows.', issue_count;
    END IF;
    RAISE NOTICE '[OK] work duration, source ownership, allocations, balances and expiry bounds';

    -- Historical rows may predate the four-hour / one-day policy. Report only;
    -- never rewrite historical grants or turn them into new-policy failures.
    SELECT count(*) INTO issue_count FROM public.comp_time_credit WHERE source_work_entry_id IS NULL;
    RAISE NOTICE '[INFO] preserved legacy credits without a work source: %', issue_count;
    SELECT count(*) INTO issue_count FROM public.comp_time_credit WHERE granted_days <> 1;
    RAISE NOTICE '[INFO] preserved historical fractional credits: %', issue_count;
    SELECT count(*) INTO issue_count FROM public.work_request_entry
    WHERE comp_time_yn = 'Y' AND (work_minutes < 240 OR work_type NOT LIKE '%SPECIAL%');
    IF issue_count > 0 THEN
        RAISE WARNING 'Review % work rows under the current four-hour/special-work policy; historical rows were preserved.', issue_count;
    END IF;
    SELECT count(*) INTO issue_count
    FROM (SELECT DISTINCT emp_id, work_date FROM public.work_request_entry
          WHERE status = 'COMPLETED' AND comp_time_yn = 'Y' AND work_minutes >= 240) e
    WHERE NOT EXISTS (SELECT 1 FROM public.comp_time_credit c WHERE c.emp_id = e.emp_id AND c.work_date = e.work_date);
    IF issue_count > 0 THEN
        RAISE WARNING 'Review % completed employee/work dates without a credit; no credits were generated.', issue_count;
    END IF;
END $$;

SELECT 'work_request_entry' AS table_name, count(*) AS row_count FROM public.work_request_entry
UNION ALL SELECT 'work_request_change', count(*) FROM public.work_request_change
UNION ALL SELECT 'comp_time_credit', count(*) FROM public.comp_time_credit
UNION ALL SELECT 'comp_time_allocation', count(*) FROM public.comp_time_allocation;
COMMIT;
