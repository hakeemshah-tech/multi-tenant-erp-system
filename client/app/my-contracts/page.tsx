"use client";

import { useState, useEffect, Fragment } from "react";
import axiosInstance from "@/app/lib/axios";
import { Button, Text, Title, Textarea } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import toast from "react-hot-toast";
import {
  FileText,
  Eye,
  Loader2,
  Mail,
  Search,
  CheckCircle2,
  XCircle,
  History,
  X,
  Pen,
  Shield,
} from "lucide-react";
import { Dialog, Transition } from "@headlessui/react";
import ContractTemplatePreviewModal from "@/app/components/shared/ContractTemplatePreviewModal";
import SignModal from "@/app/components/shared/SignModal";
import DownloadPdfButton from "@/app/components/shared/DownloadPdfButton";
import TamperCheckModal from "@/app/components/shared/TamperCheckModal";
import { contractTemplatesService } from "@/app/services/contractTemplates.service";

interface Employee {
  _id: string;
  employeeFields?: {
    personaldetails?: {
      firstname?: string;
      lastname?: string;
      preferredname?: string;
    };
  };
  employeeProfile?: string;
}

interface ContractTemplate {
  _id: string;
  title: string;
  description?: string;
  version?: string;
  builder?: any;
}

interface ApplicantHistoryEntry {
  status: "pending" | "accepted" | "rejected";
  note?: string;
  respondedAt?: string;
  createdAt: string;
}

interface MyContract {
  _id: string;
  templateId: string | ContractTemplate;
  applicantId: string | Employee | null;
  sentToApplicantAt: string;
  applicantStatus?: "pending" | "accepted" | "rejected";
  acceptedAt?: string;
  rejectedAt?: string;
  applicantNote?: string;
  applicantHistory?: ApplicantHistoryEntry[]; // Complete chronological history of applicant actions
  // Employer signature fields for self-sign flow
  employerSignatureData?: string;
  employerSignedAt?: string;
  employerName?: string;
  status?: "pending" | "approved" | "rejected";
  employeeApprovals?: any[]; // Employee approvals array
  // Sender/Employer signature fields (new self-sign)
  senderSignatureData?: string;
  senderSignedAt?: string;
  selfSignRequired?: boolean;
  // Applicant signature fields
  applicantSignatureData?: string;
  applicantSignedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  tenantId?: string;
  branchId?: string;
}

export default function MyContractsPage() {
  const [contracts, setContracts] = useState<MyContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // View Contract Modal State
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ContractTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(
    null
  );
  const [selectedContractForPreview, setSelectedContractForPreview] =
    useState<MyContract | null>(null);

  // Accept/Reject Modal State
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "accept" | "reject" | null
  >(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null
  );
  const [note, setNote] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  // Sign Modal State
  const [showSignModal, setShowSignModal] = useState(false);
  const [selectedContractForSign, setSelectedContractForSign] =
    useState<MyContract | null>(null);
  const [signing, setSigning] = useState(false);

  // Applicant History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedContractForHistory, setSelectedContractForHistory] =
    useState<MyContract | null>(null);

  // Tamper Check Modal State
  const [showTamperCheckModal, setShowTamperCheckModal] = useState(false);
  const [tamperCheckApprovalId, setTamperCheckApprovalId] = useState<
    string | null
  >(null);

  const fetchContracts = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(
        "/contract-templates/my-contracts"
      );
      setContracts(response.data.data || []);
    } catch (err: any) {
      console.error("Failed to fetch contracts", err);
      toast.error(err?.response?.data?.message || "Failed to fetch contracts");
      setContracts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchContracts();
  }, []);

  const getTemplateTitle = (template: string | ContractTemplate) => {
    if (typeof template === "string") return "Loading...";
    return template?.title || "N/A";
  };

  // Handle View Contract - fetch template (or snapshot for accepted contracts) and show preview
  const handleViewContract = async (contract: MyContract) => {
    // Extract templateId from contract data
    const templateId =
      typeof contract.templateId === "object" &&
      contract.templateId !== null &&
      contract.templateId._id
        ? contract.templateId._id
        : String(contract.templateId);

    // Extract applicantId
    const applicantId =
      typeof contract.applicantId === "object" &&
      contract.applicantId !== null &&
      contract.applicantId._id
        ? contract.applicantId._id
        : String(contract.applicantId);

    if (!templateId || !applicantId) {
      toast.error("Contract information not found");
      return;
    }

    setLoadingTemplate(true);
    try {
      // If contract is accepted, try to fetch snapshot first
      if (contract.applicantStatus === "accepted" && contract._id) {
        try {
          // @ts-ignore - skipToast is a custom config option to suppress global error toast
          const snapshotResponse = await axiosInstance.get(
            `/contract-templates/approvals/${contract._id}/snapshot`,
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
            setSelectedContractForPreview({
              ...contract,
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
      setSelectedContractForPreview(contract); // Store contract for passing approvals
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

  // Handle Accept/Reject action
  const handleAcceptRejectClick = (
    contract: MyContract,
    action: "accept" | "reject"
  ) => {
    setPendingAction(action);
    setSelectedContractId(contract._id);
    setNote(contract.applicantNote || "");
    setShowNoteModal(true);
  };

  const handleAcceptReject = async () => {
    if (!pendingAction || !selectedContractId) return;

    const contract = contracts.find((c) => c._id === selectedContractId);
    if (!contract) return;

    // Extract templateId
    const templateId =
      typeof contract.templateId === "object" &&
      contract.templateId !== null &&
      contract.templateId._id
        ? contract.templateId._id
        : String(contract.templateId);

    setProcessingAction(true);
    try {
      const response = await axiosInstance.post(
        `/contract-templates/${templateId}/accept-reject`,
        {
          action: pendingAction,
          note: note.trim() || undefined,
        }
      );

      if (response.data) {
        toast.success(
          `Contract ${pendingAction === "accept" ? "accepted" : "rejected"} successfully`
        );
        setShowNoteModal(false);
        setPendingAction(null);
        setSelectedContractId(null);
        setNote("");
        // Refresh contracts list
        await fetchContracts();
      }
    } catch (error: any) {
      console.error(`Failed to ${pendingAction} contract`, error);
      toast.error(
        error?.response?.data?.message || `Failed to ${pendingAction} contract`
      );
    } finally {
      setProcessingAction(false);
    }
  };

  // Handle Sign button click - opens the sign modal
  const handleSignClick = (contract: MyContract) => {
    setSelectedContractForSign(contract);
    setShowSignModal(true);
  };

  // Handle Sign submission - signs and accepts the contract
  const handleSign = async (signatureData: string) => {
    if (!selectedContractForSign) return;

    const contract = selectedContractForSign;

    // Extract templateId
    const templateId =
      typeof contract.templateId === "object" &&
      contract.templateId !== null &&
      contract.templateId._id
        ? contract.templateId._id
        : String(contract.templateId);

    setSigning(true);
    try {
      const response = await axiosInstance.post(
        `/contract-templates/${templateId}/accept-reject`,
        {
          action: "accept",
          signatureData: signatureData,
        }
      );

      if (response.data) {
        toast.success("Contract signed and accepted successfully");
        setShowSignModal(false);
        setSelectedContractForSign(null);
        // Refresh contracts list
        await fetchContracts();
      }
    } catch (error: any) {
      console.error("Failed to sign contract", error);
      toast.error(error?.response?.data?.message || "Failed to sign contract");
    } finally {
      setSigning(false);
    }
  };

  // Filter contracts based on search
  const filteredContracts = contracts.filter((contract) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const templateTitle = getTemplateTitle(contract.templateId).toLowerCase();
    return templateTitle.includes(searchLower);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Title>My Contracts</Title>
      </div>

      <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
            size={18}
          />
          <input
            type="text"
            placeholder="Search contracts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full shadow-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filteredContracts.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <Text className="text-lg font-medium text-gray-900 mb-2">
            {search ? "No contracts found" : "No contracts available"}
          </Text>
          <Text className="text-sm text-gray-500">
            {search
              ? "Try adjusting your search terms"
              : "Contracts that have been sent to you will appear here"}
          </Text>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredContracts.map((contract) => {
            const template =
              typeof contract.templateId === "object" &&
              contract.templateId !== null
                ? contract.templateId
                : null;

            return (
              <Card
                key={contract._id}
                className="p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left Section: Contract Info */}
                  <div className="flex-1 space-y-4">
                    {/* Template Info */}
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <Text className="font-semibold text-lg text-gray-900">
                          {getTemplateTitle(contract.templateId)}
                        </Text>
                        {template?.version && (
                          <Text className="text-sm text-gray-500 mt-1">
                            Version: {template.version}
                          </Text>
                        )}
                      </div>
                    </div>

                    {/* Sent Date */}
                    <div className="flex items-center gap-2 pl-11 text-sm text-gray-600">
                      <Mail className="w-4 h-4 text-green-600" />
                      <span className="font-medium">Sent to you:</span>
                      <span>
                        {isMounted && contract.sentToApplicantAt
                          ? new Date(
                              contract.sentToApplicantAt
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : contract.sentToApplicantAt
                            ? "Loading..."
                            : "N/A"}
                      </span>
                    </div>

                    {/* Response Date and Note */}
                    {contract.applicantStatus &&
                      contract.applicantStatus !== "pending" && (
                        <div className="pl-11 space-y-2">
                          {contract.acceptedAt && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                              <span className="font-medium">Accepted on:</span>
                              <span>
                                {isMounted
                                  ? new Date(
                                      contract.acceptedAt
                                    ).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Loading..."}
                              </span>
                            </div>
                          )}
                          {contract.rejectedAt && (
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="font-medium">Rejected on:</span>
                              <span>
                                {isMounted
                                  ? new Date(
                                      contract.rejectedAt
                                    ).toLocaleDateString("en-US", {
                                      year: "numeric",
                                      month: "long",
                                      day: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "Loading..."}
                              </span>
                            </div>
                          )}
                          {contract.applicantNote && (
                            <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                              <Text className="text-xs font-medium text-gray-700 mb-1">
                                Your Note:
                              </Text>
                              <Text className="text-sm text-gray-600">
                                {contract.applicantNote}
                              </Text>
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                  {/* Right Section: Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => handleViewContract(contract)}
                      disabled={loadingTemplate}
                      className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      View Contract
                    </Button>

                    {/* Status Badge */}
                    {contract.applicantStatus === "accepted" && (
                      <>
                        <div className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Accepted
                        </div>
                        {/* Tamper Check for accepted contracts */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setTamperCheckApprovalId(contract._id);
                            setShowTamperCheckModal(true);
                          }}
                          className="gap-1"
                        >
                          <Shield className="w-4 h-4" />
                          Tamper Check
                        </Button>
                      </>
                    )}
                    {contract.applicantStatus === "rejected" && (
                      <div className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                        <XCircle className="w-4 h-4" />
                        Rejected
                      </div>
                    )}

                    {/* View History Button - show if there's history or if contract was responded to */}
                    {(contract.applicantHistory &&
                      contract.applicantHistory.length > 0) ||
                    contract.applicantStatus !== "pending" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedContractForHistory(contract);
                          setShowHistoryModal(true);
                        }}
                        className="flex items-center gap-1"
                      >
                        <History className="w-4 h-4" />
                        View History
                      </Button>
                    ) : null}

                    {/* Sign/Reject Buttons - only show if pending and not yet signed */}
                    {(!contract.applicantStatus ||
                      contract.applicantStatus === "pending") && (
                      <>
                        {/* Show Signed indicator if already signed but still pending */}
                        {contract.applicantSignatureData ? (
                          <div className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                            <Pen className="w-4 h-4" />
                            Signed
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleSignClick(contract)}
                            disabled={signing}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1"
                          >
                            <Pen className="w-4 h-4" />
                            {signing ? "Signing..." : "Sign & Accept"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() =>
                            handleAcceptRejectClick(contract, "reject")
                          }
                          variant="outline"
                          className="border-red-300 text-red-600 hover:bg-red-50 flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Contract Preview Modal */}
      {selectedTemplate && selectedTemplate.builder && (
        <ContractTemplatePreviewModal
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
            setSelectedApplicantId(null);
            setSelectedContractForPreview(null);
          }}
          title={selectedTemplate.title || ""}
          description={selectedTemplate.description}
          version={selectedTemplate.version}
          builder={selectedTemplate.builder}
          initialEmployeeId={selectedApplicantId || undefined}
          templateId={selectedTemplate._id}
          readOnly={true}
          // Pass applicant data directly for pending contracts (avoids /employees/:id permission issue)
          publicEmployeeData={
            typeof selectedContractForPreview?.applicantId === "object" &&
            selectedContractForPreview?.applicantId
              ? (selectedContractForPreview.applicantId as any)
              : undefined
          }
          // Pass snapshot employee data for accepted contracts so preview shows finalized data
          snapshotEmployeeData={
            selectedContractForPreview?.applicantStatus === "accepted" &&
            (selectedContractForPreview as any)?._snapshotData
              ?.applicantSnapshot
              ? (selectedContractForPreview as any)._snapshotData
                  .applicantSnapshot
              : selectedContractForPreview?.applicantStatus === "accepted" &&
                  selectedContractForPreview?.applicantId
                ? typeof selectedContractForPreview.applicantId === "object"
                  ? selectedContractForPreview.applicantId
                  : undefined
                : undefined
          }
          // PDF and Tamper Check props
          approvalId={selectedContractForPreview?._id}
          applicantStatus={selectedContractForPreview?.applicantStatus}
          initialApprovals={
            // Build approvals array with all signatures
            (() => {
              const approvals: any[] = [];

              // Add employer signature first (for self-signed contracts)
              if (selectedContractForPreview?.employerSignatureData) {
                approvals.push({
                  employeeId: "employer",
                  signatureData:
                    selectedContractForPreview.employerSignatureData,
                  respondedAt: selectedContractForPreview.employerSignedAt,
                  status: "approved",
                  employeeName:
                    selectedContractForPreview.employerName || "Employer",
                });
              }

              // Add sender signature (new self-sign)
              if (selectedContractForPreview?.senderSignatureData) {
                approvals.push({
                  employeeId: "sender",
                  signatureData: selectedContractForPreview.senderSignatureData,
                  respondedAt: selectedContractForPreview.senderSignedAt,
                  status: "approved",
                  employeeName: "Employer",
                  isEmployerSignature: true,
                });
              }

              // Add employee approvals
              if (selectedContractForPreview?.employeeApprovals) {
                approvals.push(...selectedContractForPreview.employeeApprovals);
              }

              // Add applicant signature (for signed contracts)
              if (selectedContractForPreview?.applicantSignatureData) {
                // Get applicant name
                const applicant = selectedContractForPreview.applicantId;
                const applicantName =
                  typeof applicant === "object" && applicant
                    ? `${applicant.employeeFields?.personaldetails?.firstname || ""} ${applicant.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
                      "Applicant"
                    : "Applicant";

                approvals.push({
                  employeeId: "applicant",
                  signatureData:
                    selectedContractForPreview.applicantSignatureData,
                  respondedAt: selectedContractForPreview.applicantSignedAt,
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

      {/* Accept/Reject Note Modal */}
      <Transition appear show={showNoteModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => {
            if (!processingAction) {
              setShowNoteModal(false);
              setPendingAction(null);
              setSelectedContractId(null);
              setNote("");
            }
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 mb-4"
                  >
                    {pendingAction === "accept"
                      ? "Accept Contract"
                      : "Reject Contract"}
                  </Dialog.Title>

                  <div className="mt-4">
                    <Text className="text-sm text-gray-600 mb-2">
                      {pendingAction === "accept"
                        ? "Please confirm that you accept this contract. You can optionally add a note."
                        : "Please provide a reason for rejecting this contract (optional but recommended)."}
                    </Text>

                    <Textarea
                      label="Note (Optional)"
                      placeholder={
                        pendingAction === "accept"
                          ? "Add any comments or notes..."
                          : "Please provide a reason for rejection..."
                      }
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                      className="mt-2"
                    />
                  </div>

                  <div className="mt-6 flex justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (!processingAction) {
                          setShowNoteModal(false);
                          setPendingAction(null);
                          setSelectedContractId(null);
                          setNote("");
                        }
                      }}
                      disabled={processingAction}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAcceptReject}
                      disabled={processingAction}
                      className={
                        pendingAction === "accept"
                          ? "bg-green-600 hover:bg-green-700 text-white"
                          : "bg-red-600 hover:bg-red-700 text-white"
                      }
                    >
                      {processingAction
                        ? "Processing..."
                        : pendingAction === "accept"
                          ? "Accept Contract"
                          : "Reject Contract"}
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Applicant History Modal */}
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
                      Your Contract Response History
                    </Dialog.Title>
                    <button
                      onClick={() => {
                        setShowHistoryModal(false);
                        setSelectedContractForHistory(null);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {selectedContractForHistory && (
                    <div className="space-y-4">
                      {/* Contract Template Info */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <Text className="text-sm font-medium text-blue-900 mb-2">
                          Contract Template
                        </Text>
                        <Text className="text-base font-semibold text-gray-900">
                          {getTemplateTitle(
                            selectedContractForHistory.templateId
                          )}
                        </Text>
                        {typeof selectedContractForHistory.templateId ===
                          "object" &&
                          selectedContractForHistory.templateId?.version && (
                            <Text className="text-sm text-gray-600 mt-1">
                              Version:{" "}
                              {selectedContractForHistory.templateId.version}
                            </Text>
                          )}
                      </div>

                      {/* Sent to Applicant Info */}
                      {selectedContractForHistory.sentToApplicantAt && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <Text className="text-sm font-medium text-green-900 mb-1">
                            Contract Sent to You
                          </Text>
                          <Text className="text-xs text-gray-600">
                            {isMounted
                              ? new Date(
                                  selectedContractForHistory.sentToApplicantAt
                                ).toLocaleString()
                              : "Loading..."}
                          </Text>
                        </div>
                      )}

                      {/* Applicant Response Timeline */}
                      <div className="border-t border-gray-200 pt-4">
                        <Text className="text-sm font-semibold text-gray-700 mb-4">
                          Complete Response History
                        </Text>
                        <div className="space-y-4">
                          {/* Show history entries if available, otherwise show current state */}
                          {selectedContractForHistory.applicantHistory &&
                          selectedContractForHistory.applicantHistory.length >
                            0 ? (
                            // Display full chronological history
                            selectedContractForHistory.applicantHistory
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
                                            : "Pending"}
                                      </Text>
                                      <div
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          historyEntry.status === "accepted"
                                            ? "bg-green-100 text-green-700"
                                            : historyEntry.status === "rejected"
                                              ? "bg-red-100 text-red-700"
                                              : "bg-blue-100 text-blue-700"
                                        }`}
                                      >
                                        {historyEntry.status === "accepted"
                                          ? "Accepted"
                                          : historyEntry.status === "rejected"
                                            ? "Rejected"
                                            : "Pending"}
                                      </div>
                                    </div>
                                    <Text className="text-xs text-gray-500 mb-2">
                                      {isMounted
                                        ? new Date(
                                            historyEntry.createdAt
                                          ).toLocaleString()
                                        : "Loading..."}
                                    </Text>

                                    {/* Note from this history entry */}
                                    {historyEntry.note && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Your Note:
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
                                        {isMounted
                                          ? new Date(
                                              historyEntry.respondedAt
                                            ).toLocaleString()
                                          : "Loading..."}
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
                                      Contract Sent to You
                                    </Text>
                                    <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                      Pending
                                    </div>
                                  </div>
                                  <Text className="text-xs text-gray-500">
                                    {isMounted &&
                                    selectedContractForHistory.sentToApplicantAt
                                      ? new Date(
                                          selectedContractForHistory.sentToApplicantAt
                                        ).toLocaleString()
                                      : "Loading..."}
                                  </Text>
                                </div>
                              </div>

                              {/* Response (if responded) */}
                              {(selectedContractForHistory.acceptedAt ||
                                selectedContractForHistory.rejectedAt) && (
                                <div className="flex items-start gap-3">
                                  <div
                                    className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                                      selectedContractForHistory.applicantStatus ===
                                      "accepted"
                                        ? "bg-green-500"
                                        : selectedContractForHistory.applicantStatus ===
                                            "rejected"
                                          ? "bg-red-500"
                                          : "bg-amber-500"
                                    }`}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Text className="text-sm font-medium text-gray-900">
                                        {selectedContractForHistory.applicantStatus ===
                                        "accepted"
                                          ? "Accepted"
                                          : selectedContractForHistory.applicantStatus ===
                                              "rejected"
                                            ? "Rejected"
                                            : "Status Updated"}
                                      </Text>
                                      <div
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                          selectedContractForHistory.applicantStatus ===
                                          "accepted"
                                            ? "bg-green-100 text-green-700"
                                            : selectedContractForHistory.applicantStatus ===
                                                "rejected"
                                              ? "bg-red-100 text-red-700"
                                              : "bg-blue-100 text-blue-700"
                                        }`}
                                      >
                                        {selectedContractForHistory.applicantStatus ===
                                        "accepted"
                                          ? "Accepted"
                                          : selectedContractForHistory.applicantStatus ===
                                              "rejected"
                                            ? "Rejected"
                                            : "Pending"}
                                      </div>
                                    </div>
                                    <Text className="text-xs text-gray-500 mb-2">
                                      {isMounted
                                        ? selectedContractForHistory.acceptedAt
                                          ? new Date(
                                              selectedContractForHistory.acceptedAt
                                            ).toLocaleString()
                                          : selectedContractForHistory.rejectedAt
                                            ? new Date(
                                                selectedContractForHistory.rejectedAt
                                              ).toLocaleString()
                                            : "N/A"
                                        : "Loading..."}
                                    </Text>

                                    {/* Note */}
                                    {selectedContractForHistory.applicantNote && (
                                      <div className="mt-2 p-3 bg-gray-50 rounded-md border border-gray-200">
                                        <Text className="text-xs font-medium text-gray-600 mb-1">
                                          Your Note:
                                        </Text>
                                        <Text className="text-sm text-gray-700 whitespace-pre-wrap">
                                          {
                                            selectedContractForHistory.applicantNote
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

      {/* Sign Modal for applicant signature */}
      <SignModal
        isOpen={showSignModal}
        onClose={() => {
          setShowSignModal(false);
          setSelectedContractForSign(null);
        }}
        onSign={handleSign}
        userName={
          typeof selectedContractForSign?.applicantId === "object" &&
          selectedContractForSign?.applicantId
            ? `${selectedContractForSign.applicantId.employeeFields?.personaldetails?.firstname || ""} ${selectedContractForSign.applicantId.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
              "Applicant"
            : "Applicant"
        }
      />

      {/* Tamper Check Modal */}
      <TamperCheckModal
        isOpen={showTamperCheckModal}
        onClose={() => {
          setShowTamperCheckModal(false);
          setTamperCheckApprovalId(null);
        }}
        approvalId={tamperCheckApprovalId || ""}
      />
    </div>
  );
}
