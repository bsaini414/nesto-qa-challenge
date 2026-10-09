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
  },
  fr: {
    headerLogin: 'Connexion',
    formLogin: 'Connectez-vous',
    authSignup: "Vous n'avez pas de compte ?",
    terms: "Conditions d'utilisation",
    privacy: 'politique de confidentialité',
    termsUrl: 'https://www.nesto.ca/fr/conditions-d-utilisation/',
    privacyUrl: 'https://www.nesto.ca/fr/politique-de-confidentialite/',
  },
} as const;
