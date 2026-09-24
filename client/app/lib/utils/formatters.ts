/**
 * Utility functions for formatting various data types for display
 */

/**
 * Format values for display in notifications and other UI components
 * Handles addresses, objects, arrays, and primitive types
 */
export const formatValueForDisplay = (value: unknown): string => {
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
          .map((addr: Record<string, unknown>) => {
            const parts = [];
            if (addr.streetnumber) parts.push(String(addr.streetnumber));
            if (addr.streetname) parts.push(String(addr.streetname));
            if (addr.buildingpropertyname)
              parts.push(String(addr.buildingpropertyname));
            if (addr.flatunitnumber) parts.push(`Unit ${addr.flatunitnumber}`);
            if (addr.suburbcity) parts.push(String(addr.suburbcity));
            if (addr.stateterritiory) parts.push(String(addr.stateterritiory));
            if (addr.country) parts.push(String(addr.country));
            if (addr.zippostalcode) parts.push(String(addr.zippostalcode));

            const addressStr = parts.join(", ");
            return addr.addressFor
              ? `${addr.addressFor}: ${addressStr}`
              : addressStr;
          })
          .join(" | ");
      }
    }

    // Handle single address objects with the new structure
    const obj = value as Record<string, unknown>;
    if (obj.addressFor || obj.streetname || obj.suburbcity || obj.country) {
      const parts = [];
      if (obj.streetnumber) parts.push(String(obj.streetnumber));
      if (obj.streetname) parts.push(String(obj.streetname));
      if (obj.buildingpropertyname)
        parts.push(String(obj.buildingpropertyname));
      if (obj.flatunitnumber) parts.push(`Unit ${obj.flatunitnumber}`);
      if (obj.suburbcity) parts.push(String(obj.suburbcity));
      if (obj.stateterritiory) parts.push(String(obj.stateterritiory));
      if (obj.country) parts.push(String(obj.country));
      if (obj.zippostalcode) parts.push(String(obj.zippostalcode));

      const addressStr = parts.join(", ");
      return obj.addressFor ? `${obj.addressFor}: ${addressStr}` : addressStr;
    }

    // Handle legacy address objects
    if (obj.street || obj.city || obj.state || obj.country || obj.postalCode) {
      const parts = [];
      if (obj.street) parts.push(String(obj.street));
      if (obj.city) parts.push(String(obj.city));
      if (obj.state) parts.push(String(obj.state));
      if (obj.country) parts.push(String(obj.country));
      if (obj.postalCode) parts.push(String(obj.postalCode));
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
 * Format date for display in notifications
 * Shows relative time (e.g., "2 hours ago", "Yesterday", "Jan 15, 2024")
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );
    return diffInMinutes <= 1 ? "Just now" : `${diffInMinutes} minutes ago`;
  }

  if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  }

  if (diffInHours < 48) {
    return "Yesterday";
  }

  if (diffInHours < 168) {
    // 7 days
    return `${Math.floor(diffInHours / 24)} days ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

/**
 * Format notification type for display
 * Converts snake_case to Title Case
 */
export const formatNotificationType = (type: string): string => {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Convert technical field paths to human-readable labels
 * Example: "additionalFields.payrolldetailsForEmployee.award" -> "Payroll Details - Award"
 */
export const formatFieldPath = (fieldPath: string): string => {
  if (!fieldPath) return fieldPath;

  // Split by dots and process each part
  const parts = fieldPath.split(".");

  return parts
    .map((part, index) => {
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

/**
 * Get notification icon based on type
 */
export const getNotificationIcon = (type: string) => {
  switch (type) {
    case "employee_data_change":
      return "👤";
    case "field_change_request":
      return "📝";
    case "field_change_approved":
      return "✅";
    case "field_change_rejected":
      return "❌";
    case "document_uploaded":
      return "📄";
    case "document_updated":
      return "📄";
    case "document_approved":
      return "✅";
    case "document_rejected":
      return "❌";
    case "document_expired":
      return "⏰";
    case "system":
      return "⚙️";
    case "invitation":
      return "📧";
    default:
      return "🔔";
  }
};

/**
 * Get notification color classes based on type
 */
export const getNotificationColor = (type: string): string => {
  switch (type) {
    case "employee_data_change":
      return "bg-green-100 text-green-600";
    case "field_change_request":
      return "bg-orange-100 text-orange-600";
    case "field_change_approved":
      return "bg-green-100 text-green-600";
    case "field_change_rejected":
      return "bg-red-100 text-red-600";
    case "document_uploaded":
      return "bg-blue-100 text-blue-600";
    case "document_updated":
      return "bg-blue-100 text-blue-600";
    case "document_approved":
      return "bg-green-100 text-green-600";
    case "document_rejected":
      return "bg-red-100 text-red-600";
    case "document_expired":
      return "bg-yellow-100 text-yellow-600";
    case "system":
      return "bg-blue-100 text-blue-600";
    case "invitation":
      return "bg-purple-100 text-purple-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
};
