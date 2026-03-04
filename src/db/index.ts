import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../config";
import * as schema from './schema';

const sql = neon(env.databaseURL!);
export const db = drizzle(sql, { schema })
export type DB = typeof db
