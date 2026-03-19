import Elysia, { t } from 'elysia';
import { count, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import { blogComment, blog } from '../db/schema';
import { betterAuthPlugin } from '../plugins/betterAuth';
import { generateID } from '../lib/utils';


const SlugParam = t.Object({ slug: t.String() });

const CommentIdParam = t.Object({ commentId: t.String() });

const SlugAndCommentParam = t.Object({
  slug: t.String(),
  commentId: t.String()
});

const CreateCommentBody = t.Object({
  content: t.String({ minLength: 1, maxLength: 1000 })
});

const UpdateCommentBody = t.Object({
  content: t.String({ minLength: 1, maxLength: 1000 })
});

const ListCommentsQuery = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 50 }))
});

export const commentRoutes = new Elysia({ prefix: "/comments/:slug" })
  .use(betterAuthPlugin)
  .get("/", async ({ params, query, error }) => {
    const post = await db.query.blog.findFirst({
      where: eq(blog.slug, params.slug),
      columns: { id: true, published: true },
    });
    if (!post || !post.published) return error(404, { message: "Blog not found" });
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const comments = await db.query.blogComment.findMany({
      where: eq(blogComment.blogId, post.id),
      orderBy: [desc(blogComment.createdAt)],
      limit,
      offset,
      with: {
        author: {
          columns: { id: true, name: true, image: true },
        },
      },
    });

    const [{ total }] = await db
      .select({ total: count() })
      .from(blogComment)
      .where(eq(blogComment.blogId, post.id));

    return { data: comments, total, page, limit }
  }, { params: SlugParam, query: ListCommentsQuery })
  .post("/", async ({ params, body, user, error }) => {
    const post = await db.query.blog.findFirst({
      where: eq(blog.slug, params.slug),
      columns: { id: true, published: true },
    });
    if (!post || !post.published) return error(404, { message: "Blog not found" });
    const now = new Date();

    const [newComment] = await db
      .insert(blogComment)
      .values({
        id: generateID(),
        blogId: post.id,
        authorId: user.id,
        content: body.content,
        createdAt: now,
        updatedAt: now
      }).returning();

    const result = await db.query.blogComment.findFirst({
      where: eq(blogComment.id, newComment.id),
      with: {
        author: {
          columns: { id: true, name: true, image: true },
        },
      },
    });

    return { data: result };
  }, { auth: true, params: SlugParam, body: CreateCommentBody })
  .patch("/:commentId", async ({ params, body, user, error }) => {
    const comment = await db.query.blogComment.findFirst({
      where: eq(blogComment.id, params.commentId)
    });

    if (!comment) return error(404, { message: "Comment not found" });

    if (comment.authorId !== user.id) return error(404, { message: "You do not own this comment" });

    const [updated] = await db
      .update(blogComment)
      .set({ content: body.content, updatedAt: new Date() })
      .where(eq(blogComment.id, params.commentId))
      .returning();

    const result = await db.query.blogComment.findFirst({
      where: eq(blogComment.id, updated.id),
      with: {
        author: {
          columns: { id: true, name: true, image: true }
        },
      },
    });

    return { data: result };
  }, { auth: true, params: SlugAndCommentParam, body: UpdateCommentBody })
  .delete("/:commentId", async ({ params, user, error }) => {
    const comment = await db.query.blogComment.findFirst({
      where: eq(blogComment.id, params.commentId),
    });

    if (!comment) return error(404, { message: "Comment not found" });
    if (comment.authorId !== user.id) return error(403, { message: "You do not own this blog" });

    await db
      .delete(blogComment)
      .where(eq(blogComment.id, params.commentId));

    return { message: "Comment deleted" };

  }, { auth: true, params: SlugAndCommentParam })



