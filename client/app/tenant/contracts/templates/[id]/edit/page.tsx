"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  Fragment,
  useRef,
} from "react";
import { useRouter, useParams } from "next/navigation";
import {
  Title,
  Input,
  Textarea,
  Button,
  Checkbox,
  Select,
  MultiSelect,
} from "rizzui";
import { contractTemplatesService } from "@/app/services/contractTemplates.service";
import axios from "@/app/lib/axios";
import { useDebouncedAutosave } from "@/app/hooks/useDebouncedAutosave";
import { toast } from "react-toastify";
import ContractTemplatePreviewModal from "@/app/components/shared/ContractTemplatePreviewModal";
import FieldPlaceholderHelper from "@/app/components/shared/FieldPlaceholderHelper";
import TokenEditModal from "@/app/components/shared/TokenEditModal";
import { TipTapRichTextEditor as RichTextEditor } from "@/app/components/shared/TipTapRichTextEditor";
import { TipTapFieldTokenEditor as FieldTokenEditor } from "@/app/components/shared/TipTapFieldTokenEditor";
import {
  Eye,
  Loader2,
  Check,
  Save,
  CheckCircle2,
  X,
  AlertTriangle,
  Search,
  X as XIcon,
  Plus,
  Minus,
  Pencil,
} from "lucide-react";
import { getProfileOrAdditionalValue } from "@/app/utils/employee-field-helpers";
import { Dialog, Transition } from "@headlessui/react";
import { useAppSelector } from "@/app/store/hook";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

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
    backgrounds: (string | { content: string; numberText?: string })[]; // Background items with optional number text
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
      options?: string[];
    }[];
  };
  schedule: {
    title?: string; // Rich text title for the Schedule section
    items: {
      key: string;
      label: string;
      order: number;
      numberText?: string;
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

const DEFAULT_SCHEDULE: Builder["schedule"] = {
  title: "SCHEDULE", // Default title
  items: [
    { key: "employer", label: "Employer", order: 1 },
    { key: "employee", label: "Employee", order: 2 },
    { key: "position", label: "Position", order: 3 },
    { key: "startDate", label: "Commencement Date", order: 4 },
    { key: "award", label: "Industrial Instrument/Award", order: 5 },
    { key: "location", label: "Principal Place of Employment", order: 6 },
    { key: "hours", label: "Normal span of hours of operation", order: 7 },
    { key: "pay", label: "Pay breakdown", order: 8 },
    { key: "law", label: "Governing Law", order: 9 },
  ],
};

function PageContent() {
  const params = useParams();
  const router = useRouter();
  // Template ID is always available from URL params in edit mode
  // This ID is used for all database operations: fetching, updating, and autosave
  // Extract templateId from URL params - this persists across page refreshes
  // Ensure we get the ID as a string (handle both string and array cases)
  const templateId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : undefined;

  // Get current user to check if they're in the selected employees list
  const { user } = useAppSelector((state) => state.auth);
  const currentUserEmployeeId = user?.activeAssignment?.employeeId
    ? String(user.activeAssignment.employeeId)
    : null;

  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Flag to prevent autosave during initial load
  const [step, setStep] = useState<number>(0);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [version, setVersion] = useState<string>("v1");
  const [recommended, setRecommended] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [startGrammarCheck, setStartGrammarCheck] = useState<boolean>(true);
  const [bodyGrammarCheck, setBodyGrammarCheck] = useState<boolean>(true);
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState<{
    clauseId: string;
    value: string;
  } | null>(null);
  const [initialData, setInitialData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [builder, setBuilder] = useState<Builder>({
    meta: { version: "v1", recommended: false },
    body: {
      title: "",
      description: "",
      backgrounds: ["", "", ""],
      clauses: [],
    },
    fields: { employee: [], organization: [], custom: [] },
    schedule: DEFAULT_SCHEDULE,
    logic: { clauseDefaults: {}, rules: [] },
    signing: {
      roles: [
        {
          key: "employer",
          label: "Employer Representative",
          type: "employer",
          order: 1,
          signatureMode: "typed",
          dateFormat: "DD/MM/YYYY",
        },
        {
          key: "employee",
          label: "Employee",
          type: "employee",
          order: 2,
          signatureMode: "typed",
          dateFormat: "DD/MM/YYYY",
        },
      ],
      cc: [],
      approvals: {
        employeeIds: [],
        employeeSettings: [],
        status: undefined,
        sentForApproval: false,
        sentAt: undefined,
        approvals: [],
      },
    },
  });

  // Dynamic employee fields fetched from /employee-field-config (tenant+branch scoped)
  const [employeeFieldOptions, setEmployeeFieldOptions] = useState<
    {
      key: string;
      label: string;
    }[]
  >([]);

  // Search state for employee fields
  const [employeeFieldSearch, setEmployeeFieldSearch] = useState<string>("");
  const [showEmployeeFieldSuggestions, setShowEmployeeFieldSuggestions] =
    useState<boolean>(false);

  // Filtered employee fields based on search
  const filteredEmployeeFields = useMemo(() => {
    if (!employeeFieldSearch.trim()) {
      return employeeFieldOptions;
    }
    const searchLower = employeeFieldSearch.toLowerCase();
    return employeeFieldOptions.filter(
      (field) =>
        field.label.toLowerCase().includes(searchLower) ||
        field.key.toLowerCase().includes(searchLower)
    );
  }, [employeeFieldOptions, employeeFieldSearch]);

  // Autocomplete suggestions (top 5 matches)
  const employeeFieldSuggestions = useMemo(() => {
    if (!employeeFieldSearch.trim() || !showEmployeeFieldSuggestions) {
      return [];
    }
    const searchLower = employeeFieldSearch.toLowerCase();
    const matches = employeeFieldOptions
      .filter(
        (field) =>
          field.label.toLowerCase().includes(searchLower) ||
          field.key.toLowerCase().includes(searchLower)
      )
      .slice(0, 5);
    return matches;
  }, [employeeFieldOptions, employeeFieldSearch, showEmployeeFieldSuggestions]);

  // Token edit modal state
  const [tokenEditModal, setTokenEditModal] = useState<{
    isOpen: boolean;
    scheduleItemKey: string;
    fieldRef: string;
    tokenLabel: string;
    tokenPlaceholder: string;
    initialContent: string;
  } | null>(null);

  // Employee data for Approvals and Signing section
  type Employee = {
    _id: string;
    employeeFields?: any;
    employeerOnlyAdditionalFields?: any[];
    designation?: { _id: string; name: string };
    email?: string;
  };
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employmentTypes, setEmploymentTypes] = useState<
    { label: string; value: string }[]
  >([]);
  const [designations, setDesignations] = useState<
    { label: string; value: string }[]
  >([]);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<
    string[]
  >([]);
  const [selectedDesignationIds, setSelectedDesignationIds] = useState<
    string[]
  >([]);

  // Ref to prevent infinite loops in employee selection
  const isProcessingEmployeeSelectionRef = useRef(false);

  // Warning modal state for employee removal
  const [showRemoveWarning, setShowRemoveWarning] = useState<boolean>(false);
  const [employeeToRemove, setEmployeeToRemove] = useState<{
    id: string;
    name: string;
    approvalStatus?: "pending" | "approved" | "rejected";
  } | null>(null);

  // Loading states for individual row sends
  const [sendingEmployeeId, setSendingEmployeeId] = useState<string | null>(
    null
  );
  const [sendingAll, setSendingAll] = useState<boolean>(false);

  // Warning modal for already-sent approvals
  const [showAlreadySentWarning, setShowAlreadySentWarning] =
    useState<boolean>(false);
  const [alreadySentMessage, setAlreadySentMessage] = useState<string>("");

  // Update approval state
  const [updatingEmployeeId, setUpdatingEmployeeId] = useState<string | null>(
    null
  );
  const [showUpdateWarning, setShowUpdateWarning] = useState<boolean>(false);
  const [employeeToUpdate, setEmployeeToUpdate] = useState<string | null>(null);

  const [templateStatus, setTemplateStatus] = useState<
    "draft" | "published" | undefined
  >(undefined);
  const isPublished = templateStatus === "published";

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get("/employee-field-config");
        const sections: any[] = res?.data?.data?.sections || [];
        // Flatten all fields across sections/innerSections
        const result: { key: string; label: string }[] = [];
        const walk = (node: any) => {
          const fields = Array.isArray(node?.fields) ? node.fields : [];
          fields.forEach((f: any) => {
            if (f?.key) {
              result.push({
                key: String(f.key),
                label: String(f.label || f.key),
              });
            }
          });
          const children = Array.isArray(node?.innerSections)
            ? node.innerSections
            : [];
          children.forEach(walk);
        };
        sections.forEach(walk);
        // Deduplicate by key
        const deduped = Object.values(
          result.reduce(
            (acc: Record<string, { key: string; label: string }>, cur) => {
              acc[cur.key] = acc[cur.key] || cur;
              return acc;
            },
            {}
          )
        ) as { key: string; label: string }[];
        setEmployeeFieldOptions(deduped);
      } catch (e) {
        // silent fail; keep defaults
      }
    })();
  }, []);

  // Load employment types and designations for filtering
  useEffect(() => {
    (async () => {
      try {
        const [empTypesRes, desRes] = await Promise.all([
          axios.get("/employee-field-config/employment-types"),
          axios.get("/designations", { params: { limit: 1000 } }),
        ]);
        setEmploymentTypes(
          (empTypesRes.data.data as string[]).map((s) => ({
            label: s,
            value: s,
          }))
        );
        setDesignations(
          (desRes.data.data as any[]).map((d) => ({
            label: d.name,
            value: d._id,
          }))
        );
      } catch (e) {
        console.error("Failed to load employment types or designations", e);
      }
    })();
  }, []);

  // Fetch employees when step 5 (Approvals and Signing) is active
  useEffect(() => {
    if (step !== 5) return;

    const fetchEmployees = async () => {
      setLoadingEmployees(true);
      try {
        const res = await axios.get("/employees", {
          params: {
            page: 1,
            limit: 1000,
            search: "",
          },
        });

        const allEmployees = res.data.data || [];
        // Filter only onboard employees
        const onboardEmployees = allEmployees.filter((emp: Employee) => {
          const employmentStatus = getProfileOrAdditionalValue(
            emp,
            "employeedetails",
            "employmentstatus"
          );
          return employmentStatus === "Onboard" || !employmentStatus;
        });

        setEmployees(
          onboardEmployees.length > 0 ? onboardEmployees : allEmployees
        );
      } catch (err) {
        console.error("Failed to fetch employees", err);
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [step]);

  // Poll for approval status updates when approvals are sent
  useEffect(() => {
    // Validate templateId before polling
    if (
      !templateId ||
      typeof templateId !== "string" ||
      templateId === "undefined" ||
      templateId === "null"
    )
      return;
    if (!builder.signing.approvals?.sentForApproval) return;
    if (isPublished) return; // Don't poll if published

    const hasPendingApprovals =
      builder.signing.approvals?.status === "pending" ||
      (builder.signing.approvals?.approvals &&
        builder.signing.approvals.approvals.some(
          (a) => a.status === "pending"
        ));

    if (!hasPendingApprovals) return; // Don't poll if no pending approvals

    const pollInterval = setInterval(async () => {
      // Double-check templateId is still valid before making request
      if (
        !templateId ||
        typeof templateId !== "string" ||
        templateId === "undefined" ||
        templateId === "null"
      ) {
        clearInterval(pollInterval);
        return;
      }

      try {
        // Fetch approvals from backend
        const response = await axios.get(
          `/contract-templates/${templateId}/approvals`
        );
        const backendApprovals = response.data.data || [];

        // Map backend approvals to frontend format
        const mappedApprovals = backendApprovals.map((a: any) => ({
          employeeId: a.employeeId.toString(),
          status: a.status,
          respondedAt: a.respondedAt,
        }));

        // Calculate overall status
        let overallStatus: "pending" | "approved" | "rejected" | undefined =
          undefined;
        if (mappedApprovals.length > 0) {
          const hasRejected = mappedApprovals.some(
            (a: any) => a.status === "rejected"
          );
          const hasPending = mappedApprovals.some(
            (a: any) => a.status === "pending"
          );
          const allApproved = mappedApprovals.every(
            (a: any) => a.status === "approved"
          );

          if (hasRejected) {
            overallStatus = "rejected";
          } else if (hasPending) {
            overallStatus = "pending";
          } else if (allApproved) {
            overallStatus = "approved";
          }
        }

        const currentApprovals = builder.signing.approvals;
        const statusChanged = overallStatus !== currentApprovals?.status;
        const approvalsChanged =
          JSON.stringify(mappedApprovals) !==
          JSON.stringify(currentApprovals?.approvals);

        if (statusChanged || approvalsChanged) {
          setBuilder((prev) => ({
            ...prev,
            signing: {
              ...prev.signing,
              approvals: {
                ...prev.signing.approvals!,
                status: overallStatus,
                approvals: mappedApprovals,
              },
            },
          }));
        }
      } catch (err: any) {
        // Only log non-404 errors (404 means template doesn't exist, which shouldn't happen in edit mode but handle gracefully)
        if (err?.response?.status !== 404) {
          console.error("Failed to poll approval status", err);
        }
        // If 404, stop polling as template might have been deleted
        if (err?.response?.status === 404) {
          clearInterval(pollInterval);
        }
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [
    templateId,
    builder.signing.approvals?.sentForApproval,
    builder.signing.approvals?.status,
    isPublished,
  ]);

  // Load existing template data immediately on mount and on refresh using template ID from URL
  // This ensures all form fields are pre-filled with existing data from the database
  // This effect runs whenever templateId changes or on component mount (including page refresh)
  useEffect(() => {
    // Wait for templateId to be available (it should be available from URL params)
    // In Next.js App Router, params might not be immediately available on first render
    if (!templateId) {
      console.warn("Template ID not available yet, params:", params);
      // Give it a moment for params to load, then check again
      const timeoutId = setTimeout(() => {
        if (!params?.id) {
          console.error("Template ID still not available after timeout");
          setLoading(false);
        }
      }, 100);
      return () => clearTimeout(timeoutId);
    }

    console.log("Loading template data for ID:", templateId);

    // Prevent autosave during initial load to avoid saving empty values
    setIsInitialLoad(true);

    let isMounted = true; // Flag to prevent state updates if component unmounts
    let cancelled = false; // Additional cancellation flag

    (async () => {
      try {
        setLoading(true);
        console.log("Fetching template from API for ID:", templateId);
        // Fetch template data using the document ID from URL
        const template = await contractTemplatesService.get(templateId);

        // Check if component is still mounted and not cancelled
        if (!isMounted || cancelled) {
          console.log(
            "Component unmounted or cancelled, skipping state update"
          );
          return;
        }

        console.log("Template data loaded:", template);

        // Set all form fields with loaded data (don't reset to empty first!)
        setTitle(template.title || "");
        setDescription(template.description || "");
        setVersion(template.version || "v1");
        setRecommended(template.recommended || false);
        setTemplateStatus(template.status || "draft");

        // Migrate and set builder data
        const bgArray: (string | { content: string; numberText?: string })[] =
          Array.isArray(template.builder?.body?.backgrounds)
            ? template.builder.body.backgrounds.map((bg: any) => {
                // If already in new format, keep it; otherwise migrate from string
                if (typeof bg === "object" && bg !== null && "content" in bg) {
                  return bg;
                }
                return typeof bg === "string"
                  ? bg
                  : { content: bg || "", numberText: undefined };
              })
            : [
                template.builder?.body?.background?.A,
                template.builder?.body?.background?.B,
                template.builder?.body?.background?.C,
              ].filter((v) => typeof v === "string");

        const migratedBuilder: Builder = {
          meta: template.builder?.meta || {
            version: template.version || "v1",
            recommended: template.recommended || false,
          },
          body: {
            title: template.builder?.body?.title || "",
            description: template.builder?.body?.description,
            backgroundTitle: template.builder?.body?.backgroundTitle,
            backgrounds: (bgArray && bgArray.length
              ? bgArray
              : ["", "", ""]
            ).slice(0),
            clauseTitle: template.builder?.body?.clauseTitle,
            clauses: Array.isArray(template.builder?.body?.clauses)
              ? template.builder.body.clauses.map(
                  (clause: any, idx: number) => ({
                    ...clause,
                    order: clause.order !== undefined ? clause.order : idx + 1,
                    category: clause.category || "Other",
                  })
                )
              : [],
          },
          fields: template.builder?.fields || {
            employee: [],
            organization: [],
            custom: [],
          },
          schedule: Array.isArray(template.builder?.schedule)
            ? { title: "SCHEDULE", items: template.builder.schedule } // Migrate old array format
            : template.builder?.schedule &&
                typeof template.builder.schedule === "object" &&
                "items" in template.builder.schedule
              ? {
                  title: template.builder.schedule.title || "SCHEDULE",
                  items: template.builder.schedule.items || [],
                }
              : DEFAULT_SCHEDULE,
          logic: template.builder?.logic || { clauseDefaults: {}, rules: [] },
          signing: template.builder?.signing || {
            roles: [
              {
                key: "employer",
                label: "Employer Representative",
                type: "employer",
                order: 1,
                signatureMode: "typed",
                dateFormat: "DD/MM/YYYY",
              },
              {
                key: "employee",
                label: "Employee",
                type: "employee",
                order: 2,
                signatureMode: "typed",
                dateFormat: "DD/MM/YYYY",
              },
            ],
            cc: [],
            approvals: {
              employeeIds:
                template.builder?.signing?.approvals?.employeeIds || [],
              employeeSettings:
                template.builder?.signing?.approvals?.employeeSettings || [],
              status: template.builder?.signing?.approvals?.status || undefined,
              sentForApproval:
                template.builder?.signing?.approvals?.sentForApproval || false,
              sentAt: template.builder?.signing?.approvals?.sentAt || undefined,
              approvals: template.builder?.signing?.approvals?.approvals || [],
            },
          },
        };

        // Double-check before setting state
        if (!isMounted || cancelled) {
          console.log("Component unmounted or cancelled before setting state");
          return;
        }

        // Fetch approvals from backend if template has employeeIds
        if (
          migratedBuilder.signing.approvals?.employeeIds &&
          migratedBuilder.signing.approvals.employeeIds.length > 0
        ) {
          try {
            const approvalsResponse = await axios.get(
              `/contract-templates/${templateId}/approvals`
            );
            const backendApprovals = approvalsResponse.data.data || [];

            // Map backend approvals to frontend format
            const mappedApprovals = backendApprovals.map((a: any) => ({
              employeeId: a.employeeId.toString(),
              status: a.status,
              respondedAt: a.respondedAt,
            }));

            // Calculate overall status
            let overallStatus: "pending" | "approved" | "rejected" | undefined =
              undefined;
            if (mappedApprovals.length > 0) {
              const hasRejected = mappedApprovals.some(
                (a: any) => a.status === "rejected"
              );
              const hasPending = mappedApprovals.some(
                (a: any) => a.status === "pending"
              );
              const allApproved = mappedApprovals.every(
                (a: any) => a.status === "approved"
              );

              if (hasRejected) {
                overallStatus = "rejected";
              } else if (hasPending) {
                overallStatus = "pending";
              } else if (allApproved) {
                overallStatus = "approved";
              }
            }

            // Update migratedBuilder with backend approvals
            migratedBuilder.signing.approvals = {
              ...migratedBuilder.signing.approvals,
              status: overallStatus,
              sentForApproval: mappedApprovals.length > 0,
              approvals: mappedApprovals,
            };
          } catch (err) {
            console.error("Failed to fetch approvals from backend", err);
            // Continue with template data even if approvals fetch fails
          }
        }

        setBuilder(migratedBuilder);
        setStep(1); // Start at step 1 (Body & Clauses) since template already exists

        // Store initial data for comparison
        setInitialData({
          title: template.title || "",
          description: template.description || "",
          version: template.version || "v1",
          recommended: template.recommended || false,
          builder: migratedBuilder,
        });

        // Now that data is loaded, allow autosave to work
        setIsInitialLoad(false);

        console.log("Template data successfully loaded and form pre-filled");
      } catch (e) {
        console.error("Failed to load template", e);
        if (isMounted && !cancelled) {
          toast.error("Failed to load template");
          setIsInitialLoad(false); // Allow autosave even if load failed
          // Don't redirect on error - let user see the error
        }
      } finally {
        if (isMounted && !cancelled) {
          setLoading(false);
        }
      }
    })();

    // Cleanup function to cancel the async operation if component unmounts
    return () => {
      isMounted = false;
      cancelled = true;
    };
  }, [templateId, router, params]);

  // Track if there are unsaved changes (compare with initial data)
  useEffect(() => {
    if (!initialData || loading) return;

    const hasChanges =
      title !== initialData.title ||
      description !== initialData.description ||
      version !== initialData.version ||
      recommended !== initialData.recommended ||
      JSON.stringify(builder) !== JSON.stringify(initialData.builder);

    setHasUnsavedChanges(hasChanges);
  }, [title, description, version, recommended, builder, initialData, loading]);

  // Warn before page refresh/close
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "You have unsaved changes. Are you sure you want to leave?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Handle navigation with unsaved changes warning
  const handleNavigation = useCallback(
    (targetUrl?: string) => {
      if (hasUnsavedChanges) {
        const confirmed = window.confirm(
          "You have unsaved changes. If you leave this page, your changes may be lost.\n\nDo you want to leave this page?"
        );
        if (!confirmed) {
          return;
        }
      }
      if (targetUrl) {
        router.push(targetUrl);
      } else {
        router.push("/tenant/configs/contracts");
      }
    },
    [hasUnsavedChanges, router]
  );

  // Helper: migrate legacy background object {A,B,C} to backgrounds[] once
  const migrateBuilder = useCallback((b: any): Builder => {
    const bgArray: (string | { content: string; numberText?: string })[] =
      Array.isArray(b?.body?.backgrounds)
        ? b.body.backgrounds.map((bg: any) => {
            // If already in new format, keep it; otherwise migrate from string
            if (typeof bg === "object" && bg !== null && "content" in bg) {
              return bg;
            }
            return typeof bg === "string"
              ? bg
              : { content: bg || "", numberText: undefined };
          })
        : [
            b?.body?.background?.A,
            b?.body?.background?.B,
            b?.body?.background?.C,
          ].filter((v) => typeof v === "string");
    const safe: Builder = {
      meta: b?.meta || { version: "v1", recommended: false },
      body: {
        title: b?.body?.title || "",
        description: b?.body?.description || "",
        backgroundTitle: b?.body?.backgroundTitle,
        backgrounds: (bgArray && bgArray.length ? bgArray : ["", "", ""]).slice(
          0
        ),
        clauseTitle: b?.body?.clauseTitle,
        clauses: Array.isArray(b?.body?.clauses)
          ? b.body.clauses.map((clause: any, idx: number) => ({
              ...clause,
              order: clause.order !== undefined ? clause.order : idx + 1,
              category: clause.category || "Other",
            }))
          : [],
        clauseTitle: b?.body?.clauseTitle,
      },
      fields: b?.fields || { employee: [], organization: [], custom: [] },
      schedule: Array.isArray(b?.schedule)
        ? { title: "SCHEDULE", items: b.schedule } // Migrate old array format to new object format
        : b?.schedule && typeof b.schedule === "object" && "items" in b.schedule
          ? {
              title: b.schedule.title || "SCHEDULE",
              items: b.schedule.items || [],
            }
          : DEFAULT_SCHEDULE,
      logic: b?.logic || { clauseDefaults: {}, rules: [] },
      signing: b?.signing || {
        roles: [],
        cc: [],
        approvals: {
          employeeIds: [],
          employeeSettings: [],
          status: undefined,
          sentForApproval: false,
          sentAt: undefined,
          approvals: [],
        },
      },
    };
    return safe;
  }, []);

  const canProceedStart = title.trim().length > 0;

  // Helper function to insert placeholder at cursor position in textarea
  const insertPlaceholder = (
    textarea: HTMLTextAreaElement,
    placeholder: string,
    currentValue: string,
    setValue: (value: string) => void
  ) => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue =
      currentValue.substring(0, start) +
      placeholder +
      currentValue.substring(end);
    setValue(newValue);
    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + placeholder.length,
        start + placeholder.length
      );
    }, 0);
  };

  // Helper function to get field label from fieldRef
  const getFieldLabel = (fieldRef: string): string => {
    if (!fieldRef) return "";

    // Handle custom field references
    const customMatch = fieldRef.match(/^\{?\{?custom\.([^}]+)\}?\}?$/);
    if (customMatch) {
      const fieldKey = customMatch[1];
      const customField = builder.fields.custom?.find(
        (f) => f.key === fieldKey
      );
      return customField?.label || fieldKey;
    }

    // Handle employee field references
    const employeeMatch = fieldRef.match(/^\{?\{?employee\.([^}]+)\}?\}?$/);
    if (employeeMatch) {
      const fieldKey = employeeMatch[1];
      const option = employeeFieldOptions.find((opt) => opt.key === fieldKey);
      if (option) return option.label;
      // Fallback to static labels
      const staticLabels: Record<string, string> = {
        name: "Full Name",
        email: "Email",
        position: "Position",
        startDate: "Start Date",
        location: "Location",
        hours: "Working Hours",
        pay: "Pay/Salary",
        department: "Department",
        supervisor: "Supervisor",
        lastname: "Lastname",
        firstName: "First Name",
        lastName: "Lastname",
      };
      return staticLabels[fieldKey] || fieldKey;
    }

    // Handle organization field references
    const orgMatch = fieldRef.match(/^\{?\{?organization\.([^}]+)\}?\}?$/);
    if (orgMatch) {
      const fieldKey = orgMatch[1];
      const staticLabels: Record<string, string> = {
        employerName: "Employer Name",
        abn: "ABN",
        address: "Address",
        defaultGoverningLaw: "Governing Law",
        superNote: "Super Note",
      };
      return staticLabels[fieldKey] || fieldKey;
    }

    return fieldRef;
  };

  // Helper function to replace placeholders with labels for display
  const replacePlaceholdersWithLabels = (text: string): string => {
    if (!text) return text;
    let result = text;

    // Replace custom field placeholders
    builder.fields.custom?.forEach((field) => {
      const placeholder = `{{custom.${field.key}}}`;
      const label = field.label;
      result = result.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        label
      );
    });

    // Replace employee field placeholders
    builder.fields.employee?.forEach((fieldKey) => {
      const placeholder = `{{employee.${fieldKey}}}`;
      const label = getFieldLabel(`employee.${fieldKey}`);
      result = result.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        label
      );
    });

    // Replace organization field placeholders
    builder.fields.organization?.forEach((fieldKey) => {
      const placeholder = `{{organization.${fieldKey}}}`;
      const label = getFieldLabel(`organization.${fieldKey}`);
      result = result.replace(
        new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
        label
      );
    });

    return result;
  };
  // Helper: extract field references from text and return readable labels
  const extractFieldReferenceLabels = (text: string): string[] => {
    if (!text) return [];
    const refs: string[] = [];
    const regex = /\{\{(employee|custom|organization)\.[^}]+\}\}/g;
    const seen = new Set<string>();
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const ref = match[0];
      const inner = ref.replace(/^\{\{/, "").replace(/\}\}$/, "");
      const label = getFieldLabel(inner);
      if (!seen.has(label)) {
        seen.add(label);
        refs.push(label);
      }
    }
    return refs;
  };

  // Helper function to replace labels back to placeholders when saving
  const replaceLabelsWithPlaceholders = (text: string): string => {
    if (!text) return text;
    let result = text;

    // Build a map of label -> placeholder for reverse lookup
    const labelToPlaceholder: Record<string, string> = {};

    // Custom fields
    builder.fields.custom?.forEach((field) => {
      labelToPlaceholder[field.label] = `{{custom.${field.key}}}`;
    });

    // Employee fields
    builder.fields.employee?.forEach((fieldKey) => {
      const label = getFieldLabel(`employee.${fieldKey}`);
      labelToPlaceholder[label] = `{{employee.${fieldKey}}}`;
    });

    // Organization fields
    builder.fields.organization?.forEach((fieldKey) => {
      const label = getFieldLabel(`organization.${fieldKey}`);
      labelToPlaceholder[label] = `{{organization.${fieldKey}}}`;
    });

    // Replace labels with placeholders (longest match first to avoid partial matches)
    const sortedLabels = Object.keys(labelToPlaceholder).sort(
      (a, b) => b.length - a.length
    );
    sortedLabels.forEach((label) => {
      // Escape special regex characters in the label
      const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // Match whole word (handles spaces in labels too)
      const regex = new RegExp(`(^|\\s)${escapedLabel}(\\s|$)`, "g");
      result = result.replace(regex, (match, before, after) => {
        return before + labelToPlaceholder[label] + after;
      });
    });

    return result;
  };

  // Helper: map a label back to canonical fieldRef (employee.x, custom.x, organization.x)
  const mapLabelToFieldRef = (label: string): string | null => {
    if (!label) return null;
    // Check custom fields
    const custom = builder.fields.custom?.find((f) => f.label === label);
    if (custom) return `custom.${custom.key}`;
    // Check employee fields
    const emp = employeeFieldOptions.find((o) => o.label === label);
    if (emp) return `employee.${emp.key}`;
    // Check organization (static fallback)
    const orgStatic: Record<string, string> = {
      "Employer Name": "organization.employerName",
      ABN: "organization.abn",
      Address: "organization.address",
      "Governing Law": "organization.defaultGoverningLaw",
      "Super Note": "organization.superNote",
    };
    if (orgStatic[label]) return orgStatic[label];
    return null;
  };

  // Render highlighted nodes by replacing placeholders with labeled spans
  const renderHighlightedNodes = (text: string) => {
    if (!text) return null;
    const nodes: any[] = [];
    const regex = /\{\{(employee|custom|organization)\.[^}]+\}\}/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const end = regex.lastIndex;
      if (start > lastIndex) {
        nodes.push(text.slice(lastIndex, start));
      }
      const inner = match[0].replace(/^\{\{/, "").replace(/\}\}$/, "");
      const label = getFieldLabel(inner);
      nodes.push(
        <span
          key={`${start}-${end}`}
          className="bg-yellow-100 text-yellow-800 px-1 rounded"
        >
          {label}
        </span>
      );
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }
    return nodes;
  };

  // Auto-save for Start section (title, description, version, recommended)
  const autosaveStart = useDebouncedAutosave(async () => {
    if (!templateId || !autosaveEnabled || isInitialLoad) return; // Don't autosave during initial load
    try {
      setIsSaving(true);
      await contractTemplatesService.update(templateId, {
        title,
        description,
        version,
        recommended,
        builder,
      });
      setLastSaved(new Date());
      // Update initial data after successful save to clear unsaved changes flag
      if (initialData) {
        setInitialData({
          title,
          description,
          version,
          recommended,
          builder,
        });
      }
    } catch {
      // ignore autosave errors
    } finally {
      setIsSaving(false);
    }
  }, 800);

  // Ensure template exists - for edit page, templateId should always exist from URL
  // This is a safety check to ensure we have a valid template ID
  useEffect(() => {
    if (!templateId) {
      toast.error("Template ID is missing");
      router.push("/tenant/configs/contracts");
    }
  }, [templateId, router]);

  // Auto-save when title, description, version, or recommended changes
  useEffect(() => {
    // Don't autosave during initial load to prevent saving empty values
    if (isInitialLoad || !templateId || !autosaveEnabled) return;
    // Trigger autosave with current values (this ensures latest title/description are used)
    autosaveStart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    title,
    description,
    version,
    recommended,
    templateId,
    autosaveEnabled,
    isInitialLoad,
  ]);

  // Auto-save for Body and Clauses section (builder changes)
  const autosave = useDebouncedAutosave<Builder>(async (b) => {
    if (!templateId || !autosaveEnabled || isInitialLoad) return; // Don't autosave during initial load
    try {
      setIsSaving(true);
      await contractTemplatesService.update(templateId, {
        title,
        description,
        version,
        recommended,
        builder: b,
      });
      setLastSaved(new Date());
      // Update initial data after successful save to clear unsaved changes flag
      if (initialData) {
        setInitialData({
          title,
          description,
          version,
          recommended,
          builder: b,
        });
      }
    } catch {
      // ignore autosave errors
    } finally {
      setIsSaving(false);
    }
  }, 800);

  // Manual save function for when autosave is disabled or when user clicks Save button
  const manualSave = async (b?: Builder) => {
    if (!templateId) return;
    try {
      setIsSaving(true);
      const dataToSave = b || builder;
      await contractTemplatesService.update(templateId, {
        title,
        description,
        version,
        recommended,
        builder: dataToSave,
      });
      setLastSaved(new Date());
      // Update initial data after successful save to clear unsaved changes flag
      setInitialData({
        title,
        description,
        version,
        recommended,
        builder: dataToSave,
      });
      toast.success("Saved");
    } catch (e) {
      console.error("Failed to save", e);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const addClause = () => {
    const id = Math.random().toString(36).slice(2);
    const maxOrder =
      builder.body.clauses.length > 0
        ? Math.max(...builder.body.clauses.map((c) => c.order || 0))
        : 0;
    const clause: Clause = {
      id,
      order: maxOrder + 1,
      heading: "New Clause",
      text: "",
      category: "Other",
      optional: false,
      defaultIncluded: true,
      subclauses: [],
    };
    const next = {
      ...builder,
      body: { ...builder.body, clauses: [...builder.body.clauses, clause] },
    };
    setBuilder(next);
    autosave(next);
  };

  // Helper function to get employee settings
  const getEmployeeSetting = (employeeId: string) => {
    const settings = builder.signing.approvals?.employeeSettings || [];
    return (
      settings.find((s) => s.employeeId === employeeId) || {
        employeeId,
        requireSignature: false,
        signatureType: undefined,
      }
    );
  };

  // Helper function to update employee setting
  const updateEmployeeSetting = (
    employeeId: string,
    updates: Partial<{
      requireSignature: boolean;
      signatureType?: "typed" | "drawn" | "upload";
    }>
  ) => {
    const currentApprovals = builder.signing.approvals || {
      employeeIds: [],
      employeeSettings: [],
      status: undefined,
      sentForApproval: false,
      sentAt: undefined,
      approvals: [],
    };
    const currentSettings = currentApprovals.employeeSettings || [];
    const existingIndex = currentSettings.findIndex(
      (s) => s.employeeId === employeeId
    );

    let newSettings: typeof currentSettings;
    if (existingIndex >= 0) {
      newSettings = [...currentSettings];
      newSettings[existingIndex] = {
        ...newSettings[existingIndex],
        ...updates,
      };
    } else {
      newSettings = [
        ...currentSettings,
        { employeeId, requireSignature: false, ...updates },
      ];
    }

    const next = {
      ...builder,
      signing: {
        ...builder.signing,
        approvals: {
          ...currentApprovals,
          employeeSettings: newSettings,
        },
      },
    };
    setBuilder(next);
    autosave(next);
  };

  // Handle employee removal (after confirmation)
  const handleRemoveEmployee = async () => {
    if (!employeeToRemove) return;

    const currentApprovals = builder.signing.approvals || {
      employeeIds: [],
      employeeSettings: [],
      status: undefined,
      sentForApproval: false,
      sentAt: undefined,
      approvals: [],
    };

    // Remove employee from selected list
    const newIds = (currentApprovals.employeeIds || []).filter(
      (id) => id !== employeeToRemove.id
    );

    // Remove employee settings
    const newSettings = (currentApprovals.employeeSettings || []).filter(
      (s) => s.employeeId !== employeeToRemove.id
    );

    // Remove approval record
    const newApprovals = (currentApprovals.approvals || []).filter(
      (a) => a.employeeId !== employeeToRemove.id
    );

    // Update overall status if needed
    let newStatus = currentApprovals.status;
    if (newApprovals.length === 0) {
      newStatus = undefined;
    } else if (newApprovals.every((a) => a.status === "approved")) {
      newStatus = "approved";
    } else if (newApprovals.some((a) => a.status === "rejected")) {
      newStatus = "rejected";
    } else if (newApprovals.some((a) => a.status === "pending")) {
      newStatus = "pending";
    }

    const next = {
      ...builder,
      signing: {
        ...builder.signing,
        approvals: {
          ...currentApprovals,
          employeeIds: newIds,
          employeeSettings: newSettings,
          approvals: newApprovals,
          status: newStatus,
        },
      },
    };

    setBuilder(next);

    // Save to database
    if (templateId) {
      try {
        await contractTemplatesService.update(templateId, {
          title,
          description,
          version,
          recommended,
          builder: next,
        });
        toast.success("Employee removed and approval record deleted");
      } catch (err) {
        console.error("Failed to update template", err);
        toast.error("Failed to remove employee");
      }
    } else {
      autosave(next);
    }

    // Close modal
    setShowRemoveWarning(false);
    setEmployeeToRemove(null);
  };

  // Check if employee has existing approval request
  const hasExistingApproval = (
    employeeId: string
  ): { hasApproval: boolean; status?: "pending" | "approved" | "rejected" } => {
    const approvals = builder.signing.approvals;
    if (!approvals?.sentForApproval) {
      return { hasApproval: false };
    }

    const approvalRecord = approvals.approvals?.find(
      (a) => a.employeeId === employeeId
    );
    if (approvalRecord) {
      return { hasApproval: true, status: approvalRecord.status };
    }

    return { hasApproval: false };
  };

  const sendForApproval = async () => {
    if (!templateId) return;
    const selectedEmployeeIds = builder.signing.approvals?.employeeIds || [];
    if (selectedEmployeeIds.length === 0) {
      toast.error("Please select at least one employee for approval");
      return;
    }

    try {
      const currentApprovals = builder.signing.approvals || {
        employeeIds: [],
        employeeSettings: [],
        status: undefined,
        sentForApproval: false,
        sentAt: undefined,
        approvals: [],
      };

      // Get existing approval records from backend
      let existingApprovals: any[] = [];
      try {
        const approvalsResponse = await axios.get(
          `/contract-templates/${templateId}/approvals`
        );
        existingApprovals = approvalsResponse.data.data || [];
      } catch (err) {
        console.error("Failed to fetch existing approvals", err);
      }

      const existingApprovalIds = new Set(
        existingApprovals.map((a: any) => a.employeeId.toString())
      );

      // Get employee settings for each selected employee
      const employees = selectedEmployeeIds.map((employeeId: string) => {
        const setting = getEmployeeSetting(employeeId);
        return {
          employeeId,
          requireSignature: setting.requireSignature || false,
          signatureType: setting.signatureType,
        };
      });

      // Call backend API to send approval requests
      await axios.post(`/contract-templates/${templateId}/send-approval`, {
        employees,
      });

      // Fetch updated approvals from backend
      const approvalsResponse = await axios.get(
        `/contract-templates/${templateId}/approvals`
      );
      const backendApprovals = approvalsResponse.data.data || [];

      // Map backend approvals to frontend format
      const mappedApprovals = backendApprovals.map((a: any) => ({
        employeeId: a.employeeId.toString(),
        status: a.status,
        respondedAt: a.respondedAt,
      }));

      // Calculate overall status
      let overallStatus: "pending" | "approved" | "rejected" | undefined =
        undefined;
      if (mappedApprovals.length > 0) {
        const hasRejected = mappedApprovals.some(
          (a: any) => a.status === "rejected"
        );
        const hasPending = mappedApprovals.some(
          (a: any) => a.status === "pending"
        );
        const allApproved = mappedApprovals.every(
          (a: any) => a.status === "approved"
        );

        if (hasRejected) {
          overallStatus = "rejected";
        } else if (hasPending) {
          overallStatus = "pending";
        } else if (allApproved) {
          overallStatus = "approved";
        }
      }

      // Update sentAt only if this is the first time sending
      const sentAt = currentApprovals.sentForApproval
        ? currentApprovals.sentAt
        : new Date().toISOString();

      const updatedApprovals = {
        ...currentApprovals,
        employeeIds: selectedEmployeeIds,
        sentForApproval: true,
        sentAt,
        status: overallStatus,
        approvals: mappedApprovals,
      };

      const next = {
        ...builder,
        signing: {
          ...builder.signing,
          approvals: updatedApprovals,
        },
      };

      setBuilder(next);
      await contractTemplatesService.update(templateId, {
        title,
        description,
        version,
        recommended,
        builder: next,
      });

      const newApprovalsCount = backendApprovals.filter(
        (a: any) =>
          a.status === "pending" &&
          !existingApprovalIds.has(a.employeeId.toString())
      ).length;
      if (newApprovalsCount > 0) {
        toast.success(
          `Approval requests sent to ${newApprovalsCount} employee(s)`
        );
      } else {
        toast.info(
          "All selected employees already have approval records. No new requests sent."
        );
      }
    } catch (err: any) {
      console.error("Failed to send for approval", err);
      toast.error(
        err?.response?.data?.message || "Failed to send for approval"
      );
    }
  };

  // Send approval for a single employee
  const handleSendSingleApproval = async (employeeId: string) => {
    if (!templateId || isPublished) return;

    // Check if already sent
    const approvalRecord = builder.signing.approvals?.approvals?.find(
      (a) => a.employeeId === employeeId
    );
    const approvalStatus = approvalRecord?.status || "not_sent";

    if (approvalStatus !== "not_sent") {
      setAlreadySentMessage("This approval request was already sent.");
      setShowAlreadySentWarning(true);
      return;
    }

    setSendingEmployeeId(employeeId);

    try {
      const employeeSetting = getEmployeeSetting(employeeId);

      const response = await axios.post(
        `/contract-templates/${templateId}/send-approval/${employeeId}`,
        {
          requireSignature: employeeSetting.requireSignature || false,
          signatureType: employeeSetting.signatureType,
        }
      );

      // Fetch updated approvals from backend
      const approvalsResponse = await axios.get(
        `/contract-templates/${templateId}/approvals`
      );
      const backendApprovals = approvalsResponse.data.data || [];

      // Map backend approvals to frontend format
      const mappedApprovals = backendApprovals.map((a: any) => ({
        employeeId: a.employeeId.toString(),
        status: a.status,
        respondedAt: a.respondedAt,
      }));

      // Calculate overall status
      let overallStatus: "pending" | "approved" | "rejected" | undefined =
        undefined;
      if (mappedApprovals.length > 0) {
        const hasRejected = mappedApprovals.some(
          (a: any) => a.status === "rejected"
        );
        const hasPending = mappedApprovals.some(
          (a: any) => a.status === "pending"
        );
        const allApproved = mappedApprovals.every(
          (a: any) => a.status === "approved"
        );

        if (hasRejected) {
          overallStatus = "rejected";
        } else if (hasPending) {
          overallStatus = "pending";
        } else if (allApproved) {
          overallStatus = "approved";
        }
      }

      const currentApprovals = builder.signing.approvals || {
        employeeIds: [],
        employeeSettings: [],
        status: undefined,
        sentForApproval: false,
        sentAt: undefined,
        approvals: [],
      };

      const updatedApprovals = {
        ...currentApprovals,
        sentForApproval: true,
        sentAt: currentApprovals.sentAt || new Date().toISOString(),
        status: overallStatus,
        approvals: mappedApprovals,
      };

      const next = {
        ...builder,
        signing: {
          ...builder.signing,
          approvals: updatedApprovals,
        },
      };

      setBuilder(next);
      await contractTemplatesService.update(templateId, {
        title,
        description,
        version,
        recommended,
        builder: next,
      });

      toast.success("Approval request sent");
    } catch (err: any) {
      console.error("Failed to send approval", err);
      toast.error(
        err?.response?.data?.message || "Failed to send approval request"
      );
    } finally {
      setSendingEmployeeId(null);
    }
  };

  // Handle updating approval request
  const handleUpdateApproval = async (employeeId: string) => {
    if (!templateId || isPublished) return;

    const approvalRecord = builder.signing.approvals?.approvals?.find(
      (a) => a.employeeId === employeeId
    );
    const approvalStatus = approvalRecord?.status || "not_sent";

    // If approval has already been sent (not "not_sent"), show warning
    if (approvalStatus !== "not_sent") {
      setEmployeeToUpdate(employeeId);
      setShowUpdateWarning(true);
      return;
    }

    // If not sent yet, just update directly
    await performUpdateApproval(employeeId);
  };

  // Handle approve/reject actions for employees
  const handleApproveReject = async (
    employeeId: string,
    status: "approved" | "rejected"
  ) => {
    if (!templateId) return;

    setUpdatingEmployeeId(employeeId);

    try {
      const response = await axios.put(
        `/contract-templates/${templateId}/approval/${employeeId}`,
        {
          status,
          respondedAt: new Date().toISOString(),
        }
      );

      if (response.data) {
        // Refresh approvals from backend
        const approvalsResponse = await axios.get(
          `/contract-templates/${templateId}/approvals`
        );
        const backendApprovals = approvalsResponse.data.data || [];

        // Map backend approvals to frontend format
        const mappedApprovals = backendApprovals.map((a: any) => ({
          employeeId: a.employeeId.toString(),
          status: a.status,
          respondedAt: a.respondedAt,
        }));

        // Calculate overall status
        let overallStatus: "pending" | "approved" | "rejected" | undefined =
          undefined;
        if (mappedApprovals.length > 0) {
          const hasRejected = mappedApprovals.some(
            (a: any) => a.status === "rejected"
          );
          const hasPending = mappedApprovals.some(
            (a: any) => a.status === "pending"
          );
          const allApproved = mappedApprovals.every(
            (a: any) => a.status === "approved"
          );

          if (hasRejected) {
            overallStatus = "rejected";
          } else if (hasPending) {
            overallStatus = "pending";
          } else if (allApproved) {
            overallStatus = "approved";
          }
        }

        const currentApprovals = builder.signing.approvals || {
          employeeIds: [],
          employeeSettings: [],
          status: undefined,
          sentForApproval: false,
          sentAt: undefined,
          approvals: [],
        };

        const updatedApprovals = {
          ...currentApprovals,
          status: overallStatus,
          approvals: mappedApprovals,
        };

        const next = {
          ...builder,
          signing: {
            ...builder.signing,
            approvals: updatedApprovals,
          },
        };

        setBuilder(next);
        await contractTemplatesService.update(templateId, {
          title,
          description,
          version,
          recommended,
          builder: next,
        });

        toast.success(
          `Contract ${status === "approved" ? "approved" : "rejected"} successfully`
        );
      }
    } catch (err: any) {
      console.error("Failed to update approval", err);
      toast.error(
        err?.response?.data?.message || `Failed to ${status} contract`
      );
    } finally {
      setUpdatingEmployeeId(null);
    }
  };

  // Perform the actual update
  const performUpdateApproval = async (employeeId: string) => {
    if (!templateId || isPublished) return;

    setUpdatingEmployeeId(employeeId);

    try {
      const employeeSetting = getEmployeeSetting(employeeId);

      const response = await axios.put(
        `/contract-templates/${templateId}/approval/${employeeId}`,
        {
          requireSignature: employeeSetting.requireSignature || false,
          signatureType: employeeSetting.signatureType,
        }
      );

      // Fetch updated approvals from backend
      const approvalsResponse = await axios.get(
        `/contract-templates/${templateId}/approvals`
      );
      const backendApprovals = approvalsResponse.data.data || [];

      // Map backend approvals to frontend format
      const mappedApprovals = backendApprovals.map((a: any) => ({
        employeeId: a.employeeId.toString(),
        status: a.status,
        respondedAt: a.respondedAt,
      }));

      // Calculate overall status
      let overallStatus: "pending" | "approved" | "rejected" | undefined =
        undefined;
      if (mappedApprovals.length > 0) {
        const hasRejected = mappedApprovals.some(
          (a: any) => a.status === "rejected"
        );
        const hasPending = mappedApprovals.some(
          (a: any) => a.status === "pending"
        );
        const allApproved = mappedApprovals.every(
          (a: any) => a.status === "approved"
        );

        if (hasRejected) {
          overallStatus = "rejected";
        } else if (hasPending) {
          overallStatus = "pending";
        } else if (allApproved) {
          overallStatus = "approved";
        }
      }

      const currentApprovals = builder.signing.approvals || {
        employeeIds: [],
        employeeSettings: [],
        status: undefined,
        sentForApproval: false,
        sentAt: undefined,
        approvals: [],
      };

      const updatedApprovals = {
        ...currentApprovals,
        status: overallStatus,
        approvals: mappedApprovals,
      };

      const next = {
        ...builder,
        signing: {
          ...builder.signing,
          approvals: updatedApprovals,
        },
      };

      setBuilder(next);
      await contractTemplatesService.update(templateId, {
        title,
        description,
        version,
        recommended,
        builder: next,
      });

      toast.success("Approval request updated successfully");
    } catch (err: any) {
      console.error("Failed to update approval", err);
      toast.error(
        err?.response?.data?.message || "Failed to update approval request"
      );
    } finally {
      setUpdatingEmployeeId(null);
    }
  };

  // Send approval for all pending employees
  const handleSendAllApprovals = async () => {
    if (!templateId || isPublished) return;

    const selectedEmployeeIds = builder.signing.approvals?.employeeIds || [];
    if (selectedEmployeeIds.length === 0) {
      toast.error("No employees selected");
      return;
    }

    // First, fetch latest approvals from backend to ensure we have accurate data
    let backendApprovals: any[] = [];
    try {
      const approvalsResponse = await axios.get(
        `/contract-templates/${templateId}/approvals`
      );
      backendApprovals = approvalsResponse.data.data || [];
    } catch (err) {
      console.error("Failed to fetch approvals", err);
      // Continue with frontend state if backend fetch fails
    }

    // Use backend data if available, otherwise fall back to frontend state
    const approvalsToCheck =
      backendApprovals.length > 0
        ? backendApprovals
        : builder.signing.approvals?.approvals || [];

    // Create a map of employeeId -> status for quick lookup
    // Backend now returns employeeId as string, so we can directly use it
    const approvalMap = new Map(
      approvalsToCheck.map((a: any) => {
        const empId = String(a.employeeId || "");
        return [empId, a.status];
      })
    );

    // Filter employees who haven't been sent yet
    // An employee is "unsent" if:
    // 1. They don't exist in the approval map (no approval record), OR
    // 2. Their status is explicitly "not_sent"
    // An employee is "sent" if they have status: "pending", "approved", or "rejected"
    const unsentEmployees = selectedEmployeeIds.filter((id: string) => {
      const normalizedId = String(id);
      const status = approvalMap.get(normalizedId);
      // If status is undefined (not in map), employee hasn't been sent
      // If status is "not_sent", employee hasn't been sent
      // If status is "pending", "approved", or "rejected", employee has been sent
      return status === undefined || status === "not_sent";
    });

    console.log("Send All - Selected employees:", selectedEmployeeIds);
    console.log("Send All - Backend approvals:", backendApprovals);
    console.log("Send All - Approval map:", Array.from(approvalMap.entries()));
    console.log("Send All - Unsent employees:", unsentEmployees);
    console.log(
      "Send All - Will show warning?",
      unsentEmployees.length === 0 && selectedEmployeeIds.length > 0
    );

    // If all employees have already been sent (no unsent employees), show warning
    if (unsentEmployees.length === 0 && selectedEmployeeIds.length > 0) {
      console.log("All employees already sent - showing warning modal");
      setAlreadySentMessage(
        "All selected employees have already received approval requests."
      );
      setShowAlreadySentWarning(true);
      return;
    }

    setSendingAll(true);

    try {
      // Get employee settings for all selected employees
      const employeeSettings = selectedEmployeeIds.map((employeeId: string) => {
        const setting = getEmployeeSetting(employeeId);
        return {
          employeeId,
          requireSignature: setting.requireSignature || false,
          signatureType: setting.signatureType,
        };
      });

      const response = await axios.post(
        `/contract-templates/${templateId}/send-approval-all`,
        {
          employeeSettings,
        }
      );

      // Fetch updated approvals from backend
      const approvalsResponse = await axios.get(
        `/contract-templates/${templateId}/approvals`
      );
      const backendApprovals = approvalsResponse.data.data || [];

      // Map backend approvals to frontend format
      const mappedApprovals = backendApprovals.map((a: any) => ({
        employeeId: a.employeeId.toString(),
        status: a.status,
        respondedAt: a.respondedAt,
      }));

      // Calculate overall status
      let overallStatus: "pending" | "approved" | "rejected" | undefined =
        undefined;
      if (mappedApprovals.length > 0) {
        const hasRejected = mappedApprovals.some(
          (a: any) => a.status === "rejected"
        );
        const hasPending = mappedApprovals.some(
          (a: any) => a.status === "pending"
        );
        const allApproved = mappedApprovals.every(
          (a: any) => a.status === "approved"
        );

        if (hasRejected) {
          overallStatus = "rejected";
        } else if (hasPending) {
          overallStatus = "pending";
        } else if (allApproved) {
          overallStatus = "approved";
        }
      }

      const currentApprovals = builder.signing.approvals || {
        employeeIds: [],
        employeeSettings: [],
        status: undefined,
        sentForApproval: false,
        sentAt: undefined,
        approvals: [],
      };

      const updatedApprovals = {
        ...currentApprovals,
        sentForApproval: true,
        sentAt: currentApprovals.sentAt || new Date().toISOString(),
        status: overallStatus,
        approvals: mappedApprovals,
      };

      const next = {
        ...builder,
        signing: {
          ...builder.signing,
          approvals: updatedApprovals,
        },
      };

      setBuilder(next);
      await contractTemplatesService.update(templateId, {
        title,
        description,
        version,
        recommended,
        builder: next,
      });

      const sentCount = response.data.data?.length || 0;
      if (sentCount > 0) {
        toast.success(`Approval requests sent to ${sentCount} employee(s)`);
      } else {
        toast.info("All employees already have approval records");
      }
    } catch (err: any) {
      console.error("Failed to send approvals", err);
      toast.error(
        err?.response?.data?.message || "Failed to send approval requests"
      );
    } finally {
      setSendingAll(false);
    }
  };

  const publish = async () => {
    if (!templateId) return;

    // Block publish if employees are selected but approvals not sent, OR if there are pending approvals
    const approvals = builder.signing.approvals;
    const hasSelectedEmployees =
      approvals?.employeeIds && approvals.employeeIds.length > 0;
    const hasPendingApprovals =
      approvals?.status === "pending" ||
      (approvals?.approvals &&
        approvals.approvals.some((a) => a.status === "pending"));

    if (hasSelectedEmployees && !approvals?.sentForApproval) {
      toast.error(
        "Cannot publish: Employees are selected for approval but approval requests have not been sent. Please send for approval first."
      );
      return;
    }

    if (hasPendingApprovals) {
      toast.error(
        "Cannot publish: There are pending approvals. Please wait for all approvals to be completed."
      );
      return;
    }

    try {
      await contractTemplatesService.publish(templateId);
      setTemplateStatus("published");
      toast.success("Template published");
      router.push("/tenant/contracts/templates");
    } catch {
      toast.error("Failed to publish");
    }
  };

  const exportPdf = async () => {
    if (!templateId) return;
    try {
      const res = await axios.get(`/contract-templates/${templateId}/export`, {
        responseType: "blob",
        headers: { Accept: "application/pdf" },
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "Contract_Template"}_${version || "v1"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to export PDF");
    }
  };

  // Format last saved time
  const formatLastSaved = (date: Date | null) => {
    if (!date) return "";
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);

    if (seconds < 10) return "Just now";
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const StepHeader = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div>
          <Title as="h2">Edit Contract Template</Title>
          <p className="text-sm text-gray-600">
            Template: <b>{title || "Loading..."}</b>
          </p>
        </div>
        {/* Autosave Indicator */}
        {templateId && autosaveEnabled && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                <span className="text-blue-600">Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span>Saved {formatLastSaved(lastSaved)}</span>
              </>
            ) : null}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {(templateId || title) && (
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            View Template
          </Button>
        )}
        <Button variant="outline" onClick={() => handleNavigation()}>
          Cancel
        </Button>
        {templateId && (
          <Button
            variant="outline"
            onClick={() => manualSave()}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save</span>
              </>
            )}
          </Button>
        )}
        {templateId && (
          <Button
            variant="outline"
            onClick={async () => {
              const newVersion = prompt(
                "New version tag",
                version ? `${version}-copy` : "v2"
              );
              if (!newVersion || !templateId) return;
              try {
                const dup = await contractTemplatesService.duplicate(
                  templateId,
                  newVersion
                );
                toast.success("Duplicated as new version");
                router.push(`/tenant/contracts/templates/${dup._id}/edit`);
              } catch {
                toast.error("Failed to duplicate");
              }
            }}
          >
            Duplicate as new version
          </Button>
        )}
        {templateId && (
          <Button variant="outline" onClick={exportPdf}>
            Export PDF
          </Button>
        )}
        {templateId && (
          <Button
            onClick={publish}
            disabled={
              isPublished ||
              (() => {
                const approvals = builder.signing.approvals;
                const hasSelectedEmployees =
                  approvals?.employeeIds && approvals.employeeIds.length > 0;
                const hasPendingApprovals =
                  approvals?.status === "pending" ||
                  (approvals?.approvals &&
                    approvals.approvals.some((a) => a.status === "pending"));
                return (
                  (hasSelectedEmployees && !approvals?.sentForApproval) ||
                  hasPendingApprovals
                );
              })()
            }
            title={
              isPublished
                ? "Template is already published"
                : (() => {
                    const approvals = builder.signing.approvals;
                    const hasSelectedEmployees =
                      approvals?.employeeIds &&
                      approvals.employeeIds.length > 0;
                    const hasPendingApprovals =
                      approvals?.status === "pending" ||
                      (approvals?.approvals &&
                        approvals.approvals.some(
                          (a) => a.status === "pending"
                        ));
                    if (hasSelectedEmployees && !approvals?.sentForApproval) {
                      return "Cannot publish: Employees are selected but approval requests have not been sent.";
                    }
                    if (hasPendingApprovals) {
                      return "Cannot publish: There are pending approvals.";
                    }
                    return "";
                  })()
            }
          >
            {isPublished ? "Published" : "Publish"}
          </Button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-gray-500">Loading template...</p>
      </div>
    );
  }

  return (
    <div>
      {isPublished && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2 mb-4">
          <span className="text-yellow-800 font-medium">
            ⚠️ This template is published and cannot be edited.
          </span>
        </div>
      )}
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-10 bg-white pb-4 border-b border-gray-200 mb-4 -mt-6 pt-6">
        <StepHeader />

        {/* Step navigation */}
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            "Start",
            "Body & Clauses",
            "Fields",
            "Schedule",
            "Logic",
            "Approvals and Signing",
            "Preview",
            "Publish",
          ].map((label, i) => (
            <Button
              key={i}
              size="sm"
              variant={step === i ? "solid" : "outline"}
              onClick={() => setStep(i)}
            >
              {i + 1}. {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Step content */}
      {step === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border grid grid-cols-2 gap-4">
          <div className="col-span-2 flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Start</h3>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autosaveEnabled}
                  onChange={(e) => setAutosaveEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span>Autosave</span>
              </label>
              <label className="text-sm text-gray-700 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={startGrammarCheck}
                  onChange={(e) => setStartGrammarCheck(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span>Enable Spelling & Grammar Check</span>
              </label>
            </div>
          </div>
          <Input
            label="Template Name"
            value={title}
            onChange={(e: any) => {
              if (!isPublished) setTitle(e.target.value);
            }}
            disabled={isPublished}
            spellCheck={true}
            autoComplete="on"
          />
          <RichTextEditor
            label="Description"
            className="col-span-2"
            value={description}
            onChange={(value) => {
              if (!isPublished) setDescription(value);
            }}
            placeholder="Enter template description..."
            multiline={true}
            spellCheck={true}
            grammarCheck={startGrammarCheck && !isPublished}
          />
          <div className="col-span-2 flex gap-2">
            <Button variant="outline" onClick={() => handleNavigation()}>
              Cancel
            </Button>
            <Button
              disabled={!canProceedStart}
              onClick={async () => {
                if (!autosaveEnabled) {
                  await manualSave();
                }
                setStep(1);
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Body & Clauses</h3>
            <div className="flex items-center gap-4">
              <label className="text-sm text-gray-700 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autosaveEnabled}
                  onChange={(e) => setAutosaveEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span>Autosave</span>
              </label>
              <label className="text-sm text-gray-700 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bodyGrammarCheck}
                  onChange={(e) => setBodyGrammarCheck(e.target.checked)}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span>Enable Spelling & Grammar Check</span>
              </label>
            </div>
          </div>
          <Input
            label="Contract Title"
            value={builder.body.title}
            onChange={(e: any) => {
              const next = {
                ...builder,
                body: { ...builder.body, title: e.target.value },
              };
              setBuilder(next);
              autosave(next);
            }}
            spellCheck={true}
            autoComplete="on"
          />
          <RichTextEditor
            label="Description"
            value={builder.body.description || ""}
            onChange={(value) => {
              const next = {
                ...builder,
                body: { ...builder.body, description: value },
              };
              setBuilder(next);
              autosave(next);
            }}
            placeholder="Enter contract description or instructions..."
            multiline={true}
            spellCheck={true}
            grammarCheck={bodyGrammarCheck}
          />
          {/* Background Section Title Rich Text Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Background Section Title
            </label>
            <RichTextEditor
              value={builder.body?.backgroundTitle || "Background"}
              onChange={(value) => {
                const next = {
                  ...builder,
                  body: {
                    ...builder.body,
                    backgroundTitle: value || "Background",
                    backgrounds: builder.body.backgrounds || [],
                  },
                };
                setBuilder(next);
                autosave(next);
              }}
              placeholder="Enter background section title (e.g., Background, BACKGROUND, etc.)"
              multiline={false}
              spellCheck={true}
              grammarCheck={bodyGrammarCheck && !isPublished}
            />
            <p className="text-xs text-gray-500">
              This title will appear above the background items in the contract
              preview.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Background Items
            </label>
            {builder.body.backgrounds.map((bgItem, idx) => {
              // Handle migration from old format (string) to new format (object)
              const bgContent =
                typeof bgItem === "string" ? bgItem : bgItem.content;
              const bgNumberText =
                typeof bgItem === "string" ? undefined : bgItem.numberText;
              const defaultNumber = String.fromCharCode(65 + idx);

              return (
                <div
                  key={`bg_${idx}`}
                  className="border-2 border-gray-200 bg-gray-50 rounded-lg p-4 space-y-4 mb-4"
                >
                  {/* Section Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-300">
                    <h3 className="text-base font-semibold text-gray-800">
                      Background Item {idx + 1}
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const bgs = builder.body.backgrounds.filter(
                          (_, i) => i !== idx
                        );
                        const next = {
                          ...builder,
                          body: { ...builder.body, backgrounds: bgs },
                        };
                        setBuilder(next);
                        autosave(next);
                      }}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      Remove Item
                    </Button>
                  </div>

                  {/* Number Text Rich Text Editor */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Item Number
                    </label>
                    <RichTextEditor
                      value={bgNumberText || ""}
                      onChange={(value) => {
                        const bgs = [...builder.body.backgrounds];
                        // Migrate to new format if needed
                        const currentItem =
                          typeof bgs[idx] === "string"
                            ? {
                                content: bgs[idx] as string,
                                numberText:
                                  value.trim() === "" ? undefined : value,
                              }
                            : {
                                ...(bgs[idx] as {
                                  content: string;
                                  numberText?: string;
                                }),
                                numberText:
                                  value.trim() === "" ? undefined : value,
                              };
                        bgs[idx] = currentItem;
                        const next = {
                          ...builder,
                          body: { ...builder.body, backgrounds: bgs },
                        };
                        setBuilder(next);
                        autosave(next);
                      }}
                      placeholder={`${defaultNumber} (default if empty)`}
                      multiline={false}
                      spellCheck={false}
                      grammarCheck={false}
                    />
                    <p className="text-xs text-gray-500">
                      The number/letter for this background item (e.g., A, B, C,
                      or 1, 2, 3). Leave empty to use default ({defaultNumber}).
                    </p>
                  </div>

                  {/* Content Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">
                        Content
                      </label>
                      <FieldPlaceholderHelper
                        fields={builder.fields}
                        employeeFieldOptions={employeeFieldOptions}
                        onInsert={(placeholder) => {
                          const editorRef = (window as any)[
                            `bgEditorRef_${idx}`
                          ] as any;
                          if (editorRef && editorRef.insertPlaceholder) {
                            editorRef.insertPlaceholder(placeholder);
                          }
                        }}
                        buttonLabel="Insert Field"
                        buttonSize="sm"
                      />
                    </div>
                    <FieldTokenEditor
                      ref={(editorRef) => {
                        // Store ref for this background index
                        if (editorRef) {
                          (window as any)[`bgEditorRef_${idx}`] = editorRef;
                        }
                      }}
                      value={bgContent}
                      onChange={(newValue) => {
                        const bgs = [...builder.body.backgrounds];
                        // Migrate to new format if needed
                        const currentItem =
                          typeof bgs[idx] === "string"
                            ? { content: newValue, numberText: undefined }
                            : {
                                ...(bgs[idx] as {
                                  content: string;
                                  numberText?: string;
                                }),
                                content: newValue,
                              };
                        bgs[idx] = currentItem;
                        const next = {
                          ...builder,
                          body: { ...builder.body, backgrounds: bgs },
                        };
                        setBuilder(next);
                        autosave(next);
                      }}
                      getFieldLabel={getFieldLabel}
                      multiline={true}
                      grammarCheck={bodyGrammarCheck}
                    />
                  </div>
                </div>
              );
            })}
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const bgs = [
                    ...builder.body.backgrounds,
                    { content: "", numberText: undefined },
                  ];
                  const next = {
                    ...builder,
                    body: { ...builder.body, backgrounds: bgs },
                  };
                  setBuilder(next);
                  autosave(next);
                }}
              >
                Add Background
              </Button>
            </div>
          </div>
          {/* Clause Section Title */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Clause Section Title
            </label>
            <RichTextEditor
              value={builder.body.clauseTitle || "CLAUSES"}
              onChange={(value) => {
                const next = {
                  ...builder,
                  body: {
                    ...builder.body,
                    clauseTitle: value || "CLAUSES",
                  },
                };
                setBuilder(next);
                autosave(next);
              }}
              placeholder="Enter clause section title (e.g., CLAUSES, TERMS AND CONDITIONS, etc.)"
              multiline={false}
              spellCheck={true}
              grammarCheck={bodyGrammarCheck && !isPublished}
            />
            <p className="text-xs text-gray-500">
              This title will appear above the clause items in the contract
              preview.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Clause Items
            </label>
            {builder.body.clauses
              .sort((a, b) => (a.order || 0) - (b.order || 0))
              .map((c, idx) => {
                const actualIndex = builder.body.clauses.findIndex(
                  (cl) => cl.id === c.id
                );
                const standardCategories = [
                  "Policies",
                  "Compliance",
                  "Confidentiality",
                  "IP",
                  "Termination",
                  "Governing Law",
                  "Other",
                ];
                const allCategories = [
                  ...standardCategories,
                  ...customCategories.filter(
                    (cat) => !standardCategories.includes(cat)
                  ),
                ];
                const categoryOptions = allCategories.map((v) => ({
                  label: v,
                  value: v,
                }));
                const showNewCategoryInput =
                  newCategoryInput?.clauseId === c.id;

                return (
                  <div
                    key={c.id}
                    className="border-2 border-gray-200 bg-gray-50 rounded-lg p-4 space-y-4 mb-4"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-300">
                      <h3 className="text-base font-semibold text-gray-800">
                        Clause #{c.order || idx + 1}
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const clauses = builder.body.clauses.filter(
                            (_, i) => i !== actualIndex
                          );
                          const next = {
                            ...builder,
                            body: { ...builder.body, clauses },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove Item
                      </Button>
                    </div>

                    {/* Item Number Rich Text Editor */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Item Number
                      </label>
                      <RichTextEditor
                        key={`clause-item-${c.id}-number`}
                        value={c.numberText || ""}
                        onChange={(value) => {
                          const clauses = [...builder.body.clauses];
                          clauses[actualIndex] = {
                            ...c,
                            numberText: value.trim() === "" ? undefined : value,
                          };
                          const next = {
                            ...builder,
                            body: { ...builder.body, clauses },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        placeholder={`${c.order || idx + 1}. (default if empty)`}
                        multiline={false}
                        spellCheck={false}
                        grammarCheck={false}
                      />
                      <p className="text-xs text-gray-500">
                        The number for this clause item (e.g., 1, 2, 3, or I,
                        II, III). Leave empty to use default (
                        {c.order || idx + 1}).
                      </p>
                    </div>

                    {/* Heading Rich Text Editor */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Heading
                      </label>
                      <RichTextEditor
                        key={`clause-item-${c.id}-heading`}
                        value={c.heading || ""}
                        onChange={(value) => {
                          const clauses = [...builder.body.clauses];
                          clauses[actualIndex] = { ...c, heading: value };
                          const next = {
                            ...builder,
                            body: { ...builder.body, clauses },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        placeholder="Enter clause heading..."
                        multiline={false}
                        spellCheck={true}
                        grammarCheck={bodyGrammarCheck && !isPublished}
                      />
                    </div>

                    {/* Category Dropdown */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Category
                      </label>
                      <Select
                        className="col-span-12"
                        options={categoryOptions}
                        value={{ label: c.category, value: c.category }}
                        onChange={(val: any) => {
                          if (val?.value === "Other") {
                            // Show input for new category
                            setNewCategoryInput({ clauseId: c.id, value: "" });
                          } else {
                            const clauses = [...builder.body.clauses];
                            clauses[actualIndex] = {
                              ...c,
                              category: val?.value || c.category,
                            };
                            const next = {
                              ...builder,
                              body: { ...builder.body, clauses },
                            };
                            setBuilder(next);
                            autosave(next);
                          }
                        }}
                      />
                      {showNewCategoryInput && (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            placeholder="Enter new category name"
                            value={newCategoryInput.value}
                            onChange={(e: any) => {
                              setNewCategoryInput({
                                ...newCategoryInput,
                                value: e.target.value,
                              });
                            }}
                            onKeyDown={(e: any) => {
                              if (
                                e.key === "Enter" &&
                                newCategoryInput.value.trim()
                              ) {
                                const newCategory =
                                  newCategoryInput.value.trim();
                                if (
                                  !customCategories.includes(newCategory) &&
                                  !standardCategories.includes(newCategory)
                                ) {
                                  setCustomCategories([
                                    ...customCategories,
                                    newCategory,
                                  ]);
                                }
                                const clauses = [...builder.body.clauses];
                                clauses[actualIndex] = {
                                  ...c,
                                  category: newCategory,
                                };
                                const next = {
                                  ...builder,
                                  body: { ...builder.body, clauses },
                                };
                                setBuilder(next);
                                autosave(next);
                                setNewCategoryInput(null);
                              }
                            }}
                            className="flex-1"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              if (newCategoryInput.value.trim()) {
                                const newCategory =
                                  newCategoryInput.value.trim();
                                if (
                                  !customCategories.includes(newCategory) &&
                                  !standardCategories.includes(newCategory)
                                ) {
                                  setCustomCategories([
                                    ...customCategories,
                                    newCategory,
                                  ]);
                                }
                                const clauses = [...builder.body.clauses];
                                clauses[actualIndex] = {
                                  ...c,
                                  category: newCategory,
                                };
                                const next = {
                                  ...builder,
                                  body: { ...builder.body, clauses },
                                };
                                setBuilder(next);
                                autosave(next);
                                setNewCategoryInput(null);
                              }
                            }}
                          >
                            Add
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setNewCategoryInput(null);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Text/Content Editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700">
                          Text/Content
                        </label>
                        <FieldPlaceholderHelper
                          fields={builder.fields}
                          employeeFieldOptions={employeeFieldOptions}
                          onInsert={(placeholder) => {
                            const editorRef = (window as any)[
                              `clauseEditorRef_${c.id}`
                            ] as any;
                            if (editorRef && editorRef.insertPlaceholder) {
                              editorRef.insertPlaceholder(placeholder);
                            }
                          }}
                          buttonLabel="Insert Field"
                          buttonSize="sm"
                        />
                      </div>
                      <FieldTokenEditor
                        ref={(editorRef) => {
                          if (editorRef) {
                            (window as any)[`clauseEditorRef_${c.id}`] =
                              editorRef;
                          }
                        }}
                        value={c.text}
                        onChange={(newValue) => {
                          const clauses = [...builder.body.clauses];
                          clauses[actualIndex] = { ...c, text: newValue };
                          const next = {
                            ...builder,
                            body: { ...builder.body, clauses },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        getFieldLabel={getFieldLabel}
                        multiline={true}
                        grammarCheck={bodyGrammarCheck && !isPublished}
                      />
                    </div>
                  </div>
                );
              })}
            <div>
              <Button size="sm" variant="outline" onClick={addClause}>
                Add Clause
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={async () => {
                if (!autosaveEnabled) {
                  await manualSave();
                }
                setStep(2);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border space-y-6">
          <div>
            <h4 className="font-semibold text-lg mb-2">Fields Configuration</h4>
            <p className="text-sm text-gray-600 mb-1">
              Fields are placeholders that can be inserted into contract text,
              clauses, and schedule items.
            </p>
            <p className="text-sm text-gray-500 italic">
              Use placeholders like {"{{employee.name}}"} or{" "}
              {"{{custom.fieldName}}"} in your contract content.
            </p>
          </div>

          {/* Employee Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-base">Employee Fields</h5>
              <span className="text-xs text-gray-500">
                Select which employee fields are available
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              {/* Search Input */}
              <div className="relative mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search employee fields..."
                    value={employeeFieldSearch}
                    onChange={(e) => {
                      setEmployeeFieldSearch(e.target.value);
                      setShowEmployeeFieldSuggestions(true);
                    }}
                    onFocus={() => setShowEmployeeFieldSuggestions(true)}
                    onBlur={() => {
                      // Delay hiding suggestions to allow clicks
                      setTimeout(
                        () => setShowEmployeeFieldSuggestions(false),
                        200
                      );
                    }}
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {employeeFieldSearch && (
                    <button
                      onClick={() => {
                        setEmployeeFieldSearch("");
                        setShowEmployeeFieldSuggestions(false);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <XIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Autocomplete Suggestions Dropdown */}
                {showEmployeeFieldSuggestions &&
                  employeeFieldSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                      {employeeFieldSuggestions.map((field) => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => {
                            setEmployeeFieldSearch(field.label);
                            setShowEmployeeFieldSuggestions(false);
                            // Auto-select if not already selected
                            if (!builder.fields.employee.includes(field.key)) {
                              const employee = [
                                ...builder.fields.employee,
                                field.key,
                              ];
                              const next = {
                                ...builder,
                                fields: { ...builder.fields, employee },
                              };
                              setBuilder(next);
                              autosave(next);
                            }
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-sm text-gray-900">
                            {field.label}
                          </div>
                          <div className="text-xs text-gray-500">
                            Key: {field.key}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {/* Filtered Fields Grid */}
              {filteredEmployeeFields.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filteredEmployeeFields.map((field) => (
                    <Checkbox
                      key={field.key}
                      label={field.label}
                      checked={builder.fields.employee.includes(field.key)}
                      onChange={(e: any) => {
                        const employee = e.target.checked
                          ? [...builder.fields.employee, field.key]
                          : builder.fields.employee.filter(
                              (f) => f !== field.key
                            );
                        const next = {
                          ...builder,
                          fields: { ...builder.fields, employee },
                        };
                        setBuilder(next);
                        autosave(next);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>
                    No employee fields found matching "{employeeFieldSearch}"
                  </p>
                  <button
                    onClick={() => setEmployeeFieldSearch("")}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Clear search
                  </button>
                </div>
              )}

              {/* Results count */}
              {employeeFieldSearch && (
                <div className="mt-3 text-xs text-gray-500">
                  Showing {filteredEmployeeFields.length} of{" "}
                  {employeeFieldOptions.length} fields
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  <strong>Usage:</strong> Use{" "}
                  {"{{employee." + "{fieldKey}" + "}}"} in your contract text
                </p>
              </div>
            </div>
          </div>

          {/* Custom Fields */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="font-medium text-base">Custom Fields</h5>
              <Button
                size="sm"
                onClick={() => {
                  const next = {
                    ...builder,
                    fields: {
                      ...builder.fields,
                      custom: [
                        ...builder.fields.custom,
                        {
                          key: `custom_${builder.fields.custom.length + 1}`,
                          label: "New Field",
                          type: "text",
                          options: [],
                        },
                      ],
                    },
                  };
                  setBuilder(next);
                  autosave(next);
                }}
              >
                Add Custom Field
              </Button>
            </div>
            {builder.fields.custom.length > 0 ? (
              <div className="space-y-2">
                {builder.fields.custom.map((f, i) => (
                  <div
                    key={f.key}
                    className="grid grid-cols-12 gap-2 border p-3 rounded-lg bg-white"
                  >
                    <Input
                      className="col-span-4"
                      label="Label"
                      value={f.label}
                      onChange={(e: any) => {
                        const custom = [...builder.fields.custom];
                        custom[i] = { ...f, label: e.target.value };
                        const next = {
                          ...builder,
                          fields: { ...builder.fields, custom },
                        };
                        setBuilder(next);
                        autosave(next);
                      }}
                    />
                    <Select
                      className="col-span-3"
                      label="Type"
                      value={{ label: f.type, value: f.type }}
                      options={["text", "number", "date", "select"].map(
                        (v) => ({ label: v, value: v })
                      )}
                      onChange={(val: any) => {
                        const custom = [...builder.fields.custom];
                        const newType = val?.value || f.type;
                        // Initialize options array if switching to select type
                        custom[i] = {
                          ...f,
                          type: newType,
                          options:
                            newType === "select" ? f.options || [] : undefined,
                          defaultValue:
                            newType === "select"
                              ? f.defaultValue || ""
                              : f.defaultValue,
                        };
                        const next = {
                          ...builder,
                          fields: { ...builder.fields, custom },
                        };
                        setBuilder(next);
                        autosave(next);
                      }}
                    />
                    {/* Options field for select type */}
                    {f.type === "select" && (
                      <div className="col-span-12 space-y-2">
                        <label className="text-sm font-medium text-gray-700">
                          Options (comma-separated)
                        </label>
                        <Input
                          placeholder="e.g., Option 1, Option 2, Option 3"
                          value={(f.options || []).join(", ")}
                          onChange={(e: any) => {
                            const custom = [...builder.fields.custom];
                            const options = e.target.value
                              .split(",")
                              .map((s: string) => s.trim())
                              .filter(Boolean);
                            custom[i] = { ...f, options };
                            const next = {
                              ...builder,
                              fields: { ...builder.fields, custom },
                            };
                            setBuilder(next);
                            autosave(next);
                          }}
                        />
                        <p className="text-xs text-gray-500">
                          Enter options separated by commas
                        </p>
                      </div>
                    )}
                    {/* Value field - Select dropdown for select type, Input for others */}
                    {f.type === "select" ? (
                      <div className="col-span-4">
                        <Select
                          label="Value"
                          value={
                            f.defaultValue
                              ? {
                                  label: String(f.defaultValue),
                                  value: String(f.defaultValue),
                                }
                              : null
                          }
                          onChange={(val: any) => {
                            const custom = [...builder.fields.custom];
                            custom[i] = {
                              ...f,
                              defaultValue: val?.value || "",
                            };
                            const next = {
                              ...builder,
                              fields: { ...builder.fields, custom },
                            };
                            setBuilder(next);
                            autosave(next);
                          }}
                          options={(f.options || []).map((opt) => ({
                            label: opt,
                            value: opt,
                          }))}
                          placeholder="Select a value"
                        />
                      </div>
                    ) : (
                      <Input
                        className="col-span-4"
                        label="Value"
                        type={
                          f.type === "number"
                            ? "number"
                            : f.type === "date"
                              ? "date"
                              : "text"
                        }
                        value={String(f.defaultValue ?? "")}
                        onChange={(e: any) => {
                          const custom = [...builder.fields.custom];
                          let value = e.target.value;

                          // Validate based on field type
                          if (f.type === "number") {
                            // Only allow numbers (including decimals and negative)
                            if (value && !/^-?\d*\.?\d*$/.test(value)) {
                              return; // Don't update if invalid
                            }
                          } else if (f.type === "date") {
                            // Date validation is handled by the date input type
                            value = e.target.value;
                          }

                          custom[i] = { ...f, defaultValue: value };
                          const next = {
                            ...builder,
                            fields: { ...builder.fields, custom },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        error={(() => {
                          if (
                            !f.defaultValue ||
                            String(f.defaultValue).trim() === ""
                          )
                            return undefined;
                          if (
                            f.type === "number" &&
                            isNaN(Number(f.defaultValue))
                          ) {
                            return "Must be a valid number";
                          }
                          if (
                            f.type === "date" &&
                            isNaN(Date.parse(String(f.defaultValue)))
                          ) {
                            return "Must be a valid date";
                          }
                          return undefined;
                        })()}
                      />
                    )}
                    <div className="col-span-1 flex items-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const custom = builder.fields.custom.filter(
                            (_, idx) => idx !== i
                          );
                          const next = {
                            ...builder,
                            fields: { ...builder.fields, custom },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        className="text-red-600 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center text-sm text-gray-500">
                No custom fields added. Click "Add Custom Field" to create one.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={async () => {
                if (!autosaveEnabled) {
                  await manualSave();
                }
                setStep(3);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border space-y-4">
          <h4 className="font-semibold">Schedule Designer</h4>

          {/* Schedule Title Rich Text Editor */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Schedule Section Title
            </label>
            <RichTextEditor
              value={builder.schedule?.title || "SCHEDULE"}
              onChange={(value) => {
                const next = {
                  ...builder,
                  schedule: {
                    ...builder.schedule,
                    title: value || "SCHEDULE",
                    items: builder.schedule?.items || [],
                  },
                };
                setBuilder(next);
                autosave(next);
              }}
              placeholder="Enter schedule section title (e.g., SCHEDULE, SCHEDULE OF TERMS, etc.)"
              multiline={false}
              spellCheck={true}
              grammarCheck={bodyGrammarCheck}
            />
            <p className="text-xs text-gray-500">
              This title will appear above the schedule items in the contract
              preview.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Schedule Items
            </label>
            {builder.schedule?.items
              ?.sort((a, b) => a.order - b.order)
              .map((row, i) => {
                const actualIndex = builder.schedule.items.findIndex(
                  (r) => r.key === row.key
                );
                return (
                  <div
                    key={row.key}
                    className="border-2 border-gray-200 bg-gray-50 rounded-lg p-4 space-y-4 mb-4"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-gray-300">
                      <h3 className="text-base font-semibold text-gray-800">
                        Schedule Item #{row.order}
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const scheduleItems = builder.schedule.items.filter(
                            (_, idx) => idx !== actualIndex
                          );
                          const next = {
                            ...builder,
                            schedule: {
                              ...builder.schedule,
                              items: scheduleItems,
                            },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Remove Item
                      </Button>
                    </div>

                    {/* Field 1: Item Number (Rich Text) */}
                    <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        1. Item Number (Rich Text)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Format the number displayed for this item (e.g., "1.",
                        "2.", "(i)", etc.)
                      </p>
                      <RichTextEditor
                        key={`schedule-item-${row.key}-number`}
                        value={row.numberText || ""}
                        onChange={(value) => {
                          const scheduleItems = [...builder.schedule.items];
                          // If value is empty or just whitespace, set to undefined to use default
                          scheduleItems[actualIndex] = {
                            ...row,
                            numberText: value.trim() === "" ? undefined : value,
                          };
                          const next = {
                            ...builder,
                            schedule: {
                              ...builder.schedule,
                              items: scheduleItems,
                            },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        placeholder={`${row.order}. (default if empty)`}
                        multiline={false}
                        spellCheck={false}
                        grammarCheck={false}
                      />
                      <p className="text-xs text-gray-500">
                        Customize the number display with formatting, colors,
                        font sizes, etc. Defaults to order number if empty.
                      </p>
                    </div>

                    {/* Field 2: Item Label (Rich Text) */}
                    <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        2. Item Label (Rich Text)
                      </label>
                      <RichTextEditor
                        key={`schedule-item-${row.key}-label`}
                        value={row.label || ""}
                        onChange={(value) => {
                          const scheduleItems = [...builder.schedule.items];
                          scheduleItems[actualIndex] = { ...row, label: value };
                          const next = {
                            ...builder,
                            schedule: {
                              ...builder.schedule,
                              items: scheduleItems,
                            },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        placeholder="Enter item label..."
                        multiline={false}
                        spellCheck={true}
                        grammarCheck={bodyGrammarCheck}
                      />
                    </div>

                    {/* Field 3: Order */}
                    <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        3. Order
                      </label>
                      <div className="flex items-center gap-1 max-w-xs">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newOrder = Math.max(1, row.order - 1);
                            const scheduleItems = [...builder.schedule.items];
                            scheduleItems[actualIndex] = {
                              ...row,
                              order: newOrder,
                            };
                            const next = {
                              ...builder,
                              schedule: {
                                ...builder.schedule,
                                items: scheduleItems,
                              },
                            };
                            setBuilder(next);
                            autosave(next);
                          }}
                          className="h-8 w-8 p-0 flex items-center justify-center"
                          title="Decrease order"
                        >
                          <Minus size={14} />
                        </Button>
                        <Input
                          type="number"
                          value={row.order}
                          onChange={(e: any) => {
                            const scheduleItems = [...builder.schedule.items];
                            scheduleItems[actualIndex] = {
                              ...row,
                              order: Number(e.target.value) || 1,
                            };
                            const next = {
                              ...builder,
                              schedule: {
                                ...builder.schedule,
                                items: scheduleItems,
                              },
                            };
                            setBuilder(next);
                            autosave(next);
                          }}
                          className="flex-1"
                          inputClassName="text-center"
                          min={1}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newOrder = row.order + 1;
                            const scheduleItems = [...builder.schedule.items];
                            scheduleItems[actualIndex] = {
                              ...row,
                              order: newOrder,
                            };
                            const next = {
                              ...builder,
                              schedule: {
                                ...builder.schedule,
                                items: scheduleItems,
                              },
                            };
                            setBuilder(next);
                            autosave(next);
                          }}
                          className="h-8 w-8 p-0 flex items-center justify-center"
                          title="Increase order"
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>

                    {/* Field 4: Default Text (Rich Text) - Full Width */}
                    <div className="bg-white p-3 rounded border border-gray-200 space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        4. Default Text (Rich Text)
                      </label>
                      <RichTextEditor
                        key={`schedule-item-${row.key}-defaultText`}
                        value={row.defaultText || ""}
                        onChange={(value) => {
                          const scheduleItems = [...builder.schedule.items];
                          scheduleItems[actualIndex] = {
                            ...row,
                            defaultText: value,
                          };
                          const next = {
                            ...builder,
                            schedule: {
                              ...builder.schedule,
                              items: scheduleItems,
                            },
                          };
                          setBuilder(next);
                          autosave(next);
                        }}
                        placeholder="Enter default text..."
                        multiline={true}
                        spellCheck={true}
                        grammarCheck={bodyGrammarCheck}
                      />
                    </div>

                    {/* Field 5: Field Mapping */}
                    <div className="bg-white p-3 rounded border border-gray-200 space-y-1">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700">
                          5. Field Mapping
                        </label>
                        <FieldPlaceholderHelper
                          fields={builder.fields}
                          employeeFieldOptions={employeeFieldOptions}
                          onInsert={(placeholder) => {
                            // Remove {{ }} for field mapping (just use the inner part)
                            const fieldRef = placeholder.replace(
                              /^\{\{|\}\}$/g,
                              ""
                            );
                            const scheduleItems = [...builder.schedule.items];
                            const currentFieldRefs = row.fieldRefs || [];
                            // Add field if not already present
                            if (!currentFieldRefs.includes(fieldRef)) {
                              scheduleItems[actualIndex] = {
                                ...row,
                                fieldRefs: [...currentFieldRefs, fieldRef],
                              };
                              const next = {
                                ...builder,
                                schedule: {
                                  ...builder.schedule,
                                  items: scheduleItems,
                                },
                              };
                              setBuilder(next);
                              autosave(next);
                            }
                          }}
                          buttonLabel="Select Field"
                          buttonSize="sm"
                        />
                      </div>
                      <div className="relative">
                        <div
                          className="min-h-[2.5rem] p-2 border border-gray-300 rounded-md bg-white"
                          onFocus={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          contentEditable={false}
                          suppressContentEditableWarning={true}
                        >
                          {row.fieldRefs && row.fieldRefs.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {row.fieldRefs.map((fieldRef, idx) => {
                                const formattedHtml =
                                  row.fieldMappingFormats?.[fieldRef] ||
                                  `<span>${getFieldLabel(fieldRef)}</span>`;
                                return (
                                  <div
                                    key={idx}
                                    className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-sm font-medium"
                                  >
                                    <span
                                      dangerouslySetInnerHTML={{
                                        __html: formattedHtml,
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setTokenEditModal({
                                          isOpen: true,
                                          scheduleItemKey: row.key,
                                          fieldRef,
                                          tokenLabel: getFieldLabel(fieldRef),
                                          tokenPlaceholder: `{{${fieldRef}}}`,
                                          initialContent:
                                            row.fieldMappingFormats?.[
                                              fieldRef
                                            ] ||
                                            `<span>${getFieldLabel(fieldRef)}</span>`,
                                        });
                                      }}
                                      className="hover:bg-blue-200 rounded p-0.5 flex-shrink-0 cursor-pointer ml-1"
                                      aria-label={`Edit ${getFieldLabel(fieldRef)}`}
                                      title="Edit formatting"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const scheduleItems = [
                                          ...builder.schedule.items,
                                        ];
                                        const updatedFieldRefs =
                                          row.fieldRefs?.filter(
                                            (_, i) => i !== idx
                                          ) || [];
                                        const updatedFormats = {
                                          ...row.fieldMappingFormats,
                                        };
                                        delete updatedFormats[fieldRef];
                                        scheduleItems[actualIndex] = {
                                          ...row,
                                          fieldRefs:
                                            updatedFieldRefs.length > 0
                                              ? updatedFieldRefs
                                              : undefined,
                                          fieldMappingFormats:
                                            Object.keys(updatedFormats).length >
                                            0
                                              ? updatedFormats
                                              : undefined,
                                        };
                                        const next = {
                                          ...builder,
                                          schedule: {
                                            ...builder.schedule,
                                            items: scheduleItems,
                                          },
                                        };
                                        setBuilder(next);
                                        autosave(next);
                                      }}
                                      className="hover:bg-blue-200 rounded p-0.5 -mr-1 flex-shrink-0 cursor-pointer ml-1"
                                      aria-label={`Remove ${getFieldLabel(fieldRef)}`}
                                      title="Remove field"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">
                              No fields selected. Click "Select Field" to add.
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">
                        Select fields to map to this schedule item. Click the
                        edit button (✎) on any field token to format it (font
                        size, color, bold, headings, etc.)
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const order = (builder.schedule?.items?.length || 0) + 1;
                const next = {
                  ...builder,
                  schedule: {
                    ...builder.schedule,
                    items: [
                      ...(builder.schedule?.items || []),
                      { key: `item_${order}`, label: `Item ${order}`, order },
                    ],
                  },
                };
                setBuilder(next);
                autosave(next);
              }}
            >
              Add Row
            </Button>
            <Button
              onClick={async () => {
                if (!autosaveEnabled) {
                  await manualSave();
                }
                setStep(4);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border space-y-4">
          <h4 className="font-semibold">Logic & Defaults</h4>
          <div className="space-y-3">
            {builder.body.clauses.map((c, idx) => (
              <div
                key={c.id}
                className="flex items-center justify-between border rounded p-2"
              >
                <div className="text-sm">
                  Optional default for Clause {idx + 1}: {c.heading}
                </div>
                <Checkbox
                  label="On by default"
                  checked={
                    builder.logic.clauseDefaults[c.id] ?? c.defaultIncluded
                  }
                  onChange={(e: any) => {
                    const logic = {
                      ...builder.logic,
                      clauseDefaults: {
                        ...builder.logic.clauseDefaults,
                        [c.id]: e.target.checked,
                      },
                    };
                    const next = { ...builder, logic };
                    setBuilder(next);
                    autosave(next);
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={async () => {
                if (!autosaveEnabled) {
                  await manualSave();
                }
                setStep(5);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border space-y-4">
          <h4 className="font-semibold">Approvals and Signing Configuration</h4>

          {isPublished && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0" />
              <span className="text-yellow-800 font-medium">
                This contract template is published and cannot be modified.
              </span>
            </div>
          )}

          {/* Employee Selection Section - Above Table */}
          <div className="space-y-4 border-b pb-4">
            <h5 className="font-medium text-gray-700">
              Select Employees for Approval
            </h5>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MultiSelect
                label="Employment Type"
                value={selectedEmploymentTypes}
                onChange={(vals: string[]) => setSelectedEmploymentTypes(vals)}
                options={employmentTypes}
                placeholder="Select employment types"
                disabled={isPublished}
              />
              <MultiSelect
                label="Job Title"
                value={selectedDesignationIds}
                onChange={(vals: string[]) => setSelectedDesignationIds(vals)}
                options={designations}
                placeholder="Select job titles"
                disabled={isPublished}
              />
            </div>

            {/* Employee Multi-Select List */}
            <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
              {loadingEmployees ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">
                    Loading employees...
                  </span>
                </div>
              ) : employees.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No employees found
                </p>
              ) : (
                <div className="space-y-2">
                  {employees
                    .filter((emp) => {
                      // Filter by employment type
                      if (selectedEmploymentTypes.length > 0) {
                        const empType = getProfileOrAdditionalValue(
                          emp,
                          "employeedetails",
                          "employeetype"
                        );
                        if (!selectedEmploymentTypes.includes(empType))
                          return false;
                      }
                      // Filter by designation
                      if (selectedDesignationIds.length > 0) {
                        const empDesignationId =
                          emp.designation?._id || emp.designation;
                        if (
                          !selectedDesignationIds.includes(
                            String(empDesignationId)
                          )
                        )
                          return false;
                      }
                      return true;
                    })
                    .map((emp) => {
                      const isSelected =
                        builder.signing.approvals?.employeeIds?.includes(
                          emp._id
                        ) || false;
                      // Get name from employeeFields or employeeProfile (same pattern as ContractTemplatePreviewModal)
                      const pdFromFields = emp.employeeFields?.personaldetails;
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
                        pdFromFields?.lastname || pdFromProfile?.lastname || "";
                      const fullName =
                        `${firstname} ${middlename} ${lastname}`.trim() ||
                        "Unknown";
                      const empType =
                        getProfileOrAdditionalValue(
                          emp,
                          "employeedetails",
                          "employeetype"
                        ) || "N/A";
                      const designationName = emp.designation?.name || "N/A";

                      return (
                        <div
                          key={emp._id}
                          className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                            isSelected ? "bg-blue-50 border-blue-300" : ""
                          } ${isPublished ? "opacity-60 cursor-not-allowed" : ""}`}
                          onClick={async () => {
                            if (
                              isPublished ||
                              isProcessingEmployeeSelectionRef.current
                            )
                              return;

                            try {
                              isProcessingEmployeeSelectionRef.current = true;

                              // Use requestAnimationFrame to defer state updates and prevent UI blocking
                              await new Promise<void>((resolve) => {
                                requestAnimationFrame(() => {
                                  try {
                                    // If selecting, just add the employee
                                    if (!isSelected) {
                                      const currentApprovals = builder.signing
                                        .approvals || {
                                        employeeIds: [],
                                        employeeSettings: [],
                                        status: undefined,
                                        sentForApproval: false,
                                        sentAt: undefined,
                                        approvals: [],
                                      };
                                      const currentIds =
                                        currentApprovals.employeeIds || [];
                                      // Prevent duplicate selection
                                      if (currentIds.includes(emp._id)) {
                                        isProcessingEmployeeSelectionRef.current = false;
                                        resolve();
                                        return;
                                      }
                                      const newIds = [...currentIds, emp._id];

                                      const next = {
                                        ...builder,
                                        signing: {
                                          ...builder.signing,
                                          approvals: {
                                            ...currentApprovals,
                                            employeeIds: newIds,
                                          },
                                        },
                                      };
                                      setBuilder(next);
                                      autosave(next);
                                      isProcessingEmployeeSelectionRef.current = false;
                                      resolve();
                                      return;
                                    }

                                    // If deselecting, check for existing approval
                                    const approvalCheck = hasExistingApproval(
                                      emp._id
                                    );

                                    if (approvalCheck.hasApproval) {
                                      // Show warning modal
                                      setEmployeeToRemove({
                                        id: emp._id,
                                        name: fullName,
                                        approvalStatus: approvalCheck.status,
                                      });
                                      setShowRemoveWarning(true);
                                      isProcessingEmployeeSelectionRef.current = false;
                                      resolve();
                                    } else {
                                      // No approval exists, remove directly
                                      const currentApprovals = builder.signing
                                        .approvals || {
                                        employeeIds: [],
                                        employeeSettings: [],
                                        status: undefined,
                                        sentForApproval: false,
                                        sentAt: undefined,
                                        approvals: [],
                                      };
                                      const currentIds =
                                        currentApprovals.employeeIds || [];
                                      const newIds = currentIds.filter(
                                        (id) => id !== emp._id
                                      );

                                      // Remove employee settings
                                      const newSettings = (
                                        currentApprovals.employeeSettings || []
                                      ).filter((s) => s.employeeId !== emp._id);

                                      const next = {
                                        ...builder,
                                        signing: {
                                          ...builder.signing,
                                          approvals: {
                                            ...currentApprovals,
                                            employeeIds: newIds,
                                            employeeSettings: newSettings,
                                          },
                                        },
                                      };
                                      setBuilder(next);
                                      autosave(next);
                                      isProcessingEmployeeSelectionRef.current = false;
                                      resolve();
                                    }
                                  } catch (error) {
                                    console.error(
                                      "Error in employee selection handler:",
                                      error
                                    );
                                    isProcessingEmployeeSelectionRef.current = false;
                                    resolve();
                                  }
                                });
                              });
                            } catch (error) {
                              console.error(
                                "Error selecting/deselecting employee:",
                                error
                              );
                              toast.error(
                                "Failed to update employee selection"
                              );
                              isProcessingEmployeeSelectionRef.current = false;
                            }
                          }}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {isSelected ? (
                              <CheckCircle2 className="h-5 w-5 text-blue-600" />
                            ) : (
                              <div className="h-5 w-5 border-2 border-gray-300 rounded" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium">{fullName}</div>
                              <div className="text-sm text-gray-500">
                                {empType} · {designationName}
                                {emp.email && ` · ${emp.email}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Approval Table */}
          {builder.signing.approvals?.employeeIds &&
            builder.signing.approvals.employeeIds.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-gray-700">
                    Selected Employees for Approval
                  </h5>
                  {(() => {
                    const selectedEmployeeIds =
                      builder.signing.approvals.employeeIds || [];
                    const approvals = builder.signing.approvals.approvals || [];
                    const approvalMap = new Map(
                      approvals.map((a: any) => [a.employeeId, a.status])
                    );

                    // Check if there are any unsent employees
                    const hasUnsentEmployees = selectedEmployeeIds.some(
                      (id: string) => {
                        const status = approvalMap.get(id);
                        // Employee is unsent if not in map OR status is "not_sent"
                        return status === undefined || status === "not_sent";
                      }
                    );

                    return (
                      <Button
                        onClick={handleSendAllApprovals}
                        disabled={
                          isPublished || !hasUnsentEmployees || sendingAll
                        }
                        size="sm"
                      >
                        {sendingAll ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Sending...
                          </>
                        ) : (
                          "Send All"
                        )}
                      </Button>
                    );
                  })()}
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border p-3 text-left text-sm font-semibold text-gray-700">
                          Employee
                        </th>
                        <th className="border p-3 text-left text-sm font-semibold text-gray-700">
                          Employment Type
                        </th>
                        <th className="border p-3 text-left text-sm font-semibold text-gray-700">
                          Job Title
                        </th>
                        <th className="border p-3 text-left text-sm font-semibold text-gray-700">
                          Require Signature
                        </th>
                        <th className="border p-3 text-left text-sm font-semibold text-gray-700">
                          Signature Type
                        </th>
                        <th className="border p-3 text-left text-sm font-semibold text-gray-700">
                          Approval Status
                        </th>
                        <th className="border p-3 text-left text-sm font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {builder.signing.approvals.employeeIds.map(
                        (employeeId: string) => {
                          const employee = employees.find(
                            (emp) => emp._id === employeeId
                          );
                          if (!employee) return null;

                          // Get name from employeeFields or employeeProfile (same pattern as ContractTemplatePreviewModal)
                          const pdFromFields =
                            employee.employeeFields?.personaldetails;
                          const pdFromProfile = employee.employeeProfile
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
                            "Unknown";
                          const empType =
                            getProfileOrAdditionalValue(
                              employee,
                              "employeedetails",
                              "employeetype"
                            ) || "N/A";
                          const designationName =
                            employee.designation?.name || "N/A";

                          const employeeSetting =
                            getEmployeeSetting(employeeId);
                          const approvalRecord =
                            builder.signing.approvals?.approvals?.find(
                              (a) => a.employeeId === employeeId
                            );
                          // Show approval status: if record exists show its status, otherwise show "not_sent"
                          const approvalStatus =
                            approvalRecord?.status || "not_sent";
                          const isRowLoading = sendingEmployeeId === employeeId;
                          const canSend =
                            approvalStatus === "not_sent" && !isPublished;

                          return (
                            <tr key={employeeId} className="hover:bg-gray-50">
                              <td className="border p-3 text-sm">{fullName}</td>
                              <td className="border p-3 text-sm">{empType}</td>
                              <td className="border p-3 text-sm">
                                {designationName}
                              </td>
                              <td className="border p-3">
                                <Checkbox
                                  checked={employeeSetting.requireSignature}
                                  onChange={(e: any) => {
                                    if (isPublished) return;
                                    updateEmployeeSetting(employeeId, {
                                      requireSignature: e.target.checked,
                                      signatureType: e.target.checked
                                        ? employeeSetting.signatureType
                                        : undefined,
                                    });
                                  }}
                                  disabled={isPublished}
                                />
                              </td>
                              <td className="border p-3">
                                {employeeSetting.requireSignature ? (
                                  <Select
                                    value={
                                      employeeSetting.signatureType
                                        ? {
                                            label:
                                              employeeSetting.signatureType
                                                .charAt(0)
                                                .toUpperCase() +
                                              employeeSetting.signatureType.slice(
                                                1
                                              ),
                                            value:
                                              employeeSetting.signatureType,
                                          }
                                        : null
                                    }
                                    onChange={(val: any) => {
                                      if (isPublished) return;
                                      updateEmployeeSetting(employeeId, {
                                        signatureType: val?.value,
                                      });
                                    }}
                                    options={[
                                      { label: "Typed", value: "typed" },
                                      { label: "Drawn", value: "drawn" },
                                      { label: "Upload", value: "upload" },
                                    ]}
                                    placeholder="Select type"
                                    disabled={isPublished}
                                  />
                                ) : (
                                  <span className="text-gray-400 text-sm">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="border p-3">
                                {approvalStatus === "pending" && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                    Pending
                                  </span>
                                )}
                                {approvalStatus === "approved" && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    Approved
                                  </span>
                                )}
                                {approvalStatus === "rejected" && (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    Rejected
                                  </span>
                                )}
                                {approvalStatus === "not_sent" && (
                                  <span className="text-gray-400 text-sm">
                                    Not sent
                                  </span>
                                )}
                              </td>
                              <td className="border p-3">
                                <div className="flex items-center gap-2">
                                  {/* Show Approve/Reject buttons if current user is this employee and approval is pending */}
                                  {currentUserEmployeeId === employeeId &&
                                  approvalStatus === "pending" ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleApproveReject(
                                            employeeId,
                                            "approved"
                                          )
                                        }
                                        disabled={
                                          updatingEmployeeId === employeeId
                                        }
                                        variant="solid"
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                      >
                                        {updatingEmployeeId === employeeId ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            Processing...
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                            Approve
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleApproveReject(
                                            employeeId,
                                            "rejected"
                                          )
                                        }
                                        disabled={
                                          updatingEmployeeId === employeeId
                                        }
                                        variant="solid"
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                      >
                                        {updatingEmployeeId === employeeId ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            Processing...
                                          </>
                                        ) : (
                                          <>
                                            <X className="h-3 w-3 mr-1" />
                                            Reject
                                          </>
                                        )}
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleSendSingleApproval(employeeId)
                                        }
                                        disabled={!canSend || isRowLoading}
                                        variant="outline"
                                      >
                                        {isRowLoading ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            Sending...
                                          </>
                                        ) : (
                                          "Send"
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          handleUpdateApproval(employeeId)
                                        }
                                        disabled={
                                          isPublished ||
                                          updatingEmployeeId === employeeId
                                        }
                                        variant="outline"
                                      >
                                        {updatingEmployeeId === employeeId ? (
                                          <>
                                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                            Updating...
                                          </>
                                        ) : (
                                          "Update"
                                        )}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Approval Status Summary */}
                {builder.signing.approvals?.sentForApproval && (
                  <div className="border-t pt-4 space-y-2">
                    <div className="text-sm font-medium text-gray-700">
                      Overall Approval Status
                    </div>
                    {builder.signing.approvals.status === "pending" && (
                      <div className="text-sm text-yellow-600">
                        ⏳ Pending approval from{" "}
                        {builder.signing.approvals.approvals?.filter(
                          (a) => a.status === "pending"
                        ).length || 0}{" "}
                        employee(s)
                      </div>
                    )}
                    {builder.signing.approvals.status === "approved" && (
                      <div className="text-sm text-green-600">
                        ✅ All approvals received
                      </div>
                    )}
                    {builder.signing.approvals.status === "rejected" && (
                      <div className="text-sm text-red-600">
                        ❌ Approval rejected by some employees
                      </div>
                    )}
                    {builder.signing.approvals.sentAt && (
                      <div className="text-xs text-gray-500">
                        Sent for approval on{" "}
                        {new Date(
                          builder.signing.approvals.sentAt
                        ).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {(!builder.signing.approvals?.employeeIds ||
            builder.signing.approvals.employeeIds.length === 0) && (
            <div className="text-center py-8 text-gray-500 border rounded-lg">
              No employees selected. Select employees from the list above to add
              them to the approval table.
            </div>
          )}

          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setStep(4)}
              disabled={isPublished}
            >
              Back
            </Button>
            <Button
              onClick={async () => {
                if (!autosaveEnabled && templateId) {
                  await manualSave();
                }
                setStep(6);
              }}
              disabled={isPublished}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border space-y-4">
          <h4 className="font-semibold">Preview & Test</h4>
          <p className="text-sm text-gray-600">
            Toggle optional clauses and check placeholders resolve. Fix any
            warnings before publishing.
          </p>
          <div className="flex justify-end">
            <Button
              onClick={async () => {
                if (!autosaveEnabled) {
                  await manualSave();
                }
                setStep(7);
              }}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="bg-white rounded-xl shadow-sm p-4 border space-y-4">
          <h4 className="font-semibold">Publish Template</h4>
          <ul className="text-sm list-disc list-inside">
            <li>
              <b>Name</b>: {title}
            </li>
            <li>
              <b>Version</b>: {version}
            </li>
            <li>
              <b>Clause count</b>: {builder.body.clauses.length}
            </li>
            <li>
              <b>Schedule rows</b>: {builder.schedule.length}
            </li>
          </ul>
          <div className="flex justify-end">
            <Button
              onClick={publish}
              disabled={
                isPublished ||
                (() => {
                  const approvals = builder.signing.approvals;
                  const hasSelectedEmployees =
                    approvals?.employeeIds && approvals.employeeIds.length > 0;
                  const hasPendingApprovals =
                    approvals?.status === "pending" ||
                    (approvals?.approvals &&
                      approvals.approvals.some((a) => a.status === "pending"));
                  return (
                    (hasSelectedEmployees && !approvals?.sentForApproval) ||
                    hasPendingApprovals
                  );
                })()
              }
              title={
                isPublished
                  ? "Template is already published"
                  : (() => {
                      const approvals = builder.signing.approvals;
                      const hasSelectedEmployees =
                        approvals?.employeeIds &&
                        approvals.employeeIds.length > 0;
                      const hasPendingApprovals =
                        approvals?.status === "pending" ||
                        (approvals?.approvals &&
                          approvals.approvals.some(
                            (a) => a.status === "pending"
                          ));
                      if (hasSelectedEmployees && !approvals?.sentForApproval) {
                        return "Cannot publish: Employees are selected but approval requests have not been sent.";
                      }
                      if (hasPendingApprovals) {
                        return "Cannot publish: There are pending approvals.";
                      }
                      return "";
                    })()
              }
            >
              {isPublished ? "Published" : "Publish"}
            </Button>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {templateId && (
          <Button variant="outline" onClick={exportPdf}>
            Export PDF
          </Button>
        )}
      </div>

      {/* Template Preview Modal */}
      <ContractTemplatePreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={title}
        description={description}
        version={version}
        builder={builder}
      />

      {/* Already Sent Warning Modal */}
      <Transition appear show={showAlreadySentWarning} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowAlreadySentWarning(false)}
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
                    className="text-lg font-medium leading-6 text-gray-900 flex items-center gap-2"
                  >
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    Approval Already Sent
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      {alreadySentMessage}
                    </p>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <Button onClick={() => setShowAlreadySentWarning(false)}>
                      OK
                    </Button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Update Approval Warning Modal */}
      <Transition appear show={showUpdateWarning} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 shadow-xl">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">
                        ⚠️ Warning: Update Approval Request
                      </Dialog.Title>
                      <div className="text-sm text-gray-600 space-y-2 mb-4">
                        <p>
                          This approval request has already been sent. Updating
                          it will modify the approval requirements (signature
                          type, etc.) for this employee.
                        </p>
                        <p className="font-medium">
                          Do you want to continue with the update?
                        </p>
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowUpdateWarning(false);
                            setEmployeeToUpdate(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="solid"
                          onClick={async () => {
                            if (employeeToUpdate) {
                              setShowUpdateWarning(false);
                              await performUpdateApproval(employeeToUpdate);
                              setEmployeeToUpdate(null);
                            }
                          }}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          Update
                        </Button>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowUpdateWarning(false);
                        setEmployeeToUpdate(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Employee Removal Warning Modal */}
      <Transition appear show={showRemoveWarning} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => {}}>
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
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <Dialog.Title className="text-lg font-semibold text-gray-900 mb-2">
                        ⚠️ Warning: Approval Request Already Sent
                      </Dialog.Title>
                      <div className="text-sm text-gray-600 space-y-2 mb-4">
                        <p>
                          You have already sent an approval request to{" "}
                          <strong>{employeeToRemove?.name}</strong>.
                        </p>
                        <p>
                          Removing this employee will cancel the approval
                          request and delete their approval record.
                        </p>
                        {employeeToRemove?.approvalStatus === "approved" && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-yellow-800">
                            <strong>Note:</strong> This employee already
                            approved this contract. Removing them will
                            invalidate their approval.
                          </div>
                        )}
                        {employeeToRemove?.approvalStatus === "rejected" && (
                          <div className="bg-red-50 border border-red-200 rounded p-2 text-red-800">
                            <strong>Note:</strong> This employee rejected the
                            contract. Removing them will clear their rejection.
                          </div>
                        )}
                        {employeeToRemove?.approvalStatus === "pending" && (
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 text-blue-800">
                            <strong>Note:</strong> This employee has a pending
                            approval request. Removing them will cancel the
                            request.
                          </div>
                        )}
                      </div>
                      <div className="flex justify-end gap-3 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowRemoveWarning(false);
                            setEmployeeToRemove(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          variant="solid"
                          onClick={handleRemoveEmployee}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Remove Employee
                        </Button>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowRemoveWarning(false);
                        setEmployeeToRemove(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Token Edit Modal */}
      {tokenEditModal && (
        <TokenEditModal
          isOpen={tokenEditModal.isOpen}
          onClose={() => {
            setTokenEditModal(null);
          }}
          onSave={(formattedHtml) => {
            const scheduleItems = [...builder.schedule.items];
            const itemIndex = scheduleItems.findIndex(
              (item) => item.key === tokenEditModal.scheduleItemKey
            );
            if (itemIndex !== -1) {
              const item = scheduleItems[itemIndex];
              const updatedFormats = { ...item.fieldMappingFormats };
              updatedFormats[tokenEditModal.fieldRef] = formattedHtml;
              scheduleItems[itemIndex] = {
                ...item,
                fieldMappingFormats: updatedFormats,
              };
              const next = {
                ...builder,
                schedule: { ...builder.schedule, items: scheduleItems },
              };
              setBuilder(next);
              autosave(next);
            }
            setTokenEditModal(null);
          }}
          tokenLabel={tokenEditModal.tokenLabel}
          tokenPlaceholder={tokenEditModal.tokenPlaceholder}
          initialContent={tokenEditModal.initialContent}
        />
      )}
    </div>
  );
}

export default function EditTemplatePage() {
  return (
    <PermissionGuard
      section="contracts"
      action="write"
      redirectTo="/tenant/configs/contracts"
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-gray-500">Loading...</p>
          </div>
        }
      >
        <PageContent />
      </Suspense>
    </PermissionGuard>
  );
}
