import "./rich-text-dom";
import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { PersonalCalendarPage } from "../src/pages/PersonalCalendarPage";

const now = new Date();
const year = now.getFullYear();
const month = now.getMonth();
function date(day: number) {
  return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
}
let failHolidays = false;
let failTrips = false;
let requests: URL[] = [];
beforeEach(() => {
  requests = [];
  failHolidays = false;
  failTrips = false;
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
  mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requests.push(url);
    const path = url.pathname.replace("/api/v1", "");
    if ((path === "/approval-holidays" && failHolidays) || (path === "/business-trips/me" && failTrips)) {
      return Response.json({ success: false, message: "조회 실패" }, { status: 500 });
    }
    const data = path === "/approval-holidays" ? [
      { holidayId: 1, holidayDate: date(15), holidayName: "테스트 공휴일", active: true },
      { holidayId: 2, holidayDate: date(16), holidayName: "비활성 휴일", active: false }
    ] : path === "/business-trips/me" ? [
      { approvalId: 34, title: "부산 출장명령부", destination: "부산", startDate: date(14), endDate: date(16) }
    ] : path === "/approvals/leave-usage/me" ? { selections: [] }
      : path === "/approvals" ? { content: [], totalElements: 0 }
      : path === "/approvals/dashboard" ? { myPendingCount: 0, delegatedPendingCount: 0 }
      : [];
    return Response.json({ success: true, data });
  });
});
afterEach(() => { cleanup(); mock.restoreAll(); });

test("공휴일과 승인 출장을 같은 날짜에 표시하고 출장 필터와 원문 이동을 지원한다", async () => {
  const opened: number[] = [];
  render(<PersonalCalendarPage onOpenApproval={(id) => opened.push(id)} />);
  await screen.findByText("테스트 공휴일");
  assert.equal(screen.queryByText("비활성 휴일"), null);
  const day = screen.getByRole("button", { name: date(15) + ", 테스트 공휴일, 일정 1건, 상세보기" });
  assert.ok(day.classList.contains("holiday"));
  assert.equal(screen.getAllByRole("button", { name: "부산 출장명령부" }).length, 3);
  fireEvent.click(within(day).getByRole("button", { name: "부산 출장명령부" }));
  assert.deepEqual(opened, [34]);
  fireEvent.click(screen.getByRole("button", { name: "출장", exact: true }));
  assert.equal(screen.queryByRole("button", { name: "부산 출장명령부" }), null);
  assert.ok(screen.getByText("테스트 공휴일"));
  fireEvent.click(screen.getByRole("button", { name: "전체 보기" }));
  fireEvent.click(day);
  const dialog = await screen.findByRole("dialog");
  assert.ok(within(dialog).getByText("테스트 공휴일"));
  assert.ok(within(dialog).getByText("부산 출장명령부"));
  assert.ok(requests.find(url => url.pathname.endsWith("/business-trips/me"))?.searchParams.get("from") === date(1));
  const holidayRequest = requests.find(url => url.pathname.endsWith("/approval-holidays"))!;
  assert.ok(holidayRequest.searchParams.get("from")! <= date(1));
  assert.ok(holidayRequest.searchParams.get("to")! >= date(new Date(year, month + 1, 0).getDate()));
});

test("공휴일 조회 실패가 출장 일정을 숨기지 않는다", async () => {
  failHolidays = true;
  render(<PersonalCalendarPage onOpenApproval={() => {}} />);
  assert.match((await screen.findByRole("alert")).textContent || "", /공휴일/);
  assert.equal(screen.getAllByRole("button", { name: "부산 출장명령부" }).length, 3);
});

test("출장 조회 실패가 공휴일을 숨기지 않는다", async () => {
  failTrips = true;
  render(<PersonalCalendarPage onOpenApproval={() => {}} />);
  assert.match((await screen.findByRole("alert")).textContent || "", /출장/);
  assert.ok(screen.getByText("테스트 공휴일"));
});
