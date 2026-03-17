import { t } from "elysia";
import { blog, blogReaction, CATEGORY_SLUGS, CategorySlug, REACTION_TYPES } from "../db/schema";
import { db } from "../db";
import { and, count, desc, eq, gte } from "drizzle-orm";

export const CategorySlugEnum = t.Union(CATEGORY_SLUGS.map((s) => t.Literal(s)) as any);

export const CreateBlogBody = t.Object({
  title: t.String({ minLength: 3, maxLength: 200 }),
  content: t.String({ minLength: 1 }), // Markdown
  category: CategorySlugEnum,
  excerpt: t.Optional(t.String({ maxLength: 500 })),
  coverImageKey: t.Optional(t.String()),
  coverImageUrl: t.Optional(t.String({ format: "uri" })),
  published: t.Optional(t.Boolean()),
});

export const UpdateBlogBody = t.Object({
  title: t.Optional(t.String({ minLength: 3, maxLength: 200 })),
  content: t.Optional(t.String({ minLength: 1 })),
  category: t.Optional(CategorySlugEnum),
  excerpt: t.Optional(t.String({ maxLength: 500 })),
  coverImageKey: t.Optional(t.String()),
  coverImageUrl: t.Optional(t.String({ format: "uri" })),
  published: t.Optional(t.Boolean()),
});

export const BlogIdParam = t.Object({ id: t.String() });
export const SlugParam = t.Object({ slug: t.String() });

export const ListBlogQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 })),
  category: t.Optional(CategorySlugEnum)
});

export type WeeklyTopBlog = Awaited<ReturnType<typeof getTopBlogForCategory>>;

export function aggregateReactions(reactions: { reaction: string }[]) {
  const reactionCounts = REACTION_TYPES.reduce(
    (acc, type) => {
      acc[type] = reactions.filter((r) => r.reaction === type).length;
      return acc;
    },
    {} as Record<string, number>
  );
  return { reactionCounts, totalReactions: reactions.length }
}

// Featured blogs

export async function getTopBlogForCategory(categorySlug: CategorySlug) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Helper: run the ranked query with an optional date filter
  async function queryTopBlog(since?: Date) {
    const conditions = [
      eq(blogReaction.reaction, "like"),
      eq(blog.category, categorySlug),
      eq(blog.published, true),
      ...(since ? [gte(blogReaction.createdAt, since)] : []),
    ];

    const rows = await db
      .select({
        blogId: blogReaction.blogId,
        likeCount: count(blogReaction.userId).as("likeCount"),
      })
      .from(blogReaction)
      .innerJoin(blog, eq(blog.id, blogReaction.blogId))
      .where(and(...conditions))
      .groupBy(blogReaction.blogId)
      .orderBy(desc(count(blogReaction.userId)))
      .limit(1);

    return rows[0]?.blogId ?? null;
  }

  // Try this week first, then fall back to all-time
  const blogId =
    (await queryTopBlog(oneWeekAgo)) ?? (await queryTopBlog());

  if (!blogId) {
    // No reactions at all in this category — just return the latest published blog
    return db.query.blog.findFirst({
      where: and(eq(blog.category, categorySlug), eq(blog.published, true)),
      orderBy: [desc(blog.publihsedAt)],
      with: {
        author: { columns: { id: true, name: true, image: true } },
        reactions: true,
      },
    }) ?? null;
  }

  return db.query.blog.findFirst({
    where: eq(blog.id, blogId),
    with: {
      author: { columns: { id: true, name: true, image: true } },
      reactions: true,
    },
  }) ?? null;
}

/**
 * For a logged-in user, find the top 2 categories they've liked blogs in.
 * Returns null if the user has no like history at all (caller uses guest path).
 */
export async function getUserTopCategories(userId: string): Promise<CategorySlug[] | null> {
  const categoryLikes = await db
    .select({
      category: blog.category,
      likeCount: count(blogReaction.userId).as("likeCount"),
    })
    .from(blogReaction)
    .innerJoin(blog, eq(blog.id, blogReaction.blogId))
    .where(
      and(
        eq(blogReaction.userId, userId),
        eq(blogReaction.reaction, "like")
      )
    )
    .groupBy(blog.category)
    .orderBy(desc(count(blogReaction.userId)))
    .limit(2);

  if (categoryLikes.length === 0) return null;

  const defaults: CategorySlug[] = ["technology", "programming"];
  const userTop = categoryLikes.map((r) => r.category as CategorySlug);

  return [
    userTop[0] ?? defaults[0],
    userTop[1] ?? defaults[1],
  ];
}

export function formatFeatured(categorySlug: CategorySlug, post: WeeklyTopBlog) {
  if (!post) return { category: categorySlug, blog: null };

  const { reactions, ...rest } = post;
  const { reactionCounts, totalReactions } = aggregateReactions(reactions);

  return {
    category: categorySlug,
    blog: { ...rest, reactionCounts, totalReactions },
  };
}
