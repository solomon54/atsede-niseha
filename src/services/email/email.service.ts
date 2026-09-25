import dns from "dns";
import { Resend } from "resend";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

// Ensure the RESEND_API_KEY is available. If not, fallback to console log for dev
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/**
 * Checks if the email domain has valid MX records (can receive emails).
 * This prevents typos like @gmail.co or @yaho.com
 */
export async function verifyEmailDeliverability(
  email: string
): Promise<boolean> {
  try {
    const domain = email.split("@")[1];
    if (!domain) return false;

    // Resolve MX records for the domain
    const records = await resolveMx(domain);
    return records && records.length > 0;
  } catch (error) {
    console.error(`[Email Verification Failed for domain]`, error);
    return false; // Domain likely doesn't exist or has no mail servers
  }
}

/**
 * Sends the sanctuary token to the spiritual child via email.
 */
export async function sendChildRegistrationEmail(
  toEmail: string,
  childName: string,
  fatherName: string,
  token: string
) {
  if (!resend) {
    console.warn("[Email Service] RESEND_API_KEY not found. Email not sent.");
    console.warn(`[Mock Email] To: ${toEmail}, Token: ${token}`);
    return { success: true, mock: true };
  }

  // Next.js base URL - falls back to production domain
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "https://atsede-niseha-v1.vercel.app";
  const claimLink = `${baseUrl}/claim?token=${token}`;

  try {
    const data = await resend.emails.send({
      // IMPORTANT: In production with Resend, you must verify your domain 
      // (e.g. noreply@yourdomain.com). For now we use the testing default.
      from: "Atsede Niseha <onboarding@resend.dev>",
      to: [toEmail],
      subject: "ዐጸደ ንስሐ - መንፈሳዊ የቃል ኪዳን ቁልፍ (Your Spiritual Token)",
      html: `
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
          
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 40px; line-height: 1.5;">
            ይህ መልዕክት የተላከው በሲስተሙ ነው። እባክዎ ለዚህ ኢሜይል ምላሽ አይስጡ።<br />
            This is an automated message. Please do not reply.
          </p>
        </div>
      `,
    });

    return { success: true, data };
  } catch (error) {
    console.error("[Email Sending Failed]", error);
    return { success: false, error };
  }
}
