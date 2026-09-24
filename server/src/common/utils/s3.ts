// src/utils/s3.ts
import { S3 } from "aws-sdk";
import { getSignedUrl as cfGetSignedUrl } from "@aws-sdk/cloudfront-signer";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
dotenv.config();

/* ---------------- env helpers ---------------- */
function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const AWS_REGION = requireEnv("AWS_REGION");
const AWS_ACCESS_KEY_ID = requireEnv("AWS_ACCESS_KEY_ID");
const AWS_SECRET_ACCESS_KEY = requireEnv("AWS_SECRET_ACCESS_KEY");
const S3_BUCKET = requireEnv("S3_BUCKET");

// CloudFront (for signed read URLs)
const CF_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
const CF_KEY_PAIR_ID = process.env.CLOUDFRONT_KEY_PAIR_ID;

// Signing is optional: the service still serves uploads when CloudFront is not
// configured, so an absent key must not crash the module at import time.
const CF_PRIVATE_KEY = (process.env.CLOUDFRONT_PRIVATE_KEY_BASE64 ?? "")
  .split(String.raw`\n`)
  .join("\n");

const DEFAULT_SIGN_EXPIRES_SECONDS = Number(
  process.env.URL_SIGNING_EXPIRES_SECONDS || 10
);

/* ---------------- AWS clients ---------------- */
export const s3 = new S3({
  region: AWS_REGION,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

/* ---------------- util helpers ---------------- */
export function makeObjectKey(folder: string, originalName: string) {
  const safeName = originalName.replace(/\s+/g, "-");
  return `${folder}/${uuidv4()}-${safeName}`;
}

/**
 * Generate document filename in format: EmployeeFirstName_DocumentType_ddmmyyyyhhmmss
 * Example: johndoe_passport_12-04-2025
 * Format: firstname_documenttype_dd-mm-yyyy-hhmmss
 */
export function generateDocumentFileName(
  employeeFirstName: string,
  documentType: string,
  fileExtension: string
): string {
  // Sanitize employee first name (lowercase, remove special chars, keep alphanumeric)
  const sanitizedFirstName = employeeFirstName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 50); // Limit length

  // Sanitize document type (lowercase, replace spaces/special chars with underscore)
  const sanitizedDocType = documentType
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50); // Limit length

  // Generate timestamp in format: dd-mm-yyyy-hhmmss
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const timestamp = `${day}-${month}-${year}-${hours}${minutes}${seconds}`;

  // Ensure file extension starts with a dot
  const ext = fileExtension.startsWith(".")
    ? fileExtension
    : `.${fileExtension}`;

  return `${sanitizedFirstName}_${sanitizedDocType}_${timestamp}${ext}`;
}

/**
 * Upload a file (buffer) to S3. Objects are private by default.
 * Returns stable identifiers; DO NOT return/keep a URL (URLs expire).
 */
export async function uploadToS3(
  file: Express.Multer.File,
  folder = "uploads/employees",
  options?: {
    employeeFirstName?: string;
    documentType?: string;
  }
): Promise<{
  bucket: string;
  key: string;
  etag?: string;
}> {
  let fileName = file.originalname;

  // If employeeFirstName and documentType are provided, generate custom filename
  if (options?.employeeFirstName && options?.documentType) {
    const fileExtension = file.originalname.split(".").pop() || "";
    fileName = generateDocumentFileName(
      options.employeeFirstName,
      options.documentType,
      fileExtension
    );
  }

  const key = makeObjectKey(folder, fileName);

  const out = await s3
    .putObject({
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ServerSideEncryption: "AES256",
      // CacheControl: "private, no-store",
      // ContentDisposition: `inline; filename="${file.originalname}"`,
    })
    .promise();

  return {
    bucket: S3_BUCKET,
    key,
    etag: out.ETag?.replace(/"/g, ""),
  };
}

/**
 * Optional: create a presigned PUT URL for direct browser uploads.
 * Client uploads with: fetch(putUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type }})
 */
export function getSignedPutUrl(params: {
  contentType: string;
  originalName: string;
  folder?: string;
  expiresSeconds?: number; // default 300s
}): { key: string; bucket: string; url: string; expiresIn: number } {
  const folder = params.folder || "uploads/employees";
  const key = makeObjectKey(folder, params.originalName);
  const expiresIn = Math.max(1, Math.min(3600, params.expiresSeconds ?? 300)); // 1s..1h

  const url = s3.getSignedUrl("putObject", {
    Bucket: S3_BUCKET,
    Key: key,
    Expires: expiresIn,
    ContentType: params.contentType,
  });

  return { key, bucket: S3_BUCKET, url, expiresIn };
}

/**
 * Mint a short-lived CloudFront signed URL for reading a private object.
 * Default expiry: 10 seconds (configurable via URL_SIGNING_EXPIRES_SECONDS).
 */
export function getCloudFrontSignedGetUrl(
  key: string,
  expiresSeconds = DEFAULT_SIGN_EXPIRES_SECONDS
): string {
  if (!CF_DOMAIN || !CF_KEY_PAIR_ID || !CF_PRIVATE_KEY) {
    throw new Error(
      "CloudFront signing is not configured. Set CLOUDFRONT_DOMAIN, CLOUDFRONT_KEY_PAIR_ID, and CLOUDFRONT_PRIVATE_KEY(_BASE64)."
    );
  }
  const url = `https://${CF_DOMAIN}/${key}`;
  const dateLessThan = new Date(
    Date.now() + Math.max(1, expiresSeconds) * 1000
  ).toISOString();

  return cfGetSignedUrl({
    url,
    dateLessThan,
    keyPairId: CF_KEY_PAIR_ID,
    privateKey: CF_PRIVATE_KEY,
  });
}

/* ---------------- back-compat helper (optional) ---------------- */
/**
 * For transitional flows: upload buffer, then return a one-off 10s CloudFront URL for immediate preview.
 * Prefer: call `uploadToS3` and store { bucket, key } in DB, then later fetch a fresh URL on demand.
 */
export async function uploadAndGetTemporaryUrl(
  file: Express.Multer.File,
  folder = "uploads/employees",
  previewSeconds = DEFAULT_SIGN_EXPIRES_SECONDS
): Promise<{
  bucket: string;
  key: string;
  etag?: string;
  url: string;
  expiresIn: number;
}> {
  const { bucket, key, etag } = await uploadToS3(file, folder);
  const url = getCloudFrontSignedGetUrl(key, previewSeconds);
  return { bucket, key, etag, url, expiresIn: previewSeconds };
}
