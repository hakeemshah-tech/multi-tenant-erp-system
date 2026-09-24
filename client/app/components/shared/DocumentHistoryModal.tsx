import React, { useState, useEffect } from "react";
import { Button, Badge, Input, Select } from "rizzui";
import { Card } from "../ui/Card";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  ClockIcon,
  UserIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  CalendarIcon,
} from "@heroicons/react/24/outline";
import axiosInstance from "@/app/lib/axios";
import { format } from "date-fns";

interface DocumentHistoryEntry {
  _id: string;
  documentId: string;
  employeeId: string;
  tenantId: string;
  branchId: string;
  sectionKey: string;
  innerSectionKey?: string;
  fieldKey: string;
  fileName: string;
  fileId: string;
  fileSize: number;
  mimeType: string;
  issuingDate?: string;
  expiryDate?: string;
  previousIssuingDate?: string;
  previousExpiryDate?: string;
  status: string;
  changeType:
    "upload" | "date_update" | "approval" | "rejection" | "status_change";
  actorId: string;
  actorType: "employee" | "employer" | "system";
  actorName: string;
  actorEmail: string;
  reviewedBy?: string | { firstName: string; lastName: string; email: string };
  reviewedAt?: string;
  metadata?: any;
  createdAt: string;
}

// Helper to find submission and approval info for a history entry
// Note: currentStatus should be passed from the component that has access to it
const getSubmissionAndApprovalInfo = (
  history: DocumentHistoryEntry,
  allHistories: DocumentHistoryEntry[],
  currentStatus?: {
    status?: string;
    fileId?: string;
    reviewedBy?:
      { firstName: string; lastName: string; email: string } | string;
    reviewedAt?: string;
    rejectionReason?: string;
  } | null
) => {
  // Find the ORIGINAL upload entry for this document (earliest one)
  // This ensures we get the original submitter, not someone who re-uploaded later
  const uploadEntries = allHistories.filter(
    (h) =>
      h.changeType === "upload" &&
      h.fileId === history.fileId &&
      h.sectionKey === history.sectionKey &&
      h.fieldKey === history.fieldKey
  );
  // Sort by createdAt ascending to get the earliest (original) upload
  const uploadEntry =
    uploadEntries.length > 0
      ? uploadEntries.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )[0]
      : null;

  // Check if this history entry matches the CURRENT document's fileId
  // This is the key fix - only show approval info for the entry that matches the current document
  const isCurrentDocument =
    currentStatus?.fileId && history.fileId === currentStatus.fileId;

  // Determine approved/rejected by and on
  // IMPORTANT: Only show "Approved By" and "Approved On" if status is "approved", NOT "rejected"
  // Priority:
  // 1. For current document: Use currentStatus (most accurate)
  // 2. For older documents: Look for separate approval entry OR use history entry's own approval info
  let approvedBy = "N/A";
  let approvedOn: string | null = null;

  const isCurrentStatusApproved = currentStatus?.status === "approved";
  const isHistoryEntryApproved = history.status === "approved";
  const isHistoryEntryRejected = history.status === "rejected";
  const isHistoryEntryPending = history.status === "pendingToApprove";

  // Find separate approval entry for this specific fileId (for older documents)
  // Only look for "approval" entries, not "rejection" entries
  const approvalEntries = allHistories.filter(
    (h) =>
      h.changeType === "approval" &&
      h.fileId === history.fileId &&
      h.sectionKey === history.sectionKey &&
      h.fieldKey === history.fieldKey
  );
  const approvalEntry =
    approvalEntries.length > 0
      ? approvalEntries.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0]
      : null;

  // Only show approval info if the document is actually approved (not rejected)
  if (
    isCurrentDocument &&
    isCurrentStatusApproved &&
    isHistoryEntryApproved &&
    currentStatus?.reviewedBy &&
    currentStatus?.reviewedAt
  ) {
    // For current document: Use currentStatus (most accurate)
    if (
      typeof currentStatus.reviewedBy === "object" &&
      currentStatus.reviewedBy !== null
    ) {
      approvedBy =
        `${currentStatus.reviewedBy.firstName} ${currentStatus.reviewedBy.lastName}`.trim() ||
        "N/A";
    } else if (typeof currentStatus.reviewedBy === "string") {
      approvedBy = "N/A";
    } else {
      approvedBy = "N/A";
    }
    approvedOn = currentStatus.reviewedAt;
  } else if (approvalEntry && isHistoryEntryApproved) {
    // For older documents: Use the separate approval entry
    approvedBy = approvalEntry.actorName;
    approvedOn = approvalEntry.createdAt;
  } else if (
    history.reviewedBy &&
    history.reviewedAt &&
    isHistoryEntryApproved
  ) {
    // Fallback: Use approval info stored directly in the history entry (if available)
    if (typeof history.reviewedBy === "object" && history.reviewedBy !== null) {
      approvedBy =
        `${history.reviewedBy.firstName} ${history.reviewedBy.lastName}`.trim() ||
        "N/A";
    } else {
      // If it's just a string/ID, we can't display it - try to find from approval entry
      approvedBy = approvalEntry?.actorName || "N/A";
    }
    approvedOn = history.reviewedAt;
  } else if (
    isHistoryEntryPending ||
    (isCurrentDocument && currentStatus?.status === "pendingToApprove")
  ) {
    // Document is pending approval
    approvedBy = "Pending";
    approvedOn = null;
  } else if (isHistoryEntryRejected) {
    // Document is rejected - don't show approval info
    approvedBy = "N/A";
    approvedOn = null;
  } else if (!isCurrentDocument && isHistoryEntryApproved) {
    // Older document that was approved but we don't have approval info
    // Try to find from approval entry as last resort
    approvedBy = approvalEntry?.actorName || "N/A";
    approvedOn = approvalEntry?.createdAt || null;
  }

  return {
    documentName:
      history.metadata?.originalFileName || history.fileName || "N/A",
    // Submitted By should ALWAYS be the original uploader from the upload entry
    submittedBy: uploadEntry?.actorName || "N/A",
    submittedOn: uploadEntry?.createdAt || null,
    approvedBy,
    approvedOn,
  };
};

interface DocumentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentName: string;
  employeeName?: string;
}

const DocumentHistoryModal: React.FC<DocumentHistoryModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentName,
  employeeName,
}) => {
  const [histories, setHistories] = useState<DocumentHistoryEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<{
    status?: string;
    fileId?: string;
    reviewedBy?:
      { firstName: string; lastName: string; email: string } | string;
    reviewedAt?: string;
    rejectionReason?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [filters, setFilters] = useState({
    search: "",
    changeType: "",
    status: "",
    actorType: "",
  });

  const fetchHistory = async (page: number = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "10",
        ...filters,
      });

      const { data } = await axiosInstance.get(
        `/api/document-history/${documentId}?${params}`
      );
      setHistories(data.histories || []);
      setPagination(data.pagination || pagination);
      // If currentStatus is available in response, use it
      if (data.currentStatus) {
        setCurrentStatus(data.currentStatus);
      }
    } catch (error) {
      console.error("Failed to fetch document history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && documentId) {
      fetchHistory();
    }
  }, [isOpen, documentId, filters]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "rejected":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case "expired":
        return <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />;
      case "uploaded":
      case "updated":
        return <DocumentTextIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <DocumentTextIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case "upload":
        return <ArrowUpIcon className="h-4 w-4 text-blue-500" />;
      case "date_update":
        return <CalendarIcon className="h-4 w-4 text-purple-500" />;
      case "approval":
        return <CheckCircleIcon className="h-4 w-4 text-green-500" />;
      case "rejection":
        return <XCircleIcon className="h-4 w-4 text-red-500" />;
      case "status_change":
        return <ClockIcon className="h-4 w-4 text-orange-500" />;
      default:
        return <DocumentTextIcon className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "expired":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "uploaded":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "updated":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getChangeTypeBadgeColor = (changeType: string) => {
    switch (changeType) {
      case "upload":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "date_update":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "approval":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejection":
        return "bg-red-100 text-red-800 border-red-200";
      case "status_change":
        return "bg-orange-100 text-orange-800 border-orange-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handlePageChange = (page: number) => {
    fetchHistory(page);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DocumentTextIcon className="h-6 w-6" />
              <h2 className="text-xl font-semibold">
                Document History - {documentName}
                {employeeName && (
                  <span className="text-sm font-normal text-blue-100 ml-2">
                    ({employeeName})
                  </span>
                )}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
            >
              <XCircleIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 border-b">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search in history..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="w-full"
              />
            </div>
            <Select
              value={filters.changeType}
              onChange={(value) => handleFilterChange("changeType", value)}
              options={[
                { label: "All Types", value: "" },
                { label: "Upload", value: "upload" },
                { label: "Date Update", value: "date_update" },
                { label: "Approval", value: "approval" },
                { label: "Rejection", value: "rejection" },
                { label: "Status Change", value: "status_change" },
              ]}
              placeholder="Change Type"
              className="w-[180px]"
            />
            <Select
              value={filters.status}
              onChange={(value) => handleFilterChange("status", value)}
              options={[
                { label: "All Status", value: "" },
                { label: "Approved", value: "approved" },
                { label: "Rejected", value: "rejected" },
                { label: "Expired", value: "expired" },
                { label: "Uploaded", value: "uploaded" },
                { label: "Updated", value: "updated" },
              ]}
              placeholder="Status"
              className="w-[150px]"
            />
            <Select
              value={filters.actorType}
              onChange={(value) => handleFilterChange("actorType", value)}
              options={[
                { label: "All Actors", value: "" },
                { label: "Employee", value: "employee" },
                { label: "Employer", value: "employer" },
                { label: "System", value: "system" },
              ]}
              placeholder="Actor"
              className="w-[150px]"
            />
          </div>

          {/* History List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : histories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No history found for this document</p>
              </div>
            ) : (
              <div className="space-y-4">
                {histories.map((history, index) => (
                  <Card
                    key={history._id}
                    className="border-l-4 border-l-blue-500"
                    padding="p-6"
                  >
                    <div className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getChangeTypeIcon(history.changeType)}
                          <div>
                            <h3 className="text-lg font-semibold">
                              {history.changeType === "upload" &&
                                "Document Uploaded"}
                              {history.changeType === "date_update" &&
                                "Dates Updated"}
                              {history.changeType === "approval" &&
                                "Document Approved"}
                              {history.changeType === "rejection" &&
                                "Document Rejected"}
                              {history.changeType === "status_change" &&
                                "Status Changed"}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {format(
                                new Date(history.createdAt),
                                "MMM dd, yyyy HH:mm"
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge
                            className={getChangeTypeBadgeColor(
                              history.changeType
                            )}
                          >
                            {history.changeType.replace("_", " ")}
                          </Badge>
                          <Badge
                            className={getStatusBadgeColor(history.status)}
                          >
                            {history.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div>
                      {/* Submission & Approval Info */}
                      {(() => {
                        const info = getSubmissionAndApprovalInfo(
                          history,
                          histories,
                          currentStatus
                        );
                        return (
                          <div className="mb-4">
                            <h4 className="font-medium text-gray-900 mb-3">
                              Document Information
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Document Name
                                </label>
                                <p className="text-gray-900 font-medium break-all">
                                  {info.documentName}
                                </p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Submitted By
                                </label>
                                <p className="text-gray-900 font-medium">
                                  {info.submittedBy}
                                </p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Submitted On
                                </label>
                                <p className="text-gray-900 font-medium">
                                  {info.submittedOn
                                    ? format(
                                        new Date(info.submittedOn),
                                        "MMM dd, yyyy HH:mm"
                                      )
                                    : "N/A"}
                                </p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Approved By
                                </label>
                                <p className="text-gray-900 font-medium">
                                  {info.approvedBy}
                                </p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Approved On
                                </label>
                                <p className="text-gray-900 font-medium">
                                  {info.approvedOn
                                    ? format(
                                        new Date(info.approvedOn),
                                        "MMM dd, yyyy HH:mm"
                                      )
                                    : info.approvedBy === "Pending"
                                      ? "Pending"
                                      : "N/A"}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="border-t my-4"></div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            Actor Details
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <UserIcon className="h-4 w-4" />
                            <span>{history.actorName}</span>
                            <span className="text-gray-400">
                              ({history.actorType})
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {history.actorEmail}
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900 mb-2">
                            File Details
                          </h4>
                          <div className="text-sm text-gray-600">
                            <p className="truncate">{history.fileName}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(history.fileSize)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {(history.issuingDate ||
                        history.expiryDate ||
                        history.previousIssuingDate ||
                        history.previousExpiryDate) && (
                        <>
                          <div className="border-t my-4"></div>
                          <div>
                            <h4 className="font-medium text-gray-900 mb-2">
                              Date Information
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                              {history.previousIssuingDate && (
                                <div>
                                  <p className="text-gray-600">
                                    Previous Issue Date:
                                  </p>
                                  <p className="font-medium">
                                    {format(
                                      new Date(history.previousIssuingDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </p>
                                </div>
                              )}
                              {history.issuingDate && (
                                <div>
                                  <p className="text-gray-600">
                                    Current Issue Date:
                                  </p>
                                  <p className="font-medium">
                                    {format(
                                      new Date(history.issuingDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </p>
                                </div>
                              )}
                              {history.previousExpiryDate && (
                                <div>
                                  <p className="text-gray-600">
                                    Previous Expiry Date:
                                  </p>
                                  <p className="font-medium">
                                    {format(
                                      new Date(history.previousExpiryDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </p>
                                </div>
                              )}
                              {history.expiryDate && (
                                <div>
                                  <p className="text-gray-600">
                                    Current Expiry Date:
                                  </p>
                                  <p className="font-medium">
                                    {format(
                                      new Date(history.expiryDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="border-t bg-gray-50 px-4 py-3">
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage - 1)}
                  disabled={!pagination.hasPrevPage}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {pagination.currentPage} of {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.currentPage + 1)}
                  disabled={!pagination.hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentHistoryModal;
