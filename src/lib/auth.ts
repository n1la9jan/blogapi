import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { env } from "../config";
import { db } from "../db";
import * as schema from "../db/schema";

export const auth = betterAuth({
  secret: env.betterAuthSecret!,
  baseURL: env.betterAuthBaseURL,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification
    }
  }),
  trustedOrigins: ["http://localhost:5173", env.domainURL!, "http://localhost:3000"],

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  socialProviders: {
    google: {
      clientId: env.googleClientID!,
      clientSecret: env.googleClientSecret!
    },
  },
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      partitioned: true,
    }
  }
});

export type Auth = typeof auth;
