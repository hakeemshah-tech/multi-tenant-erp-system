import { Types } from "mongoose";
import { AppError } from "@/common/utils/app-error";

// The middleware reaches into the employee permission service, which would
// otherwise need a live MongoDB. Only the resolver is faked; the authorization
// decision itself is the thing under test.
jest.mock("@/app/employee/employeePermission.service", () => ({
  getEmployeePermissions: jest.fn(),
}));

import { getEmployeePermissions } from "@/app/employee/employeePermission.service";
import { checkPermission } from "@/common/middlewares/checkPermission";

const mockedGetPermissions = getEmployeePermissions as jest.MockedFunction<
  typeof getEmployeePermissions
>;

const runMiddleware = async (user: unknown, section: string, action: any) => {
  const req = { user } as any;
  const res = {} as any;
  const next = jest.fn();

  await checkPermission({ section, action })(req, res, next);

  return next;
};

const assignment = {
  tenantId: new Types.ObjectId().toHexString(),
  branchId: new Types.ObjectId().toHexString(),
};

const employee = {
  userId: new Types.ObjectId().toHexString(),
  role: "employee",
  activeAssignment: assignment,
};

const grant = (permissions: Record<string, unknown>, isSystemAdmin = false) => {
  mockedGetPermissions.mockResolvedValue({
    permissions: { permissions },
    aggregatedRoles: { isSystemAdmin, roleIds: ["role-1"] },
  } as any);
};

describe("checkPermission: RBAC gate", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const next = await runMiddleware(undefined, "employees", "read");

    const error = next.mock.calls[0][0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(401);
  });

  it("lets a platform admin through without consulting permissions", async () => {
    const next = await runMiddleware(
      { isPlatformAdmin: true },
      "employees",
      "delete"
    );

    expect(next).toHaveBeenCalledWith();
    expect(mockedGetPermissions).not.toHaveBeenCalled();
  });

  it.each(["tenant-owner", "admin"])(
    "lets a %s through without consulting permissions",
    async (role) => {
      const next = await runMiddleware(
        { role, activeAssignment: assignment },
        "employees",
        "write"
      );

      expect(next).toHaveBeenCalledWith();
      expect(mockedGetPermissions).not.toHaveBeenCalled();
    }
  );

  it("rejects an employee with no active assignment", async () => {
    const next = await runMiddleware(
      { userId: "u1", role: "employee" },
      "employees",
      "read"
    );

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
  });

  it("allows the accept-invite carve-out for reading organisation details", async () => {
    const next = await runMiddleware(
      { userId: "u1", role: "employee" },
      "organisation-details",
      "read"
    );

    expect(next).toHaveBeenCalledWith();
  });

  it("does not extend the carve-out to writes", async () => {
    const next = await runMiddleware(
      { userId: "u1", role: "employee" },
      "organisation-details",
      "write"
    );

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
  });

  it("grants access when the section permission allows the action", async () => {
    grant({ employees: { read: true, write: false, delete: false } });

    const next = await runMiddleware(employee, "employees", "read");

    expect(next).toHaveBeenCalledWith();
  });

  it("denies the action the section permission withholds", async () => {
    grant({ employees: { read: true, write: false, delete: false } });

    const next = await runMiddleware(employee, "employees", "write");

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toMatch(/No write permission/);
  });

  it("denies a section the role has no entry for", async () => {
    grant({ employees: { read: true, write: true, delete: true } });

    const next = await runMiddleware(employee, "payroll", "read");

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toMatch(/No permission for section "payroll"/);
  });

  it("falls back to the legacy 'positions' key for 'job-titles'", async () => {
    grant({ positions: { read: true, write: false, delete: false } });

    const next = await runMiddleware(employee, "job-titles", "read");

    expect(next).toHaveBeenCalledWith();
  });

  it("falls back to the legacy 'documents' key for 'config-documents'", async () => {
    grant({ documents: { read: true, write: false, delete: false } });

    const next = await runMiddleware(employee, "config-documents", "read");

    expect(next).toHaveBeenCalledWith();
  });

  it("denies an employee holding no roles", async () => {
    mockedGetPermissions.mockResolvedValue({
      permissions: { permissions: {} },
      aggregatedRoles: { isSystemAdmin: false, roleIds: [] },
    } as any);

    const next = await runMiddleware(employee, "employees", "read");

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(403);
    expect(error.message).toMatch(/No roles assigned/);
  });

  it("surfaces a resolver failure as a 500 rather than granting access", async () => {
    mockedGetPermissions.mockRejectedValue(new Error("mongo unreachable"));

    const next = await runMiddleware(employee, "employees", "read");

    const error = next.mock.calls[0][0] as AppError;
    expect(error.statusCode).toBe(500);
  });
});
