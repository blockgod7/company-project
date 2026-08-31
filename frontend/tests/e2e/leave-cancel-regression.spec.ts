import { expect, test, type Page } from "@playwright/test";

const loginId = process.env.E2E_LOGIN_ID;
const password = process.env.E2E_PASSWORD;
const fallbackTestLoginId = process.env.E2E_TEST_LOGIN_ID ?? "e7012";

type MockSelection = {
  date: string;
  type: string;
  days: string;
  approvalId: number | null;
  documentNo: string | null;
};

function localDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function usageResponse(selections: MockSelection[], pendingCancelSelections: MockSelection[] = [], balanceYear = new Date().getFullYear()) {
  return {
    success: true,
    code: "OK",
    message: null,
    data: {
      usedAnnualDays: "1",
      reservedAnnualDays: "0",
      totalAnnualDays: balanceYear === new Date().getFullYear() ? "22" : "12",
      remainingAnnualDays: balanceYear === new Date().getFullYear() ? "21" : "11",
      selections,
      occupiedSelections: selections,
      exclusions: [],
      balanceYear,
      pendingCancelSelections
    }
  };
}

async function login(page: Page) {
  await page.goto("/");
  if (loginId && password) {
    await page.getByLabel("아이디").fill(loginId);
    await page.getByLabel("비밀번호").fill(password);
  } else {
    await page.getByLabel("테스트 계정").selectOption(fallbackTestLoginId);
    if (!password) throw new Error("E2E_PASSWORD is required for local test-account login.");
    await page.getByLabel("비밀번호").fill(password);
  }
  await page.getByRole("button", { name: "LOGIN" }).click();
  await expect(page.getByRole("navigation").getByRole("button", { name: "전자결재" })).toBeVisible();
}

async function openLeaveCancelForm(page: Page) {
  await page.getByRole("navigation").getByRole("button", { name: "전자결재" }).click();
  await page.getByRole("button", { name: "작성", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "양식 선택" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /휴가 취소계.*LEAVE_CANCEL/ }).click();
  await dialog.getByRole("button", { name: "확인", exact: true }).click();
  await expect(page.getByRole("heading", { name: "휴가 취소 신청" })).toBeVisible();
}

test.describe("휴가 취소계 회귀", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("같은 날짜의 오전·오후반차를 개별 취소하고 기본 수신자를 다른 직원으로 교체해 저장한다", async ({ page }) => {
    const now = new Date();
    const date = localDate(now.getFullYear(), now.getMonth(), 13);
    const selections: MockSelection[] = [
      { date, type: "오전반차", days: "0.5", approvalId: 101, documentNo: "LEV-TEST-0101" },
      { date, type: "오후반차", days: "0.5", approvalId: 102, documentNo: "LEV-TEST-0102" }
    ];
    await page.route("**/api/v1/approvals/leave-usage/me*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(usageResponse(selections))
    }));
    let draftPayload: { receiverEmpIds?: number[]; formDataJson?: string } | null = null;
    await page.route("**/api/v1/approvals/drafts", async (route) => {
      draftPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ success: false, code: "E2E_CAPTURE", message: "captured", data: null })
      });
    });

    await openLeaveCancelForm(page);

    await expect(page.locator(".leave-routing").getByText("허인성", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "결재 정보 수정", exact: true }).click();
    const approvalInfo = page.getByRole("dialog", { name: "결재 정보" });
    const receiverHeader = approvalInfo.getByRole("heading", { name: "수신자", exact: true });
    await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/v1/emps?") && response.ok()),
      receiverHeader.locator("..").getByRole("button", { name: "선택", exact: true }).click()
    ]);
    const receiverDialog = page.getByRole("dialog", { name: "수신자 선택" });
    await receiverDialog.getByRole("button", { name: "시스템 관리자 인사총무 · ADMIN", exact: true }).click();
    await receiverDialog.getByRole("button", { name: "적용", exact: true }).click();
    await approvalInfo.getByRole("button", { name: "적용", exact: true }).click();
    await expect(page.locator(".leave-routing").getByText("허인성", { exact: true })).toHaveCount(0);
    await expect(page.locator(".leave-routing").getByText("시스템 관리자", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /기존 오전반차/ }).click();
    await page.getByRole("button", { name: /기존 오후반차/ }).click();
    await expect(page.getByText("선택 2건 · 취소 1일 · 일반 연차 복원 1일", { exact: true })).toBeVisible();
    await expect(page.getByText("LEV-TEST-0101", { exact: true })).toBeVisible();
    await expect(page.getByText("LEV-TEST-0102", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "임시저장", exact: true }).click();
    await expect.poll(() => draftPayload).not.toBeNull();
    expect(draftPayload?.receiverEmpIds).toEqual([1]);
    const formData = JSON.parse(draftPayload?.formDataJson ?? "{}");
    const savedSelections = JSON.parse(formData.fields.leaveSelectionsJson);
    expect(savedSelections.map((selection: { sourceApprovalId: number }) => selection.sourceApprovalId)).toEqual([101, 102]);
  });

  test("예전 형식의 결재 중 취소 대상도 선택할 수 없게 표시한다", async ({ page }) => {
    const now = new Date();
    const date = localDate(now.getFullYear(), now.getMonth(), 13);
    const approved = { date, type: "오전반차", days: "0.5", approvalId: 101, documentNo: "LEV-TEST-0101" };
    const legacyPending = { date, type: "오전반차", days: "0.5", approvalId: null, documentNo: null };
    await page.route("**/api/v1/approvals/leave-usage/me*", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(usageResponse([approved], [legacyPending]))
    }));

    await openLeaveCancelForm(page);

    const pendingButton = page.getByRole("button", { name: /취소 결재 중/ });
    await expect(pendingButton).toBeDisabled();
  });

  test("과거 연도 휴가를 선택하면 해당 연도 잔여일수를 다시 조회한다", async ({ page }) => {
    const now = new Date();
    const previousYear = now.getFullYear() - 1;
    const date = localDate(previousYear, now.getMonth(), 13);
    const approved = { date, type: "연차", days: "1", approvalId: 201, documentNo: "LEV-PAST-0201" };
    let requestedYear = "";
    await page.route("**/api/v1/approvals/leave-usage/me*", (route) => {
      const year = new URL(route.request().url()).searchParams.get("year");
      requestedYear = year ?? requestedYear;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(usageResponse([approved], [], year ? Number(year) : now.getFullYear()))
      });
    });

    await openLeaveCancelForm(page);
    for (let index = 0; index < 12; index += 1) {
      await page.locator(".leave-calendar-toolbar").getByRole("button", { name: "이전" }).click();
    }
    await page.getByRole("button", { name: /기존 연차/ }).click();

    await expect.poll(() => requestedYear).toBe(String(previousYear));
    await expect(page.getByRole("region", { name: "휴가 현황" }).getByText("12일", { exact: true })).toBeVisible();
  });
});
