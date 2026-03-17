import Elysia from "elysia";
import { db } from "../db";
import { blog, REACTION_TYPES, CATEGORIES } from "../db/schema";
import { betterAuthPlugin } from "../plugins/betterAuth";
import { generateID, generateSlug } from "../lib/utils";
import { and, count, desc, eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { BlogIdParam, CreateBlogBody, getUserTopCategories, getTopBlogForCategory, ListBlogQuery, SlugParam, UpdateBlogBody, formatFeatured, getWeeklyTopBlogForCategory } from "./blog.utils";


export const blogRoutes = new Elysia({ prefix: "/blogs" })
  .use(betterAuthPlugin)
  .get("/featured", async ({ request: { headers } }) => {
    const session = await auth.api.getSession({ headers }).catch(() => null);

    const guestCategories: ["technology", "programming"] = ["technology", "programming"];

    const categories = session
      ? (await getUserTopCategories(session.user.id)) ?? guestCategories
      : guestCategories;

    const personalized = session !== null && categories !== guestCategories;

    const [first, second] = await Promise.all([
      getTopBlogForCategory(categories[0]),
      getTopBlogForCategory(categories[1]),
    ]);

    return {
      personalized,
      data: [
        formatFeatured(categories[0], first),
        formatFeatured(categories[1], second),
      ],
    };
  })
  .get("/categories", () => { return { data: CATEGORIES } })
  .get("/", async ({ query }) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;

    const where = query.category
      ? and(eq(blog.published, true), eq(blog.category, query.category))
      : eq(blog.published, true)

    const rows = await db.query.blog.findMany({
      where,
      orderBy: [desc(blog.publihsedAt)],
      limit,
      offset,
      with: {
        author: { columns: { id: true, name: true, image: true } },
        images: { columns: { id: true, url: true, fileName: true } },
        reactions: true
      },
    });

    const [{ total }] = await db
      .select({ total: count() })
      .from(blog)
      .where(where)
    return { data: rows, total, page, limit };
  }, { query: ListBlogQuery })
  .get("/mine", async ({ query, user }) => {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const offset = (page - 1) * limit;


    const where = query.category
      ? and(eq(blog.authorId, user.id), eq(blog.category, query.category))
      : eq(blog.authorId, user.id)

    const rows = await db.query.blog.findMany({
      where,
      orderBy: [desc(blog.createdAt)],
      limit,
      offset,
      columns: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImageUrl: true,
        category: true,
        published: true,
        publihsedAt: true,
        createdAt: true,
        updatedAt: true
      },
      with: {
        images: { columns: { id: true, url: true, fileName: true } },
        reactions: true
      },
    })
    const [{ total }] = await db
      .select({ total: count() })
      .from(blog)
      .where(where)

    const data = rows.map((b) => {
      const reactionCounts = REACTION_TYPES.reduce(
        (acc, type) => {
          acc[type] = b.reactions.filter((r) => r.reaction === type).length;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        id: b.id,
        title: b.title,
        slug: b.slug,
        excerpt: b.excerpt,
        coverImageUrl: b.coverImageUrl,
        category: b.category,
        published: b.published,
        publishedAt: b.publihsedAt,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        images: b.images,
        reactionCounts,
        totalReactions: b.reactions.length,
      };
    });
    return { data, total, page, limit };
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
    return { ...post, reactionsCount, totalReactions: post.reactions.length };
  }, { params: SlugParam })
  .post("/", async ({ body, user, error }) => {
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
        category: body.category,
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
  .patch("/:id", async ({ params, body, user, error }) => {
    const existing = await db.query.blog.findFirst({ where: eq(blog.id, params.id) });
    if (!existing) return error(404, { message: "Blog not found" });
    if (existing.authorId !== user.id) return error(403, { message: "Not owner" });

    const updates: Partial<typeof blog.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.category !== undefined) updates.category = body.category;
    if (body.excerpt !== undefined) updates.excerpt = body.excerpt;
    if (body.coverImageKey !== undefined) updates.coverImageKey = body.coverImageKey;
    if (body.coverImageUrl !== undefined) updates.coverImageUrl = body.coverImageUrl;
    if (body.published !== undefined) {
      updates.published = body.published;
      if (body.published && !existing.publihsedAt) {
        updates.publihsedAt = new Date();
      }
    }
    const [updated] = await db
      .update(blog)
      .set(updates)
      .where(eq(blog.id, params.id))
      .returning()

    return { data: updated };
  }, { auth: true, body: UpdateBlogBody, params: BlogIdParam })
  .delete("/:id", async ({ params, user, error }) => {
    const existing = await db.query.blog.findFirst({ where: eq(blog.id, params.id) });
    if (!existing) return error(404, { message: "Blog not found" });
    if (existing.authorId !== user.id) return error(403, { message: "Not owner" });

    await db.delete(blog).where(eq(blog.id, params.id));
    return { message: "Blog deleted successfully" };
  }, { auth: true, params: BlogIdParam })



