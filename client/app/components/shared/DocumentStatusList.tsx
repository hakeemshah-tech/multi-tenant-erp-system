import React, { useState, useMemo } from "react";
import { useDocumentStatus } from "../../hooks/useDocumentStatus";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { DocumentApprovalModal } from "./DocumentApprovalModal";
import DocumentHistoryModal from "./DocumentHistoryModal";
import { Card } from "../ui/Card";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

interface DocumentStatusListProps {
  employeeId: string;
  isEmployer?: boolean;
  onDocumentStatusChange?: () => void; // Add callback for when document status changes
}

export const DocumentStatusList: React.FC<DocumentStatusListProps> = ({
  employeeId,
  isEmployer = false,
  onDocumentStatusChange,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedDocumentForHistory, setSelectedDocumentForHistory] =
    useState<any>(null);

  // Memoize the params to prevent infinite re-renders
  const params = useMemo(
    () => ({
      employeeId,
      limit: 50,
    }),
    [employeeId]
  );

  const { documentStatuses, loading, error, updateDocumentStatus } =
    useDocumentStatus(params);

  // Filter to only show pending documents
  const pendingDocuments = useMemo(() => {
    return documentStatuses.filter((doc) => doc.status === "pendingToApprove");
  }, [documentStatuses]);

  const handleApprove = async (doc: any) => {
    await updateDocumentStatus(
      doc.employeeId,
      doc.sectionKey,
      doc.fieldKey,
      "approved",
      undefined,
      doc.innerSectionKey
    );
    // Call the callback to notify parent component
    onDocumentStatusChange?.();
  };

  const handleReject = async (doc: any, rejectionReason: string) => {
    await updateDocumentStatus(
      doc.employeeId,
      doc.sectionKey,
      doc.fieldKey,
      "rejected",
      rejectionReason,
      doc.innerSectionKey
    );
    // Call the callback to notify parent component
    onDocumentStatusChange?.();
  };

  const handleViewDocument = (documentStatus: any) => {
    setSelectedDocument(documentStatus);
    setIsModalOpen(true);
  };

  const handleViewHistory = (documentStatus: any) => {
    setSelectedDocumentForHistory(documentStatus);
    setHistoryModalOpen(true);
  };

  const pendingCount = pendingDocuments.length;

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading document statuses...
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  if (documentStatuses.length === 0) {
    // return (
    //   <div className="p-4 text-center text-gray-500">
    //     No documents found for this employee.
    //   </div>
    // );
    return null;
  }

  // Hide the entire accordion if there are no pending documents
  if (pendingCount === 0) {
    return null;
  }

  return (
    <Card className="p-6 shadow-sm border rounded-xl">
      <div className="border border-gray-200 rounded-lg">
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Document Status
            </h3>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                  {pendingCount} Pending
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {pendingCount} pending documents
            </span>
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Content */}
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isExpanded ? "max-h-screen" : "max-h-0"
          }`}
        >
          <div className="max-h-80 overflow-y-auto border-t border-gray-200">
            <div className="p-4 space-y-3">
              {pendingDocuments.map((documentStatus, index) => (
                <div
                  key={
                    documentStatus._id ||
                    `${documentStatus.employeeId}-${documentStatus.sectionKey}-${documentStatus.fieldKey}-${index}`
                  }
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900 capitalize">
                        {documentStatus.innerSectionKey
                          ? `${documentStatus.innerSectionKey
                              .replace(/([A-Z])/g, " $1")
                              .trim()} - ${documentStatus.fieldKey
                              .replace(/([A-Z])/g, " $1")
                              .trim()}`
                          : `${documentStatus.sectionKey
                              .replace(/([A-Z])/g, " $1")
                              .trim()} - ${documentStatus.fieldKey
                              .replace(/([A-Z])/g, " $1")
                              .trim()}`}
                      </h4>
                      <DocumentStatusBadge status={documentStatus.status} />
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="capitalize">
                        {documentStatus.sectionKey
                          .replace(/([A-Z])/g, " $1")
                          .trim()}
                      </span>
                      {" > "}
                      <span className="capitalize">
                        {documentStatus.fieldKey
                          .replace(/([A-Z])/g, " $1")
                          .trim()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Uploaded by{" "}
                      {documentStatus.uploadedBy?.firstName &&
                      documentStatus.uploadedBy?.lastName
                        ? `${documentStatus.uploadedBy.firstName} ${documentStatus.uploadedBy.lastName}`
                        : documentStatus.uploadedBy?.email || "Unknown User"}
                      {" • "}
                      {new Date(documentStatus.createdAt).toLocaleDateString()}
                    </div>
                    {documentStatus.rejectionReason &&
                      (documentStatus.status === "rejected" ||
                        documentStatus.status === "pendingToApprove") && (
                        <div className="text-xs text-red-600 mt-1 bg-red-50 p-2 rounded">
                          <strong>
                            {documentStatus.status === "rejected"
                              ? "Rejection Reason:"
                              : "Previous Rejection Reason:"}
                          </strong>{" "}
                          {documentStatus.rejectionReason}
                        </div>
                      )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDocument(documentStatus)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="View Document Details"
                    >
                      <EyeIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleViewHistory(documentStatus)}
                      className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                      title="View Document History"
                    >
                      <ClockIcon className="h-4 w-4" />
                    </button>
                    {isEmployer &&
                      documentStatus.status === "pendingToApprove" && (
                        <button
                          onClick={() => handleViewDocument(documentStatus)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                        >
                          Review
                        </button>
                      )}
                  </div>
                </div>
              ))}
              {pendingDocuments.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No pending documents to review</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Approval Modal */}
      {selectedDocument && (
        <DocumentApprovalModal
          documentStatus={selectedDocument}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedDocument(null);
          }}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Document History Modal */}
      {selectedDocumentForHistory && (
        <DocumentHistoryModal
          isOpen={historyModalOpen}
          onClose={() => {
            setHistoryModalOpen(false);
            setSelectedDocumentForHistory(null);
          }}
          documentId={selectedDocumentForHistory.fileId}
          documentName={`${selectedDocumentForHistory.fieldKey
            .replace(/([A-Z])/g, " $1")
            .trim()}`}
          employeeName={
            selectedDocumentForHistory.uploadedBy?.firstName &&
            selectedDocumentForHistory.uploadedBy?.lastName
              ? `${selectedDocumentForHistory.uploadedBy.firstName} ${selectedDocumentForHistory.uploadedBy.lastName}`
              : selectedDocumentForHistory.uploadedBy?.email || "Unknown User"
          }
        />
      )}
    </Card>
  );
};
