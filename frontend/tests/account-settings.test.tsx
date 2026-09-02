import "./rich-text-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React, { StrictMode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App";
import { AccountSettingsDialog } from "../src/components/AccountSettingsDialog";
import { PasswordChangeForm } from "../src/components/PasswordChangeForm";
import type { MyProfile, User } from "../src/types";

const account: User = { empId: 7, loginId: "profile-test", empName: "테스트 직원", genderCode: "FEMALE", roleCode: "USER", deptId: 2, deptName: "생산기술팀", permissions: [] };
const requests: { path: string; method: string; body?: Record<string, unknown> }[] = [];
let profile: MyProfile;
let profileLoadFails = false;
let saveFails = false;
let passwordFails = false;
let mustChangePassword = false;

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  localStorage.clear(); requests.length = 0;
  profileLoadFails = false; saveFails = false; passwordFails = false; mustChangePassword = false;
  profile = { loginId: account.loginId, empNo: "QA-7", empName: account.empName, deptName: account.deptName,
    positionName: "대리", jobTitle: "팀원", email: "before@example.test", phone: "010-0000-0000", extensionNumber: "101" };
  // JSDOM has no top-layer implementation. Browser focus trapping belongs to native <dialog>.
  Object.defineProperty(window.HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) {
    this.open = true; this.querySelector<HTMLButtonElement>("button")?.focus();
  } });
  Object.defineProperty(window.HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const path = new URL(String(input)).pathname.replace("/api/v1", "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ path, method, body });
    if (path === "/auth/profile") {
      if (method === "GET" && profileLoadFails) return Response.json({ success: false, message: "불러오기 실패" }, { status: 500 });
      if (method === "PUT") {
        if (saveFails) return Response.json({ success: false, message: "저장 실패" }, { status: 500 });
        profile = { ...profile, ...body };
      }
      return Response.json({ success: true, data: profile });
    }
    if (path === "/auth/change-password" && passwordFails) {
      return Response.json({ success: false, code: "CURRENT_PASSWORD_MISMATCH", message: "현재 비밀번호가 일치하지 않습니다." }, { status: 400 });
    }
    const data = path === "/auth/me" ? { ...account, mustChangePassword } :
      path === "/auth/login" ? { ...account, mustChangePassword, accessToken: "fixture-token" } :
      path === "/notices" || path === "/notifications" ? { content: [], totalPages: 0, totalElements: 0 } :
      path === "/approvals/dashboard" ? null : [];
    return Response.json({ success: true, data });
  });
});
afterEach(() => { cleanup(); mock.restoreAll(); localStorage.clear(); });

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="location">{location.pathname}</output>
    <button onClick={() => navigate("/portal/employee/notices")}>테스트 메뉴 이동</button></>;
}
function renderApp(initial = "/portal/employee/boards", strict = false) {
  const contents = <MemoryRouter initialEntries={[{ pathname: initial, state: { from: "/portal/admin/approvals" } }]}>
    <App /><LocationProbe />
  </MemoryRouter>;
  return render(strict ? <StrictMode>{contents}</StrictMode> : contents);
}
async function waitForPath(path: string) {
  await waitFor(() => assert.equal(screen.getByTestId("location").textContent, path));
}
function setPassword(current = "Fixture-before-1", next = "Fixture-after-1", confirm = next) {
  fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("새 비밀번호", { exact: true }), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: confirm } });
}
function submitPassword() {
  fireEvent.submit(screen.getByLabelText("현재 비밀번호").closest("form")!);
}

test("explicit login ignores previous route and returns home, then normal navigation stays put", async () => {
  renderApp("/login");
  fireEvent.change(await screen.findByLabelText("아이디"), { target: { value: account.loginId } });
  fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), { target: { value: "Fixture-before-1" } });
  fireEvent.click(screen.getByRole("button", { name: "LOGIN" }));
  await waitForPath("/portal/employee/home");
  fireEvent.click(screen.getByRole("button", { name: "테스트 메뉴 이동" }));
  await waitForPath("/portal/employee/notices");
  await waitFor(() => assert.ok(requests.some((request) => request.path === "/notices")));
  assert.equal(requests.filter((request) => request.path === "/auth/me").length, 0);
  assert.equal(screen.getByTestId("location").textContent, "/portal/employee/notices");
});

test("restored session starts home even when an old URL was retained (including StrictMode)", async () => {
  localStorage.setItem("accessToken", "fixture-token");
  renderApp("/portal/admin/approvals", true);
  assert.ok(screen.getByText("인증 상태를 확인하고 있습니다."));
  await waitForPath("/portal/employee/home");
  assert.ok(await screen.findByText("내 근무 일정"));
});

test("both displayed names open own information; save, close and reopen preserve contact changes", async () => {
  localStorage.setItem("accessToken", "fixture-token"); renderApp();
  const openers = await screen.findAllByRole("button", { name: "테스트 직원 내 정보 설정" });
  assert.equal(openers.length, 2);
  openers[1].focus(); fireEvent.click(openers[1]);
  const email = await screen.findByLabelText("이메일");
  assert.equal((email as HTMLInputElement).value, "before@example.test");
  const dialog = screen.getByRole("dialog", { name: "내 정보 설정" });
  assert.ok(within(dialog).getByText("생산기술팀"));
  assert.equal(within(dialog).queryByRole("textbox", { name: "이름" }) === null, true);
  fireEvent.change(email, { target: { value: "new@example.test" } });
  fireEvent.change(screen.getByLabelText("내선번호"), { target: { value: " 202 " } });
  fireEvent.click(screen.getByRole("button", { name: "개인정보 저장" }));
  await screen.findByText("개인정보를 저장했습니다.");
  assert.deepEqual(requests.find((request) => request.method === "PUT")?.body,
    { email: "new@example.test", phone: "010-0000-0000", extensionNumber: "202" });
  fireEvent.click(screen.getByRole("button", { name: "내 정보 설정 닫기" }));
  assert.equal(document.activeElement === openers[1], true);
  fireEvent.click(openers[0]);
  assert.equal(((await screen.findByLabelText("이메일")) as HTMLInputElement).value, "new@example.test");
});

test("profile load and save failures remain recoverable without losing edits", async () => {
  profileLoadFails = true;
  render(<AccountSettingsDialog onClose={() => {}} onPasswordChanged={() => {}} />);
  await screen.findByText("불러오기 실패");
  profileLoadFails = false; fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
  fireEvent.change(await screen.findByLabelText("연락처"), { target: { value: "010-1111-2222" } });
  saveFails = true; fireEvent.click(screen.getByRole("button", { name: "개인정보 저장" }));
  await screen.findByText("저장 실패");
  assert.equal((screen.getByLabelText("연락처") as HTMLInputElement).value, "010-1111-2222");
  saveFails = false; fireEvent.click(screen.getByRole("button", { name: "개인정보 저장" }));
  await screen.findByText("개인정보를 저장했습니다.");
});

test("password confirmation and byte limit fail locally without a write", async () => {
  render(<PasswordChangeForm onChanged={() => assert.fail("must not change password")} />);
  setPassword("Fixture-before-1", "Fixture-after-1", "different"); submitPassword();
  await screen.findByText("비밀번호 확인이 일치하지 않습니다.");
  setPassword("Fixture-before-1", "가".repeat(25)); submitPassword();
  await screen.findByText("새 비밀번호는 8자 이상, UTF-8 기준 72바이트 이하여야 합니다.");
  assert.equal(requests.length, 0);
});

test("wrong current password displays server error without expiring login and allows retry", async () => {
  let changed = false; passwordFails = true;
  render(<PasswordChangeForm onChanged={() => { changed = true; }} />);
  setPassword(); submitPassword();
  await screen.findByText("현재 비밀번호가 일치하지 않습니다.");
  assert.equal(changed, false);
  assert.equal(requests.some((request) => request.path === "/auth/refresh"), false);
  passwordFails = false; submitPassword();
  await waitFor(() => assert.equal(changed, true));
  assert.deepEqual(requests[0].body, { currentPassword: "Fixture-before-1", newPassword: "Fixture-after-1" });
});

test("successful password change logs out and tells the user to sign in with the new password", async () => {
  localStorage.setItem("accessToken", "fixture-token"); renderApp();
  fireEvent.click((await screen.findAllByRole("button", { name: "테스트 직원 내 정보 설정" }))[1]);
  await screen.findByLabelText("이메일");
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경", exact: true }));
  setPassword(); submitPassword();
  await waitForPath("/login");
  assert.equal(localStorage.getItem("accessToken"), null);
  assert.ok(await screen.findByText("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요."));
  assert.equal(screen.queryByRole("dialog") === null, true);
});

test("temporary-password flow also verifies current password and requires sign-in again", async () => {
  mustChangePassword = true; localStorage.setItem("accessToken", "fixture-token"); renderApp();
  await screen.findByRole("heading", { name: "새 비밀번호 설정" });
  setPassword(); submitPassword();
  await waitForPath("/login");
  assert.equal(localStorage.getItem("accessToken"), null);
  assert.ok(await screen.findByText("비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해 주세요."));
});

test("pending profile save prevents duplicate submissions and Escape dismissal", async () => {
  let closeCount = 0;
  render(<AccountSettingsDialog onClose={() => { closeCount++; }} onPasswordChanged={() => {}} />);
  await screen.findByLabelText("이메일");
  let finish!: (value: Response) => void;
  let writes = 0;
  mock.method(globalThis, "fetch", () => { writes++; return new Promise<Response>((resolve) => { finish = resolve; }); });
  const form = screen.getByLabelText("이메일").closest("form")!;
  fireEvent.submit(form); fireEvent.submit(form);
  assert.equal(writes, 1);
  assert.equal((screen.getByRole("button", { name: "내 정보 설정 닫기" }) as HTMLButtonElement).disabled, true);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  assert.equal(closeCount, 0);
  await act(async () => { finish(Response.json({ success: true, data: profile })); });
  await screen.findByText("개인정보를 저장했습니다.");
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  assert.equal(closeCount, 1);
});
