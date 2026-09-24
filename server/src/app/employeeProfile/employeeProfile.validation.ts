import { z } from "zod";

// Sectional input schemas
const personalDetailsSchema = z.object({
  firstname: z.string().min(1).optional(),
  middlename: z.string().optional(),
  lastname: z.string().min(1).optional(),
  preferredname: z.string().optional(),
  dob: z.coerce.date().optional(),
  gender: z
    .enum(["Male", "Female", "Intersex", "Don't want to Specify"])
    .optional(),
  pronouns: z.enum(["He/Him", "She/Her", "They/Them"]).optional(),
  aboriginalortorresstraitislanderorigin: z
    .enum(["Yes, Aboriginal", "Yes, Torres Strait Islander", "Yes, Both", "No"])
    .optional(),
  // lgbtq: z
  //   .enum([
  //     "Lesbian",
  //     "Gay",
  //     "Bisexual",
  //     "Transgender",
  //     "Queer",
  //     "Intersex",
  //     "Asexual",
  //   ])
  //   .optional(),
  residencystatus: z
    .enum(["Australian Citizen", "Permanent Resident", "Visa Holder"])
    .optional(),
  typeofvisa: z
    .enum(["Work Visa", "Student Visa", "Working Holiday Visa"])
    .optional(),
  visasubcategory: z.string().optional(),
  visastartdate: z.coerce.date().optional(),
  visaenddate: z.coerce.date().optional(),
  // nameofinstitutionstudying: z.string().optional(),
  // coursestartdate: z.coerce.date().optional(),
  // courseenddate: z.coerce.date().optional(),
  employeephoto: z.string().optional(),
  emergencycontact: z
    .object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      mobile: z.string().optional(),
    })
    .optional(),
});

const mainSchema = z.object({
  reportingto: z.string().optional(),
  employmenttype: z.string().optional(),
  location: z.string().optional(),
  state: z.string().optional(),
  mobile: z.string().optional(),
});

const addressSchema = z.array(
  z.object({
    addressFor: z.string().optional(),
    buildingpropertyname: z.string().optional(),
    flatunitnumber: z.string().optional(),
    streetnumber: z.string().optional(),
    streetname: z.string().optional(),
    suburbcity: z.string().optional(),
    stateterritiory: z.string().optional(),
    country: z.string().optional(),
    zippostalcode: z.string().optional(),
  })
);

const employeeDetailsSchema = z.object({
  worktype: z.string().optional(),
  employmentstatus: z
    .enum([
      "Reference Check Started",
      "Reference Check Satisfactory",
      "Reference Check Unsatisfactory",
      "Offer Letter Issued",
      "Offer Accepted",
      "Offer Rejected",
      "Onboard",
      "No Show",
      "Resigned",
      "Terminated",
    ])
    .optional(),
  employmentstartdate: z.coerce.date().optional(),
  employeetype: z
    .enum([
      "Permanent Full Time",
      "Permanent Part Time",
      "Fixed Term Contract",
      "Casual",
      "Labour Hire",
    ])
    .optional(),
  parttimeterm: z.string().optional(),
  fixedterm: z.string().optional(),
  // administrativereporting: z.string().optional(),
  // functionalreporting: z.string().optional(),
});

const payrollDetailsSchema = z.object({
  // award: z.string().optional(),
  // awardlevel: z.string().optional(),
  fulltimeparttimebaserate: z.string().optional(),
  paymentintervalweeklyfortnightlymonthly: z
    .enum(["Weekly", "Fortnightly", "Monthly"])
    .optional(),
  taxfilenumber: z.string().optional(),
  claimtaxfreethresholdyesno: z.enum(["yes", "no"]).optional(),
  anyloan: z.enum(["yes", "no"]).optional(),
  bankaccountdetails: z
    .object({
      bankname: z.string().optional(),
      bsb: z.string().optional(),
      accountnumber: z.string().optional(),
    })
    .optional(),
});

const documentsSchema = z.object({
  identificationdocuments: z
    .object({
      driverslicence: z.string().optional(),
      passport: z.string().optional(),
      birthcertificate: z.string().optional(),
      australiancitizenshipcertificate: z.string().optional(),
      medicarecard: z.string().optional(),
      proofofagecard: z.string().optional(),
    })
    .optional(),
  certificates: z
    .object({
      cpr: z.string().optional(),
      firstaid: z.string().optional(),
      manualhandling: z.string().optional(),
      medicationcompletency: z.string().optional(),
    })
    .optional(),
  checksandclearance: z
    .object({
      policeclearancecertificate: z.string().optional(),
      ndisscreensingcheck: z.string().optional(),
      covid19vaccinationcertificate: z.string().optional(),
    })
    .optional(),
});

// Full profile schema
const profileSchema = z.object({
  main: mainSchema.optional(),
  personaldetails: personalDetailsSchema.optional(),
  address: addressSchema.optional(),
  // employeedetails: employeeDetailsSchema.optional(),
  payrolldetails: payrollDetailsSchema.optional(),
  documents: documentsSchema.optional(),
});

// Additional field value structure
const additionalFieldEntry = z.object({
  sectionKey: z.string(),
  innerSectionKey: z.string().nullable().optional(),
  fieldKey: z.string(),
  value: z.any(),
});

// Create employee input schema
export const createEmployeeSchema = z.object({
  firstname: z.string().min(1),
  lastname: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  designationId: z.string(),
  profile: profileSchema.optional(),
  additionalFields: z.record(z.string(), additionalFieldEntry).optional(),
});

// Update only profile (no user fields)
export const updateEmployeeProfileSchema = profileSchema;

// New----------------

const FileValueSchema = z.object({
  url: z.string().optional(),
  expiryDate: z.coerce.date().optional(),
  issuingDate: z.coerce.date().optional(),
});

export const employeeProfileSchema = z.object({
  main: z
    .object({
      reportingto: z.string().optional(),
      employmenttype: z.string().optional(),
      location: z.string().optional(),
      state: z.string().optional(),
      mobile: z.string().optional(),
    })
    .optional(),

  personaldetails: z
    .object({
      employeephoto: z.object({ url: z.string() }).optional(),
      firstname: z.string().optional(),
      middlename: z.string().optional(),
      lastname: z.string().optional(),
      preferredname: z.string().optional(),
      location: z.string().optional(),
      state: z.string().optional(),
      mobile: z.string().optional(),
      dob: z.coerce.date().optional(),
      gender: z
        .enum(["Male", "Female", "Intersex", "Don't want to Specify"])
        .optional(),
      // lgbtq: z
      //   .enum([
      //     "Lesbian",
      //     "Gay",
      //     "Bisexual",
      //     "Transgender",
      //     "Queer",
      //     "Intersex",
      //     "Asexual",
      //   ])
      //   .optional(),
      residencystatus: z
        .enum(["Australian Citizen", "Permanent Resident", "Visa Holder"])
        .optional(),
      typeofvisa: z
        .enum(["Work Visa", "Student Visa", "Working Holiday Visa"])
        .optional(),
      visasubcategory: z.string().optional(),
      visastartdate: z.coerce.date().optional(),
      visaenddate: z.coerce.date().optional(),
      // nameofinstitutionstudying: z.string().optional(),
      // coursestartdate: z.coerce.date().optional(),
      // courseenddate: z.coerce.date().optional(),
      emergencycontact: z
        .object({
          "emergency-contact-name": z.string().optional(),
          "emergency-contact-relationship": z.string().optional(),
          "emergency-contact-mobile": z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  address: z
    .array(
      z.object({
        addressFor: z.string().optional(),
        buildingpropertyname: z.string().optional(),
        flatunitnumber: z.string().optional(),
        streetnumber: z.string().optional(),
        streetname: z.string().optional(),
        suburbcity: z.string().optional(),
        stateterritiory: z.string().optional(),
        country: z.string().optional(),
        zippostalcode: z.string().optional(),
      })
    )
    .optional(),

  payrolldetails: z
    .object({
      // award: z.string().optional(),
      // awardlevel: z.string().optional(),
      fulltimeparttimebaserate: z.string().optional(),
      paymentintervalweeklyfortnightlymonthly: z
        .enum(["Weekly", "Fortnightly", "Monthly"])
        .optional(),
      taxfilenumber: z.string().optional(),
      claimtaxfreethresholdyesno: z.enum(["yes", "no"]).optional(),
      anyloan: z.enum(["yes", "no"]).optional(),
      bankaccountdetails: z
        .object({
          bankname: z.string().optional(),
          bsb: z.string().optional(),
          accountnumber: z.string().optional(),
        })
        .optional(),
    })
    .optional(),

  documents: z.object({
    identificationdocuments: z.object({
      driverslicence: FileValueSchema.optional(),
      passport: FileValueSchema.optional(),
      birthcertificate: FileValueSchema.optional(),
      australiancitizenshipcertificate: FileValueSchema.optional(),
      medicarecard: FileValueSchema.optional(),
      proofofagecard: FileValueSchema.optional(),
    }),
    certificates: z.object({
      cpr: FileValueSchema.optional(),
      firstaid: FileValueSchema.optional(),
      manualhandling: FileValueSchema.optional(),
      medicationcompletency: FileValueSchema.optional(),
    }),
    checksandclearance: z.object({
      policeclearancecertificate: FileValueSchema.optional(),
      ndisscreensingcheck: FileValueSchema.optional(),
      covid19vaccinationcertificate: FileValueSchema.optional(),
    }),
  }),
});
