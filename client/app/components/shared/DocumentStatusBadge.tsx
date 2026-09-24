import React from "react";
import { DocumentStatus } from "../../services/documentStatus.service";

interface DocumentStatusBadgeProps {
  status: DocumentStatus["status"];
  className?: string;
}

export const DocumentStatusBadge: React.FC<DocumentStatusBadgeProps> = ({
  status,
  className = "",
}) => {
  const getStatusConfig = (status: DocumentStatus["status"]) => {
    switch (status) {
      case "pendingToApprove":
        return {
          text: "Pending Approval",
          bgColor: "bg-yellow-100",
          textColor: "text-yellow-800",
          borderColor: "border-yellow-200",
          icon: "⏳",
        };
      case "approved":
        return {
          text: "Approved",
          bgColor: "bg-green-100",
          textColor: "text-green-800",
          borderColor: "border-green-200",
          icon: "✅",
        };
      case "rejected":
        return {
          text: "Rejected",
          bgColor: "bg-red-100",
          textColor: "text-red-800",
          borderColor: "border-red-200",
          icon: "❌",
        };
      case "expired":
        return {
          text: "Expired",
          bgColor: "bg-gray-100",
          textColor: "text-gray-800",
          borderColor: "border-gray-200",
          icon: "⏰",
        };
      default:
        return {
          text: "Unknown",
          bgColor: "bg-gray-100",
          textColor: "text-gray-800",
          borderColor: "border-gray-200",
          icon: "❓",
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
        ${config.bgColor} ${config.textColor} ${config.borderColor}
        border ${className}
      `}
    >
      <span>{config.icon}</span>
      <span>{config.text}</span>
    </span>
  );
};
