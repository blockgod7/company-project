import { ClipboardCheck, ScrollText, ShieldCheck, Users } from "lucide-react";
import { canManageApproval } from "../navigation";
import type { User } from "../types";
import type { Route } from "../utils/approvalDomain";

type AdminPortalPageProps = {
  user: User;
  go: (route: Route) => void;
};

export function AdminPortalPage({ user, go }: AdminPortalPageProps) {
  const fullAdmin = user.roleCode === "ADMIN" || user.permissions.includes("FULL_ADMIN");
  const canManageEmployees = fullAdmin
    || user.permissions.includes("EMPLOYEE_ADMIN")
    || user.permissions.includes("WORK_CATEGORY_ADMIN")
    || user.permissions.includes("ACCOUNT_ADMIN")
    || user.permissions.includes("WORK_REQUEST_ADMIN");
  const approvalManagementAllowed = canManageApproval(user);

  return (
    <div className="admin-portal-page">
      <section className="panel admin-portal-hero">
        <div>
          <span className="eyebrow">ADMIN PORTAL</span>
          <h2>관리 포털</h2>
          <p>부여된 권한 범위 안에서 조직과 업무 운영 기능을 관리합니다.</p>
        </div>
        <ShieldCheck size={42} aria-hidden="true" />
      </section>

      <section className="admin-portal-grid" aria-label="관리 기능">
        {approvalManagementAllowed && (
          <button type="button" className="panel admin-portal-card" onClick={() => go("approvalAdmin")}>
            <ClipboardCheck size={24} />
            <strong>전자결재 운영</strong>
            <span>결재 문서와 휴가 정책·운영 설정을 관리합니다.</span>
          </button>
        )}
        {canManageEmployees && (
          <button type="button" className="panel admin-portal-card" onClick={() => go("employees")}>
            <Users size={24} />
            <strong>직원 및 조직 관리</strong>
            <span>직원 정보, 계정과 업무 권한을 관리합니다.</span>
          </button>
        )}
        {user.roleCode === "ADMIN" && (
          <button type="button" className="panel admin-portal-card" onClick={() => go("audit")}>
            <ScrollText size={24} />
            <strong>감사 로그</strong>
            <span>중요 업무와 관리자 변경 이력을 확인합니다.</span>
          </button>
        )}
      </section>
    </div>
  );
}
