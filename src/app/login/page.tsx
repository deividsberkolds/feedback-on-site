import { auth, signIn } from "@/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { bootstrapAdmin } from "@/lib/bootstrap";
import { hashPassword } from "@/lib/users";
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

export default async function LoginPage() {
  // Best-effort: create the admin from env on first visit.
  await bootstrapAdmin().catch((e) => console.error("[bootstrap]", e));

  const session = await auth();
  if (session?.user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
        <Card>
          <CardHeader>
            <CardTitle>Already signed in</CardTitle>
            <CardDescription>
              You are signed in as {session.user.email}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/projects">
              <Button>Go to dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  const userCount = await prisma.user.count();
  const needsSetup = userCount === 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <Card>
        <CardHeader>
          <CardTitle>{needsSetup ? "Set up admin" : "Sign in"}</CardTitle>
          <CardDescription>
            {needsSetup
              ? "Create your admin account. This is the account that receives feedback digests."
              : "Admin access to your feedback dashboard."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData) => {
              "use server";
              if (needsSetup) {
                const email = String(formData.get("email") ?? "")
                  .trim()
                  .toLowerCase();
                const password = String(formData.get("password") ?? "");
                const name = String(formData.get("name") ?? "").trim() || null;
                if (!email || !password)
                  throw new Error("Email and password required");
                const passwordHash = await hashPassword(password);
                await prisma.user.create({
                  data: {
                    email,
                    passwordHash,
                    role: "ADMIN",
                    name,
                    notifyEmail: email,
                  },
                });
                await signIn("credentials", {
                  redirectTo: "/projects",
                  email,
                  password,
                });
                return;
              }
              await signIn("credentials", {
                redirectTo: "/projects",
                email: formData.get("email"),
                password: formData.get("password"),
              });
            }}
            className="flex flex-col gap-4"
          >
            {needsSetup && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name">Name (optional)</Label>
                <Input id="name" name="name" placeholder="Your name" />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete={needsSetup ? "new-password" : "current-password"}
              />
            </div>
            <Button type="submit" size="lg">
              {needsSetup ? "Create & sign in" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
