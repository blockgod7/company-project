-- 포털 메뉴 메타데이터와 사용자별 메뉴 설정을 비파괴적으로 추가한다.

ALTER TABLE menu ADD COLUMN IF NOT EXISTS menu_code VARCHAR(60);
ALTER TABLE menu ADD COLUMN IF NOT EXISTS portal_code VARCHAR(20) NOT NULL DEFAULT 'EMPLOYEE';
ALTER TABLE menu ADD COLUMN IF NOT EXISTS icon_key VARCHAR(60);
ALTER TABLE menu ADD COLUMN IF NOT EXISTS implementation_status VARCHAR(20) NOT NULL DEFAULT 'IMPLEMENTED';
ALTER TABLE menu ADD COLUMN IF NOT EXISTS required_permission_code VARCHAR(60);
ALTER TABLE menu ADD COLUMN IF NOT EXISTS searchable_yn VARCHAR(1) NOT NULL DEFAULT 'Y';

WITH mapped AS (
    SELECT
        menu_id,
        CASE menu_path
            WHEN '/' THEN 'EMPLOYEE_HOME'
            WHEN '/notice' THEN 'NOTICES'
            WHEN '/notices' THEN 'NOTICES'
            WHEN '/board' THEN 'BOARDS'
            WHEN '/boards' THEN 'BOARDS'
            WHEN '/organization' THEN 'ORGANIZATION'
            WHEN '/notifications' THEN 'NOTIFICATIONS'
            WHEN '/admin' THEN 'ADMIN_HOME'
            WHEN '/admin/audit-logs' THEN 'AUDIT_LOGS'
            ELSE COALESCE(menu_code, 'LEGACY_' || menu_id)
        END AS desired_code
    FROM menu
    WHERE menu_code IS NULL OR menu_code LIKE 'LEGACY_%'
), resolved AS (
    SELECT
        candidate.menu_id,
        CASE
            WHEN EXISTS (
                SELECT 1
                FROM menu existing
                WHERE existing.menu_code = candidate.desired_code
                  AND existing.menu_id <> candidate.menu_id
            ) OR EXISTS (
                SELECT 1
                FROM mapped earlier
                WHERE earlier.desired_code = candidate.desired_code
                  AND earlier.menu_id < candidate.menu_id
            ) THEN 'LEGACY_DUPLICATE_' || candidate.menu_id
            ELSE candidate.desired_code
        END AS resolved_code
    FROM mapped candidate
)
UPDATE menu target
SET menu_code = resolved.resolved_code,
    use_yn = CASE WHEN resolved.resolved_code LIKE 'LEGACY_%' THEN 'N' ELSE target.use_yn END
FROM resolved
WHERE target.menu_id = resolved.menu_id;

-- 이전 스키마와 시드에서 같은 경로가 중복 생성된 경우 데이터를 삭제하지 않고
-- 가장 오래된 행만 표준 메뉴로 승격하고 나머지는 비활성 레거시 행으로 보존한다.
WITH ranked AS (
    SELECT menu_id, menu_code,
           ROW_NUMBER() OVER (PARTITION BY menu_code ORDER BY menu_id) AS duplicate_order
    FROM menu
)
UPDATE menu target
SET menu_code = 'LEGACY_DUPLICATE_' || target.menu_id,
    use_yn = 'N'
FROM ranked duplicate
WHERE target.menu_id = duplicate.menu_id
  AND duplicate.duplicate_order > 1;

UPDATE menu
SET use_yn = 'N'
WHERE menu_code LIKE 'LEGACY_%';

ALTER TABLE menu ALTER COLUMN menu_code SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_menu_code') THEN
        ALTER TABLE menu ADD CONSTRAINT uq_menu_code UNIQUE (menu_code);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_portal_code') THEN
        ALTER TABLE menu ADD CONSTRAINT chk_menu_portal_code CHECK (portal_code IN ('EMPLOYEE', 'ADMIN'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_implementation_status') THEN
        ALTER TABLE menu ADD CONSTRAINT chk_menu_implementation_status CHECK (implementation_status IN ('IMPLEMENTED', 'PLANNED', 'DISABLED'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_menu_searchable_yn') THEN
        ALTER TABLE menu ADD CONSTRAINT chk_menu_searchable_yn CHECK (searchable_yn IN ('Y', 'N'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_menu_preference (
    user_menu_preference_id BIGSERIAL PRIMARY KEY,
    emp_id BIGINT NOT NULL,
    menu_id BIGINT NOT NULL,
    sort_order INT NULL,
    pinned_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    hidden_yn VARCHAR(1) NOT NULL DEFAULT 'N',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NULL,
    CONSTRAINT uq_user_menu_preference UNIQUE (emp_id, menu_id),
    CONSTRAINT chk_user_menu_preference_pinned CHECK (pinned_yn IN ('Y', 'N')),
    CONSTRAINT chk_user_menu_preference_hidden CHECK (hidden_yn IN ('Y', 'N')),
    CONSTRAINT fk_user_menu_preference_emp FOREIGN KEY (emp_id) REFERENCES emp(emp_id),
    CONSTRAINT fk_user_menu_preference_menu FOREIGN KEY (menu_id) REFERENCES menu(menu_id)
);

CREATE INDEX IF NOT EXISTS idx_user_menu_preference_emp ON user_menu_preference(emp_id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_menu_preference_updated_at') THEN
        CREATE TRIGGER trg_user_menu_preference_updated_at
        BEFORE UPDATE ON user_menu_preference
        FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();
    END IF;
END $$;

INSERT INTO menu (menu_code, menu_name, menu_path, parent_menu_id, sort_order, portal_code, icon_key, implementation_status, required_permission_code, searchable_yn, use_yn)
VALUES
    ('EMPLOYEE_HOME', '홈', '/portal/employee/home', NULL, 1, 'EMPLOYEE', 'home', 'IMPLEMENTED', NULL, 'Y', 'Y'),
    ('NOTICES', '공지사항', '/portal/employee/notices', NULL, 2, 'EMPLOYEE', 'book-open', 'IMPLEMENTED', NULL, 'Y', 'Y'),
    ('BOARDS', '게시판', '/portal/employee/boards', NULL, 3, 'EMPLOYEE', 'message-square', 'IMPLEMENTED', NULL, 'Y', 'Y'),
    ('APPROVALS', '전자결재', '/portal/employee/approvals', NULL, 4, 'EMPLOYEE', 'clipboard-check', 'IMPLEMENTED', NULL, 'Y', 'Y'),
    ('PDM', '도면관리', '/planned-features/PDM', NULL, 5, 'EMPLOYEE', 'folder-kanban', 'PLANNED', NULL, 'Y', 'Y'),
    ('EQUIPMENT', '설비관리', '/planned-features/EQUIPMENT', NULL, 6, 'EMPLOYEE', 'wrench', 'PLANNED', NULL, 'Y', 'Y'),
    ('ORGANIZATION', '조직도', '/portal/employee/organization', NULL, 7, 'EMPLOYEE', 'building-2', 'IMPLEMENTED', NULL, 'Y', 'Y'),
    ('NOTIFICATIONS', '알림', '/portal/employee/notifications', NULL, 8, 'EMPLOYEE', 'bell', 'IMPLEMENTED', NULL, 'Y', 'Y'),
    ('ADMIN_HOME', '관리 홈', '/portal/admin/home', NULL, 1, 'ADMIN', 'shield', 'IMPLEMENTED', 'ADMIN_PORTAL', 'Y', 'Y'),
    ('APPROVAL_ADMIN', '전자결재 관리', '/portal/admin/approvals', NULL, 2, 'ADMIN', 'clipboard-check', 'IMPLEMENTED', 'APPROVAL_MANAGE', 'Y', 'Y'),
    ('EMPLOYEES', '직원 관리', '/portal/admin/employees', NULL, 3, 'ADMIN', 'user-cog', 'IMPLEMENTED', 'EMPLOYEE_MANAGE', 'Y', 'Y'),
    ('AUDIT_LOGS', '감사 로그', '/portal/admin/audit-logs', NULL, 4, 'ADMIN', 'scroll-text', 'IMPLEMENTED', 'SYSTEM_ADMIN', 'Y', 'Y')
ON CONFLICT (menu_code) DO UPDATE SET
    menu_name = EXCLUDED.menu_name,
    menu_path = EXCLUDED.menu_path,
    sort_order = EXCLUDED.sort_order,
    portal_code = EXCLUDED.portal_code,
    icon_key = EXCLUDED.icon_key,
    implementation_status = EXCLUDED.implementation_status,
    required_permission_code = EXCLUDED.required_permission_code,
    searchable_yn = EXCLUDED.searchable_yn,
    use_yn = EXCLUDED.use_yn;
