-- Phase 3 approval permission, audit, and notification patch
-- Apply after approval_phase1_patch.sql and Phase 2 application code.

ALTER TABLE notification
    ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) NOT NULL DEFAULT 'SENT',
    ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_error_message TEXT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_notification_status'
    ) THEN
        ALTER TABLE notification
            ADD CONSTRAINT chk_notification_status CHECK (notification_status IN ('PENDING', 'SENT', 'FAILED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notification_status ON notification(notification_status);

ALTER TABLE audit_log
    ADD COLUMN IF NOT EXISTS reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS success_yn VARCHAR(1) NOT NULL DEFAULT 'Y';

UPDATE audit_log
SET success_yn = 'Y'
WHERE success_yn IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_audit_log_success_yn'
    ) THEN
        ALTER TABLE audit_log
            ADD CONSTRAINT chk_audit_log_success_yn CHECK (success_yn IN ('Y', 'N'));
    END IF;
END $$;
