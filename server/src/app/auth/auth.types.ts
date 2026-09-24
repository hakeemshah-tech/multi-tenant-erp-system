import { Types } from "mongoose";

/**
 * Payload to register a new tenant with initial user and branch
 */
export interface RegisterTenantInput {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
  companyLocation: string;
  employeeCount: string;
  businessCategory: Types.ObjectId;
}

/**
 * Login input data
 */
export interface LoginInput {
  email: string;
  password: string;
  tenantId?: Types.ObjectId; // Optional for multi-tenant selection
  branchId?: Types.ObjectId; // Optional for choosing active branch
}

/**
 * Auth token payload embedded in JWT
 */
export interface AuthTokenPayload {
  userId: string;
  role: "tenant-owner" | "admin" | "employee" | "newbie" | "platform-admin";
  tenantId?: string;
  branchId?: string;
}

/**
 * Response after login or registration
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    activeAssignment: {
      tenantId: string;
      branchId: string;
      role: "admin" | "employee" | "tenant-owner";
    };
  };
}

export interface RegisterUserInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
}
