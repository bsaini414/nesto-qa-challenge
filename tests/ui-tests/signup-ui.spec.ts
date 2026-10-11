import { test, expect, attachFullPageOnFailure } from '../../src/fixtures/base.fixture';
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


// Full-page screenshot on failure.
test.afterEach(async ({ page }, testInfo) => {
  await attachFullPageOnFailure(page, testInfo);
});

test.describe('Positive', () => {
  test('submits the form with consent unticked and gets no error', { tag: '@smoke' }, async ({ page, signupPath, strings }) => {
    // API is mocked: the UI check is that the form sends the right request. No real account is created.
    const sent: Record<string, unknown>[] = [];
    await page.route('**/api/accounts', (route) => {
      sent.push(route.request().postDataJSON());
      route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ account: { id: 0 }, token: { accessToken: '' } }) });
    });
    const signup = new SignupPage(page, strings);
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
  // Negative UI tests never create a real account. The API is mocked, and any request that reaches it is recorded.
  test.beforeEach(async ({ page, strings }) => {
    await page.route('**/api/accounts', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ account: { id: 0 }, token: { accessToken: '' } }) });
      } else {
        route.continue();
      }
    });
  });

  test('empty submit shows the required message and sends no request', { tag: '@smoke' }, async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);

    const requests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/accounts')) requests.push(r.url()); });

    await signup.submitForm();
    await expect(page.getByText(strings.errors.required).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${signupPath}$`));
    expect(requests).toHaveLength(0);
  });


  test('invalid phone shows the invalid value message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill({ phone: '123' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.invalidValue).first()).toBeVisible();
  });

  test('digits in a name show the invalid name message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill({ firstName: 'Test1' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.invalidName)).toBeVisible();
  });

  test('a password shorter than 12 characters shows the minimum message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill({ password: 'QaShort1' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.passwordMinimum)).toBeVisible();
  });

  // Each required field left empty on an otherwise valid form shows its own message.
  const emptyFieldCases = [
    { field: 'firstName', testId: 'first-name', message: 'required' },
    { field: 'lastName', testId: 'last-name', message: 'required' },
    { field: 'phone', testId: 'phone', message: 'invalidValue' },
    { field: 'email', testId: 'email', message: 'invalidEmail' },
    { field: 'password', testId: 'password', message: 'passwordMinimum' },
    { field: 'confirmPassword', testId: 'passwordConfirmation', message: 'passwordsMismatch' },
  ] as const;

  for (const c of emptyFieldCases) {
    test(`leaving ${c.field} empty shows its message and sends no request`, async ({ page, strings, signupPath }) => {
      const signup = new SignupPage(page, strings);
      await signup.open(signupPath);
      await signup.fill({ ...validForm(), [c.field]: '' });

      const requests: string[] = [];
      page.on('request', (r) => { if (r.url().includes('/api/accounts')) requests.push(r.url()); });
      await signup.submitForm();

      await expect(page.getByTestId(`${c.testId}-error-message-typography`)).toHaveText(strings.errors[c.message]);
      expect(requests).toHaveLength(0);
    });
  }

  for (const email of ['not-an-email', 'qa.user@', 'qa@@qa-nesto.test']) {
    test(`malformed email "${email}" shows the invalid email message`, async ({ page, strings, signupPath }) => {
      const signup = new SignupPage(page, strings);
      await signup.open(signupPath);
      await signup.fill({ ...validForm(), email });
      await signup.submitForm();
      await expect(page.getByTestId('email-error-message-typography')).toHaveText(strings.errors.invalidEmail);
    });
  }

  test('a 33-character password shows the maximum message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    const password = `Qa1${'b'.repeat(30)}`;
    await signup.open(signupPath);
    await signup.fill({ ...validForm(), password, confirmPassword: password });
    await signup.submitForm();
    await expect(page.getByTestId('password-error-message-typography')).toHaveText(strings.errors.passwordMaximum);
  });

  for (const [missing, password] of [
    ['an uppercase letter', 'qalowercase12'],
    ['a lowercase letter', 'QAUPPERCASE12'],
    ['a digit', 'QaNoDigitsHere'],
  ] as const) {
    test(`a password without ${missing} shows the composition message`, async ({ page, strings, signupPath }) => {
      const signup = new SignupPage(page, strings);
      await signup.open(signupPath);
      await signup.fill({ ...validForm(), password, confirmPassword: password });
      await signup.submitForm();
      await expect(page.getByTestId('password-error-message-typography')).toHaveText(strings.errors.passwordComposition);
    });
  }

  test('mismatched confirm password shows the mismatch message', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill({ password: validPassword(), confirmPassword: validPassword() });
    await signup.region.selectOption({ value: 'QC' });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.passwordsMismatch)).toBeVisible();
  });

  // BUG-12: no province is set when the location lookup returns nothing. The lookup is mocked so the result does not depend on the runner.
  test('mismatch message shows with no province set (BUG-12)', knownBug('BUG-12'), async ({ page, strings, signupPath }) => {
    await page.route('**/api/geolocation/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ regionCode: 'XX', region: null }) }));
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill({ password: validPassword(), confirmPassword: validPassword() });
    await signup.submitForm();
    await expect(page.getByText(strings.errors.passwordsMismatch)).toBeVisible();
  });

  test('invalid form shows field errors with no province set and sends no request (BUG-12)', knownBug('BUG-12'), async ({ page, strings, signupPath }) => {
    await page.route('**/api/geolocation/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ regionCode: 'XX', region: null }) }));
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill({ firstName: 'Test1', email: 'not-an-email', phone: '123', password: 'QaShort1', confirmPassword: 'QaShort2' });

    const requests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/accounts')) requests.push(r.url()); });
    await signup.submitForm();

    await expect(page.getByText(strings.errors.invalidName)).toBeVisible();
    await expect(page.getByText(strings.errors.passwordsMismatch)).toBeVisible();
    // Errors are shown, so validation has run and blocked the submit.
    expect(requests).toHaveLength(0);
  });

  test('invalid form sends no account request', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill({ firstName: 'Test1', email: 'not-an-email', phone: '123', password: 'QaShort1', confirmPassword: 'QaShort2' });
    await signup.region.selectOption({ value: 'QC' });

    const requests: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/api/accounts')) requests.push(r.url()); });
    await signup.submitForm();

    await expect(page.getByText(strings.errors.invalidName)).toBeVisible();
    await expect(page.getByText(strings.errors.passwordsMismatch)).toBeVisible();
    // Errors are shown, so validation has run and blocked the submit.
    expect(requests).toHaveLength(0);
  });
});

test.describe('Server responses', () => {
  test('a network failure shows the generic error and stays on signup', async ({ page, strings, signupPath }) => {
    await page.route('**/api/accounts', (route) => route.abort('connectionrefused'));
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill(validForm());
    await signup.submitForm();

    await expect(page.getByText(strings.errors.serverError)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${signupPath}$`));
  });

  test('clicking submit again while the request is pending sends only one request', async ({ page, strings, signupPath }) => {
    // Hold the request open until both clicks are done, so the timing is deterministic.
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    let count = 0;
    await page.route('**/api/accounts', async (route) => {
      count++;
      await held;
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    await signup.fill(validForm());

    await signup.submitForm();
    await expect.poll(() => count).toBe(1);
    // While pending, the button's accessible name changes, so use its test ID here.
    const button = page.getByTestId('submit-button');
    await expect(button).toBeDisabled();
    await button.click({ force: true });
    release();

    await expect(page.getByText(strings.errors.serverError)).toBeVisible();
    expect(count).toBe(1);
  });
  // The API is mocked here so each status is exercised deterministically.
  for (const status of [400, 409, 500] as const) {
    test(`API ${status} shows the generic error and stays on signup`, status === 500 ? { tag: '@smoke' } : {}, async ({ page, strings, signupPath }) => {
      await page.route('**/api/accounts', (route) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ error: 'bad format' }) }),
      );
      const signup = new SignupPage(page, strings);
      await signup.open(signupPath);
      await signup.fill(validForm());
      await signup.submitForm();

      await expect(page.getByText(strings.errors.serverError)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${signupPath}$`));
    });
  }

  test('a duplicate email shows the generic error and stays on signup (real API)', { tag: '@creates-account' }, async ({ page, strings, signupPath, createdAccounts }) => {
    const signup = new SignupPage(page, strings);
    const form = validForm();

    // First signup succeeds and is recorded for cleanup.
    await signup.open(signupPath);
    const first = page.waitForResponse((r) => r.url().endsWith('/api/accounts') && r.request().method() === 'POST');
    await signup.fill(form);
    await signup.submitForm();
    await recordCreated(await first, createdAccounts);

    // Second signup with the same email is rejected. The status code is covered by the
    // API test (BUG-05); this test checks what the user sees.
    await signup.open(signupPath);
    await signup.fill(form);
    await signup.submitForm();

    await expect(page.getByText(strings.errors.serverError)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${signupPath}$`));
  });
});

test.describe('Error clearing', () => {
  test('a field error clears once the field is corrected and the form is resubmitted', async ({ page, strings, signupPath }) => {
    const signup = new SignupPage(page, strings);
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
  // The accessible-name check lives in the e2e "Field and label coverage" tests (BUG-13 for French).

  test('tapping it opens the country list, and choosing a country sticks', async ({ page, signupPath, strings }) => {
    const signup = new SignupPage(page, strings);
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

  test('province list contains the 13 provinces and territories', async ({ page, signupPath, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);
    const codes = await signup.region.locator('option:not([disabled])').evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
    expect(codes).toEqual(['ON', 'QC', 'AB', 'BC', 'MB', 'NB', 'NS', 'NL', 'PE', 'SK', 'NT', 'YT', 'NU']);
  });

  test('phone country offers Canada and preselects a country', async ({ page, signupPath, strings }) => {
    const signup = new SignupPage(page, strings);
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
    test(`choosing ${c.country} changes the country and sends ${c.prefix}`, c.country === 'France' ? { tag: '@smoke' } : {}, async ({ page, signupPath, strings }) => {
      // API is mocked: the check is what the form sends. No real account is created.
      const sent: Record<string, unknown>[] = [];
      await page.route('**/api/accounts', (route) => {
        sent.push(route.request().postDataJSON());
        route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ account: { id: 0 }, token: { accessToken: '' } }) });
      });
      const signup = new SignupPage(page, strings);
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

test.describe('Autofill', () => {
  // Assumption (see ASSUMPTIONS.md): standard autocomplete tokens. 
  // The page currently sets none on name/email, and uses autocomplete="off" on the password fields.
  test('form fields declare autocomplete tokens for browser autofill', knownBug('BUG-08'), async ({ page, signupPath, strings }) => {
    const signup = new SignupPage(page, strings);
    await signup.open(signupPath);

    await expect(signup.firstName).toHaveAttribute('autocomplete', 'given-name');
    await expect(signup.lastName).toHaveAttribute('autocomplete', 'family-name');
    await expect(signup.email).toHaveAttribute('autocomplete', 'email');
    await expect(signup.password).toHaveAttribute('autocomplete', 'new-password');
    await expect(signup.confirmPassword).toHaveAttribute('autocomplete', 'new-password');
  });
});
