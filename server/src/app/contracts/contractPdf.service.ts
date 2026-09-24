import crypto from "crypto";
import type PDFDocumentType from "pdfkit";
import {
  ContractSnapshot,
  IContractSnapshot,
} from "@/database/models/contractSnapshot.model";
import { Types } from "mongoose";

/**
 * Contract PDF Service
 * Handles PDF generation from contract snapshots and hash-based tamper detection
 */

// Helper to strip HTML tags and decode entities
function stripHtml(html: string): string {
  if (!html) return "";

  let text = html || "";

  // Multi-pass decode for critical entities to handle double-escaping (e.g. &amp;lt; -> &lt; -> <)
  // Pass 1
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  // Pass 2 (in case of double escaping)
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

  text = text
    // Convert block elements to line breaks first
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    // Remove all remaining HTML tags
    .replace(/<[^>]*>/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    // .replace(/&lt;/g, "<") // Already handled
    // .replace(/&gt;/g, ">") // Already handled
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "...")
    .replace(/&bull;/g, "•")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    // Decode numeric entities
    .replace(/&#(\d+);/g, (match, dec) =>
      String.fromCharCode(parseInt(dec, 10))
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    // Normalize whitespace (but preserve intentional line breaks)
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

// Helper to get employee field value from snapshot
function getEmployeeFieldValue(
  fieldKey: string,
  applicantSnapshot: any
): string {
  if (!applicantSnapshot?.employeeFields) return "";

  const fields = applicantSnapshot.employeeFields;

  // Try direct field access (e.g., "personaldetails.firstname")
  const parts = fieldKey.split(".");
  let value: any = fields;

  for (const part of parts) {
    if (value && typeof value === "object") {
      value = value[part];
    } else {
      value = undefined;
      break;
    }
  }

  if (value !== undefined && value !== null && typeof value !== "object") {
    return String(value);
  }

  // Try searching in all sections
  for (const section of Object.values(fields)) {
    if (section && typeof section === "object" && (section as any)[fieldKey]) {
      return String((section as any)[fieldKey]);
    }
  }

  return "";
}

// Replace placeholders in text with actual values
function replacePlaceholders(
  text: string,
  applicantSnapshot: any,
  customFields: any[]
): string {
  if (!text) return "";

  return text.replace(
    /\{\{(employee|custom)\.([^}]+)\}\}/g,
    (match, type, key) => {
      if (type === "employee") {
        return getEmployeeFieldValue(key, applicantSnapshot) || `[${key}]`;
      } else if (type === "custom") {
        const field = customFields?.find((f: any) => f.key === key);
        return field?.defaultValue || `[${key}]`;
      }
      return match;
    }
  );
}

/**
 * Generate PDF buffer from contract snapshot
 */
export async function generateContractPdfBuffer(
  snapshotId: Types.ObjectId
): Promise<{ buffer: Buffer; snapshot: IContractSnapshot }> {
  const snapshot = await ContractSnapshot.findById(snapshotId);
  if (!snapshot) {
    throw new Error("Contract snapshot not found");
  }

  const PDFDocument = (await import("pdfkit")) as unknown as {
    default: typeof PDFDocumentType;
  };

  return new Promise((resolve, reject) => {
    try {
      const pdf = new (PDFDocument.default as any)({
        size: "A4",
        margin: 50,
        bufferPages: true,
        info: {
          Title: snapshot.templateSnapshot?.title || "Employment Contract",
          Author: snapshot.organizationSnapshot?.tenantName || "HR Nexus",
          Subject: "Employment Contract",
          CreationDate: new Date(),
        },
      });

      const chunks: Buffer[] = [];
      pdf.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdf.on("end", () => resolve({ buffer: Buffer.concat(chunks), snapshot }));
      pdf.on("error", reject);

      const template = snapshot.templateSnapshot;
      const applicant = snapshot.applicantSnapshot;
      const builder = template?.builder || {};
      const customFields = builder.fields?.custom || [];

      // Page dimensions
      const pageWidth = pdf.page.width;
      const pageMargin = pdf.page.margins.left;
      const contentWidth = pageWidth - pageMargin * 2;

      // Colors
      const primaryColor = "#1e40af"; // Blue
      const textColor = "#1f2937";
      const lightGray = "#9ca3af";

      // ========== HEADER ==========
      pdf.rect(0, 0, pageWidth, 100).fill(primaryColor);

      pdf
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(24)
        .text(
          template?.title?.toUpperCase() || "EMPLOYMENT CONTRACT",
          pageMargin,
          35,
          {
            width: contentWidth,
            align: "center",
          }
        );

      if (template?.version) {
        pdf
          .fontSize(10)
          .font("Helvetica")
          .text(`Version ${template.version}`, pageMargin, 65, {
            width: contentWidth,
            align: "center",
          });
      }

      pdf.fillColor(textColor);
      pdf.y = 120;

      // ========== PARTIES SECTION ==========
      pdf
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(primaryColor)
        .text("PARTIES TO THIS AGREEMENT", pageMargin, pdf.y);
      pdf.moveDown(0.5);

      // Employer
      pdf
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(textColor)
        .text("EMPLOYER:", pageMargin, pdf.y);
      pdf
        .font("Helvetica")
        .fontSize(11)
        .text(
          snapshot.organizationSnapshot?.tenantName ||
            snapshot.employerName ||
            "[Employer Name]",
          pageMargin + 100,
          pdf.y - 13
        );
      pdf.moveDown(0.3);

      // Employee
      const employeeName =
        `${getEmployeeFieldValue("personaldetails.firstname", applicant)} ${getEmployeeFieldValue("personaldetails.lastname", applicant)}`.trim() ||
        "[Employee Name]";
      pdf
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("EMPLOYEE:", pageMargin, pdf.y);
      pdf
        .font("Helvetica")
        .fontSize(11)
        .text(employeeName, pageMargin + 100, pdf.y - 13);
      pdf.moveDown(1);

      // Separator
      pdf
        .strokeColor(lightGray)
        .lineWidth(0.5)
        .moveTo(pageMargin, pdf.y)
        .lineTo(pageWidth - pageMargin, pdf.y)
        .stroke();
      pdf.moveDown(1);

      // ========== CONTRACT BODY ==========
      // Title & Description from builder.body (if present)
      const bodyTitle = builder.body?.title;
      const bodyDescription = builder.body?.description;

      if (bodyTitle || bodyDescription) {
        if (bodyTitle) {
          const titleText = stripHtml(
            replacePlaceholders(bodyTitle, applicant, customFields)
          );
          if (titleText) {
            pdf
              .font("Helvetica-Bold")
              .fontSize(12)
              .fillColor(primaryColor)
              .text(titleText.toUpperCase(), pageMargin, pdf.y);
            pdf.moveDown(0.3);
          }
        }
        if (bodyDescription) {
          const descText = stripHtml(
            replacePlaceholders(bodyDescription, applicant, customFields)
          );
          if (descText) {
            pdf
              .font("Helvetica")
              .fontSize(10)
              .fillColor(textColor)
              .text(descText, pageMargin, pdf.y, {
                width: contentWidth,
                align: "justify",
              });
            pdf.moveDown(1);
          }
        }
      }

      // ========== SCHEDULE ========== (Moved to match preview order)
      const scheduleItems = Array.isArray(builder.schedule)
        ? builder.schedule
        : builder.schedule?.items || [];
      const scheduleTitle = builder.schedule?.title || builder.scheduleTitle;
      if (scheduleItems.length > 0) {
        if (pdf.y > pdf.page.height - 200) {
          pdf.addPage();
        }

        // Schedule title
        if (scheduleTitle) {
          const schedTitleText = stripHtml(
            replacePlaceholders(scheduleTitle, applicant, customFields)
          );
          pdf
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text(schedTitleText.toUpperCase(), pageMargin, pdf.y);
        } else {
          pdf
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text("SCHEDULE", pageMargin, pdf.y);
        }
        pdf.moveDown(0.5);

        // Render schedule items (list format to match preview)
        for (const item of scheduleItems.sort(
          (a: any, b: any) => (a.order || 0) - (b.order || 0)
        )) {
          if (pdf.y > pdf.page.height - 100) {
            pdf.addPage();
          }

          // Number/order
          const itemNumber = stripHtml(item.numberText || `${item.order}.`);
          const itemLabel = stripHtml(
            replacePlaceholders(item.label || "", applicant, customFields)
          );
          const itemValue = stripHtml(
            replacePlaceholders(item.value || "", applicant, customFields)
          );

          pdf
            .font("Helvetica-Bold")
            .fontSize(10)
            .fillColor(textColor)
            .text(itemNumber, pageMargin, pdf.y, { continued: true });
          pdf
            .font("Helvetica-Bold")
            .text(` ${itemLabel}`, { continued: false });

          if (itemValue) {
            pdf
              .font("Helvetica")
              .fontSize(10)
              .fillColor(textColor)
              .text(itemValue, pageMargin + 20, pdf.y, {
                width: contentWidth - 20,
              });
          }
          pdf.moveDown(0.5);
        }
        pdf.moveDown(0.5);
      }

      // Background Section
      const backgrounds = builder.body?.backgrounds || [];
      const backgroundTitle = builder.body?.backgroundTitle;
      if (backgrounds.length > 0) {
        if (pdf.y > pdf.page.height - 150) {
          pdf.addPage();
        }

        // Background section title
        if (backgroundTitle) {
          const bgTitleText = stripHtml(
            replacePlaceholders(backgroundTitle, applicant, customFields)
          );
          pdf
            .font("Helvetica-Bold")
            .fontSize(12)
            .fillColor(primaryColor)
            .text(bgTitleText.toUpperCase(), pageMargin, pdf.y);
        } else {
          pdf
            .font("Helvetica-Bold")
            .fontSize(12)
            .fillColor(primaryColor)
            .text("BACKGROUND", pageMargin, pdf.y);
        }
        pdf.moveDown(0.3);

        // Render each background item
        for (let i = 0; i < backgrounds.length; i++) {
          const bg = backgrounds[i];
          const bgContent = typeof bg === "string" ? bg : bg?.content;
          const bgNumber = typeof bg === "string" ? undefined : bg?.numberText;

          if (bgContent) {
            const bgText = stripHtml(
              replacePlaceholders(bgContent, applicant, customFields)
            );
            if (bgText) {
              if (bgNumber) {
                pdf
                  .font("Helvetica-Bold")
                  .fontSize(10)
                  .fillColor(textColor)
                  .text(`${bgNumber}`, pageMargin, pdf.y, { continued: true });
                pdf
                  .font("Helvetica")
                  .fontSize(10)
                  .text(` ${bgText}`, {
                    width: contentWidth - 20,
                    align: "justify",
                  });
              } else {
                pdf
                  .font("Helvetica")
                  .fontSize(10)
                  .fillColor(textColor)
                  .text(
                    `(${String.fromCharCode(97 + i)}) ${bgText}`,
                    pageMargin,
                    pdf.y,
                    { width: contentWidth, align: "justify" }
                  );
              }
              pdf.moveDown(0.5);
            }
          }
        }
        pdf.moveDown(0.5);
      }

      // Recitals (legacy support)
      const recitals = builder.body?.recitals;
      if (recitals) {
        pdf
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(primaryColor)
          .text("RECITALS", pageMargin, pdf.y);
        pdf.moveDown(0.3);

        const recitalText = stripHtml(
          replacePlaceholders(recitals, applicant, customFields)
        );
        pdf
          .font("Helvetica")
          .fontSize(10)
          .fillColor(textColor)
          .text(recitalText, pageMargin, pdf.y, {
            width: contentWidth,
            align: "justify",
          });
        pdf.moveDown(1);
      }

      // Clauses - FIXED: use builder.body.clauses instead of builder.clauses
      const clauses = builder.body?.clauses || builder.clauses || [];
      const clauseDefaults = builder.logic?.clauseDefaults || {};
      const clauseTitle = builder.body?.clauseTitle;

      // Clause section title
      if (clauses.length > 0) {
        if (pdf.y > pdf.page.height - 150) {
          pdf.addPage();
        }

        if (clauseTitle) {
          const clauseTitleText = stripHtml(
            replacePlaceholders(clauseTitle, applicant, customFields)
          );
          pdf
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text(clauseTitleText.toUpperCase(), pageMargin, pdf.y);
        } else {
          pdf
            .font("Helvetica-Bold")
            .fontSize(14)
            .fillColor(primaryColor)
            .text("CLAUSES", pageMargin, pdf.y);
        }
        pdf.moveDown(0.5);
      }

      let clauseNumber = 1;
      for (const clause of clauses) {
        // Check if clause is included
        const isExplicitlyDisabled = clauseDefaults[clause.id] === false;
        const isDefaultIncluded = clause.defaultIncluded !== false;
        if (isExplicitlyDisabled || !isDefaultIncluded) continue;

        // Check page space
        if (pdf.y > pdf.page.height - 150) {
          pdf.addPage();
        }

        pdf
          .font("Helvetica-Bold")
          .fontSize(11)
          .fillColor(primaryColor)
          .text(
            `${clauseNumber}. ${clause.title?.toUpperCase() || "CLAUSE"}`,
            pageMargin,
            pdf.y
          );
        pdf.moveDown(0.3);

        if (clause.body) {
          const bodyText = stripHtml(
            replacePlaceholders(clause.body, applicant, customFields)
          );
          pdf
            .font("Helvetica")
            .fontSize(10)
            .fillColor(textColor)
            .text(bodyText, pageMargin, pdf.y, {
              width: contentWidth,
              align: "justify",
            });
        }
        pdf.moveDown(0.8);
        clauseNumber++;
      }

      // ========== SIGNATURES ==========
      if (pdf.y > pdf.page.height - 300) {
        pdf.addPage();
      }

      pdf.moveDown(2);
      pdf
        .font("Helvetica-Bold")
        .fontSize(14)
        .fillColor(primaryColor)
        .text("SIGNATURES", pageMargin, pdf.y);
      pdf.moveDown(1);

      const sigBoxWidth = (contentWidth - 40) / 2;
      const sigBoxHeight = 120;
      const sigY = pdf.y;

      // Employer signature box
      pdf.rect(pageMargin, sigY, sigBoxWidth, sigBoxHeight).stroke(lightGray);
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(textColor)
        .text("EMPLOYER", pageMargin + 10, sigY + 10);

      if (snapshot.employerSignatureData) {
        try {
          pdf.image(
            snapshot.employerSignatureData,
            pageMargin + 10,
            sigY + 30,
            { width: sigBoxWidth - 20, height: 50, fit: [sigBoxWidth - 20, 50] }
          );
        } catch (e) {
          pdf
            .font("Helvetica")
            .fontSize(9)
            .text("[Digital Signature]", pageMargin + 10, sigY + 50);
        }
      }

      pdf
        .font("Helvetica")
        .fontSize(9)
        .text(
          `Name: ${snapshot.employerName || "[Employer Name]"}`,
          pageMargin + 10,
          sigY + 85
        )
        .text(
          `Date: ${snapshot.employerSignedAt ? new Date(snapshot.employerSignedAt).toLocaleDateString() : "___________"}`,
          pageMargin + 10,
          sigY + 100
        );

      // Employee signature box
      const empSigX = pageMargin + sigBoxWidth + 40;
      pdf.rect(empSigX, sigY, sigBoxWidth, sigBoxHeight).stroke(lightGray);
      pdf
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(textColor)
        .text("EMPLOYEE", empSigX + 10, sigY + 10);

      if (snapshot.applicantSignatureData) {
        try {
          pdf.image(snapshot.applicantSignatureData, empSigX + 10, sigY + 30, {
            width: sigBoxWidth - 20,
            height: 50,
            fit: [sigBoxWidth - 20, 50],
          });
        } catch (e) {
          pdf
            .font("Helvetica")
            .fontSize(9)
            .text("[Digital Signature]", empSigX + 10, sigY + 50);
        }
      }

      pdf
        .font("Helvetica")
        .fontSize(9)
        .text(`Name: ${employeeName}`, empSigX + 10, sigY + 85)
        .text(
          `Date: ${snapshot.applicantSignedAt ? new Date(snapshot.applicantSignedAt).toLocaleDateString() : "___________"}`,
          empSigX + 10,
          sigY + 100
        );

      // ========== EMPLOYEE APPROVER SIGNATURES ==========
      const employeeApprovals = snapshot.employeeApprovals || [];
      if (employeeApprovals.length > 0) {
        // Move to next row after employer/employee signatures
        pdf.y = sigY + sigBoxHeight + 20;

        // Check if we need a new page
        if (pdf.y > pdf.page.height - 200) {
          pdf.addPage();
        }

        pdf
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor(primaryColor)
          .text("AUTHORISED SIGNATORIES", pageMargin, pdf.y);
        pdf.moveDown(0.5);

        // Calculate layout for approver signatures (2 per row)
        const approverSigBoxWidth = (contentWidth - 40) / 2;
        const approverSigBoxHeight = 100;
        let approverRowY = pdf.y;
        let approverCol = 0;

        for (const approverSig of employeeApprovals) {
          if (!approverSig.signatureData) continue; // Skip if no signature

          // Start new row if needed
          if (approverCol === 2) {
            approverCol = 0;
            approverRowY += approverSigBoxHeight + 15;
          }

          // Check for page break
          if (approverRowY > pdf.page.height - 150) {
            pdf.addPage();
            approverRowY = pdf.y;
          }

          const approverX =
            approverCol === 0
              ? pageMargin
              : pageMargin + approverSigBoxWidth + 40;

          // Draw signature box
          pdf
            .rect(
              approverX,
              approverRowY,
              approverSigBoxWidth,
              approverSigBoxHeight
            )
            .stroke(lightGray);

          // Try to render signature image
          if (approverSig.signatureData) {
            try {
              pdf.image(
                approverSig.signatureData,
                approverX + 10,
                approverRowY + 10,
                {
                  width: approverSigBoxWidth - 20,
                  height: 40,
                  fit: [approverSigBoxWidth - 20, 40],
                }
              );
            } catch (e) {
              pdf
                .font("Helvetica")
                .fontSize(9)
                .fillColor(textColor)
                .text("[Digital Signature]", approverX + 10, approverRowY + 25);
            }
          }

          // Approver name and details
          pdf.font("Helvetica").fontSize(9).fillColor(textColor);
          const approverName = approverSig.employeeName || "[Approver Name]";
          const approverDesig = approverSig.designation || "";
          const approverDate = approverSig.signedAt
            ? new Date(approverSig.signedAt).toLocaleDateString()
            : "___________";

          pdf.text(`Name: ${approverName}`, approverX + 10, approverRowY + 55);
          if (approverDesig) {
            pdf.text(
              `Title: ${approverDesig}`,
              approverX + 10,
              approverRowY + 67
            );
          }
          pdf.text(`Date: ${approverDate}`, approverX + 10, approverRowY + 79);

          approverCol++;
        }

        // Update pdf.y to after the approver signatures
        pdf.y = approverRowY + approverSigBoxHeight + 10;
      }

      // ========== FOOTER with hash placeholder ==========
      pdf.moveDown(3);
      pdf
        .font("Helvetica")
        .fontSize(8)
        .fillColor(lightGray)
        .text(
          "This document was digitally generated by HR Nexus. Any modification can be detected using the Tamper Check feature.",
          pageMargin,
          pdf.y,
          {
            width: contentWidth,
            align: "center",
          }
        );

      pdf.moveDown(0.5);
      pdf
        .fontSize(7)
        .text(`Document ID: ${snapshot._id}`, pageMargin, pdf.y, {
          width: contentWidth,
          align: "center",
        });

      pdf.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Compute SHA-256 hash of PDF buffer
 */
export function computePdfHash(pdfBuffer: Buffer): string {
  return crypto.createHash("sha256").update(pdfBuffer).digest("hex");
}

/**
 * Verify uploaded PDF against stored hash
 */
export async function verifyPdfTamper(
  snapshotId: Types.ObjectId,
  uploadedPdfBuffer: Buffer
): Promise<{
  isValid: boolean;
  storedHash: string | null;
  uploadedHash: string;
  message: string;
}> {
  const snapshot = await ContractSnapshot.findById(snapshotId);
  if (!snapshot) {
    throw new Error("Contract snapshot not found");
  }

  if (!snapshot.pdfHash) {
    return {
      isValid: false,
      storedHash: null,
      uploadedHash: computePdfHash(uploadedPdfBuffer),
      message:
        "No PDF has been downloaded yet for this contract. Download the PDF first to enable tamper detection.",
    };
  }

  const uploadedHash = computePdfHash(uploadedPdfBuffer);
  const isValid = uploadedHash === snapshot.pdfHash;

  return {
    isValid,
    storedHash: snapshot.pdfHash,
    uploadedHash,
    message: isValid
      ? "✓ Valid Contract: This PDF matches the original document and has not been tampered with."
      : "✗ Invalid/Edited Contract: This PDF does not match the original document. It may have been modified.",
  };
}

/**
 * Get snapshot by approval ID
 */
export async function getSnapshotByApprovalId(
  approvalId: Types.ObjectId
): Promise<IContractSnapshot | null> {
  return ContractSnapshot.findOne({ approvalId });
}
