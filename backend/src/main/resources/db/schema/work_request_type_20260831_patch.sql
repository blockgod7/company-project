-- Repair databases that received the original three-type work-request patch.
-- No employee, approval, schedule, or compensatory-time rows are changed.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.work_request_entry ALTER COLUMN work_type TYPE VARCHAR(30);
ALTER TABLE public.work_request_entry DROP CONSTRAINT IF EXISTS chk_work_entry_type;
ALTER TABLE public.work_request_entry ADD CONSTRAINT chk_work_entry_type CHECK (
    work_type IN ('OVERTIME', 'NIGHT', 'NIGHT_OVERTIME', 'SPECIAL',
                  'SPECIAL_OVERTIME', 'SPECIAL_NIGHT', 'SPECIAL_NIGHT_OVERTIME', 'EMERGENCY_CALL')
);

COMMIT;
