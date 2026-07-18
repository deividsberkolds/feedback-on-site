import Link from "next/link";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { sessions: true } } },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Each project is a site you collect feedback on.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New project</CardTitle>
          <CardDescription>
            Name the site and set the default URL reviewers will see.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              const u = await requireUser();
              const name = String(formData.get("name") ?? "").trim();
              const url = String(formData.get("defaultTargetUrl") ?? "").trim();
              if (!name) throw new Error("Name is required");
              await prisma.project.create({
                data: { name, ownerId: u.id, defaultTargetUrl: url || null },
              });
              revalidatePath("/projects");
            }}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Acme landing page"
                required
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="defaultTargetUrl">Default URL</Label>
              <Input
                id="defaultTargetUrl"
                name="defaultTargetUrl"
                type="url"
                placeholder="https://acme.com"
              />
            </div>
            <Button type="submit" size="lg">
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {projects.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No projects yet. Create one above.
          </p>
        ) : (
          projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <Badge variant="secondary">
                      {p._count.sessions} session
                      {p._count.sessions === 1 ? "" : "s"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {p.defaultTargetUrl ?? "No default URL set"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
