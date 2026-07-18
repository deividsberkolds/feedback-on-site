import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const session = await prisma.reviewSession.findUnique({
    where: { token },
    include: {
      project: { select: { defaultTargetUrl: true } },
      comments: {
        include: { page: { select: { url: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!session)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    defaultUrl: session.project.defaultTargetUrl,
    reviewerName: session.reviewerName,
    comments: session.comments.map((c) => ({
      id: c.id,
      text: c.text,
      authorName: c.authorName,
      pageUrl: c.page.url,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = (await req.json().catch(() => null)) as {
    reviewerName?: string;
  } | null;
  const name = body?.reviewerName?.trim() || null;

  const session = await prisma.reviewSession.findUnique({ where: { token } });
  if (!session)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (session.status !== "OPEN") {
    return NextResponse.json({ error: "session not open" }, { status: 409 });
  }

  await prisma.reviewSession.update({
    where: { token },
    data: { reviewerName: name },
  });
  return NextResponse.json({ ok: true });
}
