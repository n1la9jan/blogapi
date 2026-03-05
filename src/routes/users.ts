import Elysia, { t } from "elysia";
import { db } from "../db";
import { user } from "../db/schema";
import { betterAuthPlugin } from "../plugins/betterAuth";
import { eq } from "drizzle-orm";

const UserIdParam = t.Object({ id: t.String() });
export const userRoutes = new Elysia({ prefix: "/users" })
  .use(betterAuthPlugin)
  .get("/me", async ({ user: currentUser }) => {
    const profile = await db.query.user.findFirst({
      where: eq(user.id, currentUser.id),
      columns: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true
      }
    })
    return { data: profile }
  }, { auth: true })
