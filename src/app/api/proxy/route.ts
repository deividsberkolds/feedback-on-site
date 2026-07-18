import { type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROXY_BASE = "/api/proxy";

function isSpecialUrl(v: string): boolean {
  return (
    !v ||
    v.startsWith("#") ||
    v.startsWith("data:") ||
    v.startsWith("javascript:") ||
    v.startsWith("mailto:") ||
    v.startsWith("tel:") ||
    v.startsWith("blob:") ||
    v.startsWith("about:")
  );
}

function rewriteUrl(value: string, origin: string, token: string): string {
  if (isSpecialUrl(value)) return value;
  let abs: string;
  try {
    abs = new URL(value, origin).toString();
  } catch {
    return value;
  }
  const params = new URLSearchParams({ url: abs, token });
  return `${PROXY_BASE}/?${params.toString()}`;
}

function rewriteSrcset(value: string, origin: string, token: string): string {
  return value
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return "";
      const [url, ...rest] = trimmed.split(/\s+/);
      const rewritten = rewriteUrl(url, origin, token);
      return [rewritten, ...rest].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

function rewriteCss(css: string, origin: string, token: string): string {
  return css.replace(
    /url\((['"]?)([^'")]+)\1\)/g,
    (_m, q: string, raw: string) =>
      `url(${q}${rewriteUrl(raw, origin, token)}${q})`,
  );
}

const URL_ATTRS = [
  "href",
  "src",
  "action",
  "poster",
  "formaction",
  "data",
  "cite",
];
const URL_ATTR_RE = new RegExp(
  `\\b(${URL_ATTRS.join("|")})\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
  "gi",
);

function rewriteHtml(html: string, upstreamUrl: string, token: string): string {
  let out = html;

  // Strip <base href="..."> — it would override our URL resolution.
  out = out.replace(/<base\b[^>]*>/gi, "");

  // Strip <meta http-equiv="refresh" ...> — auto-redirects would bypass us.
  out = out.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
    "",
  );

  // Rewrite url-bearing attributes.
  out = out.replace(URL_ATTR_RE, (match, attr, dq, sq, bare) => {
    const val = dq ?? sq ?? bare ?? "";
    const rewritten = rewriteUrl(val, upstreamUrl, token);
    if (dq !== undefined) return `${attr}="${rewritten}"`;
    if (sq !== undefined) return `${attr}='${rewritten}'`;
    return `${attr}=${rewritten}`;
  });

  // Rewrite srcset.
  out = out.replace(
    /\bsrcset\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (match, dq, sq) => {
      const val = dq ?? sq ?? "";
      const rewritten = rewriteSrcset(val, upstreamUrl, token);
      if (dq !== undefined) return `srcset="${rewritten}"`;
      return `srcset='${rewritten}'`;
    },
  );

  // Prevent anchors escaping the iframe via top-level navigation.
  out = out.replace(
    /\btarget\s*=\s*(?:"_top"|'_top'|"_parent"|'_parent')/gi,
    "",
  );

  // Rewrite url() inside inline <style>...</style>.
  out = out.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (m, open, body, close) =>
      `${open}${rewriteCss(body, upstreamUrl, token)}${close}`,
  );

  const annotator = `<script src="/_annotator/client.js" data-token="${token}" data-upstream-url="${encodeURIComponent(
    upstreamUrl,
  )}"></script><link rel="stylesheet" href="/_annotator/overlay.css" />`;

  // Inject before </body> (or before </html> as fallback).
  if (/<\/body>/i.test(out)) {
    out = out.replace(/<\/body>/i, `${annotator}</body>`);
  } else if (/<\/html>/i.test(out)) {
    out = out.replace(/<\/html>/i, `${annotator}</html>`);
  } else {
    out = out + annotator;
  }

  return out;
}

export async function GET(request: NextRequest): Promise<Response> {
  const sp = request.nextUrl.searchParams;
  const target = sp.get("url");
  const token = sp.get("token");

  if (!target || !token) {
    return new Response("Missing url or token", { status: 400 });
  }

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (parsedTarget.protocol !== "http:" && parsedTarget.protocol !== "https:") {
    return new Response("Only http(s) allowed", { status: 400 });
  }

  const session = await prisma.reviewSession.findUnique({
    where: { token },
    include: { project: true },
  });
  if (!session) return new Response("Invalid token", { status: 404 });
  if (session.status === "ARCHIVED")
    return new Response("Session archived", { status: 410 });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; FeedbackReviewer/1.0)",
        accept: request.headers.get("accept") ?? "*/*",
      },
      redirect: "follow",
    });
  } catch (e) {
    return new Response(`Upstream fetch failed: ${(e as Error).message}`, {
      status: 502,
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const upstreamUrl = upstream.url || target;
  const upstreamOrigin = new URL(upstreamUrl).origin;

  // Touch the page row (records last fetch time) — best-effort.
  void prisma.page
    .upsert({
      where: {
        projectId_url: { projectId: session.projectId, url: upstreamUrl },
      },
      update: { lastProxyFetchAt: new Date() },
      create: {
        projectId: session.projectId,
        url: upstreamUrl,
        lastProxyFetchAt: new Date(),
      },
    })
    .catch(() => undefined);

  // Non-HTML: pass through. Rewrite CSS url() references.
  if (!contentType.includes("text/html")) {
    if (contentType.includes("text/css")) {
      const text = await upstream.text();
      const rewritten = rewriteCss(text, upstreamOrigin, token);
      return new Response(rewritten, {
        status: upstream.status,
        headers: baseHeaders(contentType),
      });
    }
    const headers = baseHeaders(contentType);
    if (upstream.status >= 300 && upstream.status < 400) {
      const loc = upstream.headers.get("location");
      if (loc) headers.set("location", rewriteUrl(loc, upstreamOrigin, token));
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  }

  // HTML — rewrite.
  const upstreamText = await upstream.text();
  const rewritten = rewriteHtml(upstreamText, upstreamUrl, token);

  const headers = baseHeaders("text/html; charset=utf-8");
  headers.set(
    "content-security-policy",
    [
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:",
      "img-src 'self' data: blob:",
      "frame-ancestors 'self'",
    ].join("; "),
  );
  headers.set("x-frame-options", "SAMEORIGIN");
  return new Response(rewritten, { status: upstream.status, headers });
}

function baseHeaders(contentType: string): Headers {
  const h = new Headers();
  h.set("content-type", contentType);
  h.set("cache-control", "no-store");
  return h;
}
