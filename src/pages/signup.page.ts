import { Page, Locator } from '@playwright/test';
import type { Locale } from '../fixtures/base.fixture';

export class SignupPage {
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly phoneCountry: Locator;
  readonly phone: Locator;
  readonly region: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly confirmPassword: Locator;
  readonly consent: Locator;
  readonly submit: Locator;
  readonly burgerButton: Locator;
  readonly burgerMenu: Locator;
  readonly headerLanguageSwitch: Locator;
  readonly menuNavigation: Locator;
  readonly htmlElement: Locator;
  // Email field on the Auth0 login form, after the signup page's Login link.
  readonly auth0Email: Locator;

  constructor(readonly page: Page, readonly strings: Locale) {
    const { labels } = strings;
    this.firstName = page.getByLabel(labels.firstName, { exact: true });
    this.lastName = page.getByLabel(labels.lastName, { exact: true });
    // By name, not label: its accessible name is not translated on /fr/signup (BUG-13).
    this.phoneCountry = page.locator('select[name="phoneCountry"]');
    this.phone = page.getByLabel(labels.phone, { exact: true });
    this.region = page.getByRole('combobox', { name: labels.region, exact: true });
    this.email = page.getByLabel(labels.email, { exact: true });
    this.password = page.getByLabel(labels.password, { exact: true });
    this.confirmPassword = page.getByLabel(labels.confirmPassword, { exact: true });
    this.consent = page.getByRole('checkbox');
    this.submit = page.getByRole('button', { name: strings.submit, exact: true });
    this.burgerButton = page.getByTestId('open-burger-menu');
    this.burgerMenu = page.getByTestId('burger-menu');
    this.headerLanguageSwitch = page.getByTestId('header-language-switch');
    this.menuNavigation = page.getByRole('navigation');
    this.htmlElement = page.locator('html');
    this.auth0Email = page.getByRole('textbox', { name: /email/i });
  }

  async open(path: string) {
    // The geolocation call is made by the client app once it has hydrated, so it
    // marks the point where the form is interactive (no networkidle, no sleeps).
    const hydrated = this.page.waitForResponse('**/api/geolocation/all');
    await this.page.goto(path);
    await hydrated;
    await this.firstName.waitFor();
  }

  async fill(data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    region?: string;
    phoneCountry?: string;
    consent?: boolean;
  }) {
    if (data.firstName !== undefined) await this.firstName.fill(data.firstName);
    if (data.lastName !== undefined) await this.lastName.fill(data.lastName);
    if (data.phoneCountry !== undefined) await this.phoneCountry.selectOption({ label: data.phoneCountry });
    if (data.phone !== undefined) await this.phone.fill(data.phone);
    if (data.email !== undefined) await this.email.fill(data.email);
    if (data.password !== undefined) await this.password.fill(data.password);
    if (data.confirmPassword !== undefined) await this.confirmPassword.fill(data.confirmPassword);
    if (data.region !== undefined) await this.region.selectOption({ label: data.region });
    if (data.consent) await this.consent.check();
  }

  async submitForm() {
    await this.submit.click();
  }

  /** On narrow screens the header links sit inside the burger menu. Open it when it is shown. */
  async openHeaderMenu() {
    if (await this.burgerButton.isVisible()) await this.burgerButton.click();
  }

  /** Link in the burger menu, by its visible text. */
  menuLink(name: string): Locator {
    // Non-exact: external links carry a suffix, e.g. "Terms of Service (opens in a new window)".
    return this.menuNavigation.getByRole('link', { name });
  }

  /** Link on the page (header or form), by its visible text. */
  pageLink(name: string, exact = false): Locator {
    return this.page.getByRole('link', { name, exact });
  }

  /** True on phone widths, where the header links are inside the burger menu. */
  async isPhoneLayout(): Promise<boolean> {
    return this.burgerButton.isVisible();
  }

  /**
   * Switches language once, to the target language.
   * Desktop: header FR/EN link. Narrow screens: the language dropdown inside the burger menu.
   */
  async switchLanguage(pageLang: 'en' | 'fr', target: 'en' | 'fr') {
    if (await this.isPhoneLayout()) {
      // The menu may already be open after a previous switch; clicking the burger again would close it.
      if (!(await this.burgerMenu.isVisible())) await this.openHeaderMenu();
      // The dropdown shows the current language; opening it lists both languages in a
      // popover rendered outside the menu, so the option is looked up on the page.
      await this.burgerMenu.getByText(LANGUAGE_NAME[pageLang][pageLang], { exact: true }).click();
      await this.page.getByText(LANGUAGE_NAME[pageLang][target], { exact: true }).click();
    } else {
      await this.headerLanguageSwitch.click();
    }
  }
}

// Link text and targets on the signup page
export const NAV = {
  en: {
    headerLogin: 'Login',
    formLogin: 'Log in',
    authSignup: "Don't have an account?",
    terms: 'Terms of Service',
    privacy: 'Privacy Policy',
    termsUrl: 'https://www.nesto.ca/terms-of-services/',
    privacyUrl: 'https://www.nesto.ca/privacy-policy/',
    howItWorks: 'How it works',
    howItWorksUrl: 'https://www.nesto.ca/#how',
    careers: 'Careers',
    careersUrl: 'https://www.nesto.ca/careers/',
  },
  fr: {
    headerLogin: 'Connexion',
    formLogin: 'Connectez-vous',
    authSignup: "Vous n'avez pas de compte ?",
    terms: "Conditions d'utilisation",
    privacy: 'politique de confidentialité',
    termsUrl: 'https://www.nesto.ca/fr/conditions-d-utilisation/',
    privacyUrl: 'https://www.nesto.ca/fr/politique-de-confidentialite/',
    howItWorks: 'Notre approche',
    howItWorksUrl: 'https://www.nesto.ca/fr/#how',
    careers: 'Carrières',
    careersUrl: 'https://www.nesto.ca/fr/carrieres/',
  },
} as const;

// The dropdown labels are translated with the page on /signup they read English and French, on /fr/signup Anglais and Français.
const LANGUAGE_NAME: Record<'en' | 'fr', Record<'en' | 'fr', string>> = {
  en: { en: 'English', fr: 'French' },
  fr: { en: 'Anglais', fr: 'Français' },
};
