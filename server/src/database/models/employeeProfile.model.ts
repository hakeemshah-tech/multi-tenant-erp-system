// import mongoose, { Schema, Document } from "mongoose";

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

// export interface IEmployeeProfile extends Document {
//   userId: {
//     type: Schema.Types.ObjectId;
//     ref: "User";
//     required: true;
//   };

//   main?: {
//     reportingto?: mongoose.Types.ObjectId;
//     employmenttype?: string;
//     location?: string;
//     state?: string;
//     mobile?: string;
//   };

//   personaldetails?: {
//     employeephoto?: string;
//     firstname?: string;
//     middlename?: string;
//     lastname?: string;
//     preferredname?: string;
//     location?: string;
//     state?: string;
//     mobile?: string;
//     // age?: number;
//     dob?: Date;
//     gender?: "male" | "female";
//     lgbtq?:
//       | "Lesbian"
//       | "Gay"
//       | "Bisexual"
//       | "Transgender"
//       | "Queer"
//       | "Intersex"
//       | "Asexual";
//     residencystatus?:
//       | "Australian Citizen"
//       | "Permanent Resident"
//       | "Visa Holder";
//     typeofvisa?: "Work Visa" | "Student Visa" | "Working Holiday Visa";
//     visasubcategory?: string;
//     visastartdate?: Date;
//     visaenddate?: Date;
//     nameofinstitutionstudying?: string;
//     coursestartdate?: Date;
//     courseenddate?: Date;
//     emergencycontact?: {
//       "emergency-contact-name"?: string;
//       "emergency-contact-relationship"?: string;
//       "emergency-contact-mobile"?: string;
//     };
//   };

//   address?: Array<{
//     addressFor?: string;
//     buildingpropertyname?: string;
//     flatunitnumber?: string;
//     streetnumber?: string;
//     streetname?: string;
//     suburbcity?: string;
//     stateterritiory?: string;
//     country?: string;
//     zippostalcode?: string;
//   }>;

//   payrolldetails?: {
//     award?: string;
//     awardlevel?: string;
//     fulltimeparttimebaserate?: string;
//     paymentintervalweeklyfortnightlymonthly?:
//       | "Weekly"
//       | "Fortnightly"
//       | "Monthly";
//     taxfilenumber?: string;
//     claimtaxfreethresholdyesno?: "yes" | "no";
//     anyloan?: "yes" | "no";
//     bankaccountdetails?: {
//       bankname?: string;
//       bsb?: string;
//       accountnumber?: string;
//     };
//   };

//   documents: {
//     identificationdocuments: {
//       driverslicence: any;
//       passport: any;
//       birthcertificate: any;
//       australiancitizenshipcertificate: any;
//       medicarecard: any;
//       proofofagecard: any;
//     };
//     certificates: {
//       cpr: any;
//       firstaid: any;
//       manualhandling: any;
//       medicationcompletency: any;
//     };
//     checksandclearance: {
//       policeclearancecertificate: any;
//       ndisscreensingcheck: any;
//       covid19vaccinationcertificate: any;
//     };
//   };
// }

// const employeeProfileSchema = new Schema<IEmployeeProfile>(
//   {
//     userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

//     main: {
//       reportingto: { type: Schema.Types.ObjectId, ref: "Employee" },
//       employmenttype: String,
//       location: String,
//       state: String,
//       mobile: String,
//     },

//     personaldetails: {
//       employeephoto: { url: String },
//       firstname: String,
//       middlename: String,
//       lastname: String,
//       preferredname: String,
//       location: String,
//       state: String,
//       mobile: String,
//       // age: Number,
//       dob: Date,
//       gender: { type: String, enum: ["male", "female"] },
//       lgbtq: {
//         type: String,
//         enum: [
//           "Lesbian",
//           "Gay",
//           "Bisexual",
//           "Transgender",
//           "Queer",
//           "Intersex",
//           "Asexual",
//         ],
//       },
//       residencystatus: {
//         type: String,
//         enum: ["Australian Citizen", "Permanent Resident", "Visa Holder"],
//       },
//       typeofvisa: {
//         type: String,
//         enum: ["Work Visa", "Student Visa", "Working Holiday Visa"],
//       },
//       visasubcategory: String,
//       visastartdate: Date,
//       visaenddate: Date,
//       nameofinstitutionstudying: String,
//       coursestartdate: Date,
//       courseenddate: Date,
//       emergencycontact: {
//         "emergency-contact-name": String,
//         "emergency-contact-relationship": String,
//         "emergency-contact-mobile": String,
//       },
//     },

//     address: [
//       {
//         addressFor: String,
//         buildingpropertyname: String,
//         flatunitnumber: String,
//         streetnumber: String,
//         streetname: String,
//         suburbcity: String,
//         stateterritiory: String,
//         country: String,
//         zippostalcode: String,
//       },
//     ],

//     payrolldetails: {
//       award: String,
//       awardlevel: String,
//       fulltimeparttimebaserate: String,
//       paymentintervalweeklyfortnightlymonthly: {
//         type: String,
//         enum: ["Weekly", "Fortnightly", "Monthly"],
//       },
//       taxfilenumber: String,
//       claimtaxfreethresholdyesno: { type: String, enum: ["yes", "no"] },
//       anyloan: { type: String, enum: ["yes", "no"] },
//       bankaccountdetails: {
//         bankname: String,
//         bsb: String,
//         accountnumber: String,
//       },
//     },

//     documents: {
//       identificationdocuments: {
//         driverslicence: FileValueSchema,
//         passport: FileValueSchema,
//         birthcertificate: FileValueSchema,
//         australiancitizenshipcertificate: FileValueSchema,
//         medicarecard: FileValueSchema,
//         proofofagecard: FileValueSchema,
//       },
//       certificates: {
//         cpr: FileValueSchema,
//         firstaid: FileValueSchema,
//         manualhandling: FileValueSchema,
//         medicationcompletency: FileValueSchema,
//       },
//       checksandclearance: {
//         policeclearancecertificate: FileValueSchema,
//         ndisscreensingcheck: FileValueSchema,
//         covid19vaccinationcertificate: FileValueSchema,
//       },
//     },
//   },
//   { timestamps: true }
// );

// export const EmployeeProfile = mongoose.model<IEmployeeProfile>(
//   "EmployeeProfile",
//   employeeProfileSchema
// );

// employeedetails?: {
//   employmentstatus?:
//     | "Recruiting"
//     | "Under Porbation"
//     | "Confirmed"
//     | "Resigned";
//   employmentstartdate?: Date;
//   employeetype?:
//     | "Full Time"
//     | "Part Time"
//     | "Fixed Term Contract"
//     | "Casual"
//     | "Contractor";
//   parttimeterm?: string;
//   fixedterm?: string;
//   // administrativereporting?: string;
//   // functionalreporting?: string;
// };

// employeedetails: {
//   employmentstatus: {
//     type: String,
//     enum: ["Recruiting", "Under Porbation", "Confirmed", "Resigned"],
//   },
//   employmentstartdate: Date,
//   employeetype: {
//     type: String,
//     enum: [
//       "Full Time",
//       "Part Time",
//       "Fixed Term Contract",
//       "Casual",
//       "Contractor",
//     ],
//   },
//   parttimeterm: String,
//   fixedterm: String,
//   // administrativereporting: String,
//   // functionalreporting: String,
// },

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

import mongoose, { Schema, Document } from "mongoose";

const FileRefSchema = new Schema(
  {
    // 🚫 DEPRECATED: do not use url anymore (keep only for migration if you want)
    // url: { type: String },

    fileId: { type: Schema.Types.ObjectId, ref: "File", required: true },
    key: { type: String, required: true }, // denormalized S3 key for convenience

    // your existing domain fields
    expiryDate: Date,
    issuingDate: Date,
    referenceNumber: String, // Reference number for documents that require it
    countryOfIssue: String, // Country of issue (for passport documents only)
  },
  { _id: false }
);

/** Additional Field (employee-editable, config: isAdditional=true & employeerOnlyEditable=false) */
const EmployeeAdditionalFieldSchema = new Schema(
  {
    sectionKey: { type: String }, // e.g. "documents"
    innerSectionKey: { type: String }, // e.g. "certificates" (optional)
    fieldKey: { type: String, required: true }, // e.g. "cpr" or "customField123"
    value: Schema.Types.Mixed, // string | number | date | object | array
    isShowInProfile: { type: Boolean, default: false },
  },
  { _id: false }
);

export interface IEmployeeProfile extends Document {
  userId: {
    type: Schema.Types.ObjectId;
    ref: "User";
    required: true;
  };

  main?: {
    reportingto?: mongoose.Types.ObjectId;
    employmenttype?: string;
    location?: string;
    state?: string;
    mobile?: string;
  };

  personaldetails?: {
    employeephoto?: string;
    firstname?: string;
    middlename?: string;
    lastname?: string;
    preferredname?: string;
    location?: string;
    state?: string;
    mobile?: string;
    dob?: Date;
    gender?: "Male" | "Female" | "Intersex" | "Don't want to Specify";
    aboriginalortorresstraitislanderorigin?:
      "Yes, Aboriginal" | "Yes, Torres Strait Islander" | "Yes, Both" | "No";
    pronouns?: "He/Him" | "She/Her" | "They/Them";
    // lgbtq?:
    //   | "Lesbian"
    //   | "Gay"
    //   | "Bisexual"
    //   | "Transgender"
    //   | "Queer"
    //   | "Intersex"
    //   | "Asexual";
    residencystatus?:
      "Australian Citizen" | "Permanent Resident" | "Visa Holder";
    typeofvisa?: "Work Visa" | "Student Visa" | "Working Holiday Visa";
    visasubcategory?: string;
    visastartdate?: Date;
    visaenddate?: Date;
    // nameofinstitutionstudying?: string;
    // coursestartdate?: Date;
    // courseenddate?: Date;
    emergencycontact?: {
      "emergency-contact-name"?: string;
      "emergency-contact-relationship"?: string;
      "emergency-contact-mobile"?: string;
    };
  };

  address?: Array<{
    addressFor?: string;
    buildingpropertyname?: string;
    flatunitnumber?: string;
    streetnumber?: string;
    streetname?: string;
    suburbcity?: string;
    stateterritiory?: string;
    country?: string;
    zippostalcode?: string;
  }>;

  /** NOTE: payrolldetails removed per new design */

  documents: {
    identificationdocuments: {
      driverslicence: any;
      passport: any;
      birthcertificate: any;
      australiancitizenshipcertificate: any;
      medicarecard: any;
      proofofagecard: any;
    };
    certificates: {
      cpr: any;
      firstaid: any;
      manualhandling: any;
      medicationcompletency: any;
    };
    checksandclearance: {
      policeclearancecertificate: any;
      ndisscreensingcheck: any;
      covid19vaccinationcertificate: any;
    };
  };

  /**
   * Dynamic fields captured from employeeFieldConfig
   * Only for config where isAdditional=true AND employeerOnlyEditable=false
   */
  additionalFields?: Array<{
    sectionKey?: string;
    innerSectionKey?: string;
    fieldKey: string;
    value: any;
    isShowInProfile?: boolean;
  }>;
}

const employeeProfileSchema = new Schema<IEmployeeProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },

    main: {
      reportingto: { type: Schema.Types.ObjectId, ref: "Employee" },
      employmenttype: String,
      location: String,
      state: String,
      mobile: String,
    },

    personaldetails: {
      employeephoto: FileRefSchema,
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

    // payrolldetails removed

    documents: {
      identificationdocuments: {
        driverslicence: FileRefSchema,
        passport: FileRefSchema,
        birthcertificate: FileRefSchema,
        australiancitizenshipcertificate: FileRefSchema,
        medicarecard: FileRefSchema,
        proofofagecard: FileRefSchema,
      },
      certificates: {
        cpr: FileRefSchema,
        firstaid: FileRefSchema,
        manualhandling: FileRefSchema,
        medicationcompletency: FileRefSchema,
      },
      checksandclearance: {
        policeclearancecertificate: FileRefSchema,
        ndisscreensingcheck: FileRefSchema,
        covid19vaccinationcertificate: FileRefSchema,
      },
    },

    /** Holds dynamic values that are employee-visible/editable */
    additionalFields: {
      type: [EmployeeAdditionalFieldSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export const EmployeeProfile = mongoose.model<IEmployeeProfile>(
  "EmployeeProfile",
  employeeProfileSchema
);
