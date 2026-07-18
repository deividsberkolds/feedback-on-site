import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export async function bootstrapAdmin(): Promise<void> {
  const email = env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = env.ADMIN_BOOTSTRAP_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      name: "Admin",
      notifyEmail: email,
    },
  });
  console.log(`[bootstrap] Created admin user ${email}`);
}
