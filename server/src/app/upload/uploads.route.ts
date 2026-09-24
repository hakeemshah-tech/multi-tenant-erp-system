// // src/routes/uploads.route.ts
// import express from "express";
// import multer from "multer";
// import FileModel from "@/database/models/file.model";
// import {
//   uploadToS3,
//   getCloudFrontSignedGetUrl,
//   getSignedPutUrl,
//   s3,
// } from "@/common/utils/s3";

// const router = express.Router();
// const upload = multer({ storage: multer.memoryStorage() }); // file in memory buffer

// // POST /uploads  (multipart: field "file")
// // - Uploads to S3 (private)
// // - Creates a File doc
// // - Returns { id, key, bucket } and a short-lived (10s) CloudFront URL for immediate preview
// router.post("/", upload.single("file"), async (req, res) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: "No file uploaded" });

//     const { buffer, mimetype, originalname, size } = req.file;

//     // 1) Upload to S3 (objects are private)
//     const uploaded = await uploadToS3(req.file); // returns { bucket, key, etag? }

//     // 2) Persist a File record (stable reference)
//     const doc = await FileModel.create({
//       key: uploaded.key,
//       bucket: uploaded.bucket,
//       originalName: originalname,
//       contentType: mimetype,
//       size,
//       etag: uploaded.etag,
//       status: "uploaded",
//       // uploadedBy: req.user?.id, // plug your auth if available
//     });

//     // 3) Optional: immediate 10s preview link (do NOT store this in DB)
//     const url = getCloudFrontSignedGetUrl(uploaded.key);

//     return res.json({
//       id: doc._id,
//       key: uploaded.key,
//       bucket: uploaded.bucket,
//       url, // ephemeral (≈10s)
//       expiresIn: Number(process.env.URL_SIGNING_EXPIRES_SECONDS || 10),
//     });
//   } catch (error) {
//     console.error("Upload Error:", error);
//     return res.status(500).json({ error: "Failed to upload file" });
//   }
// });

// // GET /uploads/:id/url
// // - Returns a fresh 10s CloudFront signed URL for the stored file
// router.get("/:id/url", async (req, res) => {
//   try {
//     const file = await FileModel.findById(req.params.id);
//     if (!file) return res.status(404).json({ error: "File not found" });

//     // TODO: authorization check here (user/org can access this file)

//     const url = getCloudFrontSignedGetUrl(file.key);
//     return res.json({
//       url,
//       expiresIn: Number(process.env.URL_SIGNING_EXPIRES_SECONDS || 10),
//     });
//   } catch (error) {
//     console.error("Signed URL Error:", error);
//     return res.status(500).json({ error: "Failed to generate URL" });
//   }
// });

// // OPTIONAL: Direct browser upload (no backend buffering)

// // POST /uploads/sign-put
// // - Returns a presigned PUT URL so the browser can upload directly to S3
// // - Creates a "pending" File record; call /uploads/:id/finalize after the PUT completes
// router.post("/sign-put", async (req, res) => {
//   try {
//     const { contentType, originalName, folder } = req.body || {};
//     if (!contentType || !originalName) {
//       return res
//         .status(400)
//         .json({ error: "contentType and originalName are required" });
//     }

//     const { key, bucket, url, expiresIn } = getSignedPutUrl({
//       contentType,
//       originalName,
//       folder, // optional
//       expiresSeconds: 300, // give the client ~5 min to upload
//     });

//     const doc = await FileModel.create({
//       key,
//       bucket,
//       originalName,
//       contentType,
//       status: "pending",
//       // uploadedBy: req.user?.id,
//     });

//     return res.json({
//       id: doc._id,
//       key,
//       putUrl: url,
//       expiresIn,
//     });
//   } catch (error) {
//     console.error("Sign PUT Error:", error);
//     return res.status(500).json({ error: "Failed to sign PUT URL" });
//   }
// });

// // POST /uploads/:id/finalize
// // - After client PUTs to S3, mark File as "uploaded"
// // - Optionally HEAD the object to fill size/etag
// router.post("/:id/finalize", async (req, res) => {
//   try {
//     const file = await FileModel.findById(req.params.id);
//     if (!file) return res.status(404).json({ error: "File not found" });

//     // TODO: authorization check here

//     // Optional: confirm object exists & capture metadata
//     const head = await s3
//       .headObject({ Bucket: file.bucket, Key: file.key })
//       .promise()
//       .catch(() => null);

//     if (head) {
//       file.size = head.ContentLength ?? file.size;
//       file.etag = head.ETag ? head.ETag.replace(/"/g, "") : file.etag;
//       file.contentType = head.ContentType || file.contentType;
//     }

//     file.status = "uploaded";
//     await file.save();

//     return res.json({ ok: true });
//   } catch (error) {
//     console.error("Finalize Error:", error);
//     return res.status(500).json({ error: "Failed to finalize upload" });
//   }
// });

// export default router;

import express from "express";
import multer from "multer";
import FileModel from "@/database/models/file.model";
import { uploadToS3, getCloudFrontSignedGetUrl } from "@/common/utils/s3";
import { Types } from "mongoose";
import EmployeeModel from "@/database/models/employee.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import { authenticate, WithUser } from "@/common/middlewares/authMiddleware";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Allowed file types
const ALLOWED_MIME_TYPES = [
  "image/jpeg", // .jpg, .jpeg
  "image/png", // .png
  "image/heic", // .heic
  "image/heif", // .heic (alternative mimetype)
  "application/pdf", // .pdf
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic", ".pdf", ".docx"];

/**
 * Magic bytes (file signatures) for each file type
 * These are the actual bytes at the start of the file that identify the true file type
 */
const MAGIC_BYTES = {
  jpeg: [0xff, 0xd8, 0xff], // JPEG files start with FF D8 FF
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], // PNG files start with 89 50 4E 47 0D 0A 1A 0A
  pdf: [0x25, 0x50, 0x44, 0x46], // PDF files start with %PDF (25 50 44 46)
  docx: [0x50, 0x4b, 0x03, 0x04], // DOCX files are ZIP archives, start with PK (50 4B 03 04)
  // HEIC files are more complex - they use ISO Base Media File Format
  // They typically start with a box structure, but we'll check for common patterns
  heic: [
    [0x00, 0x00, 0x00], // Some HEIC files start with size bytes
    [0x66, 0x74, 0x79, 0x70], // "ftyp" box type (at various offsets)
  ],
};

/**
 * Validates magic bytes (file signature) to ensure the file type matches its content
 */
function validateMagicBytes(buffer: Buffer, expectedType: string): boolean {
  if (!buffer || buffer.length < 4) {
    return false;
  }

  const fileBytes = Array.from(buffer.slice(0, Math.min(buffer.length, 12)));

  switch (expectedType.toLowerCase()) {
    case "jpg":
    case "jpeg":
      // JPEG: FF D8 FF
      return (
        fileBytes[0] === MAGIC_BYTES.jpeg[0] &&
        fileBytes[1] === MAGIC_BYTES.jpeg[1] &&
        fileBytes[2] === MAGIC_BYTES.jpeg[2]
      );

    case "png":
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      return MAGIC_BYTES.png.every((byte, index) => fileBytes[index] === byte);

    case "pdf":
      // PDF: %PDF (25 50 44 46)
      return MAGIC_BYTES.pdf.every((byte, index) => fileBytes[index] === byte);

    case "docx":
      // DOCX: ZIP signature PK (50 4B 03 04)
      return MAGIC_BYTES.docx.every((byte, index) => fileBytes[index] === byte);

    case "heic":
      // HEIC files use ISO Base Media File Format
      // Check for "ftyp" string in the first 12 bytes (common HEIC signature)
      const ftypBytes = MAGIC_BYTES.heic[1];
      // Look for "ftyp" in the buffer (it can appear at different offsets)
      for (let i = 0; i <= fileBytes.length - 4; i++) {
        if (
          fileBytes[i] === ftypBytes[0] &&
          fileBytes[i + 1] === ftypBytes[1] &&
          fileBytes[i + 2] === ftypBytes[2] &&
          fileBytes[i + 3] === ftypBytes[3]
        ) {
          // Additional check: after "ftyp" should be a brand identifier like "heic", "mif1", "msf1"
          const brandStart = i + 4;
          if (brandStart + 4 <= fileBytes.length) {
            const brand = String.fromCharCode(
              fileBytes[brandStart],
              fileBytes[brandStart + 1],
              fileBytes[brandStart + 2],
              fileBytes[brandStart + 3]
            );
            // Common HEIC brand identifiers
            if (
              ["heic", "mif1", "msf1", "hevc", "heif"].includes(
                brand.toLowerCase()
              )
            ) {
              return true;
            }
          }
        }
      }
      return false;

    default:
      return false;
  }
}

/**
 * Gets the expected file type from extension
 */
function getFileTypeFromExtension(filename: string): string | null {
  const extension = filename
    .toLowerCase()
    .substring(filename.lastIndexOf("."))
    .replace(".", "");

  // Normalize extensions
  if (extension === "jpg" || extension === "jpeg") return "jpeg";
  if (extension === "png") return "png";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "heic") return "heic";

  return null;
}

/**
 * Validates if the uploaded file type is allowed
 * Checks mimetype, extension, and magic bytes for security
 */
function isValidFileType(
  mimetype: string,
  filename: string,
  buffer: Buffer
): boolean {
  // Check mimetype
  const isValidMimeType = ALLOWED_MIME_TYPES.includes(mimetype.toLowerCase());

  // Check file extension
  const fileExtension = filename
    .toLowerCase()
    .substring(filename.lastIndexOf("."));
  const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExtension);

  // If mimetype or extension doesn't match, reject
  if (!isValidMimeType && !isValidExtension) {
    return false;
  }

  // Validate magic bytes to ensure file content matches declared type
  const expectedType = getFileTypeFromExtension(filename);
  if (!expectedType) {
    return false;
  }

  const isValidMagicBytes = validateMagicBytes(buffer, expectedType);
  if (!isValidMagicBytes) {
    console.warn(
      `Magic bytes validation failed for file: ${filename}. Expected type: ${expectedType}`
    );
    return false;
  }

  return true;
}

router.post(
  "/",
  authenticate,
  upload.single("file"),
  async (req: WithUser, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const { buffer, mimetype, originalname, size } = req.file;

      // Validate file type (mimetype, extension, and magic bytes)
      if (!isValidFileType(mimetype, originalname, buffer)) {
        res.status(400).json({
          message:
            "Invalid file type or file content mismatch. Allowed types: .jpg, .jpeg, .png, .heic, .pdf, .docx",
        });
        return;
      }

      // Extract optional parameters for document naming
      const employeeIdParam = req.query.employeeId as string | undefined;
      const documentType = req.query.documentType as string | undefined;

      let employeeFirstName: string | undefined;

      // If employeeId is provided, fetch the employee's first name from database
      if (employeeIdParam && employeeIdParam !== "self") {
        try {
          // Try to find employee by ID - get full document to access employeeFields
          const employee = await EmployeeModel.findOne({
            _id: new Types.ObjectId(employeeIdParam),
            isDeleted: false,
          })
            .populate({
              path: "employeeProfile",
              select: "personaldetails",
            })
            .lean();

          if (employee) {
            // Try to get first name from employeeFields first (check both firstname and firstName)
            const empFields = (employee as any).employeeFields;
            const personalDetails = empFields?.personaldetails || {};

            employeeFirstName =
              personalDetails.firstname ||
              personalDetails.firstName ||
              personalDetails.first_name ||
              (employee as any).employeeProfile?.personaldetails?.firstname ||
              (employee as any).employeeProfile?.personaldetails?.firstName ||
              (employee as any).employeeProfile?.personaldetails?.first_name ||
              undefined;

            // Debug log if we found the first name
            if (employeeFirstName) {
              console.log("✅ Found employee first name:", employeeFirstName);
            } else {
              console.log(
                "⚠️ Could not find employee first name. Employee data:",
                {
                  hasEmployeeFields: !!empFields,
                  hasPersonalDetails: !!personalDetails,
                  personalDetailsKeys: Object.keys(personalDetails),
                  hasEmployeeProfile: !!(employee as any).employeeProfile,
                }
              );
            }
          }
        } catch (err) {
          console.warn("Failed to fetch employee first name:", err);
          // Continue without custom naming if fetch fails
        }
      } else if (employeeIdParam === "self") {
        // For "self", try to get from authenticated user's profile
        const userId = req.user?.userId;
        if (userId) {
          try {
            const employeeProfile = await EmployeeProfile.findOne({
              userId: new Types.ObjectId(userId),
            })
              .select("personaldetails.firstname")
              .lean();

            employeeFirstName = employeeProfile?.personaldetails?.firstname;
          } catch (err) {
            console.warn("Failed to fetch user profile first name:", err);
          }
        }
      }

      // Debug logging
      if (employeeIdParam || documentType) {
        console.log("📄 Document upload with custom naming:", {
          employeeId: employeeIdParam,
          documentType,
          employeeFirstName,
          originalName: originalname,
        });
      }

      // 1) Upload to S3 (private) with optional custom naming
      const { key, bucket, etag } = await uploadToS3(
        req.file,
        "uploads/employees",
        {
          employeeFirstName,
          documentType,
        }
      );

      // 2) Create File record
      // Store the original filename in the database, but the S3 key will have the custom name
      const doc = await FileModel.create({
        key,
        bucket,
        originalName: originalname, // Keep original name in DB for reference
        contentType: mimetype,
        size,
        etag,
        status: "uploaded",
        // uploadedBy: req.user?.id,
      });

      // 3) Short-lived preview URL (10s by default)
      const url = getCloudFrontSignedGetUrl(key);

      // 👇 This is EXACTLY what the frontend needs
      res.json({
        id: doc._id, // <-- fileId to store and later use
        key, // <-- stable S3 key (with custom name if provided)
        url, // <-- ephemeral preview (10s)
        expiresIn: Number(process.env.URL_SIGNING_EXPIRES_SECONDS || 10),
      });
    } catch (e) {
      console.error("Upload Error:", e);
      res.status(500).json({ error: "Failed to upload file" });
    }
  }
);

router.get("/:id/url", authenticate, async (req: WithUser, res) => {
  try {
    const file = await FileModel.findById(req.params.id);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    // Authorization: User must be authenticated (checked by authenticate middleware)
    const url = getCloudFrontSignedGetUrl(file.key);
    res.json({
      url,
      expiresIn: Number(process.env.URL_SIGNING_EXPIRES_SECONDS || 10),
    });
  } catch (e) {
    console.error("Signed URL Error:", e);
    res.status(500).json({ error: "Failed to generate URL" });
  }
});

export default router;
