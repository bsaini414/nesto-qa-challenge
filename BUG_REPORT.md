# Signup bugs

Endpoint: `POST https://app.qa.nesto.ca/api/accounts`


Tests that cover these are in `tests/signup-api.spec.ts`. They fail today.

---

### BUG-01: Empty or missing required fields create an account (high)

The API returns `201` and creates an account when `firstName`, `lastName`, `phone`, `region`, or `language` is missing, empty (`""`), or `null`. The signup page blocks these fields with "The field is required".

Repro: send a valid payload with `"firstName": ""`. Confirmed from the browser console on the signup page: `201`.

Expected: `400` or `422`, no account created.

Failing tests: `rejects a request with <field> omitted`, `rejects null firstName`, `rejects empty string for: ...`.

---

### BUG-02: Invalid values are accepted (high)

The API creates an account for values the signup page rejects:

- `firstName` or `lastName` with digits (`Tests1234`): `201`
- `phone` too short (`123`) or with letters: `201`
- Password with no uppercase letter, or no lowercase letter: `201`

Expected: `400` for each.

Failing tests: `rejects firstName contains digits`, `rejects lastName contains digits`, `rejects phone too short`, `rejects phone contains letters`, `rejects password without uppercase`, `rejects password without lowercase`.

---

### BUG-03: Password errors return 401 (medium)

A password that is too short (11), too long (33), has no digit, or is missing or empty returns `401 {"error":"invalid password"}`. `401` means authentication failed, which does not apply to signup.

Expected: `400` (or `422`) naming the `password` field.

Failing tests: `rejects password 11 characters`, `rejects password 33 characters`, `rejects password without a digit`, `rejects a request with password omitted`, `rejects empty string for: password`.

---

### BUG-04: Empty JSON body returns 500 (medium)

`POST /api/accounts` with body `{}` returns `500 Internal Server Error`. Five of five attempts returned 500. Also reproduced from the browser console.

Expected: `400` or `422`.

Failing test: `rejects an empty JSON body`.

---

### BUG-05: Duplicate email returns 400 (low)

A second signup with the same email returns `400 {"error":"bad format"}`. The response does not say the email is already registered.

Expected: `409 Conflict` naming `email`  # assumption

Failing test: `rejects a second signup with the same email with 409`.

---

### Observation: most errors have no field name

Only email, region, and language errors return `422` with the field in `parameters`. Everything else returns `400 {"error":"bad format"}`

---

### BUG-06: French password rule has a grammar error (low)

The French password message reads "Le mot de passe doit contenir au entre 12 et 32 caractères...". The correct wording is "doit contenir entre 12 et 32 caractères". The same text appears in the error shown on submit and in the rule shown under the password field.

Repro: open `/fr/signup`, submit with an empty or short password, read the message.

Expected: "Le mot de passe doit contenir entre 12 et 32 caractères et contenir au moins une lettre majuscule, une lettre minuscule et un chiffre."

Failing tests: `shows the marketing consent text and the password rule` (fr), `password policy message is spelled correctly` (fr).

---

### BUG-07: Markup and SQL fragments are stored in names (high)

The API creates an account (`201`) when `firstName` is `<script>x</script>` or `lastName` is `' OR 1=1 --`. Names should be plain text. Storing markup or SQL in profile fields is a risk for any screen that later displays these values.

Expected: `400` or `422`, no account created. Note: this is our assumption that names are plain text; confirm the rule with the API team.

Failing tests: `rejects markup in firstName`, `rejects a SQL fragment in lastName`.

---

### BUG-08: Form fields are missing autocomplete attributes (medium)

Chrome flags "A form field has an id or name attribute that the browser's autofill recognizes... doesn't have an autocomplete attribute" (1 resource).

Checked on /signup:
- First name, last name, email, province, phone country, and the consent checkbox have no `autocomplete`.
- Phone has `autocomplete="tel"`.
- Password and confirm password have `autocomplete="off"`. Password managers ignore this, so users cannot autofill a new password.

Expected: `given-name`, `family-name`, `email`, `new-password` (both password fields).

Failing test: `form fields declare autocomplete tokens for browser autofill` (ui-tests).

---

### BUG-09: Duplicate form field IDs (medium, not reproduced)

Chrome's Issues panel reports "Multiple form field elements in the same form have the same id attribute value" on 7 resources. A user-supplied element dump lists these seven controls, which have ids field-2, field-4, field-6, field-8, field-10, field-12 and field-14.

Steps to Reproduce:
1. Navigate to https://app.qa.nesto.ca/signup
2. Click on Login button
3. After login page loads, tap on don't have an account
4. Look at the console of the app

---

### BUG-10: Clicking on Nesto icon navigated to login page

Steps to Reproduce:
1. Navigate to https://app.qa.nesto.ca/signup
2. Click on the nesto icon

Expected Result:  Nothing should happen
Actual Result: The app navigates to the login page

---

### BUG-11: Selecting another country doesn't change the province of purchase selection

Steps to Reproduce:
1. Navigate to https://app.qa.nesto.ca/signup
2. Select any phone country other than Canada (for example, United States).
3. Look at the "Province of purchase" list.

Expected Result: The province list updates to match the selected country.
Actual Result: The province list still contains only Canadian provinces (Ontario, Quebec, Alberta, and so on)

---


