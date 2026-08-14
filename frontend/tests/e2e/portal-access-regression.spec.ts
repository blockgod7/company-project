import { expect, test, type Page } from "@playwright/test";

const regularLoginId = process.env.E2E_REGULAR_TEST_LOGIN_ID ?? "e7012";
const administratorLoginId = process.env.E2E_ADMIN_TEST_LOGIN_ID ?? "admin";
const fullAdministratorLoginId = process.env.E2E_FULL_ADMIN_TEST_LOGIN_ID ?? "e0015";
const delegatedAdministratorLoginId = process.env.E2E_DELEGATED_ADMIN_TEST_LOGIN_ID ?? "e7016";
const testPassword = process.env.E2E_PASSWORD;

async function loginAs(page: Page, loginId: string, requestedPath = "/login") {
  await page.goto(requestedPath);
  await expect(page.getByRole("button", { name: "LOGIN" })).toBeVisible();
  await page.getByLabel("테스트 계정").selectOption(loginId);
  if (!testPassword) throw new Error("E2E_PASSWORD is required for local test-account login.");
  await page.getByLabel("비밀번호").fill(testPassword);
  await page.getByRole("button", { name: "LOGIN" }).click();
  await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
}

test.describe("포털 접근과 메뉴 노출 회귀", () => {
  test("일반 임직원은 공통 메뉴를 보고 관리자 포털과 예정 메뉴는 보지 못한다", async ({ page }) => {
    await loginAs(page, regularLoginId);

    const navigation = page.getByRole("navigation", { name: "주요 메뉴" });
    for (const menuName of ["홈", "공지사항", "게시판", "전자결재", "조직도", "알림"]) {
      await expect(navigation.getByRole("button", { name: menuName, exact: true })).toBeVisible();
    }
    await expect(navigation.getByRole("button", { name: /도면관리|설비관리/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "임직원 포털", exact: true })).toHaveCount(0);

    await page.goto("/portal/admin/home");
    await expect(page).toHaveURL(/\/portal\/employee\/home$/);
    await expect(page.getByRole("heading", { name: "접근 권한이 없습니다." })).toHaveCount(0);
    await expect(navigation.getByRole("button", { name: "전자결재", exact: true })).toBeVisible();
  });

  test("시스템관리자는 예정 기능 안내와 관리자 포털을 전환해 사용한다", async ({ page }) => {
    await loginAs(page, administratorLoginId);

    const employeeNavigation = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(employeeNavigation.getByRole("button", { name: "도면관리 예정" })).toBeVisible();
    await employeeNavigation.getByRole("button", { name: "도면관리 예정" }).click();
    await expect(page).toHaveURL(/\/planned-features\/PDM$/);
    await expect(page.getByRole("heading", { name: "도면관리", level: 1 })).toBeVisible();
    await expect(page.getByText("이 화면은 다음 개발을 위한 읽기 전용 안내입니다.", { exact: false })).toBeVisible();

    await page.getByRole("button", { name: "임직원 포털", exact: true }).click();
    await page.getByRole("menuitem", { name: /관리자 포털/ }).click();
    await expect(page).toHaveURL(/\/portal\/admin\/home$/);

    const adminNavigation = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(adminNavigation.getByRole("button", { name: "관리 홈", exact: true })).toBeVisible();
    await expect(adminNavigation.getByRole("button", { name: "직원 관리", exact: true })).toBeVisible();
    await expect(adminNavigation.getByRole("button", { name: "감사 로그", exact: true })).toBeVisible();
  });

  test("전권자는 예정 기능과 관리자 포털을 보지만 시스템 감사 메뉴는 보지 못한다", async ({ page }) => {
    await loginAs(page, fullAdministratorLoginId);

    const employeeNavigation = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(employeeNavigation.getByRole("button", { name: "도면관리 예정" })).toBeVisible();
    await expect(employeeNavigation.getByRole("button", { name: "설비관리 예정" })).toBeVisible();

    await page.getByRole("button", { name: "임직원 포털", exact: true }).click();
    await page.getByRole("menuitem", { name: /관리자 포털/ }).click();
    await expect(page).toHaveURL(/\/portal\/admin\/home$/);

    const adminNavigation = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(adminNavigation.getByRole("button", { name: "관리 홈", exact: true })).toBeVisible();
    await expect(adminNavigation.getByRole("button", { name: "직원 관리", exact: true })).toBeVisible();
    await expect(adminNavigation.getByRole("button", { name: "감사 로그", exact: true })).toHaveCount(0);
  });

  test("개별 관리 권한자는 관리자 포털을 보지만 예정 기능은 보지 못한다", async ({ page }) => {
    await loginAs(page, delegatedAdministratorLoginId);

    const employeeNavigation = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(employeeNavigation.getByRole("button", { name: /도면관리|설비관리/ })).toHaveCount(0);

    await page.getByRole("button", { name: "임직원 포털", exact: true }).click();
    await page.getByRole("menuitem", { name: /관리자 포털/ }).click();
    await expect(page).toHaveURL(/\/portal\/admin\/home$/);

    const adminNavigation = page.getByRole("navigation", { name: "주요 메뉴" });
    await expect(adminNavigation.getByRole("button", { name: "관리 홈", exact: true })).toBeVisible();
    await expect(adminNavigation.getByRole("button", { name: "직원 관리", exact: true })).toBeVisible();
    await expect(adminNavigation.getByRole("button", { name: "감사 로그", exact: true })).toHaveCount(0);
  });

  test("인증 전 직접 URL은 로그인 후 원래 임직원 화면으로 복귀한다", async ({ page }) => {
    await loginAs(page, regularLoginId, "/portal/employee/organization");

    await expect(page).toHaveURL(/\/portal\/employee\/organization$/);
    await expect(page.getByRole("heading", { name: "조직도" })).toBeVisible();
  });

  test("메뉴 이동 뒤 브라우저 뒤로가기와 앞으로가기가 URL과 화면을 복원한다", async ({ page }) => {
    await loginAs(page, regularLoginId);
    const navigation = page.getByRole("navigation", { name: "주요 메뉴" });

    await navigation.getByRole("button", { name: "공지사항", exact: true }).click();
    await expect(page).toHaveURL(/\/portal\/employee\/notices$/);
    await navigation.getByRole("button", { name: "게시판", exact: true }).click();
    await expect(page).toHaveURL(/\/portal\/employee\/boards$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/portal\/employee\/notices$/);
    await expect(page.getByRole("heading", { name: "공지사항" })).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/portal\/employee\/boards$/);
    await expect(page.getByRole("heading", { name: "게시판" })).toBeVisible();
  });

  test("좁은 화면에서도 공통 메뉴와 본문이 가로 넘침 없이 유지된다", async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await loginAs(page, regularLoginId);

    await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
