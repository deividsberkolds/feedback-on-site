import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const MAX_SCREENSHOT_BYTES = 1_500_000; // ~1.1MB base64 of a 1MB image

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    token?: string;
    xpath?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    scrollX?: number;
    scrollY?: number;
    text?: string;
    authorName?: string;
    pageUrl?: string;
    screenshotData?: string;
  } | null;

  if (!body)
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const token = body.token?.trim();
  if (!token)
    return NextResponse.json({ error: "token required" }, { status: 400 });

  const session = await prisma.reviewSession.findUnique({ where: { token } });
  if (!session)
    return NextResponse.json({ error: "invalid token" }, { status: 404 });
  if (session.status !== "OPEN") {
    return NextResponse.json({ error: "session not open" }, { status: 409 });
  }

  const text = body.text?.trim();
  if (!text)
    return NextResponse.json({ error: "text required" }, { status: 400 });
  if (!body.xpath)
    return NextResponse.json({ error: "xpath required" }, { status: 400 });

  const pageUrl = body.pageUrl?.trim();
  if (!pageUrl)
    return NextResponse.json({ error: "pageUrl required" }, { status: 400 });

  let screenshotData: string | null = body.screenshotData ?? null;
  if (screenshotData && screenshotData.length > MAX_SCREENSHOT_BYTES) {
    screenshotData = null; // drop oversized screenshots
  }

  // Ensure a Page row exists for this URL in the session's project.
  const page = await prisma.page.upsert({
    where: { projectId_url: { projectId: session.projectId, url: pageUrl } },
    update: { lastProxyFetchAt: new Date() },
    create: {
      projectId: session.projectId,
      url: pageUrl,
      lastProxyFetchAt: new Date(),
    },
  });

  const comment = await prisma.comment.create({
    data: {
      sessionId: session.id,
      pageId: page.id,
      authorName: body.authorName?.trim() || session.reviewerName || null,
      text,
      xpath: body.xpath,
      viewportWidth: Math.round(body.viewportWidth ?? 0),
      viewportHeight: Math.round(body.viewportHeight ?? 0),
      scrollX: Math.round(body.scrollX ?? 0),
      scrollY: Math.round(body.scrollY ?? 0),
      screenshotData,
      status: "OPEN",
    },
    include: { page: { select: { url: true } } },
  });

  return NextResponse.json(
    {
      id: comment.id,
      text: comment.text,
      authorName: comment.authorName,
      pageUrl: comment.page.url,
      createdAt: comment.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
