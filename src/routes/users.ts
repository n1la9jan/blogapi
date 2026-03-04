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
        isAdmin: true,
        image: true,
        createdAt: true
      }
    })
    return { data: profile }
  }, { auth: true })
  .post("/:id/promote-admin", async ({ params, user: currentUser, error }) => {
    if (!currentUser.isAdmin) return error(403, { message: "Admin only" });

    const target = await db.query.user.findFirst({
      where: eq(user.id, params.id),
    })

    if (!target) return error(404, { message: "User not found" });

    const [updated] = await db
      .update(user)
      .set({ isAdmin: true })
      .where(eq(user.id, params.id))
      .returning({
        id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin
      })
    return { data: updated };
  }, { auth: true, params: UserIdParam })
