-- Employee contact information: add a dedicated office extension field.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'emp' AND column_name = 'extension_no'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'emp' AND column_name = 'extension_number'
    ) THEN
        ALTER TABLE emp RENAME COLUMN extension_no TO extension_number;
    END IF;
END $$;

ALTER TABLE emp
    ADD COLUMN IF NOT EXISTS extension_number VARCHAR(20) NULL;
