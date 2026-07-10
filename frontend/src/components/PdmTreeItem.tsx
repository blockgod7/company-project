import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import type { PdmTreeNode } from "../utils/pdmTree";

export function PdmTreeItem({ node, selectedId, onSelect, depth = 0 }: { node: PdmTreeNode; selectedId: string; onSelect: (node: PdmTreeNode) => void; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = Boolean(node.children?.length);
  return (
    <div>
      <button className={`pdm-tree-node ${selectedId === node.id ? "active" : ""}`} style={{ paddingLeft: 10 + depth * 14 }} onClick={() => { onSelect(node); if (hasChildren) setOpen(!open); }}>
        {hasChildren ? (open ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="pdm-tree-spacer" />}
        {node.type === "root" || node.type === "company" || node.type === "business" || node.type === "process" ? <Folder size={15} /> : <FileText size={15} />}
        <span>{node.label}</span>
        {hasChildren && <em>{node.children?.length}</em>}
      </button>
      {open && node.children?.map((child) => (
        <PdmTreeItem key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}
