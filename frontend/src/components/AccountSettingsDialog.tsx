import { KeyRound, UserRound, X } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { api, jsonBody } from "../api";
import type { MyProfile } from "../types";
import { PasswordChangeForm } from "./PasswordChangeForm";

export function AccountSettingsDialog({ onClose, onPasswordChanged }: {
  onClose: () => void;
  onPasswordChanged: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [section, setSection] = useState<"profile" | "password">("profile");
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const opener = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => { dialog.close(); opener?.focus(); };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api<MyProfile>("/auth/profile", { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setProfile(result); })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "개인정보를 불러오지 못했습니다."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  function changeContact(field: "email" | "phone" | "extensionNumber", value: string) {
    setProfile((current) => current ? { ...current, [field]: value } : current);
    setSaved(false);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!profile || busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const updated = await api<MyProfile>("/auth/profile", { method: "PUT", body: jsonBody({
        email: profile.email?.trim() || null,
        phone: profile.phone?.trim() || null,
        extensionNumber: profile.extensionNumber?.trim() || null
      }) });
      setProfile(updated); setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "개인정보를 저장하지 못했습니다.");
    } finally { setBusy(false); }
  }

  return <dialog ref={dialogRef} className="account-dialog" aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header className="account-dialog-head">
      <div><h2 id={titleId}>내 정보 설정</h2><p>연락처와 로그인 비밀번호를 관리합니다.</p></div>
      <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="내 정보 설정 닫기"><X size={20} /></button>
    </header>
    <div className="account-section-switch" role="group" aria-label="설정 항목">
      <button type="button" aria-pressed={section === "profile"} disabled={busy} onClick={() => setSection("profile")}><UserRound size={17} />개인정보 수정</button>
      <button type="button" aria-pressed={section === "password"} disabled={busy} onClick={() => setSection("password")}><KeyRound size={17} />비밀번호 변경</button>
    </div>
    {section === "profile" ? <>
      {loading && <p role="status">개인정보를 불러오는 중입니다.</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {!loading && !profile && <button type="button" className="ghost" onClick={() => setReload((value) => value + 1)}>다시 불러오기</button>}
      {profile && !loading && <form className="account-form" onSubmit={save} aria-busy={busy}>
        <dl className="account-identity">
          <div><dt>이름</dt><dd>{profile.empName}</dd></div>
          <div><dt>아이디</dt><dd>{profile.loginId}</dd></div>
          <div><dt>사번</dt><dd>{profile.empNo || "—"}</dd></div>
          <div><dt>부서</dt><dd>{profile.deptName || "—"}</dd></div>
          <div><dt>직급</dt><dd>{profile.positionName || "—"}</dd></div>
          <div><dt>직책</dt><dd>{profile.jobTitle || "—"}</dd></div>
        </dl>
        <p className="account-hint">이름·부서·직급 등 인사정보 변경은 관리자에게 요청해 주세요. 아래 연락처는 사내 조직도에도 반영됩니다.</p>
        <fieldset disabled={busy}>
          <label>이메일<input type="email" autoComplete="email" maxLength={150} value={profile.email ?? ""} onChange={(event) => changeContact("email", event.target.value)} /></label>
          <div className="account-contact-row">
            <label>연락처<input type="tel" autoComplete="tel" maxLength={50} value={profile.phone ?? ""} onChange={(event) => changeContact("phone", event.target.value)} /></label>
            <label>내선번호<input type="tel" maxLength={20} value={profile.extensionNumber ?? ""} onChange={(event) => changeContact("extensionNumber", event.target.value)} /></label>
          </div>
        </fieldset>
        {saved && <p className="account-success" role="status">개인정보를 저장했습니다.</p>}
        <div className="account-actions"><button className="primary" type="submit" disabled={busy}>{busy ? "저장 중…" : "개인정보 저장"}</button></div>
      </form>}
    </> : <PasswordChangeForm onChanged={onPasswordChanged} onBusyChange={setBusy} />}
  </dialog>;
}
