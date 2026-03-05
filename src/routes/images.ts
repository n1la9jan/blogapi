import Elysia, { t } from "elysia";
import { db } from "../db";
import { blog, blogImage } from "../db/schema";
import { betterAuthPlugin } from "../plugins/betterAuth";
import { generateID } from "../lib/utils";
import { generatePresignedUrl, buildImageKey, deleteObject, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE_BYTES, type AllowedImageType } from "../lib/storage";
import { eq } from "drizzle-orm";

const RequestPresignedURL = t.Object({
  blogID: t.String(),
  fileName: t.String({ minLength: 1, maxLength: 255 }),
  mimeType: t.Union(ALLOWED_IMAGE_TYPES.map((m) => t.Literal(m)) as any),
  sizeBytes: t.Number({
    minimum: 1, maximum: MAX_FILE_SIZE_BYTES, description: `Max ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
  }),
})

const ConfirmUploadBody = t.Object({
  blogID: t.String(),
  key: t.String(),
  url: t.String({ format: "uri" }),
  fileName: t.String(),
  mimeType: t.String(),
  sizeBytes: t.Optional(t.Number()),
})

const ImageIdParam = t.Object({ id: t.String() });

export const imageRoutes = new Elysia({ prefix: "/images" })
  .use(betterAuthPlugin)
  .post("/presign", async ({ body, user, error }) => {

    const post = await db.query.blog.findFirst({
      where: eq(blog.id, body.blogID),
    });

    if (!post) return error(404, { message: "Blog not fonund" });
    if (post.authorId != user.id) return error(403, { message: "You do not own this blog post" });

    const key = buildImageKey(body.blogID, body.fileName);
    const { uploadURL, publicURL } = await generatePresignedUrl({ key, mimeType: body.mimeType, sizeBytes: body.sizeBytes });
    return { uploadURL, publicURL, key };
  }, { auth: true, body: RequestPresignedURL })
  .post("/confirm", async ({ body, user, error }) => {
    const post = await db.query.blog.findFirst({
      where: eq(blog.id, body.blogID),
    });
    if (!post) return error(404, { message: "Blog not fonund" });
    if (post.authorId != user.id) return error(403, { message: "You do not own this blog post" });

    const [image] = await db.insert(blogImage).values({
      id: generateID(),
      blogId: body.blogID,
      key: body.key,
      url: body.url,
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes ?? null,
      uploadedAt: new Date()
    }).returning();

    return { data: image };

  }, { auth: true, body: ConfirmUploadBody })
  .get("/:id", async ({ params, error }) => {
    const image = await db.query.blogImage.findFirst({
      where: eq(blogImage.id, params.id),
    });

    if (!image) return error(404, { message: "Image not found" });
    return { data: image };
  }, { params: ImageIdParam })
// TODO: ADD delete 
