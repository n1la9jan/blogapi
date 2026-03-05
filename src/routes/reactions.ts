import Elysia, { t } from "elysia";
import { db } from "../db";
import { blog, blogReaction, REACTION_TYPES } from "../db/schema";
import { betterAuthPlugin } from "../plugins/betterAuth";
import { eq } from "drizzle-orm";


const BlogIdParam = t.Object({ blogID: t.String() });

const UpsertReactionBody = t.Object({
  reaction: t.Union(REACTION_TYPES.map((r) => t.Literal(r)) as any),
});

export const reactionRoutes = new Elysia({ prefix: "/blogs/:slug/reactions" })
  .use(betterAuthPlugin)
  .get("/", async ({ params, request: { headers }, error }) => {
    const post = await db.query.blog.findFirst({
      where: eq(blog.id, params.blogID),
    });

    if (!post || !post.published) return error(404, { message: "Blog not found" });

    const reactions = await db.query.blogReaction.findMany({
      where: eq(blogReaction.blogId, params.blogID)
    });

    const counts = REACTION_TYPES.reduce(
      (acc, type) => {
        acc[type] = reactions.filter((r) => r.reaction === type).length;
        return acc;
      },
      {} as Record<string, number>
    );

    let myReaction: string | null = null;
    try {
      const { auth } = await import("../lib/auth");
      const session = await auth.api.getSession({ headers });
      if (session) {
        const mine = reactions.find((r) => r.userId === session.user.id);
        myReaction = mine?.reaction ?? null;
      }
    } catch { }
    return { counts, myReaction, total: reactions.length };
  }, { params: BlogIdParam })
// TODO: Add put and delete reactions

