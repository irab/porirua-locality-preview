import type { Payload } from "payload";

const SEED = [
  {
    email: process.env.ADMIN_EMAIL || "admin@example.com",
    password: process.env.ADMIN_PASSWORD || "admin-local",
    role: "admin" as const,
  },
  {
    email: process.env.EDITOR_EMAIL || "editor@example.com",
    password: process.env.EDITOR_PASSWORD || "editor-local",
    role: "editor" as const,
  },
  {
    email: process.env.REVIEWER_EMAIL || "reviewer@example.com",
    password: process.env.REVIEWER_PASSWORD || "reviewer-local",
    role: "reviewer" as const,
  },
];

export async function seedDirectoryUsers(payload: Payload): Promise<void> {
  for (const account of SEED) {
    const existing = await payload.find({
      collection: "users",
      where: { email: { equals: account.email } },
      limit: 1,
    });
    if (existing.totalDocs > 0) continue;
    await payload.create({
      collection: "users",
      data: account,
    });
  }
}
