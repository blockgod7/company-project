ALTER TABLE pdm_folder
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

WITH ordered AS (
    SELECT
        folder_id,
        row_number() OVER (
            PARTITION BY
                category,
                folder_kind,
                coalesce(company_name, ''),
                coalesce(business_unit, ''),
                coalesce(process_name, '')
            ORDER BY folder_name, folder_id
        ) * 10 AS next_sort_order
    FROM pdm_folder
    WHERE sort_order = 0
)
UPDATE pdm_folder folder
SET sort_order = ordered.next_sort_order
FROM ordered
WHERE folder.folder_id = ordered.folder_id;

CREATE INDEX IF NOT EXISTS idx_pdm_folder_order
    ON pdm_folder(category, company_name, business_unit, process_name, folder_kind, sort_order);
