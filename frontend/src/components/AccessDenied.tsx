import { Shield } from "lucide-react";

export function AccessDenied() {
  return (
    <div className="panel access-denied">
      <Shield />
      <h3>접근 권한이 없습니다.</h3>
    </div>
  );
}
