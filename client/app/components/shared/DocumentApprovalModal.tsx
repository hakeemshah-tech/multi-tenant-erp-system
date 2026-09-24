import React, { useState, useCallback } from "react";
import { DocumentStatus } from "../../services/documentStatus.service";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import axiosInstance from "../../lib/axios";

interface DocumentApprovalModalProps {
  documentStatus: DocumentStatus;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (doc: DocumentStatus) => Promise<void>;
  onReject: (doc: DocumentStatus, rejectionReason: string) => Promise<void>;
}

// Hook to fetch signed URL for document viewing
const useSignedDocumentUrl = (fileId?: string) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSignedUrl = useCallback(async () => {
    if (!fileId) {
      setUrl(null);
      return null;
    }

    try {
      setLoading(true);
      // Ensure fileId is a string (convert ObjectId to string if needed)
      const fileIdString = String(fileId);
      const { data } = await axiosInstance.get<{
        url: string;
        expiresIn: number;
      }>(`/uploads/${fileIdString}/url`);
      const signedUrl = data?.url || null;
      setUrl(signedUrl);
      return signedUrl;
    } catch (error) {
      console.error("Failed to get signed URL:", error);
      setUrl(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [fileId]);

  return { url, loading, refresh: fetchSignedUrl };
};

export const DocumentApprovalModal: React.FC<DocumentApprovalModalProps> = ({
  documentStatus,
  isOpen,
  onClose,
  onApprove,
  onReject,
}) => {
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Get signed URL for document viewing
  const { loading: urlLoading, refresh: refreshUrl } = useSignedDocumentUrl(
    documentStatus.fileId
  );

  const handleApprove = async () => {
    try {
      setActionLoading(true);
      await onApprove(documentStatus);
      onClose();
    } catch (error) {
      console.error("Error approving document:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    try {
      setActionLoading(true);
      await onReject(documentStatus, rejectionReason);
      onClose();
    } catch (error) {
      console.error("Error rejecting document:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = () => {
    setRejectionReason("");
    setShowRejectForm(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Document Review</h2>
                <p className="text-blue-100 text-sm">
                  Review and approve employee documents
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-xl p-2 transition-all duration-200"
              disabled={actionLoading}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(95vh-120px)]">
          {/* Document Info Card */}
          <div className="mb-8">
            <div className="rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Document Details
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Document Type
                  </label>
                  <p className="text-base text-slate-900 font-medium capitalize">
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
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Current Status
                  </label>
                  <div className="flex justify-start">
                    <DocumentStatusBadge status={documentStatus.status} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dates and File Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Dates Card */}
            {(documentStatus.issuingDate || documentStatus.expiryDate) && (
              <div className="rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Important Dates
                  </h3>
                </div>

                <div className="space-y-3">
                  {documentStatus.issuingDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Issue Date
                      </label>
                      <p className="text-base text-gray-900 font-medium">
                        {new Date(
                          documentStatus.issuingDate
                        ).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}

                  {documentStatus.expiryDate && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        Expiry Date
                      </label>
                      <p className="text-base text-gray-900 font-medium">
                        {new Date(documentStatus.expiryDate).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </p>
                    </div>
                  )}

                  {documentStatus.fieldKey === "passport" &&
                    documentStatus.countryOfIssue && (
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">
                          Country of Issue
                        </label>
                        <p className="text-base text-gray-900 font-medium">
                          {documentStatus.countryOfIssue}
                        </p>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* File Info Card */}
            {(documentStatus.metadata?.originalFileName ||
              documentStatus.metadata?.fileSize) && (
              <div className="rounded-2xl p-6 border border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    File Information
                  </h3>
                </div>

                <div className="space-y-3">
                  {documentStatus.metadata?.originalFileName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        File Name
                      </label>
                      <p className="text-sm text-gray-700 break-all">
                        {documentStatus.metadata.originalFileName}
                      </p>
                    </div>
                  )}

                  {documentStatus.metadata?.fileSize && (
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        File Size
                      </label>
                      <p className="text-sm text-gray-700">
                        {(
                          documentStatus.metadata.fileSize /
                          1024 /
                          1024
                        ).toFixed(2)}{" "}
                        MB
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rejection Reason Alert - Show when document is rejected OR when it's a resubmission after rejection */}
          {documentStatus.rejectionReason &&
            (documentStatus.status === "rejected" ||
              documentStatus.status === "pendingToApprove") && (
              <div className="mb-8">
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-red-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-red-800">
                      {documentStatus.status === "rejected"
                        ? "Rejection Reason"
                        : "Previous Rejection Reason"}
                    </h3>
                  </div>
                  <p className="text-red-700 bg-white rounded-lg px-4 py-3 border border-red-200">
                    {documentStatus.rejectionReason}
                  </p>
                </div>
              </div>
            )}

          {/* Document Preview/Download */}
          <div className="mb-8">
            <div className="rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Document Preview
                </h3>
              </div>

              <div className="rounded-xl p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {documentStatus.metadata?.originalFileName ||
                          `${documentStatus.fieldKey}.pdf`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {documentStatus.metadata?.mimeType || "application/pdf"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const url = await refreshUrl();
                      if (url) {
                        window.open(url, "_blank");
                      }
                    }}
                    disabled={urlLoading}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {urlLoading ? (
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Loading...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                        View Document
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {documentStatus.status === "pendingToApprove" && (
            <div className="rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Review Actions
                </h3>
              </div>

              {!showRejectForm ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={actionLoading}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-4 rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
                  >
                    {actionLoading ? (
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-5 h-5 animate-spin"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        Approving...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Approve
                      </div>
                    )}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl p-6 border border-gray-200">
                    <label className="block text-lg font-semibold text-gray-800 mb-4">
                      Rejection Reason *
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Please provide a detailed reason for rejecting this document..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none transition-all duration-200"
                      rows={4}
                      disabled={actionLoading}
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      This reason will be shared with the employee to help them
                      understand what needs to be corrected.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <button
                      onClick={handleReject}
                      disabled={actionLoading || !rejectionReason.trim()}
                      className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3"
                    >
                      {actionLoading ? (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-5 h-5 animate-spin"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          Rejecting...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                          Confirm Rejection
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => setShowRejectForm(false)}
                      disabled={actionLoading}
                      className="px-6 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {documentStatus.status !== "pendingToApprove" && (
            <div className="rounded-2xl p-8 border border-gray-200 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-slate-800">
                  Document Already{" "}
                  {documentStatus.status === "approved"
                    ? "Approved"
                    : documentStatus.status === "rejected"
                      ? "Rejected"
                      : "Processed"}
                </h3>
              </div>

              <p className="text-slate-600 mb-4">
                This document has already been {documentStatus.status}.
              </p>

              {documentStatus.reviewedBy && (
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span className="font-medium">
                      Reviewed by {documentStatus.reviewedBy.firstName}{" "}
                      {documentStatus.reviewedBy.lastName}
                    </span>
                    {documentStatus.reviewedAt && (
                      <span className="text-slate-500">
                        on{" "}
                        {new Date(documentStatus.reviewedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          }
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
