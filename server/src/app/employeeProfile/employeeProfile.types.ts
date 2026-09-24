import { Types } from "mongoose";

export interface MainSection {
  reportingto?: Types.ObjectId;
  employmenttype?: string;
  location?: string;
  state?: string;
  mobile?: string;
}

export interface PersonalDetailsSection {
  employeephoto?: string;
  firstname?: string;
  middlename?: string;
  lastname?: string;
  preferredname?: string;
  dob?: Date;
  gender?: "Male" | "Female" | "Intersex" | "Don't want to Specify";
  pronouns?: "He/Him" | "She/Her" | "They/Them";
  aboriginalortorresstraitislanderorigin?:
    "No" | "Yes, Aboriginal" | "Yes, Torres Strait Islander" | "Yes, Both";

  // lgbtq?:
  //   | "Lesbian"
  //   | "Gay"
  //   | "Bisexual"
  //   | "Transgender"
  //   | "Queer"
  //   | "Intersex"
  //   | "Asexual";
  countryofbirth?: string;
  countryofcitizenship?: string[]; // Array for multi-select
  languagesspeak?: string[]; // Array for multi-select
  residencystatus?: "Australian Citizen" | "Permanent Resident" | "Visa Holder";
  typeofvisa?: "Work Visa" | "Student Visa" | "Working Holiday Visa";
  visasubcategory?: string;
  visastartdate?: Date;
  visaenddate?: Date;
  // nameofinstitutionstudying?: string;
  // coursestartdate?: Date;
  // courseenddate?: Date;
  emergencycontact?: {
    name?: string;
    relationship?: string;
    mobile?: string;
  };
}

export interface AddressSection {
  addressFor?: string;
  buildingpropertyname?: string;
  flatunitnumber?: string;
  streetnumber?: string;
  streetname?: string;
  suburbcity?: string;
  stateterritiory?: string;
  country?: string;
  zippostalcode?: string;
}

export interface EmployeeDetailsSection {
  worktype?: string;
  employmentstatus?:
    | "Reference Check Started"
    | "Reference Check Satisfactory"
    | "Reference Check Unsatisfactory"
    | "Offer Letter Issued"
    | "Offer Accepted"
    | "Offer Rejected"
    | "Onboard"
    | "No Show"
    | "Resigned"
    | "Terminated";
  employmentstartdate?: Date;
  employeetype?:
    | "Permanent Full Time"
    | "Permanent Part Time"
    | "Fixed Term Contract"
    | "Casual"
    | "Labour Hire";
  parttimeterm?: string;
  fixedterm?: string;
  // administrativereporting?: string;
  // functionalreporting?: string;
}

export interface PayrollDetailsSection {
  // award?: string;
  // awardlevel?: string;
  fulltimeparttimebaserate?: string;
  paymentintervalweeklyfortnightlymonthly?:
    "Weekly" | "Fortnightly" | "Monthly";
  taxfilenumber?: string;
  claimtaxfreethresholdyesno?: "yes" | "no";
  anyloan?: "yes" | "no";
  bankaccountdetails?: {
    bankname?: string;
    bsb?: string;
    accountnumber?: string;
  };
}

export interface DocumentsSection {
  identificationdocuments?: {
    driverslicence?: string;
    passport?: string;
    birthcertificate?: string;
    australiancitizenshipcertificate?: string;
    medicarecard?: string;
    proofofagecard?: string;
  };
  certificates?: {
    cpr?: string;
    firstaid?: string;
    manualhandling?: string;
    medicationcompletency?: string;
  };
  checksandclearance?: {
    policeclearancecertificate?: string;
    ndisscreensingcheck?: string;
    covid19vaccinationcertificate?: string;
  };
}

// Used in EmployeeProfile schema and updates
export interface EmployeeProfileInput {
  main?: MainSection;
  personaldetails?: PersonalDetailsSection;
  address?: AddressSection[];
  employeedetails?: EmployeeDetailsSection;
  payrolldetails?: PayrollDetailsSection;
  documents?: DocumentsSection;
}

// Used in employeeProfile.service.ts for creation
export interface CreateEmployeeInput {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  designationId: Types.ObjectId;

  profile?: Partial<EmployeeProfileInput>;
  additionalFields?: Record<
    string,
    {
      sectionKey: string;
      innerSectionKey?: string | null;
      fieldKey: string;
      value: any;
    }
  >;
}
