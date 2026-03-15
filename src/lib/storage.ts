import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config";

export const s3 = new S3Client({
  endpoint: env.endpointURL!,
  region: "auto",
  credentials: {
    accessKeyId: env.accessKeyId!,
    secretAccessKey: env.secretAccessKey!,
  },
})

const BUCKET = env.bucketName;
const BUCKET_ENDPOINT = env.bucketURL;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function generatePresignedUrl(opts: {
  key: string;
  mimeType: string;
  sizeBytes: number;
}): Promise<{ uploadURL: string; publicURL: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: opts.key,
    ContentType: opts.mimeType,
    ContentLength: opts.sizeBytes
  })

  const uploadURL = await getSignedUrl(s3, command, { expiresIn: 900 });
  const publicURL = `${BUCKET_ENDPOINT}/${opts.key}`;

  return { uploadURL, publicURL };
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key
    })
  );
}

export function buildImageKey(blogID: string, fileName: string): string {
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `blogs/${blogID}/images/${Date.now()}-${sanitized}`;
}
