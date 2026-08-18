import { useEffect, useState } from "react";
import { Hash, Mail, Phone, Search, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { DeptTree } from "../components/DeptTree";
import { Empty } from "../components/Empty";
import type { GlobalSearchTarget } from "../utils/search";
import type { DeptNode, DirectoryEmployee, PageResponse } from "../types";

type OrganizationPageProps = {
  target: GlobalSearchTarget | null;
};
type EmployeeStatusFilter = "ALL" | "ACTIVE" | "LEAVE" | "RETIRED";

function employeeStatusLabel(status: DirectoryEmployee["status"]) {
  if (status === "ACTIVE") return "재직";
  if (status === "LEAVE") return "휴직";
  return "퇴직";
}

const MANAGEMENT_POSITION_ORDER: Record<string, number> = {
  "대표이사": 0,
  "총괄이사": 1,
  "이사": 2,
  "부장이사": 3,
  "부장": 4,
  "차장": 5,
  "과장": 6,
  "대리": 7,
  "사원": 8
};

const PRODUCTION_POSITION_ORDER: Record<string, number> = {
  "기장": 0,
  "기원": 1,
  "반장": 2,
  "조장": 3,
  "사원": 4
};

function sortEmployees(employees: DirectoryEmployee[]) {
  return [...employees].sort((left, right) => {
    const leftIsProduction = left.jobTitle === "PRODUCTION";
    const rightIsProduction = right.jobTitle === "PRODUCTION";
    if (leftIsProduction !== rightIsProduction) return leftIsProduction ? 1 : -1;

    const orders = leftIsProduction ? PRODUCTION_POSITION_ORDER : MANAGEMENT_POSITION_ORDER;
    const positionDifference = (orders[left.positionName ?? ""] ?? 99) - (orders[right.positionName ?? ""] ?? 99);
    if (positionDifference !== 0) return positionDifference;
    return left.empName.localeCompare(right.empName, "ko") || left.empNo.localeCompare(right.empNo);
  });
}

export function OrganizationPage({ target }: OrganizationPageProps) {
  const [searchParams] = useSearchParams();
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [deptId, setDeptId] = useState<number | null>(() => {
    const value = Number(searchParams.get("deptId"));
    return Number.isFinite(value) && value > 0 ? value : null;
  });
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<EmployeeStatusFilter>("ACTIVE");
  const [emps, setEmps] = useState<DirectoryEmployee[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<DirectoryEmployee | null>(null);

  useEffect(() => {
    void api<DeptNode[]>("/depts/tree").then(setTree);
  }, []);

  async function search(targetDept = deptId) {
    const params = new URLSearchParams({ page: "0", size: "100", status });
    if (keyword) params.set("keyword", keyword);
    if (targetDept) params.set("deptId", String(targetDept));
    const page = await api<PageResponse<DirectoryEmployee>>(`/emps/directory?${params.toString()}`);
    const sorted = sortEmployees(page.content);
    setEmps(sorted);
    setSelectedEmp((current) => sorted.find((employee) => employee.empId === current?.empId) ?? null);
  }

  useEffect(() => {
    void search();
  }, [deptId, status]);

  useEffect(() => {
    if (target?.type === "DEPARTMENT") {
      setDeptId(target.targetId);
      setKeyword("");
      setSelectedEmp(null);
      return;
    }
    if (target?.type === "EMPLOYEE") {
      setDeptId(target.parentId);
      setKeyword(target.keyword);
      const params = new URLSearchParams({ page: "0", size: "100", status: "ACTIVE", keyword: target.keyword });
      if (target.parentId) params.set("deptId", String(target.parentId));
      void api<PageResponse<DirectoryEmployee>>(`/emps/directory?${params.toString()}`).then((page) => {
        const sorted = sortEmployees(page.content);
        setEmps(sorted);
        setSelectedEmp(sorted.find((employee) => employee.empId === target.targetId) ?? null);
      });
    }
  }, [target?.nonce]);

  return (
    <div className="org-layout">
      <div className="panel tree-panel">
        <h3>조직도</h3>
        {tree.map((node) => <DeptTree key={node.deptId} node={node} active={deptId} onSelect={setDeptId} />)}
      </div>
      <div className="panel">
        <div className="searchbar">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="이름, 사번, 이메일, 휴대폰, 내선번호 검색" />
          <select value={status} onChange={(event) => setStatus(event.target.value as EmployeeStatusFilter)} aria-label="재직 상태">
            <option value="ACTIVE">재직</option>
            <option value="LEAVE">휴직</option>
            <option value="RETIRED">퇴직</option>
            <option value="ALL">전체 이력</option>
          </select>
          <button onClick={() => search()}><Search size={16} /> 검색</button>
        </div>
        {selectedEmp && (
          <section className="employee-contact-card" aria-label={`${selectedEmp.empName} 연락처 상세`}>
            <div className="employee-contact-identity">
              <span><UserRound size={25} /></span>
              <div><strong>{selectedEmp.empName}</strong><small>{selectedEmp.deptName ?? "소속 미정"} · {selectedEmp.positionName ?? selectedEmp.jobTitle ?? "직책 미정"}</small></div>
            </div>
            <dl>
              <div><dt><Mail size={15} /> 이메일</dt><dd>{selectedEmp.email ?? "-"}</dd></div>
              <div><dt><Phone size={15} /> 휴대폰</dt><dd>{selectedEmp.phone ?? "-"}</dd></div>
              <div><dt><Hash size={15} /> 내선번호</dt><dd>{selectedEmp.extensionNumber ?? "-"}</dd></div>
            </dl>
          </section>
        )}
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>상태</th>
              <th>부서</th>
              <th>직책</th>
              <th>이메일</th>
              <th>휴대폰</th>
              <th>내선</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((emp) => (
              <tr key={emp.empId} className={selectedEmp?.empId === emp.empId ? "selected" : ""} onClick={() => setSelectedEmp(emp)}>
                <td>{emp.empName}</td>
                <td><span className={`status-chip ${emp.status.toLowerCase()}`}>{employeeStatusLabel(emp.status)}</span></td>
                <td>{emp.deptName ?? "-"}</td>
                <td>{emp.positionName ?? emp.jobTitle ?? "-"}</td>
                <td>{emp.email ?? "-"}</td>
                <td>{emp.phone ?? "-"}</td>
                <td>{emp.extensionNumber ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!emps.length && <Empty text="검색된 직원이 없습니다." />}
      </div>
    </div>
  );
}
