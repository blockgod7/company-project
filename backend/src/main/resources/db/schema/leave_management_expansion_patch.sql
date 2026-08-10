-- Leave/employee management expansion. This patch is additive and keeps historical documents intact.

ALTER TABLE emp ALTER COLUMN login_id DROP NOT NULL;
ALTER TABLE emp ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE emp ADD COLUMN IF NOT EXISTS gender_code VARCHAR(10) NOT NULL DEFAULT 'MALE';
ALTER TABLE emp ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) NOT NULL DEFAULT 'REGULAR';
ALTER TABLE emp ADD COLUMN IF NOT EXISTS contract_start_date DATE NULL;
ALTER TABLE emp ADD COLUMN IF NOT EXISTS contract_end_date DATE NULL;
ALTER TABLE emp ADD COLUMN IF NOT EXISTS rehire_date DATE NULL;
ALTER TABLE emp ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE emp ADD COLUMN IF NOT EXISTS temp_password_expires_at TIMESTAMP NULL;
ALTER TABLE emp ADD COLUMN IF NOT EXISTS must_change_password_yn VARCHAR(1) NOT NULL DEFAULT 'N';

ALTER TABLE emp DROP CONSTRAINT IF EXISTS chk_emp_gender_code;
ALTER TABLE emp ADD CONSTRAINT chk_emp_gender_code CHECK (gender_code IN ('MALE', 'FEMALE'));
ALTER TABLE emp DROP CONSTRAINT IF EXISTS chk_emp_employment_type;
ALTER TABLE emp ADD CONSTRAINT chk_emp_employment_type CHECK (employment_type IN ('REGULAR', 'CONTRACT'));
ALTER TABLE emp DROP CONSTRAINT IF EXISTS chk_emp_account_status;
ALTER TABLE emp ADD CONSTRAINT chk_emp_account_status CHECK (account_status IN ('ACCOUNT_PENDING', 'ACTIVE', 'INACTIVE'));
ALTER TABLE emp DROP CONSTRAINT IF EXISTS chk_emp_must_change_password_yn;
ALTER TABLE emp ADD CONSTRAINT chk_emp_must_change_password_yn CHECK (must_change_password_yn IN ('Y', 'N'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_emp_login_id_when_present ON emp(login_id) WHERE login_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS emp_permission (
    emp_permission_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    permission_code VARCHAR(40) NOT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    granted_by BIGINT NULL REFERENCES emp(emp_id),
    revoked_at TIMESTAMP NULL,
    revoked_by BIGINT NULL REFERENCES emp(emp_id),
    reason VARCHAR(500) NULL,
    CONSTRAINT uq_emp_permission UNIQUE (emp_id, permission_code),
    CONSTRAINT chk_emp_permission_code CHECK (permission_code IN ('LEAVE_ADMIN', 'EMPLOYEE_ADMIN')),
    CONSTRAINT chk_emp_permission_active CHECK (active_yn IN ('Y', 'N'))
);

CREATE INDEX IF NOT EXISTS idx_emp_permission_active ON emp_permission(permission_code, active_yn, emp_id);

INSERT INTO emp_permission (emp_id, permission_code, active_yn, reason)
SELECT emp_id, permission_code, 'Y', '기본 권한자'
FROM emp
CROSS JOIN (VALUES ('LEAVE_ADMIN'), ('EMPLOYEE_ADMIN')) AS permissions(permission_code)
WHERE login_id IN ('e0015', 'e7016')
ON CONFLICT (emp_id, permission_code) DO UPDATE SET active_yn = 'Y', revoked_at = NULL, revoked_by = NULL;

CREATE TABLE IF NOT EXISTS emp_employment_history (
    employment_history_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    start_date DATE NOT NULL,
    end_date DATE NULL,
    employment_type VARCHAR(20) NOT NULL,
    rehire_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_employment_history_type CHECK (employment_type IN ('REGULAR', 'CONTRACT')),
    CONSTRAINT chk_employment_history_rehire CHECK (rehire_yn IN ('Y', 'N')),
    CONSTRAINT chk_employment_history_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT uq_emp_employment_start UNIQUE (emp_id, start_date)
);

INSERT INTO emp_employment_history (emp_id, start_date, end_date, employment_type, rehire_yn)
SELECT emp_id, hire_date, retire_date, employment_type, CASE WHEN rehire_date IS NULL THEN 'N' ELSE 'Y' END
FROM emp
WHERE hire_date IS NOT NULL
ON CONFLICT (emp_id, start_date) DO NOTHING;

CREATE TABLE IF NOT EXISTS emp_leave_period (
    emp_leave_period_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    leave_type VARCHAR(40) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    note VARCHAR(500) NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_emp_leave_period_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_emp_leave_period_status CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_emp_leave_period_emp_dates ON emp_leave_period(emp_id, start_date, end_date);

ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS auto_calculated_days NUMERIC(5,1) NULL;
ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS final_days NUMERIC(5,1) NULL;
ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS calculation_mode VARCHAR(20) NOT NULL DEFAULT 'AUTO';
ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS confirmation_status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS calculation_basis VARCHAR(1000) NULL;
ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP NULL;
ALTER TABLE emp_annual_leave ADD COLUMN IF NOT EXISTS confirmed_by BIGINT NULL REFERENCES emp(emp_id);
UPDATE emp_annual_leave
SET auto_calculated_days = COALESCE(auto_calculated_days, granted_days),
    final_days = COALESCE(final_days, granted_days + adjustment_days)
WHERE auto_calculated_days IS NULL OR final_days IS NULL;
ALTER TABLE emp_annual_leave ALTER COLUMN auto_calculated_days SET NOT NULL;
ALTER TABLE emp_annual_leave ALTER COLUMN final_days SET NOT NULL;
ALTER TABLE emp_annual_leave DROP CONSTRAINT IF EXISTS chk_emp_annual_leave_mode;
ALTER TABLE emp_annual_leave ADD CONSTRAINT chk_emp_annual_leave_mode CHECK (calculation_mode IN ('AUTO', 'MANUAL'));
ALTER TABLE emp_annual_leave DROP CONSTRAINT IF EXISTS chk_emp_annual_leave_confirmation;
ALTER TABLE emp_annual_leave ADD CONSTRAINT chk_emp_annual_leave_confirmation CHECK (confirmation_status IN ('CONFIRMED', 'CONTRACT_CONFIRM_REQUIRED', 'LEAVE_CONFIRM_REQUIRED'));

CREATE TABLE IF NOT EXISTS annual_leave_ledger (
    annual_leave_ledger_id BIGSERIAL PRIMARY KEY,
    annual_leave_id BIGINT NOT NULL REFERENCES emp_annual_leave(annual_leave_id),
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    leave_year INT NOT NULL,
    transaction_type VARCHAR(40) NOT NULL,
    before_days NUMERIC(5,1) NOT NULL,
    change_days NUMERIC(5,1) NOT NULL,
    after_days NUMERIC(5,1) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    source_type VARCHAR(50) NULL,
    source_id BIGINT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id)
);

CREATE INDEX IF NOT EXISTS idx_annual_leave_ledger_emp_year ON annual_leave_ledger(emp_id, leave_year, created_at);

ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'COMPANY';
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS repeat_type VARCHAR(20) NOT NULL DEFAULT 'YEAR_ONLY';
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS apply_year INT NULL;
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS repeat_month INT NULL;
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS repeat_day INT NULL;
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS repeat_start_year INT NULL;
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS repeat_end_year INT NULL;
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS policy_version VARCHAR(50) NULL;
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS basis_source VARCHAR(500) NULL;
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS record_only_yn VARCHAR(1) NOT NULL DEFAULT 'N';
ALTER TABLE approval_holiday ADD COLUMN IF NOT EXISTS activation_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';
UPDATE approval_holiday
SET source_type = CASE WHEN holiday_type IN ('PUBLIC_HOLIDAY', 'SUBSTITUTE_HOLIDAY') THEN 'LEGAL' ELSE 'COMPANY' END,
    apply_year = EXTRACT(YEAR FROM holiday_date)::INT
WHERE apply_year IS NULL;

ALTER TABLE approval_holiday DROP CONSTRAINT IF EXISTS chk_approval_holiday_source_type;
ALTER TABLE approval_holiday ADD CONSTRAINT chk_approval_holiday_source_type CHECK (source_type IN ('LEGAL', 'COMPANY'));
ALTER TABLE approval_holiday DROP CONSTRAINT IF EXISTS chk_approval_holiday_repeat_type;
ALTER TABLE approval_holiday ADD CONSTRAINT chk_approval_holiday_repeat_type CHECK (repeat_type IN ('YEAR_ONLY', 'ANNUAL'));
ALTER TABLE approval_holiday DROP CONSTRAINT IF EXISTS chk_approval_holiday_record_only;
ALTER TABLE approval_holiday ADD CONSTRAINT chk_approval_holiday_record_only CHECK (record_only_yn IN ('Y', 'N'));
ALTER TABLE approval_holiday DROP CONSTRAINT IF EXISTS chk_approval_holiday_activation;
ALTER TABLE approval_holiday ADD CONSTRAINT chk_approval_holiday_activation CHECK (activation_status IN ('DRAFT', 'ACTIVE', 'INACTIVE'));

ALTER TABLE approval_leave_exclusion ADD COLUMN IF NOT EXISTS active_yn VARCHAR(1) NOT NULL DEFAULT 'Y';
ALTER TABLE approval_leave_exclusion ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMP NULL;
ALTER TABLE approval_leave_exclusion ADD COLUMN IF NOT EXISTS reversed_by BIGINT NULL REFERENCES emp(emp_id);
ALTER TABLE approval_leave_exclusion ADD COLUMN IF NOT EXISTS reversal_reason VARCHAR(300) NULL;
ALTER TABLE approval_leave_exclusion DROP CONSTRAINT IF EXISTS chk_leave_exclusion_active;
ALTER TABLE approval_leave_exclusion ADD CONSTRAINT chk_leave_exclusion_active CHECK (active_yn IN ('Y', 'N'));

CREATE TABLE IF NOT EXISTS approval_leave_lifecycle_cancellation (
    lifecycle_cancellation_id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL REFERENCES approval_document(approval_id),
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    leave_date DATE NOT NULL,
    leave_type VARCHAR(50) NOT NULL,
    cancellation_type VARCHAR(30) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL,
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT uq_leave_lifecycle_cancel UNIQUE (approval_id, leave_date, leave_type, cancellation_type),
    CONSTRAINT chk_leave_lifecycle_type CHECK (cancellation_type IN ('RETIREMENT', 'EMPLOYEE_LEAVE')),
    CONSTRAINT chk_leave_lifecycle_active CHECK (active_yn IN ('Y', 'N'))
);
ALTER TABLE approval_leave_lifecycle_cancellation ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NULL;
ALTER TABLE approval_leave_lifecycle_cancellation ADD COLUMN IF NOT EXISTS updated_by BIGINT NULL REFERENCES emp(emp_id);
CREATE INDEX IF NOT EXISTS idx_leave_lifecycle_cancel_emp_date ON approval_leave_lifecycle_cancellation(emp_id, leave_date, active_yn);

ALTER TABLE notification ADD COLUMN IF NOT EXISTS event_key VARCHAR(160) NULL;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMP NULL;
ALTER TABLE notification ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_event_receiver
    ON notification(emp_id, event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_retry
    ON notification(notification_status, next_attempt_at) WHERE notification_status IN ('PENDING', 'FAILED');

-- 우주항공청 공식 월력요항과 2026년 4월 공휴일 법령 개정 반영.
-- 법정공휴일은 연도별 공식 자료를 사용하고 회사 자체 휴일만 ANNUAL 반복을 허용한다.
INSERT INTO approval_holiday (
    holiday_date, holiday_name, holiday_type, active_yn, source_type, repeat_type,
    apply_year, policy_version, basis_source, activation_status
)
VALUES
    ('2026-01-01', '신정', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-02-16', '설날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-02-17', '설날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-02-18', '설날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-03-01', '삼일절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-03-02', '대체공휴일(삼일절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-05-01', '노동절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-05-05', '어린이날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-05-24', '부처님오신날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-05-25', '대체공휴일(부처님오신날)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-06-03', '전국동시지방선거', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-06-06', '현충일', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-07-17', '제헌절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-08-15', '광복절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-08-17', '대체공휴일(광복절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-09-24', '추석', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-09-25', '추석', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-09-26', '추석', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-10-03', '개천절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-10-05', '대체공휴일(개천절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-10-09', '한글날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2026-12-25', '성탄절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2026, 'KASA-2026-AMENDED-2026-04-30', 'https://astro.kasi.re.kr/life/post/calendardata', 'ACTIVE'),
    ('2027-01-01', '신정', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-02-06', '설날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-02-07', '설날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-02-08', '설날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-02-09', '대체공휴일(설날)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-03-01', '삼일절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-05-01', '노동절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-05-03', '대체공휴일(노동절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-05-05', '어린이날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-05-13', '부처님오신날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-06-06', '현충일', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-07-17', '제헌절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-07-19', '대체공휴일(제헌절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-08-15', '광복절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-08-16', '대체공휴일(광복절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-09-14', '추석', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-09-15', '추석', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-09-16', '추석', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-10-03', '개천절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-10-04', '대체공휴일(개천절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-10-09', '한글날', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-10-11', '대체공휴일(한글날)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-12-25', '성탄절', 'PUBLIC_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE'),
    ('2027-12-27', '대체공휴일(성탄절)', 'SUBSTITUTE_HOLIDAY', 'Y', 'LEGAL', 'YEAR_ONLY', 2027, 'KASA-2027-2026-06-29', 'https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431', 'ACTIVE')
ON CONFLICT (holiday_date) DO UPDATE SET
    holiday_name = EXCLUDED.holiday_name,
    holiday_type = EXCLUDED.holiday_type,
    active_yn = 'Y',
    source_type = 'LEGAL',
    repeat_type = 'YEAR_ONLY',
    apply_year = EXCLUDED.apply_year,
    repeat_month = NULL,
    repeat_day = NULL,
    policy_version = EXCLUDED.policy_version,
    basis_source = EXCLUDED.basis_source,
    activation_status = 'ACTIVE';

CREATE TABLE IF NOT EXISTS leave_policy (
    leave_policy_id BIGSERIAL PRIMARY KEY,
    leave_type VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    pay_type VARCHAR(20) NOT NULL,
    annual_deduction_days NUMERIC(5,1) NOT NULL DEFAULT 0,
    unit_type VARCHAR(20) NOT NULL DEFAULT 'FULL_DAY',
    max_days NUMERIC(5,1) NULL,
    period_before_days INT NULL,
    period_after_days INT NULL,
    gender_restriction VARCHAR(10) NOT NULL DEFAULT 'ALL',
    evidence_required_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    max_segments INT NULL,
    admin_override_allowed_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    effective_from DATE NOT NULL,
    effective_to DATE NULL,
    change_reason VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT uq_leave_policy_type_from UNIQUE (leave_type, effective_from),
    CONSTRAINT chk_leave_policy_active CHECK (active_yn IN ('Y', 'N')),
    CONSTRAINT chk_leave_policy_pay_type CHECK (pay_type IN ('PAID', 'UNPAID', 'SEPARATE')),
    CONSTRAINT chk_leave_policy_unit_type CHECK (unit_type IN ('FULL_DAY', 'HALF_DAY', 'BOTH')),
    CONSTRAINT chk_leave_policy_gender CHECK (gender_restriction IN ('ALL', 'MALE', 'FEMALE')),
    CONSTRAINT chk_leave_policy_evidence CHECK (evidence_required_yn IN ('Y', 'N')),
    CONSTRAINT chk_leave_policy_override CHECK (admin_override_allowed_yn IN ('Y', 'N')),
    CONSTRAINT chk_leave_policy_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_leave_policy_effective ON leave_policy(leave_type, effective_from, effective_to);

INSERT INTO leave_policy (
    leave_type, display_name, active_yn, pay_type, annual_deduction_days, unit_type,
    max_days, period_before_days, period_after_days, gender_restriction,
    evidence_required_yn, max_segments, admin_override_allowed_yn,
    effective_from, change_reason
) VALUES
    ('연차', '연차', 'Y', 'PAID', 1.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('하계휴가', '하계휴가', 'Y', 'PAID', 1.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('오전반차', '오전반차', 'Y', 'PAID', 0.5, 'HALF_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('오후반차', '오후반차', 'Y', 'PAID', 0.5, 'HALF_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('공가', '공가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('공가(오전)', '공가(오전)', 'Y', 'PAID', 0.0, 'HALF_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('공가(오후)', '공가(오후)', 'Y', 'PAID', 0.0, 'HALF_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('경조', '경조휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('대체휴무', '대체휴무', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('병가', '병가', 'Y', 'UNPAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('산재요양', '산재요양', 'Y', 'SEPARATE', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('무급휴가', '무급휴가', 'Y', 'UNPAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('특별유급휴가', '특별유급휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('배우자 출산휴가', '배우자 출산휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', 20.0, 50, 120, 'ALL', 'N', 4, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('출산전후휴가', '출산전후휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'FEMALE', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('여성휴가', '여성휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'FEMALE', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('유산·사산휴가', '유산·사산휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'FEMALE', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('난임치료휴가', '난임치료휴가', 'Y', 'PAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('가족돌봄휴가', '가족돌봄휴가', 'Y', 'UNPAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('육아휴직', '육아휴직', 'Y', 'SEPARATE', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책'),
    ('자녀돌봄휴가', '자녀돌봄휴가', 'Y', 'UNPAID', 0.0, 'FULL_DAY', NULL, NULL, NULL, 'ALL', 'N', NULL, 'Y', '2026-01-01', '초기 통합 휴가 정책')
ON CONFLICT (leave_type, effective_from) DO NOTHING;

CREATE TABLE IF NOT EXISTS comp_time_credit (
    credit_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    work_date DATE NOT NULL,
    granted_days NUMERIC(3,1) NOT NULL,
    reserved_days NUMERIC(3,1) NOT NULL DEFAULT 0,
    used_days NUMERIC(3,1) NOT NULL DEFAULT 0,
    reason VARCHAR(500) NOT NULL,
    granted_by BIGINT NOT NULL REFERENCES emp(emp_id),
    expires_on DATE NOT NULL,
    expiration_notified_at TIMESTAMP NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uk_comp_time_credit_emp_work_date UNIQUE (emp_id, work_date),
    CONSTRAINT chk_comp_time_credit_granted CHECK (granted_days > 0 AND granted_days <= 1.0),
    CONSTRAINT chk_comp_time_credit_balances CHECK (
        reserved_days >= 0 AND used_days >= 0 AND reserved_days + used_days <= granted_days
    ),
    CONSTRAINT chk_comp_time_credit_expiry CHECK (expires_on >= work_date)
);

CREATE INDEX IF NOT EXISTS idx_comp_time_credit_fifo
    ON comp_time_credit(emp_id, expires_on, work_date);
CREATE INDEX IF NOT EXISTS idx_comp_time_credit_expiry_notice
    ON comp_time_credit(expires_on, expiration_notified_at);

CREATE TABLE IF NOT EXISTS comp_time_allocation (
    allocation_id BIGSERIAL PRIMARY KEY,
    credit_id BIGINT NOT NULL REFERENCES comp_time_credit(credit_id),
    approval_id BIGINT NOT NULL REFERENCES approval_document(approval_id),
    leave_date DATE NOT NULL,
    allocated_days NUMERIC(3,1) NOT NULL,
    status VARCHAR(20) NOT NULL,
    restored_by_approval_id BIGINT NULL REFERENCES approval_document(approval_id),
    status_reason VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_comp_time_allocation_days CHECK (allocated_days > 0 AND allocated_days <= 1.0),
    CONSTRAINT chk_comp_time_allocation_status CHECK (status IN ('RESERVED', 'USED', 'RELEASED', 'RESTORED'))
);

CREATE INDEX IF NOT EXISTS idx_comp_time_allocation_approval
    ON comp_time_allocation(approval_id, status, leave_date);
CREATE INDEX IF NOT EXISTS idx_comp_time_allocation_restore
    ON comp_time_allocation(restored_by_approval_id, status);

CREATE TABLE IF NOT EXISTS leave_policy_override (
    policy_override_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL REFERENCES emp(emp_id),
    leave_type VARCHAR(50) NOT NULL,
    reference_date DATE NOT NULL,
    base_max_days NUMERIC(5,1) NULL,
    override_max_days NUMERIC(5,1) NULL,
    base_max_segments INT NULL,
    override_max_segments INT NULL,
    reason VARCHAR(500) NOT NULL,
    granted_by BIGINT NOT NULL REFERENCES emp(emp_id),
    active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    revoked_at TIMESTAMP NULL,
    revoked_by BIGINT NULL REFERENCES emp(emp_id),
    revoke_reason VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_leave_policy_override_active CHECK (active_yn IN ('Y', 'N')),
    CONSTRAINT chk_leave_policy_override_days CHECK (override_max_days IS NULL OR override_max_days > 0),
    CONSTRAINT chk_leave_policy_override_segments CHECK (override_max_segments IS NULL OR override_max_segments > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leave_policy_override_active_event
    ON leave_policy_override(emp_id, leave_type, reference_date) WHERE active_yn = 'Y';
CREATE INDEX IF NOT EXISTS idx_leave_policy_override_history
    ON leave_policy_override(emp_id, leave_type, reference_date, policy_override_id DESC);

CREATE TABLE IF NOT EXISTS approval_leave_admin_case (
    leave_admin_case_id BIGSERIAL PRIMARY KEY,
    approval_id BIGINT NOT NULL UNIQUE REFERENCES approval_document(approval_id),
    sick_pay_type VARCHAR(20) NOT NULL DEFAULT 'UNPAID',
    sick_pay_reason VARCHAR(500) NULL,
    workers_comp_status VARCHAR(30) NOT NULL DEFAULT 'BEFORE_SUBMISSION',
    workers_comp_reason VARCHAR(500) NULL,
    last_managed_by BIGINT NULL REFERENCES emp(emp_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL, updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_leave_admin_sick_pay CHECK (sick_pay_type IN ('UNPAID','PAID')),
    CONSTRAINT chk_leave_admin_comp_status CHECK (workers_comp_status IN ('BEFORE_SUBMISSION','SUBMITTED','APPROVED','REJECTED'))
);

CREATE TABLE IF NOT EXISTS bereavement_policy (
    bereavement_policy_id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL, family_relation VARCHAR(100) NOT NULL,
    allowed_days NUMERIC(5,1) NOT NULL, pay_type VARCHAR(20) NOT NULL,
    evidence_required_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    effective_from DATE NOT NULL, effective_to DATE NULL, active_yn VARCHAR(1) NOT NULL DEFAULT 'Y',
    change_reason VARCHAR(500) NOT NULL, last_changed_by BIGINT NULL REFERENCES emp(emp_id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(), created_by BIGINT NULL REFERENCES emp(emp_id),
    updated_at TIMESTAMP NULL, updated_by BIGINT NULL REFERENCES emp(emp_id),
    CONSTRAINT chk_bereavement_days CHECK (allowed_days > 0),
    CONSTRAINT chk_bereavement_pay CHECK (pay_type IN ('PAID','UNPAID')),
    CONSTRAINT chk_bereavement_evidence CHECK (evidence_required_yn IN ('Y','N')),
    CONSTRAINT chk_bereavement_active CHECK (active_yn IN ('Y','N')),
    CONSTRAINT chk_bereavement_dates CHECK (effective_to IS NULL OR effective_to >= effective_from)
);
CREATE INDEX IF NOT EXISTS idx_bereavement_policy_effective ON bereavement_policy(event_type,family_relation,effective_from,effective_to);

-- Canonicalize legacy free-text values so employee requests and policy lookup use stable codes.
UPDATE bereavement_policy SET event_type = CASE trim(event_type)
    WHEN '결혼' THEN 'MARRIAGE' WHEN '출산' THEN 'BIRTH'
    WHEN '사망' THEN 'DEATH' WHEN '조사' THEN 'DEATH' ELSE upper(trim(event_type)) END;
UPDATE bereavement_policy SET family_relation = CASE replace(trim(family_relation), ' ', '')
    WHEN '본인' THEN 'SELF' WHEN '배우자' THEN 'SPOUSE' WHEN '자녀' THEN 'CHILD'
    WHEN '부모' THEN 'PARENT' WHEN '부모님' THEN 'PARENT'
    WHEN '배우자부모' THEN 'SPOUSE_PARENT' WHEN '조부모' THEN 'GRANDPARENT'
    WHEN '형제자매' THEN 'SIBLING' ELSE upper(trim(family_relation)) END;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bereavement_policy_type_relation_from
    ON bereavement_policy(event_type, family_relation, effective_from);

CREATE TABLE IF NOT EXISTS scheduled_job_run (
    job_name VARCHAR(80) PRIMARY KEY,
    status VARCHAR(20) NOT NULL DEFAULT 'NEVER_RUN',
    last_started_at TIMESTAMP NULL,
    last_succeeded_at TIMESTAMP NULL,
    last_failed_at TIMESTAMP NULL,
    duration_ms BIGINT NULL,
    message VARCHAR(1000) NULL
);
