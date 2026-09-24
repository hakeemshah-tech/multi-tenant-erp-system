import ExcelJS from "exceljs";
import { Types } from "mongoose";
import * as employeeProfileService from "../employeeProfile/employeeProfile.service";
import { CreateEmployeeInput } from "../employeeProfile/employeeProfile.types";
import { findUserByEmail } from "@/database/repositories/user.repository";
import { User } from "@/database/models/user.model";
import { EmployeeProfile } from "@/database/models/employeeProfile.model";
import EmployeeModel from "@/database/models/employee.model";
import { Designation } from "@/database/models/designation.model";
import bcrypt from "bcryptjs";

interface ExcelRow {
  [key: string]: any;
}

interface ProcessResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

/**
 * Generate a random password for employees
 */
function generateRandomPassword(): string {
  const length = 12;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

/**
 * Parse Excel file and return rows
 */
export async function parseExcelFile(filePath: string): Promise<ExcelRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet(1); // Get first sheet
  if (!worksheet) {
    throw new Error("Excel file has no worksheets");
  }

  const rows: ExcelRow[] = [];
  const headers: string[] = [];

  // Read headers from first row
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber - 1] = cell.value?.toString() || "";
  });

  // Read data rows
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowData: ExcelRow = {};

    let hasData = false;
    headers.forEach((header, index) => {
      const cell = row.getCell(index + 1);
      const value = cell.value;
      if (value !== null && value !== undefined && value !== "") {
        hasData = true;
      }
      rowData[header] = value?.toString() || "";
    });

    if (hasData) {
      rows.push(rowData);
    }
  }

  return rows;
}

/**
 * Map designation name to ID
 */
async function mapDesignationNameToId(
  designationName: string,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<Types.ObjectId | null> {
  if (!designationName) return null;

  const designation = await Designation.findOne({
    name: designationName.trim(),
    tenantId,
    branchId,
    isDeleted: false,
  });

  return designation?._id || null;
}

/**
 * Process a single employee row
 */
async function processEmployeeRow(
  row: ExcelRow,
  rowIndex: number,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<{ success: boolean; error?: string }> {
  try {
    // Required fields
    const email = row["Email"]?.toString().trim().toLowerCase();
    const firstname = row["First Name"]?.toString().trim();
    const lastname = row["Last Name"]?.toString().trim();
    const designationName = row["Designation"]?.toString().trim();

    if (!email || !firstname || !lastname || !designationName) {
      return {
        success: false,
        error:
          "Missing required fields: Email, First Name, Last Name, or Designation",
      };
    }

    // Check if employee already exists for this tenant/branch
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      const existingProfile = await EmployeeProfile.findOne({
        userId: existingUser._id,
      });

      if (existingProfile) {
        const existingEmployee = await EmployeeModel.findOne({
          tenantId,
          branchId,
          employeeProfile: existingProfile._id,
          isDeleted: false,
        });

        if (existingEmployee) {
          return {
            success: false,
            error: `Employee with email ${email} already exists in this organisation`,
          };
        }
      }
    }

    // Map designation
    const designationId = await mapDesignationNameToId(
      designationName,
      tenantId,
      branchId
    );
    if (!designationId) {
      return {
        success: false,
        error: `Designation "${designationName}" not found`,
      };
    }

    // Generate password if not provided
    const password =
      row["Password"]?.toString().trim() || generateRandomPassword();

    // Build profile data
    const profile: any = {
      personaldetails: {
        firstname,
        lastname,
        middlename: row["Middle Name"]?.toString().trim() || undefined,
        preferredname: row["Preferred Name"]?.toString().trim() || undefined,
        mobile: row["Mobile"]?.toString().trim() || undefined,
        dob: row["Date of Birth"] ? new Date(row["Date of Birth"]) : undefined,
        gender: row["Gender"]?.toString().trim() || undefined,
        pronouns: row["Pronouns"]?.toString().trim() || undefined,
        residencystatus:
          row["Residence Status"]?.toString().trim() || undefined,
        typeofvisa: row["Type of Visa"]?.toString().trim() || undefined,
        visasubcategory:
          row["Visa Subcategory"]?.toString().trim() || undefined,
        visastartdate: row["Visa Start Date"]
          ? new Date(row["Visa Start Date"])
          : undefined,
        visaenddate: row["Visa End Date"]
          ? new Date(row["Visa End Date"])
          : undefined,
      },
      main: {
        mobile: row["Mobile"]?.toString().trim() || undefined,
        location: row["Location"]?.toString().trim() || undefined,
        state: row["State"]?.toString().trim() || undefined,
        employmenttype: row["Employment Type"]?.toString().trim() || undefined,
      },
      employeedetails: {
        employmentstatus:
          row["Employment Status"]?.toString().trim() || undefined,
        employmentstartdate: row["Employment Start Date"]
          ? new Date(row["Employment Start Date"])
          : undefined,
        employeetype: row["Employee Type"]?.toString().trim() || undefined,
        parttimeterm: row["Part Time Term"]?.toString().trim() || undefined,
        fixedterm: row["Fixed Term"]?.toString().trim() || undefined,
      },
      payrolldetails: {
        fulltimeparttimebaserate:
          row["Full Time/Part Time Base Rate"]?.toString().trim() || undefined,
        paymentintervalweeklyfortnightlymonthly:
          row["Payment Interval"]?.toString().trim() || undefined,
        taxfilenumber: row["Tax File Number"]?.toString().trim() || undefined,
        claimtaxfreethresholdyesno:
          row["Claim Tax Free Threshold"]?.toString().trim().toLowerCase() ||
          undefined,
        anyloan: row["Any Loan"]?.toString().trim().toLowerCase() || undefined,
        bankaccountdetails: {
          bankname: row["Bank Name"]?.toString().trim() || undefined,
          bsb: row["BSB"]?.toString().trim() || undefined,
          accountnumber: row["Account Number"]?.toString().trim() || undefined,
        },
      },
    };

    // Build address if provided
    if (
      row["Address For"] ||
      row["Street Number"] ||
      row["Street Name"] ||
      row["Suburb/City"]
    ) {
      profile.address = [
        {
          addressFor: row["Address For"]?.toString().trim() || undefined,
          buildingpropertyname:
            row["Building/Property Name"]?.toString().trim() || undefined,
          flatunitnumber:
            row["Flat/Unit Number"]?.toString().trim() || undefined,
          streetnumber: row["Street Number"]?.toString().trim() || undefined,
          streetname: row["Street Name"]?.toString().trim() || undefined,
          suburbcity: row["Suburb/City"]?.toString().trim() || undefined,
          stateterritiory:
            row["State/Territory"]?.toString().trim() || undefined,
          country: row["Country"]?.toString().trim() || undefined,
          zippostalcode: row["Zip/Postal Code"]?.toString().trim() || undefined,
        },
      ];
    }

    // Create employee
    const employeeData: CreateEmployeeInput = {
      email,
      firstname,
      lastname,
      password,
      designationId,
      profile,
      additionalFields: {}, // Can be extended later
    };

    await employeeProfileService.createEmployeeProfile({
      tenantId,
      branchId,
      data: employeeData,
    });

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Unknown error occurred",
    };
  }
}

/**
 * Process bulk import
 */
export async function processBulkImport(
  filePath: string,
  tenantId: Types.ObjectId,
  branchId: Types.ObjectId
): Promise<ProcessResult> {
  const rows = await parseExcelFile(filePath);
  const result: ProcessResult = {
    success: 0,
    failed: 0,
    errors: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const rowResult = await processEmployeeRow(
      rows[i],
      i + 2,
      tenantId,
      branchId
    );
    if (rowResult.success) {
      result.success++;
    } else {
      result.failed++;
      result.errors.push({
        row: i + 2,
        email: rows[i]["Email"]?.toString() || "N/A",
        error: rowResult.error || "Unknown error",
      });
    }
  }

  return result;
}
