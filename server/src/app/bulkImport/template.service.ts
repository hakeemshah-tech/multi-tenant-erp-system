import ExcelJS from "exceljs";
import { Types } from "mongoose";
import * as employeeFieldConfigService from "../employeeFieldConfig/employeeFieldConfig.service";
import { Designation } from "@/database/models/designation.model";

/**
 * Generate Excel template for bulk employee import
 */
export async function generateEmployeeImportTemplate(
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Instructions sheet
  const instructionsSheet = workbook.addWorksheet("Instructions");
  instructionsSheet.columns = [{ width: 100 }];
  instructionsSheet.addRow(["BULK EMPLOYEE IMPORT TEMPLATE"]);
  instructionsSheet.addRow([]);
  instructionsSheet.addRow(["INSTRUCTIONS:"]);
  instructionsSheet.addRow([
    "1. Fill in the 'Employee Data' sheet with employee information",
  ]);
  instructionsSheet.addRow([
    "2. Required fields: Email, First Name, Last Name, Designation",
  ]);
  instructionsSheet.addRow([
    "3. If Password is not provided, a random password will be generated",
  ]);
  instructionsSheet.addRow([
    "4. Date fields should be in format: YYYY-MM-DD or MM/DD/YYYY",
  ]);
  instructionsSheet.addRow([
    "5. Designation must match an existing designation in your organization",
  ]);
  instructionsSheet.addRow([]);
  instructionsSheet.addRow(["FIELD DESCRIPTIONS:"]);
  instructionsSheet.addRow([
    "Email: Employee email address (required, must be unique)",
  ]);
  instructionsSheet.addRow(["First Name: Employee first name (required)"]);
  instructionsSheet.addRow(["Last Name: Employee last name (required)"]);
  instructionsSheet.addRow([
    "Designation: Job title/position (required, must exist in system)",
  ]);
  instructionsSheet.addRow([
    "Password: Login password (optional, auto-generated if not provided)",
  ]);
  instructionsSheet.addRow(["Mobile: Contact mobile number"]);
  instructionsSheet.addRow([
    "Date of Birth: Employee date of birth (YYYY-MM-DD)",
  ]);
  instructionsSheet.addRow([
    "Gender: Male, Female, Intersex, or Don't want to Specify",
  ]);
  instructionsSheet.addRow([
    "Employment Type: Permanent Full Time, Permanent Part Time, Fixed Term Contract, Casual, or Labour Hire",
  ]);
  instructionsSheet.addRow([
    "Employment Status: Reference Check Started, Reference Check Satisfactory, Onboard, etc.",
  ]);

  // Employee Data sheet
  const dataSheet = workbook.addWorksheet("Employee Data");

  // Get designations for dropdown
  const designations = await Designation.find({
    tenantId,
    branchId,
    isDeleted: false,
  }).select("name");

  const designationNames = designations.map((d) => d.name);

  // Define headers
  const headers = [
    "Email",
    "Password",
    "First Name",
    "Middle Name",
    "Last Name",
    "Preferred Name",
    "Mobile",
    "Date of Birth",
    "Gender",
    "Pronouns",
    "Residence Status",
    "Type of Visa",
    "Visa Subcategory",
    "Visa Start Date",
    "Visa End Date",
    "Designation",
    "Location",
    "State",
    "Employment Type",
    "Employment Status",
    "Employment Start Date",
    "Part Time Term",
    "Fixed Term",
    "Full Time/Part Time Base Rate",
    "Payment Interval",
    "Tax File Number",
    "Claim Tax Free Threshold",
    "Any Loan",
    "Bank Name",
    "BSB",
    "Account Number",
    "Address For",
    "Building/Property Name",
    "Flat/Unit Number",
    "Street Number",
    "Street Name",
    "Suburb/City",
    "State/Territory",
    "Country",
    "Zip/Postal Code",
  ];

  // Add headers
  dataSheet.addRow(headers);

  // Style header row
  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Add data validation for Designation column (column P = 16)
  if (designationNames.length > 0) {
    dataSheet.getColumn(16).eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        // Skip header row
        cell.dataValidation = {
          type: "list",
          allowBlank: false,
          formulae: [`"${designationNames.join(",")}"`],
        };
      }
    });
  }

  // Add data validation for Gender (column I = 9)
  dataSheet.getColumn(9).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Male,Female,Intersex,Don\'t want to Specify"'],
      };
    }
  });

  // Add data validation for Employment Type (column S = 19)
  dataSheet.getColumn(19).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [
          '"Permanent Full Time,Permanent Part Time,Fixed Term Contract,Casual,Labour Hire"',
        ],
      };
    }
  });

  // Add data validation for Payment Interval (column Y = 25)
  dataSheet.getColumn(25).eachCell((cell, rowNumber) => {
    if (rowNumber > 1) {
      cell.dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Weekly,Fortnightly,Monthly"'],
      };
    }
  });

  // Set column widths
  dataSheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

/**
 * Generate Excel file with 500 dummy employee records for testing
 */
export async function generateDummyDataExcel(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const dataSheet = workbook.addWorksheet("Employee Data");

  // Define headers
  const headers = [
    "Email",
    "Password",
    "First Name",
    "Middle Name",
    "Last Name",
    "Preferred Name",
    "Mobile",
    "Date of Birth",
    "Gender",
    "Pronouns",
    "Residence Status",
    "Type of Visa",
    "Visa Subcategory",
    "Visa Start Date",
    "Visa End Date",
    "Designation",
    "Location",
    "State",
    "Employment Type",
    "Employment Status",
    "Employment Start Date",
    "Part Time Term",
    "Fixed Term",
    "Full Time/Part Time Base Rate",
    "Payment Interval",
    "Tax File Number",
    "Claim Tax Free Threshold",
    "Any Loan",
    "Bank Name",
    "BSB",
    "Account Number",
    "Address For",
    "Building/Property Name",
    "Flat/Unit Number",
    "Street Number",
    "Street Name",
    "Suburb/City",
    "State/Territory",
    "Country",
    "Zip/Postal Code",
  ];

  // Add headers
  dataSheet.addRow(headers);

  // Style header row
  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Dummy data arrays for variety
  const firstNames = [
    "James",
    "Mary",
    "John",
    "Patricia",
    "Robert",
    "Jennifer",
    "Michael",
    "Linda",
    "William",
    "Elizabeth",
    "David",
    "Barbara",
    "Richard",
    "Susan",
    "Joseph",
    "Jessica",
    "Thomas",
    "Sarah",
    "Charles",
    "Karen",
    "Christopher",
    "Nancy",
    "Daniel",
    "Lisa",
    "Matthew",
    "Betty",
    "Anthony",
    "Margaret",
    "Mark",
    "Sandra",
    "Donald",
    "Ashley",
    "Steven",
    "Kimberly",
    "Paul",
    "Emily",
    "Andrew",
    "Donna",
    "Joshua",
    "Michelle",
    "Kenneth",
    "Carol",
    "Kevin",
    "Amanda",
    "Brian",
    "Dorothy",
    "George",
    "Melissa",
    "Timothy",
    "Deborah",
    "Ronald",
    "Stephanie",
    "Jason",
    "Rebecca",
    "Edward",
    "Sharon",
    "Jeffrey",
    "Laura",
    "Ryan",
    "Cynthia",
    "Jacob",
    "Kathleen",
    "Gary",
    "Amy",
    "Nicholas",
    "Angela",
    "Eric",
    "Shirley",
    "Jonathan",
    "Anna",
    "Stephen",
    "Brenda",
    "Larry",
    "Pamela",
    "Justin",
    "Emma",
    "Scott",
    "Nicole",
    "Brandon",
    "Helen",
    "Benjamin",
    "Samantha",
    "Samuel",
    "Katherine",
    "Gregory",
    "Debra",
    "Alexander",
    "Rachel",
    "Patrick",
    "Carolyn",
    "Frank",
    "Janet",
    "Raymond",
    "Catherine",
    "Jack",
    "Maria",
    "Dennis",
    "Heather",
    "Jerry",
    "Diane",
    "Tyler",
    "Julie",
    "Aaron",
    "Joyce",
    "Jose",
    "Victoria",
    "Adam",
    "Kelly",
    "Nathan",
    "Christina",
    "Henry",
    "Joan",
    "Douglas",
    "Evelyn",
    "Zachary",
    "Lauren",
    "Peter",
    "Judith",
    "Kyle",
    "Megan",
    "Noah",
    "Cheryl",
    "Ethan",
    "Andrea",
    "Jeremy",
    "Hannah",
    "Walter",
    "Jacqueline",
    "Christian",
    "Martha",
    "Keith",
    "Gloria",
    "Roger",
    "Teresa",
    "Terry",
    "Sara",
    "Gerald",
    "Janice",
    "Harold",
    "Marie",
    "Sean",
    "Julia",
    "Austin",
    "Grace",
    "Carl",
    "Judy",
    "Arthur",
    "Theresa",
    "Lawrence",
    "Madison",
    "Dylan",
    "Beverly",
    "Jesse",
    "Denise",
    "Jordan",
    "Marilyn",
    "Bryan",
    "Amber",
    "Billy",
    "Danielle",
    "Joe",
    "Rose",
    "Bruce",
    "Brittany",
    "Gabriel",
    "Diana",
    "Logan",
    "Abigail",
    "Alan",
    "Jane",
    "Juan",
    "Lori",
    "Wayne",
    "Mildred",
    "Roy",
    "Emma",
    "Ralph",
    "Marie",
  ];

  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Thompson",
    "White",
    "Harris",
    "Clark",
    "Lewis",
    "Robinson",
    "Walker",
    "Young",
    "Allen",
    "King",
    "Wright",
    "Scott",
    "Torres",
    "Nguyen",
    "Hill",
    "Flores",
    "Green",
    "Adams",
    "Nelson",
    "Baker",
    "Hall",
    "Rivera",
    "Campbell",
    "Mitchell",
    "Carter",
    "Roberts",
    "Gomez",
    "Phillips",
    "Evans",
    "Turner",
    "Diaz",
    "Parker",
    "Cruz",
    "Edwards",
    "Collins",
    "Reyes",
    "Stewart",
    "Morris",
    "Morales",
    "Murphy",
    "Cook",
    "Rogers",
    "Gutierrez",
    "Ortiz",
    "Morgan",
    "Cooper",
    "Peterson",
    "Bailey",
    "Reed",
    "Kelly",
    "Howard",
    "Ramos",
    "Kim",
    "Cox",
    "Ward",
    "Richardson",
    "Watson",
    "Brooks",
    "Chavez",
    "Wood",
    "James",
    "Bennett",
    "Gray",
    "Mendoza",
    "Ruiz",
    "Hughes",
    "Price",
    "Alvarez",
    "Castillo",
    "Sanders",
    "Patel",
    "Myers",
    "Long",
    "Ross",
    "Foster",
    "Jimenez",
  ];

  const suburbs = [
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Perth",
    "Adelaide",
    "Gold Coast",
    "Newcastle",
    "Canberra",
    "Sunshine Coast",
    "Wollongong",
    "Hobart",
    "Geelong",
    "Townsville",
    "Cairns",
    "Toowoomba",
    "Darwin",
    "Ballarat",
    "Bendigo",
    "Albury",
    "Launceston",
  ];

  const streets = [
    "Main",
    "Park",
    "Oak",
    "Pine",
    "Maple",
    "Cedar",
    "Elm",
    "First",
    "Second",
    "Third",
    "Church",
    "Washington",
    "Lincoln",
    "Jackson",
    "Madison",
    "Monroe",
    "Adams",
    "Jefferson",
    "Hamilton",
    "Franklin",
    "Lake",
    "Hill",
    "River",
    "Valley",
  ];

  const genders = ["Male", "Female", "Intersex", "Don't want to Specify"];
  const pronouns = ["He/Him", "She/Her", "They/Them"];
  const residenceStatuses = [
    "Australian Citizen",
    "Permanent Resident",
    "Visa Holder",
  ];
  const visaTypes = ["Work Visa", "Student Visa", "Working Holiday Visa"];
  const employmentTypes = [
    "Permanent Full Time",
    "Permanent Part Time",
    "Fixed Term Contract",
    "Casual",
    "Labour Hire",
  ];
  const employmentStatuses = [
    "Reference Check Started",
    "Reference Check Satisfactory",
    "Onboard",
  ];
  const paymentIntervals = ["Weekly", "Fortnightly", "Monthly"];
  const banks = [
    "Commonwealth Bank",
    "ANZ",
    "Westpac",
    "NAB",
    "Bank of Queensland",
  ];
  const states = [
    "New South Wales",
    "Victoria",
    "Queensland",
    "Western Australia",
    "South Australia",
    "Tasmania",
    "Northern Territory",
    "Australian Capital Territory",
  ];

  // Generate 500 dummy records
  for (let i = 1; i <= 500; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `employee${i}.${firstName.toLowerCase()}.${lastName.toLowerCase()}@testcompany.com`;
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const suburb = suburbs[Math.floor(Math.random() * suburbs.length)];
    const state = states[Math.floor(Math.random() * states.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const employmentType =
      employmentTypes[Math.floor(Math.random() * employmentTypes.length)];
    const employmentStatus =
      employmentStatuses[Math.floor(Math.random() * employmentStatuses.length)];
    const paymentInterval =
      paymentIntervals[Math.floor(Math.random() * paymentIntervals.length)];
    const bank = banks[Math.floor(Math.random() * banks.length)];

    // Generate random dates
    const birthYear = 1970 + Math.floor(Math.random() * 35); // Age between 25-60
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;
    const dob = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(
      birthDay
    ).padStart(2, "0")}`;

    const startYear = 2020 + Math.floor(Math.random() * 4);
    const startMonth = Math.floor(Math.random() * 12) + 1;
    const startDay = Math.floor(Math.random() * 28) + 1;
    const startDate = `${startYear}-${String(startMonth).padStart(
      2,
      "0"
    )}-${String(startDay).padStart(2, "0")}`;

    // Generate phone number
    const mobile = `04${Math.floor(Math.random() * 10)}${Math.floor(
      Math.random() * 10
    )} ${Math.floor(Math.random() * 1000)} ${Math.floor(Math.random() * 1000)}`;

    // Generate TFN (9 digits)
    const tfn = Array.from({ length: 9 }, () =>
      Math.floor(Math.random() * 10)
    ).join("");

    // Generate BSB (6 digits)
    const bsb = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 10)
    ).join("");

    // Generate Account Number (8-12 digits)
    const accountNumber = Array.from(
      { length: 8 + Math.floor(Math.random() * 5) },
      () => Math.floor(Math.random() * 10)
    ).join("");

    // Generate street number
    const streetNumber = Math.floor(Math.random() * 999) + 1;

    // Generate postal code
    const postalCode = (1000 + Math.floor(Math.random() * 9000)).toString();

    // Random residence status
    const residenceStatus =
      residenceStatuses[Math.floor(Math.random() * residenceStatuses.length)];
    const hasVisa = residenceStatus === "Visa Holder";
    const visaType = hasVisa
      ? visaTypes[Math.floor(Math.random() * visaTypes.length)]
      : "";
    const visaStartDate = hasVisa ? `${startYear - 1}-01-01` : "";
    const visaEndDate = hasVisa ? `${startYear + 2}-12-31` : "";

    // Base rate (random between 50k-150k)
    const baseRate = (50000 + Math.floor(Math.random() * 100000)).toString();

    const row = [
      email, // Email
      "", // Password (empty, will be auto-generated)
      firstName, // First Name
      Math.random() > 0.7
        ? firstNames[Math.floor(Math.random() * firstNames.length)]
        : "", // Middle Name (30% chance)
      lastName, // Last Name
      Math.random() > 0.5 ? firstName : "", // Preferred Name (50% chance)
      mobile, // Mobile
      dob, // Date of Birth
      gender, // Gender
      gender === "Male"
        ? "He/Him"
        : gender === "Female"
          ? "She/Her"
          : pronouns[Math.floor(Math.random() * pronouns.length)], // Pronouns
      residenceStatus, // Residence Status
      visaType, // Type of Visa
      hasVisa ? "Subclass 482" : "", // Visa Subcategory
      visaStartDate, // Visa Start Date
      visaEndDate, // Visa End Date
      "CEO", // Designation (always CEO as requested)
      suburb, // Location
      state, // State
      employmentType, // Employment Type
      employmentStatus, // Employment Status
      startDate, // Employment Start Date
      employmentType.includes("Part Time") ? "3 days/week" : "", // Part Time Term
      employmentType.includes("Fixed Term") ? "12 months" : "", // Fixed Term
      baseRate, // Full Time/Part Time Base Rate
      paymentInterval, // Payment Interval
      tfn, // Tax File Number
      Math.random() > 0.3 ? "yes" : "no", // Claim Tax Free Threshold (70% yes)
      Math.random() > 0.8 ? "yes" : "no", // Any Loan (20% yes)
      bank, // Bank Name
      bsb, // BSB
      accountNumber, // Account Number
      "Home", // Address For
      Math.random() > 0.5 ? `Building ${Math.floor(Math.random() * 100)}` : "", // Building/Property Name
      Math.random() > 0.6 ? `${Math.floor(Math.random() * 50)}` : "", // Flat/Unit Number
      streetNumber.toString(), // Street Number
      `${street} Street`, // Street Name
      suburb, // Suburb/City
      state, // State/Territory
      "Australia", // Country
      postalCode, // Zip/Postal Code
    ];

    dataSheet.addRow(row);
  }

  // Set column widths
  dataSheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

/**
 * Generate Excel file with 1000 dummy employee records for testing
 */
export async function generateDummyDataExcel1000(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const dataSheet = workbook.addWorksheet("Employee Data");

  // Define headers (same as 500 dataset)
  const headers = [
    "Email",
    "Password",
    "First Name",
    "Middle Name",
    "Last Name",
    "Preferred Name",
    "Mobile",
    "Date of Birth",
    "Gender",
    "Pronouns",
    "Residence Status",
    "Type of Visa",
    "Visa Subcategory",
    "Visa Start Date",
    "Visa End Date",
    "Designation",
    "Location",
    "State",
    "Employment Type",
    "Employment Status",
    "Employment Start Date",
    "Part Time Term",
    "Fixed Term",
    "Full Time/Part Time Base Rate",
    "Payment Interval",
    "Tax File Number",
    "Claim Tax Free Threshold",
    "Any Loan",
    "Bank Name",
    "BSB",
    "Account Number",
    "Address For",
    "Building/Property Name",
    "Flat/Unit Number",
    "Street Number",
    "Street Name",
    "Suburb/City",
    "State/Territory",
    "Country",
    "Zip/Postal Code",
  ];

  // Add headers
  dataSheet.addRow(headers);

  // Style header row
  const headerRow = dataSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Dummy data arrays (reusing from 500 dataset)
  const firstNames = [
    "James",
    "Mary",
    "John",
    "Patricia",
    "Robert",
    "Jennifer",
    "Michael",
    "Linda",
    "William",
    "Elizabeth",
    "David",
    "Barbara",
    "Richard",
    "Susan",
    "Joseph",
    "Jessica",
    "Thomas",
    "Sarah",
    "Charles",
    "Karen",
    "Christopher",
    "Nancy",
    "Daniel",
    "Lisa",
    "Matthew",
    "Betty",
    "Anthony",
    "Margaret",
    "Mark",
    "Sandra",
    "Donald",
    "Ashley",
    "Steven",
    "Kimberly",
    "Paul",
    "Emily",
    "Andrew",
    "Donna",
    "Joshua",
    "Michelle",
    "Kenneth",
    "Carol",
    "Kevin",
    "Amanda",
    "Brian",
    "Dorothy",
    "George",
    "Melissa",
    "Timothy",
    "Deborah",
    "Ronald",
    "Stephanie",
    "Jason",
    "Rebecca",
    "Edward",
    "Sharon",
    "Jeffrey",
    "Laura",
    "Ryan",
    "Cynthia",
    "Jacob",
    "Kathleen",
    "Gary",
    "Amy",
    "Nicholas",
    "Angela",
    "Eric",
    "Shirley",
    "Jonathan",
    "Anna",
    "Stephen",
    "Brenda",
    "Larry",
    "Pamela",
    "Justin",
    "Emma",
    "Scott",
    "Nicole",
    "Brandon",
    "Helen",
    "Benjamin",
    "Samantha",
    "Samuel",
    "Katherine",
    "Gregory",
    "Debra",
    "Alexander",
    "Rachel",
    "Patrick",
    "Carolyn",
    "Frank",
    "Janet",
    "Raymond",
    "Catherine",
    "Jack",
    "Maria",
    "Dennis",
    "Heather",
    "Jerry",
    "Diane",
    "Tyler",
    "Julie",
    "Aaron",
    "Joyce",
    "Jose",
    "Victoria",
    "Adam",
    "Kelly",
    "Nathan",
    "Christina",
    "Henry",
    "Joan",
    "Douglas",
    "Evelyn",
    "Zachary",
    "Lauren",
    "Peter",
    "Judith",
    "Kyle",
    "Megan",
    "Noah",
    "Cheryl",
    "Ethan",
    "Andrea",
    "Jeremy",
    "Hannah",
    "Walter",
    "Jacqueline",
    "Christian",
    "Martha",
    "Keith",
    "Gloria",
    "Roger",
    "Teresa",
    "Terry",
    "Sara",
    "Gerald",
    "Janice",
    "Harold",
    "Marie",
    "Sean",
    "Julia",
    "Austin",
    "Grace",
    "Carl",
    "Judy",
    "Arthur",
    "Theresa",
    "Lawrence",
    "Madison",
    "Dylan",
    "Beverly",
    "Jesse",
    "Denise",
    "Jordan",
    "Marilyn",
    "Bryan",
    "Amber",
    "Billy",
    "Danielle",
    "Joe",
    "Rose",
    "Bruce",
    "Brittany",
    "Gabriel",
    "Diana",
    "Logan",
    "Abigail",
    "Alan",
    "Jane",
    "Juan",
    "Lori",
    "Wayne",
    "Mildred",
    "Roy",
    "Emma",
    "Ralph",
    "Marie",
  ];

  const lastNames = [
    "Smith",
    "Johnson",
    "Williams",
    "Brown",
    "Jones",
    "Garcia",
    "Miller",
    "Davis",
    "Rodriguez",
    "Martinez",
    "Hernandez",
    "Lopez",
    "Wilson",
    "Anderson",
    "Thomas",
    "Taylor",
    "Moore",
    "Jackson",
    "Martin",
    "Lee",
    "Thompson",
    "White",
    "Harris",
    "Clark",
    "Lewis",
    "Robinson",
    "Walker",
    "Young",
    "Allen",
    "King",
    "Wright",
    "Scott",
    "Torres",
    "Nguyen",
    "Hill",
    "Flores",
    "Green",
    "Adams",
    "Nelson",
    "Baker",
    "Hall",
    "Rivera",
    "Campbell",
    "Mitchell",
    "Carter",
    "Roberts",
    "Gomez",
    "Phillips",
    "Evans",
    "Turner",
    "Diaz",
    "Parker",
    "Cruz",
    "Edwards",
    "Collins",
    "Reyes",
    "Stewart",
    "Morris",
    "Morales",
    "Murphy",
    "Cook",
    "Rogers",
    "Gutierrez",
    "Ortiz",
    "Morgan",
    "Cooper",
    "Peterson",
    "Bailey",
    "Reed",
    "Kelly",
    "Howard",
    "Ramos",
    "Kim",
    "Cox",
    "Ward",
    "Richardson",
    "Watson",
    "Brooks",
    "Chavez",
    "Wood",
    "James",
    "Bennett",
    "Gray",
    "Mendoza",
    "Ruiz",
    "Hughes",
    "Price",
    "Alvarez",
    "Castillo",
    "Sanders",
    "Patel",
    "Myers",
    "Long",
    "Ross",
    "Foster",
    "Jimenez",
  ];

  const suburbs = [
    "Sydney",
    "Melbourne",
    "Brisbane",
    "Perth",
    "Adelaide",
    "Gold Coast",
    "Newcastle",
    "Canberra",
    "Sunshine Coast",
    "Wollongong",
    "Hobart",
    "Geelong",
    "Townsville",
    "Cairns",
    "Toowoomba",
    "Darwin",
    "Ballarat",
    "Bendigo",
    "Albury",
    "Launceston",
  ];

  const streets = [
    "Main",
    "Park",
    "Oak",
    "Pine",
    "Maple",
    "Cedar",
    "Elm",
    "First",
    "Second",
    "Third",
    "Church",
    "Washington",
    "Lincoln",
    "Jackson",
    "Madison",
    "Monroe",
    "Adams",
    "Jefferson",
    "Hamilton",
    "Franklin",
    "Lake",
    "Hill",
    "River",
    "Valley",
  ];

  const genders = ["Male", "Female", "Intersex", "Don't want to Specify"];
  const pronouns = ["He/Him", "She/Her", "They/Them"];
  const residenceStatuses = [
    "Australian Citizen",
    "Permanent Resident",
    "Visa Holder",
  ];
  const visaTypes = ["Work Visa", "Student Visa", "Working Holiday Visa"];
  const employmentTypes = [
    "Permanent Full Time",
    "Permanent Part Time",
    "Fixed Term Contract",
    "Casual",
    "Labour Hire",
  ];
  const employmentStatuses = [
    "Reference Check Started",
    "Reference Check Satisfactory",
    "Onboard",
  ];
  const paymentIntervals = ["Weekly", "Fortnightly", "Monthly"];
  const banks = [
    "Commonwealth Bank",
    "ANZ",
    "Westpac",
    "NAB",
    "Bank of Queensland",
  ];
  const states = [
    "New South Wales",
    "Victoria",
    "Queensland",
    "Western Australia",
    "South Australia",
    "Tasmania",
    "Northern Territory",
    "Australian Capital Territory",
  ];

  // Generate 1000 dummy records
  for (let i = 1; i <= 1000; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const email = `employee${i}.${firstName.toLowerCase()}.${lastName.toLowerCase()}@testcompany.com`;
    const gender = genders[Math.floor(Math.random() * genders.length)];
    const suburb = suburbs[Math.floor(Math.random() * suburbs.length)];
    const state = states[Math.floor(Math.random() * states.length)];
    const street = streets[Math.floor(Math.random() * streets.length)];
    const employmentType =
      employmentTypes[Math.floor(Math.random() * employmentTypes.length)];
    const employmentStatus =
      employmentStatuses[Math.floor(Math.random() * employmentStatuses.length)];
    const paymentInterval =
      paymentIntervals[Math.floor(Math.random() * paymentIntervals.length)];
    const bank = banks[Math.floor(Math.random() * banks.length)];

    // Generate random dates
    const birthYear = 1970 + Math.floor(Math.random() * 35);
    const birthMonth = Math.floor(Math.random() * 12) + 1;
    const birthDay = Math.floor(Math.random() * 28) + 1;
    const dob = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(
      birthDay
    ).padStart(2, "0")}`;

    const startYear = 2020 + Math.floor(Math.random() * 4);
    const startMonth = Math.floor(Math.random() * 12) + 1;
    const startDay = Math.floor(Math.random() * 28) + 1;
    const startDate = `${startYear}-${String(startMonth).padStart(
      2,
      "0"
    )}-${String(startDay).padStart(2, "0")}`;

    // Generate phone number
    const mobile = `04${Math.floor(Math.random() * 10)}${Math.floor(
      Math.random() * 10
    )} ${Math.floor(Math.random() * 1000)} ${Math.floor(Math.random() * 1000)}`;

    // Generate TFN (9 digits)
    const tfn = Array.from({ length: 9 }, () =>
      Math.floor(Math.random() * 10)
    ).join("");

    // Generate BSB (6 digits)
    const bsb = Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 10)
    ).join("");

    // Generate Account Number (8-12 digits)
    const accountNumber = Array.from(
      { length: 8 + Math.floor(Math.random() * 5) },
      () => Math.floor(Math.random() * 10)
    ).join("");

    // Generate street number
    const streetNumber = Math.floor(Math.random() * 999) + 1;

    // Generate postal code
    const postalCode = (1000 + Math.floor(Math.random() * 9000)).toString();

    // Random residence status
    const residenceStatus =
      residenceStatuses[Math.floor(Math.random() * residenceStatuses.length)];
    const hasVisa = residenceStatus === "Visa Holder";
    const visaType = hasVisa
      ? visaTypes[Math.floor(Math.random() * visaTypes.length)]
      : "";
    const visaStartDate = hasVisa ? `${startYear - 1}-01-01` : "";
    const visaEndDate = hasVisa ? `${startYear + 2}-12-31` : "";

    // Base rate (random between 50k-150k)
    const baseRate = (50000 + Math.floor(Math.random() * 100000)).toString();

    const row = [
      email,
      "",
      firstName,
      Math.random() > 0.7
        ? firstNames[Math.floor(Math.random() * firstNames.length)]
        : "",
      lastName,
      Math.random() > 0.5 ? firstName : "",
      mobile,
      dob,
      gender,
      gender === "Male"
        ? "He/Him"
        : gender === "Female"
          ? "She/Her"
          : pronouns[Math.floor(Math.random() * pronouns.length)],
      residenceStatus,
      visaType,
      hasVisa ? "Subclass 482" : "",
      visaStartDate,
      visaEndDate,
      "CEO",
      suburb,
      state,
      employmentType,
      employmentStatus,
      startDate,
      employmentType.includes("Part Time") ? "3 days/week" : "",
      employmentType.includes("Fixed Term") ? "12 months" : "",
      baseRate,
      paymentInterval,
      tfn,
      Math.random() > 0.3 ? "yes" : "no",
      Math.random() > 0.8 ? "yes" : "no",
      bank,
      bsb,
      accountNumber,
      "Home",
      Math.random() > 0.5 ? `Building ${Math.floor(Math.random() * 100)}` : "",
      Math.random() > 0.6 ? `${Math.floor(Math.random() * 50)}` : "",
      streetNumber.toString(),
      `${street} Street`,
      suburb,
      state,
      "Australia",
      postalCode,
    ];

    dataSheet.addRow(row);
  }

  // Set column widths
  dataSheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}
