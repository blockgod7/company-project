import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { api } from "../api";
import { DeptTree } from "../components/DeptTree";
import { Empty } from "../components/Empty";
import type { GlobalSearchTarget } from "../utils/search";
import type { DeptNode, Employee, PageResponse } from "../types";

type OrganizationPageProps = {
  target: GlobalSearchTarget | null;
};

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

function sortEmployees(employees: Employee[]) {
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
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [emps, setEmps] = useState<Employee[]>([]);

  useEffect(() => {
    void api<DeptNode[]>("/depts/tree").then(setTree);
  }, []);

  async function search(targetDept = deptId) {
    const params = new URLSearchParams({ page: "0", size: "100", status: "ACTIVE" });
    if (keyword) params.set("keyword", keyword);
    if (targetDept) params.set("deptId", String(targetDept));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    setEmps(sortEmployees(page.content));
  }

  useEffect(() => {
    void search();
  }, [deptId]);

  useEffect(() => {
    if (target?.type === "EMPLOYEE") {
      setDeptId(target.parentId);
      setKeyword(target.keyword);
      const params = new URLSearchParams({ page: "0", size: "100", status: "ACTIVE", keyword: target.keyword });
      if (target.parentId) params.set("deptId", String(target.parentId));
      void api<PageResponse<Employee>>(`/emps?${params.toString()}`).then((page) => setEmps(sortEmployees(page.content)));
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
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
          <button onClick={() => search()}><Search size={16} /> 검색</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>부서</th>
              <th>직책</th>
              <th>역할</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {emps.map((emp) => (
              <tr key={emp.empId}>
                <td>{emp.empName}</td>
                <td>{emp.deptName ?? "-"}</td>
                <td>{emp.positionName ?? emp.jobTitle ?? "-"}</td>
                <td>{emp.roleCode}</td>
                <td>{emp.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!emps.length && <Empty text="검색된 직원이 없습니다." />}
      </div>
    </div>
  );
}
