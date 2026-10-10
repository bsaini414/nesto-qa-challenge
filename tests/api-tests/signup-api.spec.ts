import { APIRequestContext } from '@playwright/test';
import { knownBug } from '../../src/utils/known-bug';
import { test, expect, CreatedAccount } from '../../src/fixtures/base.fixture';
import { signupFormPayload, SignupPayload } from '../../src/factories/user.factory';


const ENDPOINT = '/api/accounts';

const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'region', 'language', 'password'] as const;


// POST a signup. Pass `created` only for valid signups so the fixture cleans them up.
async function post(request: APIRequestContext, data: object, created?: CreatedAccount[]) {
  const res = await request.post(ENDPOINT, { data, failOnStatusCode: false });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep raw text */ }
  if (created && res.status() === 201 && body?.account?.id) {
    created.push({ id: body.account.id, email: body.account.email, accessToken: body.token?.accessToken ?? '' });
  }
  return { status: res.status(), body };
}

// Password of exact length n that meets the policy (upper, lower, digit).
const passwordOfLength = (n: number) => 'Qa' + 'b'.repeat(n - 5) + 'Z9' + '1';

test.describe('Positive', { tag: '@smoke' }, () => {
  test('201 and response body echoes the submitted account (EN)', async ({ request, createdAccounts }) => {
    const payload = signupFormPayload({ language: 'en' });
    const { status, body } = await post(request, payload, createdAccounts);

    expect(status).toBe(201);
    expect(body.account.email).toBe(payload.email);
    expect(body.account.firstName).toBe(payload.firstName);
    expect(body.account.lastName).toBe(payload.lastName);
    expect(body.account.phone).toBe(payload.phone);
    expect(body.account.region).toBe(payload.region);
    expect(body.account.preferredLanguage).toBe('en');
    expect(body.account.partner).toBe('nesto');
    expect(body.account.role).toBe('borrower');
    expect(body.token?.accessToken).toBeTruthy();
  });

  test('201 and preferredLanguage follows the request (FR)', async ({ request, createdAccounts }) => {
    const payload = signupFormPayload({ language: 'fr' });
    const { status, body } = await post(request, payload, createdAccounts);

    expect(status).toBe(201);
    expect(body.account.preferredLanguage).toBe('fr');
    expect(body.account.email).toBe(payload.email);
  });

  for (const length of [12, 32]) {
    test(`201 for password at the ${length}-character boundary`, async ({ request, createdAccounts }) => {
      const password = passwordOfLength(length);
      expect(password.length).toBe(length);
      const { status } = await post(request, signupFormPayload({ password }), createdAccounts);
      expect(status).toBe(201);
    });
  }

  test('201 without marketing consent (consent is optional, see ASSUMPTIONS.md)', async ({ request, createdAccounts }) => {
    const { status } = await post(request, signupFormPayload({ leadDistributeConsentAgreement: false }), createdAccounts);
    expect(status).toBe(201);
  });
});

test.describe('Negative - field validation', { tag: '@smoke' }, () => {
  // status: expected per the spec (400 for format problems, 422 for field-level validation).
  const cases: Array<{ name: string; overrides: Partial<SignupPayload>; status: number; field?: string}> = [
    { name: 'email with no @', overrides: { email: 'qa.nodomain.qa-nesto.test' }, status: 422, field: 'email' },
    { name: 'email with no domain', overrides: { email: 'qa.user@' }, status: 422, field: 'email' },
    { name: 'email that is only whitespace', overrides: { email: '   ' }, status: 422, field: 'email' },
    { name: 'placeholder domain example.com', overrides: { email: 'qa.user@example.com' }, status: 422 },
    { name: 'region not a province code', overrides: { region: 'XX' }, status: 422, field: 'region' },
    { name: 'language not en/fr', overrides: { language: 'de' }, status: 422, field: 'language' },
    { name: 'firstName contains digits', overrides: { firstName: 'Spike1' }, status: 400 },
    { name: 'lastName contains digits', overrides: { lastName: 'Probe2' }, status: 400 },
    { name: 'phone too short', overrides: { phone: '123' }, status: 400 },
    { name: 'phone contains letters', overrides: { phone: 'abcdefghij' }, status: 400 },
    { name: 'password 11 characters', overrides: { password: passwordOfLength(11) }, status: 400 },
    { name: 'password 33 characters', overrides: { password: passwordOfLength(33) }, status: 400 },
    { name: 'password without uppercase', overrides: { password: 'qaspikepass12' }, status: 400 },
    { name: 'password without lowercase', overrides: { password: 'QASPIKEPASS12' }, status: 400 },
    { name: 'password without a digit', overrides: { password: 'QaSpikePasswordX' }, status: 400 },
  ];

  for (const c of cases) {
    const BUG_BY_CASE: Record<string, string> = {
      'firstName contains digits': 'BUG-02',
      'lastName contains digits': 'BUG-02',
      'phone too short': 'BUG-02',
      'phone contains letters': 'BUG-02',
      'password without uppercase': 'BUG-02',
      'password without lowercase': 'BUG-02',
      'password 11 characters': 'BUG-03',
      'password 33 characters': 'BUG-03',
      'password without a digit': 'BUG-03',
    };
    const bug = BUG_BY_CASE[c.name];
    const options = bug ? knownBug(bug) : {};
    test(`rejects ${c.name}`, options, async ({ request }) => {
      const { status, body } = await post(request, signupFormPayload(c.overrides));
      expect(status).toBe(c.status);
      if (c.field) {
        expect(body.error).toBe('invalid parameters');
        expect(body.parameters).toContain(c.field);
      }
    });
  }
});

test.describe('Negative - missing and wrong-type fields', { tag: '@smoke' }, () => {
  for (const field of ['firstName', 'lastName', 'phone', 'region', 'language'] as const) {
    test(`rejects a request with ${field} omitted`, knownBug('BUG-01'), async ({ request }) => {
      const payload: Record<string, unknown> = { ...signupFormPayload() };
      delete payload[field];
      const { status } = await post(request, payload);
      expect([400, 422]).toContain(status);
    });
  }

  test('rejects a request with password omitted', knownBug('BUG-03'), async ({ request }) => {
    const payload: Record<string, unknown> = { ...signupFormPayload() };
    delete payload.password;
    const { status } = await post(request, payload);
    expect([400, 422]).toContain(status);
  });

  test('rejects email omitted with 422 naming the email field', async ({ request }) => {
    const payload: Record<string, unknown> = { ...signupFormPayload() };
    delete payload.email;
    const { status, body } = await post(request, payload);
    expect(status).toBe(422);
    expect(body.parameters).toContain('email');
  });

  test('rejects null firstName', knownBug('BUG-01'), async ({ request }) => {
    const { status } = await post(request, signupFormPayload({ firstName: null as unknown as string }));
    expect([400, 422]).toContain(status);
  });

  test('rejects numeric firstName (wrong JSON type)', async ({ request }) => {
    const { status, body } = await post(request, signupFormPayload({ firstName: 12345 as unknown as string }));
    expect(status).toBe(400);
    expect(JSON.stringify(body)).toContain('cannot unmarshal number');
  });

  test('rejects string-typed consent flag (wrong JSON type)', async ({ request }) => {
    const { status, body } = await post(request, signupFormPayload({ leadDistributeConsentAgreement: 'yes' as unknown as boolean }));
    expect(status).toBe(400);
    expect(JSON.stringify(body)).toContain('cannot unmarshal string');
  });
});

test.describe('Negative - empty string combinations', { tag: '@smoke' }, () => {
  // Every single required field set to '', then every pair of them.
  const combos: string[][] = [];
  for (const f of REQUIRED_FIELDS) combos.push([f]);
  for (let i = 0; i < REQUIRED_FIELDS.length; i++) {
    for (let j = i + 1; j < REQUIRED_FIELDS.length; j++) {
      combos.push([REQUIRED_FIELDS[i], REQUIRED_FIELDS[j]]);
    }
  }

  const emptied = (fields: string[]) => {
    const overrides: Record<string, string> = {};
    for (const f of fields) overrides[f] = '';
    return overrides as Partial<SignupPayload>;
  };

  // Empty email is rejected with 422 (passes). Empty password returns 401 (BUG-03).
  // Any other empty combination is accepted with 201 (BUG-01).
  const bugFor = (fields: string[]) => {
    if (fields.includes('email')) return undefined;
    return fields.includes('password') ? 'BUG-03' : 'BUG-01';
  };

  for (const fields of combos) {
    const bug = bugFor(fields);
    const options = bug ? knownBug(bug) : {};
    test(`rejects empty string for: ${fields.join(' + ')}`, options, async ({ request }) => {
      const { status } = await post(request, signupFormPayload(emptied(fields)));
      expect([400, 422]).toContain(status);
    });
  }

  test('rejects every required field empty at once', async ({ request }) => {
    const { status } = await post(request, signupFormPayload(emptied([...REQUIRED_FIELDS])));
    expect([400, 422]).toContain(status);
  });

  test('rejects an empty JSON body', knownBug('BUG-04'), async ({ request }) => {
    const { status } = await post(request, {});
    expect([400, 422]).toContain(status);
  });
});

test.describe('Negative - duplicate account', { tag: '@smoke' }, () => {
  test('rejects a second signup with the same email with 409', knownBug('BUG-05'), async ({ request, createdAccounts }) => {
    const payload = signupFormPayload();
    const first = await post(request, payload, createdAccounts); // valid account: record for cleanup
    expect(first.status).toBe(201);

    const second = await post(request, payload);
    expect(second.status).toBe(409);
  });
});

test.describe('Valid input edge cases', { tag: '@smoke' }, () => {
  // Valid names and numbers that the API should accept.
  test('201 for a name with accents (Élodie)', async ({ request, createdAccounts }) => {
    const { status } = await post(request, signupFormPayload({ firstName: 'Élodie' }), createdAccounts);
    expect(status).toBe(201);
  });

  test("201 for a name with an apostrophe (O'Brien)", async ({ request, createdAccounts }) => {
    const { status } = await post(request, signupFormPayload({ lastName: "O'Brien" }), createdAccounts);
    expect(status).toBe(201);
  });

  test('201 for a phone with a non-Canadian country code', async ({ request, createdAccounts }) => {
    const { status, body } = await post(request, signupFormPayload({ phone: '+33145551234' }), createdAccounts);
    expect(status).toBe(201);
    expect(body.account.phone).toBe('+33145551234');
  });

  test('ignores an unknown extra field and still returns 201', async ({ request, createdAccounts }) => {
    const payload = { ...signupFormPayload(), unknownField: 'x' };
    const { status, body } = await post(request, payload, createdAccounts);
    expect(status).toBe(201);
    expect(JSON.stringify(body)).not.toContain('unknownField');
  });
});

test.describe('Input format and size', { tag: '@smoke' }, () => {
  test('422 for a firstName longer than the allowed length', async ({ request }) => {
    const { status, body } = await post(request, signupFormPayload({ firstName: 'A'.repeat(200) }));
    expect(status).toBe(422);
    expect(body.parameters).toContain('firstName');
  });

  test('422 for an email longer than the allowed length', async ({ request }) => {
    const { status, body } = await post(request, signupFormPayload({ email: `${'a'.repeat(240)}@qa-nesto.test` }));
    expect(status).toBe(422);
    expect(body.parameters).toContain('email');
  });

  test('422 for an uppercase region code (ON)', async ({ request }) => {
    const { status, body } = await post(request, signupFormPayload({ region: 'on' }));
    expect(status).toBe(422);
    expect(body.parameters).toContain('region');
  });

  test('422 for an uppercase language code (EN)', async ({ request }) => {
    const { status, body } = await post(request, signupFormPayload({ language: 'EN' }));
    expect(status).toBe(422);
    expect(body.parameters).toContain('language');
  });
});

test.describe('Request format', { tag: '@smoke' }, () => {
  test('400 for malformed JSON', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      headers: { 'content-type': 'application/json' },
      data: '{"firstName": "x",',
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });

  test('400 when the Content-Type is not JSON', async ({ request }) => {
    const res = await request.post(ENDPOINT, {
      headers: { 'content-type': 'text/plain' },
      data: JSON.stringify(signupFormPayload()),
      failOnStatusCode: false,
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Negative - duplicate email variants', { tag: '@smoke' }, () => {
  test('rejects a duplicate email that differs only in case', async ({ request, createdAccounts }) => {
    const payload = signupFormPayload();
    const first = await post(request, payload, createdAccounts);
    expect(first.status).toBe(201);

    const upper = await post(request, { ...payload, email: payload.email.toUpperCase() });
    expect([400, 409]).toContain(upper.status);
  });
});

test.describe('Negative - injection and whitespace', { tag: '@smoke' }, () => {
  // Assumption (see ASSUMPTIONS.md): names are plain text. Markup and SQL fragments
  // should be rejected, not stored. Current behaviour: accepted with 201 (BUG-07).
  test('rejects markup in firstName', knownBug('BUG-07'), async ({ request }) => {
    const { status } = await post(request, signupFormPayload({ firstName: '<script>x</script>' }));
    expect([400, 422]).toContain(status);
  });

  test('rejects a SQL fragment in lastName', knownBug('BUG-07'), async ({ request }) => {
    const { status } = await post(request, signupFormPayload({ lastName: "' OR 1=1 --" }));
    expect([400, 422]).toContain(status);
  });

  // Assumption: leading/trailing whitespace is trimmed or rejected, never stored as-is.
  // Current behaviour: trimmed (passes).
  test('trims or rejects leading whitespace in firstName', async ({ request }) => {
    const { status, body } = await post(request, signupFormPayload({ firstName: ' Spike' }));
    if (status === 201) {
      expect(body.account.firstName).toBe('Spike');
    } else {
      expect([400, 422]).toContain(status);
    }
  });
});
