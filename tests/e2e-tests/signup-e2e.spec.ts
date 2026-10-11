import { test, expect, attachFullPageOnFailure } from '../../src/fixtures/base.fixture';
import { SignupPage, NAV } from '../../src/pages/signup.page';
import { signupFormData } from '../../src/factories/user.factory';
import { waitMs } from '../../src/utils/wait';
import { knownBug } from '../../src/utils/known-bug';
import AxeBuilder from '@axe-core/playwright';
import * as en from '../../config/locales/en.json';

//Signup E2E checks: static page copy from the locale files. Runs in both en and fr

// Full-page screenshot on failure.
test.afterEach(async ({ page }, testInfo) => {
  await attachFullPageOnFailure(page, testInfo);
});

test.describe('Field and label coverage', () => {
  test('shows the heading, labels, placeholders and submit text from the locale', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);

    await expect(page).toHaveTitle(strings.pageTitle);
    await expect(page.getByText(strings.heading, { exact: true })).toBeVisible();
    await expect(signup.submit).toHaveText(strings.submit);

    await expect(signup.firstName).toHaveAttribute('placeholder', strings.labels.firstName);
    await expect(signup.lastName).toHaveAttribute('placeholder', strings.labels.lastName);
    await expect(signup.phone).toHaveAttribute('placeholder', strings.labels.phone);
    await expect(signup.email).toHaveAttribute('placeholder', strings.labels.email);
    await expect(signup.password).toHaveAttribute('placeholder', strings.labels.password);
    await expect(signup.confirmPassword).toHaveAttribute('placeholder', strings.labels.confirmPassword);
    await expect(signup.region).toContainText(strings.labels.region);
  });

  test('each field has a visible label and the matching accessible name', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);

    const fields = [
      [signup.firstName, strings.labels.firstName],
      [signup.lastName, strings.labels.lastName],
      [signup.phone, strings.labels.phone],
      [signup.region, strings.labels.region],
      [signup.email, strings.labels.email],
      [signup.password, strings.labels.password],
      [signup.confirmPassword, strings.labels.confirmPassword],
    ] as const;
    for (const [field, label] of fields) {
      await expect(field, label).toBeVisible();
      await expect(field).toHaveAccessibleName(label);
    }
    await expect(signup.consent).toHaveAccessibleName(strings.consent);
  });

  // BUG-13: the phone-country control keeps its English name on /fr/signup.
  test('phone country has a localized accessible name (EN)', async ({ page, strings, signupPath, lang }) => {
    test.skip(lang !== 'en', 'English page only; the French case is tracked as BUG-13');
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await expect(signup.phoneCountry).toHaveAccessibleName(strings.labels.phoneCountry);
  });

  test('phone country has a localized accessible name (FR)', knownBug('BUG-13'), async ({ page, strings, signupPath, lang }) => {
    test.skip(lang !== 'fr', 'French page only');
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await expect(signup.phoneCountry).toHaveAccessibleName(strings.labels.phoneCountry);
  });

  // BUG-06: the French rule reads "doit contenir au entre 12 et 32 caractères".
  test('password rule under the field is worded correctly (EN)', async ({ page, strings, signupPath, lang }) => {
    test.skip(lang !== 'en', 'English page only; the French case is tracked as BUG-06');
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await expect(page.getByText(strings.passwordHelp, { exact: true })).toBeVisible();
  });

  test('password rule under the field is worded correctly (FR)', knownBug('BUG-06'), async ({ page, strings, signupPath, lang }) => {
    test.skip(lang !== 'fr', 'French page only');
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await expect(page.getByText(strings.passwordHelp, { exact: true })).toBeVisible();
  });

  test('uses the right input types', async ({ page, signupPath, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);

    await expect(signup.phone).toHaveAttribute('type', 'tel');
    await expect(signup.password).toHaveAttribute('type', 'password');
    await expect(signup.confirmPassword).toHaveAttribute('type', 'password');
    await expect(signup.consent).toHaveAttribute('type', 'checkbox');
    await expect(signup.consent).not.toBeChecked();
  });

  test('shows the marketing consent text', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);

    await expect(page.getByText(strings.consent, { exact: true })).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  // Automated WCAG 2.1 A/AA scan with axe. It catches only part of accessibility issues;
  // screen-reader and keyboard review are still manual.
  const scan = (page: import('@playwright/test').Page) =>
    new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();

  test('signup form has no WCAG A/AA violations on load', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    expect((await scan(page)).violations).toEqual([]);
  });

  test('signup form has no WCAG A/AA violations while showing field errors', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.submitForm();
    await expect(page.getByText(strings.errors.required).first()).toBeVisible();
    expect((await scan(page)).violations).toEqual([]);
  });
});

/**
 * Switches language once, to the target language.
 * Desktop: header FR/EN link. Narrow screens: the language dropdown inside the burger menu.
 */
test.describe('Navigation', () => {
  test('language switch goes EN to FR and back, and FR to EN and back', async ({ page, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    const start = lang === 'fr' ? '/fr/signup' : '/signup';
    const other = lang === 'fr' ? '/signup' : '/fr/signup';
    const otherLang = lang === 'fr' ? 'en' : 'fr';
    await signup.open(start);
    test.skip(await signup.isPhoneLayout(), 'desktop header switch; phones use the burger menu (see Mobile burger menu)');

    await signup.switchLanguage(lang, otherLang);
    await expect(page).toHaveURL(new RegExp(`${other}$`));
    await expect(signup.htmlElement).toHaveAttribute('lang', otherLang);

    await signup.switchLanguage(otherLang, lang);
    await expect(page).toHaveURL(new RegExp(`${start}$`));
    await expect(signup.htmlElement).toHaveAttribute('lang', lang);
  });
});

test.describe('Login links', () => {
  test('header Login button opens the login page', { tag: '@smoke' }, async ({ page, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');
    test.skip(await signup.isPhoneLayout(), 'desktop header login; phones use the burger menu (see Mobile burger menu)');

    const loginLink = signup.pageLink(NAV[lang].headerLogin, true);
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);
    // Auth0 login form (served in English in both projects).
    await expect(signup.auth0Email).toBeVisible();
  });

  test('"Already have an account? Log in" opens the login page', async ({ page, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    await signup.pageLink(NAV[lang].formLogin).click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);
  });

  test('login page "Don\'t have an account?" returns to signup', async ({ page, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    await signup.pageLink(NAV[lang].formLogin).click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);

    await signup.pageLink(NAV[lang].authSignup).click();
    await expect(page).toHaveURL(/\/signup$/);
    // Test ID, not label: on this route every field shares one id and label (BUG-09).
    await expect(page.getByTestId('first-name-input')).toBeVisible();
  });

  test('fields keep their own labels after returning from the login page', knownBug('BUG-09'), async ({ page, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    await signup.pageLink(NAV[lang].formLogin).click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);
    await signup.pageLink(NAV[lang].authSignup).click();
    await expect(page).toHaveURL(/\/signup$/);

    // The return route renders in English, whatever the starting language.
    const { labels } = en;
    await expect(page.getByTestId('first-name-input')).toHaveAccessibleName(labels.firstName);
    await expect(page.getByTestId('last-name-input')).toHaveAccessibleName(labels.lastName);
    await expect(page.getByTestId('email-input')).toHaveAccessibleName(labels.email);
    await expect(page.getByTestId('password-input')).toHaveAccessibleName(labels.password);
  });
});

test.describe('Legal links', () => {
  test('Terms of Service link opens the terms page', { tag: '@smoke' }, async ({ page, request, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    const popupPromise = page.waitForEvent('popup');
    await signup.pageLink(NAV[lang].terms).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(NAV[lang].termsUrl);

    const res = await request.get(NAV[lang].termsUrl, { failOnStatusCode: false });
    expect(res.status()).toBe(200);
  });

  test('Privacy Policy link opens the privacy page', { tag: '@smoke' }, async ({ page, request, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    const popupPromise = page.waitForEvent('popup');
    await signup.pageLink(NAV[lang].privacy).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(NAV[lang].privacyUrl);

    const res = await request.get(NAV[lang].privacyUrl, { failOnStatusCode: false });
    expect(res.status()).toBe(200);
  });
});

test.describe('Successful signup', () => {
  // Creates one real account per language. Tagged @pr-smoke so it still runs on every push and pull
  // request: it is the only check there of the real 201 contract through the form.
  test('creates an account, returns 201 and lands on Get A Quote', { tag: ['@smoke', '@creates-account', '@pr-smoke'] }, async ({ page, signupPath, createdAccounts, strings, lang }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);

    const form = signupFormData();
    const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/accounts') && r.request().method() === 'POST');
    await signup.fill(form);
    await signup.submitForm();

    const response = await responsePromise;
    expect(response.status(), 'account creation should return 201').toBe(201);
    const body = await response.json();
    createdAccounts.push({ id: body.account.id, email: body.account.email, accessToken: body.token?.accessToken ?? '' });

    // The response echoes what was typed into the form (phone in E.164, region as its code).
    expect(body.account).toMatchObject({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: `+1${form.phone}`,
      region: 'ON',
      preferredLanguage: lang,
      leadDistributeConsentAgreement: form.consent,
    });
    expect(JSON.stringify(body), 'the response must not echo the password').not.toContain(form.password);

    await page.waitForURL(/\/getaquote(\/[a-z]{2})?$/, { timeout: waitMs('veryLong') });
    await expect(page).toHaveURL(/\/getaquote(\/[a-z]{2})?$/);
  });
});

test.describe('Mobile burger menu', () => {
  // Phone layout only: the desktop header has these links in view, so the test skips there.
  const requirePhone = async (signup: SignupPage) => {
    if (!(await signup.isPhoneLayout())) test.skip(true, 'phone layout only');
  };

  test('Terms of service in the burger menu opens the terms page', async ({ page, request, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');
    await requirePhone(signup);

    await signup.openHeaderMenu();
    const popupPromise = page.waitForEvent('popup');
    await signup.menuLink(NAV[lang].terms).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(NAV[lang].termsUrl);

    const res = await request.get(NAV[lang].termsUrl, { failOnStatusCode: false });
    expect(res.status()).toBe(200);
  });

  for (const key of ['howItWorks', 'careers'] as const) {
    test(`${key} in the burger menu opens the page in a new tab`, async ({ page, request, lang, strings }) => {
      const signup = new SignupPage(page, strings);
      await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');
      await requirePhone(signup);

      await signup.openHeaderMenu();
      const link = { name: NAV[lang][key], url: NAV[lang][`${key}Url`] };
      const popupPromise = page.waitForEvent('popup');
      await signup.menuLink(link.name).click();
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      await expect(popup).toHaveURL(link.url);

      const res = await request.get(link.url, { failOnStatusCode: false });
      expect(res.status()).toBe(200);
    });
  }

  test('Privacy policy in the burger menu opens the privacy page', async ({ page, request, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');
    await requirePhone(signup);

    await signup.openHeaderMenu();
    const popupPromise = page.waitForEvent('popup');
    await signup.menuLink(NAV[lang].privacy).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(NAV[lang].privacyUrl);

    const res = await request.get(NAV[lang].privacyUrl, { failOnStatusCode: false });
    expect(res.status()).toBe(200);
  });

  test('language switch in the burger menu goes EN to FR and back, and FR to EN and back', async ({ page, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    const start = lang === 'fr' ? '/fr/signup' : '/signup';
    const other = lang === 'fr' ? '/signup' : '/fr/signup';
    const otherLang = lang === 'fr' ? 'en' : 'fr';
    await signup.open(start);
    await requirePhone(signup);

    await signup.switchLanguage(lang, otherLang);
    await expect(page).toHaveURL(new RegExp(`${other}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', otherLang);

    await signup.switchLanguage(otherLang, lang);
    await expect(page).toHaveURL(new RegExp(`${start}$`));
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  });

  test('Login in the burger menu opens the login page', { tag: '@smoke' }, async ({ page, lang, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');
    await requirePhone(signup);

    await signup.openHeaderMenu();
    await signup.menuLink(NAV[lang].headerLogin).click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);
    await expect(signup.auth0Email).toBeVisible();
  });
});
