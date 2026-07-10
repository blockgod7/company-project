import type { DeptNode } from "../types";

type DeptTreeProps = {
  node: DeptNode;
  active: number | null;
  onSelect: (id: number) => void;
};

export function DeptTree({ node, active, onSelect }: DeptTreeProps) {
  return (
    <div className="tree-node">
      <button className={active === node.deptId ? "active" : ""} onClick={() => onSelect(node.deptId)}>{node.deptName}</button>
      {node.children.map((child) => <DeptTree key={child.deptId} node={child} active={active} onSelect={onSelect} />)}
    </div>
  );
}
