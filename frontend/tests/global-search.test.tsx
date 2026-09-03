import "./rich-text-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useGlobalSearch } from "../src/hooks/useGlobalSearch";
import { GlobalSearchPage } from "../src/pages/GlobalSearchPage";
import type { GlobalSearchItem, GlobalSearchResponse } from "../src/types";

const requests: URL[] = [];
const titles = { ALL: "승인 문서", APPROVED: "승인 문서", REJECTED: "반려 문서", PLANNED: "예정 메뉴" };
function response(status = "ALL", types = ["approvals", "menus"]): GlobalSearchResponse {
  const code = status === "PLANNED" ? "menus" : "approvals";
  const item: GlobalSearchItem = { type: code === "menus" ? "MENU" : "APPROVAL", targetId: 1, parentId: null,
    route: code === "menus" ? "menu" : "approvals", title: titles[status as keyof typeof titles], summary: null, meta: null,
    badges: [status], occurredAt: null, destinationPath: null };
  return { keyword: "김종현", groups: types.includes(code) ? [{ code, label: code === "menus" ? "메뉴 결과" : "결재 결과", totalCount: 1, items: [item] }] : [], failedProviders: [] };
}
function Harness() {
  const search = useGlobalSearch({ clearApprovalLaunch: () => {}, navigateToRoute: () => {}, navigateToItem: () => {} });
  return <GlobalSearchPage {...search} onSubmit={search.submit} onOpen={search.openItem} onClear={search.clear} onToggleType={search.toggleType} onStatusChange={search.setStatus} />;
}
function submit() {
  fireEvent.change(screen.getByPlaceholderText("직원명, 문서제목 검색"), { target: { value: "김종현" } });
  fireEvent.click(screen.getByRole("button", { name: "검색", exact: true }));
}
function deferRequests() {
  const pending: { resolve: (value: Response) => void; reject: (reason: Error) => void }[] = [];
  mock.method(globalThis, "fetch", (input: string | URL | Request) => {
    requests.push(new URL(String(input)));
    // Ignore abort deliberately: a late response still must not replace current results.
    return new Promise<Response>((resolve, reject) => pending.push({ resolve, reject }));
  });
  return pending;
}
beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  requests.length = 0;
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input)); requests.push(url);
    return Response.json({ success: true, data: response(url.searchParams.get("status") ?? "ALL", url.searchParams.getAll("types")) });
  });
});
afterEach(() => { cleanup(); mock.restoreAll(); });

test("changing status and type immediately requests and displays the chosen filters without another submit", async () => {
  render(<Harness />); submit();
  await screen.findByText("승인 문서");
  fireEvent.change(screen.getByRole("combobox", { name: "상태 필터" }), { target: { value: "PLANNED" } });
  assert.equal(screen.queryByText("승인 문서"), null);
  await screen.findByText("예정 메뉴");
  assert.equal(requests.at(-1)?.searchParams.get("status"), "PLANNED");
  fireEvent.click(screen.getByRole("button", { name: "메뉴", exact: true }));
  await screen.findByText("검색 결과가 없습니다.");
  assert.equal(screen.queryByText("예정 메뉴"), null);
  assert.equal(requests.at(-1)?.searchParams.getAll("types").includes("menus"), false);
  assert.equal(screen.getByRole("button", { name: "메뉴", exact: true }).getAttribute("aria-pressed"), "false");
});

test("only the newest filter response can update results", async () => {
  const pending = deferRequests(); render(<Harness />); submit();
  fireEvent.change(screen.getByRole("combobox", { name: "상태 필터" }), { target: { value: "REJECTED" } });
  assert.equal(pending.length, 2);
  await act(async () => pending[1].resolve(Response.json({ success: true, data: response("REJECTED") })));
  await screen.findByText("반려 문서");
  await act(async () => pending[0].resolve(Response.json({ success: true, data: response("APPROVED") })));
  assert.ok(screen.getByText("반려 문서"));
  assert.equal(screen.queryByText("승인 문서"), null);
});

test("stale request errors cannot stop or replace an active filtered search", async () => {
  const pending = deferRequests(); render(<Harness />); submit();
  fireEvent.change(screen.getByRole("combobox", { name: "상태 필터" }), { target: { value: "PLANNED" } });
  await act(async () => pending[0].reject(new Error("이전 요청 오류")));
  assert.equal(screen.queryByText("이전 요청 오류"), null);
  assert.ok((screen.getByRole("button", { name: "검색 중" }) as HTMLButtonElement).disabled);
  await act(async () => pending[1].resolve(Response.json({ success: true, data: response("PLANNED") })));
  await screen.findByText("예정 메뉴");
});

test("clearing a search invalidates pending responses and keeps results empty", async () => {
  const pending = deferRequests(); render(<Harness />); submit();
  fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
  await act(async () => pending[0].resolve(Response.json({ success: true, data: response() })));
  assert.equal(screen.queryByText("승인 문서"), null);
  assert.equal((screen.getByPlaceholderText("직원명, 문서제목 검색") as HTMLInputElement).value, "");
  assert.ok(!(screen.getByRole("button", { name: "검색", exact: true }) as HTMLButtonElement).disabled);
});

test("deselecting every type shows a selection prompt instead of requesting the server's all-types default", async () => {
  render(<Harness />); submit(); await screen.findByText("승인 문서");
  for (const label of ["메뉴", "부서", "직원", "공지", "게시글", "결재·휴가"]) {
    fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
  }
  await waitFor(() => assert.ok(screen.getByText("검색할 자료 종류를 하나 이상 선택해 주세요.")));
  assert.ok(requests.every((url) => url.searchParams.getAll("types").length > 0));
  assert.equal(screen.queryByText("승인 문서"), null);
  fireEvent.click(screen.getByRole("button", { name: "결재·휴가", exact: true }));
  await screen.findByText("승인 문서");
  assert.deepEqual(requests.at(-1)?.searchParams.getAll("types"), ["approvals"]);
});

test("filters before the first search do not request a blank keyword", () => {
  render(<Harness />);
  fireEvent.change(screen.getByRole("combobox", { name: "상태 필터" }), { target: { value: "PLANNED" } });
  fireEvent.click(screen.getByRole("button", { name: "부서", exact: true }));
  assert.equal(requests.length, 0);
  assert.equal(screen.queryByText("검색어는 2글자 이상 입력해 주세요."), null);
});
