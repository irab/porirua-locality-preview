import config from "@payload-config";
import { getPayload } from "payload";
import { seedDirectoryUsers } from "./seed";

// `next start` never runs the config's onInit, so an image seeds its editor
// accounts here instead — after `payload migrate` has created the tables.
const payload = await getPayload({ config });
await seedDirectoryUsers(payload);
process.exit(0);
