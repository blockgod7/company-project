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

export function OrganizationPage({ target }: OrganizationPageProps) {
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [deptId, setDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [emps, setEmps] = useState<Employee[]>([]);

  useEffect(() => {
    void api<DeptNode[]>("/depts/tree").then(setTree);
  }, []);

  async function search(targetDept = deptId) {
    const params = new URLSearchParams({ page: "0", size: "20", status: "ACTIVE" });
    if (keyword) params.set("keyword", keyword);
    if (targetDept) params.set("deptId", String(targetDept));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    setEmps(page.content);
  }

  useEffect(() => {
    void search();
  }, [deptId]);

  useEffect(() => {
    if (target?.type === "EMPLOYEE") {
      setDeptId(target.parentId);
      setKeyword(target.keyword);
      const params = new URLSearchParams({ page: "0", size: "20", status: "ACTIVE", keyword: target.keyword });
      if (target.parentId) params.set("deptId", String(target.parentId));
      void api<PageResponse<Employee>>(`/emps?${params.toString()}`).then((page) => setEmps(page.content));
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
