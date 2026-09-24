"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button, Input } from "rizzui";
import axios from "@/app/lib/axios";
import ContractTemplatePreviewModal from "@/app/components/shared/ContractTemplatePreviewModal";
import SignModal from "@/app/components/shared/SignModal";
import TamperCheckModal from "@/app/components/shared/TamperCheckModal";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Pen,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";

export default function PublicContractViewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const templateId = params?.templateId as string;
  const applicantId = params?.applicantId as string;
  const token = searchParams?.get("token");

  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // OTP state
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "accept" | "reject" | null
  >(null);
  const [otpCode, setOtpCode] = useState("");
  const [note, setNote] = useState("");
  const [sendingOTP, setSendingOTP] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  // Signature state for accept flow
  const [showSignModal, setShowSignModal] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  // Tamper check modal state
  const [showTamperCheckModal, setShowTamperCheckModal] = useState(false);

  useEffect(() => {
    if (!templateId || !applicantId || !token) {
      setError("Missing required parameters");
      setLoading(false);
      return;
    }

    const fetchContract = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `/contract-templates/public/contract/${templateId}/${applicantId}?token=${token}`
        );
        setContract(response.data.data);
      } catch (err: any) {
        console.error("Failed to fetch contract", err);
        setError(
          err?.response?.data?.message ||
            "Failed to load contract. The link may be invalid or expired."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchContract();
  }, [templateId, applicantId, token]);

  const handleGenerateOTP = async () => {
    if (!templateId || !applicantId || !token) return;

    setSendingOTP(true);
    try {
      await axios.post(
        `/contract-templates/public/contract/${templateId}/${applicantId}/generate-otp`,
        {
          token,
        }
      );
      setOtpSent(true);
      toast.success("OTP sent to your email. Please check your inbox.");
    } catch (err: any) {
      console.error("Failed to generate OTP", err);
      toast.error(err?.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOTP(false);
    }
  };

  const handleAcceptRejectClick = (action: "accept" | "reject") => {
    setPendingAction(action);
    if (action === "accept") {
      // Show sign modal first for accept action
      setShowSignModal(true);
    } else {
      // Go directly to OTP for reject
      setShowOTPModal(true);
      setOtpCode("");
      setNote("");
      setOtpSent(false);
    }
  };

  // Handle signature completion
  const handleSign = async (signature: string): Promise<void> => {
    setSignatureData(signature);
    setShowSignModal(false);
    // After signing, show OTP modal
    setShowOTPModal(true);
    setOtpCode("");
    setNote("");
    setOtpSent(false);
  };

  const handleSubmitAction = async () => {
    if (!pendingAction || !otpCode || !templateId || !applicantId || !token)
      return;

    // For accept action, signature is required
    if (pendingAction === "accept" && !signatureData) {
      toast.error("Please sign the contract first");
      return;
    }

    setProcessingAction(true);
    try {
      await axios.post(
        `/contract-templates/public/contract/${templateId}/${applicantId}/accept-reject`,
        {
          token,
          action: pendingAction,
          otpCode,
          note: note.trim() || undefined,
          signatureData: pendingAction === "accept" ? signatureData : undefined,
        }
      );

      toast.success(
        `Contract ${pendingAction === "accept" ? "signed and accepted" : "rejected"} successfully`
      );
      setShowOTPModal(false);
      setPendingAction(null);
      setOtpCode("");
      setNote("");
      setOtpSent(false);
      setSignatureData(null);

      // Refresh contract data
      const response = await axios.get(
        `/contract-templates/public/contract/${templateId}/${applicantId}?token=${token}`
      );
      setContract(response.data.data);
    } catch (err: any) {
      console.error(`Failed to ${pendingAction} contract`, err);
      toast.error(
        err?.response?.data?.message || `Failed to ${pendingAction} contract`
      );
    } finally {
      setProcessingAction(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading contract...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Unable to Load Contract
          </h1>
          <p className="text-gray-600 mb-6">{error || "Contract not found"}</p>
          <p className="text-sm text-gray-500">
            The link may be invalid, expired, or you may not have permission to
            view this contract.
          </p>
        </div>
      </div>
    );
  }

  const approval = contract.approval;
  const canAcceptReject =
    approval?.applicantStatus === "pending" || !approval?.applicantStatus;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {contract.template?.title || "Contract"}
          </h1>
          <p className="text-gray-600">
            Please review the contract below and take action.
          </p>
        </div>

        {/* Status Badge */}
        {approval?.applicantStatus && (
          <div className="mb-6">
            {approval.applicantStatus === "accepted" ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">
                    Contract Accepted
                  </span>
                </div>
                {/* Actions for accepted contracts */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-green-200">
                  <Button
                    size="sm"
                    onClick={() => setShowPreview(true)}
                    className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  >
                    View Full Contract & Download PDF
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowTamperCheckModal(true)}
                    className="gap-1.5 border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <Shield className="h-4 w-4" />
                    Tamper Check
                  </Button>
                </div>
              </div>
            ) : approval.applicantStatus === "rejected" ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="text-red-800 font-medium">
                  Contract Rejected
                </span>
              </div>
            ) : null}
          </div>
        )}

        {/* Action Buttons */}
        {canAcceptReject && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={() => handleAcceptRejectClick("accept")}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                size="lg"
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                Accept Contract
              </Button>
              <Button
                onClick={() => handleAcceptRejectClick("reject")}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                size="lg"
              >
                <XCircle className="h-5 w-5 mr-2" />
                Reject Contract
              </Button>
            </div>
          </div>
        )}

        {/* View Contract Button */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <Button
            onClick={() => setShowPreview(true)}
            className="w-full"
            size="lg"
          >
            View Full Contract
          </Button>
        </div>

        {/* OTP Modal */}
        {showOTPModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {pendingAction === "accept" ? "Accept" : "Reject"} Contract
              </h2>

              {!otpSent ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 text-sm">
                      To {pendingAction === "accept" ? "accept" : "reject"} this
                      contract, we need to verify your identity. Click the
                      button below to receive an OTP code via email.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateOTP}
                    disabled={sendingOTP}
                    className="w-full"
                    size="lg"
                  >
                    {sendingOTP ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Sending OTP...
                      </>
                    ) : (
                      "Send OTP to Email"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 text-sm">
                      ✓ OTP sent to your email. Please check your inbox and
                      enter the code below.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      OTP Code
                    </label>
                    <Input
                      type="text"
                      value={otpCode}
                      onChange={(e) =>
                        setOtpCode(
                          e.target.value.replace(/\D/g, "").slice(0, 6)
                        )
                      }
                      placeholder="Enter 6-digit OTP"
                      maxLength={6}
                      className="text-center text-2xl font-mono tracking-widest"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note (Optional)
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add any comments or questions..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        setShowOTPModal(false);
                        setPendingAction(null);
                        setOtpCode("");
                        setNote("");
                        setOtpSent(false);
                      }}
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmitAction}
                      disabled={
                        !otpCode || otpCode.length !== 6 || processingAction
                      }
                      className={`flex-1 ${
                        pendingAction === "accept"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-red-600 hover:bg-red-700"
                      } text-white`}
                    >
                      {processingAction ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        `${pendingAction === "accept" ? "Accept" : "Reject"} Contract`
                      )}
                    </Button>
                  </div>
                </div>
              )}

              <button
                onClick={() => {
                  setShowOTPModal(false);
                  setPendingAction(null);
                  setOtpCode("");
                  setNote("");
                  setOtpSent(false);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Contract Preview Modal */}
        {showPreview && contract.template && (
          <ContractTemplatePreviewModal
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
            title={contract.template.title}
            description={contract.template.description}
            version={contract.template.version}
            builder={contract.template.builder}
            initialEmployeeId={applicantId}
            readOnly={true}
            publicEmployeeData={contract.applicant}
            // Pass snapshot employee data for accepted contracts so preview shows finalized data
            snapshotEmployeeData={
              contract.approval?.applicantStatus === "accepted"
                ? contract.applicant
                : undefined
            }
            // PDF and Tamper Check props
            approvalId={contract.approval?._id}
            applicantStatus={contract.approval?.applicantStatus}
            isPublicView={true}
            publicToken={token || undefined}
            templateId={templateId}
            initialApprovals={
              // Build approvals array with all signatures
              (() => {
                const approvals: any[] = [];
                const approval = contract.approval;

                // Add employer signature first (for self-signed contracts)
                if (approval?.employerSignatureData) {
                  approvals.push({
                    employeeId: "employer",
                    signatureData: approval.employerSignatureData,
                    respondedAt: approval.employerSignedAt,
                    status: "approved",
                    employeeName: approval.employerName || "Employer",
                    isEmployerSignature: true,
                  });
                }

                // Add sender signature (new self-sign)
                if (approval?.senderSignatureData) {
                  approvals.push({
                    employeeId: "sender",
                    signatureData: approval.senderSignatureData,
                    respondedAt: approval.senderSignedAt,
                    status: "approved",
                    employeeName: "Employer",
                    isEmployerSignature: true,
                  });
                }

                // Add employee approvals
                if (approval?.employeeApprovals) {
                  const processedApprovals = approval.employeeApprovals.map(
                    (ea: any) => {
                      // Extract details if employeeId is populated
                      let employeeName = ea.employeeName;
                      let designation = ea.designation;
                      let employeeId = ea.employeeId;

                      if (typeof ea.employeeId === "object" && ea.employeeId) {
                        const emp = ea.employeeId;
                        employeeId = emp._id;

                        const firstName =
                          emp.employeeFields?.personaldetails?.firstname || "";
                        const lastName =
                          emp.employeeFields?.personaldetails?.lastname || "";
                        employeeName = `${firstName} ${lastName}`.trim();

                        const desig = emp.designation;
                        if (
                          desig &&
                          typeof desig === "object" &&
                          "name" in desig
                        ) {
                          designation = (desig as any).name;
                        } else if (desig) {
                          designation = String(desig);
                        }
                      }

                      return {
                        ...ea,
                        employeeId,
                        employeeName,
                        designation,
                      };
                    }
                  );
                  approvals.push(...processedApprovals);
                }

                // Add applicant signature (for signed contracts)
                if (approval?.applicantSignatureData) {
                  const applicant = contract.applicant;
                  const applicantName = applicant
                    ? `${applicant.employeeFields?.personaldetails?.firstname || ""} ${applicant.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
                      "Applicant"
                    : "Applicant";

                  approvals.push({
                    employeeId: "applicant",
                    signatureData: approval.applicantSignatureData,
                    respondedAt: approval.applicantSignedAt,
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

        {/* Sign Modal for signing on accept */}
        <SignModal
          isOpen={showSignModal}
          onClose={() => {
            setShowSignModal(false);
            setPendingAction(null);
          }}
          onSign={handleSign}
          userName={
            contract?.applicant
              ? `${contract.applicant.employeeFields?.personaldetails?.firstname || ""} ${contract.applicant.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
                "Applicant"
              : "Applicant"
          }
        />

        {/* Tamper Check Modal */}
        <TamperCheckModal
          isOpen={showTamperCheckModal}
          onClose={() => setShowTamperCheckModal(false)}
          approvalId={contract?.approval?._id || ""}
          isPublic={true}
          templateId={templateId}
          applicantId={applicantId}
          token={token || ""}
        />
      </div>
    </div>
  );
}
