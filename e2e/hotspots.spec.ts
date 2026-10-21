import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

const hotspot = (page: Page) => page.getByRole('button', { name: 'New: Export to Excel' })
const exportButton = (page: Page) => page.locator('#btn-export')

async function expectOverTarget(page: Page) {
  const target = await exportButton(page).boundingBox()
  const dot = await hotspot(page).boundingBox()
  if (!target || !dot) throw new Error('missing boxes')
  // The 24px dot is centered on the target's top-right corner.
  expect(Math.abs(dot.x + dot.width / 2 - (target.x + target.width))).toBeLessThanOrEqual(2)
  expect(Math.abs(dot.y + dot.height / 2 - target.y)).toBeLessThanOrEqual(2)
}

test('appears over the target and follows it on scroll', async ({ page }) => {
  await page.goto('/')
  await expect(hotspot(page)).toBeVisible()
  await expectOverTarget(page)
  await page.mouse.wheel(0, 60)
  await page.waitForFunction(() => window.scrollY >= 60)
  await expect
    .poll(async () => (await hotspot(page).boundingBox())?.y)
    .toBeLessThan(((await exportButton(page).boundingBox())?.y ?? 0) + 1)
  await expectOverTarget(page)
  // Hidden once the target scrolls out of view.
  await page.evaluate(() => window.scrollTo(0, 2000))
  await expect(hotspot(page)).toBeHidden()
})

test('tooltip: opens on click, "Got it" marks read and survives reloads', async ({ page }) => {
  const clicks: string[] = []
  await page.exposeFunction('recordClick', (id: string) => clicks.push(id))
  await page.addInitScript(() =>
    document.addEventListener('shipdot:hotspot-click', (e) =>
      // biome-ignore lint/suspicious/noExplicitAny: test hook exposed by Playwright
      (window as any).recordClick((e as CustomEvent<{ id: string }>).detail.id),
    ),
  )
  await page.goto('/')
  await hotspot(page).click()
  const tooltip = page.getByRole('dialog', { name: 'Export to Excel' })
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toContainText('with one click')
  expect(clicks).toEqual(['2026-10-14-export-excel'])
  await tooltip.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))

  const axe = await new AxeBuilder({ page })
    .include('.shipdot-layer')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(axe.violations).toEqual([])

  await tooltip.getByRole('button', { name: 'Got it' }).click()
  await expect(hotspot(page)).toHaveCount(0)
  await expect(page.getByRole('button', { name: "What's new" })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: "What's new" })).toBeVisible()
  await expect(hotspot(page)).toHaveCount(0)
})

test('is keyboard accessible and Esc returns focus to the dot', async ({ page }) => {
  await page.goto('/')
  await hotspot(page).focus()
  await page.keyboard.press('Enter')
  const tooltip = page.getByRole('dialog', { name: 'Export to Excel' })
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toBeFocused()
  await expect(hotspot(page)).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(tooltip).toBeHidden()
  await expect(hotspot(page)).toBeFocused()
  // Esc does not mark the entry as read.
  await expect(page.getByRole('button', { name: "What's new (1 unread)" })).toBeVisible()
})

test('stays hidden while the target is not visible', async ({ page }) => {
  await page.goto('/?hidden=1')
  await expect(page.locator('.shipdot-layer')).toHaveCount(1)
  await expect(hotspot(page)).toBeHidden()
  await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('#btn-export')
    if (button) button.style.display = ''
  })
  await expect(hotspot(page)).toBeVisible()
  await expectOverTarget(page)
})

test('hides when the target scrolls out of an inner scroll container', async ({ page }) => {
  await page.goto('/?pane=1')
  await expect(hotspot(page)).toBeVisible()
  await expectOverTarget(page)
  await page.locator('#pane').evaluate((pane) => pane.scrollTo(0, 150))
  await expect(hotspot(page)).toBeHidden()
  await page.locator('#pane').evaluate((pane) => pane.scrollTo(0, 0))
  await expect(hotspot(page)).toBeVisible()
  await expectOverTarget(page)
})

test('follows a target that moves without scrolling or resizing', async ({ page }) => {
  await page.goto('/?pane=1')
  await expect(hotspot(page)).toBeVisible()
  // Content inserted above the target inside a fixed-height pane: nothing scrolls or resizes.
  await page.locator('#pane').evaluate((pane) => {
    const banner = document.createElement('p')
    banner.style.cssText = 'height:40px;margin:0'
    pane.prepend(banner)
  })
  await expect
    .poll(() =>
      expectOverTarget(page).then(
        () => true,
        () => false,
      ),
    )
    .toBe(true)
  // A CSS transition moves it again.
  await exportButton(page).evaluate((button) => {
    button.style.transition = 'margin-left .1s'
    button.style.marginLeft = '80px'
  })
  await expect
    .poll(() =>
      expectOverTarget(page).then(
        () => true,
        () => false,
      ),
    )
    .toBe(true)
})

test('an open tooltip survives another entry being read', async ({ page }) => {
  // Everything unread, so reading the untargeted entries changes the read state.
  await page.addInitScript(() => localStorage.setItem('shipdot:default', '[]'))
  await page.goto('/')
  await hotspot(page).click()
  const tooltip = page.getByRole('dialog', { name: 'Export to Excel' })
  await expect(tooltip).toBeVisible()
  await page
    .locator('ship-dot')
    .evaluate((el: HTMLElement & { markRead(ids: string[]): void }) =>
      el.markRead(['2026-09-01-faster-search']),
    )
  await expect(page.getByRole('button', { name: "What's new (2 unread)" })).toBeVisible()
  await expect(tooltip).toBeVisible()
})

test('waits for targets rendered later (SPA)', async ({ page }) => {
  await page.goto('/?late=1')
  await expect(hotspot(page)).toBeVisible()
  await expectOverTarget(page)
})

test('opening the feed marks the entry read and removes its hotspot', async ({ page }) => {
  await page.goto('/')
  await expect(hotspot(page)).toBeVisible()
  await page.getByRole('button', { name: "What's new (1 unread)" }).click()
  await expect(hotspot(page)).toHaveCount(0)
})

test('respects prefers-reduced-motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect(hotspot(page)).toBeVisible()
  const animation = await hotspot(page).evaluate(
    (el) => getComputedStyle(el, '::after').animationName,
  )
  expect(animation).toBe('none')
})
