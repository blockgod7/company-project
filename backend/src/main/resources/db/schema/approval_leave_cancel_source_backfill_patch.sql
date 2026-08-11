-- Backfill source approval references for legacy leave-cancellation selections.
-- Only an unambiguous match (same requester, leave date, and leave type in one approved leave document)
-- is linked. Missing or ambiguous matches remain untouched for manual review.

WITH source_selections AS (
    SELECT
        source.approval_id AS source_approval_id,
        source.document_no AS source_document_no,
        source.requester_emp_id,
        selection.item ->> 'date' AS leave_date,
        selection.item ->> 'type' AS leave_type
    FROM approval_document source
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) AS selection(item)
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') <> ''
    UNION ALL
    SELECT
        source.approval_id,
        source.document_no,
        source.requester_emp_id,
        source.form_data_json::jsonb -> 'fields' ->> 'startDate',
        source.form_data_json::jsonb -> 'fields' ->> 'leaveType'
    FROM approval_document source
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') = ''
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'startDate', '') <> ''
),
legacy_cancel_selections AS (
    SELECT
        cancel.approval_id AS cancel_approval_id,
        cancel.requester_emp_id,
        selection.ordinality,
        selection.item
    FROM approval_document cancel
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) WITH ORDINALITY AS selection(item, ordinality)
    WHERE cancel.template_code = 'LEAVE_CANCEL'
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') <> ''
),
candidate_matches AS (
    SELECT
        legacy.cancel_approval_id,
        legacy.ordinality,
        COUNT(DISTINCT source.source_approval_id) AS candidate_count,
        MIN(source.source_approval_id) AS source_approval_id,
        MIN(source.source_document_no) AS source_document_no
    FROM legacy_cancel_selections legacy
    LEFT JOIN source_selections source
      ON source.requester_emp_id = legacy.requester_emp_id
     AND source.leave_date = legacy.item ->> 'date'
     AND source.leave_type = legacy.item ->> 'type'
    WHERE COALESCE(legacy.item ->> 'sourceApprovalId', '') !~ '^[1-9][0-9]*$'
    GROUP BY legacy.cancel_approval_id, legacy.ordinality
),
rebuilt_selections AS (
    SELECT
        legacy.cancel_approval_id,
        jsonb_agg(
            CASE
                WHEN COALESCE(legacy.item ->> 'sourceApprovalId', '') ~ '^[1-9][0-9]*$'
                    THEN legacy.item
                WHEN candidate.candidate_count = 1
                    THEN legacy.item || jsonb_build_object(
                        'sourceApprovalId', candidate.source_approval_id,
                        'sourceDocumentNo', candidate.source_document_no
                    )
                ELSE legacy.item
            END
            ORDER BY legacy.ordinality
        ) AS selections,
        COUNT(*) FILTER (
            WHERE COALESCE(legacy.item ->> 'sourceApprovalId', '') !~ '^[1-9][0-9]*$'
              AND candidate.candidate_count = 1
        ) AS linked_count
    FROM legacy_cancel_selections legacy
    LEFT JOIN candidate_matches candidate
      ON candidate.cancel_approval_id = legacy.cancel_approval_id
     AND candidate.ordinality = legacy.ordinality
    GROUP BY legacy.cancel_approval_id
)
UPDATE approval_document cancel
SET form_data_json = jsonb_set(
        cancel.form_data_json::jsonb,
        '{fields,leaveSelectionsJson}',
        to_jsonb(rebuilt.selections::text),
        false
    )::text,
    updated_at = NOW()
FROM rebuilt_selections rebuilt
WHERE cancel.approval_id = rebuilt.cancel_approval_id
  AND rebuilt.linked_count > 0;

WITH source_selections AS (
    SELECT
        source.approval_id AS source_approval_id,
        source.document_no AS source_document_no,
        source.requester_emp_id,
        selection.item ->> 'date' AS leave_date,
        selection.item ->> 'type' AS leave_type
    FROM approval_document source
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) AS selection(item)
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') <> ''
    UNION ALL
    SELECT
        source.approval_id,
        source.document_no,
        source.requester_emp_id,
        source.form_data_json::jsonb -> 'fields' ->> 'startDate',
        source.form_data_json::jsonb -> 'fields' ->> 'leaveType'
    FROM approval_document source
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') = ''
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'startDate', '') <> ''
),
fallback_matches AS (
    SELECT
        cancel.approval_id AS cancel_approval_id,
        COUNT(DISTINCT source.source_approval_id) AS candidate_count,
        MIN(source.source_approval_id) AS source_approval_id,
        MIN(source.source_document_no) AS source_document_no
    FROM approval_document cancel
    LEFT JOIN source_selections source
      ON source.requester_emp_id = cancel.requester_emp_id
     AND source.leave_date = cancel.form_data_json::jsonb -> 'fields' ->> 'startDate'
     AND source.leave_type = cancel.form_data_json::jsonb -> 'fields' ->> 'leaveType'
    WHERE cancel.template_code = 'LEAVE_CANCEL'
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') = ''
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'startDate', '') <> ''
    GROUP BY cancel.approval_id
)
UPDATE approval_document cancel
SET form_data_json = jsonb_set(
        cancel.form_data_json::jsonb,
        '{fields,leaveSelectionsJson}',
        to_jsonb(jsonb_build_array(jsonb_build_object(
            'date', cancel.form_data_json::jsonb -> 'fields' ->> 'startDate',
            'type', cancel.form_data_json::jsonb -> 'fields' ->> 'leaveType',
            'sourceApprovalId', matched.source_approval_id,
            'sourceDocumentNo', matched.source_document_no
        ))::text),
        true
    )::text,
    updated_at = NOW()
FROM fallback_matches matched
WHERE cancel.approval_id = matched.cancel_approval_id
  AND matched.candidate_count = 1;

WITH source_selections AS (
    SELECT
        source.approval_id AS source_approval_id,
        source.requester_emp_id,
        selection.item ->> 'date' AS leave_date,
        selection.item ->> 'type' AS leave_type
    FROM approval_document source
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) AS selection(item)
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') <> ''
    UNION ALL
    SELECT
        source.approval_id,
        source.requester_emp_id,
        source.form_data_json::jsonb -> 'fields' ->> 'startDate',
        source.form_data_json::jsonb -> 'fields' ->> 'leaveType'
    FROM approval_document source
    WHERE source.template_code = 'LEAVE'
      AND source.status = 'APPROVED'
      AND source.deleted_yn = 'N'
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') = ''
      AND COALESCE(source.form_data_json::jsonb -> 'fields' ->> 'startDate', '') <> ''
),
unlinked AS (
    SELECT
        cancel.approval_id,
        cancel.requester_emp_id,
        selection.ordinality AS item_order,
        selection.item
    FROM approval_document cancel
    CROSS JOIN LATERAL jsonb_array_elements(
        NULLIF(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '')::jsonb
    ) WITH ORDINALITY AS selection(item, ordinality)
    WHERE cancel.template_code = 'LEAVE_CANCEL'
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') <> ''
      AND COALESCE(selection.item ->> 'sourceApprovalId', '') !~ '^[1-9][0-9]*$'
    UNION ALL
    SELECT
        cancel.approval_id,
        cancel.requester_emp_id,
        1::bigint,
        jsonb_build_object(
            'date', cancel.form_data_json::jsonb -> 'fields' ->> 'startDate',
            'type', cancel.form_data_json::jsonb -> 'fields' ->> 'leaveType'
        )
    FROM approval_document cancel
    WHERE cancel.template_code = 'LEAVE_CANCEL'
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'leaveSelectionsJson', '') = ''
      AND COALESCE(cancel.form_data_json::jsonb -> 'fields' ->> 'startDate', '') <> ''
),
audited AS (
    SELECT
        unlinked.approval_id,
        unlinked.item,
        COUNT(DISTINCT source.source_approval_id) AS candidate_count
    FROM unlinked
    LEFT JOIN source_selections source
      ON source.requester_emp_id = unlinked.requester_emp_id
     AND source.leave_date = unlinked.item ->> 'date'
     AND source.leave_type = unlinked.item ->> 'type'
    GROUP BY unlinked.approval_id, unlinked.item_order, unlinked.item
)
SELECT
    COUNT(*) AS remaining_unlinked_selections,
    COUNT(*) FILTER (WHERE candidate_count = 0) AS no_match_selections,
    COUNT(*) FILTER (WHERE candidate_count > 1) AS ambiguous_selections
FROM audited;
