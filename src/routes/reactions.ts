import Elysia, { t } from "elysia";
import { db } from "../db";
import { blog, blogReaction, REACTION_TYPES } from "../db/schema";
import { betterAuthPlugin } from "../plugins/betterAuth";
import { eq, and } from "drizzle-orm";

const SlugParam = t.Object({ slug: t.String() });

const UpsertReactionBody = t.Object({
  reaction: t.Union(REACTION_TYPES.map((r) => t.Literal(r)) as any),
});

export const reactionRoutes = new Elysia({ prefix: "/reactions/:slug" })
  .use(betterAuthPlugin)
  .get("/", async ({ params, request: { headers }, error }) => {
    const post = await db.query.blog.findFirst({
      where: eq(blog.slug, params.slug),
    });

    if (!post || !post.published) return error(404, { message: "Blog not found" });

    const reactions = await db.query.blogReaction.findMany({
      where: eq(blogReaction.blogId, post.id)
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
  }, { params: SlugParam })
  .post("/", async ({ params, body, user, error }) => {
    const post = await db.query.blog.findFirst({
      where: eq(blog.slug, params.slug),
    });

    if (!post || !post.published) return error(404, { message: "Blog not found" });

    await db
      .insert(blogReaction)
      .values({
        userId: user.id,
        blogId: post.id,
        reaction: body.reaction,
        createdAt: new Date()
      })
      .onConflictDoUpdate({
        target: [blogReaction.userId, blogReaction.blogId],
        set: { reaction: body.reaction },
      });

    return { message: "Reaction saved", reaction: body.reaction };

  }, { auth: true, params: SlugParam, body: UpsertReactionBody })
  .delete("/", async ({ params, user, error }) => {
    const post = await db.query.blog.findFirst({
      where: eq(blog.slug, params.slug),
    });

    if (!post || !post.published) return error(404, { message: "Blog not found" });

    const existing = await db.query.blogReaction.findFirst({
      where: and(
        eq(blogReaction.userId, user.id),
        eq(blogReaction.blogId, post.id)
      ),
    });
    if (!existing) return error(404, { message: "No reaction found" });
    await db
      .delete(blogReaction)
      .where(
        and(
          eq(blogReaction.userId, user.id),
          eq(blogReaction.blogId, post.id)
        )
      );
    return { message: "Reaction removed" };
  }, { auth: true, params: SlugParam })



