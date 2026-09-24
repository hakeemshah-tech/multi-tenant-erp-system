import { Types } from "mongoose";
import {
  Notification,
  INotification,
} from "../database/models/notification.model";

// In-memory cache to prevent duplicate notifications within a short time window
const notificationCache = new Map<string, number>();
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Generate a cache key for notification deduplication
 */
const generateCacheKey = (params: {
  tenantId: string;
  branchId: string;
  employeeId: string;
  fieldChanged: string;
  actorUserId?: string;
}): string => {
  return `${params.tenantId}-${params.branchId}-${params.employeeId}-${params.fieldChanged}-${params.actorUserId}`;
};

/**
 * Check if a notification was recently created to prevent duplicates
 */
const isRecentNotification = (cacheKey: string): boolean => {
  const timestamp = notificationCache.get(cacheKey);
  if (!timestamp) return false;

  const now = Date.now();
  const isRecent = now - timestamp < CACHE_DURATION;

  if (!isRecent) {
    // Remove expired entries
    notificationCache.delete(cacheKey);
  }

  return isRecent;
};

/**
 * Mark a notification as recently created
 */
const markNotificationCreated = (cacheKey: string): void => {
  notificationCache.set(cacheKey, Date.now());

  // Clean up old entries periodically
  if (notificationCache.size > 1000) {
    const now = Date.now();
    for (const [key, timestamp] of notificationCache.entries()) {
      if (now - timestamp > CACHE_DURATION) {
        notificationCache.delete(key);
      }
    }
  }
};

export interface CreateNotificationParams {
  tenantId: Types.ObjectId | string;
  branchId: Types.ObjectId | string;
  targetUserId?: Types.ObjectId | string; // Who should receive this notification
  message: string;
  type?:
    | "employee_data_change"
    | "field_change_request"
    | "field_change_approved"
    | "field_change_rejected"
    | "document_uploaded"
    | "document_updated"
    | "document_approved"
    | "document_rejected"
    | "document_expired"
    | "contract_template_approval"
    | "system"
    | "invitation"
    | "other";
  metadata?: {
    employeeId?: Types.ObjectId | string;
    employeeName?: string;
    fieldChanged?: string;
    fieldLabel?: string;
    oldValue?: any;
    newValue?: any;
    actorUserId?: Types.ObjectId | string;
    actorName?: string;
    requestId?: Types.ObjectId | string;
    rejectionReason?: string;
    documentType?: string;
    sectionKey?: string;
    fieldKey?: string;
    innerSectionKey?: string;
    documentId?: string;
    previousStatus?: string;
    newStatus?: string;
  };
}

export interface GetNotificationsParams {
  tenantId: Types.ObjectId | string;
  branchId: Types.ObjectId | string;
  targetUserId?: Types.ObjectId | string; // Filter by specific user
  limit?: number;
  skip?: number;
  isRead?: boolean;
  type?: string;
}

export interface NotificationResponse {
  _id: string;
  tenantId: string;
  branchId: string;
  message: string;
  type: string;
  isRead: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a new notification
 */
export const createNotification = async (
  params: CreateNotificationParams
): Promise<INotification> => {
  // Normalize targetUserId to ObjectId if provided
  const targetUserId = params.targetUserId
    ? typeof params.targetUserId === "string"
      ? new Types.ObjectId(params.targetUserId)
      : params.targetUserId
    : undefined;

  const notification = new Notification({
    tenantId: params.tenantId,
    branchId: params.branchId,
    targetUserId: targetUserId,
    message: params.message,
    type: params.type || "employee_data_change",
    metadata: params.metadata,
  });

  const saved = await notification.save();

  // Debug: Verify what was actually saved
  console.log(`[NOTIFICATIONS] Saved notification:`, {
    _id: saved._id.toString(),
    tenantId: saved.tenantId.toString(),
    branchId: saved.branchId.toString(),
    targetUserId: saved.targetUserId?.toString(),
    type: saved.type,
  });

  return saved;
};

/**
 * Get notifications for a specific tenant and branch
 */
export const getNotifications = async (
  params: GetNotificationsParams
): Promise<{
  notifications: NotificationResponse[];
  total: number;
  unreadCount: number;
}> => {
  const {
    tenantId,
    branchId,
    targetUserId,
    limit = 50,
    skip = 0,
    isRead,
    type,
  } = params;

  // Build query
  const query: any = {
    tenantId: new Types.ObjectId(tenantId),
    branchId: new Types.ObjectId(branchId),
  };

  // Filter by target user if provided
  if (targetUserId) {
    // Normalize targetUserId to ObjectId
    query.targetUserId =
      typeof targetUserId === "string"
        ? new Types.ObjectId(targetUserId)
        : targetUserId;

    console.log(
      `[NOTIFICATIONS] Query filter - targetUserId: ${query.targetUserId.toString()}`
    );
  } else {
    console.log(
      `[NOTIFICATIONS] Query filter - targetUserId: undefined (showing all notifications for tenant/branch)`
    );
  }

  if (typeof isRead === "boolean") {
    query.isRead = isRead;
  }

  if (type) {
    query.type = type;
  }

  // Debug: Log the query being executed
  // Convert ObjectIds to strings for JSON serialization
  const queryForLog = {
    ...query,
    tenantId: query.tenantId?.toString(),
    branchId: query.branchId?.toString(),
    targetUserId: query.targetUserId?.toString(),
  };
  console.log(
    `[NOTIFICATIONS] Executing query:`,
    JSON.stringify(queryForLog, null, 2)
  );

  // Get notifications with pagination
  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

  console.log(
    `[NOTIFICATIONS] Found ${notifications.length} notifications matching query`
  );
  if (notifications.length > 0) {
    console.log(`[NOTIFICATIONS] Sample notification:`, {
      _id: notifications[0]._id?.toString(),
      targetUserId: notifications[0].targetUserId?.toString(),
      tenantId: notifications[0].tenantId?.toString(),
      branchId: notifications[0].branchId?.toString(),
      type: notifications[0].type,
      message: notifications[0].message,
    });
  } else {
    // If no notifications found, let's check what notifications exist for this targetUserId
    const allNotificationsForUser = await Notification.find({
      targetUserId: query.targetUserId,
    })
      .select("_id tenantId branchId targetUserId type message createdAt")
      .lean();
    console.log(
      `[NOTIFICATIONS] DEBUG: Found ${allNotificationsForUser.length} total notifications for targetUserId ${query.targetUserId?.toString()}`
    );
    if (allNotificationsForUser.length > 0) {
      console.log(
        `[NOTIFICATIONS] DEBUG: Sample notifications for this user:`,
        allNotificationsForUser.slice(0, 3).map((n) => ({
          _id: n._id?.toString(),
          tenantId: n.tenantId?.toString(),
          branchId: n.branchId?.toString(),
          targetUserId: n.targetUserId?.toString(),
          type: n.type,
        }))
      );
    }
  }

  // Get total count
  const total = await Notification.countDocuments(query);

  // Get unread count
  const unreadCount = await Notification.countDocuments({
    ...query,
    isRead: false,
  });

  return {
    notifications: notifications.map((notif) => ({
      _id: notif._id.toString(),
      tenantId: notif.tenantId.toString(),
      branchId: notif.branchId.toString(),
      message: notif.message,
      type: notif.type,
      isRead: notif.isRead,
      metadata: notif.metadata,
      createdAt: notif.createdAt,
      updatedAt: notif.updatedAt,
    })),
    total,
    unreadCount,
  };
};

/**
 * Mark notifications as read
 */
export const markNotificationsAsRead = async (
  tenantId: Types.ObjectId | string,
  branchId: Types.ObjectId | string,
  notificationIds?: string[]
): Promise<{ modifiedCount: number }> => {
  const query: any = {
    tenantId: new Types.ObjectId(tenantId),
    branchId: new Types.ObjectId(branchId),
    isRead: false,
  };

  if (notificationIds && notificationIds.length > 0) {
    query._id = { $in: notificationIds.map((id) => new Types.ObjectId(id)) };
  }

  const result = await Notification.updateMany(query, { isRead: true });
  return { modifiedCount: result.modifiedCount || 0 };
};

/**
 * Delete old notifications (cleanup)
 */
export const deleteOldNotifications = async (
  daysOld: number = 30
): Promise<{ deletedCount: number }> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await Notification.deleteMany({
    createdAt: { $lt: cutoffDate },
  });

  return { deletedCount: result.deletedCount || 0 };
};

/**
 * Helper function to format values for display in notifications
 */
/**
 * Check if a field change is related to document upload
 */
const isDocumentFieldChange = (fieldPath: string): boolean => {
  // Check if the path contains document-related fields
  const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];
  const pathParts = fieldPath.split(".");

  // Check if any part of the path matches document fields
  return (
    pathParts.some((part) => documentFields.includes(part)) ||
    fieldPath.includes("documents.") ||
    (fieldPath.includes("additionalFields") &&
      pathParts.some((part) => documentFields.includes(part)))
  );
};

/**
 * Extract document information from field path
 */
const extractDocumentInfo = (fieldPath: string): string => {
  // First, get the base path without technical fields
  const basePath = getDocumentBasePath(fieldPath);
  const pathParts = basePath.split(".");

  // Handle documents section
  if (basePath.includes("documents.")) {
    const documentsIndex = pathParts.indexOf("documents");
    if (documentsIndex !== -1 && documentsIndex + 2 < pathParts.length) {
      const documentType = pathParts[documentsIndex + 1]; // e.g., "identificationdocuments"
      const fieldName = pathParts[documentsIndex + 2]; // e.g., "passport"

      // Convert to human-readable format
      const formattedType = documentType
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

      const formattedField = fieldName
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();

      return `${formattedType} - ${formattedField}`;
    }
  }

  // Handle additional fields
  if (basePath.includes("additionalFields")) {
    // Try to extract meaningful information from the path
    const lastMeaningfulPart =
      pathParts[pathParts.length - 2] || pathParts[pathParts.length - 1];
    if (
      lastMeaningfulPart &&
      !["fileId", "key", "expiryDate", "issuingDate"].includes(
        lastMeaningfulPart
      )
    ) {
      return lastMeaningfulPart
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
    }
  }

  // Fallback to generic document
  return "Document";
};

/**
 * Get the base document path without technical fields
 */
const getDocumentBasePath = (fieldPath: string): string => {
  const pathParts = fieldPath.split(".");
  const documentFields = ["fileId", "key", "expiryDate", "issuingDate"];

  // Remove technical fields from the end
  while (
    pathParts.length > 0 &&
    documentFields.includes(pathParts[pathParts.length - 1])
  ) {
    pathParts.pop();
  }

  // Ensure we have at least the base path
  if (pathParts.length === 0) {
    return fieldPath; // fallback to original path
  }

  return pathParts.join(".");
};

/**
 * Convert technical field paths to human-readable labels
 * Example: "additionalFields.payrolldetailsForEmployee.award" -> "Payroll Details - Award"
 */
const formatFieldPath = (fieldPath: string): string => {
  if (!fieldPath) return fieldPath;

  // Split by dots and process each part
  const parts = fieldPath.split(".");

  return parts
    .map((part) => {
      // Skip empty parts
      if (!part) return "";

      // Convert camelCase to Title Case
      const formatted = part
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
        .trim();

      // Handle specific field mappings for better UX
      const fieldMappings: Record<string, string> = {
        "Additional Fields": "Additional Information",
        "Payrolldetails For Employee": "Payroll Details",
        Personaldetails: "Personal Details",
        Contactdetails: "Contact Details",
        Employmentdetails: "Employment Details",
        Bankdetails: "Bank Details",
        Emergencycontact: "Emergency Contact",
        "Emergency Contact Details": "Emergency Contact",
        Address: "Address",
        Award: "Award",
        Classification: "Classification",
        "Pay Rate": "Pay Rate",
        Superannuation: "Superannuation",
        Tax: "Tax Information",
        Firstname: "First Name",
        Lastname: "Last Name",
        Email: "Email Address",
        Phone: "Phone Number",
        Mobile: "Mobile Number",
        "Date Of Birth": "Date of Birth",
        "Start Date": "Start Date",
        "End Date": "End Date",
        Position: "Position",
        Department: "Department",
        Manager: "Manager",
        Location: "Work Location",
        Street: "Street Address",
        City: "City",
        State: "State",
        Postcode: "Postcode",
        Country: "Country",
      };

      // Apply field mappings
      return fieldMappings[formatted] || formatted;
    })
    .filter((part) => part) // Remove empty parts
    .join(" → "); // Use arrow separator for hierarchy
};

const formatValueForDisplay = (value: any): string => {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object") {
    // Handle address arrays (like the one in your example)
    if (Array.isArray(value) && value.length > 0) {
      const firstItem = value[0] as Record<string, unknown>;
      // Check if it looks like an address object
      if (
        firstItem.addressFor ||
        firstItem.streetname ||
        firstItem.suburbcity ||
        firstItem.country
      ) {
        return value
          .map((addr: any) => {
            const parts = [];
            if (addr.streetnumber) parts.push(addr.streetnumber);
            if (addr.streetname) parts.push(addr.streetname);
            if (addr.buildingpropertyname)
              parts.push(addr.buildingpropertyname);
            if (addr.flatunitnumber) parts.push(`Unit ${addr.flatunitnumber}`);
            if (addr.suburbcity) parts.push(addr.suburbcity);
            if (addr.stateterritiory) parts.push(addr.stateterritiory);
            if (addr.country) parts.push(addr.country);
            if (addr.zippostalcode) parts.push(addr.zippostalcode);

            const addressStr = parts.join(", ");
            return addr.addressFor
              ? `${addr.addressFor}: ${addressStr}`
              : addressStr;
          })
          .join(" | ");
      }
    }

    // Handle single address objects with the new structure
    if (
      value.addressFor ||
      value.streetname ||
      value.suburbcity ||
      value.country
    ) {
      const parts = [];
      if (value.streetnumber) parts.push(value.streetnumber);
      if (value.streetname) parts.push(value.streetname);
      if (value.buildingpropertyname) parts.push(value.buildingpropertyname);
      if (value.flatunitnumber) parts.push(`Unit ${value.flatunitnumber}`);
      if (value.suburbcity) parts.push(value.suburbcity);
      if (value.stateterritiory) parts.push(value.stateterritiory);
      if (value.country) parts.push(value.country);
      if (value.zippostalcode) parts.push(value.zippostalcode);

      const addressStr = parts.join(", ");
      return value.addressFor
        ? `${value.addressFor}: ${addressStr}`
        : addressStr;
    }

    // Handle legacy address objects
    if (
      value.street ||
      value.city ||
      value.state ||
      value.country ||
      value.postalCode
    ) {
      const parts = [];
      if (value.street) parts.push(value.street);
      if (value.city) parts.push(value.city);
      if (value.state) parts.push(value.state);
      if (value.country) parts.push(value.country);
      if (value.postalCode) parts.push(value.postalCode);
      return parts.join(", ");
    }

    // Handle other objects by stringifying them
    try {
      return JSON.stringify(value);
    } catch {
      return "[Complex Object]";
    }
  }

  return String(value);
};

/**
 * Create employee data change notification
 */
export const createEmployeeDataChangeNotification = async (params: {
  tenantId: Types.ObjectId | string;
  branchId: Types.ObjectId | string;
  employeeId: Types.ObjectId | string;
  employeeName: string;
  fieldChanged: string;
  oldValue: any;
  newValue: any;
  actorUserId?: Types.ObjectId | string;
  actorName?: string;
}): Promise<INotification> => {
  const {
    tenantId,
    branchId,
    employeeId,
    employeeName,
    fieldChanged,
    oldValue,
    newValue,
    actorUserId,
    actorName,
  } = params;

  // Generate cache key for deduplication
  const cacheKey = generateCacheKey({
    tenantId: String(tenantId),
    branchId: String(branchId),
    employeeId: String(employeeId),
    fieldChanged,
    actorUserId: actorUserId ? String(actorUserId) : undefined,
  });

  // Check if a similar notification was recently created
  if (isRecentNotification(cacheKey)) {
    console.log(
      `[NOTIFICATION] Skipping duplicate notification for: ${fieldChanged}`
    );
    console.log(`[NOTIFICATION] Cache key: ${cacheKey}`);
    // Return a dummy notification to maintain the interface
    return {
      _id: "duplicate",
      tenantId: String(tenantId),
      branchId: String(branchId),
      message: "Duplicate notification skipped",
      type: "employee_data_change",
      isRead: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as INotification;
  }

  // Mark this notification as created
  markNotificationCreated(cacheKey);
  console.log(`[NOTIFICATION] Creating new notification for: ${fieldChanged}`);
  console.log(`[NOTIFICATION] Cache key: ${cacheKey}`);

  // Check if this is a document upload change
  const isDocumentUpload = isDocumentFieldChange(fieldChanged);

  if (isDocumentUpload) {
    // For document uploads, create a single, user-friendly notification
    const documentInfo = extractDocumentInfo(fieldChanged);
    const message = `${employeeName} has uploaded a document: ${documentInfo}`;

    return await createNotification({
      tenantId,
      branchId,
      message,
      type: "employee_data_change",
      metadata: {
        employeeId,
        employeeName,
        fieldChanged: documentInfo, // Use friendly name instead of technical path
        oldValue: oldValue ? "Previous document" : "No document",
        newValue: "New document uploaded",
        actorUserId,
        actorName,
      },
    });
  }

  // For non-document changes, use the original logic
  const formattedOldValue = formatValueForDisplay(oldValue);
  const formattedNewValue = formatValueForDisplay(newValue);
  const formattedFieldPath = formatFieldPath(fieldChanged);
  const message = `${employeeName} has changed ${formattedFieldPath} from "${formattedOldValue}" to "${formattedNewValue}"`;

  return await createNotification({
    tenantId,
    branchId,
    message,
    type: "employee_data_change",
    metadata: {
      employeeId,
      employeeName,
      fieldChanged,
      oldValue,
      newValue,
      actorUserId,
      actorName,
    },
  });
};
