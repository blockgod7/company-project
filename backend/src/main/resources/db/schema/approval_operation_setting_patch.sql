-- Phase 11 follow-up: DB-managed approval operation settings.
-- Apply to existing databases before starting the backend with ddl-auto=validate.

CREATE TABLE IF NOT EXISTS approval_operation_setting (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(500) NOT NULL,
    description VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by BIGINT NULL,
    updated_at TIMESTAMP NULL,
    updated_by BIGINT NULL,
    CONSTRAINT fk_approval_operation_setting_created_by FOREIGN KEY (created_by) REFERENCES emp(emp_id),
    CONSTRAINT fk_approval_operation_setting_updated_by FOREIGN KEY (updated_by) REFERENCES emp(emp_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_approval_operation_setting_updated_at'
    ) THEN
        CREATE TRIGGER trg_approval_operation_setting_updated_at
        BEFORE UPDATE ON approval_operation_setting
        FOR EACH ROW
        EXECUTE FUNCTION fn_update_updated_at();
    END IF;
END $$;

INSERT INTO approval_operation_setting (setting_key, setting_value, description)
VALUES
    ('DECISION_DUE_HOURS', '72', '결재/합의 라인이 열린 뒤 처리 기한까지의 시간'),
    ('REMINDER_FIXED_DELAY_MS', '300000', '지연 알림 스캔 최소 실행 간격(ms)'),
    ('DELETED_DOCUMENT_RETENTION_DAYS', '1825', '보존삭제 문서를 영구보존 검토 전까지 보관할 최소 일수'),
    ('PERMANENT_DELETE_ENABLED', 'false', '전자결재 영구삭제 실행 허용 여부')
ON CONFLICT (setting_key) DO NOTHING;
