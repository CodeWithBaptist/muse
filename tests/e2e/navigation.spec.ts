import { expect, test } from '@playwright/test';
import { mockAppApi } from './fixtures';

test('primary navigation changes routes and marks the active page', async ({
  page,
}) => {
  await mockAppApi(page);
  await page.goto('/chat');

  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  await expect(navigation).toBeVisible();
  await navigation.getByRole('link', { name: 'Discover' }).click();

  await expect(page).toHaveURL(/\/discover$/);
  await expect(
    page.getByRole('heading', { name: 'Discover', level: 1 }),
  ).toBeVisible();
  await expect(
    navigation.getByRole('link', { name: 'Discover' }),
  ).toHaveAttribute('aria-current', 'page');
});

test('mobile tabs fit standard phone widths, expose all routes, and clear the chat input', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 360, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    let height = window.innerHeight;
    const listeners: Record<string, Set<() => void>> = {};
    const viewport = {
      get height() {
        return height;
      },
      get offsetTop() {
        return 0;
      },
      get scale() {
        return 1;
      },
      addEventListener(type: string, listener: () => void) {
        (listeners[type] ??= new Set()).add(listener);
      },
      removeEventListener(type: string, listener: () => void) {
        listeners[type]?.delete(listener);
      },
    };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    });
    Object.defineProperty(window, '__setVisualViewportHeight', {
      configurable: true,
      value(next: number) {
        height = next;
        listeners.resize?.forEach((listener) => listener());
      },
    });
  });
  await mockAppApi(page);
  await page.goto('/chat');

  const navigation = page.getByRole('navigation', {
    name: 'Primary navigation',
  });
  const expectedLabels = [
    'Chat',
    'Discover',
    'Library',
    'Playlists',
    'Profile',
    'Settings',
  ];

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(navigation).toBeVisible();
    for (const label of expectedLabels) {
      await expect(navigation.getByRole('link', { name: label })).toBeVisible();
    }
    await expect(
      navigation.getByRole('link', { name: 'Chat' }),
    ).toHaveAttribute('aria-current', 'page');

    const layout = await navigation.evaluate((nav) => {
      const rect = nav.getBoundingClientRect();
      const links = [...nav.querySelectorAll('a')].map((link) => {
        const linkRect = link.getBoundingClientRect();
        const label = link.querySelector('span');
        return {
          width: linkRect.width,
          height: linkRect.height,
          labelSize: label ? getComputedStyle(label).fontSize : '0px',
        };
      });
      return {
        position: getComputedStyle(nav).position,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        width: rect.width,
        links,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });

    expect(layout.position).toBe('fixed');
    expect(layout.left).toBe(0);
    expect(layout.right).toBe(width);
    expect(layout.width).toBe(width);
    expect(layout.links).toHaveLength(6);
    for (const link of layout.links) {
      expect(link.width).toBeGreaterThanOrEqual(44);
      expect(link.height).toBeGreaterThanOrEqual(44);
      expect(parseFloat(link.labelSize)).toBeGreaterThanOrEqual(12);
    }
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  }

  await navigation.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    navigation.getByRole('link', { name: 'Settings' }),
  ).toHaveAttribute('aria-current', 'page');

  await page.goto('/chat');
  const composer = page.getByRole('form', { name: 'Send a message to MUSE' });
  const composerRect = await composer.boundingBox();
  const navigationRect = await navigation.boundingBox();
  expect(composerRect).not.toBeNull();
  expect(navigationRect).not.toBeNull();
  expect(composerRect!.y + composerRect!.height).toBeLessThanOrEqual(
    navigationRect!.y + 1,
  );

  await page.getByRole('textbox', { name: 'Message MUSE' }).focus();
  const keyboardLayout = await page.evaluate(() => {
    const windowWithViewportControl = window as Window & {
      __setVisualViewportHeight?: (height: number) => void;
    };
    windowWithViewportControl.__setVisualViewportHeight?.(500);
    const shell = document.querySelector('.muse-shell');
    const tabs = document.querySelector('.muse-bottom-tabs');
    const form = document.querySelector(
      'form[aria-label="Send a message to MUSE"]',
    );
    const shellRect = shell?.getBoundingClientRect();
    const tabsRect = tabs?.getBoundingClientRect();
    const formRect = form?.getBoundingClientRect();
    return {
      keyboardVisible: document.documentElement.dataset.keyboardVisible,
      shellPosition: shell && getComputedStyle(shell).position,
      shellHeight: shellRect?.height,
      tabsTop: tabsRect?.top,
      tabsBottom: tabsRect?.bottom,
      composerBottom: formRect?.bottom,
    };
  });
  expect(keyboardLayout.keyboardVisible).toBe('true');
  expect(keyboardLayout.shellPosition).toBe('fixed');
  expect(keyboardLayout.shellHeight).toBe(500);
  expect(keyboardLayout.tabsBottom).toBe(500);
  expect(keyboardLayout.composerBottom).toBeLessThan(keyboardLayout.tabsTop!);
  await page.evaluate(() => {
    const windowWithViewportControl = window as Window & {
      __setVisualViewportHeight?: (height: number) => void;
    };
    windowWithViewportControl.__setVisualViewportHeight?.(844);
  });
  await expect(page.locator('html')).not.toHaveAttribute(
    'data-keyboard-visible',
    'true',
  );

  await page.setViewportSize({ width: 360, height: 844 });
  const displayTrigger = page.getByRole('button', { name: 'Display settings' });
  await displayTrigger.click();
  const displaySheet = page.getByRole('dialog', { name: 'Display settings' });
  await expect(displaySheet).toBeVisible();
  const sheetLayout = await displaySheet.evaluate((sheet) => {
    const rect = sheet.getBoundingClientRect();
    return {
      position: getComputedStyle(sheet).position,
      modal: sheet.getAttribute('aria-modal'),
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
    };
  });
  expect(sheetLayout.position).toBe('fixed');
  expect(sheetLayout.modal).toBe('true');
  expect(sheetLayout.left).toBeGreaterThanOrEqual(16);
  expect(sheetLayout.right).toBeLessThanOrEqual(344);
  expect(sheetLayout.top).toBeGreaterThanOrEqual(0);
  expect(sheetLayout.bottom).toBeLessThanOrEqual(844);

  await page.keyboard.press('Escape');
  await expect(displaySheet).toBeHidden();
  await expect(displayTrigger).toBeFocused();

  for (const [width, modal] of [
    [639, true],
    [640, false],
  ] as const) {
    await page.setViewportSize({ width, height: 844 });
    await displayTrigger.click();
    await expect(displaySheet).toBeVisible();
    if (modal) {
      await expect(displaySheet).toHaveAttribute('aria-modal', 'true');
    } else {
      await expect(displaySheet).not.toHaveAttribute('aria-modal');
    }
    await page.keyboard.press('Escape');
    await expect(displaySheet).toBeHidden();
  }

  await context.close();
});

test('sidebar and top bar switch at 768px', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 767, height: 900 },
  });
  const page = await context.newPage();
  await mockAppApi(page);
  await page.goto('/chat');

  const bottomNavigation = page.getByTestId('bottom-tabs');
  const sidebar = page.getByRole('complementary', {
    name: 'Application sidebar',
  });
  const topBar = page.getByRole('banner', { name: 'App header' });

  for (const width of [767, 768, 834, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    if (width < 768) {
      await expect(bottomNavigation).toBeVisible();
      await expect(sidebar).toBeHidden();
      await expect(topBar).toBeVisible();
    } else {
      await expect(bottomNavigation).toBeHidden();
      await expect(sidebar).toBeVisible();
      await expect(topBar).toBeHidden();
    }
  }

  await page.setViewportSize({ width: 768, height: 900 });
  const displayTrigger = page.getByRole('button', { name: 'Display settings' });
  await displayTrigger.click();
  const displayPopover = page.getByRole('dialog', { name: 'Display settings' });
  await expect(displayPopover).toBeVisible();
  const popover = await displayPopover.boundingBox();
  expect(popover).not.toBeNull();
  expect(popover!.x).toBeGreaterThanOrEqual(0);
  expect(popover!.y).toBeGreaterThanOrEqual(0);
  expect(popover!.x + popover!.width).toBeLessThanOrEqual(768);
  expect(popover!.y + popover!.height).toBeLessThanOrEqual(900);
  await page.keyboard.press('Escape');
  await expect(displayPopover).toBeHidden();

  await context.close();
});

test('the skip link receives first focus and moves focus to main content', async ({
  page,
}) => {
  await mockAppApi(page);
  await page.goto('/chat');

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await page.keyboard.press('Tab');
  await expect(skipLink).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.getByRole('main')).toBeFocused();
});

test('reduced-motion preference avoids smooth page scrolling', async ({
  page,
}) => {
  await mockAppApi(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const reducedMotion = await page.evaluate(() => ({
    matches: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));

  expect(reducedMotion.matches).toBe(true);
  expect(reducedMotion.scrollBehavior).toBe('auto');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
