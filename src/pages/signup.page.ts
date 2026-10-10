import { Page, Locator } from '@playwright/test';
import { waitMs } from '../utils/wait';


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
  readonly cookieAccept: Locator;
  readonly burgerButton: Locator;
  readonly burgerLanguageName: Locator;
  readonly headerLanguageSwitch: Locator;
  readonly menuNavigation: Locator;
  readonly htmlElement: Locator;
  /** First input on the Auth0 login form, after the signup page's Login link. */
  readonly auth0FirstInput: Locator;

  constructor(readonly page: Page) {
    this.firstName = page.locator('input[name="firstName"]');
    this.lastName = page.locator('input[name="lastName"]');
    this.phoneCountry = page.locator('select[name="phoneCountry"]');
    this.phone = page.locator('input[name="phone"]');
    this.region = page.locator('select[aria-label="region"]');
    this.email = page.locator('input[name="email"]');
    this.password = page.locator('input[name="password"]');
    this.confirmPassword = page.locator('input[name="passwordConfirmation"]');
    this.consent = page.locator('input[name="leadDistributeConsentAgreement"]');
    this.submit = page.locator('button[type="submit"]');
    this.cookieAccept = page.getByRole('button', { name: /agree and close|accepter|fermer/i });
    this.burgerButton = page.getByTestId('open-burger-menu');
    this.burgerLanguageName = page.locator('[class*="burger-menu_language-button-name"]');
    this.headerLanguageSwitch = page.getByTestId('header-language-switch');
    this.menuNavigation = page.getByRole('navigation');
    this.htmlElement = page.locator('html');
    this.auth0FirstInput = page.locator('input').first();
  }

  async open(path: string) {
    // networkidle: the form must be hydrated before fields are filled
    await this.page.goto(path, { waitUntil: 'networkidle' });
    await this.firstName.waitFor();
    await this.dismissCookieBanner();
  }

  async dismissCookieBanner() {
    const banner = this.cookieAccept.first();
    const appeared = await banner
      .waitFor({ state: 'visible', timeout: waitMs('long') })
      .then(() => true)
      .catch(() => false);
    if (!appeared) return;
    await banner.click();
    await banner.waitFor({ state: 'hidden', timeout: waitMs('long') });
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
      const langName = this.burgerLanguageName;
      // The menu may already be open after a previous switch; clicking the burger again would close it.
      if (!(await langName.isVisible())) await this.openHeaderMenu();
      await langName.click();
      await this.page.locator('span', { hasText: new RegExp(`^${LANGUAGE_NAME[pageLang][target]}$`) }).first().click();
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
} as const;// The dropdown labels are translated with the page: on /signup they read English and French, on /fr/signup Anglais and Français.
const LANGUAGE_NAME: Record<'en' | 'fr', Record<'en' | 'fr', string>> = {
  en: { en: 'English', fr: 'French' },
  fr: { en: 'Anglais', fr: 'Français' },
};


