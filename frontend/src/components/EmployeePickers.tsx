import { useEffect, useState } from "react";
import { Building2, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../api";
import { DeptTree } from "./DeptTree";
import { Empty } from "./Empty";
import type { DeptNode, Employee, PageResponse, User } from "../types";

function clampApprovalSlotCount(count: number) {
  return Math.min(6, Math.max(2, count));
}
export function EmployeeMultiPicker({ title, user, employees, selectedIds, disabledIds, ordered = false, onChange }: {
  title: string;
  user: User;
  employees: Employee[];
  selectedIds: number[];
  disabledIds: number[];
  ordered?: boolean;
  onChange: (ids: number[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker() {
    setOpen(true);
    if (!tree.length) setTree(await api<DeptNode[]>("/depts/tree"));
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "80", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    setCandidates(page.content);
    setKnownEmployees((prev) => mergeEmployees(prev, page.content));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function add(employee: Employee) {
    if (selectedIds.includes(employee.empId)) {
      remove(employee.empId);
      return;
    }
    if (disabledIds.includes(employee.empId)) return;
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange([...selectedIds, employee.empId]);
  }

  function remove(empId: number) {
    onChange(selectedIds.filter((id) => id !== empId));
  }

  function move(empId: number, direction: -1 | 1) {
    const index = selectedIds.indexOf(empId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="line-picker-card">
      <div className="panel-head">
        <h3>{title}</h3>
        <button type="button" onClick={openPicker}><Building2 size={16} /> 선택</button>
      </div>
      {selectedIds.length ? selectedIds.map((id, index) => {
        const employee = knownEmployees.find((item) => item.empId === id);
        return (
          <div className="selected-approver" key={id}>
            <strong>{ordered ? `${index + 1}. ` : ""}{employee?.empName ?? id}</strong>
            <span>{employee?.deptName ?? "-"} · {employee?.positionName ?? "-"}</span>
            <div>
              {ordered && <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>위</button>}
              {ordered && <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>아래</button>}
              <button type="button" onClick={() => remove(id)}>삭제</button>
            </div>
          </div>
        );
      }) : <Empty text={`${title}를 선택하세요.`} />}
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label={`${title} 선택`}>
            <div className="modal-head">
              <h3>{title} 선택</h3>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">{tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}</div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => {
                    const disabled = disabledIds.includes(employee.empId);
                    const selfBlocked = (title === "합의자" || title === "경유/협조" || title === "결재자") && employee.empId === user.empId;
                    return (
                      <button key={employee.empId} type="button" disabled={disabled || selfBlocked} className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => add(employee)}>
                        <strong>{employee.empName}</strong>
                        <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>선택된 {title}</h3>
                {selectedIds.length ? selectedIds.map((id, index) => {
                  const employee = knownEmployees.find((item) => item.empId === id);
                  return <div className="selected-approver" key={id}><strong>{ordered ? `${index + 1}. ` : ""}{employee?.empName ?? id}</strong><span>{employee?.deptName ?? "-"}</span></div>;
                }) : <Empty text="선택된 직원이 없습니다." />}
                <button type="button" className="primary" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}>적용</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ApproverPicker({ employees, selectedIds, onChange }: { employees: Employee[]; selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker() {
    setOpen(true);
    if (!tree.length) {
      const data = await api<DeptNode[]>("/depts/tree");
      setTree(data);
    }
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "50", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    const next = page.content;
    setCandidates(next);
    setKnownEmployees((prev) => mergeEmployees(prev, next));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function add(employee: Employee) {
    if (selectedIds.includes(employee.empId)) {
      remove(employee.empId);
      return;
    }
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange([...selectedIds, employee.empId]);
  }

  function remove(empId: number) {
    onChange(selectedIds.filter((id) => id !== empId));
  }

  function move(empId: number, direction: -1 | 1) {
    const index = selectedIds.indexOf(empId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= selectedIds.length) return;
    const next = [...selectedIds];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="approver-picker">
      <div className="panel-head">
        <h3>결재선</h3>
        <button type="button" onClick={openPicker}><Building2 size={16} /> 결재라인 구성</button>
      </div>
      {selectedIds.length ? (
        <div className="approval-path">
          {selectedIds.map((id, index) => {
            const employee = knownEmployees.find((item) => item.empId === id);
            return (
              <span key={id}>
                {index + 1}. {employee?.empName ?? id}
                <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>↑</button>
                <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>↓</button>
                <button type="button" onClick={() => remove(id)}>×</button>
              </span>
            );
          })}
        </div>
      ) : <Empty text="결재자를 순서대로 선택해 주세요." />}
      {open && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label="결재라인 구성">
            <div className="modal-head">
              <h3>결재라인 구성</h3>
              <button type="button" className="icon-button" onClick={() => setOpen(false)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">
                {tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}
              </div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => (
                    <button key={employee.empId} type="button" className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => add(employee)}>
                      <strong>{employee.empName}</strong>
                      <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>선택된 결재선</h3>
                {selectedIds.length ? selectedIds.map((id, index) => {
                  const employee = knownEmployees.find((item) => item.empId === id);
                  return (
                    <div className="selected-approver" key={id}>
                      <strong>{index + 1}. {employee?.empName ?? id}</strong>
                      <span>{employee?.deptName ?? "-"}</span>
                      <div>
                        <button type="button" onClick={() => move(id, -1)} disabled={index === 0}>↑</button>
                        <button type="button" onClick={() => move(id, 1)} disabled={index === selectedIds.length - 1}>↓</button>
                        <button type="button" onClick={() => remove(id)}>삭제</button>
                      </div>
                    </div>
                  );
                }) : <Empty text="선택된 결재자가 없습니다." />}
                <button type="button" className="primary" onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}>적용</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function mergeEmployees(current: Employee[], next: Employee[]) {
  const byId = new Map(current.map((employee) => [employee.empId, employee]));
  next.forEach((employee) => byId.set(employee.empId, employee));
  return Array.from(byId.values());
}

export function ApprovalLineTableEditor({
  user,
  employees,
  selectedIds,
  slotCount,
  onSlotCountChange,
  onChange
}: {
  user: User;
  employees: Employee[];
  selectedIds: number[];
  slotCount: number;
  onSlotCountChange: (count: number) => void;
  onChange: (ids: number[]) => void;
}) {
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [tree, setTree] = useState<DeptNode[]>([]);
  const [activeDeptId, setActiveDeptId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [candidates, setCandidates] = useState<Employee[]>(employees);
  const [knownEmployees, setKnownEmployees] = useState<Employee[]>(employees);
  const safeSlotCount = clampApprovalSlotCount(Math.max(slotCount, selectedIds.length + 1));
  const approverSlotCount = safeSlotCount - 1;

  useEffect(() => {
    setCandidates(employees);
    setKnownEmployees((prev) => mergeEmployees(prev, employees));
  }, [employees]);

  async function openPicker(slotIndex: number) {
    setOpenSlot(slotIndex);
    if (!tree.length) {
      const data = await api<DeptNode[]>("/depts/tree");
      setTree(data);
    }
    await search();
  }

  async function search(targetDeptId = activeDeptId) {
    const params = new URLSearchParams({ page: "0", size: "50", status: "ACTIVE" });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (targetDeptId) params.set("deptId", String(targetDeptId));
    const page = await api<PageResponse<Employee>>(`/emps?${params.toString()}`);
    const next = page.content.filter((employee) => employee.empId !== user.empId);
    setCandidates(next);
    setKnownEmployees((prev) => mergeEmployees(prev, next));
  }

  async function selectDept(deptId: number) {
    setActiveDeptId(deptId);
    await search(deptId);
  }

  function assign(employee: Employee) {
    if (openSlot === null) return;
    if (selectedIds[openSlot] === employee.empId) {
      clearSlot(openSlot);
      setOpenSlot(null);
      return;
    }
    const next = selectedIds.filter((id, index) => id !== employee.empId || index === openSlot);
    next[openSlot] = employee.empId;
    setKnownEmployees((prev) => mergeEmployees(prev, [employee]));
    onChange(next.filter((id): id is number => typeof id === "number"));
    onSlotCountChange(clampApprovalSlotCount(Math.max(safeSlotCount, openSlot + 2)));
    setOpenSlot(null);
  }

  function clearSlot(slotIndex: number) {
    const next = selectedIds.slice();
    next.splice(slotIndex, 1);
    onChange(next);
    onSlotCountChange(clampApprovalSlotCount(Math.max(2, safeSlotCount - 1, next.length + 1)));
  }

  function addSlot() {
    onSlotCountChange(clampApprovalSlotCount(safeSlotCount + 1));
  }

  function removeLastSlot() {
    const nextCount = clampApprovalSlotCount(safeSlotCount - 1);
    onChange(selectedIds.slice(0, nextCount - 1));
    onSlotCountChange(nextCount);
  }

  const slots = Array.from({ length: approverSlotCount }, (_, index) => {
    const employee = knownEmployees.find((item) => item.empId === selectedIds[index]);
    return { index, employee };
  });

  return (
    <div className="approval-line-editor">
      <div className="approval-line-editor-head">
        <h3>결재표</h3>
        <div className="actions">
          <button type="button" className="ghost" onClick={removeLastSlot} disabled={safeSlotCount <= 2}><Trash2 size={15} /> 결재 삭제</button>
          <button type="button" onClick={addSlot} disabled={safeSlotCount >= 6}><Plus size={15} /> 결재 추가</button>
        </div>
      </div>
      <div className="approval-stamp-wrap approval-stamp-editor">
        <div className="approval-stamp-label">결재</div>
        <div className="approval-stamp-table">
          <div className="approval-stamp-column requester">
            <div className="stamp-position">작성자</div>
            <div className="stamp-signature">{user.empName}</div>
            <div className="stamp-date"></div>
          </div>
          {slots.map(({ index, employee }) => (
            <div className="approval-stamp-column editable" key={index}>
              <div className="stamp-position">{employee?.positionName ?? `결재 ${index + 1}`}</div>
              <button type="button" className="stamp-signature stamp-signature-button" onClick={() => openPicker(index)}>
                {employee?.empName ?? "선택"}
              </button>
              <div className="stamp-date">
                {employee ? "클릭하여 변경" : "클릭하여 지정"}
                {employee && <button type="button" className="stamp-clear" onClick={() => clearSlot(index)}>삭제</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {openSlot !== null && (
        <div className="modal-backdrop" role="presentation">
          <div className="org-picker-modal" role="dialog" aria-modal="true" aria-label="결재자 선택">
            <div className="modal-head">
              <h3>{openSlot + 1}번 결재자 선택</h3>
              <button type="button" className="icon-button" onClick={() => setOpenSlot(null)} title="닫기"><X size={18} /></button>
            </div>
            <div className="org-picker-layout">
              <div className="org-picker-tree">
                {tree.map((node) => <DeptTree key={node.deptId} node={node} active={activeDeptId} onSelect={selectDept} />)}
              </div>
              <div className="org-picker-results">
                <div className="searchbar">
                  <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="직원명, 아이디, 사번 검색" />
                  <button type="button" onClick={() => search()}><Search size={16} /> 검색</button>
                </div>
                <div className="employee-result-list">
                  {candidates.map((employee) => (
                    <button key={employee.empId} type="button" className={selectedIds.includes(employee.empId) ? "active" : ""} onClick={() => assign(employee)}>
                      <strong>{employee.empName}</strong>
                      <span>{employee.deptName ?? "-"} · {employee.positionName ?? employee.jobTitle ?? employee.roleCode}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="org-picker-selected">
                <h3>현재 결재표</h3>
                {slots.map(({ index, employee }) => (
                  <div className="selected-approver" key={index}>
                    <strong>{index + 1}. {employee?.empName ?? "미지정"}</strong>
                    <span>{employee?.deptName ?? "-"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
