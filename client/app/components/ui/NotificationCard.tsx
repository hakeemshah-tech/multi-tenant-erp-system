import { Button, Badge } from "rizzui";
import { Card } from "./Card";
import { ValueDisplay } from "./ValueDisplay";
import {
  formatDate,
  formatNotificationType,
  formatFieldPath,
  getNotificationIcon,
  getNotificationColor,
} from "../../lib/utils/formatters";
import { Notification } from "../../types/notification";
import { Calendar, ChevronDown, ChevronUp, X, User } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface NotificationCardProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  isMarkingAsRead: boolean;
}

export const NotificationCard = ({
  notification,
  onMarkAsRead,
  isMarkingAsRead,
}: NotificationCardProps) => {
  const { _id, message, type, isRead, metadata, createdAt, branchId } =
    notification;
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  const hasMetadata =
    metadata &&
    (metadata.employeeName ||
      metadata.fieldChanged ||
      metadata.oldValue !== undefined ||
      metadata.newValue !== undefined ||
      metadata.actorName);

  // Check if this notification is related to an employee
  const isEmployeeRelated =
    metadata?.employeeId &&
    (type === "employee_data_change" ||
      type === "field_change_request" ||
      type === "field_change_approved" ||
      type === "field_change_rejected" ||
      type === "document_uploaded" ||
      type === "document_updated" ||
      type === "document_approved" ||
      type === "document_rejected" ||
      type === "document_expired");

  // Check if this is a document-related notification
  const isDocumentRelated =
    type === "document_uploaded" ||
    type === "document_updated" ||
    type === "document_approved" ||
    type === "document_rejected" ||
    type === "document_expired";

  // Handle redirect based on notification type and user role
  const handleViewProfile = () => {
    if (metadata?.employeeId) {
      // For document notifications, redirect based on context:
      if (isDocumentRelated) {
        // If this is an employee viewing their own document notifications, go to their profile
        if (type === "document_approved" || type === "document_rejected") {
          router.push(`/nexus-profile/organizations/${branchId}`);
        } else {
          // For employers viewing employee document notifications, go to employee details
          router.push(`/tenant/employees/${metadata.employeeId}`);
        }
      } else {
        // For field change approval/rejection notifications, redirect to organization profile
        if (
          type === "field_change_approved" ||
          type === "field_change_rejected"
        ) {
          router.push(`/nexus-profile/organizations/${branchId}`);
        } else {
          // For other employee-related notifications, redirect to employee details
          router.push(`/tenant/employees/${metadata.employeeId}`);
        }
      }
    }
  };

  return (
    <Card
      className={`p-6 transition-all duration-200 hover:shadow-md ${
        isRead
          ? "bg-gray-50 border-gray-200"
          : "bg-white border-blue-200 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className={`p-3 rounded-full ${getNotificationColor(type)}`}>
            {getNotificationIcon(type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Badge
                variant="flat"
                className={`text-xs ${getNotificationColor(type)}`}
              >
                {formatNotificationType(type)}
              </Badge>
              {!isRead && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
              {hasMetadata && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                  <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                </div>
              )}
            </div>

            <p className="text-gray-900 font-medium mb-3">{message}</p>

            {/* Collapsible Metadata Section */}
            {hasMetadata && (
              <div className="mt-4">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 group"
                >
                  <div className="flex items-center gap-1">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 transition-transform duration-200" />
                    ) : (
                      <ChevronDown className="h-4 w-4 transition-transform duration-200 group-hover:translate-y-0.5" />
                    )}
                    <span className="font-medium">
                      {isExpanded ? "Hide Details" : "Show Details"}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {isExpanded ? "Collapse" : "Expand"}
                  </span>
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                    <div className="text-sm text-gray-600 space-y-3">
                      {metadata.employeeName && (
                        <p>
                          <strong>Employee:</strong> {metadata.employeeName}
                        </p>
                      )}
                      {/* {metadata.fieldChanged && (
                        <p>
                          <strong>Field:</strong>{" "}
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                            {formatFieldPath(metadata.fieldChanged)}
                          </span>
                        </p>
                      )} */}
                      {metadata.oldValue !== undefined && (
                        <ValueDisplay
                          label="Old Value"
                          value={metadata.oldValue}
                          variant="old"
                        />
                      )}
                      {metadata.newValue !== undefined && (
                        <ValueDisplay
                          label="New Value"
                          value={metadata.newValue}
                          variant="new"
                        />
                      )}
                      {metadata.actorName && (
                        <p>
                          <strong>Changed by:</strong> {metadata.actorName}
                        </p>
                      )}
                      {metadata.documentType && (
                        <p>
                          <strong>Document:</strong>{" "}
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                            {metadata.documentType}
                          </span>
                        </p>
                      )}
                      {/* {metadata.sectionKey && metadata.fieldKey && (
                        <p>
                          <strong>Field:</strong>{" "}
                          <span className="bg-gray-50 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                            {metadata.sectionKey} → {metadata.fieldKey}
                          </span>
                        </p>
                      )} */}
                      {metadata.rejectionReason && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800">
                            <strong>Rejection Reason:</strong>{" "}
                            {metadata.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-gray-500 mt-4">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(createdAt)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Profile/Employee Details Button - show for employee-related notifications */}
          {isEmployeeRelated && (
            <button
              onClick={handleViewProfile}
              className="p-2 hover:bg-blue-50 rounded-full transition-colors duration-200 group"
              title={
                isDocumentRelated
                  ? type === "document_approved" || type === "document_rejected"
                    ? "View your profile"
                    : "View employee details"
                  : type === "field_change_approved" ||
                      type === "field_change_rejected"
                    ? "View your profile"
                    : "View employee details"
              }
            >
              <User className="h-4 w-4 text-blue-500 group-hover:text-blue-700 transition-colors duration-200" />
            </button>
          )}

          {/* Close Button */}
          <button
            onClick={() => onMarkAsRead(_id)}
            disabled={isMarkingAsRead}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200 group"
            title="Mark as read"
          >
            <X
              className={`h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors duration-200 ${
                isMarkingAsRead ? "opacity-50" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </Card>
  );
};
