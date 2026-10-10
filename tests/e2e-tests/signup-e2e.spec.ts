import { test, expect } from '../../src/fixtures/base.fixture';
import { SignupPage, NAV } from '../../src/pages/signup.page';
import { signupFormData } from '../../src/factories/user.factory';
import { waitMs } from '../../src/utils/wait';

//Signup E2E checks: static page copy from the locale files. Runs in both en and fr

test.describe('Field and label coverage', () => {
  test('shows the heading, labels, placeholders and submit text from the locale', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
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
    await expect(signup.phoneCountry).toHaveAttribute('aria-label', strings.labels.phoneCountry);
    await expect(signup.region).toContainText(strings.labels.region);
  });

  test('uses the right input types', async ({ page, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);

    await expect(signup.phone).toHaveAttribute('type', 'tel');
    await expect(signup.password).toHaveAttribute('type', 'password');
    await expect(signup.confirmPassword).toHaveAttribute('type', 'password');
    await expect(signup.consent).toHaveAttribute('type', 'checkbox');
    await expect(signup.consent).not.toBeChecked();
  });

  test('shows the marketing consent text', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);

    await expect(page.getByText(strings.consent, { exact: true })).toBeVisible();
  });
});

/**
 * Switches language once, to the target language.
 * Desktop: header FR/EN link. Narrow screens: the language dropdown inside the burger menu.
 */
test.describe('Navigation', () => {
  test('language switch goes EN to FR and back, and FR to EN and back', async ({ page, lang }) => {
    const signup = new SignupPage(page);
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
  test('header Login button opens the login page', { tag: '@smoke' }, async ({ page, lang }) => {
    const signup = new SignupPage(page);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');
    test.skip(await signup.isPhoneLayout(), 'desktop header login; phones use the burger menu (see Mobile burger menu)');

    const loginLink = signup.pageLink(NAV[lang].headerLogin, true);
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);
    // Auth0 login form (served in English in both projects).
    await expect(signup.auth0FirstInput).toBeVisible();
  });

  test('"Already have an account? Log in" opens the login page', async ({ page, lang }) => {
    const signup = new SignupPage(page);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    await signup.pageLink(NAV[lang].formLogin).click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);
  });

  test('login page "Don\'t have an account?" returns to signup', async ({ page, lang }) => {
    const signup = new SignupPage(page);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    await signup.pageLink(NAV[lang].formLogin).click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);

    await signup.pageLink(NAV[lang].authSignup).click();
    await expect(page).toHaveURL(/\/signup$/);
    await expect(signup.firstName).toBeVisible();
  });
});

test.describe('Legal links', () => {
  test('Terms of Service link opens the terms page', { tag: '@smoke' }, async ({ page, request, lang }) => {
    const signup = new SignupPage(page);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');

    const popupPromise = page.waitForEvent('popup');
    await signup.pageLink(NAV[lang].terms).click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    await expect(popup).toHaveURL(NAV[lang].termsUrl);

    const res = await request.get(NAV[lang].termsUrl, { failOnStatusCode: false });
    expect(res.status()).toBe(200);
  });

  test('Privacy Policy link opens the privacy page', { tag: '@smoke' }, async ({ page, request, lang }) => {
    const signup = new SignupPage(page);
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
  test('creates an account, returns 201 and lands on Get A Quote', { tag: '@smoke' }, async ({ page, signupPath, createdAccounts }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);

    const responsePromise = page.waitForResponse((r) => r.url().endsWith('/api/accounts') && r.request().method() === 'POST');
    await signup.fill(signupFormData());
    await signup.submitForm();

    const response = await responsePromise;
    expect(response.status(), 'account creation should return 201').toBe(201);
    const body = await response.json();
    createdAccounts.push({ id: body.account.id, email: body.account.email, accessToken: body.token?.accessToken ?? '' });

    await page.waitForURL(/\/getaquote(\/[a-z]{2})?$/, { timeout: waitMs('veryLong') });
    await expect(page).toHaveURL(/\/getaquote(\/[a-z]{2})?$/);
  });
});

test.describe('Mobile burger menu', () => {
  // Phone layout only: the desktop header has these links in view, so the test skips there.
  const requirePhone = async (signup: SignupPage) => {
    if (!(await signup.isPhoneLayout())) test.skip(true, 'phone layout only');
  };

  test('Terms of service in the burger menu opens the terms page', async ({ page, request, lang }) => {
    const signup = new SignupPage(page);
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
    test(`${key} in the burger menu opens the page in a new tab`, async ({ page, request, lang }) => {
      const signup = new SignupPage(page);
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

  test('Privacy policy in the burger menu opens the privacy page', async ({ page, request, lang }) => {
    const signup = new SignupPage(page);
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

  test('language switch in the burger menu goes EN to FR and back, and FR to EN and back', async ({ page, lang }) => {
    const signup = new SignupPage(page);
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

  test('Login in the burger menu opens the login page', { tag: '@smoke' }, async ({ page, lang }) => {
    const signup = new SignupPage(page);
    await signup.open(lang === 'fr' ? '/fr/signup' : '/signup');
    await requirePhone(signup);

    await signup.openHeaderMenu();
    await signup.menuLink(NAV[lang].headerLogin).click();
    await expect(page).toHaveURL(/auth\.nesto\.ca\/login/);
    await expect(signup.auth0FirstInput).toBeVisible();
  });
});
