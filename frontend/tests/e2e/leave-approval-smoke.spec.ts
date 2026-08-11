import { expect, test } from "@playwright/test";

const loginId = process.env.E2E_LOGIN_ID;
const password = process.env.E2E_PASSWORD;
const expectLeaveAdmin = process.env.E2E_EXPECT_LEAVE_ADMIN === "true";

test.describe("휴가·전자결재 운영 스모크", () => {
  test.skip(!loginId || !password, "E2E_LOGIN_ID와 E2E_PASSWORD가 필요합니다.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("아이디").fill(loginId!);
    await page.getByLabel("비밀번호").fill(password!);
    await page.getByRole("button", { name: "LOGIN" }).click();
    await expect(page.getByRole("navigation").getByRole("button", { name: "전자결재" })).toBeVisible();
  });

  test("대체휴무와 관리자 휴가정책 화면을 연다", async ({ page }) => {
    await page.getByRole("navigation").getByRole("button", { name: "전자결재" }).click();
    await expect(page.getByRole("button", { name: "대체휴무" })).toBeVisible();
    await page.getByRole("button", { name: "대체휴무" }).click();
    await expect(page.getByRole("heading", { name: /대체휴무/ })).toBeVisible();

    if (expectLeaveAdmin) {
      await page.getByRole("button", { name: "휴가정책" }).click();
      await expect(page.getByRole("heading", { name: "경조 유형·관계별 기준표" })).toBeVisible();
      await expect(page.getByLabel("경조 유형")).toHaveValue("MARRIAGE");
      await expect(page.getByLabel("대상 관계")).toHaveValue("SELF");
      await expect(page.getByRole("button", { name: "수정", exact: true }).first()).toBeVisible();
    }
  });

  test("휴가 작성 화면의 핵심 지표와 날짜 선택기를 표시한다", async ({ page }) => {
    await page.getByRole("navigation").getByRole("button", { name: "전자결재" }).click();
    await page.getByRole("button", { name: "작성" }).click();
    const dialog = page.getByRole("dialog", { name: "양식 선택" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /휴가/ }).first().click();
    await dialog.getByRole("button", { name: /휴가계/ }).click();
    await dialog.getByRole("button", { name: "확인" }).click();
    await expect(page.getByRole("heading", { name: "휴가 신청" })).toBeVisible();
    await expect(page.getByText("총 휴가 일수", { exact: true })).toBeVisible();
    await expect(page.getByText("신청 전 휴가 사용 일수", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "신청 날짜" })).toBeVisible();
  });
});
