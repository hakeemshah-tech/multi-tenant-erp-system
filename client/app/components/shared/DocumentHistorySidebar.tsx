import React, { useState, useEffect, useCallback } from "react";
import { Button, Badge } from "rizzui";
import { Card } from "../ui/Card";
import {
  XMarkIcon,
  EyeIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowUpIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
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
  rejectionReason?: string;
  changeType:
    "upload" | "date_update" | "approval" | "rejection" | "status_change";
  actorId: string;
  actorType: "employee" | "employer" | "system";
  actorName: string;
  actorEmail: string;
  reviewedBy?: string | { firstName: string; lastName: string; email: string };
  reviewedAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface DocumentHistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string; // This is actually employeeId
  documentName: string;
  employeeName?: string;
  sectionKey: string;
  fieldKey: string;
  innerSectionKey?: string;
}

const DocumentHistorySidebar: React.FC<DocumentHistorySidebarProps> = ({
  isOpen,
  onClose,
  documentId,
  documentName,
  employeeName,
  sectionKey,
  fieldKey,
  innerSectionKey,
}) => {
  const [histories, setHistories] = useState<DocumentHistoryEntry[]>([]);
  const [currentStatus, setCurrentStatus] = useState<{
    status?: string;
    fileId?: string;
    reviewedBy?: { firstName: string; lastName: string; email: string };
    reviewedAt?: string;
    rejectionReason?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sectionKey,
        fieldKey,
        ...(innerSectionKey && { innerSectionKey }),
      });

      console.log(`🔍 [DEBUG] Frontend API call:`, {
        documentId,
        sectionKey,
        fieldKey,
        innerSectionKey,
        url: `/document-history/employee/${documentId}/${sectionKey}/${fieldKey}?${params}`,
      });

      const { data } = await axiosInstance.get(
        `/document-history/employee/${documentId}/${sectionKey}/${fieldKey}?${params}`
      );

      console.log(`🔍 [DEBUG] Frontend API response:`, {
        histories: data.histories?.length || 0,
        currentStatus: data.currentStatus,
      });

      setHistories(data.histories || []);
      setCurrentStatus(data.currentStatus || null);
    } catch (error) {
      console.error("Failed to fetch document history:", error);
    } finally {
      setLoading(false);
    }
  }, [documentId, sectionKey, fieldKey, innerSectionKey]);

  useEffect(() => {
    if (isOpen && documentId) {
      fetchHistory();
    }
  }, [isOpen, documentId, sectionKey, fieldKey, innerSectionKey, fetchHistory]);

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
      case "pendingToApprove":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
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

  const handleViewDocument = async (fileId: string) => {
    try {
      setViewingDocument(fileId);
      const fileIdString = String(fileId);
      const { data } = await axiosInstance.get(`/uploads/${fileIdString}/url`);

      if (data.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Failed to get document URL:", error);
    } finally {
      setViewingDocument(null);
    }
  };

  // Helper to find submission and approval info for a history entry
  const getSubmissionAndApprovalInfo = (
    history: DocumentHistoryEntry,
    allHistories: DocumentHistoryEntry[]
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

    const metadata = history.metadata as
      { originalFileName?: string } | undefined;
    const documentName =
      metadata?.originalFileName || history.fileName || "N/A";

    // Submitted By should ALWAYS be the original uploader from the upload entry
    const submittedBy = uploadEntry?.actorName || "N/A";
    const submittedOn = uploadEntry?.createdAt || null;

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
      if (
        typeof history.reviewedBy === "object" &&
        history.reviewedBy !== null
      ) {
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
      documentName,
      submittedBy,
      submittedOn,
      approvedBy,
      approvedOn,
    };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DocumentTextIcon className="h-5 w-5" />
              <div>
                <h2 className="text-lg font-semibold">Document History</h2>
                <p className="text-sm text-blue-100">
                  {documentName}
                  {employeeName && ` • ${employeeName}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchHistory}
                disabled={loading}
                className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg disabled:opacity-50"
                title="Refresh"
              >
                <ArrowUpIcon className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* History List - Only show document uploads, filtered out date updates */}
              {histories.filter((h) => h.changeType === "upload").length ===
              0 ? (
                <div className="text-center py-8 text-gray-500">
                  <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No document upload history found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {histories
                    .filter((h) => h.changeType === "upload")
                    .map((history) => (
                      <Card
                        key={history._id}
                        className="border-l-4 border-l-blue-500"
                        padding="p-4"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getChangeTypeIcon(history.changeType)}
                            <div>
                              <h3 className="font-medium text-gray-900">
                                Document Uploaded
                              </h3>
                              <p className="text-xs text-gray-500">
                                {format(
                                  new Date(history.createdAt),
                                  "MMM dd, yyyy HH:mm"
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={getStatusBadgeColor(history.status)}
                            size="sm"
                          >
                            {history.status}
                          </Badge>
                        </div>

                        {/* Submission & Approval Info */}
                        {(() => {
                          const info = getSubmissionAndApprovalInfo(
                            history,
                            histories
                          );
                          return (
                            <div className="mb-3 space-y-2 text-sm">
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Document Name
                                </label>
                                <p className="text-gray-900 font-medium break-all">
                                  {info.documentName}
                                </p>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
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

                        <div className="border-t pt-3 mt-3">
                          <div className="grid grid-cols-1 gap-3 text-sm">
                            {/* <div className="flex items-center gap-2 text-gray-600">
                              <UserIcon className="h-4 w-4" />
                              <span>{history.actorName}</span>
                              <span className="text-gray-400">
                                ({history.actorType})
                              </span>
                            </div> */}
                            <div className="text-gray-600">
                              <p className="truncate">{history.fileName}</p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(history.fileSize)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Document Dates */}
                        {(history.issuingDate || history.expiryDate) && (
                          <div className="border-t pt-3 mt-3">
                            <h4 className="font-medium text-gray-900 mb-2 text-xs">
                              Document Dates
                            </h4>
                            <div className="grid grid-cols-1 gap-2 text-xs">
                              {history.issuingDate && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Issue Date:
                                  </span>
                                  <span className="font-medium">
                                    {format(
                                      new Date(history.issuingDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </span>
                                </div>
                              )}
                              {history.expiryDate && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">
                                    Expiry Date:
                                  </span>
                                  <span className="font-medium text-red-600">
                                    {format(
                                      new Date(history.expiryDate),
                                      "MMM dd, yyyy"
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Rejection Reason */}
                        {history.status === "rejected" &&
                          history.rejectionReason && (
                            <div className="border-t pt-3 mt-3">
                              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex items-start gap-2">
                                  <XCircleIcon className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <h4 className="font-medium text-red-900 text-xs mb-1">
                                      Rejection Reason
                                    </h4>
                                    <p className="text-xs text-red-800">
                                      {history.rejectionReason}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                        {/* View Document Button */}
                        <div className="mt-3 pt-3 border-t">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full flex items-center gap-2"
                            onClick={() => handleViewDocument(history.fileId)}
                            isLoading={viewingDocument === history.fileId}
                          >
                            <EyeIcon className="h-4 w-4" />
                            View Document
                          </Button>
                        </div>
                      </Card>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentHistorySidebar;
