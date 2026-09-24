"use client";

import { Dialog, Transition } from "@headlessui/react";
import {
  Fragment,
  useEffect,
  useState,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { Button, Select } from "rizzui";
import { X, FileText, CheckCircle2, Shield, Download } from "lucide-react";
import DownloadPdfButton from "./DownloadPdfButton";
import TamperCheckModal from "./TamperCheckModal";
import dynamic from "next/dynamic";
import axios from "@/app/lib/axios";
import { getProfileOrAdditionalValue } from "@/app/utils/employee-field-helpers";
import toast from "react-hot-toast";
import SignModal from "./SignModal";
import { useAppSelector } from "@/app/store/hook";

type Clause = {
  id: string;
  order: number;
  heading: string; // Rich text heading
  text: string; // Rich text content with field tokens
  numberText?: string; // Rich text item number (e.g., "1.", "A.", etc.)
  category: string; // Can be standard categories or custom
  optional: boolean;
  defaultIncluded: boolean;
  subclauses?: { id: string; number?: string; text: string }[];
};

type Builder = {
  meta: { version: string; recommended: boolean };
  body: {
    title: string;
    description?: string; // Description field for Body & Clauses section
    backgroundTitle?: string; // Rich text title for the Background section
    backgrounds: (string | { content: string; numberText?: string })[];
    clauseTitle?: string; // Rich text title for the Clauses section
    clauses: Clause[];
  };
  fields: {
    employee: string[];
    organization: string[];
    custom: {
      key: string;
      label: string;
      type: string;
      required?: boolean;
      defaultValue?: any;
      validation?: any;
    }[];
  };
  schedule: {
    title?: string; // Rich text title for the Schedule section
    items: {
      key: string;
      label: string;
      order: number;
      fieldRef?: string;
      fieldRefs?: string[];
      fieldMappingFormats?: Record<string, string>; // Map of fieldRef to formatted HTML
      defaultText?: string;
    }[];
  };
  logic: { clauseDefaults: Record<string, boolean>; rules: any[] };
  signing: {
    roles: {
      key: string;
      label: string;
      type: string;
      order: number;
      signatureMode: string;
      dateFormat: string;
    }[];
    cc: string[];
    approvals?: {
      employeeIds: string[];
      employeeSettings?: {
        employeeId: string;
        requireSignature: boolean;
        signatureType?: "typed" | "drawn" | "upload";
      }[];
      status?: "pending" | "approved" | "rejected";
      sentForApproval?: boolean;
      sentAt?: string;
      approvals?: {
        employeeId: string;
        status: "pending" | "approved" | "rejected";
        respondedAt?: string;
      }[];
    };
  };
};

type ContractTemplatePreviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  version?: string;
  builder: Builder;
  initialEmployeeId?: string; // Optional: pre-select an employee
  templateId?: string; // Optional: template ID for sending approvals
  readOnly?: boolean; // Optional: if true, hides employee selector and approval actions
  initialApprovals?: any[]; // Optional: pass existing approvals directly (avoids fetching)
  snapshotEmployeeData?: any; // Optional: employee data from snapshot (for finalized contracts)
  publicEmployeeData?: Employee; // Optional: pass employee data directly (for public view without auth)
  // PDF download props
  approvalId?: string; // Optional: approval ID for PDF download
  applicantStatus?: "pending" | "accepted" | "rejected"; // Optional: applicant status for showing PDF buttons
  isPublicView?: boolean; // Optional: flag for public view
  publicToken?: string; // Optional: public access token
};

interface Employee {
  _id: string;
  employeeFields?: {
    personaldetails?: {
      firstname?: string;
      middlename?: string;
      lastname?: string;
      mobile?: string;
      employeephoto?: { url?: string } | string;
    };
    employeedetails?: any;
    additionalFields?: any[];
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
  designation?: {
    name?: string;
  };
  email?: string;
}

export default function ContractTemplatePreviewModal({
  isOpen,
  onClose,
  title,
  description,
  version,
  builder,
  initialEmployeeId,
  templateId,
  readOnly = false,
  initialApprovals,
  snapshotEmployeeData,
  publicEmployeeData,
  approvalId,
  applicantStatus,
  isPublicView = false,
  publicToken,
}: ContractTemplatePreviewModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(
    initialEmployeeId || ""
  );
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [approvalEmployees, setApprovalEmployees] = useState<Employee[]>([]);
  const [loadingApprovalEmployees, setLoadingApprovalEmployees] =
    useState(false);
  const [sendingApproval, setSendingApproval] = useState(false);
  const [selfSignRequired, setSelfSignRequired] = useState(false); // Self Sign Required checkbox

  // Get current user for Select Self feature (not available in public view)
  const { user } = useAppSelector((state) => state.auth);
  const currentUserEmployeeId = !isPublicView
    ? user?.activeAssignment?.employeeId
    : undefined;

  // PDF Tamper Check Modal State
  const [showTamperCheckModal, setShowTamperCheckModal] = useState(false);
  const [existingApprovals, setExistingApprovals] = useState<any[]>(
    initialApprovals || []
  );
  const [loadingApprovals, setLoadingApprovals] = useState(false);

  // Editable approver state - allows modifying approvers before sending
  const [editableApproverIds, setEditableApproverIds] = useState<string[]>([]);
  const [editableApproverSettings, setEditableApproverSettings] = useState<
    {
      employeeId: string;
      requireSignature: boolean;
      signatureType?: "typed" | "drawn" | "upload";
    }[]
  >([]);
  const [showAddApproverDropdown, setShowAddApproverDropdown] = useState(false);

  // Self-sign state for employers when no approvers are configured
  const [showSelfSignModal, setShowSelfSignModal] = useState(false);
  const [selfSigning, setSelfSigning] = useState(false);
  const [sendingToApplicant, setSendingToApplicant] = useState(false);

  const selectedEmployee = employees.find(
    (emp) => emp._id === selectedEmployeeId
  );

  // Ref to track if we've already auto-selected to prevent infinite loops
  const hasAutoSelectedRef = useRef(false);
  const isManualSelectionRef = useRef(false);

  // Ref for capturing preview content for PDF generation
  const contentRef = useRef<HTMLDivElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Helper function to compute SHA-256 hash of a blob
  const computeSha256Hash = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  // Client-side PDF generation function with caching for consistent downloads
  const generatePdfFromPreview = useCallback(async () => {
    if (!approvalId) {
      toast.error("Cannot download PDF: missing approval ID");
      return;
    }

    setGeneratingPdf(true);
    try {
      const contractTitle =
        builder.body?.title || title || "Employment_Contract";
      const filename = `${contractTitle.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`;

      // Step 1: Try to get cached PDF first (ensures consistent downloads)
      try {
        let cachedPdfUrl: string;
        if (isPublicView && templateId && initialEmployeeId && publicToken) {
          cachedPdfUrl = `/contract-templates/public/contract/${templateId}/${initialEmployeeId}/cached-pdf?token=${publicToken}`;
        } else {
          cachedPdfUrl = `/contract-templates/approvals/${approvalId}/cached-pdf`;
        }

        const cachedResponse = await axios.get(cachedPdfUrl, {
          responseType: "blob",
          // @ts-ignore
          skipToast: true, // Don't show error toast for expected 404
        });

        if (cachedResponse.status === 200 && cachedResponse.data) {
          console.log("[PDF DOWNLOAD] Using cached PDF from server");
          // Download cached PDF
          const url = URL.createObjectURL(cachedResponse.data);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          toast.success("PDF downloaded successfully!");
          return;
        }
      } catch (cacheError: any) {
        // 404 means no cached PDF - proceed to generate
        if (cacheError?.response?.status !== 404) {
          console.warn("[PDF DOWNLOAD] Cache check failed:", cacheError);
        }
        console.log("[PDF DOWNLOAD] No cached PDF, generating new one...");
      }

      // Step 2: Generate PDF client-side if not cached
      if (!contentRef.current) {
        toast.error("Unable to capture preview content");
        return;
      }

      const html2pdf = (await import("html2pdf.js")).default;
      const element = contentRef.current;

      // Temporarily hide elements that should not appear in PDF
      const hiddenElements = element.querySelectorAll(".pdf-hide");
      hiddenElements.forEach((el) => {
        (el as HTMLElement).style.display = "none";
      });

      const opt = {
        margin: [10, 10, 10, 10],
        filename: filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          letterRendering: true,
          logging: false,
          scrollY: 0,
          windowHeight: element.scrollHeight,
        },
        jsPDF: {
          unit: "mm",
          format: "a4",
          orientation: "portrait",
          compress: true,
        },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: ["tr", "td", ".signature-box"],
        },
      };

      // Generate PDF as blob
      const pdfBlob = await html2pdf().set(opt).from(element).outputPdf("blob");

      // Restore hidden elements
      hiddenElements.forEach((el) => {
        (el as HTMLElement).style.display = "";
      });

      console.log("[PDF DOWNLOAD] Generated PDF, size:", pdfBlob.size);

      // Step 3: Cache the PDF on server (first download wins)
      try {
        const formData = new FormData();
        formData.append("pdf", pdfBlob, filename);

        let cacheUrl: string;
        if (isPublicView && templateId && initialEmployeeId && publicToken) {
          cacheUrl = `/contract-templates/public/contract/${templateId}/${initialEmployeeId}/cache-pdf?token=${publicToken}`;
        } else {
          cacheUrl = `/contract-templates/approvals/${approvalId}/cache-pdf`;
        }

        await axios.post(cacheUrl, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        console.log("[PDF DOWNLOAD] PDF cached on server for future downloads");
      } catch (cacheError) {
        console.warn(
          "[PDF DOWNLOAD] Failed to cache PDF (may already exist):",
          cacheError
        );
        // Don't block download if caching fails
      }

      // Step 4: Trigger download
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("PDF generation error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  }, [
    builder.body?.title,
    title,
    approvalId,
    isPublicView,
    templateId,
    initialEmployeeId,
    publicToken,
  ]);

  // Helper to collect ALL signatures from approvals for display
  const allSignatures = useMemo(() => {
    if (!existingApprovals || existingApprovals.length === 0) return [];

    const signatures: {
      employeeId: string;
      signatureData: string;
      respondedAt?: string;
      employeeName?: string;
      designation?: string;
      isApplicantSignature?: boolean;
      isEmployerSignature?: boolean;
    }[] = [];

    for (const approval of existingApprovals) {
      if (approval.signatureData) {
        const empId =
          approval.employeeId?._id?.toString() ||
          approval.employeeId?.toString() ||
          approval.employeeId;

        // Try to get employee details from the approval data or employees list
        let employeeName = "";
        let designation = "";

        // First check if employeeName is directly on the approval (synthetic employer/applicant entry, or pre-processed)
        if (approval.employeeName) {
          employeeName = approval.employeeName;
          // Trust the processed designation if it exists, otherwise fallback to logic
          if (approval.designation) {
            designation = approval.designation;
          } else {
            designation = approval.isEmployerSignature
              ? "Employer"
              : approval.isApplicantSignature
                ? "Applicant"
                : "";
          }
        }
        // Check if employee data is embedded in approval
        else if (
          approval.employeeId &&
          typeof approval.employeeId === "object"
        ) {
          const emp = approval.employeeId as any;
          const firstName =
            emp.employeeFields?.personaldetails?.firstname || "";
          const lastName = emp.employeeFields?.personaldetails?.lastname || "";
          employeeName = `${firstName} ${lastName}`.trim();
          designation = emp.designation?.name || "";
        }

        // Fallback: look up from employees array
        if (!employeeName && employees.length > 0) {
          const emp = employees.find((e: Employee) => e._id === empId);
          if (emp) {
            const firstName =
              emp.employeeFields?.personaldetails?.firstname || "";
            const lastName =
              emp.employeeFields?.personaldetails?.lastname || "";
            employeeName = `${firstName} ${lastName}`.trim();
            designation = emp.designation?.name || "";
          }
        }

        signatures.push({
          employeeId: empId,
          signatureData: approval.signatureData,
          respondedAt: approval.respondedAt,
          employeeName,
          designation,
          // Preserve the signature type flags
          isApplicantSignature: approval.isApplicantSignature || false,
          isEmployerSignature: approval.isEmployerSignature || false,
        });
      }
    }

    return signatures;
  }, [existingApprovals, employees]);

  // For backward compatibility - get first signature if any exist
  const currentEmployeeSignature =
    allSignatures.length > 0 ? allSignatures[0].signatureData : null;

  // State for approver employee details (fetched separately)
  const [approverEmployees, setApproverEmployees] = useState<
    Record<string, Employee>
  >({});
  const fetchedApproverIdsRef = useRef<Set<string>>(new Set());

  // Fetch employee details for approvers not in the employees list
  useEffect(() => {
    const fetchApproverDetails = async () => {
      // Skip API calls in public view (no authentication available)
      if (publicEmployeeData) {
        console.log(
          "[DEBUG PREVIEW] Skipping approver fetch - public view mode"
        );
        return;
      }

      if (!allSignatures || allSignatures.length === 0) return;

      const missingEmployeeIds = allSignatures
        .filter((sig) => {
          // Check if we already have this employee's data
          const inEmployeesList = employees.some(
            (e) => e._id === sig.employeeId
          );
          const alreadyFetched = fetchedApproverIdsRef.current.has(
            sig.employeeId
          );
          return !inEmployeesList && !alreadyFetched && !sig.employeeName;
        })
        .map((sig) => sig.employeeId);

      if (missingEmployeeIds.length === 0) return;

      console.log(
        "[DEBUG PREVIEW] Fetching missing approver details for:",
        missingEmployeeIds
      );

      for (const employeeId of missingEmployeeIds) {
        fetchedApproverIdsRef.current.add(employeeId);
        try {
          const res = await axios.get(`/employees/${employeeId}`);
          console.log(
            `[DEBUG PREVIEW] API Response for ${employeeId}:`,
            res.data?.data
          );
          console.log(
            `[DEBUG PREVIEW] Designation data:`,
            res.data?.data?.designation
          );
          if (res.data?.data) {
            setApproverEmployees((prev) => ({
              ...prev,
              [employeeId]: res.data.data,
            }));
          }
        } catch (err) {
          console.error(
            `[DEBUG PREVIEW] Failed to fetch employee ${employeeId}:`,
            err
          );
        }
      }
    };

    fetchApproverDetails();
  }, [allSignatures, employees, publicEmployeeData]);

  // Enhanced helper to get employee name/designation with fallback to approverEmployees
  // Use useCallback to ensure the function updates when dependencies change
  const getApproverInfo = useCallback(
    (employeeId: string): { name: string; designation: string } => {
      console.log(`[DEBUG PREVIEW] getApproverInfo called for:`, employeeId);

      // Check allSignatures first (may have embedded data)
      const sig = allSignatures.find((s) => s.employeeId === employeeId);
      if (sig?.employeeName) {
        console.log(`[DEBUG PREVIEW] Found in allSignatures:`, {
          name: sig.employeeName,
          designation: sig.designation,
        });
        return { name: sig.employeeName, designation: sig.designation || "" };
      }

      // Check employees list
      const emp = employees.find((e) => e._id === employeeId);
      if (emp) {
        const name =
          `${emp.employeeFields?.personaldetails?.firstname || ""} ${emp.employeeFields?.personaldetails?.lastname || ""}`.trim();
        const designation = emp.designation?.name || "";
        console.log(`[DEBUG PREVIEW] Found in employees list:`, {
          name,
          designation,
          rawDesignation: emp.designation,
        });
        return { name, designation };
      }

      // Check fetched approverEmployees
      const approverEmp = approverEmployees[employeeId];
      if (approverEmp) {
        const name =
          `${approverEmp.employeeFields?.personaldetails?.firstname || ""} ${approverEmp.employeeFields?.personaldetails?.lastname || ""}`.trim();
        const designation = approverEmp.designation?.name || "";
        console.log(`[DEBUG PREVIEW] Found in approverEmployees:`, {
          name,
          designation,
          rawDesignation: approverEmp.designation,
        });
        return { name, designation };
      }

      console.log(`[DEBUG PREVIEW] Employee not found:`, employeeId);
      return { name: "", designation: "" };
    },
    [allSignatures, employees, approverEmployees]
  );

  // Update selectedEmployeeId when initialEmployeeId changes
  useEffect(() => {
    if (initialEmployeeId && !isManualSelectionRef.current) {
      setSelectedEmployeeId(initialEmployeeId);
      hasAutoSelectedRef.current = true;
    }
  }, [initialEmployeeId]);

  // Fetch employees when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      // Reset refs when modal opens
      hasAutoSelectedRef.current = false;
      isManualSelectionRef.current = false;
    }
  }, [isOpen]);

  // Fetch a specific employee by ID (used when employee is not in the filtered list)
  const fetchSpecificEmployee = async (employeeId: string) => {
    try {
      const employeeRes = await axios.get(`/employees/${employeeId}`);
      if (employeeRes.data?.data) {
        const employee = employeeRes.data.data;
        console.log(
          `[CONTRACT PREVIEW] Fetched specific employee:`,
          employee._id
        );
        // Add to employees list if not already there
        setEmployees((prev) => {
          if (!prev.find((emp) => emp._id === employeeId)) {
            return [employee, ...prev];
          }
          return prev;
        });
        if (!isManualSelectionRef.current) {
          setSelectedEmployeeId(employeeId);
          hasAutoSelectedRef.current = true;
        }
      }
    } catch (err: any) {
      console.error(
        `[CONTRACT PREVIEW] Failed to fetch employee ${employeeId}:`,
        err
      );
      toast.error("Failed to load employee data for contract preview");
    }
  };

  // Auto-select employee when employees are loaded and initialEmployeeId is set
  useEffect(() => {
    // Only run if we haven't auto-selected yet and it's not a manual selection
    if (
      initialEmployeeId &&
      employees.length > 0 &&
      !hasAutoSelectedRef.current &&
      !isManualSelectionRef.current
    ) {
      const employeeExists = employees.some(
        (emp) => emp._id === initialEmployeeId
      );
      // Use a ref to track the current selectedEmployeeId to avoid dependency issues
      if (employeeExists) {
        // Check if already selected to avoid unnecessary updates
        const currentSelected = employees.find(
          (emp) => emp._id === selectedEmployeeId
        );
        if (!currentSelected || currentSelected._id !== initialEmployeeId) {
          console.log(
            `[CONTRACT PREVIEW] Auto-selecting employee ${initialEmployeeId}`
          );
          setSelectedEmployeeId(initialEmployeeId);
          hasAutoSelectedRef.current = true;
        }
      } else if (!employeeExists && readOnly && !publicEmployeeData) {
        // In read-only mode, if employee not found, try to fetch them directly
        // Skip in public view to avoid 401 errors
        console.log(
          `[CONTRACT PREVIEW] Employee ${initialEmployeeId} not in list, fetching directly...`
        );
        fetchSpecificEmployee(initialEmployeeId);
      }
    }
  }, [employees, initialEmployeeId, readOnly, publicEmployeeData]); // Keep selectedEmployeeId out to prevent loops, but check it in the effect

  // Fetch existing approvals when templateId is available (skip in public view)
  useEffect(() => {
    if (templateId && isOpen) {
      if (initialApprovals && initialApprovals.length > 0) {
        setExistingApprovals(initialApprovals);
      } else if (!publicEmployeeData) {
        // Only fetch approvals if not in public view (avoids 401)
        fetchExistingApprovals();
      }
    }
  }, [templateId, isOpen, initialApprovals, publicEmployeeData]);

  // Fetch approval employees when approval modal opens
  useEffect(() => {
    if (showApprovalModal) {
      fetchApprovalEmployees();
      if (templateId) {
        fetchExistingApprovals();
      }
    }
  }, [showApprovalModal, templateId]);

  const fetchExistingApprovals = async () => {
    if (!templateId) return;

    setLoadingApprovals(true);
    try {
      const res = await axios.get(
        `/contract-templates/${templateId}/approvals`
      );
      const approvals = res.data.data || [];
      setExistingApprovals(approvals);
    } catch (err: any) {
      // If 404, no approvals exist yet - that's fine
      if (err?.response?.status !== 404) {
        console.error("Failed to fetch existing approvals", err);
      }
      setExistingApprovals([]);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const fetchApprovalEmployees = async () => {
    const approvalEmployeeIds = builder.signing?.approvals?.employeeIds || [];
    const approvalSettings = builder.signing?.approvals?.employeeSettings || [];

    // Initialize editable state from builder defaults
    setEditableApproverIds([...approvalEmployeeIds]);
    setEditableApproverSettings(
      approvalEmployeeIds.map((empId: string) => {
        const existing = approvalSettings.find((s) => s.employeeId === empId);
        return {
          employeeId: empId,
          requireSignature: existing?.requireSignature || false,
          signatureType: existing?.signatureType,
        };
      })
    );

    if (approvalEmployeeIds.length === 0) {
      setApprovalEmployees([]);
      return;
    }

    setLoadingApprovalEmployees(true);
    try {
      const res = await axios.get("/employees", {
        params: {
          page: 1,
          limit: 1000,
          search: "",
        },
      });

      const allEmployees = res.data.data || [];
      // Filter to only include employees in the approval list
      const filtered = allEmployees.filter((emp: Employee) =>
        approvalEmployeeIds.includes(emp._id)
      );
      setApprovalEmployees(filtered);
    } catch (err: any) {
      console.error("Failed to fetch approval employees", err);
      toast.error("Failed to load approval employees");
      setApprovalEmployees([]);
    } finally {
      setLoadingApprovalEmployees(false);
    }
  };

  const handleSendForApproval = async () => {
    if (!templateId) {
      toast.error("Template ID is required to send for approval");
      return;
    }

    // Check if approval already exists for the current applicant (the one whose contract is being viewed)
    const currentApplicantId = selectedEmployeeId || initialEmployeeId;
    const currentEmployeeApproval = existingApprovals.find((a: any) => {
      if (!currentApplicantId) return false;
      // Check if this approval is for the current applicant
      const approvalApplicantId = a.applicantId?.toString() || a.applicantId;
      return (
        approvalApplicantId &&
        (approvalApplicantId === currentApplicantId.toString() ||
          String(approvalApplicantId) === String(currentApplicantId))
      );
    });

    if (currentEmployeeApproval) {
      if (currentEmployeeApproval.status === "pending") {
        toast.error(
          `This contract has already been sent for approval for ${selectedEmployee?.employeeFields?.personaldetails?.firstname || "this employee"} and is currently pending. Please wait for the approval process to complete.`
        );
        return;
      }

      if (currentEmployeeApproval.status === "approved") {
        toast.error(
          `This contract has already been approved for ${selectedEmployee?.employeeFields?.personaldetails?.firstname || "this employee"}. You cannot send it for approval again.`
        );
        return;
      }

      if (currentEmployeeApproval.status === "rejected") {
        // Allow resending if it was rejected
        toast(
          "Previous approval was rejected. Sending new approval request..."
        );
      }
    }

    // Use editable state instead of builder (allows runtime modifications)
    if (editableApproverIds.length === 0) {
      toast.error("No employees selected for approval");
      return;
    }

    setSendingApproval(true);
    try {
      // Get employee settings from editable state
      const employees = editableApproverIds.map((employeeId: string) => {
        const setting = editableApproverSettings.find(
          (s) => s.employeeId === employeeId
        );
        return {
          employeeId,
          requireSignature: setting?.requireSignature || false,
          signatureType: setting?.signatureType,
        };
      });

      // Call backend API to send approval requests with applicantId
      await axios.post(`/contract-templates/${templateId}/send-approval`, {
        employees,
        applicantId: currentApplicantId, // Pass the applicant ID (the employee whose contract is being viewed)
        selfSignRequired, // Pass self sign required setting
      });

      // Refresh approvals after sending
      await fetchExistingApprovals();

      toast.success("Contract sent for approval successfully");
      setShowApprovalModal(false);
    } catch (error: any) {
      console.error("Failed to send for approval", error);
      toast.error(
        error?.response?.data?.message || "Failed to send for approval"
      );
    } finally {
      setSendingApproval(false);
    }
  };

  // Check if the current applicant (whose contract is being viewed) has a pending approval
  const currentApplicantId = selectedEmployeeId || initialEmployeeId;
  const currentEmployeeApproval = existingApprovals.find((a: any) => {
    if (!currentApplicantId) return false;
    // Check if this approval is for the current applicant
    const approvalApplicantId = a.applicantId?.toString() || a.applicantId;
    return (
      approvalApplicantId &&
      (approvalApplicantId === currentApplicantId.toString() ||
        String(approvalApplicantId) === String(currentApplicantId))
    );
  });
  const hasPendingApprovalForCurrentEmployee =
    currentEmployeeApproval?.status === "pending";
  const hasApprovalForCurrentEmployee = !!currentEmployeeApproval;

  // Check if no approvers are configured in the template
  const hasNoApprovers = useMemo(() => {
    const approverIds = builder.signing?.approvals?.employeeIds || [];
    return approverIds.length === 0;
  }, [builder.signing?.approvals?.employeeIds]);

  // Check if contract has been self-signed (employer signed without approvers)
  const isSelfSigned =
    currentEmployeeApproval?.employerSignatureData && hasNoApprovers;

  // Check if contract can be sent to applicant (self-signed but not yet sent)
  const canSendToApplicant =
    isSelfSigned && !currentEmployeeApproval?.sentToApplicantAt;

  // Handle self-sign by employer
  const handleSelfSign = async (signatureData: string) => {
    if (!templateId || !currentApplicantId) {
      toast.error("Template ID and applicant are required");
      return;
    }

    setSelfSigning(true);
    try {
      await axios.post(`/contract-templates/${templateId}/self-sign`, {
        applicantId: currentApplicantId,
        signatureData,
      });

      toast.success("Contract signed successfully!");
      setShowSelfSignModal(false);

      // Refresh approvals to show updated status
      await fetchExistingApprovals();
    } catch (error: any) {
      console.error("Failed to self-sign contract:", error);
      toast.error(error?.response?.data?.message || "Failed to sign contract");
    } finally {
      setSelfSigning(false);
    }
  };

  // Handle sending contract to applicant after self-signing
  const handleSendToApplicant = async () => {
    if (!templateId || !currentApplicantId) {
      toast.error("Template ID and applicant are required");
      return;
    }

    setSendingToApplicant(true);
    try {
      await axios.post(`/contract-templates/${templateId}/send-to-applicant`, {
        applicantId: currentApplicantId,
      });

      toast.success("Contract sent to applicant successfully!");

      // Refresh approvals to show updated status
      await fetchExistingApprovals();
    } catch (error: any) {
      console.error("Failed to send to applicant:", error);
      toast.error(
        error?.response?.data?.message || "Failed to send to applicant"
      );
    } finally {
      setSendingToApplicant(false);
    }
  };

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      // If publicEmployeeData is provided (for public view), use it directly without API calls
      if (publicEmployeeData) {
        console.log(
          "Using public employee data directly:",
          publicEmployeeData._id
        );
        setEmployees([publicEmployeeData]);
        setSelectedEmployeeId(
          publicEmployeeData._id || initialEmployeeId || ""
        );
        setLoadingEmployees(false);
        return;
      }

      // If initialEmployeeId is provided and we're in read-only mode (viewing from My Contracts),
      // fetch that specific employee first to ensure they're available
      if (initialEmployeeId && readOnly) {
        try {
          const employeeRes = await axios.get(
            `/employees/${initialEmployeeId}`
          );
          if (employeeRes.data?.data) {
            const applicantEmployee = employeeRes.data.data;
            console.log("Fetched applicant employee:", applicantEmployee._id);
            // Set this employee immediately so fields can be populated
            setEmployees([applicantEmployee]);
            setSelectedEmployeeId(initialEmployeeId);
            setLoadingEmployees(false);
            return; // Early return - we have the employee we need
          }
        } catch (err: any) {
          console.warn(
            "Failed to fetch specific employee, falling back to full list:",
            err
          );
          // Continue to fetch full list as fallback
        }
      }

      // Fetch all employees with a high limit to get all employees for the current tenant/branch
      // The backend automatically filters by tenantId and branchId from the logged-in user
      const res = await axios.get("/employees", {
        params: {
          page: 1,
          limit: 1000, // High limit to get all employees
          search: "", // Empty search to get all
        },
      });

      const allEmployees = res.data.data || [];
      console.log("Fetched employees:", allEmployees.length);

      // For applicants page, include all employees (not just onboard)
      // This allows viewing contracts for applicants as well
      // Filter only onboard employees (employees with employmentStatus === "Onboard")
      const onboardEmployees = allEmployees.filter((emp: Employee) => {
        const employmentStatus = getProfileOrAdditionalValue(
          emp,
          "employeedetails",
          "employmentstatus"
        );
        // Include employees that are "Onboard" or don't have employment status set
        // (in case some employees don't have this field yet)
        // Also include the initialEmployeeId if provided (for applicants)
        if (initialEmployeeId && emp._id === initialEmployeeId) {
          return true;
        }
        return employmentStatus === "Onboard" || !employmentStatus;
      });

      console.log("Onboard employees:", onboardEmployees.length);

      // If initialEmployeeId is provided but not in the filtered list, add it
      if (initialEmployeeId) {
        const applicantInList = onboardEmployees.find(
          (emp) => emp._id === initialEmployeeId
        );
        if (!applicantInList) {
          // Try to find in allEmployees
          const applicantFromAll = allEmployees.find(
            (emp) => emp._id === initialEmployeeId
          );
          if (applicantFromAll) {
            console.log(
              "Adding applicant to employees list:",
              initialEmployeeId
            );
            onboardEmployees.unshift(applicantFromAll); // Add to beginning
          }
        }
      }

      setEmployees(onboardEmployees);

      // If no onboard employees but we have employees, show all of them
      if (onboardEmployees.length === 0 && allEmployees.length > 0) {
        console.log("No onboard employees found, showing all employees");
        setEmployees(allEmployees);
      }
    } catch (err: any) {
      console.error("Failed to fetch employees", err);
      // Show error in console for debugging
      if (err.response) {
        console.error("Error response:", err.response.data);
      }
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  };

  // Get clauses that should be included (default included or explicitly enabled)
  const includedClauses = (builder.body?.clauses || []).filter((clause) => {
    // Safely check clauseDefaults - handle undefined/null cases
    const clauseDefaults = builder.logic?.clauseDefaults || {};
    const isExplicitlyDisabled = clauseDefaults[clause.id] === false;
    const isDefaultIncluded = clause.defaultIncluded !== false;
    return !isExplicitlyDisabled && isDefaultIncluded;
  });

  // Sort schedule items by order - handle both old (array) and new (object) formats
  const scheduleItems = Array.isArray(builder.schedule)
    ? builder.schedule
    : builder.schedule?.items || [];
  const sortedSchedule = [...scheduleItems].sort(
    (a, b) => (a.order || 0) - (b.order || 0)
  );
  const scheduleTitle = Array.isArray(builder.schedule)
    ? "SCHEDULE"
    : builder.schedule?.title || "SCHEDULE";

  // Helper function to process HTML: convert badges to styled display badges or replace with values, preserve all formatting
  const processHTML = (html: string): string => {
    if (!html) return "";
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Process all field-token badges
    temp.querySelectorAll(".field-token").forEach((badge) => {
      const placeholder = badge.getAttribute("data-placeholder");
      if (!placeholder) {
        badge.remove();
        return;
      }

      // Extract field type and key from placeholder (e.g., "{{employee.name}}" -> "employee", "name")
      const match = placeholder.match(
        /^\{\{(employee|custom|organization)\.([^}]+)\}\}$/
      );
      if (!match) {
        badge.remove();
        return;
      }

      const [, fieldType, fieldKey] = match;
      let replacement: string | null = null;

      // Try to get actual value based on field type
      if (fieldType === "employee") {
        // Try selectedEmployee first
        if (selectedEmployee) {
          replacement = getEmployeeFieldValue(fieldKey, selectedEmployee);
        } else if (initialEmployeeId) {
          // Fallback to employee from initialEmployeeId if selectedEmployee not set
          const employee = employees.find(
            (emp) => emp._id === initialEmployeeId
          );
          if (employee) {
            replacement = getEmployeeFieldValue(fieldKey, employee);
          }
        }
      } else if (fieldType === "custom") {
        const customField = builder.fields.custom?.find(
          (f) => f.key === fieldKey
        );
        if (
          customField?.defaultValue !== undefined &&
          customField.defaultValue !== null &&
          String(customField.defaultValue).trim() !== ""
        ) {
          replacement = String(customField.defaultValue);
        }
      }

      // If we have a replacement value, replace the badge with the value (preserve font size and color from parent/siblings)
      if (replacement) {
        // Helper function to extract style property from style attribute
        const getStyleProperty = (
          element: Element | null,
          property: string
        ): string | null => {
          if (!element) return null;
          const styleAttr = element.getAttribute("style");
          if (styleAttr) {
            const match = styleAttr.match(
              new RegExp(`${property}:\\s*([^;]+)`, "i")
            );
            if (match && match[1]) {
              return match[1].trim();
            }
          }
          return null;
        };

        // Walk up the DOM tree and check siblings to find font-size and color
        let fontSize: string | null = null;
        let color: string | null = null;

        // First check the badge itself for inline styles (from stored attributes)
        fontSize = getStyleProperty(badge, "font-size");
        color = getStyleProperty(badge, "color");

        // If not found, check previous sibling (often where TipTap applies marks before atom nodes)
        if ((!fontSize || !color) && badge.previousElementSibling) {
          if (!fontSize)
            fontSize = getStyleProperty(
              badge.previousElementSibling,
              "font-size"
            );
          if (!color)
            color = getStyleProperty(badge.previousElementSibling, "color");
        }

        // If not found, check next sibling (often where TipTap applies marks after atom nodes)
        if ((!fontSize || !color) && badge.nextElementSibling) {
          if (!fontSize)
            fontSize = getStyleProperty(badge.nextElementSibling, "font-size");
          if (!color)
            color = getStyleProperty(badge.nextElementSibling, "color");
        }

        // If not found, check all parent elements (walk up the tree)
        if (!fontSize || !color) {
          let current: Element | null = badge.parentElement;
          while (current && (!fontSize || !color)) {
            // Check if this element has font-size or color style
            if (!fontSize) fontSize = getStyleProperty(current, "font-size");
            if (!color) color = getStyleProperty(current, "color");
            if (!fontSize && !color) {
              current = current.parentElement;
            }
          }
        }

        // Create replacement element with preserved styles
        if (fontSize || color) {
          const span = document.createElement("span");
          if (fontSize) span.style.fontSize = fontSize;
          if (color) span.style.color = color;
          span.textContent = replacement;
          badge.parentNode?.replaceChild(span, badge);
        } else {
          // No styles to preserve, use text node
          const textNode = document.createTextNode(replacement);
          badge.parentNode?.replaceChild(textNode, badge);
        }
      } else {
        // No replacement value, show as styled badge (read-only, no X button)
        const label = badge.getAttribute("data-label") || fieldKey;
        const displayBadge = document.createElement("span");
        displayBadge.className =
          "inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium mx-1";
        displayBadge.setAttribute("data-placeholder", placeholder);
        displayBadge.textContent = label;
        displayBadge.style.userSelect = "none";
        displayBadge.style.cursor = "default";

        badge.parentNode?.replaceChild(displayBadge, badge);
      }
    });

    // Remove any remaining buttons or editing controls
    temp
      .querySelectorAll('button[data-remove-button="true"]')
      .forEach((btn) => btn.remove());
    temp.querySelectorAll(".field-token-remove").forEach((btn) => btn.remove());

    return temp.innerHTML;
  };

  // Helper function to get employee field value from field key
  const getEmployeeFieldValue = (
    fieldKey: string,
    employee: Employee | undefined
  ): string => {
    // If snapshot employee data is available, use it instead of live employee data
    // This ensures finalized contracts show data from the time of signing
    const effectiveEmployee = snapshotEmployeeData?.employeeFields
      ? ({
          ...employee,
          employeeFields: snapshotEmployeeData.employeeFields,
          designation: snapshotEmployeeData.designation,
        } as Employee)
      : employee;

    if (!effectiveEmployee) return "";

    // Map common field keys to their data locations
    const pdFromFields = effectiveEmployee.employeeFields?.personaldetails;
    const pdFromProfile = effectiveEmployee.employeeProfile?.personaldetails;
    const pd = pdFromFields || pdFromProfile || {};
    const email =
      effectiveEmployee.email ||
      effectiveEmployee.employeeProfile?.userId?.email ||
      "";
    const designation =
      effectiveEmployee.designation?.name ||
      snapshotEmployeeData?.designation?.name ||
      "";

    // Helper to safely get property from pd
    const getPdValue = (key: string): string => {
      if (pdFromFields && key in pdFromFields) {
        return String((pdFromFields as any)[key] || "");
      }
      if (pdFromProfile && key in pdFromProfile) {
        return String((pdFromProfile as any)[key] || "");
      }
      return "";
    };

    // Handle special composite fields
    if (fieldKey === "name" || fieldKey === "fullname") {
      const firstname = getPdValue("firstname");
      const middlename = getPdValue("middlename");
      const lastname = getPdValue("lastname");
      return `${firstname} ${middlename} ${lastname}`.trim();
    }

    // Handle direct field mappings
    const fieldMappings: Record<string, () => string> = {
      firstname: () => getPdValue("firstname"),
      firstName: () => getPdValue("firstname"),
      lastname: () => getPdValue("lastname"),
      lastName: () => getPdValue("lastname"),
      middlename: () => getPdValue("middlename"),
      middleName: () => getPdValue("middlename"),
      preferredname: () => getPdValue("preferredname"),
      preferredName: () => getPdValue("preferredname"),
      email: () => email,
      mobile: () => getPdValue("mobile"),
      position: () => designation,
      employeephoto: () => {
        const photo =
          pdFromFields?.employeephoto || pdFromProfile?.employeephoto;
        if (typeof photo === "string") return photo;
        if (typeof photo === "object" && photo && "url" in photo)
          return (photo as any).url || "";
        return "";
      },
    };

    // Check direct mappings first
    if (fieldMappings[fieldKey]) {
      return fieldMappings[fieldKey]();
    }

    // Try to get from employeeFields using getProfileOrAdditionalValue
    // Common section mappings
    const sectionMappings: Record<string, string> = {
      firstname: "personaldetails",
      firstName: "personaldetails",
      lastname: "personaldetails",
      lastName: "personaldetails",
      middlename: "personaldetails",
      middleName: "personaldetails",
      preferredname: "personaldetails",
      preferredName: "personaldetails",
      mobile: "personaldetails",
      employeephoto: "personaldetails",
      dateofbirth: "personaldetails",
      dateOfBirth: "personaldetails",
      startdate: "employeedetails",
      startDate: "employeedetails",
      enddate: "employeedetails",
      endDate: "employeedetails",
      employmentstatus: "employeedetails",
      employmentStatus: "employeedetails",
    };

    const sectionKey = sectionMappings[fieldKey] || "personaldetails";
    const value = getProfileOrAdditionalValue(employee, sectionKey, fieldKey);

    // Handle file/photo fields
    if (
      fieldKey.toLowerCase().includes("photo") ||
      fieldKey.toLowerCase().includes("image")
    ) {
      if (typeof value === "object" && value?.url) {
        return value.url;
      }
      if (typeof value === "string") {
        return value;
      }
      return "";
    }

    return value ? String(value) : "";
  };

  // Helper function to replace all field placeholders with their values (preserving HTML formatting)
  const replaceAllFieldPlaceholders = (text: string): string => {
    if (!text) return text;

    // First, process HTML to convert badges to display badges and preserve formatting
    let result = processHTML(text);

    // Create a temporary DOM element to work with
    const temp = document.createElement("div");
    temp.innerHTML = result;

    // Helper function to replace placeholders in text nodes while preserving HTML structure
    const replacePlaceholdersInNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        let textContent = node.textContent || "";
        let hasChanges = false;

        // Replace custom field placeholders
        if (Array.isArray(builder.fields.custom)) {
          builder.fields.custom.forEach((field) => {
            if (
              field.defaultValue !== undefined &&
              field.defaultValue !== null &&
              String(field.defaultValue).trim() !== ""
            ) {
              const placeholder = `{{custom.${field.key}}}`;
              const defaultValue = String(field.defaultValue);
              if (textContent.includes(placeholder)) {
                textContent = textContent.replace(
                  new RegExp(
                    placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                    "g"
                  ),
                  defaultValue
                );
                hasChanges = true;
              }
            }
          });
        }

        // Replace employee field placeholders
        if (Array.isArray(builder.fields.employee)) {
          builder.fields.employee.forEach((fieldKey) => {
            const placeholder = `{{employee.${fieldKey}}}`;
            if (textContent.includes(placeholder)) {
              let replacement = "";

              // Try selectedEmployee first
              if (selectedEmployee) {
                replacement = getEmployeeFieldValue(fieldKey, selectedEmployee);
              } else if (initialEmployeeId) {
                // Fallback to employee from initialEmployeeId if selectedEmployee not set
                const employee = employees.find(
                  (emp) => emp._id === initialEmployeeId
                );
                if (employee) {
                  replacement = getEmployeeFieldValue(fieldKey, employee);
                }
              }

              if (!replacement) {
                const employeeFieldLabels: Record<string, string> = {
                  name: "Full Name",
                  email: "Email",
                  position: "Position",
                  startDate: "Start Date",
                  location: "Location",
                  hours: "Working Hours",
                  pay: "Pay/Salary",
                  department: "Department",
                  supervisor: "Supervisor",
                  lastname: "Last Name",
                  firstName: "First Name",
                  lastName: "Last Name",
                };
                const label = employeeFieldLabels[fieldKey] || fieldKey;
                replacement = `[${label}]`;
              }

              textContent = textContent.replace(
                new RegExp(
                  placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  "g"
                ),
                replacement
              );
              hasChanges = true;
            }
          });
        }

        // Replace organization field placeholders
        if (Array.isArray(builder.fields.organization)) {
          builder.fields.organization.forEach((fieldKey) => {
            const placeholder = `{{organization.${fieldKey}}}`;
            if (textContent.includes(placeholder)) {
              const orgFieldLabels: Record<string, string> = {
                employerName: "Employer Name",
                abn: "ABN",
                address: "Address",
                defaultGoverningLaw: "Governing Law",
                superNote: "Super Note",
              };
              const label = orgFieldLabels[fieldKey] || fieldKey;
              textContent = textContent.replace(
                new RegExp(
                  placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  "g"
                ),
                `[${label}]`
              );
              hasChanges = true;
            }
          });
        }

        // Update text node if changes were made
        if (hasChanges) {
          node.textContent = textContent;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Recursively process child nodes
        const element = node as Element;
        // Skip field-token badges (already processed)
        if (
          !element.classList.contains("field-token") &&
          !element.hasAttribute("data-placeholder")
        ) {
          Array.from(element.childNodes).forEach((child) =>
            replacePlaceholdersInNode(child)
          );
        }
      }
    };

    // Process all nodes in the temp element
    Array.from(temp.childNodes).forEach((node) =>
      replacePlaceholdersInNode(node)
    );

    return temp.innerHTML;
  };

  // Helper function to get field label from field reference
  const getFieldLabel = (fieldRef: string): string => {
    if (!fieldRef) return "Field";

    // Remove curly braces if present
    const cleanRef = fieldRef.replace(/^\{\{|\}\}$/g, "");

    // Handle employee fields
    const employeeMatch = cleanRef.match(/^employee\.(.+)$/);
    if (employeeMatch) {
      const fieldKey = employeeMatch[1];
      const employeeFieldLabels: Record<string, string> = {
        name: "Full Name",
        email: "Email",
        position: "Position",
        startDate: "Start Date",
        location: "Location",
        hours: "Working Hours",
        pay: "Pay/Salary",
        department: "Department",
        supervisor: "Supervisor",
        lastname: "Last Name",
        firstName: "First Name",
        lastName: "Last Name",
        firstname: "First Name",
        middlename: "Middle Name",
        preferredname: "Preferred Name",
        mobile: "Mobile",
        employeephoto: "Employee Photo",
        dateofbirth: "Date of Birth",
      };
      return employeeFieldLabels[fieldKey] || fieldKey;
    }

    // Handle organization fields
    const orgMatch = cleanRef.match(/^organization\.(.+)$/);
    if (orgMatch) {
      const fieldKey = orgMatch[1];
      const orgFieldLabels: Record<string, string> = {
        employerName: "Employer Name",
        abn: "ABN",
        address: "Address",
        defaultGoverningLaw: "Governing Law",
        superNote: "Super Note",
      };
      return orgFieldLabels[fieldKey] || fieldKey;
    }

    // Handle custom fields
    const customMatch = cleanRef.match(/^custom\.(.+)$/);
    if (customMatch) {
      const fieldKey = customMatch[1];
      const customField = builder.fields.custom?.find(
        (f) => f.key === fieldKey
      );
      return customField?.label || fieldKey;
    }

    // Return the field reference as-is if no match
    return cleanRef;
  };

  // Helper function to resolve field reference to its value
  const resolveFieldRef = (fieldRef: string): string | null => {
    if (!fieldRef) return null;

    // Handle custom field references (e.g., "custom.fieldKey" or "{{custom.fieldKey}}")
    const customMatch = fieldRef.match(/^\{?\{?custom\.([^}]+)\}?\}?$/);
    if (customMatch) {
      const fieldKey = customMatch[1];
      const customField = builder.fields.custom?.find(
        (f) => f.key === fieldKey
      );
      if (
        customField?.defaultValue !== undefined &&
        customField.defaultValue !== null
      ) {
        return String(customField.defaultValue);
      }
    }

    // Handle employee field references (e.g., "employee.name" or "{{employee.name}}")
    const employeeMatch = fieldRef.match(/^\{?\{?employee\.([^}]+)\}?\}?$/);
    if (employeeMatch) {
      const fieldKey = employeeMatch[1];
      // Try to use selectedEmployee first
      if (selectedEmployee) {
        const value = getEmployeeFieldValue(fieldKey, selectedEmployee);
        if (value) {
          console.log(
            `[CONTRACT PREVIEW] Resolved field ${fieldKey} = ${value} from selectedEmployee`
          );
          return value;
        }
      }
      // If no selectedEmployee but initialEmployeeId is set, try to find employee in list
      if (initialEmployeeId && !selectedEmployee) {
        const employee = employees.find((emp) => emp._id === initialEmployeeId);
        if (employee) {
          const value = getEmployeeFieldValue(fieldKey, employee);
          if (value) {
            console.log(
              `[CONTRACT PREVIEW] Resolved field ${fieldKey} = ${value} from initialEmployeeId`
            );
            return value;
          }
        }
      }
      // If no employee selected or value is empty, show placeholder
      console.log(
        `[CONTRACT PREVIEW] Could not resolve field ${fieldKey}, selectedEmployee:`,
        selectedEmployee?._id,
        "initialEmployeeId:",
        initialEmployeeId
      );
      return `[${fieldKey}]`;
    }

    // Handle organization field references
    const orgMatch = fieldRef.match(/^\{?\{?organization\.([^}]+)\}?\}?$/);
    if (orgMatch) {
      const fieldKey = orgMatch[1];
      return `[${fieldKey}]`;
    }

    return null;
  };

  // Add print styles and rich text formatting styles
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        body * {
          visibility: hidden;
        }
        .print-content,
        .print-content * {
          visibility: visible;
        }
        .print-content {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
        }
        .no-print {
          display: none !important;
        }
      }
      
      /* Rich text formatting styles for preview */
      .template-preview-content {
        line-height: 1.6;
      }
      
      .template-preview-content strong,
      .template-preview-content b {
        font-weight: 700;
      }
      
      .template-preview-content em,
      .template-preview-content i {
        font-style: italic;
      }
      
      .template-preview-content u {
        text-decoration: underline;
      }
      
      .template-preview-content s,
      .template-preview-content strike {
        text-decoration: line-through;
      }
      
      .template-preview-content ul,
      .template-preview-content ol {
        margin: 0.75rem 0;
        padding-left: 1.5rem;
        list-style-position: outside;
      }
      
      .template-preview-content ul {
        list-style-type: disc;
      }
      
      .template-preview-content ul[data-list-style-type="circle"],
      .template-preview-content ul[style*="list-style-type: circle"] {
        list-style-type: circle;
      }
      
      .template-preview-content ul[data-list-style-type="square"],
      .template-preview-content ul[style*="list-style-type: square"] {
        list-style-type: square;
      }
      
      .template-preview-content ul ul {
        list-style-type: circle;
        margin-top: 0.25rem;
        margin-bottom: 0.25rem;
      }
      
      .template-preview-content ul ul ul {
        list-style-type: square;
      }
      
      .template-preview-content ol {
        list-style-type: decimal;
      }
      
      .template-preview-content ol[data-list-style-type="lower-alpha"],
      .template-preview-content ol[style*="list-style-type: lower-alpha"] {
        list-style-type: lower-alpha;
      }
      
      .template-preview-content ol[data-list-style-type="upper-alpha"],
      .template-preview-content ol[style*="list-style-type: upper-alpha"] {
        list-style-type: upper-alpha;
      }
      
      .template-preview-content ol[data-list-style-type="lower-roman"],
      .template-preview-content ol[style*="list-style-type: lower-roman"] {
        list-style-type: lower-roman;
      }
      
      .template-preview-content ol[data-list-style-type="upper-roman"],
      .template-preview-content ol[style*="list-style-type: upper-roman"] {
        list-style-type: upper-roman;
      }
      
      .template-preview-content ol ol {
        list-style-type: lower-alpha;
        margin-top: 0.25rem;
        margin-bottom: 0.25rem;
      }
      
      .template-preview-content ol ol ol {
        list-style-type: lower-roman;
      }
      
      .template-preview-content li {
        margin: 0.5rem 0;
        padding-left: 0.25rem;
        line-height: 1.6;
      }
      
      .template-preview-content li p {
        margin: 0;
        display: inline;
      }
      
      .template-preview-content li:first-child {
        margin-top: 0;
      }
      
      .template-preview-content li:last-child {
        margin-bottom: 0;
      }
      
      .template-preview-content p {
        margin: 0.5rem 0;
      }
      
      .template-preview-content h1,
      .template-preview-content h2,
      .template-preview-content h3 {
        font-weight: 700;
        margin: 1rem 0 0.5rem 0;
      }
      
      .template-preview-content h1 {
        font-size: 1.875rem;
      }
      
      .template-preview-content h2 {
        font-size: 1.5rem;
      }
      
      .template-preview-content h3 {
        font-size: 1.25rem;
      }
      
      .template-preview-content a {
        color: #2563eb;
        text-decoration: underline;
      }
      
      .template-preview-content blockquote {
        border-left: 4px solid #e5e7eb;
        padding-left: 1rem;
        margin: 1rem 0;
        font-style: italic;
      }
      
      .template-preview-content code {
        background-color: #f3f4f6;
        padding: 0.125rem 0.25rem;
        border-radius: 0.25rem;
        font-family: monospace;
        font-size: 0.875em;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <>
      <Transition appear show={isOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onClose}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/25" />
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
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white shadow-xl transition-all print-content">
                  {/* Header */}
                  <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 no-print">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <Dialog.Title className="text-lg font-semibold text-gray-900">
                          Template Preview
                        </Dialog.Title>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-gray-500 font-medium">
                            {title}
                          </p>
                          {version && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                              v{version}
                            </span>
                          )}
                          {builder.meta?.version && !version && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                              v{builder.meta.version}
                            </span>
                          )}
                        </div>
                        {description && (
                          <div
                            className="mt-1 text-xs text-gray-600 line-clamp-2"
                            dangerouslySetInnerHTML={{
                              __html: processHTML(description),
                            }}
                          />
                        )}
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-3">
                          <Select
                            placeholder={
                              loadingEmployees
                                ? "Loading..."
                                : "Select Employee"
                            }
                            value={
                              selectedEmployeeId
                                ? employees
                                    .map((emp) => {
                                      const pdFromFields =
                                        emp.employeeFields?.personaldetails;
                                      const pdFromProfile = emp.employeeProfile
                                        ?.personaldetails as any;
                                      const firstname =
                                        pdFromFields?.firstname ||
                                        pdFromProfile?.firstname ||
                                        "";
                                      const middlename =
                                        pdFromFields?.middlename ||
                                        pdFromProfile?.middlename ||
                                        "";
                                      const lastname =
                                        pdFromFields?.lastname ||
                                        pdFromProfile?.lastname ||
                                        "";
                                      const fullName =
                                        `${firstname} ${middlename} ${lastname}`.trim();
                                      return {
                                        value: emp._id,
                                        label: fullName || emp._id,
                                      };
                                    })
                                    .find(
                                      (opt) => opt.value === selectedEmployeeId
                                    ) || null
                                : null
                            }
                            onChange={(opt: any) => {
                              if (!opt) return;
                              isManualSelectionRef.current = true;
                              const newEmployeeId = opt.value || "";
                              console.log(
                                "[CONTRACT PREVIEW] Employee selected:",
                                newEmployeeId
                              );
                              setSelectedEmployeeId(newEmployeeId);
                            }}
                            options={employees.map((emp) => {
                              const pdFromFields =
                                emp.employeeFields?.personaldetails;
                              const pdFromProfile = emp.employeeProfile
                                ?.personaldetails as any;
                              const firstname =
                                pdFromFields?.firstname ||
                                pdFromProfile?.firstname ||
                                "";
                              const middlename =
                                pdFromFields?.middlename ||
                                pdFromProfile?.middlename ||
                                "";
                              const lastname =
                                pdFromFields?.lastname ||
                                pdFromProfile?.lastname ||
                                "";
                              const fullName =
                                `${firstname} ${middlename} ${lastname}`.trim();
                              return {
                                value: emp._id,
                                label: fullName || emp._id,
                              };
                            })}
                            className="min-w-[200px]"
                            disabled={loadingEmployees}
                          />
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onClose}
                      className="h-8 w-8 rounded-full p-0 ml-3"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Document Content */}
                  <div className="max-h-[calc(100vh-12rem)] overflow-y-auto bg-gray-50 print:max-h-none print:overflow-visible print:bg-white">
                    <div
                      ref={contentRef}
                      className="mx-auto max-w-3xl bg-white px-12 py-16 shadow-inner print:shadow-none print:px-8 print:py-12"
                    >
                      {/* Sticky Document Header */}
                      <div className="sticky top-0 z-10 bg-white pb-6 mb-12 text-center border-b border-gray-200 -mt-16 pt-16 print:static print:border-b-0 print:-mt-0 print:pt-0">
                        <h1 className="mb-4 text-3xl font-bold text-gray-900 tracking-tight">
                          {builder.body?.title ||
                            title ||
                            "Employment Contract"}
                        </h1>
                        {builder.body?.description && (
                          <div
                            className="template-preview-content mt-3 text-sm leading-relaxed text-gray-600 max-w-2xl mx-auto"
                            dangerouslySetInnerHTML={{
                              __html: processHTML(builder.body.description),
                            }}
                          />
                        )}
                      </div>

                      {/* Empty State */}
                      {(builder.body?.backgrounds || []).filter(Boolean)
                        .length === 0 &&
                        sortedSchedule.length === 0 &&
                        includedClauses.length === 0 && (
                          <div className="mb-12 text-center py-12">
                            <p className="text-gray-500 italic">
                              Template content will appear here as you add
                              backgrounds, schedule items, and clauses.
                            </p>
                          </div>
                        )}

                      {/* Schedule Section - Moved to appear after Title/Description and before Backgrounds */}
                      {sortedSchedule.length > 0 && (
                        <div className="mb-12">
                          {/* Render schedule title - preserve heading tags (h1, h2, h3) if present */}
                          <div
                            className="mb-6 schedule-title"
                            dangerouslySetInnerHTML={{
                              __html: processHTML(scheduleTitle),
                            }}
                          />
                          <div className="space-y-4">
                            {sortedSchedule.map((item, idx) => {
                              // Get the number text - use numberText if set and not empty, otherwise default to order number
                              let numberText = item.numberText;
                              // Check if numberText is empty HTML (just tags with no content)
                              if (numberText) {
                                const tempDiv = document.createElement("div");
                                tempDiv.innerHTML = numberText;
                                const textContent =
                                  tempDiv.textContent ||
                                  tempDiv.innerText ||
                                  "";
                                if (textContent.trim() === "") {
                                  numberText = undefined; // Treat as empty
                                }
                              }
                              numberText = numberText || `${item.order}.`;
                              // Process the number text to handle field placeholders and preserve formatting
                              const processedNumberText = processHTML(
                                replaceAllFieldPlaceholders(numberText)
                              );

                              return (
                                <div
                                  key={item.key}
                                  className="border-b border-gray-200 pb-4 last:border-b-0"
                                >
                                  <div className="mb-2 flex items-start gap-4">
                                    <div
                                      className="mt-1 min-w-[2rem] schedule-item-number"
                                      dangerouslySetInnerHTML={{
                                        __html: processedNumberText,
                                      }}
                                    />
                                    <div className="flex-1">
                                      <div
                                        className="mb-1 text-base font-semibold text-gray-900 schedule-item-label"
                                        dangerouslySetInnerHTML={{
                                          __html: processHTML(
                                            replaceAllFieldPlaceholders(
                                              item.label || ""
                                            )
                                          ),
                                        }}
                                      />
                                      {(() => {
                                        // Handle both fieldRefs (new) and fieldRef (old) for backward compatibility
                                        const fieldRefs =
                                          item.fieldRefs ||
                                          (item.fieldRef
                                            ? [item.fieldRef]
                                            : []);

                                        // If fieldMappingFormats exists, use formatted HTML and preserve styling
                                        if (
                                          fieldRefs.length > 0 &&
                                          item.fieldMappingFormats
                                        ) {
                                          // Build HTML from formatted tokens
                                          const formattedParts: string[] = [];
                                          fieldRefs.forEach((fieldRef) => {
                                            const formattedHtml =
                                              item.fieldMappingFormats?.[
                                                fieldRef
                                              ];
                                            if (formattedHtml) {
                                              // Get the actual field value
                                              const fieldValue =
                                                resolveFieldRef(fieldRef) ||
                                                `[${fieldRef}]`;

                                              // Parse the formatted HTML to preserve all formatting
                                              const temp =
                                                document.createElement("div");
                                              temp.innerHTML = formattedHtml;

                                              // Find the field label text in the HTML and replace it with the actual value
                                              // The formatted HTML might contain the label text or placeholder text
                                              const fieldLabel =
                                                getFieldLabel(fieldRef);
                                              const placeholder = `{{${fieldRef}}}`;

                                              // Recursively replace text content that matches the label or placeholder
                                              const replaceTextInNode = (
                                                node: Node
                                              ): void => {
                                                if (
                                                  node.nodeType ===
                                                  Node.TEXT_NODE
                                                ) {
                                                  const text =
                                                    node.textContent || "";
                                                  // Replace label or placeholder with actual value
                                                  if (
                                                    text.includes(fieldLabel) ||
                                                    text.includes(placeholder)
                                                  ) {
                                                    const newText = text
                                                      .replace(
                                                        new RegExp(
                                                          fieldLabel.replace(
                                                            /[.*+?^${}()|[\]\\]/g,
                                                            "\\$&"
                                                          ),
                                                          "g"
                                                        ),
                                                        fieldValue
                                                      )
                                                      .replace(
                                                        new RegExp(
                                                          placeholder.replace(
                                                            /[.*+?^${}()|[\]\\]/g,
                                                            "\\$&"
                                                          ),
                                                          "g"
                                                        ),
                                                        fieldValue
                                                      );
                                                    node.textContent = newText;
                                                  }
                                                } else if (
                                                  node.nodeType ===
                                                  Node.ELEMENT_NODE
                                                ) {
                                                  // Recursively process child nodes
                                                  const childNodes = Array.from(
                                                    node.childNodes
                                                  );
                                                  childNodes.forEach((child) =>
                                                    replaceTextInNode(child)
                                                  );
                                                }
                                              };

                                              // Replace text in all nodes
                                              replaceTextInNode(temp);

                                              // Get the processed HTML with the field value substituted
                                              const processedHtml =
                                                temp.innerHTML;

                                              // If the HTML is empty or just whitespace, use the field value with basic formatting
                                              if (!processedHtml.trim()) {
                                                formattedParts.push(fieldValue);
                                              } else {
                                                formattedParts.push(
                                                  processedHtml
                                                );
                                              }
                                            } else {
                                              // No formatting, just use the resolved value
                                              const fieldValue =
                                                resolveFieldRef(fieldRef);
                                              if (fieldValue) {
                                                formattedParts.push(fieldValue);
                                              }
                                            }
                                          });

                                          if (formattedParts.length > 0) {
                                            return (
                                              <div
                                                className="template-preview-content text-sm leading-relaxed text-gray-700"
                                                dangerouslySetInnerHTML={{
                                                  __html:
                                                    formattedParts.join(" "),
                                                }}
                                              />
                                            );
                                          }
                                        }

                                        // If fieldRefs is set and has values, resolve them to show the actual values (no formatting)
                                        if (fieldRefs.length > 0) {
                                          const resolvedValues = fieldRefs
                                            .map((fieldRef) =>
                                              resolveFieldRef(fieldRef)
                                            )
                                            .filter(
                                              (val): val is string =>
                                                val !== null
                                            );
                                          if (resolvedValues.length > 0) {
                                            return (
                                              <p className="text-sm leading-relaxed text-gray-700">
                                                {resolvedValues.join(", ")}
                                              </p>
                                            );
                                          }
                                        }
                                        // If no field mapping, show defaultText with placeholders replaced
                                        if (item.defaultText) {
                                          return (
                                            <div
                                              className="template-preview-content text-sm leading-relaxed text-gray-700"
                                              dangerouslySetInnerHTML={{
                                                __html:
                                                  replaceAllFieldPlaceholders(
                                                    item.defaultText
                                                  ),
                                              }}
                                            />
                                          );
                                        }
                                        // If neither fieldRefs nor defaultText, show field references as fallback
                                        if (fieldRefs.length > 0) {
                                          return (
                                            <p className="mt-1 text-xs italic text-gray-500">
                                              [Fields: {fieldRefs.join(", ")}]
                                            </p>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Background Sections */}
                      {(builder.body?.backgrounds || []).filter((bg) => {
                        if (typeof bg === "string") return bg && bg.trim();
                        return bg && bg.content && bg.content.trim();
                      }).length > 0 && (
                        <div className="mb-12">
                          {/* Render background title - preserve heading tags (h1, h2, h3) if present */}
                          {builder.body?.backgroundTitle && (
                            <div
                              className="mb-6 background-title"
                              dangerouslySetInnerHTML={{
                                __html: processHTML(
                                  replaceAllFieldPlaceholders(
                                    builder.body.backgroundTitle
                                  )
                                ),
                              }}
                            />
                          )}
                          {!builder.body?.backgroundTitle && (
                            <h2 className="mb-6 text-xl font-bold text-gray-900">
                              Background
                            </h2>
                          )}
                          <div className="space-y-4">
                            {(builder.body?.backgrounds || [])
                              .filter((bg) => {
                                if (typeof bg === "string")
                                  return bg && bg.trim();
                                return bg && bg.content && bg.content.trim();
                              })
                              .map((background, idx) => {
                                // Handle both old format (string) and new format (object)
                                const bgContent =
                                  typeof background === "string"
                                    ? background
                                    : background.content;
                                const bgNumberText =
                                  typeof background === "string"
                                    ? undefined
                                    : background.numberText;

                                // Get the number text - use numberText if set and not empty, otherwise default to letter (A, B, C, etc.)
                                let numberText = bgNumberText;
                                // Check if numberText is empty HTML (just tags with no content)
                                if (numberText) {
                                  const tempDiv = document.createElement("div");
                                  tempDiv.innerHTML = numberText;
                                  const textContent =
                                    tempDiv.textContent ||
                                    tempDiv.innerText ||
                                    "";
                                  if (textContent.trim() === "") {
                                    numberText = undefined; // Treat as empty
                                  }
                                }
                                numberText =
                                  numberText || String.fromCharCode(65 + idx);
                                // Process the number text to handle field placeholders and preserve formatting
                                const processedNumberText = processHTML(
                                  replaceAllFieldPlaceholders(numberText)
                                );

                                return (
                                  <div
                                    key={idx}
                                    className="border-b border-gray-200 pb-4 last:border-b-0"
                                  >
                                    <div className="mb-2 flex items-start gap-4">
                                      <div
                                        className="mt-1 min-w-[2rem] background-item-number"
                                        dangerouslySetInnerHTML={{
                                          __html: processedNumberText,
                                        }}
                                      />
                                      <div className="flex-1">
                                        <div
                                          className="template-preview-content text-justify leading-relaxed text-gray-700"
                                          dangerouslySetInnerHTML={{
                                            __html:
                                              replaceAllFieldPlaceholders(
                                                bgContent
                                              ),
                                          }}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Clauses Section */}
                      {includedClauses.length > 0 && (
                        <div className="mb-12">
                          {builder.body.clauseTitle && (
                            <div
                              className="mb-6 clause-title"
                              dangerouslySetInnerHTML={{
                                __html: processHTML(builder.body.clauseTitle),
                              }}
                            />
                          )}
                          <div className="space-y-8">
                            {includedClauses
                              .sort((a, b) => (a.order || 0) - (b.order || 0))
                              .map((clause, idx) => {
                                const clauseNumber = clause.numberText
                                  ? processHTML(
                                      replaceAllFieldPlaceholders(
                                        clause.numberText
                                      )
                                    )
                                  : (clause.order || idx + 1) + ".";
                                const clauseHeading = clause.heading
                                  ? processHTML(
                                      replaceAllFieldPlaceholders(
                                        clause.heading
                                      )
                                    )
                                  : "";

                                return (
                                  <div key={clause.id} className="space-y-3">
                                    <div className="flex items-start gap-3">
                                      <div
                                        className="mt-1 min-w-[2.5rem] clause-item-number"
                                        dangerouslySetInnerHTML={{
                                          __html: clauseNumber,
                                        }}
                                      />
                                      <div className="flex-1">
                                        {clauseHeading && (
                                          <div
                                            className="mb-2 clause-heading"
                                            dangerouslySetInnerHTML={{
                                              __html: clauseHeading,
                                            }}
                                          />
                                        )}
                                        {clause.text && (
                                          <div
                                            className="template-preview-content text-justify leading-relaxed text-gray-700"
                                            dangerouslySetInnerHTML={{
                                              __html:
                                                replaceAllFieldPlaceholders(
                                                  clause.text
                                                ),
                                            }}
                                          />
                                        )}
                                        {clause.subclauses &&
                                          clause.subclauses.length > 0 && (
                                            <div className="mt-4 ml-4 space-y-3 border-l-2 border-gray-200 pl-4">
                                              {clause.subclauses.map(
                                                (subclause, subIdx) => (
                                                  <div
                                                    key={subclause.id}
                                                    className="space-y-1"
                                                  >
                                                    <div className="flex items-start gap-2">
                                                      <span className="mt-0.5 text-sm font-semibold text-gray-700">
                                                        {subclause.number ||
                                                          `${clause.order || idx + 1}.${subIdx + 1}`}
                                                      </span>
                                                      <div
                                                        className="template-preview-content flex-1 text-sm leading-relaxed text-gray-700"
                                                        dangerouslySetInnerHTML={{
                                                          __html:
                                                            replaceAllFieldPlaceholders(
                                                              subclause.text
                                                            ),
                                                        }}
                                                      />
                                                    </div>
                                                  </div>
                                                )
                                              )}
                                            </div>
                                          )}
                                        {clause.category && (
                                          <p className="mt-2 text-xs font-medium text-gray-500">
                                            Category: {clause.category}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}

                      {/* Professional Signature Section - Only show if there are signatures or signing roles */}
                      {(allSignatures.length > 0 ||
                        (builder.signing?.roles || []).length > 0) && (
                        <div className="mb-12 mt-16">
                          <div className="border-t-2 border-gray-800 pt-8">
                            <h2 className="mb-8 text-center text-xl font-bold tracking-wide text-gray-900 uppercase">
                              Execution
                            </h2>

                            <p className="text-sm text-gray-600 mb-8 text-center italic">
                              IN WITNESS WHEREOF, the parties have executed this
                              agreement as of the date first written above.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                              {/* Employee / Applicant Signature Block */}
                              <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-2">
                                  Employee
                                </h3>

                                <div className="pt-4">
                                  <div className="relative h-20 mb-1">
                                    {/* Signature line */}
                                    <div className="absolute bottom-0 left-0 right-0 border-b border-gray-400"></div>

                                    {/* Show employee signature if available - check for matching employee or applicant signature */}
                                    {allSignatures.length > 0 &&
                                      (() => {
                                        // Try to find a signature that matches the selected employee (applicant)
                                        const targetId =
                                          selectedEmployeeId ||
                                          initialEmployeeId;
                                        // First check for isApplicantSignature flag (for signatures from my-contracts page)
                                        let employeeSig = allSignatures.find(
                                          (s) => s.isApplicantSignature === true
                                        );
                                        // If not found, fall back to matching by employeeId
                                        if (!employeeSig) {
                                          employeeSig = allSignatures.find(
                                            (s) => s.employeeId === targetId
                                          );
                                        }
                                        if (employeeSig) {
                                          return (
                                            <img
                                              src={employeeSig.signatureData}
                                              alt="Employee Signature"
                                              className="absolute bottom-2 left-0 h-16 max-w-[200px] object-contain"
                                              style={{
                                                mixBlendMode: "multiply",
                                              }}
                                            />
                                          );
                                        }
                                        return null;
                                      })()}
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Signature
                                  </p>
                                </div>

                                <div className="pt-2">
                                  <div className="border-b border-gray-400 pb-1 mb-1">
                                    <span className="text-sm text-gray-800">
                                      {selectedEmployee
                                        ? `${selectedEmployee.employeeFields?.personaldetails?.firstname || ""} ${selectedEmployee.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
                                          "____________________"
                                        : "____________________"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Print Name
                                  </p>
                                </div>

                                {/* Job Title */}
                                <div className="pt-2">
                                  <div className="border-b border-gray-400 pb-1 mb-1">
                                    <span className="text-sm text-gray-800">
                                      {selectedEmployee?.designation?.name ||
                                        "____________________"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Title/Position
                                  </p>
                                </div>

                                <div className="pt-2">
                                  <div className="border-b border-gray-400 pb-1 mb-1">
                                    <span className="text-sm text-gray-800">
                                      {(() => {
                                        // First check for applicant signature with flag
                                        const applicantSig = allSignatures.find(
                                          (s) => s.isApplicantSignature === true
                                        );
                                        if (applicantSig?.respondedAt) {
                                          return new Date(
                                            applicantSig.respondedAt
                                          ).toLocaleDateString("en-AU", {
                                            day: "2-digit",
                                            month: "long",
                                            year: "numeric",
                                          });
                                        }
                                        // Fall back to matching by employeeId
                                        const targetSig = allSignatures.find(
                                          (s) =>
                                            s.employeeId ===
                                            (selectedEmployeeId ||
                                              initialEmployeeId)
                                        );
                                        if (targetSig?.respondedAt) {
                                          return new Date(
                                            targetSig.respondedAt
                                          ).toLocaleDateString("en-AU", {
                                            day: "2-digit",
                                            month: "long",
                                            year: "numeric",
                                          });
                                        }
                                        return "____________________";
                                      })()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">Date</p>
                                </div>
                              </div>

                              {/* Employer / Approver Signature Block */}
                              <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-2">
                                  For and on behalf of the Employer
                                </h3>

                                {/* Show all approver signatures */}
                                {console.log(
                                  "[SIGNATURE DEBUG] allSignatures:",
                                  allSignatures
                                )}
                                {console.log(
                                  "[SIGNATURE DEBUG] selectedEmployeeId:",
                                  selectedEmployeeId,
                                  "initialEmployeeId:",
                                  initialEmployeeId
                                )}
                                {allSignatures.length > 0 ? (
                                  <div className="space-y-6">
                                    {allSignatures.map((sig, index) => {
                                      // Skip if this is the employee/applicant signature
                                      const targetId =
                                        selectedEmployeeId || initialEmployeeId;
                                      if (
                                        sig.isApplicantSignature === true ||
                                        sig.employeeId === targetId
                                      )
                                        return null;

                                      // Inline lookup for approver info to ensure fresh data is used
                                      let approverName = "";
                                      let approverDesignation = "";

                                      // Check if signature has embedded data, but if designation is missing, try to find it elsewhere
                                      if (sig.employeeName) {
                                        approverName = sig.employeeName;
                                        approverDesignation =
                                          sig.designation || "";

                                        // If designation is missing in signature but present in other sources, try to fetch it
                                        if (!approverDesignation) {
                                          const emp = employees.find(
                                            (e) => e._id === sig.employeeId
                                          );
                                          if (emp && emp.designation?.name) {
                                            approverDesignation =
                                              emp.designation.name;
                                          } else {
                                            const approverEmp =
                                              approverEmployees[sig.employeeId];
                                            if (
                                              approverEmp &&
                                              approverEmp.designation?.name
                                            ) {
                                              approverDesignation =
                                                approverEmp.designation.name;
                                            }
                                          }
                                        }
                                      }
                                      // Check employees list
                                      else {
                                        const emp = employees.find(
                                          (e) => e._id === sig.employeeId
                                        );
                                        if (emp) {
                                          approverName =
                                            `${emp.employeeFields?.personaldetails?.firstname || ""} ${emp.employeeFields?.personaldetails?.lastname || ""}`.trim();
                                          approverDesignation =
                                            emp.designation?.name || "";
                                        }
                                        // Check fetched approverEmployees
                                        else {
                                          const approverEmp =
                                            approverEmployees[sig.employeeId];
                                          if (approverEmp) {
                                            approverName =
                                              `${approverEmp.employeeFields?.personaldetails?.firstname || ""} ${approverEmp.employeeFields?.personaldetails?.lastname || ""}`.trim();
                                            approverDesignation =
                                              approverEmp.designation?.name ||
                                              "";
                                          }
                                        }
                                      }

                                      return (
                                        <div
                                          key={`${sig.employeeId}-${Object.keys(approverEmployees).length}`}
                                          className="pt-4"
                                        >
                                          <div className="relative h-20 mb-1">
                                            <div className="absolute bottom-0 left-0 right-0 border-b border-gray-400"></div>
                                            <img
                                              src={sig.signatureData}
                                              alt={`Approver Signature ${index + 1}`}
                                              className="absolute bottom-2 left-0 h-16 max-w-[200px] object-contain"
                                              style={{
                                                mixBlendMode: "multiply",
                                              }}
                                            />
                                          </div>
                                          <p className="text-xs text-gray-500">
                                            Authorised Signatory
                                          </p>

                                          {/* Approver Name */}
                                          <div className="pt-2 mt-2">
                                            <div className="border-b border-gray-400 pb-1 mb-1">
                                              <span className="text-sm text-gray-800">
                                                {approverName ||
                                                  "____________________"}
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                              Print Name
                                            </p>
                                          </div>

                                          {/* Approver Title */}
                                          <div className="pt-2">
                                            <div className="border-b border-gray-400 pb-1 mb-1">
                                              <span className="text-sm text-gray-800">
                                                {approverDesignation ||
                                                  "____________________"}
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                              Title/Position
                                            </p>
                                          </div>

                                          <div className="pt-2">
                                            <div className="border-b border-gray-400 pb-1 mb-1">
                                              <span className="text-sm text-gray-800">
                                                {sig.respondedAt
                                                  ? new Date(
                                                      sig.respondedAt
                                                    ).toLocaleDateString(
                                                      "en-AU",
                                                      {
                                                        day: "2-digit",
                                                        month: "long",
                                                        year: "numeric",
                                                      }
                                                    )
                                                  : "____________________"}
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-500">
                                              Date
                                            </p>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* If no approver signatures (all were employee), show empty block */}
                                    {allSignatures.every(
                                      (s) =>
                                        s.employeeId ===
                                        (selectedEmployeeId ||
                                          initialEmployeeId)
                                    ) && (
                                      <div className="pt-4">
                                        <div className="relative h-20 mb-1">
                                          <div className="absolute bottom-0 left-0 right-0 border-b border-gray-400"></div>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                          Authorised Signatory
                                        </p>

                                        <div className="pt-2 mt-2">
                                          <div className="border-b border-gray-400 pb-1 mb-1">
                                            <span className="text-sm text-gray-800">
                                              ____________________
                                            </span>
                                          </div>
                                          <p className="text-xs text-gray-500">
                                            Date
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // No signatures at all - show empty signature block
                                  <div className="pt-4">
                                    <div className="relative h-20 mb-1">
                                      <div className="absolute bottom-0 left-0 right-0 border-b border-gray-400"></div>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      Authorised Signatory
                                    </p>

                                    <div className="pt-2 mt-2">
                                      <div className="border-b border-gray-400 pb-1 mb-1">
                                        <span className="text-sm text-gray-800">
                                          ____________________
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500">
                                        Print Name
                                      </p>
                                    </div>

                                    <div className="pt-2">
                                      <div className="border-b border-gray-400 pb-1 mb-1">
                                        <span className="text-sm text-gray-800">
                                          ____________________
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500">
                                        Date
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Footer - hidden in PDF */}
                      <div className="mt-16 border-t border-gray-200 pt-8 text-center pdf-hide">
                        <p className="text-xs text-gray-500">
                          This is a template preview. Actual contract will be
                          generated with specific employee and organization
                          details.
                        </p>
                        {builder.meta.recommended && (
                          <p className="mt-2 text-xs font-medium text-blue-600">
                            ✓ Recommended Template
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="border-t border-gray-200 bg-white px-6 py-4 no-print">
                    <div className="flex justify-between items-center">
                      {!readOnly && (
                        <div className="flex items-center gap-3">
                          {/* Self-Sign Flow: When no approvers are configured */}
                          {templateId && hasNoApprovers && (
                            <>
                              {isSelfSigned ? (
                                // After self-signing: Show Send to Applicant
                                <>
                                  {canSendToApplicant ? (
                                    <Button
                                      onClick={handleSendToApplicant}
                                      className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                                      disabled={sendingToApplicant}
                                    >
                                      {sendingToApplicant
                                        ? "Sending..."
                                        : "Send to Applicant"}
                                    </Button>
                                  ) : (
                                    <div className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md border border-green-200">
                                      ✓ Contract has been sent to applicant
                                    </div>
                                  )}
                                </>
                              ) : (
                                // Before self-signing: Show Self Sign button
                                <Button
                                  onClick={() => setShowSelfSignModal(true)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
                                  disabled={selfSigning}
                                >
                                  {selfSigning ? "Signing..." : "Self Sign"}
                                </Button>
                              )}
                            </>
                          )}

                          {/* Regular Approval Flow: When approvers are configured */}
                          {templateId &&
                            builder.signing?.approvals?.employeeIds &&
                            builder.signing.approvals.employeeIds.length >
                              0 && (
                              <>
                                {hasPendingApprovalForCurrentEmployee && (
                                  <div className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                                    ⚠️ This contract has already been sent for
                                    approval for this employee and is currently
                                    pending. Please wait for the approval
                                    process to complete.
                                  </div>
                                )}
                                <Button
                                  variant="outline"
                                  onClick={() => setShowApprovalModal(true)}
                                  className="flex items-center gap-2"
                                  disabled={
                                    hasPendingApprovalForCurrentEmployee
                                  }
                                >
                                  Send for Approval
                                </Button>
                              </>
                            )}
                        </div>
                      )}
                      <div className="flex gap-3 flex-wrap">
                        <Button variant="outline" onClick={onClose}>
                          Close
                        </Button>

                        {/* PDF Actions for accepted contracts - using client-side PDF with hash saving */}
                        {applicantStatus === "accepted" && approvalId && (
                          <>
                            <Button
                              variant="outline"
                              onClick={generatePdfFromPreview}
                              disabled={generatingPdf}
                              className="gap-1"
                            >
                              <Download className="w-4 h-4" />
                              {generatingPdf ? "Generating..." : "Download PDF"}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setShowTamperCheckModal(true)}
                              className="gap-1"
                            >
                              <Shield className="w-4 h-4" />
                              Tamper Check
                            </Button>
                          </>
                        )}

                        <Button
                          onClick={() => {
                            window.print();
                          }}
                        >
                          Print Preview
                        </Button>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Approval Employees Modal - Only show if not readOnly */}
      {!readOnly && (
        <Transition appear show={showApprovalModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => setShowApprovalModal(false)}
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
                      <Dialog.Title className="text-lg font-semibold">
                        Employees for Approval
                      </Dialog.Title>
                      <button
                        onClick={() => setShowApprovalModal(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {/* Validation message for current employee's approval */}
                      {hasPendingApprovalForCurrentEmployee && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <div className="text-amber-600 text-lg">⚠️</div>
                            <div className="flex-1">
                              <h4 className="font-semibold text-amber-800 mb-1">
                                Approval Already Pending
                              </h4>
                              <p className="text-sm text-amber-700">
                                This contract has already been sent for approval
                                for this employee and is currently pending. You
                                cannot send duplicate approval requests while
                                the current approval is still pending. Please
                                wait for the approval process to complete before
                                sending again.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {hasApprovalForCurrentEmployee &&
                        !hasPendingApprovalForCurrentEmployee && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                              <div className="text-blue-600 text-lg">ℹ️</div>
                              <div className="flex-1">
                                <h4 className="font-semibold text-blue-800 mb-1">
                                  Previous Approval Status
                                </h4>
                                <p className="text-sm text-blue-700">
                                  This contract has been sent for approval for
                                  this employee previously.
                                  {currentEmployeeApproval?.status ===
                                  "approved"
                                    ? " The approval has been completed and approved."
                                    : currentEmployeeApproval?.status ===
                                        "rejected"
                                      ? " Previous approval was rejected. You can send a new approval request."
                                      : " Approval status: " +
                                        currentEmployeeApproval?.status}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                      {loadingApprovalEmployees ? (
                        <div className="text-sm text-gray-500 text-center py-8">
                          Loading employees...
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Self Sign Required Checkbox */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selfSignRequired}
                                onChange={(e) =>
                                  setSelfSignRequired(e.target.checked)
                                }
                                className="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                              />
                              <div>
                                <span className="font-medium text-blue-900">
                                  Self Sign Required
                                </span>
                                <p className="text-sm text-blue-700 mt-0.5">
                                  Enable this to sign the contract yourself from
                                  the Contract Approvals section after sending.
                                </p>
                              </div>
                            </label>
                          </div>

                          {/* Add Approver Section */}
                          <div className="border-b pb-4">
                            <div className="flex items-center gap-2">
                              <Select
                                placeholder="Add an approver..."
                                options={employees
                                  .filter(
                                    (emp) =>
                                      !editableApproverIds.includes(emp._id)
                                  )
                                  .map((emp) => ({
                                    value: emp._id,
                                    label:
                                      `${emp.employeeFields?.personaldetails?.firstname || ""} ${emp.employeeFields?.personaldetails?.lastname || ""}`.trim() ||
                                      emp._id,
                                  }))}
                                onChange={(option: any) => {
                                  if (option?.value) {
                                    setEditableApproverIds((prev) => [
                                      ...prev,
                                      option.value,
                                    ]);
                                    setEditableApproverSettings((prev) => [
                                      ...prev,
                                      {
                                        employeeId: option.value,
                                        requireSignature: false,
                                      },
                                    ]);
                                    // Fetch the employee data if not already in approvalEmployees
                                    const existingEmp = employees.find(
                                      (e) => e._id === option.value
                                    );
                                    if (
                                      existingEmp &&
                                      !approvalEmployees.find(
                                        (e) => e._id === option.value
                                      )
                                    ) {
                                      setApprovalEmployees((prev) => [
                                        ...prev,
                                        existingEmp,
                                      ]);
                                    }
                                  }
                                }}
                                className="flex-1"
                              />
                              {/* Select Self Button - allows current user to add themselves as approver */}
                              {currentUserEmployeeId &&
                                !editableApproverIds.includes(
                                  currentUserEmployeeId
                                ) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      // Add current user as approver
                                      setEditableApproverIds((prev) => [
                                        ...prev,
                                        currentUserEmployeeId,
                                      ]);
                                      setEditableApproverSettings((prev) => [
                                        ...prev,
                                        {
                                          employeeId: currentUserEmployeeId,
                                          requireSignature: false,
                                        },
                                      ]);
                                      // Fetch employee data if not already loaded
                                      const existingEmp = employees.find(
                                        (e) => e._id === currentUserEmployeeId
                                      );
                                      if (
                                        existingEmp &&
                                        !approvalEmployees.find(
                                          (e) => e._id === currentUserEmployeeId
                                        )
                                      ) {
                                        setApprovalEmployees((prev) => [
                                          ...prev,
                                          existingEmp,
                                        ]);
                                      }
                                      toast.success(
                                        "Added yourself as an approver"
                                      );
                                    }}
                                    className="whitespace-nowrap"
                                  >
                                    Select Self
                                  </Button>
                                )}
                            </div>
                          </div>

                          {/* Approver List */}
                          {editableApproverIds.length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-4">
                              No approvers selected. Use the dropdown above to
                              add approvers.
                            </div>
                          ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                              {editableApproverIds.map((empId) => {
                                const emp =
                                  approvalEmployees.find(
                                    (e) => e._id === empId
                                  ) || employees.find((e) => e._id === empId);
                                if (!emp) return null;

                                const pdFromFields =
                                  emp.employeeFields?.personaldetails;
                                const pdFromProfile = emp.employeeProfile
                                  ?.personaldetails as any;
                                const firstname =
                                  pdFromFields?.firstname ||
                                  pdFromProfile?.firstname ||
                                  "";
                                const middlename =
                                  pdFromFields?.middlename ||
                                  pdFromProfile?.middlename ||
                                  "";
                                const lastname =
                                  pdFromFields?.lastname ||
                                  pdFromProfile?.lastname ||
                                  "";
                                const fullName =
                                  `${firstname} ${middlename} ${lastname}`.trim() ||
                                  emp._id;
                                const email =
                                  emp.email ||
                                  emp.employeeProfile?.userId?.email ||
                                  "N/A";
                                const designation =
                                  emp.designation?.name || "N/A";

                                const setting = editableApproverSettings.find(
                                  (s) => s.employeeId === empId
                                );
                                const requireSignature =
                                  setting?.requireSignature || false;

                                return (
                                  <div
                                    key={empId}
                                    className="flex items-center justify-between p-3 border rounded-lg bg-blue-50 border-blue-200"
                                  >
                                    <div className="flex items-center gap-3 flex-1">
                                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                                      <div className="flex-1">
                                        <div className="font-medium">
                                          {fullName}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {designation}
                                          {email !== "N/A" && ` · ${email}`}
                                        </div>
                                        {/* Require Signature Checkbox */}
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={requireSignature}
                                            onChange={(e) => {
                                              setEditableApproverSettings(
                                                (prev) =>
                                                  prev.map((s) =>
                                                    s.employeeId === empId
                                                      ? {
                                                          ...s,
                                                          requireSignature:
                                                            e.target.checked,
                                                        }
                                                      : s
                                                  )
                                              );
                                            }}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                          />
                                          <span className="text-xs text-gray-600">
                                            Require signature
                                          </span>
                                        </label>
                                      </div>
                                    </div>
                                    {/* Remove Button */}
                                    <button
                                      onClick={() => {
                                        setEditableApproverIds((prev) =>
                                          prev.filter((id) => id !== empId)
                                        );
                                        setEditableApproverSettings((prev) =>
                                          prev.filter(
                                            (s) => s.employeeId !== empId
                                          )
                                        );
                                      }}
                                      className="ml-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                      title="Remove approver"
                                    >
                                      <X size={18} />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-end gap-3 pt-4 border-t">
                        <Button
                          variant="outline"
                          onClick={() => setShowApprovalModal(false)}
                          disabled={sendingApproval}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSendForApproval}
                          disabled={
                            sendingApproval ||
                            editableApproverIds.length === 0 ||
                            hasPendingApprovalForCurrentEmployee
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingApproval ? "Sending..." : "Send for Approval"}
                        </Button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Self Sign Modal */}
      <SignModal
        isOpen={showSelfSignModal}
        onClose={() => setShowSelfSignModal(false)}
        onSign={handleSelfSign}
        userName={
          selectedEmployee?.employeeFields?.personaldetails?.firstname ||
          "Employer"
        }
      />

      {/* Tamper Check Modal */}
      {approvalId && (
        <TamperCheckModal
          isOpen={showTamperCheckModal}
          onClose={() => setShowTamperCheckModal(false)}
          approvalId={approvalId}
          isPublic={isPublicView}
          templateId={templateId}
          applicantId={initialEmployeeId}
          token={publicToken}
        />
      )}
    </>
  );
}
