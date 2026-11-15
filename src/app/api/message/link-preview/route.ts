// src/app/api/message/link-preview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/core/auth/requireSession";

/**
 * SSRF Protection: Reject private/internal IP ranges, localhost, and non-HTTPS protocols.
 */
function isPublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // Check for localhost, single-word hosts, or invalid domains
    if (
      hostname === "localhost" ||
      !hostname.includes(".") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname.endsWith(".lan")
    ) {
      return false;
    }

    // Check for IPv4 addresses
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const octet1 = parseInt(ipMatch[1], 10);
      const octet2 = parseInt(ipMatch[2], 10);

      // 127.0.0.0/8 (loopback)
      if (octet1 === 127) return false;
      // 10.0.0.0/8 (private)
      if (octet1 === 10) return false;
      // 172.16.0.0/12 (private)
      if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return false;
      // 192.168.0.0/16 (private)
      if (octet1 === 192 && octet2 === 168) return false;
      // 169.254.0.0/16 (link-local)
      if (octet1 === 169 && octet2 === 254) return false;
      // 0.0.0.0/8
      if (octet1 === 0) return false;
    }

    // IPv6 loopback / local
    if (
      hostname === "::1" ||
      hostname.startsWith("fe80:") ||
      hostname.startsWith("fc00:")
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function cleanText(text?: string | null): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim()
    .slice(0, 180);
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();

    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl || typeof targetUrl !== "string") {
      return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
    }

    if (!isPublicHttpsUrl(targetUrl)) {
      return NextResponse.json(
        { error: "Only public HTTPS links are allowed" },
        { status: 400 }
      );
    }

    const domain = new URL(targetUrl).hostname.replace(/^www\./, "");

    // 4-second timeout to fetch preview
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    let html = "";
    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; AtsedeNisehaBot/1.0; +https://atsedeniseha.org)",
          Accept: "text/html,application/xhtml+xml",
        },
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        return NextResponse.json({
          success: true,
          domain,
          url: targetUrl,
          title: domain,
        });
      }

      // Read at most 64KB
      const reader = response.body?.getReader();
      if (reader) {
        let bytesRead = 0;
        const decoder = new TextDecoder();
        while (bytesRead < 65536) {
          const { done, value } = await reader.read();
          if (done) break;
          bytesRead += value.length;
          html += decoder.decode(value, { stream: true });
        }
      }
    } catch {
      clearTimeout(timeoutId);
      // Fetch failed or timed out — return safe fallback bare link metadata
      return NextResponse.json({
        success: true,
        domain,
        url: targetUrl,
        title: domain,
      });
    }

    // Extract OpenGraph / Meta / Title safely
    const titleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i);

    const descMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

    const imageMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

    let title = cleanText(titleMatch ? titleMatch[1] : domain);
    let description = cleanText(descMatch ? descMatch[1] : "");
    let imageUrl: string | undefined = undefined;

    if (imageMatch && imageMatch[1]) {
      const rawImg = imageMatch[1].trim();
      try {
        const resolved = new URL(rawImg, targetUrl);
        if (resolved.protocol === "https:") {
          imageUrl = resolved.toString();
        }
      } catch {}
    }

    return NextResponse.json({
      success: true,
      domain,
      url: targetUrl,
      title: title || domain,
      description: description || undefined,
      image: imageUrl,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
  }
}
