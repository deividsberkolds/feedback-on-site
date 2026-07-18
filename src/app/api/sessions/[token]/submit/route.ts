import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { sendDigest } from "@/lib/mail";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const session = await prisma.reviewSession.findUnique({
    where: { token },
    include: { _count: { select: { comments: true } } },
  });
  if (!session)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (session.status === "SUBMITTED") {
    return NextResponse.json({ error: "already submitted" }, { status: 409 });
  }
  if (session.status === "ARCHIVED") {
    return NextResponse.json({ error: "archived" }, { status: 409 });
  }

  await prisma.reviewSession.update({
    where: { token },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  // Send digest — best-effort (don't fail the submit if mail is down).
  try {
    await sendDigest(session.id);
  } catch (e) {
    console.error("[submit] digest failed:", e);
  }

  return NextResponse.json({ ok: true, commentCount: session._count.comments });
}
