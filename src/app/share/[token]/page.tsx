import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

export const dynamic = "force-dynamic";

export default async function ShareLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await prisma.reviewSession.findUnique({
    where: { token },
    include: { project: true },
  });
  if (!session) notFound();
  if (session.status === "ARCHIVED") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <Card>
          <CardHeader>
            <CardTitle>Session closed</CardTitle>
            <CardDescription>
              This feedback session is no longer accepting comments.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (session.status === "SUBMITTED") {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <Card>
          <CardHeader>
            <CardTitle>Thank you!</CardTitle>
            <CardDescription>
              Your feedback has been submitted. You can close this tab.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle>Review: {session.project.name}</CardTitle>
          <CardDescription>
            You&apos;ll see the page rendered inside this app. Click anywhere on
            it to drop a comment on that spot, like Word comments. When
            you&apos;re done, hit Submit review.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="text-muted-foreground text-sm">
            Starting URL:{" "}
            <code className="text-xs">{session.project.defaultTargetUrl}</code>
          </div>
          <form
            action={async (formData) => {
              "use server";
              const name = String(formData.get("reviewerName") ?? "").trim();
              if (name) {
                await prisma.reviewSession.update({
                  where: { token },
                  data: { reviewerName: name },
                });
              }
              revalidatePath(`/share/${token}`);
              redirect(`/share/${token}/review`);
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reviewerName">
                Your name{" "}
                {session.reviewerName
                  ? "(already set — override if you like)"
                  : "(optional)"}
              </Label>
              <Input
                id="reviewerName"
                name="reviewerName"
                defaultValue={session.reviewerName ?? ""}
                placeholder="Jane Doe"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={!session.project.defaultTargetUrl}
            >
              Start reviewing
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
