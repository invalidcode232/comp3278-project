import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pool } from "../src/lib/db";
import { deleteUser } from "../src/lib/queries/users";
import { withImageTransaction } from "../src/lib/image-lifecycle";

/** Create an isolated synthetic account through the real registration flow. */
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
  await expect(page).toHaveURL("/");
}

/** Validate migrated conversations, permissions, motion, uploads, and responsive layout with disposable fixtures. */
test("unified conversations and visual workflows", async ({
  page,
  browser,
  request,
}, info) => {
  expect(process.env.RUN_DB_TESTS).toBe("1");
  const handle = `browser_${randomUUID().slice(0, 8)}`;
  const topicName = `Study ${randomUUID().slice(0, 8)} Club`;
  const peerHandle = `peer_${randomUUID().slice(0, 8)}`;
  const peerContext = await browser.newContext();
  const peer = await peerContext.newPage();
  try {
    await register(page, handle);
    await register(peer, peerHandle);
    const token = (await page.context().cookies()).find(
      /** Locate the session cookie without logging it. */ (cookie) =>
        cookie.name === "sid",
    )!.value;
    await pool.execute(
      "UPDATE sessions SET expires_at=UTC_TIMESTAMP()+INTERVAL 28 DAY WHERE token=?",
      [token],
    );
    const renewed = await page.goto("/messages");
    expect((await renewed!.allHeaders())["set-cookie"]).toContain(
      "Max-Age=2592000",
    );
    expect(
      (await (await page.goto("/messages"))!.allHeaders())["set-cookie"],
    ).toBeUndefined();

    await page.getByRole("link", { name: "Message yourself" }).click();
    await page
      .locator('textarea[name="body"]:visible')
      .fill("Private note to myself");
    const bytes = Buffer.alloc(10 * 1024 * 1024);
    (await readFile("db/seed-images/sunset.png")).copy(bytes);
    Buffer.from(handle).copy(bytes, bytes.length - handle.length);
    const attachment = {
      name: "private.png",
      mimeType: "image/png",
      buffer: bytes,
    };
    await page.locator('input[name="image"]:visible').setInputFiles(attachment);
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      page.getByText("Private note to myself", { exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByText("Private note to myself").locator("../.."),
    ).toHaveClass(/justify-end/);
    const imageUrl = await page
      .locator(".conversation-scroll img")
      .getAttribute("src");
    expect((await request.get(imageUrl!)).status()).toBe(404);
    expect((await page.request.get(imageUrl!)).status()).toBe(200);
    expect((await peer.request.get(imageUrl!)).status()).toBe(404);
    await expect(page.locator(".attachment-preview")).toHaveCount(0);

    await page.goto("/settings");
    await page.locator('input[name="avatar"]').setInputFiles(attachment);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByRole("status")).toHaveText("Profile saved.");
    const publicImage = await request.get(imageUrl!);
    expect(publicImage.status()).toBe(200);
    await page.getByLabel("Remove avatar").check();
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByLabel("Remove avatar")).toHaveCount(0);
    expect(
      (
        await request.get(imageUrl!, {
          headers: { "If-None-Match": publicImage.headers().etag },
        })
      ).status(),
    ).toBe(404);

    await page.goto("/collections");
    await page.getByLabel("Collection name").fill("Private browser collection");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const collectionLink = page.getByRole("link", {
      name: "Private browser collection",
      exact: true,
    });
    await expect(collectionLink).toBeVisible();
    const collectionUrl = await collectionLink.getAttribute("href");
    expect((await peer.request.get(collectionUrl!)).status()).toBe(404);

    await page.goto("/");
    await page.locator(".feed-composer button.composer-prompt").click();
    const dialog = page.getByRole("dialog", { name: "New thread" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveCSS("animation-duration", "0.2s");
    await dialog.getByLabel("Topic", { exact: true }).fill("oUrSe");
    await expect(
      dialog.getByRole("option", { name: "Course Help", exact: true }),
    ).toBeVisible();
    await dialog.getByRole("combobox").press("ArrowDown");
    await dialog.getByRole("combobox").press("Enter");
    await expect(dialog.getByRole("combobox")).toHaveValue("Course Help");
    await dialog.getByRole("combobox").fill(topicName);
    await expect(
      dialog.getByRole("option", { name: `${topicName} + Tag new topic` }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("topic-composer-desktop.png"),
    });
    await dialog
      .getByRole("option", { name: `${topicName} + Tag new topic` })
      .click();
    await dialog.getByLabel("Message text").fill("Browser root post");
    await dialog.getByRole("button", { name: "Post", exact: true }).click();
    await expect(page.locator("article .post-body").first()).toHaveText(
      "Browser root post",
    );
    await expect(dialog).not.toBeVisible();
    const rootUrl = new URL(page.url()).pathname;
    await expect(page.locator("article .post-topic").first()).toHaveText(
      `› ${topicName}`,
    );
    const suggestions = await request.get(
      `/api/topics?q=${encodeURIComponent(topicName.slice(3, -2).toUpperCase())}`,
    );
    expect(
      (await suggestions.json()).some(
        (item: { name: string }) => item.name === topicName,
      ),
    ).toBe(true);
    await page.goto(`${rootUrl}/edit`);
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await page.locator('input[name="post_id"]').evaluate(
      /** Simulate a forged edit field; the server must ignore topic changes. */ (
        element,
      ) => {
        const input = document.createElement("input");
        input.name = "topic_name";
        input.value = "Forged replacement";
        element.parentElement!.append(input);
      },
    );
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("article .post-topic").first()).toHaveText(
      `› ${topicName}`,
    );
    await peer.goto("/threads/new");
    await peer.getByRole("combobox").fill(topicName.toUpperCase());
    await expect(
      peer.getByRole("option", { name: topicName, exact: true }),
    ).toBeVisible();
    await peer.getByRole("combobox").press("Escape");
    await peer
      .locator('textarea[name="body"]:visible')
      .fill("Same topic, different case");
    await peer.getByRole("button", { name: "Post", exact: true }).click();
    await expect(peer.locator("article .post-topic").first()).toHaveText(
      `› ${topicName}`,
    );
    await page.goto(`/topics?q=${encodeURIComponent(topicName.toUpperCase())}`);
    await expect(page.locator(".directory-row")).toHaveCount(1);
    await expect(page.locator(".directory-row")).toContainText("2 threads");
    await page.goto(rootUrl);

    expect((await peer.request.get(`${rootUrl}/edit`)).status()).toBe(404);
    await page.locator('summary[aria-label="Save to collection"]').click();
    await page
      .getByRole("button", { name: /Save to.*Private browser collection/ })
      .click();
    await expect(
      page.getByRole("button", { name: /In.*Private browser collection/ }),
    ).toBeVisible();
    await page.locator('summary[aria-label="Save to collection"]').click();
    const like = page.locator("article .like-button").first();
    await like.click();
    await expect(like).toBeEnabled();
    await expect(like).toHaveAttribute("aria-pressed", "true");
    await expect(like).toHaveCSS("color", "rgb(255, 46, 64)");
    await expect(like.locator(".counter-viewport")).toHaveAttribute(
      "data-direction",
      "up",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await like.click();
    await expect(like).toBeEnabled();
    await expect(like.locator(".counter-in")).toHaveCSS(
      "animation-name",
      "none",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.route(
      "**/*",
      /** Fail only the mutation transport to check optimistic rollback. */ async (
        route,
      ) => {
        if (route.request().headers()["next-action"])
          await route.abort("failed");
        else await route.continue();
      },
    );
    await like.click();
    await expect(page.locator('article [role="alert"]')).toHaveText(
      "Couldn’t save like. Try again.",
    );
    await expect(like).toHaveAccessibleName("♡ Like · 0");
    await page.unroute("**/*");
    await like.click();
    await expect(like).toBeEnabled();

    // A different author replies, then the root author replies to that reply.
    await peer.goto(rootUrl);
    await peer.locator(".inline-reply textarea").fill("Peer reply");
    await peer
      .locator(".inline-reply")
      .getByRole("button", { name: "Reply", exact: true })
      .click();
    await expect(peer.locator("article .post-body").last()).toHaveText(
      "Peer reply",
    );
    const replyUrl = new URL(peer.url()).pathname;
    await page.goto(replyUrl);
    await page.locator(".inline-reply textarea").fill("Reply to a reply");
    await page
      .locator(".inline-reply")
      .getByRole("button", { name: "Reply", exact: true })
      .click();
    await expect(page.locator("article .post-body").last()).toHaveText(
      "Reply to a reply",
    );
    const nestedUrl = new URL(page.url()).pathname;
    await page.goto(`${nestedUrl}/edit`);
    await page
      .locator('textarea[name="body"]:visible')
      .fill("Edited nested reply");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("article .post-body").last()).toHaveText(
      "Edited nested reply",
    );
    await page.screenshot({
      path: info.outputPath("nested-desktop.png"),
      fullPage: true,
    });
    await page.goto(rootUrl);
    await page
      .locator("article")
      .first()
      .locator('summary[aria-label="Post options"]')
      .click();
    await page
      .locator("article")
      .first()
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Are you sure?" })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page.locator("article.tombstone")).toHaveCount(1);
    await expect(
      page.locator("article .post-body").filter({ hasText: "Peer reply" }),
    ).toBeVisible();
    await page.goto(collectionUrl!);
    await expect(page.getByText(/Nothing saved here yet/)).toBeVisible();
    await page.goto(`/u/${peerHandle}`);
    await page.getByRole("button", { name: "Follow", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Unfollow", exact: true }),
    ).toBeVisible();

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const route of [
        "/",
        "/settings",
        "/collections",
        "/topics",
        "/messages",
        `/u/${handle}`,
        "/threads/new",
        `/messages/${handle}`,
        nestedUrl,
      ]) {
        await page.goto(route);
        expect(
          await page.evaluate(
            /** Measure the rendered page, not assumptions about CSS breakpoints. */ () =>
              document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
      await page.screenshot({
        path: info.outputPath(`nested-${width}.png`),
        fullPage: true,
      });
    }
    await page.goto(`/messages/${handle}`);
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: info.outputPath("messages-mobile.png") });
    await page.goto("/");
    await page.screenshot({ path: info.outputPath("feed-mobile.png") });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.screenshot({ path: info.outputPath("feed-desktop.png") });

    await peer.goto("/settings");
    await peer.locator('input[name="confirm_handle"]').fill(peerHandle);
    await peer.getByRole("button", { name: "Delete my account" }).click();
    await expect(peer).toHaveURL("/");
    await page.goto(nestedUrl);
    await expect(page.locator("article.tombstone")).toHaveCount(2);
    await expect(
      page
        .locator("article .post-body")
        .filter({ hasText: "Edited nested reply" }),
    ).toBeVisible();
  } finally {
    await withImageTransaction(async (db) => {
      const [rows] = await db.execute(
        "SELECT id FROM users WHERE handle IN (?,?)",
        [handle, peerHandle],
      );
      for (const row of rows as { id: string }[]) await deleteUser(db, row.id);
    });
    await peerContext.close();
    await pool.end();
  }
});

/** Inspect all primary screens and keyboard interactions against disposable seed data without changing content. */
test("screen polish and keyboard interactions", async ({ page }, info) => {
  expect(process.env.RUN_DB_TESTS).toBe("1");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("alice@example.com");
  await page.getByLabel("Password", { exact: true }).fill("password123");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Hide password" }).click();
  await page.screenshot({ path: info.outputPath("login-desktop.png") });
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL("/");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const [name, route] of [
      ["topics", "/topics"],
      ["topic", "/topics/1"],
      ["profile", "/u/alice"],
      ["settings", "/settings"],
      ["collections", "/collections"],
      ["collection", "/collections/1"],
      ["messages", "/messages"],
      ["conversation", "/messages/bob"],
      ["edit", "/threads/1/edit"],
      ["missing", "/threads/999999999"],
    ]) {
      await page.goto(route);
      expect(
        await page.evaluate(
          /** Detect actual horizontal overflow across content and navigation. */ () =>
            document.documentElement.scrollWidth <= innerWidth,
        ),
        `${name} at ${width}px`,
      ).toBe(true);
      if (width !== 320)
        await page.screenshot({
          path: info.outputPath(`${name}-${width}.png`),
        });
    }
    await page.goto("/");
    await page.locator(".feed-composer button.composer-prompt").click();
    const composer = page.getByRole("dialog", { name: "New thread" });
    await expect(composer.getByLabel("Message text")).toBeFocused();
    await composer.getByRole("combobox").fill("oto");
    await expect(
      composer.getByRole("option", { name: "Photography", exact: true }),
    ).toBeVisible();
    await expect(
      composer.getByRole("option", { name: "Photography", exact: true }),
    ).toBeInViewport();
    expect(
      await composer.locator(".topic-popover").evaluate(
        /** Popovers stay fully inside even the narrowest tested viewport. */ (
          element,
        ) => {
          const rect = element.getBoundingClientRect();
          return rect.left >= 0 && rect.right <= innerWidth;
        },
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`composer-${width}.png`) });
    await composer.getByRole("combobox").press("Escape");
    await expect(composer).toBeVisible();
    await expect(composer.getByRole("listbox")).toHaveCount(0);
    await composer.getByRole("combobox").press("Escape");
    await expect(composer).not.toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/threads/1");
  const root = page.locator("article").first();
  await root.locator('summary[aria-label="Post options"]').click();
  await root.getByRole("button", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Are you sure?" });
  await expect(
    confirmation.getByRole("button", { name: "Cancel" }),
  ).toBeFocused();
  await expect(confirmation).toHaveCSS("opacity", "1");
  await expect(confirmation).toBeInViewport();
  await page.screenshot({ path: info.outputPath("delete-confirmation.png") });
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(root.locator(".post-body")).toContainText(
    "normalising a schema",
  );
  await page.keyboard.press("Escape");
  await expect(root.locator("details").first()).not.toHaveAttribute("open", "");
});
