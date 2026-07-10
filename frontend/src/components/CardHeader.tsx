import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CardHeaderProps = {
  title: string;
  action?: string;
  icon: LucideIcon;
  onAction?: () => void;
};

export function CardHeader({ title, action, icon: Icon, onAction }: CardHeaderProps) {
  return (
    <div className="card-head">
      <h3><Icon size={18} /> {title}</h3>
      {action && (
        <button onClick={onAction} disabled={!onAction}>
          {action} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}
