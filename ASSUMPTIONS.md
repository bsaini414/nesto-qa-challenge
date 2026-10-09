# Assumptions



## API contract

- Creating an account returns `201`. I assume it's the only success status.
- The request needs the full body the signup form sends. Fields like
  `passwordSpecified` and the `*Specified` flags are included in every factory payload.
- The response has `account` (with `email`, `firstName`, `lastName`, `phone`,
  `region`, `preferredLanguage`, `partner`, `role`) and `token.accessToken`.
- Phone numbers come back in E.164 format (`+14165550123`). I compare them that way.
- Invalid email, region, or language returns `422` and names the field in `parameters`.
- Other bad input returns `400 {"error": "bad format"}`, with no field name.
- A password that breaks the rules should return `400`. `401` means an auth
  failure, so I don't expect it here (see BUG-03).
- A duplicate email should return `409`.(see BUG-05).
- An empty JSON body should return `400` or `422`, not `500` (see BUG-04).
- The API ignores the `Accept-Language` header. The only language input is the body field `language`.
- The API's error text is English in both languages. The French page shows its own messages, so users don't see the API text. 

## Validation rules

The signup form rejects these, so I expect the API to reject them too:

- Names contain no digits.
- Phone is a valid number.
- Password is 12 to 32 characters, with an uppercase letter, a lowercase letter, and a digit.
- Email is valid and not a placeholder domain.
- Required fields are not empty.

The API doesn't enforce several of these. See `BUG_REPORT.md`.

## Test data

- Test emails use the `.test` domain, for example `qa.<random>@qa-nesto.test`. The API accepts it.
- Placeholder domains (`example.com`, `example.org`, `test.com`) return `422`.
- Every request gets a new random email. Reusing one changes the result (see BUG-05).
- Only `@qa-nesto.test` addresses are used, so the QA team can find and remove test accounts.
- The form takes a national number (`416555XXXX`). The phone country selected in the form sets the dialing code sent to the API. Selecting France and entering `4165550123` sends `+334165550123` with the correct flag icon.


## Account cleanup

- I assume `DELETE /api/accounts/{id}` with the account's bearer token deletes the account.
- It doesn't work yet. DELETE, PATCH, and GET on `/api/accounts/{id}` and `/api/accounts/me`
  all return `404`. 

## Mocked and real API

- The UI success test mocks the `201`. It checks what the form sends. It does not check what the server does.
- A mocked `201` does not redirect. The page stays on `/signup`. The redirect to Get A Quote
  needs the real Auth0 flow, so that check is in the E2E tests.
- The duplicate-email test uses the real API, because it needs a real first account.
- The server error tests (`400`, `409`, `500`) mock the API, so each status gives a fixed result.
- The API test file covers the server's responses. The UI tests do not repeat them.

## Known defects

- Tests that hit a known defect fail on purpose. They are tagged with `knownBug('BUG-xx')`.


## Autofill

- Autocomplete tokens follow the WHATWG spec: `given-name`, `family-name`, `email`, `new-password`.
  These are expected values. The site doesn't document them.

## Language

- The API contract doesn't change with the page language.
- The French check on the API is the "preferredLanguage follows the request (FR)" test.


## API input that the server accepts or rejects

- Names with accents and apostrophes (`Élodie`, `O'Brien`) are accepted.
- Phone numbers from other countries (`+33...`) are accepted.
- Unknown extra fields are ignored and not returned.
- Names over 200 characters and emails over 250 characters return `422`. We don't know the exact limits.
- Region and language codes are case-sensitive. `on` and `EN` return `422`.
- Malformed JSON and a non-JSON content type return `400`.
- Leading and trailing spaces are trimmed (` Spike` is saved as `Spike`).
- Duplicate emails ignore case. A second signup with the same email in upper case is rejected.
  The test accepts `400` or `409`.
- Markup and SQL in names should be rejected. The API accepts them today (see BUG-07).

## Out of scope

- Login. It is a separate feature, so the suite only checks that the login links reach the login page.
- Validation messages shown by the UI. The API tests cover the server side.
