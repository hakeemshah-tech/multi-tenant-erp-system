import { Router } from "express";
import authRoutes from "@/app/auth/auth.routes";
import protectedRoutes from "@/app/protected/protected.route";
import departmentRoutes from "@/app/departments/department.routes";
import designationRoutes from "@/app/designation/designation.routes";
import employeeconfigRoutes from "@/app/employeeFieldConfig/employeeFieldConfig.routes";
import employeeRoutes from "@/app/employee/employee.routes";
import employeeProfileRoutes from "@/app/employeeProfile/employeeProfile.routes"; // 👈 NEW
import employeeInvitationRoutes from "@/app/employeeInvitation/employeeInvitation.routes"; // 👈 NEW
import auditRoutes from "@/app/audit/audit.routes"; // 👈 NEW
import notificationRoutes from "@/app/notification/notification.routes"; // 👈 NEW
import employeeFieldChangeRequestRoutes from "@/app/employeeFieldChangeRequest/employeeFieldChangeRequest.routes"; // 👈 NEW
import documentStatusRoutes from "@/app/documentStatus/documentStatus.routes"; // 👈 NEW
import documentManagementRoutes from "@/app/documentManagement/documentManagement.routes"; // 👈 NEW UNIFIED SYSTEM
import documentHistoryRoutes from "@/app/documentManagement/documentHistory.routes"; // 👈 NEW DOCUMENT HISTORY
import uploadRoutes from "@/app/upload/uploads.route";
import contractTypeRoutes from "@/app/contracts/contractType.routes";
import templateTypeRoutes from "@/app/contracts/templateType.routes";
import contractTemplateRoutes from "@/app/contracts/contractTemplate.routes";
import awardRoutes from "@/app/awards/award.routes";
import awardPublicRoutes from "@/app/awards/award.public.routes";
import awardEmployeeTypeRoutes from "@/app/awardEmployeeType/awardEmployeeType.routes";
import awardEmployeeTypePublicRoutes from "@/app/awardEmployeeType/awardEmployeeType.public.routes";
import hourlyRateManagementRoutes from "@/app/hourlyRateManagement/hourlyRateManagement.routes";
import hourlyRateManagementPublicRoutes from "@/app/hourlyRateManagement/hourlyRateManagement.public.routes";
import branchAwardsRoutes from "@/app/branchAwards/branchAwards.routes";
import businessStructureRoutes from "@/app/businessStructure/businessStructure.routes";
import businessStructurePublicRoutes from "@/app/businessStructure/businessStructure.public.routes";
import industryTypeRoutes from "@/app/industryType/industryType.routes";
import industryTypePublicRoutes from "@/app/industryType/industryType.public.routes";
import industrySubTypeRoutes from "@/app/industrySubType/industrySubType.routes";
import industrySubTypePublicRoutes from "@/app/industrySubType/industrySubType.public.routes";
import bulkImportRoutes from "@/app/bulkImport/bulkImport.routes";
import employmentSettingsMasterRoutes from "@/app/employmentSettingsMaster/employmentSettingsMaster.routes";
import personalSettingsMasterRoutes from "@/app/personalSettingsMaster/personalSettingsMaster.routes";
import roleRoutes from "@/app/roles/role.routes";
import roleLevelRoutes from "@/app/roleLevels/roleLevel.routes";
import rolePermissionRoutes from "@/app/rolePermissions/rolePermission.routes";

const router = Router();

// Mount with API version prefix
router.use("/auth", authRoutes);
router.use("/protected", protectedRoutes);
router.use("/departments", departmentRoutes);
router.use("/designations", designationRoutes);
router.use("/roles", roleRoutes);
router.use("/role-levels", roleLevelRoutes);
router.use("/role-permissions", rolePermissionRoutes);
router.use("/employee-field-config", employeeconfigRoutes);
router.use("/employees", employeeRoutes);
router.use("/employee-profiles", employeeProfileRoutes); // 👈 NEW
router.use("/employee-invitation", employeeInvitationRoutes); // 👈 NEW
router.use("/audit", auditRoutes); // 👈 NEW
router.use("/notifications", notificationRoutes); // 👈 NEW
router.use("/field-change-requests", employeeFieldChangeRequestRoutes); // 👈 NEW
router.use("/document-status", documentStatusRoutes); // 👈 NEW
router.use("/documents", documentManagementRoutes); // 👈 NEW UNIFIED DOCUMENT MANAGEMENT
router.use("/document-history", documentHistoryRoutes); // 👈 NEW DOCUMENT HISTORY
router.use("/uploads", uploadRoutes);
router.use("/contract-types", contractTypeRoutes);
router.use("/template-types", templateTypeRoutes);
router.use("/contract-templates", contractTemplateRoutes);
// Public read-only routes for reference fields
router.use("/awards", awardPublicRoutes);
router.use("/award-employee-types", awardEmployeeTypePublicRoutes);
router.use("/hourly-rate-managements", hourlyRateManagementPublicRoutes);
router.use("/business-structures", businessStructurePublicRoutes);
router.use("/industry-types", industryTypePublicRoutes);
router.use("/industry-sub-types", industrySubTypePublicRoutes);
// Admin-only routes
router.use("/admin/awards", awardRoutes);
router.use("/admin/award-employee-types", awardEmployeeTypeRoutes);
router.use("/admin/hourly-rate-managements", hourlyRateManagementRoutes);
router.use("/admin/business-structures", businessStructureRoutes);
router.use("/admin/industry-types", industryTypeRoutes);
router.use("/admin/industry-sub-types", industrySubTypeRoutes);
router.use("/admin/employment-settings-master", employmentSettingsMasterRoutes);
router.use("/admin/personal-settings-master", personalSettingsMasterRoutes);
// Branch awards routes (tenant/employer side)
router.use("/branches", branchAwardsRoutes);
// Bulk import routes (testing only)
router.use("/bulk-import", bulkImportRoutes);

export default router;
