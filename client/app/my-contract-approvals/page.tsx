"use client";

import { useEffect, useState } from "react";
import { Button, Badge, Text, Title, Textarea } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import { getProfileOrAdditionalValue } from "@/app/utils/employee-field-helpers";
import { EmployeePhoto } from "@/app/components/shared/EmployeePhoto";
import toast from "react-hot-toast";
import {
  CheckCircle2,
  X,
  Clock,
  FileText,
  Calendar,
  Loader2,
  Eye,
  History,
  PenTool,
} from "lucide-react";
import { useAppSelector } from "@/app/store/hook";
import ContractTemplatePreviewModal from "@/app/components/shared/ContractTemplatePreviewModal";
import SignModal from "@/app/components/shared/SignModal";
import { contractTemplatesService } from "@/app/services/contractTemplates.service";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

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

interface ApprovalHistoryEntry {
  status: "pending" | "approved" | "rejected";
  note?: string;
  respondedAt?: string;
  createdAt: string;
}

interface EmployeeContractApproval {
  _id: string;
  templateId: string | ContractTemplate;
  applicantId: string | Employee | null;
  employeeId?: string; // The employeeId this approval is for (needed for approve/reject)
  status: "pending" | "approved" | "rejected";
  requireSignature: boolean;
  signatureType?: "typed" | "drawn" | "upload";
  signatureData?: string;
  respondedAt?: string;
  note?: string; // Optional note/comment from the employee (current/latest)
  history?: ApprovalHistoryEntry[]; // Complete chronological history of all actions
  createdAt?: string;
  updatedAt?: string;
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
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(
    null
  );
  const [selectedApprovalForPreview, setSelectedApprovalForPreview] =
    useState<EmployeeContractApproval | null>(null);

  // Approval Note Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingApproval, setPendingApproval] =
    useState<EmployeeContractApproval | null>(null);
  const [pendingStatus, setPendingStatus] = useState<
    "approved" | "rejected" | null
  >(null);
  const [note, setNote] = useState("");

  // Approval History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedApprovalForHistory, setSelectedApprovalForHistory] =
    useState<EmployeeContractApproval | null>(null);

  // Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [signingApproval, setSigningApproval] =
    useState<EmployeeContractApproval | null>(null);

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

  const handleApproveRejectClick = (
    approval: EmployeeContractApproval,
    status: "approved" | "rejected"
  ) => {
    setPendingApproval(approval);
    setPendingStatus(status);
    setNote("");
    setShowNoteModal(true);
  };

  const handleApproveReject = async () => {
    if (!pendingApproval || !pendingStatus) return;

    setProcessingId(pendingApproval._id);
    setShowNoteModal(false);

    try {
      // Use the unique approval _id to identify the specific contract approval document
      const approvalId = pendingApproval._id;

      // Get employeeId from the approval data (this is the employeeId this approval is for)
      const employeeId = pendingApproval.employeeId;

      if (!approvalId) {
        toast.error("Approval ID not found in approval data");
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
          status: pendingStatus,
          respondedAt: new Date().toISOString(),
          note: note.trim() || undefined, // Send note if provided
        }
      );

      if (response.data) {
        toast.success(
          `Contract ${pendingStatus === "approved" ? "approved" : "rejected"} successfully`
        );
        // Refresh the approvals list
        await fetchApprovals();
      }
    } catch (err: any) {
      console.error("Failed to update approval", err);
      toast.error(
        err?.response?.data?.message || `Failed to ${pendingStatus} contract`
      );
    } finally {
      setProcessingId(null);
      setPendingApproval(null);
      setPendingStatus(null);
      setNote("");
    }
  };

  const handleSignClick = (approval: EmployeeContractApproval) => {
    setSigningApproval(approval);
    setShowSignModal(true);
  };

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

  const getStatusBadge = (approval: EmployeeContractApproval) => {
    const { status, signatureData } = approval;
    if (status === "approved" && signatureData) {
      return (
        <Badge
          color="success"
          className="bg-green-100 text-green-800 border border-green-200"
        >
          Approved & Signed
        </Badge>
      );
    }
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

  // Handle View Contract - fetch template and show preview
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
      // Fetch the full template with builder
      const template = await contractTemplatesService.get(templateId);

      // Verify template has builder
      if (!template || !template.builder) {
        toast.error("Contract template is missing required data");
        return;
      }

      setSelectedTemplate(template);
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
                          {getStatusBadge(approval)}
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
                      {approval.note && (
                        <div className="mt-3 pl-11">
                          <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
                            <Text className="text-xs font-medium text-gray-600 mb-1">
                              Note:
                            </Text>
                            <Text className="text-sm text-gray-700">
                              {approval.note}
                            </Text>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Section: Action Buttons */}
                    <div className="flex flex-col items-end gap-3">
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
                              <PenTool className="w-4 h-4" />
                              Sign
                            </Button>
                          )}

                          {/* Approve Button (only if signature NOT required) */}
                          {!approval.requireSignature && (
                            <Button
                              size="sm"
                              color="success"
                              onClick={() => {
                                setPendingApproval(approval);
                                setPendingStatus("approved");
                                setShowNoteModal(true);
                              }}
                              disabled={isProcessing}
                              className="flex items-center gap-1"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              Approve
                            </Button>
                          )}

                          {/* Reject Button (Always visible when pending) */}
                          <Button
                            size="sm"
                            color="danger"
                            variant="outline"
                            onClick={() => {
                              setPendingApproval(approval);
                              setPendingStatus("rejected");
                              setShowNoteModal(true);
                            }}
                            disabled={isProcessing}
                            className="flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Reject
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
          initialApprovals={
            selectedApprovalForPreview
              ? [selectedApprovalForPreview]
              : undefined
          }
        />
      )}

      {/* Approval Note Modal */}
      <Transition appear show={showNoteModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowNoteModal(false)}
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
                <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-white p-6 shadow-xl">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 mb-4">
                    {pendingStatus === "approved"
                      ? "Approve Contract"
                      : "Reject Contract"}
                  </Dialog.Title>

                  <div className="space-y-4">
                    <div>
                      <Text className="text-sm font-medium text-gray-700 mb-2 block">
                        Add a note (optional)
                      </Text>
                      <Textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Enter your comments or feedback about this contract..."
                        rows={4}
                        className="w-full"
                      />
                      <Text className="text-xs text-gray-500 mt-1">
                        This note will be saved with your{" "}
                        {pendingStatus === "approved"
                          ? "approval"
                          : "rejection"}{" "}
                        decision.
                      </Text>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowNoteModal(false);
                          setNote("");
                          setPendingApproval(null);
                          setPendingStatus(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleApproveReject}
                        className={
                          pendingStatus === "approved"
                            ? "bg-green-600 hover:bg-green-700 text-white"
                            : "bg-red-600 hover:bg-red-700 text-white"
                        }
                      >
                        {pendingStatus === "approved" ? "Approve" : "Reject"}
                      </Button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

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
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {selectedApprovalForHistory && (
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

                      {/* Approval Timeline */}
                      <div className="border-t border-gray-200 pt-4">
                        <Text className="text-sm font-semibold text-gray-700 mb-4">
                          Complete Approval History
                        </Text>
                        <div className="space-y-4">
                          {/* Show history entries if available, otherwise show current state */}
                          {selectedApprovalForHistory.history &&
                          selectedApprovalForHistory.history.length > 0 ? (
                            // Display full chronological history
                            selectedApprovalForHistory.history
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
                              {selectedApprovalForHistory.respondedAt && (
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                      selectedApprovalForHistory.status ===
                                      "approved"
                                        ? "bg-green-500"
                                        : selectedApprovalForHistory.status ===
                                            "rejected"
                                          ? "bg-red-500"
                                          : "bg-amber-500"
                                    }`}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Text className="text-sm font-medium text-gray-900">
                                        {selectedApprovalForHistory.status ===
                                        "approved"
                                          ? "Approved"
                                          : selectedApprovalForHistory.status ===
                                              "rejected"
                                            ? "Rejected"
                                            : "Status Updated"}
                                      </Text>
                                      {getStatusBadge(
                                        selectedApprovalForHistory.status
                                      )}
                                    </div>
                                    <Text className="text-xs text-gray-500 mb-2">
                                      {new Date(
                                        selectedApprovalForHistory.respondedAt
                                      ).toLocaleString()}
                                    </Text>

                                    {/* Signature Requirements */}
                                    {selectedApprovalForHistory.requireSignature && (
                                      <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Signature Required
                                        </Text>
                                        <Text className="text-xs text-gray-700">
                                          Type:{" "}
                                          {selectedApprovalForHistory.signatureType ||
                                            "N/A"}
                                        </Text>
                                      </div>
                                    )}

                                    {/* Note */}
                                    {selectedApprovalForHistory.note && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Note:
                                        </Text>
                                        <Text className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {selectedApprovalForHistory.note}
                                        </Text>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Last Updated (if different from respondedAt) */}
                              {selectedApprovalForHistory.updatedAt &&
                                selectedApprovalForHistory.respondedAt &&
                                new Date(
                                  selectedApprovalForHistory.updatedAt
                                ).getTime() !==
                                  new Date(
                                    selectedApprovalForHistory.respondedAt
                                  ).getTime() && (
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-gray-400 mt-2"></div>
                                    <div className="flex-1">
                                      <Text className="text-sm font-medium text-gray-700">
                                        Last Updated
                                      </Text>
                                      <Text className="text-xs text-gray-500">
                                        {new Date(
                                          selectedApprovalForHistory.updatedAt
                                        ).toLocaleString()}
                                      </Text>
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

      <SignModal
        isOpen={showSignModal}
        onClose={() => {
          setShowSignModal(false);
          setSigningApproval(null);
        }}
        onSign={handleSignSubmit}
        userName={(user as any)?.fullName || "User"}
      />
    </div>
  );
}
