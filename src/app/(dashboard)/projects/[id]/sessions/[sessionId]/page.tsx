import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SessionViewerPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const user = await requireUser();
  const { id, sessionId } = await params;

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project || project.ownerId !== user.id) notFound();

  const session = await prisma.reviewSession.findUnique({
    where: { id: sessionId },
    include: {
      comments: {
        include: { page: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session || session.projectId !== id) notFound();

  const byPage = new Map<string, typeof session.comments>();
  for (const c of session.comments) {
    const list = byPage.get(c.page.url) ?? [];
    list.push(c);
    byPage.set(c.page.url, list);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link
          href={`/projects/${id}`}
          className="text-muted-foreground text-sm"
        >
          ← {project.name}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Session: {session.reviewerName ?? "Anonymous"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {session.comments.length} comment
          {session.comments.length === 1 ? "" : "s"} · status {session.status} ·
          submitted {session.submittedAt?.toLocaleString() ?? "—"}
        </p>
      </div>

      {session.comments.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No comments recorded for this session yet.
        </p>
      ) : (
        Array.from(byPage.entries()).map(([url, comments]) => (
          <section key={url} className="flex flex-col gap-3">
            <h2 className="text-lg font-medium">{url}</h2>
            {comments.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground text-sm font-normal">
                      {c.authorName ?? "Reviewer"} ·{" "}
                      {c.createdAt.toLocaleString()}
                    </span>
                    <form
                      action={async () => {
                        "use server";
                        const u = await requireUser();
                        const current = await prisma.comment.findUnique({
                          where: { id: c.id },
                          select: {
                            status: true,
                            session: { select: { projectId: true } },
                          },
                        });
                        if (!current || current.session.projectId !== id)
                          notFound();
                        void u;
                        await prisma.comment.update({
                          where: { id: c.id },
                          data: {
                            status:
                              current.status === "OPEN" ? "RESOLVED" : "OPEN",
                          },
                        });
                        revalidatePath(`/projects/${id}/sessions/${sessionId}`);
                      }}
                    >
                      <Button type="submit" variant="outline" size="xs">
                        {c.status === "OPEN" ? "Resolve" : "Reopen"}
                      </Button>
                    </form>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    viewport {c.viewportWidth}×{c.viewportHeight} · scroll{" "}
                    {c.scrollX},{c.scrollY}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 sm:flex-row">
                  {c.screenshotData && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.screenshotData}
                      alt="Element screenshot"
                      className="max-h-48 w-auto rounded-lg border object-contain"
                    />
                  )}
                  <div className="flex flex-col gap-2">
                    <p className="text-sm whitespace-pre-wrap">{c.text}</p>
                    <code className="text-muted-foreground text-xs break-all">
                      {c.xpath}
                    </code>
                    <Badge
                      variant={c.status === "OPEN" ? "outline" : "secondary"}
                      className="w-fit"
                    >
                      {c.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        ))
      )}
    </main>
  );
}
