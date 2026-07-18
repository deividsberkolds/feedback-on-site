import { z } from "zod";

const optionalString = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  AUTH_SECRET: z
    .string()
    .min(
      16,
      "AUTH_SECRET must be at least 16 characters (run `openssl rand -base64 32`).",
    ),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  RESEND_API_KEY: optionalString(z.string()),
  MAIL_FROM: z.string().default("Feedback <feedback@example.com>"),
  ADMIN_BOOTSTRAP_EMAIL: optionalString(z.string().email()),
  ADMIN_BOOTSTRAP_PASSWORD: optionalString(z.string()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error(
    "Invalid environment variables. Copy .env.example to .env and set required values.",
  );
}

export const env = parsed.data;
