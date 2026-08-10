CREATE TABLE IF NOT EXISTS approval_holiday (
    holiday_id BIGSERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(100) NOT NULL,
    holiday_type VARCHAR(30) NOT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT uq_approval_holiday_date UNIQUE (holiday_date),
    CONSTRAINT chk_approval_holiday_active CHECK (active_yn IN ('Y', 'N')),
    CONSTRAINT chk_approval_holiday_type CHECK (holiday_type IN ('PUBLIC_HOLIDAY', 'SUBSTITUTE_HOLIDAY', 'COMPANY_HOLIDAY', 'OTHER'))
);

ALTER TABLE approval_holiday
    ALTER COLUMN active_yn TYPE VARCHAR(1) USING TRIM(active_yn);

CREATE INDEX IF NOT EXISTS idx_approval_holiday_active_date
    ON approval_holiday(active_yn, holiday_date);

INSERT INTO approval_holiday (holiday_date, holiday_name, holiday_type, active_yn)
VALUES
    ('2026-01-01', '신정', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-02-16', '설날', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-02-17', '설날', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-02-18', '설날', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-03-01', '삼일절', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-03-02', '대체공휴일', 'SUBSTITUTE_HOLIDAY', 'Y'),
    ('2026-05-01', '근로자의 날', 'COMPANY_HOLIDAY', 'Y'),
    ('2026-05-05', '어린이날', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-05-24', '부처님오신날', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-05-25', '대체공휴일', 'SUBSTITUTE_HOLIDAY', 'Y'),
    ('2026-06-03', '지방선거', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-06-06', '현충일', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-08-15', '광복절', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-08-17', '대체공휴일', 'SUBSTITUTE_HOLIDAY', 'Y'),
    ('2026-09-24', '추석', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-09-25', '추석', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-09-26', '추석', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-10-03', '개천절', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-10-05', '대체공휴일', 'SUBSTITUTE_HOLIDAY', 'Y'),
    ('2026-10-09', '한글날', 'PUBLIC_HOLIDAY', 'Y'),
    ('2026-12-25', '성탄절', 'PUBLIC_HOLIDAY', 'Y')
ON CONFLICT (holiday_date) DO NOTHING;

CREATE TABLE IF NOT EXISTS approval_leave_exclusion (
    exclusion_id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL REFERENCES approval_document(approval_id),
    holiday_id BIGINT NOT NULL REFERENCES approval_holiday(holiday_id),
    leave_date DATE NOT NULL,
    leave_type VARCHAR(50) NOT NULL,
    restored_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    reason VARCHAR(300) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT uq_approval_leave_exclusion UNIQUE (approval_id, leave_date)
);

CREATE INDEX IF NOT EXISTS idx_approval_leave_exclusion_document
    ON approval_leave_exclusion(approval_id, leave_date);

CREATE INDEX IF NOT EXISTS idx_approval_leave_exclusion_holiday
    ON approval_leave_exclusion(holiday_id);
