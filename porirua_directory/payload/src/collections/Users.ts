import type { CollectionConfig } from "payload";

const directoryRoles = ["admin", "editor", "reviewer"] as const;

function userRole(user: { role?: string } | null | undefined) {
  return user?.role;
}

export const Users: CollectionConfig = {
  slug: "users",
  admin: {
    useAsTitle: "email",
    hidden: ({ user }) => userRole(user) !== "admin",
  },
  auth: true,
  access: {
    admin: ({ req: { user } }) => Boolean(user && directoryRoles.includes(userRole(user) as (typeof directoryRoles)[number])),
    read: ({ req: { user } }) => {
      if (!user) return false;
      if (userRole(user) === "admin") return true;
      return { id: { equals: user.id } };
    },
    create: ({ req: { user } }) => userRole(user) === "admin",
    update: ({ req: { user } }) => userRole(user) === "admin",
    delete: ({ req: { user } }) => userRole(user) === "admin",
  },
  fields: [
    {
      name: "role",
      type: "select",
      required: true,
      defaultValue: "editor",
      options: [
        { label: "Admin", value: "admin" },
        { label: "Editor", value: "editor" },
        { label: "Reviewer", value: "reviewer" },
      ],
      access: {
        update: ({ req: { user } }) => userRole(user) === "admin",
      },
    },
  ],
};
