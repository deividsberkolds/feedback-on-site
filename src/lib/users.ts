import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export async function ensureUser(email: string): Promise<{ id: string }> {
  const normalized = email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: normalized, role: "ADMIN" },
    });
  }
  return { id: user.id };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
