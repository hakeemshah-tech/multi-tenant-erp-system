import fs from "fs";
import path from "path";

/**
 * Root directory for files staged on local disk before they move to object
 * storage.
 *
 * Deliberately NOT derived from `__dirname`. tsup bundles the whole app into
 * `dist/index.js`, so at runtime `__dirname` is `/app/dist` rather than
 * `/app/src/app/<module>`. A source-relative hop like `../../../uploads` then
 * resolves to `/uploads` at the filesystem root, which the non-root container
 * user cannot create:
 *
 *   Error: EACCES: permission denied, mkdir '/uploads/temp'
 *
 * Anchoring to the process working directory keeps development and the
 * container in agreement, and `UPLOAD_DIR` allows an explicit override (the
 * Docker image sets it to /app/uploads, where the volume is mounted).
 */
export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR || path.resolve(process.cwd(), "uploads");

/** Scratch space for multer before a file is processed and forwarded. */
export const TEMP_UPLOAD_DIR = path.join(UPLOAD_ROOT, "temp");

/**
 * Creates a directory if it is missing, reporting failure instead of throwing.
 *
 * This runs while modules are still loading, so an exception here happens
 * before the HTTP server binds and takes the whole container down. A directory
 * that cannot be created should disable uploads, not the API.
 */
export function ensureUploadDir(dir: string = TEMP_UPLOAD_DIR): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    return true;
  } catch (error) {
    console.error(
      `❌ Could not create upload directory ${dir}. File uploads will fail ` +
        "until the directory exists and is writable by the service user:",
      error
    );
    return false;
  }
}
