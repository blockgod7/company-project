import { type FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { api, jsonBody } from "../api";

type PasswordChangePageProps = { empName: string; onChanged: () => void; onLogout: () => void };

export function PasswordChangePage({ empName, onChanged, onLogout }: PasswordChangePageProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError("새 비밀번호는 8자 이상이어야 합니다."); return; }
    if (password !== confirm) { setError("비밀번호 확인이 일치하지 않습니다."); return; }
    setBusy(true); setError("");
    try {
      await api<void>("/auth/change-password", { method: "POST", body: jsonBody({ newPassword: password }) });
      onChanged();
    } catch (err) { setError(err instanceof Error ? err.message : "비밀번호를 변경하지 못했습니다."); }
    finally { setBusy(false); }
  }

  return <div className="login-page"><form className="password-change-card" onSubmit={submit}>
    <div className="password-change-icon"><KeyRound size={28} /></div>
    <h1>새 비밀번호 설정</h1>
    <p>{empName}님, 임시 비밀번호를 사용 중입니다.<br />그룹웨어를 이용하기 전에 비밀번호를 변경해 주세요.</p>
    <label>새 비밀번호<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8자 이상" /></label>
    <label>새 비밀번호 확인<input type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
    {error && <p className="error">{error}</p>}
    <button className="primary" type="submit" disabled={busy}>{busy ? "변경 중..." : "비밀번호 변경"}</button>
    <button className="ghost" type="button" onClick={onLogout}>로그아웃</button>
  </form></div>;
}
