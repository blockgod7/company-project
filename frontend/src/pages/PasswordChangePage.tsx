import { useState } from "react";
import { KeyRound } from "lucide-react";
import { PasswordChangeForm } from "../components/PasswordChangeForm";

type PasswordChangePageProps = { empName: string; onChanged: () => void; onLogout: () => void };

export function PasswordChangePage({ empName, onChanged, onLogout }: PasswordChangePageProps) {
  const [busy, setBusy] = useState(false);
  return <div className="login-page"><section className="password-change-card">
    <div className="password-change-icon"><KeyRound size={28} /></div>
    <h1>새 비밀번호 설정</h1>
    <p>{empName}님, 임시 비밀번호를 사용 중입니다.<br />현재 비밀번호에 임시 비밀번호를 입력한 뒤 새 비밀번호를 설정해 주세요.</p>
    <PasswordChangeForm onChanged={onChanged} onBusyChange={setBusy} />
    <button className="ghost" type="button" disabled={busy} onClick={onLogout}>로그아웃</button>
  </section></div>;
}
