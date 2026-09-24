// import mongoose, { Schema } from "mongoose";

// // Field Schema
// const FieldSchema = new Schema(
//   {
//     key: { type: String, required: true },
//     label: { type: String, required: true },
//     placeholder: { type: String, required: true },
//     hint: { type: String, default: "" },
//     required: { type: Boolean, default: true },
//     type: {
//       type: String,
//       enum: [
//         "text",
//         "select",
//         "date",
//         "file",
//         "number",
//         "email",
//         "checkbox",
//         "textarea",
//       ],
//       required: true,
//     },
//     options: {
//       type: [String],
//       default: [],
//     }, // for select and checkbox

//     fileTypes: {
//       type: [String],
//       default: [],
//     }, // for file

//     showIf: {
//       type: {
//         fieldKey: { type: String, required: true },
//         operator: {
//           type: String,
//           enum: ["equals", "notEquals"],
//           required: true,
//         },
//         value: { type: Schema.Types.Mixed, required: true },
//       },
//       required: false,
//     }, // for conditional visibility
//     isAdditional: { type: Boolean, default: false },
//     // Extra fields for file types
//     expiryDate: { type: Boolean, default: false },
//     mandatoryStatus: {
//       type: String,
//       enum: ["Mandatory Now", "Mandatory Later", "Not Mandatory"],
//       default: "Not Mandatory",
//     },
//     points: { type: Number, default: 0 },
//     referenceNumber: { type: Boolean, default: false },
//     issuingDate: { type: Boolean, default: false },
//   },
//   { _id: false }
// );

// // Inner Section
// const InnerSectionSchema = new Schema(
//   {
//     sectionKey: { type: String, required: true },
//     sectionLabel: { type: String, required: true },
//     fields: { type: [FieldSchema], default: [] },
//     isAdditional: { type: Boolean, default: false },
//   },
//   { _id: false }
// );

// // Section
// const SectionSchema = new Schema(
//   {
//     sectionKey: { type: String, required: true },
//     sectionLabel: { type: String, required: true },
//     fields: { type: [FieldSchema], default: [] },
//     innerSections: { type: [InnerSectionSchema], default: [] },
//     isAdditional: { type: Boolean, default: false },
//   },
//   { _id: false }
// );

// // Main Config
// const EmployeeFieldConfigSchema = new Schema(
//   {
//     tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
//     branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
//     designationId: {
//       type: Schema.Types.ObjectId,
//       ref: "Designation",
//       default: null,
//     },
//     sections: { type: [SectionSchema], default: [] },
//   },
//   { timestamps: true }
// );

// export default mongoose.models.EmployeeFieldConfig ||
//   mongoose.model("EmployeeFieldConfig", EmployeeFieldConfigSchema);

import mongoose, { Schema } from "mongoose";

// File Meta Schema (only applicable if type === 'file')
const FileMetaSchema = new Schema(
  {
    expiryDate: { type: Boolean, default: false }, // show expiry field in UI
    issuingDate: { type: Boolean, default: false }, // show issuing field in UI

    // NEW: Validity period string, e.g. "1 Year", "2.5 Months", "2.5 Days"
    validityPeriod: { type: String, default: undefined },

    // NEW: If true, expiry is auto-calculated from (issuingDate + validityPeriod)
    // and the expiry input should be disabled (read-only) in the UI
    expiryIsDisabled: { type: Boolean, default: false },

    // NEW: Country of Issue (for passport documents only)
    countryOfIssue: { type: Boolean, default: false },
  },
  { _id: false }
);

// Field Schema
const FieldSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    placeholder: { type: String, default: "" },
    hint: { type: String, default: "" },
    defaultValue: { type: Schema.Types.Mixed, default: undefined },
    required: { type: Boolean, default: false },
    type: {
      type: String,
      enum: [
        "text",
        "select",
        "date",
        "file",
        "number",
        "email",
        "checkbox",
        "textarea",
        "reference",
      ],
      required: true,
    },
    referenceModel: {
      type: String,
      required: function () {
        return this.type === "reference";
      },
    },
    options: [String],
    fileTypes: {
      type: [String],
      default: [],
    },
    fileMeta: {
      type: FileMetaSchema,
      default: undefined, // only present for type === 'file'
    },
    showIf: {
      type: {
        fieldKey: { type: String, required: true },
        operator: {
          type: String,
          enum: ["equals", "notEquals"],
          required: true,
        },
        value: { type: Schema.Types.Mixed, required: true },
      },
      required: false,
    },
    isAdditional: { type: Boolean, default: false },
    jobRole: {
      type: [String],
      default: [],
    },
    isMulti: { type: Boolean, default: false }, // For multi-select fields
    isCountrySelect: { type: Boolean, default: false }, // For country select fields
  },
  { _id: false }
);

// Inner Section Schema
const InnerSectionSchema = new Schema(
  {
    sectionKey: { type: String, required: true },
    sectionLabel: { type: String, required: true },
    fields: { type: [FieldSchema], default: [] },
    requirementMode: {
      type: String,
      enum: ["AND", "OR"],
      default: "AND",
    },
    employeeAccess: {
      type: String,
      enum: ["hidden", "view", "edit"],
      default: "edit",
    },
    isAdditional: { type: Boolean, default: false },
  },
  { _id: false }
);

// Section Schema
const SectionSchema = new Schema(
  {
    sectionKey: { type: String, required: true },
    sectionLabel: { type: String, required: true },
    fields: { type: [FieldSchema], default: [] },
    innerSections: { type: [InnerSectionSchema], default: [] },
    isAdditional: { type: Boolean, default: false },
    employeeAccess: {
      type: String,
      enum: ["hidden", "view", "edit"],
      default: "edit", // preserves old false = editable-by-employee behavior
    },
    dataAccessLevel: {
      type: Number,
      min: 1,
      max: 7,
      default: 1, // Employee level (1-7) - legacy: single level for all permissions
    },
    dataAccessLevels: {
      type: {
        read: { type: Number, min: 1, max: 7, default: 1 },
        write: { type: Number, min: 1, max: 7, default: 1 },
        delete: { type: Number, min: 1, max: 7, default: 1 },
      },
      required: false,
      _id: false,
    },
  },
  { _id: false }
);

// Main Config Schema
const EmployeeFieldConfigSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    designationId: {
      type: Schema.Types.ObjectId,
      ref: "Designation",
      default: null,
    },
    sections: { type: [SectionSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.EmployeeFieldConfig ||
  mongoose.model("EmployeeFieldConfig", EmployeeFieldConfigSchema);
