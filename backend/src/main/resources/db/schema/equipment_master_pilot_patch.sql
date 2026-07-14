CREATE TABLE IF NOT EXISTS equipment_process (
    process_id BIGSERIAL PRIMARY KEY,
    process_name VARCHAR(100) NOT NULL UNIQUE,
    use_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL, updated_by BIGINT NULL REFERENCES emp(emp_id)
);

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS equipment_type VARCHAR(20) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS asset_no VARCHAR(100);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS model_name VARCHAR(200);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS introduced_year INTEGER;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS introduced_price NUMERIC(15, 2);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(200);
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS process_id BIGINT REFERENCES equipment_process(process_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_equipment_asset_no ON equipment(asset_no) WHERE asset_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_process ON equipment(process_id);
