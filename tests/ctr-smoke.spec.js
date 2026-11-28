async function completeAvatarGate(page) {
  const modal = page.locator("#accountSettingsModal");
  if (await modal.isVisible().catch(() => false)) {
    const choice = page.locator("#accountAvatarChoices button:not([disabled])").first();
    await expect(choice).toBeVisible({ timeout: 15000 });
    await choice.click();
    await expect(modal).toBeHidden({ timeout: 15000 });
  }
}

const { test, expect } = require("@playwright/test");

test("CTR public page, assets and sign-in form load without JavaScript errors", async ({ page, request }) => {
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  const response = await page.goto("./");
  expect(response && response.status()).toBe(200);
  await expect(page).toHaveTitle(/IndiNext Orbit — Sales Workspace/i);
  await expect(page.locator("#authView")).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expect(page.locator("#authSubmit")).toBeEnabled();
  await expect(page.locator("#dashboardFrom")).toBeAttached();
  await expect(page.locator("#toggleNotificationPanel")).toBeAttached();
  await expect(page.locator("#themePull")).toBeAttached();
  await expect(page.locator("#exportCrmData")).toBeAttached();
  const assets = await Promise.all(["./styles.css?v=avatar-daily-limit-ist-20261128", "./app.js?v=avatar-daily-limit-ist-20261128", "./crm-local-ai.js", "./01_crossed_swords.png", "./09_tiger.png", "./16_yin_yang.png", "./Dark.png", "./Light.png", "./orbit-logo-transparent.png"].map(url => request.get(new URL(url, "https://nottybuddy.github.io/Orbit/").toString())));
  console.log("ORBIT_ASSET_STATUS", JSON.stringify(assets.map(x => x.status())));
  expect(assets.map(x => x.status())).toEqual([200, 200, 200, 200, 200, 200, 200, 200, 200]);
  const cssSource=await (await request.get(new URL("./styles.css?v=avatar-daily-limit-ist-20261128","https://nottybuddy.github.io/Orbit/").toString())).text();
  expect(cssSource).toContain("Dark.png");
  expect(cssSource).toContain("Light.png");
  expect(pageErrors, "Uncaught JavaScript errors").toEqual([]);
  const appSource = await (await request.get(new URL("./app.js?v=avatar-daily-limit-ist-20261128", "https://nottybuddy.github.io/Orbit/").toString())).text();
  expect(appSource).toContain("data-dm-edit");
  expect(appSource).not.toContain("data-clear-dm");
  expect(appSource).toContain("ctr_choose_avatar");
  expect(appSource).toContain("last_changed_on");
  expect(appSource).toContain("avatarChangedToday");
  expect(appSource).toContain("once per day (IST)");
  expect(appSource).toContain("ctr_session_is_active");
  expect(appSource).toContain("setupPresence");
  expect(appSource).toContain("data-reply-note");
  expect(appSource).toContain("data-dm-reply");
  expect(appSource).toContain("dashboardFrom");
  expect(appSource).toContain("PAGE_SIZE=50");
  expect(appSource).toContain("loadOlderDirect");
  expect(appSource).toContain("loadNotifications");
  expect(appSource).toContain("exportAllCrmData");
  expect(appSource).toContain("ctr_notifications");
});

test("authenticated agent can use all workspace sections and open Direct Chat", async ({ page }) => {
  const email = process.env.CTR_TEST_EMAIL;
  const password = process.env.CTR_TEST_PASSWORD;
  test.skip(!email || !password, "Set CTR_TEST_EMAIL and CTR_TEST_PASSWORD GitHub Actions secrets for authenticated checks.");
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("./");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#appView")).toBeVisible({ timeout: 30000 });
  await completeAvatarGate(page);

  const sections = [
    ["group", "#groupView"],
    ["personal", "#personalView"],
    ["direct", "#directView"],
    ["followups", "#followupsView"],
    ["dashboard", "#dashboardView"],
  ];
  for (const [view, selector] of sections) {
    await page.locator('[data-view="' + view + '"]').click();
    await expect(page.locator(selector)).toBeVisible();
  }

  await page.locator('[data-view="direct"]').click();
  await expect(page.locator("#directInboxList")).toBeVisible();
  await expect(page.locator("#directForm")).toBeVisible();
  await expect(page.locator("#dmNewRecipient")).toBeAttached();
  await expect(page.locator("#directInboxList")).not.toContainText("Chats could not be loaded", { timeout: 20000 });
  const firstContact = page.locator("#directInboxList button.dm-conversation").first();
  await expect(firstContact).toBeVisible({ timeout: 20000 });
  await firstContact.click();
  await expect(page.locator("#directInput")).toBeEnabled();
  await expect(page.locator("#directForm button[type=submit]")).toBeEnabled();
  await page.locator('[data-view="dashboard"]').click();
  await expect(page.locator("#exportCrmData")).toBeHidden();
  await page.locator('[data-view="direct"]').click();
  // The theme toggle is inside the authenticated app shell, which is hidden
  // on the public sign-in screen. Apply the same theme class directly so this
  // test can verify the wallpaper without requiring test credentials.
  await page.evaluate(() => {
    document.body.classList.add("theme-light");
    document.documentElement.style.colorScheme = "light";
  });
  await expect(page.locator("body")).toHaveClass(/theme-light/);
  await page.locator("#themePull").click();
  await page.locator("#toggleNotificationPanel").click();
  await expect(page.locator("#notificationPanel")).toBeVisible();

  // Mobile: selecting a contact must reveal the thread pane, and the header must return to the inbox.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#directInboxList button.dm-conversation").first().click();
  await expect(page.locator("#directView .dm-inbox")).toHaveClass(/mobile-thread-open/);
  await expect(page.locator("#dmThreadHeader")).toBeVisible();
  await page.locator("#dmThreadHeader").click();
  await expect(page.locator("#directView .dm-inbox")).not.toHaveClass(/mobile-thread-open/);
  expect(pageErrors, "Uncaught JavaScript errors during workspace navigation").toEqual([]);
});

test("authenticated view switching hides inactive workspace sections", async ({ page }) => {
  const email = process.env.CTR_TEST_EMAIL;
  const password = process.env.CTR_TEST_PASSWORD;
  test.skip(!email || !password, "Set CTR_TEST_EMAIL and CTR_TEST_PASSWORD for authenticated navigation checks.");
  await page.goto("./");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#appView")).toBeVisible({ timeout: 30000 });
  await completeAvatarGate(page);
  const group = page.locator("#groupView");
  await expect(group).toBeVisible();
  for (const view of ["personal", "direct", "followups", "dashboard"]) {
    await page.locator('[data-view="' + view + '"]').click();
    await expect(group).toBeHidden();
    await expect(page.locator("#" + view + "View")).toBeVisible();
  }
  await page.locator('[data-view="group"]').click();
  await expect(group).toBeVisible();
});
test("authenticated admin can inspect agent conversations and activity", async ({ page }) => {
  const email = process.env.CTR_ADMIN_TEST_EMAIL;
  const password = process.env.CTR_ADMIN_TEST_PASSWORD;
  test.skip(!email || !password, "Set CTR_ADMIN_TEST_EMAIL and CTR_ADMIN_TEST_PASSWORD GitHub Actions secrets for admin checks.");
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto("./");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("#authSubmit").click();
  await expect(page.locator("#appView")).toBeVisible({ timeout: 30000 });
  await completeAvatarGate(page);
  await page.locator('[data-view="dashboard"]').click();
  await expect(page.locator("#dashboardView")).toBeVisible();
  await expect(page.locator("#agentDashboard")).toBeVisible();
  await expect(page.locator("#exportCrmData")).toBeVisible();
  const agent = page.locator("#agentDashboard [data-audit-agent]").first();
  await expect(agent).toBeVisible({ timeout: 20000 });
  await agent.click();
  await expect(page.locator("#agentChatAudit")).toBeVisible();
  await expect(page.locator("#agentChatAuditSearch")).toBeVisible();
  await expect(page.locator("#agentChatAuditDate")).toBeVisible();
  const conversation = page.locator("#agentChatAudit [data-audit-pair]").first();
  if (await conversation.count()) {
    await conversation.click();
    await expect(page.locator(".agent-audit-thread")).toBeVisible();
    await page.locator("[data-audit-back-list]").click();
  }
  expect(pageErrors, "Uncaught JavaScript errors in admin audit").toEqual([]);
});

test("CTR layout fits desktop and mobile viewports without horizontal overflow", async ({ page }) => {
  await page.goto("./");
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(dimensions.scrollWidth, "Horizontal overflow at viewport " + viewport.width).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }
});

test("Light Theme wallpaper is rendered behind the app surfaces", async ({ page, request }) => {
  await page.goto("./");
  const assetUrl = new URL("./Light.png?rev=20261125e", "https://nottybuddy.github.io/Orbit/").toString();
  const assetResponse = await request.get(assetUrl);
  expect(assetResponse.status(), "Light Theme wallpaper must be served by GitHub Pages").toBe(200);
  expect(assetResponse.headers()["content-type"] || "").toContain("image/png");

  // The public sign-in page hides the theme control; apply the same theme class
  // that the app's setTheme() function applies after sign-in.
  await page.evaluate(() => {
    if (typeof setTheme === "function") setTheme("light");
    else {
      document.body.classList.add("theme-light");
      document.documentElement.style.colorScheme = "light";
    }
  });

  const rendered = await page.evaluate(async () => {
    const htmlStyle = getComputedStyle(document.documentElement);
    const bodyStyle = getComputedStyle(document.body);
    const shell = document.querySelector("body > .shell");
    const image = new Image();
    image.src = "/Orbit/Light.png?rev=20261126a";
    let decoded = false;
    try { await image.decode(); decoded = true; } catch {}
    return {
      wallpaperLayer: (() => { const style=getComputedStyle(document.body,"::before"); return {backgroundImage:style.backgroundImage,backgroundSize:style.backgroundSize,position:style.position,zIndex:style.zIndex} })(),
      canvasBackground: htmlStyle.backgroundImage,
      canvasSize: htmlStyle.backgroundSize,
      canvasPosition: htmlStyle.backgroundPosition,
      bodyBackground: bodyStyle.backgroundImage,
      bodySize: bodyStyle.backgroundSize,
      shellBackground: shell ? getComputedStyle(shell).backgroundImage : null,
      imageDecoded: decoded,
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight
    };
  });
  console.log("ORBIT_LIGHT_WALLPAPER_DIAGNOSTIC", JSON.stringify(rendered));
  expect(rendered.wallpaperLayer?.backgroundImage, "Light theme pseudo-background must load the actual wallpaper").toContain("Light.png");
  expect(rendered.wallpaperLayer?.position).toBe("fixed");
  expect(rendered.wallpaperLayer?.backgroundSize).toContain("cover");
  expect(rendered.wallpaperLayer.backgroundSize).toContain("cover");
  expect(rendered.shellBackground).toBe("none");
  expect(rendered.imageDecoded, "Wallpaper image must decode in Chromium").toBe(true);
  expect(rendered.imageWidth).toBeGreaterThan(0);
  expect(rendered.imageHeight).toBeGreaterThan(0);
});
