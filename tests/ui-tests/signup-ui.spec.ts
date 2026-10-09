import { test, expect } from '../../src/fixtures/base.fixture';
import { knownBug } from '../../src/utils/known-bug';
import { SignupPage } from '../../src/pages/signup.page';
import { signupFormData, signupFormPayload, validPassword } from '../../src/factories/user.factory';
import { waitMs } from '../../src/utils/wait';




// Records a created account for cleanup, but only after the API returned 201. 
async function recordCreated(response: import('@playwright/test').Response, created: { id: number; email: string; accessToken: string }[]) {
  expect(response.status(), 'account creation should return 201').toBe(201);
  const body = await response.json();
  created.push({ id: body.account.id, email: body.account.email, accessToken: body.token?.accessToken ?? '' });
}

const validForm = (overrides: Parameters<typeof signupFormData>[0] = {}) => signupFormData(overrides);


test.describe('Positive', () => {
  test('submits the form with consent unticked and gets no error', async ({ page, signupPath }) => {
    // API is mocked: the UI check is that the form sends the right request. No real account is created.
    const sent: Record<string, unknown>[] = [];
    await page.route('**/api/accounts', (route) => {
      sent.push(route.request().postDataJSON());
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ account: { id: 0 }, token: { accessToken: '' } }) });
    });
    const signup = new SignupPage(page);
    const form = { ...validForm(), consent: false };
    await signup.open(signupPath);
    await signup.fill(form);
    await signup.submitForm();

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      region: 'ON',
      leadDistributeConsentAgreement: false,
    });
  });
});

test.describe('Negative', () => {
  test('empty submit shows the required message and sends no request', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);

    const requests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/accounts')) requests.push(r.url()); });

    await signup.submitForm();
    await expect(page.getByText(strings.errors.required).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${signupPath}$`));
    expect(requests).toHaveLength(0);
  });

  test('invalid email shows the invalid email message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.fill({ email: 'not-an-email' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.invalidEmail)).toBeVisible();
  });

  test('invalid phone shows the invalid value message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.fill({ phone: '123' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.invalidValue).first()).toBeVisible();
  });

  test('digits in a name show the invalid name message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.fill({ firstName: 'Test1' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.invalidName)).toBeVisible();
  });

  test('a password shorter than 12 characters shows the minimum message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.fill({ password: 'QaShort1' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.passwordMinimum)).toBeVisible();
  });

  test('mismatched confirm password shows the mismatch message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.fill({ password: validPassword(), confirmPassword: validPassword() });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.passwordsMismatch)).toBeVisible();
  });

  test('invalid form sends no account request', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.fill({ firstName: 'Test1', email: 'not-an-email', phone: '123', password: 'QaShort1', confirmPassword: 'QaShort2' });

    const requests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/accounts')) requests.push(r.url()); });
    await signup.submitForm();

    await expect(page.getByText(strings.errors.invalidName)).toBeVisible();
    await expect(page.getByText(strings.errors.passwordsMismatch)).toBeVisible();
    // Wait for all network activity to settle, then confirm nothing was sent.
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(0);
  });
});

test.describe('Server responses', () => {
  // The API is mocked here so each status is exercised deterministically.
  for (const status of [400, 409, 500] as const) {
    test(`API ${status} shows the generic error and stays on signup`, async ({ page, strings, signupPath }) => {
      await page.route('**/api/accounts', (route) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'bad format' }) }),
      );
      const signup = new SignupPage(page);
      await signup.open(signupPath);
      await signup.fill(validForm());
      await signup.submitForm();

      await expect(page.getByText(strings.errors.serverError)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${signupPath}$`));
    });
  }

  test('a duplicate email shows the generic error and stays on signup (real API)', async ({ page, strings, signupPath, createdAccounts }) => {
    const signup = new SignupPage(page);
    const form = validForm();

    // First signup succeeds and is recorded for cleanup.
    await signup.open(signupPath);
    const first = page.waitForResponse((r) => r.url().endsWith('/api/accounts') && r.request().method() === 'POST');
    await signup.fill(form);
    await signup.submitForm();
    await recordCreated(await first, createdAccounts);

    // Second signup with the same email is rejected.
    await signup.open(signupPath);
    const second = page.waitForResponse((r) => r.url().endsWith('/api/accounts') && r.request().method() === 'POST');
    await signup.fill(form);
    await signup.submitForm();
    expect((await second).status()).toBe(400);

    await expect(page.getByText(strings.errors.serverError)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${signupPath}$`));
  });
});

test.describe('Error clearing', () => {
  test('a field error clears once the field is corrected and the form is resubmitted', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.fill({ email: 'not-an-email' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.invalidEmail)).toBeVisible();

    await signup.fill({ email: signupFormData().email });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.invalidEmail)).toHaveCount(0);
  });
});

test.describe('Phone country and province', () => {
  test('is exposed to assistive tech with the accessible name "Phone number country"', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await expect(page.getByRole('combobox', { name: strings.labels.phoneCountry })).toBeVisible();
  });

  test('tapping it opens the country list, and choosing a country sticks', async ({ page, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    // A native select opens its list on click; the list itself is drawn by the OS.
    // Check the control is focused and populated, then choose a country and confirm it stuck.
    await signup.phoneCountry.click();
    await expect(signup.phoneCountry).toBeFocused();
    const count = await signup.phoneCountry.locator('option').count();
    expect(count).toBeGreaterThan(200);
    await signup.phoneCountry.selectOption({ label: 'Canada' });
    await expect(signup.phoneCountry).toHaveValue('CA');
  });

  test('province list contains the 13 provinces and territories', async ({ page, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    const codes = await signup.region.locator('option:not([disabled])').evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    expect(codes).toEqual(['ON', 'QC', 'AB', 'BC', 'MB', 'NB', 'NS', 'NL', 'PE', 'SK', 'NT', 'YT', 'NU']);
  });

  test('phone country offers Canada and preselects a country', async ({ page, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    // The preselected country follows the visitor's location (see ASSUMPTIONS.md), so only check it is set.
    await expect(signup.phoneCountry.locator('option:checked')).not.toHaveText('');
    await expect(signup.phoneCountry.locator('option', { hasText: /^Canada$/ })).toHaveCount(1);
  });
});

test.describe('Phone country sets the dialing code', () => {
  const cases = [
    { country: 'France', code: 'FR', prefix: '+33' },
    { country: 'United States', code: 'US', prefix: '+1' },
    { country: 'Canada', code: 'CA', prefix: '+1' },
  ];

  for (const c of cases) {
    test(`choosing ${c.country} changes the country and sends ${c.prefix}`, async ({ page, signupPath }) => {
      // API is mocked: the check is what the form sends. No real account is created.
      const sent: Record<string, unknown>[] = [];
      await page.route('**/api/accounts', (route) => {
        sent.push(route.request().postDataJSON());
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ account: { id: 0 }, token: { accessToken: '' } }) });
      });
      const signup = new SignupPage(page);
      await signup.open(signupPath);

      await signup.phoneCountry.selectOption({ label: c.country });
      await expect(signup.phoneCountry).toHaveValue(c.code);
      // The flag icon next to the phone field follows the same country.
      const flag = page.locator('img.PhoneInputCountryIconImg');
      await expect(flag).toHaveAttribute('alt', c.country);
      await expect(flag).toHaveAttribute('src', new RegExp(`/${c.code}\\.svg$`));

      await signup.fill({ ...validForm(), phoneCountry: c.country, consent: true });
      await signup.submitForm();

      await expect.poll(() => sent.length).toBe(1);
      expect(String(sent[0].phone)).toMatch(new RegExp(`^\\${c.prefix}`));
    });
  }
});

test.describe('Province list follows the country', () => {
  test('selecting a non-Canadian phone country replaces the Canadian provinces', knownBug('BUG-11'), async ({ page, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);
    await signup.phoneCountry.selectOption({ label: 'United States' });

    const provinces = await signup.region.locator('option').allTextContents();
    expect(provinces).not.toContain('Ontario');
  });
});

test.describe('Autofill', () => {
  // Assumption (see ASSUMPTIONS.md): standard autocomplete tokens. 
  // The page currently sets none on name/email, and uses autocomplete="off" on the password fields.
  test('form fields declare autocomplete tokens for browser autofill', knownBug('BUG-08'), async ({ page, signupPath }) => {
    const signup = new SignupPage(page);
    await signup.open(signupPath);

    await expect(signup.firstName).toHaveAttribute('autocomplete', 'given-name');
    await expect(signup.lastName).toHaveAttribute('autocomplete', 'family-name');
    await expect(signup.email).toHaveAttribute('autocomplete', 'email');
    await expect(signup.password).toHaveAttribute('autocomplete', 'new-password');
    await expect(signup.confirmPassword).toHaveAttribute('autocomplete', 'new-password');
  });
});

