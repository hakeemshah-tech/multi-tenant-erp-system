// import mongoose, { Schema } from "mongoose";

// /** Matches EmployeeProfile's FileValueSchema */
// const FileValueSchema = new Schema(
//   {
//     url: { type: String },
//     expiryDate: Date,
//     issuingDate: Date,
//     referenceNumber: String,
//     points: Number,
//   },
//   { _id: false }
// );

// const employeeSchema = new Schema(
//   {
//     tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
//     branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
//     designation: {
//       type: Schema.Types.ObjectId,
//       ref: "Designation",
//       required: true,
//     },
//     employeeProfile: {
//       type: Schema.Types.ObjectId,
//       ref: "EmployeeProfile",
//       required: true,
//     },
//     reportingto: {
//       type: Schema.Types.ObjectId,
//       ref: "Employee",
//       default: null,
//     },

//     /**
//      * Mirror of EmployeeProfile fields, embedded in Employee.
//      * Includes: main, personaldetails, address, documents, additionalFields
//      */
//     employeeFields: {
//       type: new Schema(
//         {
//           // === personaldetails (same as EmployeeProfile.personaldetails) ===
//           personaldetails: {
//             employeephoto: { url: String },
//             firstname: String,
//             middlename: String,
//             lastname: String,
//             preferredname: String,
//             location: String,
//             state: String,
//             mobile: String,
//             dob: Date,
//             gender: { type: String, enum: ["male", "female"] },
//             lgbtq: {
//               type: String,
//               enum: [
//                 "Lesbian",
//                 "Gay",
//                 "Bisexual",
//                 "Transgender",
//                 "Queer",
//                 "Intersex",
//                 "Asexual",
//               ],
//             },
//             residencystatus: {
//               type: String,
//               enum: ["Australian Citizen", "Permanent Resident", "Visa Holder"],
//             },
//             typeofvisa: {
//               type: String,
//               enum: ["Work Visa", "Student Visa", "Working Holiday Visa"],
//             },
//             visasubcategory: String,
//             visastartdate: Date,
//             visaenddate: Date,
//             nameofinstitutionstudying: String,
//             coursestartdate: Date,
//             courseenddate: Date,
//             emergencycontact: {
//               "emergency-contact-name": String,
//               "emergency-contact-relationship": String,
//               "emergency-contact-mobile": String,
//             },
//           },

//           // === address (same as EmployeeProfile.address) ===
//           address: [
//             {
//               addressFor: String,
//               buildingpropertyname: String,
//               flatunitnumber: String,
//               streetnumber: String,
//               streetname: String,
//               suburbcity: String,
//               stateterritiory: String,
//               country: String,
//               zippostalcode: String,
//             },
//           ],

//           // === documents (same as EmployeeProfile.documents) ===
//           documents: {
//             identificationdocuments: {
//               driverslicence: FileValueSchema,
//               passport: FileValueSchema,
//               birthcertificate: FileValueSchema,
//               australiancitizenshipcertificate: FileValueSchema,
//               medicarecard: FileValueSchema,
//               proofofagecard: FileValueSchema,
//             },
//             certificates: {
//               cpr: FileValueSchema,
//               firstaid: FileValueSchema,
//               manualhandling: FileValueSchema,
//               medicationcompletency: FileValueSchema,
//             },
//             checksandclearance: {
//               policeclearancecertificate: FileValueSchema,
//               ndisscreensingcheck: FileValueSchema,
//               covid19vaccinationcertificate: FileValueSchema,
//             },
//           },

//           // === additionalFields (inline schema; same shape as in EmployeeProfile) ===
//           additionalFields: {
//             type: [
//               new Schema(
//                 {
//                   sectionKey: { type: String }, // e.g. "documents"
//                   innerSectionKey: { type: String }, // e.g. "certificates" (optional)
//                   fieldKey: { type: String, required: true }, // e.g. "cpr" or custom key
//                   value: Schema.Types.Mixed, // string | number | date | object | array
//                   isShowInProfile: { type: Boolean, default: false },
//                 },
//                 { _id: false }
//               ),
//             ],
//             default: [],
//           },
//         },
//         { _id: false }
//       ),
//       default: {},
//     },

//     /**
//      * Employer-only extra fields (not shown to employees)
//      * Similar shape to additionalFields, but strictly private.
//      */
//     employeerOnlyAdditionalFields: {
//       type: [
//         new Schema(
//           {
//             sectionKey: { type: String },
//             innerSectionKey: { type: String },
//             fieldKey: { type: String, required: true },
//             value: Schema.Types.Mixed,
//           },
//           { _id: false }
//         ),
//       ],
//       default: [],
//     },

//     isDeleted: { type: Boolean, default: false },
//     deletedAt: { type: Date, default: null },
//   },
//   { timestamps: true }
// );

// const EmployeeModel = mongoose.model("Employee", employeeSchema);
// export default EmployeeModel;

// models/Employee.ts
import mongoose, { Schema } from "mongoose";

/** Enhanced FileRefSchema with document status tracking and approval workflow */
const createFileRefSchema = () =>
  new Schema(
    {
      // File reference - optional initially, required when document is uploaded
      fileId: { type: Schema.Types.ObjectId, ref: "File" },
      key: { type: String }, // denormalized S3 key

      // optional domain fields
      expiryDate: Date,
      issuingDate: Date,
      referenceNumber: String, // Reference number for documents that require it
      countryOfIssue: String, // Country of issue (for passport documents only)

      // Document status tracking - this is the core of our approval workflow
      status: {
        type: String,
        enum: ["pendingToApprove", "approved", "rejected", "expired"],
        default: "pendingToApprove", // New uploads start as pending
      },
      uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: false, // Optional for existing documents, will be set when uploaded
      },
      reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
      reviewedAt: Date,
      rejectionReason: String,
      metadata: {
        originalFileName: String,
        fileSize: Number,
        mimeType: String,
        uploadDate: { type: Date, default: Date.now },
        previousStatus: String,
        // Track what changed to trigger pending status
        changeReason: {
          type: String,
          enum: [
            "newUpload",
            "fileUpdate",
            "expiryChange",
            "issuingDateChange",
          ],
        },
      },
    },
    { _id: false }
  );

const EmployeeAdditionalFieldSchema = new Schema(
  {
    sectionKey: { type: String }, // e.g. "documents"
    innerSectionKey: { type: String }, // e.g. "certificates" (optional)
    fieldKey: { type: String, required: true },
    value: Schema.Types.Mixed, // string | number | date | object | array (can include {fileId,key} objects for docs)
    isShowInProfile: { type: Boolean, default: false },
  },
  { _id: false }
);

const employeeSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    designation: {
      type: Schema.Types.ObjectId,
      ref: "Designation",
      required: true,
    },
    employeeProfile: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeProfile",
      required: true,
    },
    reportingto: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    /**
     * Additional roles assigned directly to employee (beyond job title roles)
     * These are roleId strings (not ObjectIds)
     */
    additionalRoleIds: {
      type: [String],
      default: [],
      required: false,
    },

    /**
     * Additional job titles assigned directly to employee (beyond primary designation)
     * These are Designation ObjectIds
     */
    additionalDesignationIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Designation",
        required: false,
      },
    ],

    /**
     * Mirror of EmployeeProfile fields, embedded in Employee.
     * Includes: personaldetails, address, documents, additionalFields
     */
    employeeFields: {
      type: new Schema(
        {
          // === personaldetails (same as EmployeeProfile.personaldetails) ===
          // NOTE: avatar remains URL-based for now
          personaldetails: {
            employeephoto: createFileRefSchema(),
            firstname: String,
            middlename: String,
            lastname: String,
            preferredname: String,
            location: String,
            state: String,
            mobile: String,
            dob: Date,
            gender: {
              type: String,
              enum: ["Male", "Female", "Intersex", "Don't want to Specify"],
            },
            pronouns: {
              type: String,
              enum: ["He/Him", "She/Her", "They/Them"],
            },
            aboriginalortorresstraitislanderorigin: {
              type: String,
              enum: [
                "No",
                "Yes, Aboriginal",
                "Yes, Torres Strait Islander",
                "Yes, Both",
              ],
            },
            // lgbtq: {
            //   type: String,
            //   enum: [
            //     "Lesbian",
            //     "Gay",
            //     "Bisexual",
            //     "Transgender",
            //     "Queer",
            //     "Intersex",
            //     "Asexual",
            //   ],
            // },
            countryofbirth: String,
            countryofcitizenship: [String], // Array for multi-select
            languagesspeak: [String], // Array for multi-select
            residencystatus: {
              type: String,
              enum: ["Australian Citizen", "Permanent Resident", "Visa Holder"],
            },
            typeofvisa: {
              type: String,
              enum: ["Work Visa", "Student Visa", "Working Holiday Visa"],
            },
            visasubcategory: String,
            visastartdate: Date,
            visaenddate: Date,
            // nameofinstitutionstudying: String,
            // coursestartdate: Date,
            // courseenddate: Date,
            emergencycontact: {
              "emergency-contact-name": String,
              "emergency-contact-relationship": String,
              "emergency-contact-mobile": String,
            },
          },

          // === address (same as EmployeeProfile.address) ===
          address: [
            {
              addressFor: String,
              buildingpropertyname: String,
              flatunitnumber: String,
              streetnumber: String,
              streetname: String,
              suburbcity: String,
              stateterritiory: String,
              country: String,
              zippostalcode: String,
            },
          ],

          // === documents (now using FileRefSchema like EmployeeProfile) ===
          documents: {
            identificationdocuments: {
              driverslicence: createFileRefSchema(),
              passport: createFileRefSchema(),
              birthcertificate: createFileRefSchema(),
              australiancitizenshipcertificate: createFileRefSchema(),
              medicarecard: createFileRefSchema(),
              proofofagecard: createFileRefSchema(),
            },
            certificates: {
              cpr: createFileRefSchema(),
              firstaid: createFileRefSchema(),
              manualhandling: createFileRefSchema(),
              medicationcompletency: createFileRefSchema(),
            },
            checksandclearance: {
              policeclearancecertificate: createFileRefSchema(),
              ndisscreensingcheck: createFileRefSchema(),
              covid19vaccinationcertificate: createFileRefSchema(),
            },
          },

          // === additionalFields (employee-visible/editable) ===
          additionalFields: {
            type: [EmployeeAdditionalFieldSchema],
            default: [],
          },
        },
        { _id: false }
      ),
      default: {},
    },

    /**
     * Employer-only extra fields (not shown to employees).
     * Same “additionalFields” shape but private.
     */
    employeerOnlyAdditionalFields: {
      type: [
        new Schema(
          {
            sectionKey: { type: String },
            innerSectionKey: { type: String },
            fieldKey: { type: String, required: true },
            value: Schema.Types.Mixed, // can also contain {fileId,key} objects
          },
          { _id: false }
        ),
      ],
      default: [],
    },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// 🔹 Indexes for fast lookup
// Index for finding employees by organization (tenant/branch)
employeeSchema.index({ tenantId: 1, branchId: 1, isDeleted: 1 });
// Index for finding employee by profile in specific organization (used in permission checks)
employeeSchema.index({
  employeeProfile: 1,
  tenantId: 1,
  branchId: 1,
  isDeleted: 1,
});
// Index for designation lookups
employeeSchema.index({ designation: 1, tenantId: 1, branchId: 1 });

// Add instance methods for document management
employeeSchema.methods.updateDocumentStatus = function (
  sectionKey: string,
  innerSectionKey: string | null,
  fieldKey: string,
  status: "pendingToApprove" | "approved" | "rejected" | "expired",
  reviewedBy?: string,
  rejectionReason?: string
) {
  const path = innerSectionKey
    ? `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
    : `employeeFields.${sectionKey}.${fieldKey}`;

  const updateData: any = {
    [`${path}.status`]: status,
    [`${path}.reviewedAt`]: new Date(),
  };

  if (reviewedBy) {
    updateData[`${path}.reviewedBy`] = reviewedBy;
  }

  if (rejectionReason) {
    updateData[`${path}.rejectionReason`] = rejectionReason;
  }

  return this.updateOne({}, { $set: updateData });
};

employeeSchema.methods.markDocumentAsPending = function (
  sectionKey: string,
  innerSectionKey: string | null,
  fieldKey: string,
  uploadedBy: string,
  changeReason:
    "newUpload" | "fileUpdate" | "expiryChange" | "issuingDateChange",
  metadata?: any
) {
  const path = innerSectionKey
    ? `employeeFields.${sectionKey}.${innerSectionKey}.${fieldKey}`
    : `employeeFields.${sectionKey}.${fieldKey}`;

  const updateData: any = {
    [`${path}.status`]: "pendingToApprove",
    [`${path}.uploadedBy`]: uploadedBy,
    [`${path}.metadata.changeReason`]: changeReason,
    [`${path}.metadata.uploadDate`]: new Date(),
  };

  if (metadata) {
    Object.keys(metadata).forEach((key) => {
      updateData[`${path}.metadata.${key}`] = metadata[key];
    });
  }

  return this.updateOne({}, { $set: updateData });
};

const EmployeeModel = mongoose.model("Employee", employeeSchema);
export default EmployeeModel;
