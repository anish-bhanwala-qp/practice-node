import { MikroORM } from "@mikro-orm/core";
import { PROD } from "./constants";
import { Post } from "./entities/Post";
import path from "path";

export default {
  dbName: "anishbhanwala",
  user: "",
  password: "",
  debug: !PROD,
  type: "postgresql",
  entities: [Post],
  migrations: {
    path: path.join(__dirname, "migrations"),
    pattern: /^[\w-]+\d+\.[tj]s$/,
  },
} as Parameters<typeof MikroORM.init>[0];
