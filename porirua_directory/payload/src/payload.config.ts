import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import { Users } from "./collections/Users";
import { directoryEditorEndpoints } from "./directory/endpoints";
import { seedDirectoryUsers } from "./seed";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: "Your Porirua Directory" },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      views: {
        dashboard: {
          Component: "/directory/DirectoryHome#DirectoryHome",
        },
      },
    },
  },
  collections: [Users],
  endpoints: directoryEditorEndpoints,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "payload-local-secret",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
  }),
  onInit: async (payload) => {
    await seedDirectoryUsers(payload);
  },
});
