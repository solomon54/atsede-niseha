/**
 * Shared email validation rules.
 *
 * This module is intentionally dependency-free so it can run unchanged in the
 * Next.js server/browser bundles and in the Expo React Native client. It only
 * performs syntax and blocklist checks; MX/DNS verification lives in
 * `src/services/email/email.service.ts` because it requires Node's `dns`.
 */

export type EmailValidationCode =
  | "EMPTY"
  | "INVALID_FORMAT"
  | "PLACEHOLDER"
  | "DISPOSABLE"
  | "VALID";

export interface EmailValidationResult {
  valid: boolean;
  code: EmailValidationCode;
  message: string;
  normalized: string;
}

/**
 * Domains that are reserved for documentation/examples (RFC 2606 / RFC 6761)
 * or are commonly typed by people filling in fake records.
 */
const PLACEHOLDER_DOMAINS = new Set([
  "example.com",
  "example.net",
  "example.org",
  "example.edu",
  "test.com",
  "test.net",
  "test.org",
  "fake.com",
  "fake.net",
  "fake.org",
  "invalid.com",
  "invalid.net",
  "invalid.org",
  "sample.com",
  "sample.net",
  "sample.org",
  "placeholder.com",
  "placeholder.net",
  "placeholder.org",
  "domain.com",
  "mydomain.com",
  "yourdomain.com",
  "your-domain.com",
  "company.com",
  "mycompany.com",
  "noemail.com",
  "no-email.com",
  "none.com",
  "null.com",
  "abc.com",
  "xyz.com",
  "asdf.com",
  "qwerty.com",
  "foo.com",
  "bar.com",
  "baz.com",
  "localhost",
  "localhost.localdomain",
]);

/**
 * Reserved TLDs that can never receive real mail.
 */
const RESERVED_TLDS = new Set(["test", "example", "invalid", "localhost"]);

/**
 * Well-known disposable / temporary mailbox providers. The list does not need
 * to be exhaustive: it catches the services most people reach for when they
 * do not want to give a real address.
 */
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "33mail.com",
  "anonbox.net",
  "anonymousemail.me",
  "burner.kiwi",
  "discard.email",
  "discardmail.com",
  "discardmail.de",
  "dispostable.com",
  "dropmail.me",
  "emailfake.com",
  "emailondeck.com",
  "fakeinbox.com",
  "generator.email",
  "getairmail.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "harakirimail.com",
  "incognitomail.com",
  "incognitomail.net",
  "incognitomail.org",
  "inboxkitten.com",
  "jetable.org",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mailinator.net",
  "mailnesia.com",
  "mail-temp.com",
  "mail.tm",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "nada.email",
  "pokemail.net",
  "sharklasers.com",
  "sogetthis.com",
  "spam.la",
  "spam4.me",
  "spamfree24.com",
  "spamfree24.de",
  "spamfree24.eu",
  "spamfree24.info",
  "spamfree24.net",
  "spamfree24.org",
  "spamgourmet.com",
  "spamgourmet.net",
  "spamgourmet.org",
  "spamthis.co.uk",
  "tempail.com",
  "tempemail.com",
  "tempemail.net",
  "tempinbox.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "tempmail.org",
  "tempmailaddress.com",
  "tempr.email",
  "tempsky.com",
  "throwaway.email",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "trashmail.net",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
]);

/**
 * Local parts that are almost always placeholders rather than a person.
 * Plus-addressing is stripped before comparison (`test+foo@…` → `test`).
 */
const PLACEHOLDER_LOCAL_PARTS = new Set([
  "test",
  "tests",
  "testing",
  "test1",
  "test123",
  "example",
  "sample",
  "demo",
  "dummy",
  "fake",
  "asdf",
  "qwerty",
  "noemail",
  "no-email",
  "no-reply",
  "noreply",
  "donotreply",
  "do-not-reply",
  "user",
  "username",
  "email",
]);

export const EMAIL_MESSAGES = {
  empty: "ኢሜይል ባዶ መሆን አይችልም (Email is required)",
  invalidFormat:
    "ትክክለኛ ኢሜይል አስገባ (example@domain.com) (Enter a valid email address)",
  placeholder:
    "የምሳሌ/የቦታ ያዥ ኢሜይል አይፈቀድም (Placeholder emails are not allowed)",
  disposable:
    "ጊዜያዊ/የሚጠፋ ኢሜይል አይፈቀድም (Disposable emails are not allowed)",
  noMx: "ይህ የኢሜይል ጎራ መልዕክት መቀበል አይችልም (This email domain cannot receive mail)",
  unreachable:
    "የኢሜይል ጎራውን ማረጋገጥ አልተቻለም (Could not verify the email domain)",
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DOMAIN_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Strict-ish RFC 5322 subset: one `@`, a non-empty local part, and a domain
 * with at least two labels. Rejects consecutive dots, leading/trailing dots,
 * spaces, and malformed domain labels.
 */
export function isValidEmailFormat(value: string): boolean {
  const email = normalizeEmail(value);
  if (!email || email.length > 254) return false;
  if (!EMAIL_PATTERN.test(email)) return false;

  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) return false;

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (local.length > 64) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }

  const labels = domain.split(".");
  if (labels.length < 2) return false;

  return labels.every((label) => DOMAIN_LABEL_PATTERN.test(label));
}

function matchesDomainSet(domain: string, domains: Set<string>): boolean {
  if (domains.has(domain)) return true;

  // Catch subdomains of blocked providers (e.g. foo.mailinator.com).
  const labels = domain.split(".");
  for (let i = 1; i < labels.length - 1; i += 1) {
    if (domains.has(labels.slice(i).join("."))) return true;
  }

  return false;
}

export function isPlaceholderEmail(value: string): boolean {
  const email = normalizeEmail(value);
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return false;

  const local = email.slice(0, atIndex).split("+")[0];
  const domain = email.slice(atIndex + 1);

  if (PLACEHOLDER_LOCAL_PARTS.has(local)) return true;
  if (matchesDomainSet(domain, PLACEHOLDER_DOMAINS)) return true;

  const tld = domain.split(".").pop() ?? "";
  return RESERVED_TLDS.has(tld);
}

export function isDisposableEmail(value: string): boolean {
  const email = normalizeEmail(value);
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return false;

  const domain = email.slice(atIndex + 1);
  return matchesDomainSet(domain, DISPOSABLE_DOMAINS);
}

/**
 * Synchronous validation suitable for both client forms and API handlers.
 * DNS/MX verification must be layered on top for server-side checks.
 */
export function validateEmailAddress(
  value: string | null | undefined
): EmailValidationResult {
  const normalized = typeof value === "string" ? normalizeEmail(value) : "";

  if (!normalized) {
    return {
      valid: false,
      code: "EMPTY",
      message: EMAIL_MESSAGES.empty,
      normalized,
    };
  }

  if (!isValidEmailFormat(normalized)) {
    return {
      valid: false,
      code: "INVALID_FORMAT",
      message: EMAIL_MESSAGES.invalidFormat,
      normalized,
    };
  }

  if (isPlaceholderEmail(normalized)) {
    return {
      valid: false,
      code: "PLACEHOLDER",
      message: EMAIL_MESSAGES.placeholder,
      normalized,
    };
  }

  if (isDisposableEmail(normalized)) {
    return {
      valid: false,
      code: "DISPOSABLE",
      message: EMAIL_MESSAGES.disposable,
      normalized,
    };
  }

  return {
    valid: true,
    code: "VALID",
    message: "",
    normalized,
  };
}
