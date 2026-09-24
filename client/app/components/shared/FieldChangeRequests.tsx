"use client";

import React, { useState, useEffect } from "react";
import {
  CheckIcon,
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import { Button } from "rizzui";
import toast from "react-hot-toast";
import { Card } from "../ui/Card";
import {
  getFieldChangeRequests,
  approveRejectFieldChangeRequest,
  FieldChangeRequest,
} from "@/app/services/fieldChangeRequest.service";

interface FieldChangeRequestsProps {
  employeeId: string;
  onRequestProcessed?: () => void;
}

export function FieldChangeRequests({
  employeeId,
  onRequestProcessed,
}: FieldChangeRequestsProps) {
  const [requests, setRequests] = useState<FieldChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null
  );
  const [isExpanded, setIsExpanded] = useState(true); // Accordion state

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await getFieldChangeRequests({
        employeeId,
        status: "pending",
      });
      setRequests(response.data || []);
    } catch (error) {
      console.error("Error fetching field change requests:", error);
      toast.error("Failed to load change requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [employeeId]);

  const handleApprove = async (requestId: string) => {
    try {
      setProcessing(requestId);
      await approveRejectFieldChangeRequest({
        requestId,
        status: "approved",
      });

      toast.success("Change request approved");
      await fetchRequests();
      onRequestProcessed?.();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Failed to approve request");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    try {
      setProcessing(requestId);
      await approveRejectFieldChangeRequest({
        requestId,
        status: "rejected",
        rejectionReason: rejectReason,
      });

      toast.success("Change request rejected");
      setRejectReason("");
      setRejectingRequestId(null);
      await fetchRequests();
      onRequestProcessed?.();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject request");
    } finally {
      setProcessing(null);
    }
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  };

  const formatFieldPath = (request: FieldChangeRequest) => {
    // Convert camelCase to readable format
    const formatKey = (key: string) => {
      return key
        .replace(/([A-Z])/g, " $1") // Add space before capital letters
        .replace(/^./, (str) => str.toUpperCase()) // Capitalize first letter
        .trim();
    };

    const sectionName = formatKey(request.sectionKey);
    const innerSectionName = request.innerSectionKey
      ? formatKey(request.innerSectionKey)
      : null;
    const fieldName = request.fieldLabel;

    // Debug logging
    console.log("🔍 DEBUG: Field path formatting:", {
      sectionKey: request.sectionKey,
      innerSectionKey: request.innerSectionKey,
      fieldLabel: request.fieldLabel,
      sectionName,
      innerSectionName,
      fieldName,
    });

    // Build the path string
    let path = sectionName;
    if (innerSectionName) {
      path += ` > ${innerSectionName}`;
    }
    path += ` > ${fieldName}`;

    return path;
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading change requests...
      </div>
    );
  }

  // Hide the entire component if there are no pending change requests
  if (requests.length === 0) {
    return null;
  }

  return (
    <Card className="p-6 shadow-sm border rounded-xl">
      <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
        {/* Accordion Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
        >
          <h3 className="text-lg font-semibold text-gray-800">
            Pending Change Requests ({requests.length})
          </h3>
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronUpIcon className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronDownIcon className="h-5 w-5 text-gray-500" />
            )}
          </div>
        </button>

        {/* Accordion Content */}
        <div
          className={`transition-all duration-300 ease-in-out overflow-hidden ${
            isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-4 pb-4 max-h-80 overflow-y-auto space-y-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="p-4 border border-gray-200 rounded-lg bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-800">
                          <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-gray-800 rounded-lg text-xs font-semibold border border-gray-200">
                            {formatFieldPath(request)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 mt-1 block">
                          Field Change Request
                        </span>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        {request.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">From:</span>
                        <span className="ml-2 font-medium">
                          {formatValue(request.oldValue)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">To:</span>
                        <span className="ml-2 font-medium text-blue-600">
                          {formatValue(request.newValue)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-gray-500">
                      Requested by: {request.requestedBy.fullName} •{" "}
                      {new Date(request.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {rejectingRequestId === request._id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Rejection reason..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(request._id)}
                          disabled={processing === request._id}
                        >
                          Submit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectingRequestId(null);
                            setRejectReason("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleApprove(request._id)}
                          disabled={processing === request._id}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50"
                          onClick={() => setRejectingRequestId(request._id)}
                          disabled={processing === request._id}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
