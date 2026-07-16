import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    title: "Next.js 16 + App Router",
    description: "Turbopack, React 19, standalone output, trailingSlash.",
  },
  {
    title: "Tailwind CSS v4 + shadcn/ui",
    description:
      "Pre-wired with button, card, input, label in src/components/ui.",
  },
  {
    title: "Prisma 7 + PostgreSQL",
    description: "Driver adapter (no query engine), migrations, typed client.",
  },
  {
    title: "Typed env + quality tooling",
    description: "zod env validation, ESLint, Prettier, Husky, lint-staged.",
  },
];

const endpoints = [
  { path: "/api/health/", label: "Health check" },
  { path: "/api/todos/", label: "Sample CRUD (GET/POST)" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm font-medium">
          base-projects / nextjs
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Next.js + PostgreSQL base template
        </h1>
        <p className="text-muted-foreground">
          Boilerplate is installed. Set{" "}
          <code className="bg-muted rounded px-1.5 py-0.5 text-sm">
            DATABASE_URL
          </code>{" "}
          in <code className="text-sm">.env</code>, run{" "}
          <code className="text-sm">pnpm db:migrate</code>, then build your app.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <CardTitle>{f.title}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Verify the wiring</h2>
        {endpoints.map((e) => (
          <a
            key={e.path}
            href={e.path}
            className="hover:bg-muted flex items-center justify-between rounded-lg border px-4 py-3 text-sm transition-colors"
          >
            <code>{e.path}</code>
            <span className="text-muted-foreground">{e.label}</span>
          </a>
        ))}
      </section>
    </main>
  );
}
