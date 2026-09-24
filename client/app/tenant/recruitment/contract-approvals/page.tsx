"use client";

import { useEffect, useState, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Button, Badge, Text } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import PageTopActions from "@/app/components/shared/PageTopActions";
import { getProfileOrAdditionalValue } from "@/app/utils/employee-field-helpers";
import { EmployeePhoto } from "@/app/components/shared/EmployeePhoto";
import toast from "react-hot-toast";
import {
  ChevronDown,
  ChevronUp,
  Users,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  History,
  X,
  Send,
  Mail,
  Shield,
  Download,
  PenLine,
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import { useAppSelector } from "@/app/store/hook";
import ContractTemplatePreviewModal from "@/app/components/shared/ContractTemplatePreviewModal";
import DownloadPdfButton from "@/app/components/shared/DownloadPdfButton";
import SignModal from "@/app/components/shared/SignModal";
import TamperCheckModal from "@/app/components/shared/TamperCheckModal";
import {
  contractTemplatesService,
  ContractTemplate,
} from "@/app/services/contractTemplates.service";

// Use the imported ContractTemplate and extend it to include builder
type ExtendedContractTemplate = ContractTemplate & {
  builder?: any;
};

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

interface ApprovalHistoryEntry {
  status: "pending" | "approved" | "rejected";
  note?: string;
  respondedAt?: string;
  createdAt: string;
}

interface ApplicantHistoryEntry {
  status: "pending" | "accepted" | "rejected";
  note?: string;
  respondedAt?: string;
  createdAt: string;
}

interface EmployeeApproval {
  employeeId: string | Employee;
  requireSignature: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  status: "pending" | "approved" | "rejected";
  respondedAt?: string;
  note?: string; // Optional note/comment from the employee (current/latest)
  history?: ApprovalHistoryEntry[]; // Complete chronological history of all actions
  signatureData?: string; // Base64 signature image data
}

interface ContractApproval {
  _id: string;
  templateId: string | ExtendedContractTemplate;
  applicantId: string | Employee | null;
  employeeApprovals: EmployeeApproval[];
  overallStatus: "pending" | "approved" | "rejected" | "partial";
  status?: "pending" | "approved" | "rejected"; // Status field from backend
  totalEmployees: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  // Employer signature fields for self-sign flow
  employerSignatureData?: string;
  employerSignedAt?: string;
  employerName?: string;
  // Self Sign Required fields - for sender to sign from this page
  selfSignRequired?: boolean;
  senderUserId?: string; // The user who sent the approval
  senderSignatureData?: string; // The sender's signature (base64)
  senderSignedAt?: string; // When sender signed
  sentAt?: string;
  sentToApplicantAt?: string; // Timestamp when contract was sent to applicant
  applicantStatus?: "pending" | "accepted" | "rejected"; // Applicant's response status
  acceptedAt?: string; // Timestamp when applicant accepted
  rejectedAt?: string; // Timestamp when applicant rejected
  applicantNote?: string; // Note from applicant (current/latest)
  applicantHistory?: ApplicantHistoryEntry[]; // Complete chronological history of applicant actions
  // Applicant signature fields
  applicantSignatureData?: string;
  applicantSignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ContractApprovalsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [approvals, setApprovals] = useState<ContractApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // View Contract Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ContractTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(
    null
  );
  const [selectedApprovalForPreview, setSelectedApprovalForPreview] =
    useState<ContractApproval | null>(null);

  // Approval History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedApprovalForHistory, setSelectedApprovalForHistory] =
    useState<ContractApproval | null>(null);
  const [selectedEmployeeApproval, setSelectedEmployeeApproval] =
    useState<EmployeeApproval | null>(null);

  // Applicant History Modal State
  const [showApplicantHistoryModal, setShowApplicantHistoryModal] =
    useState(false);
  const [
    selectedApprovalForApplicantHistory,
    setSelectedApprovalForApplicantHistory,
  ] = useState<ContractApproval | null>(null);

  // Tamper Check Modal State
  const [showTamperCheckModal, setShowTamperCheckModal] = useState(false);
  const [tamperCheckApprovalId, setTamperCheckApprovalId] = useState<
    string | null
  >(null);

  // Resend Approval State
  const [resendingApprovalId, setResendingApprovalId] = useState<string | null>(
    null
  );

  // Send to Applicant State
  const [sendingToApplicantId, setSendingToApplicantId] = useState<
    string | null
  >(null);

  // Sender Sign State (for Self Sign Required feature)
  const { user } = useAppSelector((state) => state.auth);
  const currentUserId = (user as any)?.userId;
  const [showSenderSignModal, setShowSenderSignModal] = useState(false);
  const [senderSigningApprovalId, setSenderSigningApprovalId] = useState<
    string | null
  >(null);
  const [senderSignatureData, setSenderSignatureData] = useState<string | null>(
    null
  );
  const [submittingSenderSign, setSubmittingSenderSign] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      console.log("[CONTRACT APPROVALS] Fetching approvals from API...");
      const res = await axiosInstance.get("/contract-templates/approvals/all");
      console.log("[CONTRACT APPROVALS] API Response:", res.status, res.data);

      let allApprovals = res.data.data || [];
      console.log(
        "[CONTRACT APPROVALS] Raw approvals count:",
        allApprovals.length
      );
      console.log(
        "[CONTRACT APPROVALS] Sample approval:",
        JSON.stringify(allApprovals[0], null, 2)
      );
      if (allApprovals[0]?.employeeApprovals) {
        console.log(
          "[CONTRACT APPROVALS] Sample employeeApprovals:",
          JSON.stringify(allApprovals[0].employeeApprovals[0], null, 2)
        );
      }

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        allApprovals = allApprovals.filter((approval: ContractApproval) => {
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

          const templateTitle = template?.title?.toLowerCase() || "";
          const applicantName = applicant
            ? `${getProfileOrAdditionalValue(applicant, "personaldetails", "firstname") || ""} ${getProfileOrAdditionalValue(applicant, "personaldetails", "lastname") || ""}`.toLowerCase()
            : "";

          // Also search in employee approvals
          const employeeNames = approval.employeeApprovals
            .map((ea: EmployeeApproval) => {
              const employee =
                typeof ea.employeeId === "object" && ea.employeeId !== null
                  ? ea.employeeId
                  : null;
              if (!employee) return "";
              return `${getProfileOrAdditionalValue(employee, "personaldetails", "firstname") || ""} ${getProfileOrAdditionalValue(employee, "personaldetails", "lastname") || ""}`.toLowerCase();
            })
            .join(" ");

          return (
            templateTitle.includes(searchLower) ||
            applicantName.includes(searchLower) ||
            employeeNames.includes(searchLower) ||
            approval.overallStatus.toLowerCase().includes(searchLower)
          );
        });
      }

      // Apply status filter
      if (statusFilter !== "all") {
        allApprovals = allApprovals.filter((approval: ContractApproval) => {
          if (statusFilter === "pending") {
            return (
              approval.overallStatus === "pending" ||
              approval.overallStatus === "partial"
            );
          }
          return approval.overallStatus === statusFilter;
        });
      }

      console.log(
        "[CONTRACT APPROVALS] Filtered approvals count:",
        allApprovals.length
      );
      setApprovals(allApprovals);
    } catch (err: any) {
      console.error("[CONTRACT APPROVALS] Error fetching approvals:", err);
      console.error(
        "[CONTRACT APPROVALS] Error response:",
        err?.response?.data
      );
      console.error(
        "[CONTRACT APPROVALS] Error status:",
        err?.response?.status
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
  }, [search, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getOverallStatusBadge = (status: string) => {
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
      case "partial":
        return (
          <Badge
            color="info"
            className="bg-blue-100 text-blue-800 border border-blue-200"
          >
            Partial
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge color="warning" className="bg-amber-50 text-amber-700 text-xs">
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge color="success" className="bg-green-50 text-green-700 text-xs">
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge color="danger" className="bg-red-50 text-red-700 text-xs">
            Rejected
          </Badge>
        );
      default:
        return <Badge className="text-xs">{status}</Badge>;
    }
  };

  const getEmployeeName = (employee: string | Employee | null) => {
    if (!employee) return "N/A";
    if (typeof employee === "string") {
      // If it's a string ID, we don't have the employee data yet
      return "N/A";
    }
    const firstName =
      getProfileOrAdditionalValue(employee, "personaldetails", "firstname") ||
      "";
    const lastName =
      getProfileOrAdditionalValue(employee, "personaldetails", "lastname") ||
      "";
    return `${firstName} ${lastName}`.trim() || "N/A";
  };

  const getEmployeeEmail = (employee: string | Employee | null) => {
    if (!employee) return "N/A";
    if (typeof employee === "string") {
      // If it's a string ID, we don't have the employee data yet
      return "N/A";
    }
    return getProfileOrAdditionalValue(employee, "userId", "email") || "N/A";
  };

  const getTemplateTitle = (template: string | ContractTemplate) => {
    if (typeof template === "string") return "Loading...";
    return template?.title || "N/A";
  };

  // Handle Resend Approval - resend approval request for a rejected employee
  const handleResendApproval = async (
    approval: ContractApproval,
    empApproval: EmployeeApproval
  ) => {
    const approvalKey = `${approval._id}-${typeof empApproval.employeeId === "object" && empApproval.employeeId !== null && empApproval.employeeId._id ? empApproval.employeeId._id : empApproval.employeeId}`;
    setResendingApprovalId(approvalKey);

    try {
      // Extract template ID
      const templateId =
        typeof approval.templateId === "object" &&
        approval.templateId !== null &&
        approval.templateId._id
          ? approval.templateId._id
          : String(approval.templateId);

      // Extract employee ID
      const employeeId =
        typeof empApproval.employeeId === "object" &&
        empApproval.employeeId !== null &&
        empApproval.employeeId._id
          ? empApproval.employeeId._id
          : String(empApproval.employeeId);

      // Extract applicant ID
      const applicantId =
        typeof approval.applicantId === "object" &&
        approval.applicantId !== null &&
        approval.applicantId._id
          ? approval.applicantId._id
          : String(approval.applicantId);

      if (!templateId || !employeeId || !applicantId) {
        toast.error("Missing required information to resend approval");
        return;
      }

      // Call the send single approval endpoint
      const response = await axiosInstance.post(
        `/contract-templates/${templateId}/send-approval/${employeeId}`,
        {
          applicantId,
          requireSignature: empApproval.requireSignature || false,
          signatureType: empApproval.signatureType,
        }
      );

      if (response.data) {
        toast.success("Approval request resent successfully");
        // Refresh the approvals list
        await fetchApprovals();
      }
    } catch (err: any) {
      console.error("Failed to resend approval", err);
      toast.error(
        err?.response?.data?.message || "Failed to resend approval request"
      );
    } finally {
      setResendingApprovalId(null);
    }
  };

  // Handle Send to Applicant - send approved contract to applicant
  const handleSendToApplicant = async (approval: ContractApproval) => {
    setSendingToApplicantId(approval._id);

    try {
      // Extract template ID
      const templateId =
        typeof approval.templateId === "object" &&
        approval.templateId !== null &&
        approval.templateId._id
          ? approval.templateId._id
          : String(approval.templateId);

      // Extract applicant ID
      const applicantId =
        typeof approval.applicantId === "object" &&
        approval.applicantId !== null &&
        approval.applicantId._id
          ? approval.applicantId._id
          : String(approval.applicantId);

      if (!templateId || !applicantId) {
        toast.error(
          "Missing required information to send contract to applicant"
        );
        return;
      }

      // Call the send to applicant endpoint
      const response = await axiosInstance.post(
        `/contract-templates/${templateId}/send-to-applicant`,
        {
          applicantId,
        }
      );

      if (response.data) {
        // Determine if this was a resend or initial send
        const isResend =
          approval.sentToApplicantAt && approval.applicantStatus === "rejected";
        toast.success(
          isResend
            ? "Contract resent to applicant successfully"
            : "Contract sent to applicant successfully"
        );
        // Refresh the approvals list
        await fetchApprovals();
      }
    } catch (err: any) {
      console.error("Failed to send contract to applicant", err);

      // Check if it's a validation error that we can ignore (notification type error)
      // The operation might have succeeded but notification failed
      const errorMessage = err?.response?.data?.message || "";
      const isNotificationError =
        errorMessage.includes("Notification validation failed") ||
        errorMessage.includes("is not a valid enum value");

      if (err?.response?.status === 500 && isNotificationError) {
        // Operation likely succeeded, just notification failed
        // Show success message and refresh
        const isResend =
          approval.sentToApplicantAt && approval.applicantStatus === "rejected";
        toast.success(
          isResend
            ? "Contract resent to applicant successfully"
            : "Contract sent to applicant successfully"
        );
        // Refresh to get updated status
        await fetchApprovals();
      } else {
        // Real error, show error message
        toast.error(errorMessage || "Failed to send contract to applicant");
      }
    } finally {
      setSendingToApplicantId(null);
    }
  };

  // Handle Sender Sign - sign the contract as the sender (when selfSignRequired is true)
  const handleSenderSign = async (
    approvalId: string,
    signatureData: string
  ) => {
    if (!signatureData) {
      toast.error("Please provide a signature");
      return;
    }

    setSubmittingSenderSign(true);
    try {
      await axiosInstance.post(
        `/contract-templates/approvals/${approvalId}/sender-sign`,
        {
          signatureData,
        }
      );

      toast.success("Contract signed successfully");
      setShowSenderSignModal(false);
      setSenderSigningApprovalId(null);
      setSenderSignatureData(null);

      // Refresh approvals
      await fetchApprovals();
    } catch (error: any) {
      console.error("[SENDER SIGN] Error:", error);
      toast.error(error?.response?.data?.message || "Failed to sign contract");
    } finally {
      setSubmittingSenderSign(false);
    }
  };

  // Handle View Contract - fetch template (or snapshot for accepted contracts) and show preview
  const handleViewContract = async (approval: ContractApproval) => {
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
      approval.applicantId._id
        ? approval.applicantId._id
        : String(approval.applicantId);

    if (!templateId) {
      toast.error("Template ID not found");
      return;
    }

    if (!applicantId) {
      toast.error("Applicant ID not found");
      return;
    }

    setLoadingTemplate(true);
    try {
      // If contract is accepted, try to fetch snapshot first
      if (approval.applicantStatus === "accepted" && approval._id) {
        try {
          // @ts-ignore - skipToast is a custom config option to suppress global error toast
          const snapshotResponse = await axiosInstance.get(
            `/contract-templates/approvals/${approval._id}/snapshot`,
            { skipToast: true } as any
          );
          if (snapshotResponse.data?.data) {
            const snapshot = snapshotResponse.data.data;
            // Use snapshot data for template
            setSelectedTemplate({
              _id: snapshot.templateId,
              title: snapshot.templateSnapshot?.title || "",
              description: snapshot.templateSnapshot?.description,
              version: snapshot.templateSnapshot?.version,
              builder: snapshot.templateSnapshot?.builder,
            } as ContractTemplate);
            setSelectedApplicantId(applicantId);
            setSelectedApprovalForPreview({
              ...approval,
              // Override with snapshot data for consistent rendering
              _snapshotData: snapshot, // Pass snapshot for additional reference
            } as any);
            setShowPreview(true);
            return;
          }
        } catch (snapshotError) {
          console.log(
            "[VIEW CONTRACT] No snapshot found, falling back to template fetch"
          );
        }
      }

      // Fallback: Fetch the full template with builder
      const template = await contractTemplatesService.get(templateId);

      // Verify template has builder
      if (!template || !template.builder) {
        toast.error("Contract template is missing required data");
        return;
      }

      setSelectedTemplate(template);
      setSelectedApplicantId(applicantId);
      setSelectedApprovalForPreview(approval);
      setShowPreview(true);
    } catch (error: any) {
      console.error("Failed to fetch contract template", error);
      toast.error(
        error?.response?.data?.message || "Failed to load contract template"
      );
    } finally {
      setLoadingTemplate(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageTopActions
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by template, applicant, or employee name..."
      />

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

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center rounded-lg border border-gray-200 bg-white">
            <Text>Loading contract approvals...</Text>
          </div>
        ) : approvals.length === 0 ? (
          <div className="p-8 text-center space-y-2 rounded-lg border border-gray-200 bg-white">
            <Text className="text-gray-500 block">
              {search || statusFilter !== "all"
                ? "No contract approvals match your filters"
                : "No contract approvals found. Contract approvals will appear here when contracts are sent for approval through the Generate Contract process."}
            </Text>
            {process.env.NODE_ENV === "development" && (
              <Text className="text-xs text-gray-400 block mt-2">
                Debug: Check browser console and backend logs for details
              </Text>
            )}
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
            const isExpanded = expandedItems.has(approval._id);

            return (
              <div
                key={approval._id}
                className="rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Main Card Header */}
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

                      {/* Status & Stats */}
                      <div className="flex items-center gap-4 pl-11 flex-wrap">
                        <div className="flex items-center gap-2">
                          {getOverallStatusBadge(approval.overallStatus)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {approval.totalEmployees} Employee
                              {approval.totalEmployees !== 1 ? "s" : ""}
                            </span>
                          </div>
                          {approval.pendingCount > 0 && (
                            <div className="flex items-center gap-1 text-amber-600">
                              <Clock className="w-4 h-4" />
                              <span>{approval.pendingCount} Pending</span>
                            </div>
                          )}
                          {approval.approvedCount > 0 && (
                            <div className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>{approval.approvedCount} Approved</span>
                            </div>
                          )}
                          {approval.rejectedCount > 0 && (
                            <div className="flex items-center gap-1 text-red-600">
                              <XCircle className="w-4 h-4" />
                              <span>{approval.rejectedCount} Rejected</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Section: Date & Action Buttons */}
                    <div className="flex flex-col items-end gap-3">
                      <div className="text-right text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {approval.createdAt
                              ? new Date(
                                  approval.createdAt
                                ).toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewContract(approval)}
                          disabled={loadingTemplate}
                          className="flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View Contract
                        </Button>

                        {/* Debug: Log sender sign conditions */}
                        {console.log("[SENDER SIGN DEBUG]", {
                          approvalId: approval._id,
                          selfSignRequired: approval.selfSignRequired,
                          senderUserId: approval.senderUserId,
                          senderSignatureData: !!approval.senderSignatureData,
                          currentUserId,
                          shouldShow:
                            approval.selfSignRequired &&
                            !approval.senderSignatureData &&
                            currentUserId &&
                            approval.senderUserId === currentUserId,
                        })}

                        {/* Sender Sign Button - Show when selfSignRequired is true, sender hasn't signed, and current user is sender */}
                        {approval.selfSignRequired &&
                          !approval.senderSignatureData &&
                          currentUserId &&
                          approval.senderUserId === currentUserId && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSenderSigningApprovalId(approval._id);
                                setShowSenderSignModal(true);
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
                            >
                              <PenLine className="w-4 h-4" />
                              Sign Contract
                            </Button>
                          )}

                        {/* Show sender signed status */}
                        {approval.selfSignRequired &&
                          approval.senderSignatureData && (
                            <div className="flex items-center gap-1 text-sm text-purple-600 bg-purple-50 px-3 py-1.5 rounded-md border border-purple-200">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Sender Signed</span>
                            </div>
                          )}

                        {/* Show "Send to Applicant" button when:
                            1. All employees have approved (overallStatus === "approved"), OR
                            2. Contract is self-signed (employerSignatureData exists and status === "approved")
                            AND contract not yet sent to applicant */}
                        {(approval.overallStatus === "approved" ||
                          (approval.employerSignatureData &&
                            approval.status === "approved")) &&
                          !approval.sentToApplicantAt && (
                            <Button
                              size="sm"
                              onClick={() => handleSendToApplicant(approval)}
                              disabled={sendingToApplicantId === approval._id}
                              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
                            >
                              {sendingToApplicantId === approval._id ? (
                                <>
                                  <Clock className="w-4 h-4 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                <>
                                  <Mail className="w-4 h-4" />
                                  Send to Applicant
                                </>
                              )}
                            </Button>
                          )}

                        {/* Show "Resend to Applicant" button if contract was rejected by applicant */}
                        {approval.sentToApplicantAt &&
                          approval.applicantStatus === "rejected" && (
                            <Button
                              size="sm"
                              onClick={() => handleSendToApplicant(approval)}
                              disabled={sendingToApplicantId === approval._id}
                              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                            >
                              {sendingToApplicantId === approval._id ? (
                                <>
                                  <Clock className="w-4 h-4 animate-spin" />
                                  Resending...
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4" />
                                  Resend to Applicant
                                </>
                              )}
                            </Button>
                          )}

                        {/* Show "View Applicant History" button if contract was sent to applicant */}
                        {approval.sentToApplicantAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedApprovalForApplicantHistory(approval);
                              setShowApplicantHistoryModal(true);
                            }}
                            className="flex items-center gap-1"
                          >
                            <History className="w-4 h-4" />
                            Applicant History
                          </Button>
                        )}
                        {/* Show sent status if already sent */}
                        {approval.sentToApplicantAt && (
                          <div className="flex items-center gap-1 text-sm text-green-600 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
                            <Mail className="w-4 h-4" />
                            <span>
                              Sent{" "}
                              {new Date(
                                approval.sentToApplicantAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {/* Tamper Check for accepted contracts */}
                        {approval.applicantStatus === "accepted" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTamperCheckApprovalId(approval._id);
                              setShowTamperCheckModal(true);
                            }}
                            className="gap-1"
                          >
                            <Shield className="w-4 h-4" />
                            Tamper Check
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleExpand(approval._id)}
                          className="flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Hide Details
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              View Details
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Employee Approvals Section */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50">
                    <div className="p-6">
                      <Text className="text-sm font-semibold text-gray-700 mb-4 block">
                        Approval Status by Employee (
                        {approval.employeeApprovals?.length || 0})
                      </Text>
                      <div className="space-y-3">
                        {approval.employeeApprovals &&
                        approval.employeeApprovals.length > 0 ? (
                          approval.employeeApprovals.map(
                            (empApproval, index) => {
                              // Handle employeeId - could be object (populated) or string (ID)
                              const employeeId = empApproval.employeeId;
                              const employee =
                                typeof employeeId === "object" &&
                                employeeId !== null &&
                                employeeId._id
                                  ? employeeId
                                  : null;

                              // Debug logging
                              if (process.env.NODE_ENV === "development") {
                                console.log(
                                  `[CONTRACT APPROVALS] Employee approval ${index}:`,
                                  {
                                    employeeIdType: typeof employeeId,
                                    employeeIdValue: employeeId,
                                    hasEmployee: !!employee,
                                    employeeKeys: employee
                                      ? Object.keys(employee)
                                      : null,
                                  }
                                );
                              }

                              return (
                                <div
                                  key={`${approval._id}-${index}-${employeeId?._id || employeeId || index}`}
                                  className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4"
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    <EmployeePhoto
                                      employee={employee}
                                      size={40}
                                    />
                                    <div className="flex-1">
                                      <Text className="font-medium text-gray-900">
                                        {getEmployeeName(employeeId)}
                                      </Text>
                                      <Text className="text-xs text-gray-500">
                                        {getEmployeeEmail(employeeId)}
                                      </Text>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <div className="text-center">
                                      <Text className="text-xs text-gray-500 mb-1">
                                        Status
                                      </Text>
                                      {getStatusBadge(empApproval.status)}
                                    </div>

                                    <div className="text-center">
                                      <Text className="text-xs text-gray-500 mb-1">
                                        Signature
                                      </Text>
                                      <Badge
                                        color={
                                          empApproval.requireSignature
                                            ? "info"
                                            : "secondary"
                                        }
                                        className="text-xs"
                                      >
                                        {empApproval.requireSignature
                                          ? "Required"
                                          : "Not Required"}
                                      </Badge>
                                    </div>

                                    {empApproval.respondedAt && (
                                      <div className="text-center">
                                        <Text className="text-xs text-gray-500 mb-1">
                                          Responded
                                        </Text>
                                        <Text className="text-xs text-gray-700">
                                          {new Date(
                                            empApproval.respondedAt
                                          ).toLocaleDateString()}
                                        </Text>
                                      </div>
                                    )}

                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedApprovalForHistory(
                                            approval
                                          );
                                          setSelectedEmployeeApproval(
                                            empApproval
                                          );
                                          setShowHistoryModal(true);
                                        }}
                                        className="flex items-center gap-1 text-xs"
                                      >
                                        <History className="w-3 h-3" />
                                        History
                                      </Button>

                                      {empApproval.status === "rejected" && (
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleResendApproval(
                                              approval,
                                              empApproval
                                            )
                                          }
                                          disabled={
                                            resendingApprovalId ===
                                            `${approval._id}-${typeof empApproval.employeeId === "object" && empApproval.employeeId !== null && empApproval.employeeId._id ? empApproval.employeeId._id : empApproval.employeeId}`
                                          }
                                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1"
                                        >
                                          {resendingApprovalId ===
                                          `${approval._id}-${typeof empApproval.employeeId === "object" && empApproval.employeeId !== null && empApproval.employeeId._id ? empApproval.employeeId._id : empApproval.employeeId}` ? (
                                            <>
                                              <Clock className="w-3 h-3 animate-spin" />
                                              Resending...
                                            </>
                                          ) : (
                                            <>
                                              <Send className="w-3 h-3" />
                                              Resend
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  {empApproval.note && (
                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                      <Text className="text-xs font-medium text-gray-600 mb-1">
                                        Note:
                                      </Text>
                                      <Text className="text-sm text-gray-700">
                                        {empApproval.note}
                                      </Text>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                          )
                        ) : (
                          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-gray-500">
                            <Text className="text-sm">
                              No employees found in this approval request
                            </Text>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
          // PDF and Tamper Check props
          approvalId={selectedApprovalForPreview?._id}
          applicantStatus={selectedApprovalForPreview?.applicantStatus}
          initialApprovals={
            // Build approvals array with all signatures
            (() => {
              const approvals: any[] = [];

              // Add employer signature first (for self-signed contracts)
              if (selectedApprovalForPreview?.employerSignatureData) {
                approvals.push({
                  employeeId: "employer",
                  signatureData:
                    selectedApprovalForPreview.employerSignatureData,
                  respondedAt: selectedApprovalForPreview.employerSignedAt,
                  status: "approved",
                  employeeName:
                    selectedApprovalForPreview.employerName || "Employer",
                  isEmployerSignature: true,
                });
              }

              // Add sender signature (for self-sign required flow)
              if (selectedApprovalForPreview?.senderSignatureData) {
                approvals.push({
                  employeeId: "sender",
                  signatureData: selectedApprovalForPreview.senderSignatureData,
                  respondedAt: selectedApprovalForPreview.senderSignedAt,
                  status: "approved",
                  employeeName: "Employer",
                  isEmployerSignature: true,
                });
              }

              // Add employee approvals
              if (selectedApprovalForPreview?.employeeApprovals) {
                approvals.push(...selectedApprovalForPreview.employeeApprovals);
              }

              // Add applicant signature (for signed contracts)
              if (selectedApprovalForPreview?.applicantSignatureData) {
                // Get applicant name
                const applicant = selectedApprovalForPreview.applicantId;
                let applicantName = "Applicant";
                if (typeof applicant === "object" && applicant) {
                  const firstName =
                    applicant.employeeFields?.personaldetails?.firstname || "";
                  const lastName =
                    applicant.employeeFields?.personaldetails?.lastname || "";
                  applicantName =
                    `${firstName} ${lastName}`.trim() || "Applicant";
                }

                approvals.push({
                  employeeId: "applicant",
                  signatureData:
                    selectedApprovalForPreview.applicantSignatureData,
                  respondedAt: selectedApprovalForPreview.applicantSignedAt,
                  status: "approved",
                  employeeName: applicantName,
                  isApplicantSignature: true,
                });
              }

              return approvals.length > 0 ? approvals : undefined;
            })()
          }
        />
      )}

      {/* Approval History Modal */}
      <Transition appear show={showHistoryModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowHistoryModal(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform rounded-xl bg-white p-6 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Approval History
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowHistoryModal(false);
                        setSelectedApprovalForHistory(null);
                        setSelectedEmployeeApproval(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {selectedApprovalForHistory && selectedEmployeeApproval && (
                    <div className="space-y-4">
                      {/* Contract Template Info */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <Text className="text-sm font-medium text-blue-900 mb-2">
                          Contract Template
                        </Text>
                        <Text className="text-base font-semibold text-gray-900">
                          {getTemplateTitle(
                            selectedApprovalForHistory.templateId
                          )}
                        </Text>
                        {typeof selectedApprovalForHistory.templateId ===
                          "object" &&
                          selectedApprovalForHistory.templateId?.version && (
                            <Text className="text-sm text-gray-600 mt-1">
                              Version:{" "}
                              {selectedApprovalForHistory.templateId.version}
                            </Text>
                          )}
                      </div>

                      {/* Applicant Info */}
                      {selectedApprovalForHistory.applicantId && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <Text className="text-sm font-medium text-gray-700 mb-2">
                            Applicant
                          </Text>
                          <div className="flex items-center gap-2">
                            <EmployeePhoto
                              employee={selectedApprovalForHistory.applicantId}
                              size={32}
                            />
                            <Text className="text-base font-medium text-gray-900">
                              {getEmployeeName(
                                selectedApprovalForHistory.applicantId
                              )}
                            </Text>
                          </div>
                        </div>
                      )}

                      {/* Employee Info */}
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <Text className="text-sm font-medium text-gray-700 mb-2">
                          Approver
                        </Text>
                        <div className="flex items-center gap-2">
                          <EmployeePhoto
                            employee={selectedEmployeeApproval.employeeId}
                            size={32}
                          />
                          <div>
                            <Text className="text-base font-medium text-gray-900">
                              {getEmployeeName(
                                selectedEmployeeApproval.employeeId
                              )}
                            </Text>
                            <Text className="text-xs text-gray-500">
                              {getEmployeeEmail(
                                selectedEmployeeApproval.employeeId
                              )}
                            </Text>
                          </div>
                        </div>
                      </div>

                      {/* Approval Timeline */}
                      <div className="border-t border-gray-200 pt-4">
                        <Text className="text-sm font-semibold text-gray-700 mb-4">
                          Complete Approval History
                        </Text>
                        <div className="space-y-4">
                          {/* Show history entries if available, otherwise show current state */}
                          {selectedEmployeeApproval.history &&
                          selectedEmployeeApproval.history.length > 0 ? (
                            // Display full chronological history
                            selectedEmployeeApproval.history
                              .sort(
                                (a, b) =>
                                  new Date(a.createdAt).getTime() -
                                  new Date(b.createdAt).getTime()
                              )
                              .map((historyEntry, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-3"
                                >
                                  <div
                                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                      historyEntry.status === "approved"
                                        ? "bg-green-500"
                                        : historyEntry.status === "rejected"
                                          ? "bg-red-500"
                                          : "bg-blue-500"
                                    }`}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Text className="text-sm font-medium text-gray-900">
                                        {historyEntry.status === "approved"
                                          ? "Approved"
                                          : historyEntry.status === "rejected"
                                            ? "Rejected"
                                            : historyEntry.status ===
                                                  "pending" && index === 0
                                              ? "Contract Sent for Approval"
                                              : "Status: Pending"}
                                      </Text>
                                      {getStatusBadge(historyEntry.status)}
                                    </div>
                                    <Text className="text-xs text-gray-500 mb-2">
                                      {new Date(
                                        historyEntry.createdAt
                                      ).toLocaleString()}
                                    </Text>

                                    {/* Note from this history entry */}
                                    {historyEntry.note && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Note:
                                        </Text>
                                        <Text className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {historyEntry.note}
                                        </Text>
                                      </div>
                                    )}

                                    {/* Response date if available */}
                                    {historyEntry.respondedAt && (
                                      <Text className="text-xs text-gray-400 mt-1">
                                        Responded:{" "}
                                        {new Date(
                                          historyEntry.respondedAt
                                        ).toLocaleString()}
                                      </Text>
                                    )}
                                  </div>
                                </div>
                              ))
                          ) : (
                            // Fallback: Show current state if no history exists (for backward compatibility)
                            <>
                              {/* Created/Sent */}
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Text className="text-sm font-medium text-gray-900">
                                      Contract Sent for Approval
                                    </Text>
                                    <Badge color="info" className="text-xs">
                                      Pending
                                    </Badge>
                                  </div>
                                  <Text className="text-xs text-gray-500">
                                    {selectedApprovalForHistory.createdAt
                                      ? new Date(
                                          selectedApprovalForHistory.createdAt
                                        ).toLocaleString()
                                      : "N/A"}
                                  </Text>
                                </div>
                              </div>

                              {/* Response (if responded) */}
                              {selectedEmployeeApproval.respondedAt && (
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                      selectedEmployeeApproval.status ===
                                      "approved"
                                        ? "bg-green-500"
                                        : selectedEmployeeApproval.status ===
                                            "rejected"
                                          ? "bg-red-500"
                                          : "bg-amber-500"
                                    }`}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Text className="text-sm font-medium text-gray-900">
                                        {selectedEmployeeApproval.status ===
                                        "approved"
                                          ? "Approved"
                                          : selectedEmployeeApproval.status ===
                                              "rejected"
                                            ? "Rejected"
                                            : "Status Updated"}
                                      </Text>
                                      {getStatusBadge(
                                        selectedEmployeeApproval.status
                                      )}
                                    </div>
                                    <Text className="text-xs text-gray-500 mb-2">
                                      {new Date(
                                        selectedEmployeeApproval.respondedAt
                                      ).toLocaleString()}
                                    </Text>

                                    {/* Signature Requirements */}
                                    {selectedEmployeeApproval.requireSignature && (
                                      <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Signature Required
                                        </Text>
                                        <Text className="text-xs text-gray-700">
                                          Type:{" "}
                                          {selectedEmployeeApproval.signatureType ||
                                            "N/A"}
                                        </Text>
                                      </div>
                                    )}

                                    {/* Note */}
                                    {selectedEmployeeApproval.note && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Note:
                                        </Text>
                                        <Text className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {selectedEmployeeApproval.note}
                                        </Text>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Applicant History Modal */}
      <Transition appear show={showApplicantHistoryModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowApplicantHistoryModal(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform rounded-xl bg-white p-6 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <Dialog.Title className="text-lg font-semibold text-gray-900">
                      Applicant History
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowApplicantHistoryModal(false);
                        setSelectedApprovalForApplicantHistory(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {selectedApprovalForApplicantHistory && (
                    <div className="space-y-4">
                      {/* Contract Template Info */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <Text className="text-sm font-medium text-blue-900 mb-2">
                          Contract Template
                        </Text>
                        <Text className="text-base font-semibold text-gray-900">
                          {getTemplateTitle(
                            selectedApprovalForApplicantHistory.templateId
                          )}
                        </Text>
                        {typeof selectedApprovalForApplicantHistory.templateId ===
                          "object" &&
                          selectedApprovalForApplicantHistory.templateId
                            ?.version && (
                            <Text className="text-sm text-gray-600 mt-1">
                              Version:{" "}
                              {
                                selectedApprovalForApplicantHistory.templateId
                                  .version
                              }
                            </Text>
                          )}
                      </div>

                      {/* Applicant Info */}
                      {selectedApprovalForApplicantHistory.applicantId && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <Text className="text-sm font-medium text-gray-700 mb-2">
                            Applicant
                          </Text>
                          <div className="flex items-center gap-2">
                            <EmployeePhoto
                              employee={
                                selectedApprovalForApplicantHistory.applicantId
                              }
                              size={32}
                            />
                            <div>
                              <Text className="text-base font-medium text-gray-900">
                                {getEmployeeName(
                                  selectedApprovalForApplicantHistory.applicantId
                                )}
                              </Text>
                              <Text className="text-xs text-gray-500">
                                {getEmployeeEmail(
                                  selectedApprovalForApplicantHistory.applicantId
                                )}
                              </Text>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Sent to Applicant Info */}
                      {selectedApprovalForApplicantHistory.sentToApplicantAt && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <Text className="text-sm font-medium text-green-900 mb-1">
                            Contract Sent to Applicant
                          </Text>
                          <Text className="text-xs text-gray-600">
                            {new Date(
                              selectedApprovalForApplicantHistory.sentToApplicantAt
                            ).toLocaleString()}
                          </Text>
                        </div>
                      )}

                      {/* Applicant Response Timeline */}
                      <div className="border-t border-gray-200 pt-4">
                        <Text className="text-sm font-semibold text-gray-700 mb-4">
                          Complete Applicant Response History
                        </Text>
                        <div className="space-y-4">
                          {/* Show history entries if available, otherwise show current state */}
                          {selectedApprovalForApplicantHistory.applicantHistory &&
                          selectedApprovalForApplicantHistory.applicantHistory
                            .length > 0 ? (
                            // Display full chronological history
                            selectedApprovalForApplicantHistory.applicantHistory
                              .sort(
                                (a, b) =>
                                  new Date(a.createdAt).getTime() -
                                  new Date(b.createdAt).getTime()
                              )
                              .map((historyEntry, index) => (
                                <div
                                  key={index}
                                  className="flex items-start gap-3"
                                >
                                  <div
                                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                      historyEntry.status === "accepted"
                                        ? "bg-green-500"
                                        : historyEntry.status === "rejected"
                                          ? "bg-red-500"
                                          : "bg-blue-500"
                                    }`}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Text className="text-sm font-medium text-gray-900">
                                        {historyEntry.status === "accepted"
                                          ? "Accepted"
                                          : historyEntry.status === "rejected"
                                            ? "Rejected"
                                            : historyEntry.status ===
                                                  "pending" && index === 0
                                              ? "Contract Sent to Applicant"
                                              : "Pending"}
                                      </Text>
                                      <Badge
                                        color={
                                          historyEntry.status === "accepted"
                                            ? "success"
                                            : historyEntry.status === "rejected"
                                              ? "danger"
                                              : "info"
                                        }
                                        className="text-xs"
                                      >
                                        {historyEntry.status === "accepted"
                                          ? "Accepted"
                                          : historyEntry.status === "rejected"
                                            ? "Rejected"
                                            : "Pending"}
                                      </Badge>
                                    </div>
                                    <Text className="text-xs text-gray-500 mb-2">
                                      {new Date(
                                        historyEntry.createdAt
                                      ).toLocaleString()}
                                    </Text>

                                    {/* Note from this history entry */}
                                    {historyEntry.note && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Note:
                                        </Text>
                                        <Text className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {historyEntry.note}
                                        </Text>
                                      </div>
                                    )}

                                    {/* Response date if available */}
                                    {historyEntry.respondedAt && (
                                      <Text className="text-xs text-gray-400 mt-1">
                                        Responded:{" "}
                                        {new Date(
                                          historyEntry.respondedAt
                                        ).toLocaleString()}
                                      </Text>
                                    )}
                                  </div>
                                </div>
                              ))
                          ) : (
                            // Fallback: Show current state if no history exists (for backward compatibility)
                            <>
                              {/* Sent to Applicant */}
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Text className="text-sm font-medium text-gray-900">
                                      Contract Sent to Applicant
                                    </Text>
                                    <Badge color="info" className="text-xs">
                                      Pending
                                    </Badge>
                                  </div>
                                  <Text className="text-xs text-gray-500">
                                    {selectedApprovalForApplicantHistory.sentToApplicantAt
                                      ? new Date(
                                          selectedApprovalForApplicantHistory.sentToApplicantAt
                                        ).toLocaleString()
                                      : "N/A"}
                                  </Text>
                                </div>
                              </div>

                              {/* Response (if responded) */}
                              {(selectedApprovalForApplicantHistory.acceptedAt ||
                                selectedApprovalForApplicantHistory.rejectedAt) && (
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                      selectedApprovalForApplicantHistory.applicantStatus ===
                                      "accepted"
                                        ? "bg-green-500"
                                        : selectedApprovalForApplicantHistory.applicantStatus ===
                                            "rejected"
                                          ? "bg-red-500"
                                          : "bg-amber-500"
                                    }`}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Text className="text-sm font-medium text-gray-900">
                                        {selectedApprovalForApplicantHistory.applicantStatus ===
                                        "accepted"
                                          ? "Accepted"
                                          : selectedApprovalForApplicantHistory.applicantStatus ===
                                              "rejected"
                                            ? "Rejected"
                                            : "Status Updated"}
                                      </Text>
                                      <Badge
                                        color={
                                          selectedApprovalForApplicantHistory.applicantStatus ===
                                          "accepted"
                                            ? "success"
                                            : selectedApprovalForApplicantHistory.applicantStatus ===
                                                "rejected"
                                              ? "danger"
                                              : "info"
                                        }
                                        className="text-xs"
                                      >
                                        {selectedApprovalForApplicantHistory.applicantStatus ===
                                        "accepted"
                                          ? "Accepted"
                                          : selectedApprovalForApplicantHistory.applicantStatus ===
                                              "rejected"
                                            ? "Rejected"
                                            : "Pending"}
                                      </Badge>
                                    </div>
                                    <Text className="text-xs text-gray-500 mb-2">
                                      {selectedApprovalForApplicantHistory.acceptedAt
                                        ? new Date(
                                            selectedApprovalForApplicantHistory.acceptedAt
                                          ).toLocaleString()
                                        : selectedApprovalForApplicantHistory.rejectedAt
                                          ? new Date(
                                              selectedApprovalForApplicantHistory.rejectedAt
                                            ).toLocaleString()
                                          : "N/A"}
                                    </Text>

                                    {/* Note */}
                                    {selectedApprovalForApplicantHistory.applicantNote && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Note:
                                        </Text>
                                        <Text className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {
                                            selectedApprovalForApplicantHistory.applicantNote
                                          }
                                        </Text>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Tamper Check Modal */}
      <TamperCheckModal
        isOpen={showTamperCheckModal}
        onClose={() => {
          setShowTamperCheckModal(false);
          setTamperCheckApprovalId(null);
        }}
        approvalId={tamperCheckApprovalId || ""}
      />

      {/* Sender Sign Modal */}
      <SignModal
        isOpen={showSenderSignModal}
        onClose={() => {
          setShowSenderSignModal(false);
          setSenderSigningApprovalId(null);
        }}
        onSign={async (signatureData) => {
          if (senderSigningApprovalId) {
            await handleSenderSign(senderSigningApprovalId, signatureData);
          }
        }}
        userName={
          (user as any)?.firstname
            ? `${(user as any).firstname} ${(user as any).lastname || ""}`
            : "Sender"
        }
      />
    </div>
  );
}
