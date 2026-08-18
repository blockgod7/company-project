import { useEffect, useMemo, useState } from "react";
import { KeyRound, Pencil, Plus, RefreshCw, Search, UserCheck } from "lucide-react";
import { api, jsonBody } from "../api";
import type { DeptNode, ManagedEmployee, User } from "../types";

type EmployeeManagementPageProps = { user: User };
type DeptOption = { deptId: number; deptName: string };
type TemporaryPassword = { loginId: string; temporaryPassword: string; expiresAt: string };
type LeaveImpact = { affectedDateCount: number; items: { approvalId: number; documentNo: string | null; status: string; date: string; leaveType: string }[] };
type EmployeeForm = {
  empNo: string; empName: string; genderCode: "MALE" | "FEMALE"; email: string; phone: string; extensionNumber: string;
  deptId: string; positionName: string; jobTitle: string; managerEmpId: string; hireDate: string;
  employmentType: "REGULAR" | "CONTRACT"; workCategory: "AUTO" | "MANAGEMENT" | "FIELD";
  contractStartDate: string; contractEndDate: string;
};

const EMPTY_FORM: EmployeeForm = {
  empNo: "", empName: "", genderCode: "MALE", email: "", phone: "", extensionNumber: "", deptId: "",
  positionName: "", jobTitle: "", managerEmpId: "", hireDate: new Date().toISOString().slice(0, 10),
  employmentType: "REGULAR", workCategory: "AUTO", contractStartDate: "", contractEndDate: ""
};

function flattenDepts(nodes: DeptNode[], depth = 0): DeptOption[] {
  return nodes.flatMap((node) => [
    { deptId: node.deptId, deptName: `${"　".repeat(depth)}${node.deptName}` },
    ...flattenDepts(node.children ?? [], depth + 1)
  ]);
}

function requestBody(form: EmployeeForm, includeEmpNo: boolean) {
  return {
    ...(includeEmpNo ? { empNo: form.empNo.trim() } : {}),
    empName: form.empName.trim(), genderCode: form.genderCode,
    email: form.email.trim() || null, phone: form.phone.trim() || null, extensionNumber: form.extensionNumber.trim() || null,
    deptId: form.deptId ? Number(form.deptId) : null,
    positionName: form.positionName.trim() || null, jobTitle: form.jobTitle.trim() || null,
    managerEmpId: form.managerEmpId ? Number(form.managerEmpId) : null,
    hireDate: form.hireDate, employmentType: form.employmentType,
    contractStartDate: form.employmentType === "CONTRACT" && form.contractStartDate ? form.contractStartDate : null,
    contractEndDate: form.employmentType === "CONTRACT" && form.contractEndDate ? form.contractEndDate : null
  };
}

export function EmployeeManagementPage({ user }: EmployeeManagementPageProps) {
  const [employees, setEmployees] = useState<ManagedEmployee[]>([]);
  const [depts, setDepts] = useState<DeptOption[]>([]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<ManagedEmployee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [temporary, setTemporary] = useState<TemporaryPassword | null>(null);
  const canManageAccounts = user.permissions.includes("ACCOUNT_ADMIN");
  const canManageEmployees = user.permissions.includes("EMPLOYEE_ADMIN");
  const canManageWorkCategory = user.permissions.includes("WORK_CATEGORY_ADMIN");
  const canEditEmployeeDetails = canManageEmployees || canManageWorkCategory;
  const profileFieldsDisabled = !canManageEmployees;
  const canGrantPermissions = user.permissions.includes("FULL_ADMIN") || user.roleCode === "ADMIN";

  async function load() {
    setError("");
    try { setEmployees(await api<ManagedEmployee[]>("/employee-management")); }
    catch (err) { setError(err instanceof Error ? err.message : "직원 목록을 불러오지 못했습니다."); }
  }

  useEffect(() => {
    void load();
    void api<DeptNode[]>("/depts/tree").then((nodes) => setDepts(flattenDepts(nodes))).catch(() => setDepts([]));
  }, []);

  const filtered = useMemo(() => employees.filter((employee) => {
    const matchKeyword = !keyword || [employee.empName, employee.empNo, employee.loginId ?? "", employee.deptName ?? ""]
      .some((value) => value.toLowerCase().includes(keyword.toLowerCase()));
    return matchKeyword && (!status || employee.status === status);
  }), [employees, keyword, status]);

  function openCreate() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); setError(""); }
  function openEdit(employee: ManagedEmployee) {
    setEditing(employee);
    setForm({
      empNo: employee.empNo, empName: employee.empName, genderCode: employee.genderCode,
      email: employee.email ?? "", phone: employee.phone ?? "", extensionNumber: employee.extensionNumber ?? "", deptId: employee.deptId ? String(employee.deptId) : "",
      positionName: employee.positionName ?? "", jobTitle: employee.jobTitle ?? "",
      managerEmpId: employee.managerEmpId ? String(employee.managerEmpId) : "", hireDate: employee.hireDate,
      employmentType: employee.employmentType, workCategory: employee.workCategory,
      contractStartDate: employee.contractStartDate ?? "",
      contractEndDate: employee.contractEndDate ?? ""
    });
    setShowForm(true); setError("");
  }

  async function save() {
    if (!editing && !canManageEmployees) {
      setError("직원 등록 권한이 없습니다."); return;
    }
    if (canManageEmployees) {
      if (!form.empName.trim() || !form.hireDate || (!editing && !form.empNo.trim())) {
        setError("사번, 이름, 입사일은 필수입니다."); return;
      }
      if (form.employmentType === "CONTRACT" && (!form.contractStartDate || !form.contractEndDate)) {
        setError("계약직은 계약 시작일과 종료일을 모두 입력해야 합니다."); return;
      }
      if (form.employmentType === "CONTRACT" && form.contractEndDate < form.contractStartDate) {
        setError("계약 종료일은 계약 시작일보다 빠를 수 없습니다."); return;
      }
    }
    if (editing && !canManageEmployees && (!canManageWorkCategory || form.workCategory === editing.workCategory)) {
      setError("변경된 직군 정보가 없습니다."); return;
    }
    setBusy(true); setError("");
    try {
      let saved: ManagedEmployee | null = editing;
      let profileSaved = false;
      let workCategorySaved = false;
      if (canManageEmployees) {
        saved = await api<ManagedEmployee>(editing ? `/employee-management/${editing.empId}` : "/employee-management", {
          method: editing ? "PUT" : "POST", body: jsonBody(requestBody(form, !editing))
        });
        profileSaved = true;
      }
      if (saved && canManageWorkCategory && form.workCategory !== "AUTO" && saved.workCategory !== form.workCategory) {
        saved = await api<ManagedEmployee>(`/employee-management/${saved.empId}/work-category`, {
          method: "PUT", body: jsonBody({ workCategory: form.workCategory })
        });
        workCategorySaved = true;
      }
      setShowForm(false);
      setMessage(!editing
        ? "직원을 등록했습니다. 계정은 별도로 발급하세요."
        : workCategorySaved && !profileSaved
          ? "직원 상세의 직군 정보를 수정했습니다."
          : "직원 상세 정보를 수정했습니다.");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "저장하지 못했습니다."); }
    finally { setBusy(false); }
  }

  async function issueAccount(employee: ManagedEmployee) {
    const loginId = employee.loginId ?? window.prompt("로그인 아이디를 입력하세요.", employee.empNo);
    if (!loginId) return;
    setError("");
    try {
      const result = employee.loginId
        ? await api<TemporaryPassword>(`/employee-management/${employee.empId}/account/reset-password`, { method: "POST" })
        : await api<TemporaryPassword>(`/employee-management/${employee.empId}/account`, { method: "POST", body: jsonBody({ loginId }) });
      setTemporary(result); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "계정을 처리하지 못했습니다."); }
  }

  async function togglePermission(employee: ManagedEmployee, permissionCode: "FULL_ADMIN" | "LEAVE_ADMIN" | "LEAVE_POLICY_ADMIN" | "EMPLOYEE_ADMIN" | "WORK_CATEGORY_ADMIN" | "ACCOUNT_ADMIN") {
    const active = !employee.permissions.includes(permissionCode);
    try {
      await api(`/employee-management/permissions/${employee.empId}`, {
        method: "PUT", body: jsonBody({ permissionCode, active, reason: "직원 관리 화면에서 변경" })
      });
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "권한을 변경하지 못했습니다."); }
  }

  async function retire(employee: ManagedEmployee) {
    const retireDate = window.prompt("퇴직일을 입력하세요. (YYYY-MM-DD)", new Date().toISOString().slice(0, 10))?.trim(); if (!retireDate) return;
    try {
      const impact = await api<LeaveImpact>(`/employee-management/${employee.empId}/retire-impact?retireDate=${retireDate}`);
      const detail = impact.items.slice(0, 5).map((item) => `${item.date} ${item.leaveType}`).join("\n");
      if (!window.confirm(`퇴직일 이후 휴가 ${impact.affectedDateCount}일이 자동 취소됩니다.${detail ? `\n\n${detail}` : ""}\n\n퇴직 처리할까요?`)) return;
      await api(`/employee-management/${employee.empId}/retire`, { method: "POST", body: jsonBody({ retireDate }) }); setMessage(`${employee.empName}님을 퇴직 처리했습니다.`); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "퇴직 처리하지 못했습니다."); }
  }
  async function startLeave(employee: ManagedEmployee) {
    const startDate = window.prompt("휴직 시작일 (YYYY-MM-DD)", new Date().toISOString().slice(0, 10))?.trim(); if (!startDate) return;
    const endDate = window.prompt("휴직 종료예정일 (YYYY-MM-DD)", startDate)?.trim(); if (!endDate) return;
    const leaveType = window.prompt("휴직 종류", "일반 휴직")?.trim(); if (!leaveType) return;
    try {
      const impact = await api<LeaveImpact>(`/employee-management/${employee.empId}/leave-impact?startDate=${startDate}&endDate=${endDate}`);
      if (!window.confirm(`휴직 기간과 겹치는 휴가 ${impact.affectedDateCount}일이 자동 취소됩니다. 계속할까요?`)) return;
      await api(`/employee-management/${employee.empId}/leave`, { method: "POST", body: jsonBody({ startDate, endDate, leaveType, note: null }) }); setMessage(`${employee.empName}님을 휴직 처리했습니다.`); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "휴직 처리하지 못했습니다."); }
  }
  async function returnFromLeave(employee: ManagedEmployee) {
    if (!window.confirm(`${employee.empName}님을 복직 처리할까요? 휴직으로 취소된 휴가는 자동 복원되지 않습니다.`)) return;
    try { await api(`/employee-management/${employee.empId}/return`, { method: "POST" }); setMessage(`${employee.empName}님을 복직 처리했습니다.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "복직 처리하지 못했습니다."); }
  }
  async function rehire(employee: ManagedEmployee) {
    const rehireDate = window.prompt("재입사일 (YYYY-MM-DD)", new Date().toISOString().slice(0, 10))?.trim(); if (!rehireDate) return;
    const employmentType = window.confirm("계약직으로 재입사합니까?\n확인: 계약직 / 취소: 정규직") ? "CONTRACT" : "REGULAR";
    let contractStartDate: string | null = null, contractEndDate: string | null = null;
    if (employmentType === "CONTRACT") { contractStartDate = window.prompt("계약 시작일", rehireDate)?.trim() || null; contractEndDate = window.prompt("계약 종료일", rehireDate)?.trim() || null; if (!contractStartDate || !contractEndDate) return; }
    try { await api(`/employee-management/${employee.empId}/rehire`, { method: "POST", body: jsonBody({ rehireDate, employmentType, contractStartDate, contractEndDate }) }); setMessage(`${employee.empName}님을 재입사 처리했습니다. 계정은 별도로 재발급하세요.`); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : "재입사 처리하지 못했습니다."); }
  }

  return (
    <section className="panel employee-management">
      <div className="toolbar">
        <div><h3>직원 관리</h3><p className="muted">재직 정보와 계정은 분리해 안전하게 관리합니다.</p></div>
        <div className="toolbar-actions"><button className="ghost" onClick={() => void load()}><RefreshCw size={16} /> 새로고침</button>{canManageEmployees && <button onClick={openCreate}><Plus size={16} /> 신규 직원</button>}</div>
      </div>
      <div className="employee-filter">
        <label><Search size={16} /><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="이름, 사번, 아이디, 부서 검색" /></label>
        <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">전체 상태</option><option value="ACTIVE">재직</option><option value="LEAVE">휴직</option><option value="RETIRED">퇴직</option></select>
      </div>
      {(message || error) && <p className={error ? "error" : "success"}>{error || message}</p>}
      <div className="table-scroll"><table className="employee-table"><colgroup><col className="employee-col-person" /><col className="employee-col-dept" /><col className="employee-col-work" /><col className="employee-col-status" /><col className="employee-col-account" /><col className="employee-col-permissions" /><col className="employee-col-actions" /></colgroup><thead><tr><th>직원</th><th>부서 / 직급</th><th>고용 / 직군</th><th>재직 상태</th><th>계정</th><th>관리 권한</th><th>작업</th></tr></thead>
        <tbody>{filtered.map((employee) => <tr key={employee.empId}>
          <td><strong>{employee.empName}</strong>{employee.rehired && <em className="status-chip accent">재입사</em>}<small>{employee.empNo} · {employee.genderCode === "FEMALE" ? "여성" : "남성"}</small></td>
          <td>{employee.deptName ?? "미지정"}<small>{employee.positionName ?? employee.jobTitle ?? "-"}</small></td>
          <td>{employee.employmentType === "CONTRACT" ? "계약직" : "정규직"}<small>{employee.employmentStartDate} 입사</small><small>{employee.workCategory === "MANAGEMENT" ? "관리직" : "현장직"}</small></td>
          <td><span className={`status-chip ${employee.status.toLowerCase()}`}>{employee.status === "ACTIVE" ? "재직" : employee.status === "LEAVE" ? "휴직" : "퇴직"}</span></td>
          <td>{employee.loginId ?? "미발급"}<small>{employee.accountStatus}</small></td>
          <td><div className="permission-chips">
            <button disabled={!canGrantPermissions || employee.roleCode === "ADMIN"} className={employee.permissions.includes("FULL_ADMIN") ? "on" : ""} onClick={() => void togglePermission(employee, "FULL_ADMIN")}>전권</button>
            <button disabled={!canGrantPermissions || employee.permissions.includes("FULL_ADMIN")} className={employee.permissions.includes("LEAVE_ADMIN") ? "on" : ""} onClick={() => void togglePermission(employee, "LEAVE_ADMIN")}>휴가관리</button>
            <button disabled={!canGrantPermissions || employee.permissions.includes("FULL_ADMIN")} className={employee.permissions.includes("LEAVE_POLICY_ADMIN") ? "on" : ""} onClick={() => void togglePermission(employee, "LEAVE_POLICY_ADMIN")}>휴가정책</button>
            <button disabled={!canGrantPermissions || employee.permissions.includes("FULL_ADMIN")} className={employee.permissions.includes("EMPLOYEE_ADMIN") ? "on" : ""} onClick={() => void togglePermission(employee, "EMPLOYEE_ADMIN")}>직원관리</button>
            <button disabled={!canGrantPermissions || employee.permissions.includes("FULL_ADMIN")} className={employee.permissions.includes("WORK_CATEGORY_ADMIN") ? "on" : ""} onClick={() => void togglePermission(employee, "WORK_CATEGORY_ADMIN")}>직군관리</button>
            <button disabled={!canGrantPermissions || employee.permissions.includes("FULL_ADMIN")} className={employee.permissions.includes("ACCOUNT_ADMIN") ? "on" : ""} onClick={() => void togglePermission(employee, "ACCOUNT_ADMIN")}>계정관리</button>
          </div></td>
          <td><div className="row-actions">{canEditEmployeeDetails && <button title="상세 정보 수정" onClick={() => openEdit(employee)}><Pencil size={15} /></button>}{canManageEmployees && employee.status === "ACTIVE" && <><button title="휴직" onClick={() => void startLeave(employee)}>휴직</button><button title="퇴직" onClick={() => void retire(employee)}>퇴직</button></>}{canManageEmployees && employee.status === "LEAVE" && <button title="복직" onClick={() => void returnFromLeave(employee)}>복직</button>}{canManageEmployees && employee.status === "RETIRED" && <button title="재입사" onClick={() => void rehire(employee)}>재입사</button>}{canManageAccounts && <button title={employee.loginId ? "비밀번호 초기화" : "계정 발급"} onClick={() => void issueAccount(employee)}>{employee.loginId ? <KeyRound size={15} /> : <UserCheck size={15} />}</button>}</div></td>
        </tr>)}</tbody></table></div>
      {!filtered.length && <p className="empty-state">조건에 맞는 직원이 없습니다.</p>}

      {showForm && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setShowForm(false)}><div className="modal-card employee-form-modal">
        <div className="toolbar"><h3>{editing ? "직원 상세 정보 수정" : "신규 직원 등록"}</h3><button className="ghost" onClick={() => setShowForm(false)}>닫기</button></div>
        <div className="employee-form-grid">
          <label>사번<input value={form.empNo} disabled={Boolean(editing) || profileFieldsDisabled} onChange={(event) => setForm({ ...form, empNo: event.target.value })} /></label>
          <label>이름<input value={form.empName} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, empName: event.target.value })} /></label>
          <label>성별<select value={form.genderCode} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, genderCode: event.target.value as EmployeeForm["genderCode"] })}><option value="MALE">남성</option><option value="FEMALE">여성</option></select></label>
          <label>입사일<input type="date" value={form.hireDate} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, hireDate: event.target.value })} /></label>
          <label>부서<select value={form.deptId} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, deptId: event.target.value })}><option value="">미지정</option>{depts.map((dept) => <option key={dept.deptId} value={dept.deptId}>{dept.deptName}</option>)}</select></label>
          <label>직급<input value={form.positionName} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, positionName: event.target.value })} /></label>
          <label>직무<input value={form.jobTitle} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} /></label>
          <label>상급자<select value={form.managerEmpId} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, managerEmpId: event.target.value })}><option value="">미지정</option>{employees.filter((item) => item.status === "ACTIVE" && item.empId !== editing?.empId).map((item) => <option key={item.empId} value={item.empId}>{item.empName} · {item.deptName ?? "-"}</option>)}</select></label>
          <label>이메일<input type="email" value={form.email} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label>휴대폰 번호<input value={form.phone} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          <label>내선번호<input value={form.extensionNumber} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, extensionNumber: event.target.value })} /></label>
          <label>고용 형태<select value={form.employmentType} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, employmentType: event.target.value as EmployeeForm["employmentType"] })}><option value="REGULAR">정규직</option><option value="CONTRACT">계약직</option></select></label>
          <label>직군<select value={form.workCategory} disabled={!canManageWorkCategory} onChange={(event) => setForm({ ...form, workCategory: event.target.value as EmployeeForm["workCategory"] })}>{!editing && <option value="AUTO">직급 기준 자동</option>}<option value="MANAGEMENT">관리직</option><option value="FIELD">현장직</option></select></label>
          {form.employmentType === "CONTRACT" && <><label>계약 시작일<input required type="date" value={form.contractStartDate} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, contractStartDate: event.target.value })} /></label><label>계약 종료일<input required type="date" min={form.contractStartDate || undefined} value={form.contractEndDate} disabled={profileFieldsDisabled} onChange={(event) => setForm({ ...form, contractEndDate: event.target.value })} /></label></>}
        </div>
        {error && <p className="error">{error}</p>}<div className="actions"><button onClick={() => void save()} disabled={busy}>{busy ? "저장 중..." : "저장"}</button><button className="ghost" onClick={() => setShowForm(false)}>취소</button></div>
      </div></div>}

      {temporary && <div className="modal-backdrop"><div className="modal-card temporary-password"><h3>임시 비밀번호 발급 완료</h3><p>이 값은 지금만 표시됩니다. 직원에게 안전하게 전달하세요.</p><dl><dt>로그인 아이디</dt><dd>{temporary.loginId}</dd><dt>임시 비밀번호</dt><dd><strong>{temporary.temporaryPassword}</strong></dd><dt>만료</dt><dd>{new Date(temporary.expiresAt).toLocaleString("ko-KR")}</dd></dl><button onClick={() => setTemporary(null)}>확인</button></div></div>}
    </section>
  );
}
