"use client";

import { useEffect, useState } from "react";
import { Button, Badge, Text, Title } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import { getProfileOrAdditionalValue } from "@/app/utils/employee-field-helpers";
import { EmployeePhoto } from "@/app/components/shared/EmployeePhoto";
import ContractTemplatePreviewModal from "@/app/components/shared/ContractTemplatePreviewModal";
import SignModal from "@/app/components/shared/SignModal";
import DownloadPdfButton from "@/app/components/shared/DownloadPdfButton";
import TamperCheckModal from "@/app/components/shared/TamperCheckModal";
import { contractTemplatesService } from "@/app/services/contractTemplates.service";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  X,
  Clock,
  FileText,
  Calendar,
  Loader2,
  Eye,
  PenTool,
  Download,
  Shield,
} from "lucide-react";
import { useAppSelector } from "@/app/store/hook";

interface ContractTemplate {
  _id: string;
  title?: string;
  description?: string;
  version?: string;
  builder?: any;
}

interface Employee {
  _id: string;
  employeeFields?: {
    personaldetails?: {
      firstname?: string;
      middlename?: string;
      lastname?: string;
      employeephoto?: string;
    };
    userId?: {
      email?: string;
    };
  };
  employeeProfile?: {
    userId?: {
      email?: string;
    };
    personaldetails?: {
      employeephoto?: {
        url?: string;
      };
    };
  };
}

interface EmployeeContractApproval {
  _id: string;
  templateId: string | ContractTemplate;
  applicantId: string | Employee | null;
  employeeId?: string; // The employeeId this approval is for
  employeeApprovals?: any[]; // Full approval document may have array of all employee approvals
  status: "pending" | "approved" | "rejected";
  overallStatus?: "pending" | "approved" | "rejected" | "partial"; // Full approval overall status
  applicantStatus?: "pending" | "accepted" | "rejected"; // Applicant's response status
  requireSignature: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  signatureData?: string;
  applicantSignatureData?: string; // Applicant's signature
  applicantSignedAt?: string; // When applicant signed
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Sender/Employer signature fields
  senderSignatureData?: string;
  senderSignedAt?: string;
  employerSignatureData?: string;
  employerSignedAt?: string;
  fullEmployeeApprovals?: any[]; // Full list of approvers for preview
}

export default function MyContractApprovalsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [approvals, setApprovals] = useState<EmployeeContractApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");

  // View Contract Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ContractTemplate | null>(null);
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(
    null
  );
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(
    null
  );
  const [selectedApprovalForPreview, setSelectedApprovalForPreview] =
    useState<EmployeeContractApproval | null>(null);

  // Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [signingApproval, setSigningApproval] =
    useState<EmployeeContractApproval | null>(null);

  // Tamper Check Modal State
  const [showTamperModal, setShowTamperModal] = useState(false);
  const [tamperCheckApprovalId, setTamperCheckApprovalId] = useState<
    string | null
  >(null);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      console.log("[MY CONTRACT APPROVALS] Fetching approvals from API...");
      const res = await axiosInstance.get(
        "/contract-templates/approvals/my-approvals"
      );
      console.log(
        "[MY CONTRACT APPROVALS] API Response:",
        res.status,
        res.data
      );

      let allApprovals = res.data.data || [];
      console.log(
        "[MY CONTRACT APPROVALS] Raw approvals count:",
        allApprovals.length
      );

      // Apply status filter
      if (statusFilter !== "all") {
        allApprovals = allApprovals.filter(
          (approval: EmployeeContractApproval) =>
            approval.status === statusFilter
        );
      }

      console.log(
        "[MY CONTRACT APPROVALS] Filtered approvals count:",
        allApprovals.length
      );
      setApprovals(allApprovals);
    } catch (err: any) {
      console.error("[MY CONTRACT APPROVALS] Error fetching approvals:", err);
      console.error(
        "[MY CONTRACT APPROVALS] Error response:",
        err?.response?.data
      );
      toast.error(
        err?.response?.data?.message || "Failed to fetch contract approvals"
      );
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]);

  const handleApproveReject = async (
    approval: EmployeeContractApproval,
    status: "approved" | "rejected"
  ) => {
    setProcessingId(approval._id);

    try {
      // Use the unique approval _id to identify the specific contract approval document
      const approvalId = approval._id;

      // Get employeeId from the approval data (this is the employeeId this approval is for)
      const employeeId = approval.employeeId;

      if (!approvalId) {
        toast.error("Approval ID not found");
        return;
      }

      if (!employeeId) {
        toast.error("Employee ID not found in approval data");
        return;
      }

      // Use the new route that accepts approval _id directly for reliable identification
      const response = await axiosInstance.put(
        `/contract-templates/approvals/${approvalId}/employee/${employeeId}`,
        {
          status,
          respondedAt: new Date().toISOString(),
        }
      );

      if (response.data) {
        toast.success(
          `Contract ${status === "approved" ? "approved" : "rejected"} successfully`
        );
        // Refresh the approvals list
        await fetchApprovals();
      }
    } catch (err: any) {
      console.error("Failed to update approval", err);
      toast.error(
        err?.response?.data?.message || `Failed to ${status} contract`
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Handle Sign button click
  const handleSignClick = (approval: EmployeeContractApproval) => {
    setSigningApproval(approval);
    setShowSignModal(true);
  };

  // Handle sign submission
  const handleSignSubmit = async (signatureData: string) => {
    if (!signingApproval) return;

    setProcessingId(signingApproval._id);

    try {
      const approvalId = signingApproval._id;
      const employeeId = signingApproval.employeeId;

      if (!approvalId || !employeeId) {
        toast.error("Missing approval data");
        return;
      }

      const response = await axiosInstance.put(
        `/contract-templates/approvals/${approvalId}/employee/${employeeId}`,
        {
          status: "approved",
          signatureData: signatureData,
          respondedAt: new Date().toISOString(),
        }
      );

      if (response.data) {
        toast.success("Contract signed successfully");
        await fetchApprovals();
      }
    } catch (err: any) {
      console.error("Failed to sign contract", err);
      toast.error(err?.response?.data?.message || "Failed to sign contract");
    } finally {
      setProcessingId(null);
      setSigningApproval(null);
      setShowSignModal(false);
    }
  };

  // Handle View Contract - fetch template and FULL approval with all signatures, then show preview
  const handleViewContract = async (approval: EmployeeContractApproval) => {
    // Extract templateId from approval data
    const templateId =
      typeof approval.templateId === "object" &&
      approval.templateId !== null &&
      approval.templateId._id
        ? approval.templateId._id
        : String(approval.templateId);

    // Extract applicantId from approval data
    const applicantId =
      typeof approval.applicantId === "object" &&
      approval.applicantId !== null &&
      (approval.applicantId as any)._id
        ? (approval.applicantId as any)._id
        : String(approval.applicantId);

    if (!templateId) {
      toast.error("Template ID not found");
      return;
    }

    if (!applicantId) {
      toast.error("Applicant ID not found");
      return;
    }

    setLoadingTemplateId(approval._id);
    try {
      // Try to fetch snapshot first (contains finalized template + data)
      // We try for all approvals and check if snapshot exists - this handles cases where
      // the applicant has already signed and a snapshot was created
      if (approval._id) {
        try {
          console.log(
            "[VIEW CONTRACT] Attempting to fetch snapshot for approval:",
            approval._id
          );
          console.log(
            "[VIEW CONTRACT] Approval applicantStatus:",
            approval.applicantStatus
          );

          // @ts-ignore - skipToast is a custom config option to suppress global error toast
          const snapshotResponse = await axiosInstance.get(
            `/contract-templates/approvals/${approval._id}/snapshot`,
            { skipToast: true } as any
          );
          if (snapshotResponse.data?.data) {
            const snapshot = snapshotResponse.data.data;
            console.log("[VIEW CONTRACT] Using snapshot data for contract");

            // Use snapshot data for template
            setSelectedTemplate({
              _id: snapshot.templateId,
              title: snapshot.templateSnapshot?.title || "",
              description: snapshot.templateSnapshot?.description,
              version: snapshot.templateSnapshot?.version,
              builder: snapshot.templateSnapshot?.builder,
            } as any);
            setSelectedApplicantId(applicantId);

            // Build full approval with snapshot data
            const snapshotApproval = {
              ...approval,
              applicantStatus: "accepted" as const, // Mark as accepted since snapshot exists
              employerSignatureData: snapshot.employerSignatureData,
              employerSignedAt: snapshot.employerSignedAt,
              employerName: snapshot.employerName,
              senderSignatureData: snapshot.senderSignatureData,
              senderSignedAt: snapshot.senderSignedAt,
              applicantSignatureData: snapshot.applicantSignatureData,
              applicantSignedAt: snapshot.applicantSignedAt,
              employeeApprovals: snapshot.employeeApprovals || [],
              _snapshotData: snapshot,
            };
            setSelectedApprovalForPreview(snapshotApproval);
            setShowPreview(true);
            return;
          }
        } catch (snapshotError) {
          console.log(
            "[VIEW CONTRACT] No snapshot found (contract not yet finalized), falling back to template fetch"
          );
        }
      }

      // Fallback: Fetch the full template with builder (for pending contracts or if snapshot not found)
      const template = await contractTemplatesService.get(templateId);

      // Verify template has builder
      if (!template || !template.builder) {
        toast.error("Contract template is missing required data");
        return;
      }

      // Fetch the FULL approval document with all employee signatures
      let fullApproval = approval as any;
      try {
        const approvalResponse = await axiosInstance.get(
          `/contract-templates/approvals/${approval._id}`
        );
        if (approvalResponse.data?.data) {
          fullApproval = approvalResponse.data.data;
          console.log(
            "[VIEW CONTRACT] Fetched full approval with employeeApprovals:",
            fullApproval.employeeApprovals?.length || 0
          );
        }
      } catch (approvalError) {
        console.log(
          "[VIEW CONTRACT] Could not fetch full approval, using original data"
        );
      }

      setSelectedTemplate(template);
      setSelectedApplicantId(applicantId);
      setSelectedApprovalForPreview(fullApproval);
      setShowPreview(true);
    } catch (error: any) {
      console.error("Failed to fetch contract template", error);
      toast.error(
        error?.response?.data?.message || "Failed to load contract template"
      );
    } finally {
      setLoadingTemplateId(null);
    }
  };

  // Handle tamper check for a contract - opens TamperCheckModal which handles verification
  const handleTamperCheck = (approvalId: string) => {
    setTamperCheckApprovalId(approvalId);
    setShowTamperModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            color="warning"
            className="bg-amber-100 text-amber-800 border border-amber-200"
          >
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            color="success"
            className="bg-green-100 text-green-800 border border-green-200"
          >
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            color="danger"
            className="bg-red-100 text-red-800 border border-red-200"
          >
            Rejected
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getEmployeeName = (employee: string | Employee | null) => {
    if (!employee) return "N/A";
    if (typeof employee === "string") return "Loading...";
    const firstName =
      getProfileOrAdditionalValue(employee, "personaldetails", "firstname") ||
      "";
    const lastName =
      getProfileOrAdditionalValue(employee, "personaldetails", "lastname") ||
      "";
    return `${firstName} ${lastName}`.trim() || "N/A";
  };

  const getTemplateTitle = (template: string | ContractTemplate) => {
    if (typeof template === "string") return "Loading...";
    return template?.title || "N/A";
  };

  const pendingCount = approvals.filter((a) => a.status === "pending").length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "rejected").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Title className="text-2xl font-bold text-gray-900">
            My Contract Approvals
          </Title>
          <Text className="text-sm text-gray-500 mt-1">
            View and manage contracts awaiting your approval
          </Text>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm text-gray-500">Total</Text>
              <Text className="text-2xl font-bold text-gray-900">
                {approvals.length}
              </Text>
            </div>
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm text-amber-600">Pending</Text>
              <Text className="text-2xl font-bold text-amber-700">
                {pendingCount}
              </Text>
            </div>
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-green-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm text-green-600">Approved</Text>
              <Text className="text-2xl font-bold text-green-700">
                {approvedCount}
              </Text>
            </div>
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <Text className="text-sm text-red-600">Rejected</Text>
              <Text className="text-2xl font-bold text-red-700">
                {rejectedCount}
              </Text>
            </div>
            <X className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Text className="text-sm font-medium">Filter by Status:</Text>
        <Button
          size="sm"
          variant={statusFilter === "all" ? "solid" : "outline"}
          onClick={() => setStatusFilter("all")}
        >
          All
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "pending" ? "solid" : "outline"}
          onClick={() => setStatusFilter("pending")}
        >
          Pending
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "approved" ? "solid" : "outline"}
          onClick={() => setStatusFilter("approved")}
        >
          Approved
        </Button>
        <Button
          size="sm"
          variant={statusFilter === "rejected" ? "solid" : "outline"}
          onClick={() => setStatusFilter("rejected")}
        >
          Rejected
        </Button>
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center rounded-lg border border-gray-200 bg-white">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            <Text className="text-gray-500 mt-2">
              Loading contract approvals...
            </Text>
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center space-y-2 rounded-lg border border-gray-200 bg-white">
            <FileText className="w-12 h-12 text-gray-300 mx-auto" />
            <Text className="text-gray-500 block">
              {statusFilter !== "all"
                ? `No ${statusFilter} contract approvals found`
                : "No contract approvals found. Contract approvals will appear here when contracts are sent for your approval."}
            </Text>
          </div>
        ) : (
          approvals.map((approval) => {
            const template =
              typeof approval.templateId === "object" &&
              approval.templateId !== null
                ? approval.templateId
                : null;
            const applicant =
              typeof approval.applicantId === "object" &&
              approval.applicantId !== null
                ? approval.applicantId
                : null;
            const isProcessing = processingId === approval._id;

            return (
              <div
                key={approval._id}
                className="rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left Section: Template & Applicant Info */}
                    <div className="flex-1 space-y-4">
                      {/* Template Info */}
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <Text className="font-semibold text-lg text-gray-900">
                            {getTemplateTitle(approval.templateId)}
                          </Text>
                          {template?.version && (
                            <Text className="text-sm text-gray-500 mt-1">
                              Version: {template.version}
                            </Text>
                          )}
                        </div>
                      </div>

                      {/* Applicant Info */}
                      <div className="flex items-center gap-3 pl-11">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="font-medium">Applicant:</span>
                          <div className="flex items-center gap-2">
                            <EmployeePhoto employee={applicant} size={24} />
                            <span className="font-medium text-gray-900">
                              {getEmployeeName(approval.applicantId)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status & Signature Info */}
                      <div className="flex items-center gap-4 pl-11 flex-wrap">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(approval.status)}
                        </div>
                        {approval.requireSignature && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <FileText className="w-4 h-4" />
                            <span>
                              Signature Required (
                              {approval.signatureType || "N/A"})
                            </span>
                          </div>
                        )}
                        {approval.respondedAt && (
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Calendar className="w-4 h-4" />
                            <span>
                              Responded:{" "}
                              {new Date(
                                approval.respondedAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Sent:{" "}
                            {approval.createdAt
                              ? new Date(
                                  approval.createdAt
                                ).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right Section: Action Buttons */}
                    <div className="flex flex-col items-end gap-3">
                      {/* View Contract Button - Always visible */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewContract(approval)}
                        disabled={loadingTemplateId === approval._id}
                        className="flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        {loadingTemplateId === approval._id
                          ? "Loading..."
                          : "View Contract"}
                      </Button>

                      {/* Action Buttons - Only visible when pending */}
                      {approval.status === "pending" && (
                        <div className="flex items-center gap-2">
                          {/* Sign Button (if signature required) */}
                          {approval.requireSignature && (
                            <Button
                              size="sm"
                              onClick={() => handleSignClick(approval)}
                              disabled={isProcessing}
                              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <PenTool className="h-4 w-4 mr-1" />
                                  Sign
                                </>
                              )}
                            </Button>
                          )}

                          {/* Approve Button (only if signature NOT required) */}
                          {!approval.requireSignature && (
                            <Button
                              size="sm"
                              onClick={() =>
                                handleApproveReject(approval, "approved")
                              }
                              disabled={isProcessing}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {isProcessing ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          )}

                          {/* Reject Button (Always visible when pending) */}
                          <Button
                            size="sm"
                            onClick={() =>
                              handleApproveReject(approval, "rejected")
                            }
                            disabled={isProcessing}
                            className="bg-red-600 hover:bg-red-700 text-white"
                          >
                            {isProcessing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <X className="h-4 w-4 mr-1" />
                                Reject
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Contract Preview Modal */}
      {selectedTemplate && selectedTemplate.builder && (
        <ContractTemplatePreviewModal
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
            setSelectedApplicantId(null);
            setSelectedApprovalForPreview(null);
          }}
          title={selectedTemplate.title || ""}
          description={selectedTemplate.description}
          version={selectedTemplate.version}
          builder={selectedTemplate.builder}
          initialEmployeeId={selectedApplicantId || undefined}
          templateId={selectedTemplate._id}
          readOnly={true}
          // Pass snapshot employee data for accepted contracts so preview shows finalized data
          snapshotEmployeeData={
            selectedApprovalForPreview?.applicantStatus === "accepted" &&
            (selectedApprovalForPreview as any)?._snapshotData
              ?.applicantSnapshot
              ? (selectedApprovalForPreview as any)._snapshotData
                  .applicantSnapshot
              : selectedApprovalForPreview?.applicantStatus === "accepted" &&
                  selectedApprovalForPreview?.applicantId
                ? typeof selectedApprovalForPreview.applicantId === "object"
                  ? selectedApprovalForPreview.applicantId
                  : undefined
                : undefined
          }
          initialApprovals={(() => {
            if (!selectedApprovalForPreview) return undefined;

            const approvals: any[] = [];

            // Add employer signature (legacy self-sign)
            if (selectedApprovalForPreview.employerSignatureData) {
              approvals.push({
                employeeId: "employer",
                signatureData: selectedApprovalForPreview.employerSignatureData,
                respondedAt: selectedApprovalForPreview.employerSignedAt,
                status: "approved",
                employeeName: "Employer",
                isEmployerSignature: true,
              });
            }

            // Add sender signature (new self-sign)
            if (selectedApprovalForPreview.senderSignatureData) {
              approvals.push({
                employeeId: "sender",
                signatureData: selectedApprovalForPreview.senderSignatureData,
                respondedAt: selectedApprovalForPreview.senderSignedAt,
                status: "approved",
                employeeName: "Employer",
                isEmployerSignature: true,
              });
            }

            // Add employee approvals (approver signatures)
            // Process employeeApprovals to extract name and designation from populated employeeId
            if (
              selectedApprovalForPreview.fullEmployeeApprovals &&
              selectedApprovalForPreview.fullEmployeeApprovals.length > 0
            ) {
              approvals.push(
                ...selectedApprovalForPreview.fullEmployeeApprovals
              );
            } else if (
              selectedApprovalForPreview.employeeApprovals &&
              selectedApprovalForPreview.employeeApprovals.length > 0
            ) {
              const processedApprovals =
                selectedApprovalForPreview.employeeApprovals.map((ea: any) => {
                  // If employeeName/designation already exist as direct properties, use them
                  let employeeName = ea.employeeName || "";
                  let designation = ea.designation || "";

                  console.log("[DEBUG FRONTEND] Processing item:", {
                    id: ea.employeeId?._id || ea.employeeId,
                    hasName: !!employeeName,
                    hasDesig: !!designation,
                    empIsObject: typeof ea.employeeId === "object",
                    empDesig: ea.employeeId?.designation,
                  });

                  // Otherwise, extract from populated employeeId object
                  if (
                    !employeeName &&
                    ea.employeeId &&
                    typeof ea.employeeId === "object" &&
                    ea.employeeId._id
                  ) {
                    const emp = ea.employeeId;
                    const firstName =
                      emp.employeeFields?.personaldetails?.firstname || "";
                    const lastName =
                      emp.employeeFields?.personaldetails?.lastname || "";
                    employeeName = `${firstName} ${lastName}`.trim();
                  }

                  if (
                    !designation &&
                    ea.employeeId &&
                    typeof ea.employeeId === "object" &&
                    ea.employeeId.designation
                  ) {
                    const desig = ea.employeeId.designation;
                    // designation could be an object with name or just a string/id
                    if (typeof desig === "object" && desig.name) {
                      designation = desig.name;
                    } else if (typeof desig === "string") {
                      designation = desig;
                    }
                  }

                  return {
                    ...ea,
                    employeeId: ea.employeeId?._id || ea.employeeId,
                    employeeName,
                    designation,
                  };
                });
              approvals.push(...processedApprovals);
            } else {
              approvals.push(selectedApprovalForPreview);
            }

            // Add applicant's signature if available (as synthetic entry)
            if (selectedApprovalForPreview.applicantSignatureData) {
              const applicantId =
                typeof selectedApprovalForPreview.applicantId === "object"
                  ? (selectedApprovalForPreview.applicantId as any)?._id
                  : selectedApprovalForPreview.applicantId;

              approvals.push({
                signatureData:
                  selectedApprovalForPreview.applicantSignatureData,
                employeeId: applicantId,
                isApplicantSignature: true,
                respondedAt: selectedApprovalForPreview.applicantSignedAt,
              });
            }

            return approvals;
          })()}
          // PDF and Tamper Check props
          approvalId={selectedApprovalForPreview?._id}
          applicantStatus={selectedApprovalForPreview?.applicantStatus}
        />
      )}

      {/* Sign Modal */}
      <SignModal
        isOpen={showSignModal}
        onClose={() => {
          setShowSignModal(false);
          setSigningApproval(null);
        }}
        onSign={handleSignSubmit}
        userName={
          signingApproval?.applicantId &&
          typeof signingApproval.applicantId === "object"
            ? getProfileOrAdditionalValue(
                signingApproval.applicantId,
                "personaldetails",
                "firstname"
              ) || "Employee"
            : "Employee"
        }
      />

      {/* Tamper Check Modal */}
      {tamperCheckApprovalId && (
        <TamperCheckModal
          isOpen={showTamperModal}
          onClose={() => {
            setShowTamperModal(false);
            setTamperCheckApprovalId(null);
          }}
          approvalId={tamperCheckApprovalId}
        />
      )}
    </div>
  );
}
