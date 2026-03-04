import Elysia, { t } from "elysia";
import { db } from "../db";
import { blog, blogImage, blogReaction, REACTION_TYPES } from "../db/schema";
import { betterAuthPlugin } from "../plugins/betterAuth";
import { generateID, generateSlug } from "../lib/utils";
import { count, desc, eq } from "drizzle-orm";

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
  .get("/admin", async ({ query, user, error }) => {
    if (!user.isAdmin) return error(403, { message: "Admin only" });
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const rows = await db.query.blog.findMany({
      orderBy: [desc(blog.createdAt)],
      limit,
      offset,
      with: {
        author: { columns: { id: true, name: true, image: true } },
        images: true,
        reactions: true
      },
    })
    const [{ total }] = await db.select({ total: count() }).from(blog);
    return { data: rows, total, page, limit };
  }, { auth: true, query: ListBlogQuery })
  .post("/", async ({ body, user, error }) => {
    if (!user.isAdmin) return error(403, { message: "Admins only" });
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
    return { data: newBlog }
  }, { auth: true, body: CreateBlogBody })



