"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Fragment,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { Tab, Button, Select } from "rizzui";
import { Dialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/app/lib/axios";
import { Card } from "@/app/components/ui/Card";
import {
  contractTemplatesService,
  ContractTemplate,
} from "@/app/services/contractTemplates.service";
import ContractTemplatePreviewModal from "@/app/components/shared/ContractTemplatePreviewModal";

// Reusable building blocks
import { TopProfileCard } from "@/app/components/shared/TopProfileCard";
import { DocumentsPanel } from "@/app/components/shared/DocumentsPanel";
import { SectionPanel } from "@/app/components/shared/SectionPanel";
import { AddressEditor } from "@/app/components/shared/AddressEditor";
import { EditDrawer } from "@/app/components/shared/EditDrawer";
import { SectionEditGrid } from "@/app/components/shared/SectionEditGrid";
import { FieldChangeRequests } from "@/app/components/shared/FieldChangeRequests";
import { DocumentStatusList } from "@/app/components/shared/DocumentStatusList";

// Types + hooks + utils
import { SectionConfig } from "@/app/types/employee-fields";
import { useReferenceOptions } from "@/app/hooks/useReferenceOptions";
import { useAppSelector } from "@/app/store/hook";
import {
  deepClone,
  deepEqual,
  deepClean,
  isNonEmpty,
  passesShowIf,
} from "@/app/utils/common";
import {
  buildAdditionalItems,
  getProfileOrAdditionalValue,
  sanitizeAddressArray,
} from "@/app/utils/employee-field-helpers";
import {
  buildDocsValuesFromEmployee,
  buildDocsPathMeta,
  diffChangedDocs,
  mergeAdditionalDocFieldsIntoConfig,
  seedInitialORSelections,
} from "@/app/utils/docs-helpers";
import { buildCoreSectionData } from "@/app/utils/save-payloads";

// -------------------------------
// Config: endpoints (admin view)
// -------------------------------
const SAVE_ENDPOINT = (id: string | string[]) =>
  `/employees/${id}/employee-fields`;

export default function ApplicantEmployeeProfileView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // CONFIG + EMPLOYEE
  const [config, setConfig] = useState<SectionConfig[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  const trackEmployerSectionView = useCallback(
    async (sectionKey: string, innerSectionKey?: string | null) => {
      try {
        if (!id || !sectionKey) return;
        await axiosInstance.post(
          `/audit/view-employer-employee-section/${id}`,
          {
            sectionKey,
            innerSectionKey: innerSectionKey ?? null,
          }
        );
      } catch (err) {
        // Silent fail - this is a tracking call
        console.error("trackEmployerSectionView error", err);
      }
    },
    [id]
  );

  useEffect(() => {
    if (!loading && config.length > 0) {
      const first = config[0];
      if (first?.sectionKey) {
        void trackEmployerSectionView(first.sectionKey);
      }
    }
  }, [loading, config, trackEmployerSectionView]);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionConfig | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Drafts
  type DraftShape = {
    [key: string]: any;
    __inners?: Record<string, Record<string, any>>;
  };
  const [draft, setDraft] = useState<DraftShape>({ __inners: {} });
  const [addressDraft, setAddressDraft] = useState<any[]>([]);

  // Get branchId from user's active assignment
  const { user } = useAppSelector((state) => state.auth);
  const branchId = user?.activeAssignment?.branchId
    ? String(user.activeAssignment.branchId)
    : undefined;

  // Check if user is an employer (tenant-owner or admin)
  const isEmployer = useMemo(() => {
    if (!user) return false;
    const role = user.activeAssignment?.role || user.role;
    return role === "tenant-owner" || role === "admin";
  }, [user]);

  // Contract generation modal state (declared early for use in callbacks)
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractTemplates, setContractTemplates] = useState<
    ContractTemplate[]
  >([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ContractTemplate | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  // Fetch contract templates when modal opens
  const fetchContractTemplates = useCallback(async () => {
    if (!contractModalOpen) return;
    setLoadingTemplates(true);
    try {
      const templates = await contractTemplatesService.list();
      setContractTemplates(templates);
    } catch (error: any) {
      console.error("Failed to fetch contract templates", error);
      toast.error(
        error?.response?.data?.message || "Failed to load contract templates"
      );
    } finally {
      setLoadingTemplates(false);
    }
  }, [contractModalOpen]);

  useEffect(() => {
    if (contractModalOpen) {
      fetchContractTemplates();
    } else {
      // Reset state when modal closes
      setSelectedTemplateId("");
      setContractTemplates([]);
    }
  }, [contractModalOpen, fetchContractTemplates]);

  // Handle contract generation
  const handleGenerateContract = useCallback(() => {
    if (!selectedTemplateId) {
      toast.error("Please select a contract template");
      return;
    }
    // Navigate to contract creation page with template and employee ID
    router.push(
      `/tenant/contracts/create?templateId=${selectedTemplateId}&employeeId=${id}`
    );
    setContractModalOpen(false);
  }, [selectedTemplateId, id, router]);

  // Handle view contract - fetch template and show preview
  const handleViewContract = useCallback(async () => {
    if (!selectedTemplateId) {
      toast.error("Please select a contract template");
      return;
    }
    setLoadingTemplate(true);
    try {
      const template = await contractTemplatesService.get(selectedTemplateId);
      setSelectedTemplate(template);
      setShowPreview(true);
    } catch (error: any) {
      console.error("Failed to fetch contract template", error);
      toast.error(
        error?.response?.data?.message || "Failed to load contract template"
      );
    } finally {
      setLoadingTemplate(false);
    }
  }, [selectedTemplateId]);

  // References
  const referenceOptions = useReferenceOptions(config, branchId);

  // Documents state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeUploadField, setActiveUploadField] = useState<any>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<
    Record<string, string>
  >({});
  const [docsValues, setDocsValues] = useState<any>({ documents: {} });
  const [docsErrors, setDocsErrors] = useState<any>({});

  // ✅ proper ref for snapshot (instead of useState()[0])
  const docsSnapshotRef = useRef<any>({});

  // Avatar Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  // Employment status update state
  const [employmentStatusUpdating, setEmploymentStatusUpdating] =
    useState(false);
  // Signed URL for avatar if stored as { fileId, key }

  // Function to refresh employee data and update document values
  const refreshEmployeeData = async () => {
    if (!id) return;
    try {
      const { data: employeeRes } = await axiosInstance.get(`/employees/${id}`);
      const emp = employeeRes?.data ?? employeeRes ?? null;

      if (emp) {
        setEmployee(emp);

        // Admin: merge both additional stores for docs refresh
        const employeeWithAllAdds = {
          ...emp,
          employeeFields: {
            ...(emp?.employeeFields || {}),
            additionalFields: [
              ...(emp?.employeeFields?.additionalFields || []),
              ...(emp?.employeerOnlyAdditionalFields || []),
            ],
          },
        };

        const freshDocs = buildDocsValuesFromEmployee(employeeWithAllAdds);
        setDocsValues({ documents: freshDocs });
      }
    } catch (error) {
      console.error("Error refreshing employee data:", error);
    }
  };

  // ---------------------------------
  // Fetch – employee + config
  // ---------------------------------
  useEffect(() => {
    (async () => {
      if (!id) return;
      setLoading(true);
      try {
        // First fetch employee to get designation
        const { data: employeeRes } = await axiosInstance.get(
          `/employees/${id}`
        );
        const emp = employeeRes?.data ?? employeeRes ?? null;

        // Get employee's designation ID
        const designationId = emp?.designation?._id || emp?.designation || null;

        // Fetch config with designation filter
        const { data: cfgRes } = await axiosInstance.get(
          `/employee-field-config${
            designationId ? `?designationId=${designationId}` : ""
          }`
        );

        const sectionsRaw =
          cfgRes?.data?.sections ?? cfgRes?.sections ?? cfgRes?.data ?? [];
        const sections = Array.isArray(sectionsRaw) ? sectionsRaw : [];

        setEmployee(emp);
        setConfig(sections);

        // Admin: merge both additional stores for docs init
        const employeeWithAllAdds = {
          ...emp,
          employeeFields: {
            ...(emp?.employeeFields || {}),
            additionalFields: [
              ...(emp?.employeeFields?.additionalFields || []),
              ...(emp?.employeerOnlyAdditionalFields || []),
            ],
          },
        };

        // Init docs tree + snapshot
        const initialDocs = buildDocsValuesFromEmployee(employeeWithAllAdds);
        docsSnapshotRef.current = deepClone(initialDocs);
        setDocsValues({ documents: initialDocs });

        // Seed OR selections
        const initialSelects = seedInitialORSelections(sections, initialDocs);
        setSelectedDocuments(initialSelects);
      } catch (e) {
        console.error(e);
        toast.error("Could not load employee/config");
        setEmployee(null);
        setConfig([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ----------------
  // Derived: Docs display config + path meta (include employer-only adds)
  // ----------------
  const docsConfigSection = useMemo(
    () => config.find((s) => s.sectionKey === "documents") || null,
    [config]
  );
  const docsDisplaySection = useMemo(() => {
    if (!employee) return docsConfigSection;
    const employeeWithAllAdds = {
      ...employee,
      employeeFields: {
        ...(employee?.employeeFields || {}),
        additionalFields: [
          ...(employee?.employeeFields?.additionalFields || []),
          ...(employee?.employeerOnlyAdditionalFields || []),
        ],
      },
    };
    return mergeAdditionalDocFieldsIntoConfig(
      docsConfigSection,
      employeeWithAllAdds
    );
  }, [docsConfigSection, employee]);

  const docsPathMeta = useMemo(
    () => buildDocsPathMeta(docsDisplaySection || null),
    [docsDisplaySection]
  );

  // Helpers to read from employee profile/additional (admin can see employer-only too)
  const makeProfileLookup = useCallback(
    (section: SectionConfig, innerKey?: string) => (key: string) =>
      getProfileOrAdditionalValue(employee, section.sectionKey, key, innerKey),
    [employee]
  );
  const getValue = useCallback(
    (sectionKey: string, fieldKey: string, innerKey?: string) =>
      getProfileOrAdditionalValue(employee, sectionKey, fieldKey, innerKey),
    [employee]
  );

  // Draft lookups
  const makeDraftLookup = useCallback(
    (section: SectionConfig) => (key: string) => {
      if (key in (draft || {})) return (draft as any)[key];
      const groups = draft.__inners || {};
      for (const g of Object.keys(groups))
        if (key in (groups[g] || {})) return groups[g][key];
      return undefined;
    },
    [draft]
  );
  const makeAddressRowLookup = (idx: number) => (key: string) =>
    addressDraft?.[idx]?.[key];

  // ----------------
  // Drawer actions
  // ----------------
  const openDrawerForSection = (section: SectionConfig) => {
    setEditingSection(section);

    if (section.sectionKey === "address") {
      const current: any[] = employee?.employeeFields?.address?.length
        ? employee.employeeFields.address
        : [{}];
      const cleaned = current.map((row) => {
        const c = { ...(row || {}) } as any;
        delete c._id;
        delete c.id;
        return c;
      });
      setAddressDraft(cleaned);
      setDraft({ __inners: {} });
    } else {
      const d: DraftShape = { __inners: {} };

      for (const f of section.fields || []) {
        const v = getProfileOrAdditionalValue(
          employee,
          section.sectionKey,
          f.key
        );
        (d as any)[f.key] =
          v ?? (f.type === "checkbox" ? false : f.type === "file" ? null : "");
      }

      for (const inn of section.innerSections || []) {
        d.__inners![inn.sectionKey] = {};
        for (const f of inn.fields || []) {
          const v = getProfileOrAdditionalValue(
            employee,
            section.sectionKey,
            f.key,
            inn.sectionKey
          );

          // Auto-fill default values for specific payroll fields if empty
          let finalValue = v;
          if (
            !finalValue &&
            section.sectionKey === "payrolldetailsForEmployee" &&
            inn.sectionKey === "awardsandlevels" &&
            (f.key === "supercontribution" ||
              f.key === "probationperiod" ||
              f.key === "casualrate" ||
              f.key === "annualleave")
          ) {
            // Use defaultValue from field config if available
            finalValue = f.defaultValue ?? null;
          }

          d.__inners![inn.sectionKey][f.key] =
            finalValue ??
            (f.type === "checkbox" ? false : f.type === "file" ? null : "");
        }
      }
      setDraft(d);
    }

    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingSection(null);
    setDraft({ __inners: {} });
    setAddressDraft([]);
  };

  // ----------------
  // Save handlers
  // ----------------
  const saveDrawer = async () => {
    if (!editingSection || !id) return;
    setSaving(true);
    try {
      if (editingSection.sectionKey === "address") {
        const visibleKeySet = new Set<string>();
        addressDraft.forEach((_, idx) => {
          const rowLookup = makeAddressRowLookup(idx);
          (editingSection.fields || [])
            .filter((f) => passesShowIf(f, rowLookup))
            .forEach((f) => visibleKeySet.add(f.key));
        });
        const payloadArray = sanitizeAddressArray(addressDraft, visibleKeySet);
        await axiosInstance.put(SAVE_ENDPOINT(id), {
          sectionKey: "address",
          isAdditional: false,
          data: payloadArray,
        });
      } else if (editingSection.isAdditional) {
        const items = buildAdditionalItems(editingSection, draft);
        if (items.length) {
          await axiosInstance.put(SAVE_ENDPOINT(id), {
            sectionKey: editingSection.sectionKey,
            isAdditional: true,
            items,
          });
        } else {
          toast("Nothing to save");
        }
      } else {
        const data = buildCoreSectionData(
          editingSection,
          draft,
          makeDraftLookup
        );
        if (Object.keys(data).length) {
          await axiosInstance.put(SAVE_ENDPOINT(id), {
            sectionKey: editingSection.sectionKey,
            isAdditional: false,
            data,
          });
        } else {
          toast("Nothing to save");
        }
      }

      toast.success("Section saved");
      const { data: employeeRes } = await axiosInstance.get(`/employees/${id}`);
      setEmployee(employeeRes?.data ?? employeeRes ?? null);
      closeDrawer();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Build core-docs snapshot using meta (exclude additional paths)
  const buildCoreDocsSnapshot = (docsTree: any) => {
    const out: any = {};
    Object.entries(docsTree || {}).forEach(([innerKey, fieldsAny]) => {
      const fields = fieldsAny as Record<string, any>;
      Object.entries(fields || {}).forEach(([fieldKey, value]) => {
        const meta = docsPathMeta[`documents.${innerKey}.${fieldKey}`];
        if (meta && !meta.isAdditional) {
          if (!out[innerKey]) out[innerKey] = {};

          // Exclude status field from being sent to backend unless explicitly needed
          // Status should only be set when documents are uploaded, not when dates are changed
          if (value && typeof value === "object") {
            const { status, ...valueWithoutStatus } = value;
            out[innerKey][fieldKey] = valueWithoutStatus;
          } else {
            out[innerKey][fieldKey] = value;
          }
        }
      });
    });
    return out;
  };

  // Docs autosave (admin: additional may map to regular or employer-only server buckets)
  const docsAutoSave = useCallback(
    async (values: any) => {
      try {
        if (!id) return;
        const cleaned = deepClean(values || {});
        const nextDocs = cleaned?.documents || {};
        const prevDocs =
          docsSnapshotRef.current || employee?.employeeFields?.documents || {};

        const { changed, isEmpty } = diffChangedDocs(prevDocs, nextDocs);
        if (isEmpty) return;

        const coreFullNext = buildCoreDocsSnapshot(nextDocs);
        const coreFullPrev = buildCoreDocsSnapshot(prevDocs);
        const coreChanged = !deepEqual(coreFullNext, coreFullPrev);

        const additionalItems: Array<{
          sectionKey: "documents";
          innerSectionKey?: string | null;
          fieldKey: string;
          value: any;
        }> = [];
        Object.entries(changed).forEach(([innerKey, fieldsAny]) => {
          const fields = fieldsAny as Record<string, any>;
          Object.entries(fields).forEach(([fieldKey, value]) => {
            const meta = docsPathMeta[`documents.${innerKey}.${fieldKey}`];
            if (meta?.isAdditional) {
              additionalItems.push({
                sectionKey: "documents",
                innerSectionKey: meta.innerSectionKey ?? innerKey,
                fieldKey,
                value,
              });
            }
          });
        });

        if (coreChanged) {
          await axiosInstance.put(SAVE_ENDPOINT(id), {
            sectionKey: "documents",
            isAdditional: false,
            data: coreFullNext,
          });
        }
        if (additionalItems.length) {
          await axiosInstance.put(SAVE_ENDPOINT(id), {
            sectionKey: "documents",
            isAdditional: true,
            items: additionalItems,
          });
        }

        // Refresh employee & snapshots
        const { data: employeeRes } = await axiosInstance.get(
          `/employees/${id}`
        );
        const fresh = employeeRes?.data ?? employeeRes ?? null;
        setEmployee(fresh);

        const employeeWithAllAdds = {
          ...fresh,
          employeeFields: {
            ...(fresh?.employeeFields || {}),
            additionalFields: [
              ...(fresh?.employeeFields?.additionalFields || []),
              ...(fresh?.employeerOnlyAdditionalFields || []),
            ],
          },
        };
        const freshDocs = buildDocsValuesFromEmployee(employeeWithAllAdds);
        docsSnapshotRef.current = deepClone(freshDocs);
        setDocsValues({ documents: freshDocs });
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || "Failed to save documents");
      }
    },
    [id, docsPathMeta, employee]
  );

  // ----------------
  // Avatar handlers (supports both public url & private {fileId,key})
  // ----------------
  const resolveAvatarUrl = useCallback(async (emp: any) => {
    const avatar = emp?.employeeFields?.personaldetails?.employeephoto || null;

    // Legacy/public url (if any)
    if (avatar?.url && typeof avatar.url === "string") {
      setPhotoUrl(avatar.url);
      return;
    }

    // New private file ref
    if (avatar?.fileId) {
      try {
        // Ensure fileId is a string (convert ObjectId to string if needed)
        const fileIdString = String(avatar.fileId);
        const { data } = await axiosInstance.get<{
          url: string;
          expiresIn: number;
        }>(`/uploads/${fileIdString}/url`);
        setPhotoUrl(data?.url || undefined);
      } catch {
        setPhotoUrl(undefined);
      }
      return;
    }

    setPhotoUrl(undefined);
  }, []);

  // Resolve avatar whenever employee changes
  useEffect(() => {
    if (!employee) return;
    void resolveAvatarUrl(employee);
  }, [employee, resolveAvatarUrl]);

  const handleSelectFile = async (file?: File | null) => {
    if (!file || !id) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Please select an image file");
    const maxMB = 5;
    if (file.size > maxMB * 1024 * 1024)
      return toast.error(`Image must be ≤ ${maxMB}MB`);

    try {
      setPhotoUploading(true);
      setUploadPct(0);
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axiosInstance.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (!e.total) return;
          setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });

      // Expect new backend shape
      const idOr: string | undefined = data?.id ?? data?.data?.id;
      const keyOr: string | undefined = data?.key ?? data?.data?.key;
      if (!idOr || !keyOr) throw new Error("Upload did not return fileId/key");

      await axiosInstance.put(SAVE_ENDPOINT(id), {
        sectionKey: "personaldetails",
        isAdditional: false,
        data: { employeephoto: { fileId: idOr, key: keyOr } },
      });

      // Refresh + resolve signed preview
      const { data: employeeRes } = await axiosInstance.get(`/employees/${id}`);
      const fresh = employeeRes?.data ?? employeeRes ?? null;
      setEmployee(fresh);
      await resolveAvatarUrl(fresh);

      toast.success("Photo updated");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to update photo");
    } finally {
      setPhotoUploading(false);
      setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!id) return;
    try {
      setPhotoUploading(true);
      await axiosInstance.put(SAVE_ENDPOINT(id), {
        sectionKey: "personaldetails",
        isAdditional: false,
        data: { employeephoto: { fileId: null, key: null } },
      });
      const { data: employeeRes } = await axiosInstance.get(`/employees/${id}`);
      const fresh = employeeRes?.data ?? employeeRes ?? null;
      setEmployee(fresh);
      setPhotoUrl(undefined); // clear local preview
      toast.success("Photo removed");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to remove photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  // Get employment status section and field from config
  const employmentDetailsSection = useMemo(
    () => config.find((s) => s.sectionKey === "employeedetails"),
    [config]
  );
  const employmentStatusField = useMemo(
    () =>
      employmentDetailsSection?.fields?.find(
        (f) => f.key === "employmentstatus"
      ),
    [employmentDetailsSection]
  );
  const employmentStatusOptions = useMemo(
    () => employmentStatusField?.options || [],
    [employmentStatusField]
  );

  // Function to update employment status
  const handleEmploymentStatusChange = useCallback(
    async (newStatus: string) => {
      if (!id || !employee) return;

      setEmploymentStatusUpdating(true);
      try {
        // Determine if it should go to employer-only or regular additional fields
        const sectionEmployerOnly =
          !!employmentDetailsSection?.employeerOnlyEditable;
        const fieldEmployerOnly =
          !!employmentStatusField?.employeerOnlyEditable;
        const shouldGoToEmployerOnly = sectionEmployerOnly || fieldEmployerOnly;

        if (shouldGoToEmployerOnly) {
          // Update via employer-only fields endpoint
          await axiosInstance.put(`/employees/${id}/employeer-only-fields`, {
            sectionKey: "employeedetails",
            items: [
              {
                sectionKey: "employeedetails",
                fieldKey: "employmentstatus",
                value: newStatus,
              },
            ],
          });
        } else {
          // Update via regular employee fields endpoint
          await axiosInstance.put(SAVE_ENDPOINT(id), {
            sectionKey: "employeedetails",
            isAdditional: true,
            items: [
              {
                sectionKey: "employeedetails",
                fieldKey: "employmentstatus",
                value: newStatus,
              },
            ],
          });
        }

        // Refresh employee data
        await refreshEmployeeData();
        toast.success("Employment status updated successfully");
      } catch (error: any) {
        console.error("Error updating employment status:", error);
        toast.error(
          error?.response?.data?.message || "Failed to update employment status"
        );
      } finally {
        setEmploymentStatusUpdating(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, employee, employmentDetailsSection, employmentStatusField]
  );

  // ----------------
  // Render
  // ----------------
  if (loading)
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (!employee)
    return (
      <div className="p-6 text-center text-red-500">No employee found</div>
    );

  const pd = employee?.employeeFields?.personaldetails || {};
  const designation = employee?.designation?.name as string | undefined;
  const email = employee?.email as string | undefined;
  const departments: string[] = Array.isArray(
    employee?.designation?.departmentIds
  )
    ? (employee.designation.departmentIds || [])
        .map((d: any) => d?.name)
        .filter(Boolean)
    : [];

  // Get current employment status - check both additionalFields and employeerOnlyAdditionalFields
  // Check in additionalFields
  const statusFromAdditional = (
    employee?.employeeFields?.additionalFields || []
  ).find(
    (field: any) =>
      field.sectionKey === "employeedetails" &&
      field.fieldKey === "employmentstatus"
  );

  // Check in employeerOnlyAdditionalFields
  const statusFromEmployerOnly = (
    employee?.employeerOnlyAdditionalFields || []
  ).find(
    (field: any) =>
      field.sectionKey === "employeedetails" &&
      field.fieldKey === "employmentstatus"
  );

  const currentEmploymentStatus =
    statusFromEmployerOnly?.value || statusFromAdditional?.value;

  return (
    <div className="space-y-10">
      {/* Top profile */}
      <TopProfileCard
        data={{
          photoUrl, // ✅ resolved (public URL or signed)
          name: `${pd.firstname || ""} ${pd.lastname || ""}`.trim(),
          designation: designation || "",
          location:
            pd.location && pd.state ? `${pd.location}, ${pd.state}` : "",
          mobile: pd.mobile,
          email,
          departments,
          employmentStatus: currentEmploymentStatus,
          employmentStatusOptions,
          onEmploymentStatusChange: handleEmploymentStatusChange,
          employmentStatusLoading: employmentStatusUpdating,
        }}
        uploading={photoUploading}
        uploadPct={uploadPct}
        onSelectFile={handleSelectFile}
        onRemove={handleRemovePhoto}
      />

      {/* Field Change Requests - Only show if there are pending requests */}
      <FieldChangeRequests
        employeeId={employee?._id}
        onRequestProcessed={() => {
          // Refresh employee data when a request is processed
          const refreshEmployee = async () => {
            try {
              console.log("🔄 DEBUG: Refreshing employee data after approval");
              const { data: employeeRes } = await axiosInstance.get(
                `/employees/${id}`
              );
              console.log("🔄 DEBUG: Fresh employee data received:", {
                employeeProfile: employeeRes?.data?.employeeProfile,
                personaldetails:
                  employeeRes?.data?.employeeProfile?.personaldetails,
                employeeFields: employeeRes?.data?.employeeFields,
                address: employeeRes?.data?.employeeFields?.address,
                main: employeeRes?.data?.employeeFields?.main,
                documents: employeeRes?.data?.employeeFields?.documents,
              });

              // Debug: Check for inner section fields in the received data
              if (employeeRes?.data?.employeeFields) {
                Object.keys(employeeRes.data.employeeFields).forEach(
                  (sectionKey) => {
                    const section = employeeRes.data.employeeFields[sectionKey];
                    if (
                      section &&
                      typeof section === "object" &&
                      !Array.isArray(section)
                    ) {
                      Object.keys(section).forEach((innerSectionKey) => {
                        const innerSection = section[innerSectionKey];
                        if (
                          innerSection &&
                          typeof innerSection === "object" &&
                          !Array.isArray(innerSection)
                        ) {
                          console.log(
                            "🔄 DEBUG: Found inner section in received data:",
                            {
                              section: sectionKey,
                              innerSection: innerSectionKey,
                              fields: Object.keys(innerSection),
                              values: innerSection,
                            }
                          );
                        }
                      });
                    }
                  }
                );
              }
              setEmployee(employeeRes?.data ?? employeeRes ?? null);
            } catch (e) {
              console.error("Error refreshing employee data:", e);
            }
          };
          refreshEmployee();
        }}
      />

      {/* Document Status - Only show if there are pending documents */}
      <DocumentStatusList
        employeeId={employee?._id}
        isEmployer={true}
        onDocumentStatusChange={refreshEmployeeData}
      />

      {config.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No sections configured yet.
        </Card>
      ) : (
        <Card className="p-6 shadow-sm border rounded-xl">
          <Tab
            selectedIndex={activeTabIdx}
            onChange={(nextIdx: number) => {
              setActiveTabIdx(nextIdx);
              const nextSection = config[nextIdx];
              if (nextSection?.sectionKey) {
                void trackEmployerSectionView(nextSection.sectionKey);
              }
            }}
          >
            <Tab.List className="flex flex-wrap gap-2 border-b pb-2 mb-6">
              {config.map((section, i) => (
                <Tab.ListItem
                  key={section.sectionKey}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 transition"
                >
                  {section.sectionLabel}
                </Tab.ListItem>
              ))}
            </Tab.List>

            <Tab.Panels>
              {config.map((section) => (
                <Tab.Panel key={section.sectionKey} className="space-y-8">
                  {section.sectionKey === "documents" ? (
                    <DocumentsPanel
                      docsDisplaySection={docsDisplaySection || null}
                      docsValues={docsValues}
                      setDocsValues={setDocsValues}
                      docsErrors={docsErrors}
                      selectedDocuments={selectedDocuments}
                      setSelectedDocuments={setSelectedDocuments}
                      activeUploadField={activeUploadField}
                      setActiveUploadField={setActiveUploadField}
                      modalOpen={modalOpen}
                      setModalOpen={setModalOpen}
                      autoSave={docsAutoSave}
                      employeeId={id}
                      employeeName={`${
                        employee?.employeeFields?.personaldetails?.firstName ||
                        ""
                      } ${
                        employee?.employeeFields?.personaldetails?.lastName ||
                        ""
                      }`.trim()}
                    />
                  ) : section.sectionKey === "address" ? (
                    <>
                      <div className="flex items-center justify-between">
                        <div />
                        <div className="flex justify-end w-full">
                          <Button
                            size="sm"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => openDrawerForSection(section)}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>

                      {/* View-only address grid */}
                      <div className="space-y-6">
                        {(
                          ((employee?.employeeFields?.address as any[]) || [
                            {},
                          ]) as any[]
                        ).map((addr: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-4 border border-gray-200 rounded-xl bg-gray-50"
                          >
                            {/* Header = addressFor */}
                            <div className="">
                              <h5 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-4">
                                {addr?.addressFor || "Address"}
                              </h5>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
                              {(section.fields || [])
                                .filter((f) => f.key !== "addressFor")
                                .filter((f) =>
                                  passesShowIf(f, (k) => addr?.[k])
                                )
                                .map((field) => (
                                  <div
                                    key={field.key}
                                    className="flex items-start gap-4"
                                  >
                                    <div className="flex-1">
                                      <SectionPanel
                                        section={{
                                          ...section,
                                          fields: [field],
                                          innerSections: [],
                                        }}
                                        employee={{
                                          employeeFields: { address: [addr] },
                                        }}
                                        makeProfileLookup={() => () =>
                                          addr?.[field.key]
                                        }
                                        getValue={() => addr?.[field.key]}
                                      />
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <SectionPanel
                      section={section}
                      employee={employee}
                      makeProfileLookup={makeProfileLookup}
                      getValue={getValue}
                      referenceOptions={referenceOptions}
                      headerRight={
                        <div className="flex justify-end w-full gap-2">
                          {section.sectionKey === "employeedetails" &&
                            isEmployer && (
                              <Button
                                size="sm"
                                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => setContractModalOpen(true)}
                              >
                                Generate Contract
                              </Button>
                            )}
                          <Button
                            size="sm"
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => openDrawerForSection(section)}
                          >
                            Edit
                          </Button>
                        </div>
                      }
                    />
                  )}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab>
        </Card>
      )}

      {/* Drawer */}
      <EditDrawer
        open={drawerOpen}
        title={editingSection?.sectionLabel || ""}
        onClose={closeDrawer}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeDrawer} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveDrawer} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        }
      >
        {editingSection?.sectionKey === "address" ? (
          <AddressEditor
            section={editingSection}
            addressDraft={addressDraft}
            setAddressDraft={setAddressDraft}
            makeAddressRowLookup={makeAddressRowLookup}
            referenceOptions={referenceOptions}
          />
        ) : editingSection ? (
          <SectionEditGrid
            section={editingSection}
            draft={draft}
            setDraft={setDraft}
            makeDraftLookup={makeDraftLookup}
            referenceOptions={referenceOptions}
          />
        ) : null}
      </EditDrawer>

      {/* Contract Generation Modal */}
      <Transition appear show={contractModalOpen} as={Fragment}>
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
                  <div className="flex justify-between items-center mb-4">
                    <Dialog.Title className="text-lg font-semibold">
                      Generate Contract
                    </Dialog.Title>
                    <button
                      onClick={() => setContractModalOpen(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Contract Template
                      </label>
                      {loadingTemplates ? (
                        <div className="text-sm text-gray-500">
                          Loading templates...
                        </div>
                      ) : contractTemplates.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          No contract templates available. Please create a
                          template first.
                        </div>
                      ) : (
                        <Select
                          value={
                            selectedTemplateId
                              ? contractTemplates
                                  .map((template) => ({
                                    label: `${template.title}${template.version ? ` (${template.version})` : ""}`,
                                    value: template._id,
                                  }))
                                  .find(
                                    (opt) => opt.value === selectedTemplateId
                                  ) || null
                              : null
                          }
                          onChange={(opt: any) =>
                            setSelectedTemplateId(opt?.value || "")
                          }
                          options={contractTemplates.map((template) => ({
                            label: `${template.title}${template.version ? ` (${template.version})` : ""}`,
                            value: template._id,
                          }))}
                          placeholder="Select a contract template"
                        />
                      )}
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setContractModalOpen(false)}
                      >
                        Cancel
                      </Button>
                      {selectedTemplateId && (
                        <Button
                          onClick={handleViewContract}
                          disabled={loadingTemplate || loadingTemplates}
                          variant="outline"
                          className="flex items-center gap-2"
                        >
                          View Contract
                        </Button>
                      )}
                      <Button
                        onClick={handleGenerateContract}
                        disabled={!selectedTemplateId || loadingTemplates}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Generate
                      </Button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Contract Preview Modal */}
      {selectedTemplate && selectedTemplate.builder && (
        <ContractTemplatePreviewModal
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
          }}
          title={selectedTemplate.title || ""}
          description={selectedTemplate.description}
          version={selectedTemplate.version}
          builder={selectedTemplate.builder}
          initialEmployeeId={id} // Pre-select the current employee
          templateId={selectedTemplate._id} // Pass template ID for approval functionality
        />
      )}
    </div>
  );
}
