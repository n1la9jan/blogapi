import Elysia, { t } from "elysia";
import { db } from "../db";
import { blog, REACTION_TYPES } from "../db/schema";
import { betterAuthPlugin } from "../plugins/betterAuth";
import { generateID, generateSlug } from "../lib/utils";
import { and, count, desc, eq } from "drizzle-orm";

const CreateBlogBody = t.Object({
  title: t.String({ minLength: 3, maxLength: 200 }),
  content: t.String({ minLength: 1 }), // Markdown
  excerpt: t.Optional(t.String({ maxLength: 500 })),
  coverImageKey: t.Optional(t.String()),
  coverImageUrl: t.Optional(t.String({ format: "uri" })),
  published: t.Optional(t.Boolean()),
});

const UpdateBlogBody = t.Object({
  title: t.Optional(t.String({ minLength: 3, maxLength: 200 })),
  content: t.Optional(t.String({ minLength: 1 })),
  excerpt: t.Optional(t.String({ maxLength: 500 })),
  coverImageKey: t.Optional(t.String()),
  coverImageUrl: t.Optional(t.String({ format: "uri" })),
  published: t.Optional(t.Boolean()),
});

const BlogIdParam = t.Object({ id: t.String() });
const SlugParam = t.Object({ slug: t.String() });

const ListBlogQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  published: t.Optional(t.BooleanString()),
});

export const blogRoutes = new Elysia({ prefix: "/blogs" })
  .use(betterAuthPlugin)
  .get("/", async ({ query }) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const rows = await db.query.blog.findMany({
      where: eq(blog.published, true),
      orderBy: [desc(blog.publihsedAt)],
      limit,
      offset,
      with: {
        author: { columns: { id: true, name: true, image: true } },
        images: { columns: { id: true, url: true, fileName: true } },
        reactions: true
      },
    })
    const [{ total }] = await db
      .select({ total: count() })
      .from(blog)
      .where(eq(blog.published, true))
    return { data: rows, total, page, limit };
  }, { query: ListBlogQuery })
  .get("/mine", async ({ query, user }) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const rows = await db.query.blog.findMany({
      where: eq(blog.authorId, user.id),
      orderBy: [desc(blog.createdAt)],
      limit,
      offset,
      with: {
        images: { columns: { id: true, url: true, fileName: true } },
        reactions: true
      },
    })
    const [{ total }] = await db
      .select({ total: count() })
      .from(blog)
      .where(eq(blog.authorId, user.id))
    return { data: rows, total, page, limit };
  }, { auth: true, query: ListBlogQuery })
  .get("/:slug", async ({ params, error }) => {
    const post = await db.query.blog.findFirst({
      where: and(eq(blog.slug, params.slug), eq(blog.published, true)),
      with: {
        author: { columns: { id: true, name: true, image: true } },
        images: true,
        reactions: true,
      },
    });
    if (!post) return error(404, { message: "Blog not found" });

    const reactionsCount = REACTION_TYPES.reduce(
      (acc, type) => {
        acc[type] = post.reactions.filter((r) => r.reaction === type).length;
        return acc;
      },
      {} as Record<string, number>
    );
    return { ...post, reactionsCount };
  }, { params: SlugParam })
  .post("/", async ({ body, user, error }) => {
    console.log("route is getting hit")
    const id = generateID();
    const slug = generateSlug(body.title);
    const now = new Date();

    const [newBlog] = await db
      .insert(blog)
      .values({
        id,
        slug,
        title: body.title,
        content: body.content,
        excerpt: body.excerpt ?? null,
        coverImageKey: body.coverImageKey ?? null,
        coverImageUrl: body.coverImageUrl ?? null,
        published: body.published ?? false,
        publihsedAt: body.published ? now : null,
        authorId: user.id,
        createdAt: now,
        updatedAt: now
      }).returning();
    console.log(newBlog)
    return { data: newBlog }
  }, { auth: true, body: CreateBlogBody })
  .patch("/:id", async ({ params, body, user, error }) => {
    const existing = await db.query.blog.findFirst({ where: eq(blog.id, params.id) });
    if (!existing) return error(404, { message: "Blog not found" });
    if (existing.authorId !== user.id) return error(403, { message: "Not owner" });

    const now = new Date();
    const [updated] = await db.update(blog).set({
      ...body,
      publihsedAt: body.published && !existing.published ? now : existing.publihsedAt,
      updatedAt: now
    }).where(eq(blog.id, params.id)).returning();
    return { data: updated };
  }, { auth: true, body: UpdateBlogBody, params: BlogIdParam })
  .delete("/:id", async ({ params, user, error }) => {
    const existing = await db.query.blog.findFirst({ where: eq(blog.id, params.id) });
    if (!existing) return error(404, { message: "Blog not found" });
    if (existing.authorId !== user.id) return error(403, { message: "Not owner" });

    await db.delete(blog).where(eq(blog.id, params.id));
    return { success: true };
  }, { auth: true, params: BlogIdParam })



