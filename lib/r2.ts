import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Trim all R2 env vars — Vercel occasionally adds trailing newlines that corrupt presigned URLs
const R2_ENDPOINT = (process.env.R2_ENDPOINT ?? '').trim()
const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID ?? '').trim()
const R2_SECRET_ACCESS_KEY = (process.env.R2_SECRET_ACCESS_KEY ?? '').trim()
const BUCKET = (process.env.R2_BUCKET_NAME ?? '').trim()

const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  // R2's S3-compatible endpoint requires path-style URLs (bucket in path, not subdomain)
  forcePathStyle: true,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
  // Prevent SDK from adding x-amz-checksum-mode=ENABLED to presigned URLs.
  // R2 doesn't recognise this parameter and returns SignatureDoesNotMatch (403).
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
})

export async function getUploadUrl(key: string, contentType: string, expiresIn = 3600) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(r2, command, { expiresIn })
}

export async function getDownloadUrl(key: string, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  })
  return getSignedUrl(r2, command, { expiresIn })
}

export { r2, BUCKET }
