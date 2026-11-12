import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pool } from "../src/lib/db";
import { withImageTransaction } from "../src/lib/image-lifecycle";

/** Register a disposable account through the actual browser form.
 * @param handle Public account handle used for lookup.
 */
async function register(page: Page, handle: string): Promise<void> {
  await page.goto("/signup");
  await page.getByLabel("Handle", { exact: true }).fill(handle);
  await page.getByLabel("Display name").fill(handle);
  await page
    .getByLabel("Email", { exact: true })
    .fill(`${handle}@example.test`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-password");
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

/** Verify rendered messaging, reference privacy, cookie renewal, and cascade cleanup. */
test("agreed policies through browser forms and HTTP", async ({
  page,
  browser,
  request,
}, testInfo) => {
  expect(process.env.RUN_DB_TESTS).toBe("1");
  const handle = `browser_${randomUUID().slice(0, 8)}`;
  const peerHandle = `peer_${randomUUID().slice(0, 8)}`;
  const peerContext = await browser.newContext();
  const peer = await peerContext.newPage();
  try {
    await register(page, handle);
    await register(peer, peerHandle);
    const token = (await page.context().cookies()).find(
      (cookie) => cookie.name === "sid",
    )!.value;
    await pool.execute(
      "UPDATE sessions SET expires_at = UTC_TIMESTAMP() + INTERVAL 28 DAY WHERE token = ?",
      [token],
    );
    const renewed = await page.goto("/messages");
    expect((await renewed!.allHeaders())["set-cookie"]).toContain(
      "Max-Age=2592000",
    );
    const repeated = await page.goto("/messages");
    expect((await repeated!.allHeaders())["set-cookie"]).toBeUndefined();

    await page.getByRole("link", { name: "Message yourself" }).click();
    await page
      .locator('textarea[name="body"]')
      .fill("A note only on my sending side");
    const imageBytes = Buffer.alloc(10 * 1024 * 1024);
    (await readFile("db/seed-images/sunset.png")).copy(imageBytes);
    Buffer.from(handle).copy(imageBytes, imageBytes.length - handle.length);
    const file = {
      name: "private.png",
      mimeType: "image/png",
      buffer: imageBytes,
    };
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const bubble = page.getByText("A note only on my sending side", {
      exact: true,
    });
    await expect(bubble).toHaveCount(1);
    await expect(bubble.locator("..").locator("..")).toHaveClass(/justify-end/);
    const imageUrl = await page
      .locator('img[src^="/api/images/"]')
      .first()
      .getAttribute("src");
    expect(imageUrl).toBeTruthy();
    const mine = await page.request.get(imageUrl!);
    expect(mine.status()).toBe(200);
    expect(mine.headers()["cache-control"]).toBe("private, no-store");
    expect((await request.get(imageUrl!)).status()).toBe(404);
    expect((await peer.request.get(imageUrl!)).status()).toBe(404);
    expect(
      (
        await request.get(imageUrl!, {
          headers: { "If-None-Match": mine.headers().etag },
        })
      ).status(),
    ).toBe(404);

    await page.goto(`/messages/${peerHandle}`);
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText("Sent.", { exact: true })).toBeVisible();
    expect((await peer.request.get(imageUrl!)).status()).toBe(200);

    await page.goto("/settings");
    await page.locator('input[name="avatar"]').setInputFiles(file);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    expect((await request.get(imageUrl!)).status()).toBe(200);
    await page.getByLabel("Remove avatar").check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByLabel("Remove avatar")).toHaveCount(0);
    expect((await request.get(imageUrl!)).status()).toBe(404);
    expect((await peer.request.get(imageUrl!)).status()).toBe(200);

    await page.goto("/collections");
    await page
      .locator('input[name="name"]')
      .first()
      .fill("Private browser collection");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const collection = page.getByRole("link", {
      name: "Private browser collection",
    });
    await expect(collection).toBeVisible();
    const collectionUrl = await collection.getAttribute("href");
    expect((await peer.request.get(collectionUrl!)).status()).toBe(404);

    // Preserve the core CRUD workflow and ownership rules while changing image handling.
    await page.goto("/threads/new");
    await page.getByLabel("Topic", { exact: true }).selectOption({ index: 1 });
    await page.locator('textarea[name="body"]').fill("Browser CRUD thread");
    await page
      .getByRole("button", { name: "Post thread", exact: true })
      .click();
    await expect(
      page.getByText("Browser CRUD thread", { exact: true }),
    ).toBeVisible();
    const threadUrl = new URL(page.url()).pathname;
    expect((await peer.request.get(`${threadUrl}/edit`)).status()).toBe(404);
    await page
      .getByRole("button", { name: /Save to.*Private browser collection/ })
      .click();
    await expect(
      page.getByRole("button", { name: /In.*Private browser collection/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "♡ Like · 0", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "♥ Liked · 1", exact: true }),
    ).toBeVisible();
    const like = page.locator("article .like-button");
    await expect(like).toBeEnabled();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(like).toHaveCSS("color", "rgb(255, 46, 64)");
    await expect(like.locator(".counter-viewport")).toHaveAttribute("data-direction", "up");
    await page.screenshot({ path: testInfo.outputPath("animated-like.png") });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await like.click();
    await expect(like).toBeEnabled();
    await expect(like).toHaveAttribute("aria-pressed", "false");
    await expect(like.locator(".counter-in")).toHaveCSS("animation-name", "none");
    await expect(like).toHaveAccessibleName("♡ Like · 0");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // A failed mutation must restore the saved count and offer an announced retry.
    await page.route(
      "**/*",
      /** Simulate a server-action transport failure without mutating saved data. */
      async (route) => {
        if (route.request().headers()["next-action"]) await route.abort("failed");
        else await route.continue();
      },
    );
    await like.click();
    await expect(page.locator("article").getByRole("alert")).toHaveText("Couldn’t save like. Try again.");
    await expect(like).toHaveAccessibleName("♡ Like · 0");
    await page.unroute("**/*");
    await like.click();
    await expect(like).toBeEnabled();
    await expect(like).toHaveAccessibleName("♥ Liked · 1");
    await page.getByPlaceholder("Write a comment…").fill("Browser comment");
    await page.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(
      page.getByText("Browser comment", { exact: true }),
    ).toBeVisible();
    await page.locator('a[href*="editComment="]').click();
    await page
      .locator("form")
      .filter({
        has: page.getByRole("button", { name: "Save comment", exact: true }),
      })
      .locator('textarea[name="body"]')
      .fill("Edited browser comment");
    await page
      .getByRole("button", { name: "Save comment", exact: true })
      .click();
    await expect(
      page.getByText("Edited browser comment", { exact: true }),
    ).toBeVisible();
    await page.goto(`${threadUrl}/edit`);
    await expect(page.locator('select[name="topic_id"]')).toHaveCount(0);
    await page.locator('textarea[name="body"]').fill("Edited browser thread");
    await page
      .getByRole("button", { name: "Save changes", exact: true })
      .click();
    await expect(
      page.getByText("Edited browser thread", { exact: true }),
    ).toBeVisible();
    page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await page
      .locator("article")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page).toHaveURL("/");
    expect((await request.get(threadUrl)).status()).toBe(404);
    await page.goto(collectionUrl!);
    await expect(page.getByText(/Nothing saved here yet/)).toBeVisible();
    await page.goto(`/u/${peerHandle}`);
    await page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Unfollow", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Unfollow", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Follow", exact: true }),
    ).toBeVisible();

    await page.goto(`/messages/${handle}`);
    await page.screenshot({
      path: testInfo.outputPath("self-message.png"),
      fullPage: true,
    });
    await page.goto("/settings");
    await page.locator('input[name="confirm_handle"]').fill(handle);
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(
      page.getByRole("link", { name: "Log in", exact: true }),
    ).toBeVisible();
    expect((await peer.request.get(imageUrl!)).status()).toBe(404);
    await peer.goto("/messages");
    await expect(
      peer.getByRole("link", { name: new RegExp(handle) }),
    ).toHaveCount(0);
  } finally {
    await withImageTransaction(async (conn) => {
      await conn.execute("DELETE FROM users WHERE handle IN (?, ?)", [
        handle,
        peerHandle,
      ]);
    });
    await peerContext.close();
    await pool.end();
  }
});
