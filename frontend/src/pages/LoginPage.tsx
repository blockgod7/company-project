import { FormEvent, useEffect, useState } from "react";
import { api, jsonBody } from "../api";
import schunkLogo from "../assets/schunk-carbon-logo.png";
import type { LoginResponse } from "../types";

type LoginOption = {
  loginId: string;
  empName: string;
  deptName?: string | null;
  positionName?: string | null;
  roleCode: string;
};

type LoginPageProps = {
  onLogin: (login: LoginResponse) => void;
  message: string;
};

export function LoginPage({ onLogin, message }: LoginPageProps) {
  const [loginId, setLoginId] = useState("admin");
  const [password, setPassword] = useState("admin1234");
  const [loginOptions, setLoginOptions] = useState<LoginOption[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api<LoginOption[]>("/auth/login-options")
      .then((options) => setLoginOptions(options))
      .catch(() => setLoginOptions([]));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const login = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: jsonBody({ loginId, password })
      });
      onLogin(login);
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-visual">
          <img className="login-logo" src={schunkLogo} alt="SCHUNK Carbon Technology" />
          <h1>SCHUNK Groupware</h1>
          <p>업무, 공지, 게시판, 조직 정보를 한 화면에서 관리합니다.</p>
        </div>
        <div className="login-fields">
          <label>
            테스트 계정
            <select value={loginId} onChange={(event) => {
              setLoginId(event.target.value);
              setPassword("admin1234");
            }}>
              <option value="admin">admin · 관리자</option>
              {loginOptions.filter((option) => option.loginId !== "admin").map((option) => (
                <option key={option.loginId} value={option.loginId}>
                  {option.loginId} · {option.empName} · {option.deptName ?? "-"} · {option.positionName ?? option.roleCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            아이디
            <input value={loginId} onChange={(event) => setLoginId(event.target.value)} />
          </label>
          <label>
            비밀번호
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {(message || error) && <p className="error">{error || message}</p>}
          <button className="primary" type="submit">LOGIN</button>
        </div>
      </form>
    </div>
  );
}
