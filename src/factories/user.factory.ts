import { faker } from '@faker-js/faker';


 // Signup UI payload sent to POST /api/accounts
export interface SignupPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  region: string;
  language: string;
  password: string;
  passwordSpecified: boolean;
  leadDistributeConsentAgreement: boolean;
  createdAt: string;
  postalCode: string;
  partialPostalCode: string;
  emailConsent: boolean;
  partnerAgreement: boolean;
  partnerAgreementSpecified: boolean;
  partner: string;
  subPartnerId: number;
  gaClientId: string;
  anonymousAccountId: string;
  marketingChannel: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  affiliateMarketingId: string | null;
  impressionsTrackingId: string | null;
  impressionsTrackingIdSpecified: boolean;
  direct: boolean;
  social: boolean;
  formName: string;
  cfProvince: string;
}

const lettersOnly = (value: string) => value.replace(/[^A-Za-z]/g, '');

// Unique, letters-only, `.test` email per call
export const uniqueEmail = (prefix = 'qa'): string =>
  `${prefix}.${faker.string.alpha({ length: 10, casing: 'lower' })}@qa-nesto.test`;

//Password that satisfies 12-32 chars, upper, lower and digit. 
export const validPassword = (): string =>
  `Qa${faker.string.alpha({ length: 8, casing: 'lower' })}Z9${faker.string.numeric(2)}`;

//Unique 10-digit Canadian phone number
export const uniqueNationalPhone = (): string => `416555${faker.string.numeric(4)}`;

export function signupFormData(overrides: Partial<{ phoneCountry: string; region: string; consent: boolean }> = {}) {
  const data = signupFormPayload();
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    phoneCountry: overrides.phoneCountry ?? 'Canada',
    phone: uniqueNationalPhone(),
    region: overrides.region ?? 'Ontario',
    email: data.email,
    password: data.password,
    confirmPassword: data.password,
    consent: overrides.consent ?? true,
  };
}

//Override any field to build a negative case
export function signupFormPayload(overrides: Partial<SignupPayload> = {}): SignupPayload {
  const region = overrides.region ?? 'ON';
  return {
    firstName: lettersOnly(faker.person.firstName()) || 'Qa',
    lastName: lettersOnly(faker.person.lastName()) || 'Tester',
    email: uniqueEmail(),
    phone: `+1416555${faker.string.numeric(4)}`,
    region,
    language: 'en',
    password: validPassword(),
    passwordSpecified: true,
    leadDistributeConsentAgreement: true,
    createdAt: 'LOGIN',
    postalCode: '',
    partialPostalCode: '',
    emailConsent: true,
    partnerAgreement: false,
    partnerAgreementSpecified: false,
    partner: 'nesto',
    subPartnerId: 0,
    gaClientId: '',
    anonymousAccountId: faker.string.alphanumeric(36),
    marketingChannel: 'Direct',
    utmSource: '(direct)',
    utmMedium: '(none)',
    utmCampaign: '(not set)',
    affiliateMarketingId: null,
    impressionsTrackingId: null,
    impressionsTrackingIdSpecified: false,
    direct: true,
    social: false,
    formName: 'signup',
    cfProvince: region,
    ...overrides,
  };
}

