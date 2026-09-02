import { type FormEvent, useId, useState } from "react";
import { api, jsonBody } from "../api";

export function PasswordChangeForm({ onChanged, onBusyChange }: {
  onChanged: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const id = useId();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!currentPassword) { setError("현재 비밀번호를 입력해 주세요."); return; }
    if (newPassword.trim().length === 0 || newPassword.length < 8 || new TextEncoder().encode(newPassword).length > 72) {
      setError("새 비밀번호는 8자 이상, UTF-8 기준 72바이트 이하여야 합니다."); return;
    }
    if (newPassword === currentPassword) { setError("현재 비밀번호와 다른 새 비밀번호를 입력해 주세요."); return; }
    if (newPassword !== confirm) { setError("비밀번호 확인이 일치하지 않습니다."); return; }
    setBusy(true); onBusyChange?.(true); setError("");
    try {
      await api<void>("/auth/change-password", { method: "POST", body: jsonBody({ currentPassword, newPassword }) });
      setCurrentPassword(""); setNewPassword(""); setConfirm("");
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "비밀번호를 변경하지 못했습니다.");
    } finally {
      setBusy(false); onBusyChange?.(false);
    }
  }

  return <form className="account-form" onSubmit={submit} aria-busy={busy}>
    <p className="account-hint" id={`${id}-hint`}>8자 이상으로 입력해 주세요. 변경 후에는 새 비밀번호로 다시 로그인합니다.</p>
    <fieldset disabled={busy}>
      <label>현재 비밀번호<input type="password" autoComplete="current-password" required maxLength={100}
        value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label>
      <label>새 비밀번호<input type="password" autoComplete="new-password" required minLength={8} maxLength={72}
        aria-describedby={`${id}-hint`} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
      <label>새 비밀번호 확인<input type="password" autoComplete="new-password" required maxLength={72}
        value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
    </fieldset>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="account-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "변경 중…" : "비밀번호 변경"}</button></div>
  </form>;
}
