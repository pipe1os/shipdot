import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

const trigger = (page: Page) => page.getByRole('button', { name: /what's new|novedades/i })
const panel = (page: Page) => page.getByRole('dialog', { name: /what's new|novedades/i })

test.describe('feed panel', () => {
  test('shows the unread count, opens, marks read and persists across reloads', async ({
    page,
  }) => {
    await page.goto('/?hotspots=off')
    await expect(trigger(page)).toHaveAccessibleName("What's new (1 unread)")
    await expect(page.locator('ship-dot [part="badge"]')).toHaveText('1')

    await trigger(page).click()
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByRole('heading', { level: 3 })).toHaveText([
      'Export to Excel',
      'Faster search',
      'Dates are no longer off by one',
    ])
    await expect(panel(page).getByRole('link', { name: 'Learn more' })).toHaveAttribute(
      'href',
      'https://example.com/docs/export',
    )
    await expect(trigger(page)).toHaveAccessibleName("What's new")
    await expect(page.locator('ship-dot [part="badge"]')).toBeHidden()

    await page.reload()
    await expect(trigger(page)).toHaveAccessibleName("What's new")
  })

  test('opens with an error message when the feed fails to load', async ({ page }) => {
    await page.route('**/shipdot.json', (route) => route.fulfill({ status: 500 }))
    await page.goto('/?hotspots=off')
    await trigger(page).click()
    await expect(panel(page).getByRole('alert')).toHaveText(
      "Couldn't load updates. Try again later.",
    )
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()
    await expect(trigger(page)).toBeFocused()
  })

  test('reading in one tab clears the badge and hotspot in another', async ({ page, context }) => {
    await page.goto('/')
    const other = await context.newPage()
    await other.goto('/')
    await expect(trigger(other)).toHaveAccessibleName("What's new (1 unread)")
    await expect(other.getByRole('button', { name: 'New: Export to Excel' })).toBeVisible()

    await trigger(page).click()
    await expect(trigger(other)).toHaveAccessibleName("What's new")
    await expect(other.locator('.shipdot-layer')).toHaveCount(0)
  })

  test('popover: closes when focus tabs out of it, without moving focus', async ({ page }) => {
    await page.goto('/?hotspots=off')
    await trigger(page).focus()
    await page.keyboard.press('Enter')
    await expect(panel(page)).toBeVisible()
    const share = page.locator('#btn-share')
    for (let i = 0; i < 10 && !(await share.evaluate((el) => el === document.activeElement)); i++) {
      await expect(panel(page)).toBeVisible()
      await page.keyboard.press('Tab')
    }
    await expect(share).toBeFocused()
    await expect(panel(page)).toBeHidden()
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false')
  })

  test('first visit with mark-read starts with nothing unread', async ({ page }) => {
    await page.goto('/?first-visit=mark-read')
    await expect(trigger(page)).toHaveAccessibleName("What's new")
    await expect(page.locator('.shipdot-layer')).toHaveCount(0)
  })

  test('popover: keyboard open, Esc closes and returns focus, outside click closes', async ({
    page,
  }) => {
    await page.goto('/?hotspots=off')
    await trigger(page).focus()
    await page.keyboard.press('Enter')
    await expect(panel(page)).toBeVisible()
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(panel(page)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()
    await expect(trigger(page)).toBeFocused()
    await expect(trigger(page)).toHaveAttribute('aria-expanded', 'false')

    await trigger(page).click()
    await expect(panel(page)).toBeVisible()
    await page.getByRole('heading', { name: 'Dashboard' }).click()
    await expect(panel(page)).toBeHidden()

    // Clicking the trigger again toggles the panel closed.
    await trigger(page).click()
    await trigger(page).click()
    await expect(panel(page)).toBeHidden()
  })

  test('popover: opens above a trigger near the bottom of the viewport', async ({ page }) => {
    await page.goto('/?hotspots=off&bottom=1')
    await trigger(page).click()
    await expect(panel(page)).toBeVisible()
    const button = await trigger(page).boundingBox()
    const box = await panel(page).boundingBox()
    if (!button || !box) throw new Error('missing boxes')
    expect(box.y + box.height).toBeLessThanOrEqual(button.y)
    expect(box.y).toBeGreaterThanOrEqual(0)
  })

  test('popover: stays above the trigger when its content grows (images loading)', async ({
    page,
  }) => {
    await page.goto('/?hotspots=off&bottom=1')
    await trigger(page).click()
    await expect(panel(page)).toBeVisible()
    await panel(page)
      .getByRole('list')
      .evaluate((list) => list.insertAdjacentHTML('beforeend', '<li style="height:120px"></li>'))
    const button = await trigger(page).boundingBox()
    const box = await panel(page).boundingBox()
    if (!button || !box) throw new Error('missing boxes')
    expect(box.y + box.height).toBeLessThanOrEqual(button.y)
  })

  for (const mode of ['drawer', 'modal'] as const) {
    test(`${mode}: traps focus, closes with Esc and the close button`, async ({ page }) => {
      await page.goto(`/?hotspots=off&mode=${mode}`)
      await trigger(page).click()
      const dialog = panel(page)
      await expect(dialog).toBeVisible()
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Tab')
        const inside = await page.evaluate(() => {
          const host = document.querySelector('ship-dot')
          const active = host?.shadowRoot?.activeElement
          return Boolean(active?.closest('dialog'))
        })
        expect(inside).toBe(true)
      }
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(trigger(page)).toBeFocused()

      await trigger(page).click()
      await dialog.getByRole('button', { name: 'Close' }).click()
      await expect(dialog).toBeHidden()
    })
  }

  test('translates the UI and entries with the locale attribute', async ({ page }) => {
    await page.goto('/?hotspots=off&locale=es')
    await expect(trigger(page)).toHaveAccessibleName('Novedades (1 sin leer)')
    await trigger(page).click()
    await expect(panel(page).getByRole('heading', { level: 3 }).first()).toHaveText(
      'Exportar a Excel',
    )
    // Entries without a translation fall back to the default locale.
    await expect(panel(page).getByRole('heading', { level: 3 }).nth(1)).toHaveText('Faster search')
    await expect(panel(page).locator('.tag').first()).toHaveText('Nuevo')
  })
})

test.describe('accessibility (axe)', () => {
  for (const mode of ['popover', 'drawer', 'modal'] as const)
    for (const theme of ['light', 'dark'] as const)
      test(`open ${mode} panel in ${theme} theme has no violations`, async ({ page }) => {
        await page.goto(`/?hotspots=off&mode=${mode}&theme=${theme}`)
        await trigger(page).click()
        await expect(panel(page)).toBeVisible()
        // Contrast is checked on the final frame, not halfway through the fade-in.
        await panel(page).evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))
        const results = await new AxeBuilder({ page })
          .include('ship-dot')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
        expect(results.violations).toEqual([])
      })
})
