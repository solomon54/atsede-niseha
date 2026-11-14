import { resolve4, resolveMx } from "node:dns/promises";

import {
  EMAIL_MESSAGES,
  type EmailValidationCode,
  validateEmailAddress,
} from "@/shared/validations/email";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Brevo sender identity.
 *
 * `BREVO_SENDER_EMAIL` must be the address (or domain) verified in the Brevo
 * dashboard. Without a purchased domain Brevo still allows a single verified
 * sender address, which is why this provider was chosen.
 */
const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();
const BREVO_SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL?.trim() || "atsedenis@gmail.com";
const BREVO_SENDER_NAME =
  process.env.BREVO_SENDER_NAME?.trim() || "ዐጸደ ንስሐ";

export type EmailDeliverabilityCode =
  | EmailValidationCode
  | "NO_MX"
  | "DNS_ERROR";

export interface EmailDeliverabilityResult {
  valid: boolean;
  code: EmailDeliverabilityCode;
  message: string;
  normalized: string;
}

interface DomainCheck {
  valid: boolean;
  code: "VALID" | "NO_MX" | "DNS_ERROR";
  message: string;
  expiresAt: number;
}

const DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;
const domainCache = new Map<string, DomainCheck>();

async function domainAcceptsMail(domain: string): Promise<DomainCheck> {
  const cached = domainCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached;

  let result: DomainCheck;

  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords.length > 0) {
      result = { valid: true, code: "VALID", message: "", expiresAt: 0 };
    } else {
      // RFC 5321 allows falling back to an A/AAAA record when no MX exists.
      const aRecords = await resolve4(domain);
      result =
        aRecords.length > 0
          ? { valid: true, code: "VALID", message: "", expiresAt: 0 }
          : {
              valid: false,
              code: "NO_MX",
              message: EMAIL_MESSAGES.noMx,
              expiresAt: 0,
            };
    }
  } catch {
    try {
      const aRecords = await resolve4(domain);
      result =
        aRecords.length > 0
          ? { valid: true, code: "VALID", message: "", expiresAt: 0 }
          : {
              valid: false,
              code: "NO_MX",
              message: EMAIL_MESSAGES.noMx,
              expiresAt: 0,
            };
    } catch (error) {
      console.error(`[Email Verification Failed for domain: ${domain}]`, error);
      result = {
        valid: false,
        code: "DNS_ERROR",
        message: EMAIL_MESSAGES.unreachable,
        expiresAt: 0,
      };
    }
  }

  result.expiresAt = Date.now() + DOMAIN_CACHE_TTL_MS;
  domainCache.set(domain, result);
  return result;
}

/**
 * Validates syntax + placeholder/disposable blocklists and checks that the
 * domain actually publishes mail routing (MX, with an A-record fallback).
 */
export async function verifyEmailDeliverability(
  email: string
): Promise<EmailDeliverabilityResult> {
  const syntax = validateEmailAddress(email);
  if (!syntax.valid) return syntax;

  const domain = syntax.normalized.split("@")[1];
  const domainCheck = await domainAcceptsMail(domain);

  return {
    valid: domainCheck.valid,
    code: domainCheck.code,
    message: domainCheck.message,
    normalized: syntax.normalized,
  };
}

/**
 * Sends the sanctuary token to the spiritual child via Brevo's transactional
 * email API. When no API key is configured (local development) the email is
 * logged instead so registration can still be exercised end-to-end.
 */
export async function sendChildRegistrationEmail(
  toEmail: string,
  childName: string,
  fatherName: string,
  token: string
) {
  if (!BREVO_API_KEY) {
    console.warn("[Email Service] BREVO_API_KEY not found. Email not sent.");
    console.warn(`[Mock Email] To: ${toEmail}, Token: ${token}`);
    return { success: true, mock: true };
  }

  // Next.js base URL - falls back to production domain
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://atsede-niseha-v1.vercel.app";
  const claimLink = `${baseUrl}/claim?token=${token}`;

  const htmlContent = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background-color: #fdfcf6; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f172a; text-align: center; font-size: 24px;">ዐጸደ ንስሐ</h2>
      <p style="text-align: center; color: #b45309; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">Ecclesiastical Gateway</p>

      <hr style="border-color: #fef3c7; margin: 20px 0;" />

      <p style="color: #334155; font-size: 16px;">
        የተከበሩ <strong>${childName}</strong>፣
      </p>
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        በአባታችን <strong>${fatherName}</strong> የንስሐ ልጅ ሆነው ስለተመዘገቡ እንኳን ደስ አለዎት።
        <br />
        ይህ የቃል ኪዳን ቁልፍዎ (Token) ነው። ይህንን ቁልፍ በመጠቀም ወደ ሥርዓቱ መግባት ይችላሉ።
      </p>

      <div style="background-color: #0f172a; padding: 24px; border-radius: 12px; text-align: center; margin: 30px 0;">
        <p style="color: #94a3b8; font-size: 12px; letter-spacing: 2px; margin-bottom: 12px;">የእርስዎ መለያ (TOKEN)</p>
        <p style="color: #fbbf24; font-size: 24px; font-family: monospace; font-weight: bold; margin: 0; letter-spacing: 4px;">
          ${token}
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <a href="${claimLink}" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; letter-spacing: 2px; display: inline-block;">
          ወደ ሲስተሙ ይግቡ (ACCESS ACCOUNT)
        </a>
      </div>

      <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 24px; line-height: 1.6;">
        አልተሳካም ካለዎት ይህን ሊንክ ይጠቀሙ፦<br />
        <a href="${claimLink}" style="color: #b45309; word-break: break-all;">${claimLink}</a>
      </p>

      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 40px; line-height: 1.5;">
        ይህ መልዕክት የተላከው በሲስተሙ ነው። እባክዎ ለዚህ ኢሜይል ምላሽ አይስጡ።<br />
        This is an automated message. Please do not reply.
      </p>
    </div>
  `;

  const textContent = [
    `ዐጸደ ንስሐ - መንፈሳዊ የቃል ኪዳን ቁልፍ`,
    ``,
    `የተከበሩ ${childName}፣`,
    `በአባታችን ${fatherName} የንስሐ ልጅ ሆነው ስለተመዘገቡ እንኳን ደስ አለዎት።`,
    ``,
    `የእርስዎ መለያ (TOKEN): ${token}`,
    ``,
    `ወደ ሲስተሙ ለመግባት: ${claimLink}`,
    ``,
    `ይህ መልዕክት የተላከው በሲስተሙ ነው። እባክዎ ለዚህ ኢሜይል ምላሽ አይስጡ።`,
    `This is an automated message. Please do not reply.`,
  ].join("\n");

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: [{ email: toEmail, name: childName }],
        subject:
          "ዐጸደ ንስሐ - መንፈሳዊ የቃል ኪዳን ቁልፍ (Your Spiritual Token)",
        htmlContent,
        textContent,
      }),
    });

    const data: unknown = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("[Brevo Email Sending Failed]", response.status, data);
      return { success: false, status: response.status, error: data };
    }

    return { success: true, data };
  } catch (error) {
    console.error("[Email Sending Failed]", error);
    return { success: false, error };
  }
}
