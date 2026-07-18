import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { comments: true } } },
      },
    },
  });
  if (!project || project.ownerId !== user.id) notFound();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-1">
        <Link href="/projects" className="text-muted-foreground text-sm">
          ← Projects
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        <p className="text-muted-foreground text-sm">
          Default URL: {project.defaultTargetUrl ?? "—"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create review session</CardTitle>
          <CardDescription>
            Generates a shareable link you can send to a client. They will not
            need an account. The reviewer starts at the project&apos;s default
            URL and can navigate from there.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              const pid = String(formData.get("projectId"));
              const reviewerName =
                String(formData.get("reviewerName") ?? "").trim() || null;
              await prisma.reviewSession.create({
                data: { projectId: pid, reviewerName },
              });
              revalidatePath(`/projects/${pid}`);
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="projectId" value={project.id} />
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="reviewerName">Reviewer name (optional)</Label>
              <Input
                id="reviewerName"
                name="reviewerName"
                placeholder="Jane at Acme"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!project.defaultTargetUrl}
            >
              Create session
            </Button>
          </form>
          {!project.defaultTargetUrl && (
            <p className="text-destructive mt-2 text-xs">
              Set a default URL when creating the project, or edit it to enable
              sessions.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Review sessions</h2>
        {project.sessions.length === 0 ? (
          <p className="text-muted-foreground text-sm">No sessions yet.</p>
        ) : (
          project.sessions.map((s) => {
            const shareUrl = `${env.APP_BASE_URL}/share/${s.token}`;
            return (
              <Card key={s.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span>{s.reviewerName ?? "Anonymous"}</span>
                    <Badge
                      variant={
                        s.status === "SUBMITTED"
                          ? "default"
                          : s.status === "ARCHIVED"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {s.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {s._count.comments} comment
                    {s._count.comments === 1 ? "" : "s"} · created{" "}
                    {s.createdAt.toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="bg-muted rounded px-2 py-1 text-xs break-all">
                      {shareUrl}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      render={
                        <a href={`/projects/${project.id}/sessions/${s.id}`} />
                      }
                    >
                      View comments
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </main>
  );
}
