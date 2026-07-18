import { Resend } from "resend";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const client = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

type MailInput = {
  to: string;
  subject: string;
  html: string;
};

export async function sendMail({
  to,
  subject,
  html,
}: MailInput): Promise<void> {
  if (!client) {
    console.info("[mail:dev] would send to", to, "|", subject, "\n", html);
    return;
  }
  const { error } = await client.emails.send({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
  });
  if (error) {
    console.error("[mail] Resend error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

function commentCard(c: {
  authorName: string | null;
  text: string;
  pageUrl: string;
  createdAt: Date;
}): string {
  return `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:8px 0;">
      <div style="font-size:12px;color:#6b7280;margin-bottom:4px;">
        ${c.authorName ?? "Reviewer"} on ${escapeHtml(c.pageUrl)} · ${c.createdAt.toISOString()}
      </div>
      <div style="white-space:pre-wrap;font-size:14px;color:#111827;">${escapeHtml(c.text)}</div>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendDigest(sessionId: string): Promise<void> {
  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
    include: {
      project: { include: { owner: true } },
      comments: { include: { page: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) throw new Error("Session not found");

  const recipient =
    session.project.owner.notifyEmail ?? session.project.owner.email;
  const dashboardUrl = `${env.APP_BASE_URL}/projects/${session.project.id}/sessions/${session.id}`;

  const byPage = new Map<string, typeof session.comments>();
  for (const c of session.comments) {
    const list = byPage.get(c.page.url) ?? [];
    list.push(c);
    byPage.set(c.page.url, list);
  }

  const sections = Array.from(byPage.entries())
    .map(
      ([url, comments]) => `
      <h3 style="font-size:15px;margin:20px 0 8px;">${escapeHtml(url)}</h3>
      ${comments
        .map((c) =>
          commentCard({
            authorName: c.authorName,
            text: c.text,
            pageUrl: c.page.url,
            createdAt: c.createdAt,
          }),
        )
        .join("")}`,
    )
    .join("");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;color:#0a0a0a;">
      <h1 style="font-size:20px;">New feedback for ${escapeHtml(session.project.name)}</h1>
      <p style="color:#4b5563;font-size:14px;">
        Reviewer: ${escapeHtml(session.reviewerName ?? "Anonymous")} ·
        ${session.comments.length} comment${session.comments.length === 1 ? "" : "s"} ·
        submitted ${session.submittedAt?.toISOString() ?? ""}
      </p>
      ${sections || "<p>No comments were recorded.</p>"}
      <p style="margin-top:24px;">
        <a href="${dashboardUrl}" style="background:#111827;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">
          Open in dashboard
        </a>
      </p>
    </div>`;

  await sendMail({
    to: recipient,
    subject: `Feedback for ${session.project.name} from ${session.reviewerName ?? "reviewer"}`,
    html,
  });

  await prisma.digestLog.create({
    data: {
      sessionId,
      recipientEmail: recipient,
      payloadJson: JSON.stringify({ commentCount: session.comments.length }),
    },
  });
}
