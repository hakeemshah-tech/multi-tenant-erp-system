// // src/modules/employeeFieldConfig/employeeFieldConfig.validation.ts

// import { z } from "zod";

// /** File Meta Schema (only for file type fields) */
// const fileMetaSchema = z.object({
//   expiryDate: z.boolean().optional(),
//   issuingDate: z.boolean().optional(),

//   // Accepts "1 Year", "2.5 Months", "2.5 Days" (case-insensitive)
//   validityPeriod: z
//     .string()
//     .regex(/^\d+(\.\d+)?\s*(days?|months?|years?)$/i, {
//       message:
//         "validityPeriod must look like '1 Year', '2.5 Months', or '10 Days'",
//     })
//     .optional(),

//   // If true, expiry is UI-locked
//   expiryIsDisabled: z.boolean().optional(),
// });

// /** ShowIf Schema (conditional visibility) */
// const showIfSchema = z.object({
//   fieldKey: z.string().min(1),
//   operator: z.enum(["equals", "notEquals"]),
//   value: z.any(),
// });

// /** Field Schema */
// const fieldSchema = z
//   .object({
//     key: z.string().min(1),
//     label: z.string().min(1),
//     placeholder: z.string().optional(),
//     hint: z.string().optional(),
//     required: z.boolean().default(true),
//     type: z.enum([
//       "text",
//       "select",
//       "date",
//       "file",
//       "number",
//       "email",
//       "checkbox",
//       "textarea",
//       "reference",
//     ]),
//     options: z.array(z.string()).optional(),
//     fileTypes: z.array(z.string()).optional(),
//     fileMeta: fileMetaSchema.optional(),
//     showIf: showIfSchema.optional(),
//     isAdditional: z.boolean().optional(),
//     referenceModel: z.string().optional(), // required when type === 'reference'
//   })
//   .superRefine((field, ctx) => {
//     if (field.type === "reference" && !field.referenceModel) {
//       ctx.addIssue({
//         code: z.ZodIssueCode.custom,
//         message: "referenceModel is required when type is 'reference'",
//         path: ["referenceModel"],
//       });
//     }
//     // If you want to enforce validityPeriod requires issuing+expiry, uncomment:
//     // if (field.type === "file" && field.fileMeta?.validityPeriod) {
//     //   if (!field.fileMeta?.issuingDate || !field.fileMeta?.expiryDate) {
//     //     ctx.addIssue({
//     //       code: z.ZodIssueCode.custom,
//     //       message:
//     //         "validityPeriod requires Issuing Date and Expiry Date to be enabled in fileMeta",
//     //       path: ["fileMeta", "validityPeriod"],
//     //     });
//     //   }
//     // }
//   });

// /** Inner Section Schema */
// const innerSectionSchema = z.object({
//   sectionKey: z.string().min(1),
//   sectionLabel: z.string().min(1),
//   fields: z.array(fieldSchema),
//   requirementMode: z.enum(["AND", "OR"]).optional(),
//   isAdditional: z.boolean().optional(),
// });

// /** Section Schema */
// const sectionSchema = z
//   .object({
//     sectionKey: z.string().min(1),
//     sectionLabel: z.string().min(1),
//     fields: z.array(fieldSchema),
//     innerSections: z.array(innerSectionSchema).optional(),
//     isAdditional: z.boolean().optional(),
//     requirementMode: z.enum(["AND", "OR"]).optional(),

//     /** NEW: only meaningful for additional/custom sections */
//     employeerOnlyEditable: z.boolean().optional(),
//   })
//   .superRefine((section, ctx) => {
//     // Only allow employeerOnlyEditable when isAdditional === true
//     if (section.employeerOnlyEditable && section.isAdditional !== true) {
//       ctx.addIssue({
//         code: z.ZodIssueCode.custom,
//         message:
//           "employeerOnlyEditable can be true only when the section is marked as additional (isAdditional: true).",
//         path: ["employeerOnlyEditable"],
//       });
//     }
//   });

// /** Create or Update Config Schema */
// export const createOrUpdateConfigSchema = z.object({
//   designationId: z.string().optional(),
//   sections: z.array(sectionSchema),
// });

// /** Reset Config Schema */
// export const resetConfigSchema = z.object({
//   designationId: z.string().optional(),
// });

// src/modules/employeeFieldConfig/employeeFieldConfig.validation.ts

import { z } from "zod";

/** -----------------------------
 * Employee Access (tri-state)
 * ----------------------------- */
const employeeAccessEnum = z.enum(["hidden", "view", "edit"]);

/** Accepts the new enum OR legacy boolean, maps to enum */
const employeeAccessSchema = z
  .preprocess((val) => {
    if (typeof val === "boolean") {
      // Legacy mapping:
      // true  => employer only (hidden from employees)
      // false => employees can edit
      return val ? "hidden" : "edit";
    }
    return val;
  }, employeeAccessEnum)
  .default("edit");

/** -----------------------------
 * File Meta Schema (only for file type fields)
 * ----------------------------- */
const fileMetaSchema = z.object({
  expiryDate: z.boolean().optional(),
  issuingDate: z.boolean().optional(),

  // Accepts "1 Year", "2.5 Months", "2.5 Days" (case-insensitive)
  validityPeriod: z
    .string()
    .regex(/^\d+(\.\d+)?\s*(days?|months?|years?)$/i, {
      message:
        "validityPeriod must look like '1 Year', '2.5 Months', or '10 Days'",
    })
    .optional(),

  // If true, expiry is UI-locked
  expiryIsDisabled: z.boolean().optional(),

  // Country of Issue (for passport documents only)
  countryOfIssue: z.boolean().optional(),
});

/** -----------------------------
 * ShowIf Schema (conditional visibility)
 * ----------------------------- */
const showIfSchema = z.object({
  fieldKey: z.string().min(1),
  operator: z.enum(["equals", "notEquals"]),
  value: z.any(),
});

/** -----------------------------
 * Field Schema
 * ----------------------------- */
const fieldSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    placeholder: z.string().optional(),
    hint: z.string().optional(),
    defaultValue: z.any().optional(), // Can be string, number, boolean, etc.
    required: z.boolean().default(true),
    type: z.enum([
      "text",
      "select",
      "date",
      "file",
      "number",
      "email",
      "checkbox",
      "textarea",
      "reference",
    ]),
    options: z.array(z.string()).optional(),
    fileTypes: z.array(z.string()).optional(),
    fileMeta: fileMetaSchema.optional(),
    showIf: showIfSchema.optional(),
    isAdditional: z.boolean().optional(),
    referenceModel: z.string().optional(), // required when type === 'reference'
    jobRole: z.array(z.string()).optional(), // Array of designation IDs
    isMulti: z.boolean().optional(), // For multi-select fields
    isCountrySelect: z.boolean().optional(), // For country select fields
  })
  .superRefine((field, ctx) => {
    if (field.type === "reference" && !field.referenceModel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "referenceModel is required when type is 'reference'",
        path: ["referenceModel"],
      });
    }
    // If you want to enforce validityPeriod requires issuing+expiry, uncomment:
    // if (field.type === "file" && field.fileMeta?.validityPeriod) {
    //   if (!field.fileMeta?.issuingDate || !field.fileMeta?.expiryDate) {
    //     ctx.addIssue({
    //       code: z.ZodIssueCode.custom,
    //       message:
    //         "validityPeriod requires Issuing Date and Expiry Date to be enabled in fileMeta",
    //       path: ["fileMeta", "validityPeriod"],
    //     });
    //   }
    // }
  });

/** -----------------------------
 * Inner Section Schema
 * ----------------------------- */
const innerSectionSchema = z.object({
  sectionKey: z.string().min(1),
  sectionLabel: z.string().min(1),
  fields: z.array(fieldSchema),
  requirementMode: z.enum(["AND", "OR"]).optional(),
  isAdditional: z.boolean().optional(),
  // NEW: tri-state employee access on inner sections too
  employeeAccess: employeeAccessSchema.optional().default("edit"),
});

/** -----------------------------
 * Section Schema
 * ----------------------------- */
const sectionSchema = z
  .object({
    sectionKey: z.string().min(1),
    sectionLabel: z.string().min(1),
    fields: z.array(fieldSchema),
    innerSections: z.array(innerSectionSchema).optional(),
    isAdditional: z.boolean().optional(),
    requirementMode: z.enum(["AND", "OR"]).optional(),

    // NEW: tri-state employee access (replaces employeerOnlyEditable)
    employeeAccess: employeeAccessSchema.optional().default("edit"),
    // Data access level (1-7) - legacy: single level for all permissions
    dataAccessLevel: z.number().int().min(1).max(7).optional().default(1),
    // Data access levels per permission type (read, write, delete)
    dataAccessLevels: z
      .object({
        read: z.number().int().min(1).max(7).optional().default(1),
        write: z.number().int().min(1).max(7).optional().default(1),
        delete: z.number().int().min(1).max(7).optional().default(1),
      })
      .optional(),
  })
  .superRefine((section, ctx) => {
    // If you still want to restrict where access is configured, you can enforce rules here.
    // Example (OPTIONAL): only allow 'hidden' or 'view' on custom/additional sections.
    // if (section.isAdditional !== true && section.employeeAccess !== "edit") {
    //   ctx.addIssue({
    //     code: z.ZodIssueCode.custom,
    //     message:
    //       "Only additional (custom) sections may set employeeAccess to 'view' or 'hidden'.",
    //     path: ["employeeAccess"],
    //   });
    // }
  });

/** -----------------------------
 * Create / Update / Reset Schemas
 * ----------------------------- */
export const createOrUpdateConfigSchema = z.object({
  designationId: z.string().optional(),
  sections: z.array(sectionSchema),
  diff: z.any(),
});

export const resetConfigSchema = z.object({
  designationId: z.string().optional(),
});
