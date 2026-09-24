// "use client";

// import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { useParams } from "next/navigation";
// import { Tab, Button } from "rizzui";
// import toast from "react-hot-toast";
// import axiosInstance from "@/app/lib/axios";
// import { Card } from "@/app/components/ui/Card";

// // Reusable
// import { TopProfileCard } from "@/app/components/shared/TopProfileCard";
// import { DocumentsPanel } from "@/app/components/shared/DocumentsPanel";
// import { SectionPanel } from "@/app/components/shared/SectionPanel";
// import { AddressEditor } from "@/app/components/shared/AddressEditor";
// import { EditDrawer } from "@/app/components/shared/EditDrawer";
// import { SectionEditGrid } from "@/app/components/shared/SectionEditGrid";
// import OrganizationDocumentUploadModal from "@/app/components/shared/OrganizationDocumentUploadModal";
// import FieldPropagationModal from "@/app/components/shared/FieldPropagationModal";

// // Types + hooks + utils
// import { SectionConfig } from "@/app/types/employee-fields";
// import { useReferenceOptions } from "@/app/hooks/useReferenceOptions";
// import {
//   deepClone,
//   deepEqual,
//   deepClean,
//   passesShowIf,
// } from "@/app/utils/common";
// import {
//   buildAdditionalItems,
//   getProfileOrAdditionalValue,
//   sanitizeAddressArray,
// } from "@/app/utils/employee-field-helpers";
// import {
//   buildDocsValuesFromEmployee,
//   buildDocsPathMeta,
//   diffChangedDocs,
//   mergeAdditionalDocFieldsIntoConfig,
//   seedInitialORSelections,
// } from "@/app/utils/docs-helpers";
// import { buildCoreSectionData } from "@/app/utils/save-payloads";
// import { useFieldPropagation } from "@/app/hooks/useFieldPropagation";

// // -------------------------------
// // Config: endpoints
// // -------------------------------
// const SAVE_ENDPOINT = (branchId?: string | null) =>
//   `/employees/me/org-fields/${branchId}`;

// type DraftShape = {
//   [key: string]: any;
//   __inners?: Record<string, Record<string, any>>;
// };

// type EmployeeAccess = "hidden" | "view" | "edit";

// // --- add this helper in the same file ---
// function useSignedPhotoUrl(fileId?: string | null) {
//   const [url, setUrl] = useState<string | null>(null);

//   const refresh = useCallback(async () => {
//     if (!fileId) {
//       setUrl(null);
//       return null;
//     }
//     try {
//       const { data } = await axiosInstance.get<{ url: string }>(
//         `/uploads/${fileId}/url`
//       );
//       const fresh = data?.url || null;
//       setUrl(fresh);
//       return fresh;
//     } catch {
//       setUrl(null);
//       return null;
//     }
//   }, [fileId]);

//   useEffect(() => {
//     setUrl(null);
//     if (fileId) void refresh();
//   }, [fileId, refresh]);

//   return { url, refresh };
// }

// /** Map any legacy booleans to tri-state access */
// function coerceEmployeeAccess(s: Partial<SectionConfig> | any): EmployeeAccess {
//   const ea = s?.employeeAccess;
//   if (ea === "hidden" || ea === "view" || ea === "edit") return ea;
//   const legacy1 = s?.employeerOnlyEditable;
//   const legacy2 = s?.employerOnlyEditable;
//   if (typeof legacy1 === "boolean") return legacy1 ? "hidden" : "edit";
//   if (typeof legacy2 === "boolean") return legacy2 ? "hidden" : "edit";
//   return "edit";
// }

// /** Helpers to filter/annotate innerSections based on employeeAccess */
// function filterInnersForDisplay(section: SectionConfig): SectionConfig {
//   // show all non-hidden inners; keep access on each
//   const clone = deepClone(section);
//   if (Array.isArray(clone.innerSections)) {
//     clone.innerSections = clone.innerSections
//       .map((inn: any) => ({
//         ...inn,
//         employeeAccess: coerceEmployeeAccess(inn),
//       }))
//       .filter((inn: any) => inn.employeeAccess !== "hidden");
//   }
//   clone.employeeAccess = coerceEmployeeAccess(section);
//   return clone;
// }

// function filterInnersForEditing(section: SectionConfig): SectionConfig {
//   // only include editable inners in the drawer
//   const clone = deepClone(section);
//   if (Array.isArray(clone.innerSections)) {
//     clone.innerSections = clone.innerSections
//       .map((inn: any) => ({
//         ...inn,
//         employeeAccess: coerceEmployeeAccess(inn),
//       }))
//       .filter((inn: any) => inn.employeeAccess === "edit");
//   }
//   clone.employeeAccess = coerceEmployeeAccess(section);
//   return clone;
// }

// function getInnerAccessFromSection(
//   section: SectionConfig | null | undefined,
//   innerKey?: string | null
// ): EmployeeAccess {
//   if (!section || !innerKey) return "edit";
//   const found = section.innerSections?.find((i) => i.sectionKey === innerKey);
//   return coerceEmployeeAccess(found || {});
// }

// export default function ProfileBranchViewPage() {
//   const { branchId } = useParams<{ branchId: string }>();

//   // CONFIG + EMPLOYEE (me-in-branch)
//   const [config, setConfig] = useState<SectionConfig[]>([]);
//   const [employee, setEmployee] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   // Drawer
//   const [drawerOpen, setDrawerOpen] = useState(false);
//   const [editingSection, setEditingSection] = useState<SectionConfig | null>(
//     null
//   );
//   const [saving, setSaving] = useState(false);

//   // Drafts
//   const [draft, setDraft] = useState<DraftShape>({ __inners: {} });
//   const [addressDraft, setAddressDraft] = useState<any[]>([]);

//   // References
//   const referenceOptions = useReferenceOptions(config);

//   // Documents state
//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);
//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({});
//   const [docsValues, setDocsValues] = useState<any>({ documents: {} });
//   const [docsErrors, setDocsErrors] = useState<any>({});
//   const docsSnapshotRef = useState<any>({})[0];

//   // Avatar Upload state
//   const fileInputRef = useRef<HTMLInputElement | null>(null);
//   const [photoUploading, setPhotoUploading] = useState(false);
//   const [uploadPct, setUploadPct] = useState(0);

//   // Propagation modal
//   const [propModalOpen, setPropModalOpen] = useState(false);
//   const [propContext, setPropContext] = useState<{
//     fieldKey: string;
//     fieldLabel?: string;
//     value: any;
//     sectionKey?: string;
//     innerSectionKey?: string;
//   } | null>(null);

//   const {
//     loading: propLoading,
//     preview,
//     doPreview,
//     apply,
//     reset,
//   } = useFieldPropagation();

//   const pd = employee?.employeeFields?.personaldetails || {};
//   const photoFileId = employee?.employeeFields?.personaldetails?.employeephoto
//     ?.fileId as string | undefined;

//   const { url: photoUrl } = useSignedPhotoUrl(photoFileId);
//   const email = employee?.email as string | undefined;
//   const designation = employee?.designation?.name as string | undefined;
//   const departments: string[] = Array.isArray(
//     employee?.designation?.departmentIds
//   )
//     ? (employee.designation.departmentIds || [])
//         .map((d: any) => d?.name)
//         .filter(Boolean)
//     : [];

//   /** Find access for a section key (default edit if not configured) */
//   const sectionAccess = useCallback(
//     (key: string): EmployeeAccess => {
//       const sec = config.find((s) => s.sectionKey === key);
//       return coerceEmployeeAccess(sec || {});
//     },
//     [config]
//   );

//   // ---------------------------------
//   // Fetch – my org fields for this branch + my config
//   // ---------------------------------
//   useEffect(() => {
//     if (!branchId) return;
//     (async () => {
//       setLoading(true);
//       try {
//         const { data: orgRes } = await axiosInstance.get(
//           `/employees/me/org-fields/${branchId}`
//         );
//         const emp =
//           orgRes?.data?.employee ?? orgRes?.employee ?? orgRes?.data ?? null;

//         const { data: cfgRes } = await axiosInstance.get(
//           `/employee-field-config/my/${branchId}`
//         );
//         const sectionsRaw =
//           cfgRes?.data?.sections ?? cfgRes?.sections ?? cfgRes?.data ?? [];

//         // Map legacy → tri-state and drop top-level "hidden"
//         const mapped: SectionConfig[] = (
//           Array.isArray(sectionsRaw) ? sectionsRaw : []
//         )
//           .map((s: any) => {
//             const ea = coerceEmployeeAccess(s);
//             const cleaned: any = { ...s, employeeAccess: ea };
//             delete cleaned.employeerOnlyEditable;
//             delete cleaned.employerOnlyEditable;

//             if (Array.isArray(cleaned.innerSections)) {
//               cleaned.innerSections = cleaned.innerSections.map((inn: any) => {
//                 const iea = coerceEmployeeAccess(inn);
//                 const iClean: any = { ...inn, employeeAccess: iea };
//                 delete iClean.employeerOnlyEditable;
//                 delete iClean.employerOnlyEditable;
//                 return iClean;
//               });
//             }
//             return cleaned;
//           })
//           .filter((s: any) => coerceEmployeeAccess(s) !== "hidden");

//         setEmployee(emp);
//         setConfig(mapped);

//         const initialDocs = buildDocsValuesFromEmployee(emp);
//         (docsSnapshotRef as any).current = deepClone(initialDocs);
//         setDocsValues({ documents: initialDocs });

//         const initialSelects = seedInitialORSelections(mapped, initialDocs);
//         setSelectedDocuments(initialSelects);
//       } catch (e) {
//         console.error(e);
//         toast.error("Could not load branch data");
//         setEmployee(null);
//         setConfig([]);
//       } finally {
//         setLoading(false);
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [branchId]);

//   // ----------------
//   // Derived: Docs display config + path meta + inner access helpers
//   // ----------------
//   const rawDocsSection = useMemo(
//     () => config.find((s) => s.sectionKey === "documents") || null,
//     [config]
//   );

//   // Filter out hidden innerSections from documents, keep access on each
//   const docsDisplaySection = useMemo(() => {
//     const merged = mergeAdditionalDocFieldsIntoConfig(rawDocsSection, employee);
//     if (!merged) return null;
//     const clone = deepClone(merged);
//     if (Array.isArray(clone.innerSections)) {
//       clone.innerSections = clone.innerSections
//         .map((inn: any) => ({
//           ...inn,
//           employeeAccess: coerceEmployeeAccess(inn),
//         }))
//         .filter((inn: any) => inn.employeeAccess !== "hidden");
//     }
//     // keep top-level documents access for whole panel decisions
//     clone.employeeAccess = coerceEmployeeAccess(merged);
//     return clone;
//   }, [rawDocsSection, employee]);

//   const docsPathMeta = useMemo(
//     () => buildDocsPathMeta(docsDisplaySection || null),
//     [docsDisplaySection]
//   );

//   // Helper: get inner-section access by innerKey (for docs)
//   const getInnerAccess = useCallback(
//     (innerKey?: string | null): EmployeeAccess => {
//       if (!innerKey || !docsDisplaySection?.innerSections) return "edit";
//       const found = docsDisplaySection.innerSections.find(
//         (i: any) => i.sectionKey === innerKey
//       );
//       return coerceEmployeeAccess(found || {});
//     },
//     [docsDisplaySection]
//   );

//   // Helpers to read from employee profile/additional
//   const makeProfileLookup = useCallback(
//     (section: SectionConfig, innerKey?: string) => (key: string) =>
//       getProfileOrAdditionalValue(employee, section.sectionKey, key, innerKey),
//     [employee]
//   );
//   const getValue = useCallback(
//     (sectionKey: string, fieldKey: string, innerKey?: string) =>
//       getProfileOrAdditionalValue(employee, sectionKey, fieldKey, innerKey),
//     [employee]
//   );

//   // Draft lookups
//   const makeDraftLookup = useCallback(
//     (section: SectionConfig) => (key: string) => {
//       if (key in (draft || {})) return (draft as any)[key];
//       const groups = draft.__inners || {};
//       for (const g of Object.keys(groups))
//         if (key in (groups[g] || {})) return groups[g][key];
//       return undefined;
//     },
//     [draft]
//   );
//   const makeAddressRowLookup = (idx: number) => (key: string) =>
//     addressDraft?.[idx]?.[key];

//   // ----------------
//   // Drawer actions
//   // ----------------
//   const openDrawerForSection = (section: SectionConfig) => {
//     // Do not open if employee has view-only access
//     if (coerceEmployeeAccess(section) !== "edit") return;

//     // ✅ Exclude non-editable/hidden innerSections from the editor
//     const editableSection = filterInnersForEditing(section);
//     setEditingSection(editableSection);

//     if (editableSection.sectionKey === "address") {
//       const current: any[] = employee?.employeeFields?.address?.length
//         ? employee.employeeFields.address
//         : [{}];
//       const cleaned = current.map((row) => {
//         const c = { ...(row || {}) } as any;
//         delete c._id;
//         delete c.id;
//         return c;
//       });
//       setAddressDraft(cleaned);
//       setDraft({ __inners: {} });
//     } else {
//       const d: DraftShape = { __inners: {} };
//       for (const f of editableSection.fields || []) {
//         const v = getProfileOrAdditionalValue(
//           employee,
//           editableSection.sectionKey,
//           f.key
//         );
//         (d as any)[f.key] =
//           v ?? (f.type === "checkbox" ? false : f.type === "file" ? null : "");
//       }
//       for (const inn of editableSection.innerSections || []) {
//         d.__inners![inn.sectionKey] = {};
//         for (const f of inn.fields || []) {
//           const v = getProfileOrAdditionalValue(
//             employee,
//             editableSection.sectionKey,
//             f.key,
//             inn.sectionKey
//           );
//           d.__inners![inn.sectionKey][f.key] =
//             v ??
//             (f.type === "checkbox" ? false : f.type === "file" ? null : "");
//         }
//       }
//       setDraft(d);
//     }
//     setDrawerOpen(true);
//   };

//   const closeDrawer = () => {
//     setDrawerOpen(false);
//     setEditingSection(null);
//     setDraft({ __inners: {} });
//     setAddressDraft([]);
//   };

//   // ----------------
//   // Save handlers
//   // ----------------
//   const saveDrawer = async () => {
//     if (!editingSection || !branchId) return;
//     // Guard: only save if edit access
//     if (coerceEmployeeAccess(editingSection) !== "edit") {
//       toast.error("Section is read-only");
//       return;
//     }
//     setSaving(true);
//     try {
//       if (editingSection.sectionKey === "address") {
//         const visibleKeySet = new Set<string>();
//         addressDraft.forEach((_, idx) => {
//           const rowLookup = makeAddressRowLookup(idx);
//           (editingSection.fields || [])
//             .filter((f) => passesShowIf(f, rowLookup))
//             .forEach((f) => visibleKeySet.add(f.key));
//         });
//         const payloadArray = sanitizeAddressArray(addressDraft, visibleKeySet);
//         await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//           sectionKey: "address",
//           isAdditional: false,
//           data: payloadArray,
//         });
//       } else if (editingSection.isAdditional) {
//         const items = buildAdditionalItems(editingSection, draft);
//         if (items.length) {
//           await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//             sectionKey: editingSection.sectionKey,
//             isAdditional: true,
//             items,
//           });
//         } else {
//           toast("Nothing to save");
//         }
//       } else {
//         const data = buildCoreSectionData(
//           editingSection,
//           draft,
//           makeDraftLookup
//         );
//         if (Object.keys(data).length) {
//           await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//             sectionKey: editingSection.sectionKey,
//             isAdditional: false,
//             data,
//           });
//         } else {
//           toast("Nothing to save");
//         }
//       }

//       toast.success("Section saved");
//       const { data: orgRes } = await axiosInstance.get(
//         `/employees/me/org-fields/${branchId}`
//       );
//       const freshEmp =
//         orgRes?.data?.employee ?? orgRes?.employee ?? orgRes?.data ?? null;
//       setEmployee(freshEmp);
//       closeDrawer();
//     } catch (e: any) {
//       console.error(e);
//       toast.error(e?.response?.data?.message || "Failed to save");
//     } finally {
//       setSaving(false);
//     }
//   };

//   // Build core-docs snapshot using meta (exclude additional paths)
//   const buildCoreDocsSnapshot = (docsTree: any) => {
//     const out: any = {};
//     Object.entries(docsTree || {}).forEach(([innerKey, fieldsAny]) => {
//       const fields = fieldsAny as Record<string, any>;
//       Object.entries(fields || {}).forEach(([fieldKey, value]) => {
//         const meta = docsPathMeta[`documents.${innerKey}.${fieldKey}`];
//         if (meta && !meta.isAdditional) {
//           if (!out[innerKey]) out[innerKey] = {};
//           out[innerKey][fieldKey] = value;
//         }
//       });
//     });
//     return out;
//   };

//   // ----------------
//   // Docs: access helpers + guarded handlers
//   // ----------------
//   const docsTopAccess = sectionAccess("documents");
//   const docsPanelReadOnly = docsTopAccess !== "edit";

//   // Can edit a specific document path only if:
//   //  - top documents section is 'edit'
//   //  - AND inner section (by meta.innerSectionKey) is 'edit'
//   const canEditDocByPath = useCallback(
//     (fullPath?: string | null) => {
//       if (!fullPath || docsTopAccess !== "edit") return false;
//       const meta = docsPathMeta[fullPath];
//       const innerKey = meta?.innerSectionKey ?? meta?.innerKey ?? null;
//       return getInnerAccess(innerKey) === "edit";
//     },
//     [docsPathMeta, docsTopAccess, getInnerAccess]
//   );

//   // Guarded setters that a panel will use
//   const guardedSetActiveUploadField = useCallback(
//     (val: any) => {
//       // val is expected like { field, fullPath }
//       if (!val?.fullPath || !canEditDocByPath(val.fullPath)) {
//         toast.error("This document group is read-only.");
//         return;
//       }
//       setActiveUploadField(val);
//     },
//     [canEditDocByPath]
//   );

//   const guardedSetModalOpen = useCallback(
//     (next: boolean) => {
//       if (
//         next &&
//         activeUploadField?.fullPath &&
//         !canEditDocByPath(activeUploadField.fullPath)
//       ) {
//         toast.error("This document group is read-only.");
//         return;
//       }
//       setModalOpen(next);
//     },
//     [activeUploadField, canEditDocByPath]
//   );

//   // Docs autosave
//   const docsAutoSave = useCallback(
//     async (values: any) => {
//       if (docsTopAccess !== "edit") return;

//       try {
//         if (!branchId) return;
//         const cleaned = deepClean(values || {});
//         const nextDocs = cleaned?.documents || {};
//         const prevDocs =
//           (docsSnapshotRef as any).current ||
//           employee?.employeeFields?.documents ||
//           {};
//         const { changed, isEmpty } = diffChangedDocs(prevDocs, nextDocs);
//         if (isEmpty) return;

//         const coreFullNext = buildCoreDocsSnapshot(nextDocs);
//         const coreFullPrev = buildCoreDocsSnapshot(prevDocs);
//         const coreChanged = !deepEqual(coreFullNext, coreFullPrev);

//         const additionalItems: Array<{
//           sectionKey: "documents";
//           innerSectionKey?: string | null;
//           fieldKey: string;
//           value: any;
//         }> = [];

//         // Only include changes for inner sections that are 'edit'
//         Object.entries(changed).forEach(([innerKey, fieldsAny]) => {
//           const innerAccess = getInnerAccess(innerKey);
//           if (innerAccess !== "edit") return;

//           const fields = fieldsAny as Record<string, any>;
//           Object.entries(fields).forEach(([fieldKey, value]) => {
//             const meta = docsPathMeta[`documents.${innerKey}.${fieldKey}`];
//             if (meta?.isAdditional) {
//               additionalItems.push({
//                 sectionKey: "documents",
//                 innerSectionKey: meta.innerSectionKey ?? innerKey,
//                 fieldKey,
//                 value,
//               });
//             }
//           });
//         });

//         if (coreChanged) {
//           // Filter coreFullNext to keep ONLY editable inner groups
//           const editableCore: any = {};
//           Object.entries(coreFullNext).forEach(([innerKey, fields]) => {
//             if (getInnerAccess(innerKey) === "edit") {
//               editableCore[innerKey] = fields;
//             }
//           });

//           if (Object.keys(editableCore).length) {
//             await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//               sectionKey: "documents",
//               isAdditional: false,
//               data: editableCore,
//             });
//           }
//         }

//         if (additionalItems.length) {
//           await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//             sectionKey: "documents",
//             isAdditional: true,
//             items: additionalItems,
//           });
//         }

//         // Refresh snapshot
//         const { data: orgRes } = await axiosInstance.get(
//           `/employees/me/org-fields/${branchId}`
//         );
//         const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
//         setEmployee(fresh);
//         const freshDocs = buildDocsValuesFromEmployee(fresh);
//         (docsSnapshotRef as any).current = deepClone(freshDocs);
//         setDocsValues({ documents: freshDocs });
//       } catch (e: any) {
//         console.error(e);
//         toast.error(e?.response?.data?.message || "Failed to save documents");
//       }
//     },
//     [branchId, docsPathMeta, employee, docsTopAccess, getInnerAccess]
//   );

//   // ----------------
//   // Avatar handlers
//   // ----------------
//   const personalDetailsAccess = sectionAccess("personaldetails");
//   const avatarReadOnly = personalDetailsAccess !== "edit";

//   const handleSelectFile = async (file?: File | null) => {
//     if (avatarReadOnly) return; // block upload
//     if (!file || !branchId) return;
//     if (!file.type.startsWith("image/"))
//       return toast.error("Please select an image file");
//     const maxMB = 5;
//     if (file.size > maxMB * 1024 * 1024)
//       return toast.error(`Image must be ≤ ${maxMB}MB`);

//     try {
//       setPhotoUploading(true);
//       setUploadPct(0);
//       const formData = new FormData();
//       formData.append("file", file);
//       const { data } = await axiosInstance.post("/uploads", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//         onUploadProgress: (e) => {
//           if (!e.total) return;
//           setUploadPct(Math.round((e.loaded / e.total) * 100));
//         },
//       });
//       const url = data?.url || data?.data?.url;
//       if (!url) throw new Error("Upload failed");

//       // backend now returns id/key (no url)
//       const fileId = data?.id ?? data?.data?.id;
//       const key = data?.key ?? data?.data?.key;
//       if (!fileId || !key) throw new Error("Upload failed: missing id/key");

//       await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//         sectionKey: "personaldetails",
//         isAdditional: false,
//         data: { employeephoto: { fileId, key } },
//       });

//       const { data: orgRes } = await axiosInstance.get(
//         `/employees/me/org-fields/${branchId}`
//       );
//       const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
//       setEmployee(fresh);
//       toast.success("Photo updated");
//     } catch (err: any) {
//       console.error(err);
//       toast.error(err?.response?.data?.message || "Failed to update photo");
//     } finally {
//       setPhotoUploading(false);
//       setUploadPct(0);
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     }
//   };

//   const handleRemovePhoto = async () => {
//     if (avatarReadOnly) return; // block removal
//     if (!branchId) return;
//     try {
//       setPhotoUploading(true);
//       await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//         sectionKey: "personaldetails",
//         isAdditional: false,
//         data: { employeephoto: {} },
//       });
//       const { data: orgRes } = await axiosInstance.get(
//         `/employees/me/org-fields/${branchId}`
//       );
//       const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
//       setEmployee(fresh);
//       toast.success("Photo removed");
//     } catch (err: any) {
//       console.error(err);
//       toast.error(err?.response?.data?.message || "Failed to remove photo");
//     } finally {
//       setPhotoUploading(false);
//     }
//   };

//   // ----------------
//   // Propagation handlers
//   // ----------------
//   const closePropagateModal = () => {
//     setPropModalOpen(false);
//     setPropContext(null);
//     reset();
//   };

//   const handleApplyPropagation = async (payload: any) => {
//     const ok = await apply(payload);
//     if (ok && branchId) {
//       const { data: orgRes } = await axiosInstance.get(
//         `/employees/me/org-fields/${branchId}`
//       );
//       const fresh =
//         orgRes?.data?.employee ?? orgRes?.employee ?? orgRes?.data ?? null;
//       setEmployee(fresh);
//     }
//     return ok;
//   };

//   // ----------------
//   // Render
//   // ----------------
//   if (loading)
//     return <div className="p-6 text-center text-gray-500">Loading...</div>;
//   if (!employee)
//     return (
//       <div className="p-6 text-center text-red-500">No employee found</div>
//     );

//   return (
//     <div className="space-y-10">
//       {/* Top profile */}
//       <TopProfileCard
//         data={{
//           photoUrl,
//           name: `${pd.firstname || ""} ${pd.lastname || ""}`.trim(),
//           designation: designation || "",
//           location:
//             pd.location && pd.state ? `${pd.location}, ${pd.state}` : "",
//           mobile: pd.mobile,
//           email,
//           departments,
//         }}
//         uploading={photoUploading}
//         uploadPct={uploadPct}
//         // Disable handlers when not editable
//         onSelectFile={avatarReadOnly ? undefined : handleSelectFile}
//         onRemove={avatarReadOnly ? undefined : handleRemovePhoto}
//       />

//       {config.length === 0 ? (
//         <Card className="p-8 text-center text-gray-500">
//           No sections configured yet.
//         </Card>
//       ) : (
//         <Card className="p-6 shadow-sm border rounded-xl">
//           <Tab>
//             <Tab.List className="flex flex-wrap gap-2 border-b pb-2 mb-6">
//               {config.map((section) => (
//                 <Tab.ListItem
//                   key={section.sectionKey}
//                   className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 transition"
//                 >
//                   {section.sectionLabel}
//                 </Tab.ListItem>
//               ))}
//             </Tab.List>

//             <Tab.Panels>
//               {config.map((section) => {
//                 const access = coerceEmployeeAccess(section);
//                 const canEdit = access === "edit";
//                 const isDocs = section.sectionKey === "documents";
//                 const isAddress = section.sectionKey === "address";

//                 // ✅ Non-docs: build a display-only version with hidden inners removed
//                 const displaySection = !isDocs
//                   ? filterInnersForDisplay(section)
//                   : undefined;

//                 return (
//                   <Tab.Panel key={section.sectionKey} className="space-y-8">
//                     {isDocs ? (
//                       <DocumentsPanel
//                         // filtered & annotated documents section (hidden inners removed)
//                         docsDisplaySection={docsDisplaySection || null}
//                         docsValues={docsValues}
//                         setDocsValues={setDocsValues}
//                         docsErrors={docsErrors}
//                         selectedDocuments={selectedDocuments}
//                         setSelectedDocuments={setSelectedDocuments}
//                         activeUploadField={activeUploadField}
//                         // guard uploads/opening by inner access
//                         setActiveUploadField={
//                           docsPanelReadOnly
//                             ? () => {}
//                             : guardedSetActiveUploadField
//                         }
//                         modalOpen={modalOpen}
//                         setModalOpen={
//                           docsPanelReadOnly ? () => {} : guardedSetModalOpen
//                         }
//                         autoSave={
//                           docsPanelReadOnly ? async () => {} : docsAutoSave
//                         }
//                         readOnly={docsPanelReadOnly}
//                         // Propagation: allow only for editable inner section fields
//                         onPropagateClick={
//                           docsPanelReadOnly
//                             ? undefined
//                             : (args: {
//                                 fieldKey: string;
//                                 fieldLabel?: string;
//                                 value: any;
//                                 sectionKey?: string;
//                                 innerSectionKey?: string;
//                               }) => {
//                                 if (!branchId) return;
//                                 const innerAcc = getInnerAccess(
//                                   args.innerSectionKey
//                                 );
//                                 if (innerAcc !== "edit") {
//                                   toast.error(
//                                     "This document group is read-only."
//                                   );
//                                   return;
//                                 }
//                                 setPropContext({
//                                   fieldKey: args.fieldKey,
//                                   fieldLabel: args.fieldLabel,
//                                   value: args.value,
//                                   sectionKey: args.sectionKey,
//                                   innerSectionKey: args.innerSectionKey,
//                                 });
//                                 setPropModalOpen(true);
//                               }
//                         }
//                       />
//                     ) : isAddress ? (
//                       <>
//                         <div className="flex items-center justify-between">
//                           <div />
//                           <div className="flex justify-end w-full">
//                             {canEdit && (
//                               <Button
//                                 size="sm"
//                                 className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
//                                 onClick={() => openDrawerForSection(section)}
//                               >
//                                 Edit
//                               </Button>
//                             )}
//                           </div>
//                         </div>

//                         {/* View-only address grid */}
//                         <div className="space-y-6">
//                           {(
//                             ((employee?.employeeFields?.address as any[]) || [
//                               {},
//                             ]) as any[]
//                           ).map((addr: any, idx: number) => (
//                             <div
//                               key={idx}
//                               className="p-4 border border-gray-200 rounded-xl bg-gray-50"
//                             >
//                               {/* Header = addressFor */}
//                               <div className="">
//                                 <h5 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-4">
//                                   {addr?.addressFor || "Address"}
//                                 </h5>
//                               </div>

//                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
//                                 {(section.fields || [])
//                                   .filter((f) => f.key !== "addressFor")
//                                   .filter((f) =>
//                                     passesShowIf(f, (k) => addr?.[k])
//                                   )
//                                   .map((field) => (
//                                     <div
//                                       key={field.key}
//                                       className="flex items-start gap-4"
//                                     >
//                                       <div className="flex-1">
//                                         <SectionPanel
//                                           section={{
//                                             ...section,
//                                             fields: [field],
//                                             innerSections: [],
//                                           }}
//                                           employee={{
//                                             employeeFields: { address: [addr] },
//                                           }}
//                                           makeProfileLookup={() => () =>
//                                             addr?.[field.key]}
//                                           getValue={() => addr?.[field.key]}
//                                           readOnly={!canEdit}
//                                         />
//                                       </div>
//                                     </div>
//                                   ))}
//                               </div>
//                             </div>
//                           ))}
//                         </div>
//                       </>
//                     ) : (
//                       <SectionPanel
//                         // ✅ Display: hide innerSections with access === 'hidden'
//                         section={displaySection!}
//                         employee={employee}
//                         makeProfileLookup={makeProfileLookup}
//                         getValue={getValue}
//                         referenceOptions={referenceOptions}
//                         readOnly={!canEdit}
//                         headerRight={
//                           <div className="flex justify-end w-full">
//                             {canEdit && (
//                               <Button
//                                 size="sm"
//                                 className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
//                                 onClick={() => openDrawerForSection(section)}
//                               >
//                                 Edit
//                               </Button>
//                             )}
//                           </div>
//                         }
//                         onPropagateClick={
//                           canEdit
//                             ? (args) => {
//                                 if (!branchId) return;
//                                 // ✅ Block propagate for non-editable inners
//                                 const innerAcc = getInnerAccessFromSection(
//                                   displaySection!,
//                                   args.innerSectionKey
//                                 );
//                                 if (
//                                   args.innerSectionKey &&
//                                   innerAcc !== "edit"
//                                 ) {
//                                   toast.error(
//                                     "This group is read-only for employees."
//                                   );
//                                   return;
//                                 }
//                                 setPropContext({
//                                   fieldKey: args.fieldKey,
//                                   fieldLabel: args.fieldLabel,
//                                   value: args.value,
//                                   sectionKey: args.sectionKey,
//                                   innerSectionKey: args.innerSectionKey,
//                                 });
//                                 setPropModalOpen(true);
//                               }
//                             : undefined
//                         }
//                       />
//                     )}
//                   </Tab.Panel>
//                 );
//               })}
//             </Tab.Panels>
//           </Tab>
//         </Card>
//       )}

//       {/* Drawer */}
//       <EditDrawer
//         open={drawerOpen}
//         title={editingSection?.sectionLabel || ""}
//         onClose={closeDrawer}
//         footer={
//           <div className="flex justify-end gap-3">
//             <Button variant="outline" onClick={closeDrawer} disabled={saving}>
//               Cancel
//             </Button>
//             {/* Save button visible only if section is still editable */}
//             {editingSection &&
//               coerceEmployeeAccess(editingSection) === "edit" && (
//                 <Button onClick={saveDrawer} disabled={saving}>
//                   {saving ? "Saving…" : "Save"}
//                 </Button>
//               )}
//           </div>
//         }
//       >
//         {/* Render editors only when section is editable */}
//         {editingSection && coerceEmployeeAccess(editingSection) === "edit" ? (
//           editingSection.sectionKey === "address" ? (
//             <AddressEditor
//               section={editingSection}
//               addressDraft={addressDraft}
//               setAddressDraft={setAddressDraft}
//               makeAddressRowLookup={makeAddressRowLookup}
//               referenceOptions={referenceOptions}
//             />
//           ) : (
//             // ✅ Editor receives only editable innerSections
//             <SectionEditGrid
//               section={editingSection}
//               draft={draft}
//               setDraft={setDraft}
//               makeDraftLookup={makeDraftLookup}
//               referenceOptions={referenceOptions}
//             />
//           )
//         ) : null}
//       </EditDrawer>

//       {/* Document upload/view modal (guarded by access) */}
//       {activeUploadField && canEditDocByPath(activeUploadField?.fullPath) && (
//         <OrganizationDocumentUploadModal
//           isOpen={modalOpen}
//           onClose={() => setModalOpen(false)}
//           field={activeUploadField.field}
//           fullPath={activeUploadField.fullPath}
//           formik={{
//             values: docsValues,
//             setFieldValue: (path: string, val: any) =>
//               setDocsValues((prev: any) => {
//                 const next = deepClone(prev);
//                 const parts = path.split(".");
//                 let cur: any = next;
//                 while (parts.length > 1) {
//                   const k = parts.shift() as string;
//                   if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
//                   cur = cur[k];
//                 }
//                 cur[parts[0]] = val;
//                 return next;
//               }),
//             setValues: (allVals: any) => {
//               setDocsValues(deepClone(allVals ?? { documents: {} }));
//             },
//           }}
//           autoSave={docsAutoSave}
//         />
//       )}

//       {/* Propagation modal */}
//       {propContext && branchId && (
//         <FieldPropagationModal
//           open={propModalOpen}
//           onClose={closePropagateModal}
//           fieldKey={propContext.fieldKey}
//           fieldLabel={propContext.fieldLabel}
//           currentBranchId={branchId}
//           currentValue={propContext.value}
//           preview={preview}
//           loading={propLoading}
//           onPreview={doPreview}
//           onApply={handleApplyPropagation}
//         />
//       )}
//     </div>
//   );
// }

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Tab, Button } from "rizzui";
import toast from "react-hot-toast";
import axiosInstance from "@/app/lib/axios";
import { Card } from "@/app/components/ui/Card";

// Reusable
import { TopProfileCard } from "@/app/components/shared/TopProfileCard";
import { DocumentsPanel } from "@/app/components/shared/DocumentsPanel";
import { SectionPanel } from "@/app/components/shared/SectionPanel";
import { AddressEditor } from "@/app/components/shared/AddressEditor";
import { EditDrawer } from "@/app/components/shared/EditDrawer";
import { SectionEditGrid } from "@/app/components/shared/SectionEditGrid";
import OrganizationDocumentUploadModal from "@/app/components/shared/OrganizationDocumentUploadModal";
import FieldPropagationModal from "@/app/components/shared/FieldPropagationModal";

// Types + hooks + utils
import { SectionConfig } from "@/app/types/employee-fields";
import { useReferenceOptions } from "@/app/hooks/useReferenceOptions";
import {
  deepClone,
  deepEqual,
  deepClean,
  passesShowIf,
  isNonEmpty,
} from "@/app/utils/common";
import {
  HomeIcon,
  UserIcon,
  MapPinIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { debounce } from "lodash";
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
import { useFieldPropagation } from "@/app/hooks/useFieldPropagation";
import { createFieldChangeRequest } from "@/app/services/fieldChangeRequest.service";

// -------------------------------
// Config: endpoints
// -------------------------------
const SAVE_ENDPOINT = (branchId?: string | null) =>
  `/employees/me/org-fields/${branchId}`;

// [AUDIT] tracking endpoint (backend route)
const VIEW_ENDPOINT = (branchId: string) =>
  `/audit/view-employee-section/${branchId}`;

type DraftShape = {
  [key: string]: any;
  __inners?: Record<string, Record<string, any>>;
};

type EmployeeAccess = "hidden" | "view" | "edit";

// --- signed photo helper ---
function useSignedPhotoUrl(fileId?: string | null) {
  const [url, setUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fileId) {
      setUrl(null);
      return null;
    }
    try {
      // Ensure fileId is a string (convert ObjectId to string if needed)
      const fileIdString = String(fileId);
      const { data } = await axiosInstance.get<{ url: string }>(
        `/uploads/${fileIdString}/url`
      );
      const fresh = data?.url || null;
      setUrl(fresh);
      return fresh;
    } catch {
      setUrl(null);
      return null;
    }
  }, [fileId]);

  useEffect(() => {
    setUrl(null);
    if (fileId) void refresh();
  }, [fileId, refresh]);

  return { url, refresh };
}

/** Map any legacy booleans to tri-state access */
function coerceEmployeeAccess(s: Partial<SectionConfig> | any): EmployeeAccess {
  const ea = s?.employeeAccess;
  if (ea === "hidden" || ea === "view" || ea === "edit") return ea;
  const legacy1 = s?.employeerOnlyEditable;
  const legacy2 = s?.employerOnlyEditable;
  if (typeof legacy1 === "boolean") return legacy1 ? "hidden" : "edit";
  if (typeof legacy2 === "boolean") return legacy2 ? "hidden" : "edit";
  return "edit";
}

/** Display-only section clone with hidden inners removed */
function filterInnersForDisplay(section: SectionConfig): SectionConfig {
  const clone = deepClone(section);
  if (Array.isArray(clone.innerSections)) {
    clone.innerSections = clone.innerSections
      .map((inn: any) => ({
        ...inn,
        employeeAccess: coerceEmployeeAccess(inn),
      }))
      .filter((inn: any) => inn.employeeAccess !== "hidden");
  }
  clone.employeeAccess = coerceEmployeeAccess(section);
  return clone;
}

/** Editor-only section clone with only editable inners kept */
function filterInnersForEditing(section: SectionConfig): SectionConfig {
  const clone = deepClone(section);
  if (Array.isArray(clone.innerSections)) {
    clone.innerSections = clone.innerSections
      .map((inn: any) => ({
        ...inn,
        employeeAccess: coerceEmployeeAccess(inn),
      }))
      .filter((inn: any) => inn.employeeAccess === "edit");
  }
  clone.employeeAccess = coerceEmployeeAccess(section);
  return clone;
}

function getInnerAccessFromSection(
  section: SectionConfig | null | undefined,
  innerKey?: string | null
): EmployeeAccess {
  if (!section || !innerKey) return "edit";
  const found = section.innerSections?.find((i) => i.sectionKey === innerKey);
  return coerceEmployeeAccess(found || {});
}

// [AUDIT] tiny helper to POST a view event (safe & silent on error)
async function postViewTab(params: {
  branchId?: string | null;
  sectionKey?: string | null;
  innerSectionKey?: string | null;
}) {
  try {
    if (!params.branchId || !params.sectionKey) return;
    await axiosInstance.post(VIEW_ENDPOINT(params.branchId), {
      sectionKey: params.sectionKey,
      innerSectionKey: params.innerSectionKey ?? null,
    });
  } catch (e) {
    // Do not block UX if analytics fails
    console.debug("audit view failed", e);
  }
}

export default function ProfileBranchViewPage() {
  const { branchId } = useParams<{ branchId: string }>();

  // CONFIG + EMPLOYEE (me-in-branch)
  const [config, setConfig] = useState<SectionConfig[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // [AUDIT] controlled tabs + de-dupe signature
  const [tabIndex, setTabIndex] = useState(0);
  const lastLoggedRef = useRef<string | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionConfig | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  // Drafts
  const [draft, setDraft] = useState<DraftShape>({ __inners: {} });
  const [addressDraft, setAddressDraft] = useState<any[]>([]);

  // References
  const referenceOptions = useReferenceOptions(config);

  // Documents state
  const [modalOpen, setModalOpen] = useState(false);
  const [activeUploadField, setActiveUploadField] = useState<any>(null);
  const [selectedDocuments, setSelectedDocuments] = useState<
    Record<string, string>
  >({});
  const [docsValues, setDocsValues] = useState<any>({ documents: {} });
  const [docsErrors, setDocsErrors] = useState<any>({});
  const docsSnapshotRef = useState<any>({})[0];

  // Avatar Upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  // Propagation modal
  const [propModalOpen, setPropModalOpen] = useState(false);
  const [propContext, setPropContext] = useState<{
    fieldKey: string;
    fieldLabel?: string;
    value: any;
    sectionKey?: string;
    innerSectionKey?: string;
  } | null>(null);

  const {
    loading: propLoading,
    preview,
    doPreview,
    apply,
    reset,
  } = useFieldPropagation();

  const pd = employee?.employeeFields?.personaldetails || {};
  const photoFileId = employee?.employeeFields?.personaldetails?.employeephoto
    ?.fileId as string | undefined;

  const { url: photoUrl } = useSignedPhotoUrl(photoFileId);
  const email = employee?.email as string | undefined;
  const designation = employee?.designation?.name as string | undefined;
  const departments: string[] = Array.isArray(
    employee?.designation?.departmentIds
  )
    ? (employee.designation.departmentIds || [])
        .map((d: any) => d?.name)
        .filter(Boolean)
    : [];

  /** Find access for a section key (default edit if not configured) */
  const sectionAccess = useCallback(
    (key: string): EmployeeAccess => {
      const sec = config.find((s) => s.sectionKey === key);
      return coerceEmployeeAccess(sec || {});
    },
    [config]
  );

  // ---------------------------------
  // Fetch – my org fields for this branch + my config
  // ---------------------------------
  useEffect(() => {
    if (!branchId) return;
    (async () => {
      setLoading(true);
      try {
        const { data: orgRes } = await axiosInstance.get(
          `/employees/me/org-fields/${branchId}`
        );
        const emp =
          orgRes?.data?.employee ?? orgRes?.employee ?? orgRes?.data ?? null;

        const { data: cfgRes } = await axiosInstance.get(
          `/employee-field-config/my/${branchId}`
        );
        const sectionsRaw =
          cfgRes?.data?.sections ?? cfgRes?.sections ?? cfgRes?.data ?? [];

        // Map legacy → tri-state and drop top-level "hidden"
        const mapped: SectionConfig[] = (
          Array.isArray(sectionsRaw) ? sectionsRaw : []
        )
          .map((s: any) => {
            const ea = coerceEmployeeAccess(s);
            const cleaned: any = { ...s, employeeAccess: ea };
            delete cleaned.employeerOnlyEditable;
            delete cleaned.employerOnlyEditable;

            if (Array.isArray(cleaned.innerSections)) {
              cleaned.innerSections = cleaned.innerSections.map((inn: any) => {
                const iea = coerceEmployeeAccess(inn);
                const iClean: any = { ...inn, employeeAccess: iea };
                delete iClean.employeerOnlyEditable;
                delete iClean.employerOnlyEditable;
                return iClean;
              });
            }
            return cleaned;
          })
          .filter((s: any) => coerceEmployeeAccess(s) !== "hidden");

        setEmployee(emp);
        setConfig(mapped);

        const initialDocs = buildDocsValuesFromEmployee(emp);
        (docsSnapshotRef as any).current = deepClone(initialDocs);
        setDocsValues({ documents: initialDocs });

        const initialSelects = seedInitialORSelections(mapped, initialDocs);
        setSelectedDocuments(initialSelects);
      } catch (e) {
        console.error(e);
        toast.error("Could not load branch data");
        setEmployee(null);
        setConfig([]);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  // ----------------
  // Derived: Docs display config + path meta + inner access helpers
  // ----------------
  const rawDocsSection = useMemo(
    () => config.find((s) => s.sectionKey === "documents") || null,
    [config]
  );

  const docsDisplaySection = useMemo(() => {
    const merged = mergeAdditionalDocFieldsIntoConfig(rawDocsSection, employee);
    if (!merged) return null;
    const clone = deepClone(merged);
    if (Array.isArray(clone.innerSections)) {
      clone.innerSections = clone.innerSections
        .map((inn: any) => ({
          ...inn,
          employeeAccess: coerceEmployeeAccess(inn),
        }))
        .filter((inn: any) => inn.employeeAccess !== "hidden");
    }
    clone.employeeAccess = coerceEmployeeAccess(merged);
    return clone;
  }, [rawDocsSection, employee]);

  const docsPathMeta = useMemo(
    () => buildDocsPathMeta(docsDisplaySection || null),
    [docsDisplaySection]
  );

  const getInnerAccess = useCallback(
    (innerKey?: string | null): EmployeeAccess => {
      if (!innerKey || !docsDisplaySection?.innerSections) return "edit";
      const found = docsDisplaySection.innerSections.find(
        (i: any) => i.sectionKey === innerKey
      );
      return coerceEmployeeAccess(found || {});
    },
    [docsDisplaySection]
  );

  // Helpers to read from employee profile/additional
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
  // [AUDIT] Tab tracking logic
  // ----------------

  // Choose initial tab (prefer 'personaldetails' if present)
  useEffect(() => {
    if (!config?.length) return;
    const idx = config.findIndex((s) => s.sectionKey === "personaldetails");
    setTabIndex(idx >= 0 ? idx : 0);
  }, [config]);

  // Log when active tab changes (deduped)
  useEffect(() => {
    if (!branchId || !config?.length) return;
    const section = config[tabIndex];
    if (!section?.sectionKey) return;

    const sig = `${branchId}:${section.sectionKey}`;
    if (lastLoggedRef.current === sig) return; // de-dupe

    lastLoggedRef.current = sig;
    void postViewTab({ branchId, sectionKey: section.sectionKey });
  }, [tabIndex, branchId, config]);

  // ----------------
  // Drawer actions
  // ----------------
  const openDrawerForSection = (section: SectionConfig) => {
    if (coerceEmployeeAccess(section) !== "edit") return;
    const editableSection = filterInnersForEditing(section);
    setEditingSection(editableSection);

    if (editableSection.sectionKey === "address") {
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
      for (const f of editableSection.fields || []) {
        const v = getProfileOrAdditionalValue(
          employee,
          editableSection.sectionKey,
          f.key
        );
        (d as any)[f.key] =
          v ?? (f.type === "checkbox" ? false : f.type === "file" ? null : "");
      }
      for (const inn of editableSection.innerSections || []) {
        d.__inners![inn.sectionKey] = {};
        for (const f of inn.fields || []) {
          const v = getProfileOrAdditionalValue(
            employee,
            editableSection.sectionKey,
            f.key,
            inn.sectionKey
          );
          d.__inners![inn.sectionKey][f.key] =
            v ??
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
    if (!editingSection || !branchId) return;
    if (coerceEmployeeAccess(editingSection) !== "edit") {
      toast.error("Section is read-only");
      return;
    }
    setSaving(true);
    try {
      console.log("🔍 DEBUG: saveDrawer called with editingSection:", {
        sectionKey: editingSection.sectionKey,
        hasInnerSections: !!editingSection.innerSections,
        innerSections: editingSection.innerSections?.map((inner) => ({
          sectionKey: inner.sectionKey,
          fields: inner.fields?.map((f) => f.key),
        })),
        fields: editingSection.fields?.map((f) => f.key),
      });

      // Skip documents section - it will be handled separately
      if (editingSection.sectionKey === "documents") {
        toast.error("Document changes are handled separately");
        return;
      }

      let changeRequests: Array<{
        sectionKey: string;
        fieldKey: string;
        fieldLabel: string;
        oldValue: any;
        newValue: any;
      }> = [];

      if (editingSection.sectionKey === "address") {
        // Handle address changes
        const visibleKeySet = new Set<string>();
        addressDraft.forEach((_, idx) => {
          const rowLookup = makeAddressRowLookup(idx);
          (editingSection.fields || [])
            .filter((f) => passesShowIf(f, rowLookup))
            .forEach((f) => visibleKeySet.add(f.key));
        });

        // Compare old vs new address values
        const currentAddresses = employee?.employeeFields?.address || [];
        addressDraft.forEach((newAddr: any, idx: number) => {
          const oldAddr = currentAddresses[idx] || {};

          Object.keys(newAddr).forEach((fieldKey) => {
            if (visibleKeySet.has(fieldKey)) {
              const oldValue = oldAddr[fieldKey];
              const newValue = newAddr[fieldKey];

              // Only create change request if values are actually different
              // Handle undefined/null values properly
              const normalizedOldValue =
                oldValue === undefined || oldValue === null ? "" : oldValue;
              const normalizedNewValue =
                newValue === undefined || newValue === null ? "" : newValue;

              if (normalizedOldValue !== normalizedNewValue) {
                const field = editingSection.fields?.find(
                  (f) => f.key === fieldKey
                );
                changeRequests.push({
                  sectionKey: "address",
                  fieldKey,
                  fieldLabel: field?.label || fieldKey,
                  oldValue: normalizedOldValue,
                  newValue: normalizedNewValue,
                });
              }
            }
          });
        });
      } else if (editingSection.isAdditional) {
        // Handle additional fields
        const items = buildAdditionalItems(editingSection, draft);
        items.forEach((item) => {
          const oldValue = getProfileOrAdditionalValue(
            employee,
            editingSection.sectionKey,
            item.fieldKey,
            item.innerSectionKey
          );

          // Only create change request if values are actually different
          // Handle undefined/null values properly
          const normalizedOldValue =
            oldValue === undefined || oldValue === null ? "" : oldValue;
          const normalizedNewValue =
            item.value === undefined || item.value === null ? "" : item.value;

          if (normalizedOldValue !== normalizedNewValue) {
            const field =
              editingSection.fields?.find((f) => f.key === item.fieldKey) ||
              editingSection.innerSections
                ?.find((inn) => inn.sectionKey === item.innerSectionKey)
                ?.fields?.find((f) => f.key === item.fieldKey);

            changeRequests.push({
              sectionKey: editingSection.sectionKey,
              fieldKey: item.fieldKey,
              fieldLabel: field?.label || item.fieldKey,
              innerSectionKey: item.innerSectionKey,
              oldValue: normalizedOldValue,
              newValue: normalizedNewValue,
            });
          }
        });
      } else {
        // Handle core fields - process top-level fields and inner sections separately
        const lookup = makeDraftLookup(editingSection);

        // Process top-level fields
        for (const field of editingSection.fields || []) {
          if (!passesShowIf(field, lookup)) continue;

          const newValue = draft?.[field.key];
          const oldValue = getProfileOrAdditionalValue(
            employee,
            editingSection.sectionKey,
            field.key
          );

          // Only create change request if values are actually different
          // Handle undefined/null values properly
          const normalizedOldValue =
            oldValue === undefined || oldValue === null ? "" : oldValue;
          const normalizedNewValue =
            newValue === undefined || newValue === null ? "" : newValue;

          if (normalizedOldValue !== normalizedNewValue) {
            changeRequests.push({
              sectionKey: editingSection.sectionKey,
              fieldKey: field.key,
              fieldLabel: field.label || field.key,
              oldValue: normalizedOldValue,
              newValue: normalizedNewValue,
            });
          }
        }

        // Process inner sections
        console.log(
          "🔍 DEBUG: Processing inner sections:",
          editingSection.innerSections
        );
        for (const innerSection of editingSection.innerSections || []) {
          console.log(
            "🔍 DEBUG: Processing inner section:",
            innerSection.sectionKey,
            "with fields:",
            innerSection.fields?.map((f) => f.key)
          );
          for (const field of innerSection.fields || []) {
            if (!passesShowIf(field, lookup)) continue;

            const newValue =
              draft.__inners?.[innerSection.sectionKey]?.[field.key];
            const oldValue = getProfileOrAdditionalValue(
              employee,
              editingSection.sectionKey,
              field.key,
              innerSection.sectionKey
            );

            console.log("🔍 DEBUG: Inner section field change detected:", {
              sectionKey: editingSection.sectionKey,
              innerSectionKey: innerSection.sectionKey,
              fieldKey: field.key,
              oldValue,
              newValue,
            });

            // Only create change request if values are actually different
            // Handle undefined/null values properly
            const normalizedOldValue =
              oldValue === undefined || oldValue === null ? "" : oldValue;
            const normalizedNewValue =
              newValue === undefined || newValue === null ? "" : newValue;

            if (normalizedOldValue !== normalizedNewValue) {
              console.log(
                "🔍 DEBUG: Creating change request for inner section field:",
                {
                  sectionKey: editingSection.sectionKey,
                  innerSectionKey: innerSection.sectionKey,
                  fieldKey: field.key,
                  oldValue: normalizedOldValue,
                  newValue: normalizedNewValue,
                }
              );

              changeRequests.push({
                sectionKey: editingSection.sectionKey,
                fieldKey: field.key,
                fieldLabel: field.label || field.key,
                innerSectionKey: innerSection.sectionKey,
                oldValue: normalizedOldValue,
                newValue: normalizedNewValue,
              });
            }
          }
        }
      }

      if (changeRequests.length === 0) {
        toast("No changes detected");
        return;
      }

      // Create field change requests
      const employeeId = employee?._id;
      if (!employeeId) {
        toast.error("Employee ID not found");
        return;
      }

      console.log(
        "🔍 DEBUG: About to create field change requests:",
        changeRequests
      );

      for (const request of changeRequests) {
        console.log("🔍 DEBUG: Creating field change request:", request);
        await createFieldChangeRequest({
          employeeId,
          ...request,
        });
      }

      toast.success(
        `${changeRequests.length} change request(s) submitted for approval`
      );
      closeDrawer();
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.response?.data?.message || "Failed to submit change requests"
      );
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

  // ----------------
  // Docs: access helpers + guarded handlers
  // ----------------
  const docsTopAccess = sectionAccess("documents");
  const docsPanelReadOnly = docsTopAccess !== "edit";

  const canEditDocByPath = useCallback(
    (fullPath?: string | null) => {
      if (!fullPath || docsTopAccess !== "edit") return false;
      const meta = docsPathMeta[fullPath];
      const innerKey = meta?.innerSectionKey ?? meta?.innerKey ?? null;
      return getInnerAccess(innerKey) === "edit";
    },
    [docsPathMeta, docsTopAccess, getInnerAccess]
  );

  const guardedSetActiveUploadField = useCallback(
    (val: any) => {
      if (!val?.fullPath || !canEditDocByPath(val.fullPath)) {
        toast.error("This document group is read-only.");
        return;
      }
      setActiveUploadField(val);
    },
    [canEditDocByPath]
  );

  const guardedSetModalOpen = useCallback(
    (next: boolean) => {
      if (
        next &&
        activeUploadField?.fullPath &&
        !canEditDocByPath(activeUploadField.fullPath)
      ) {
        toast.error("This document group is read-only.");
        return;
      }
      setModalOpen(next);
    },
    [activeUploadField, canEditDocByPath]
  );

  // Docs autosave with debouncing to prevent multiple API calls
  const docsAutoSave = useCallback(
    debounce(
      async (
        values: any,
        updatedField?: {
          path: string;
          field: string;
          value: any;
          oldValue: any;
        }
      ) => {
        if (docsTopAccess !== "edit") return;

        try {
          if (!branchId) return;
          const cleaned = deepClean(values || {});
          const nextDocs = cleaned?.documents || {};
          const prevDocs =
            (docsSnapshotRef as any).current ||
            employee?.employeeFields?.documents ||
            {};
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

          // Only include changes for inner sections that are 'edit'
          Object.entries(changed).forEach(([innerKey, fieldsAny]) => {
            const innerAccess = getInnerAccess(innerKey);
            if (innerAccess !== "edit") return;

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
            // Only send the specific inner groups that actually changed
            const changedCore: any = {};
            Object.entries(changed).forEach(([innerKey, fieldsAny]) => {
              const innerAccess = getInnerAccess(innerKey);
              if (innerAccess !== "edit") return;

              // Only include this inner group if it has actual changes
              const fields = fieldsAny as Record<string, any>;
              if (Object.keys(fields).length > 0) {
                // Get the full fields for this inner group from coreFullNext
                const fullFields = coreFullNext[innerKey];
                if (fullFields) {
                  changedCore[innerKey] = fullFields;
                }
              }
            });

            if (Object.keys(changedCore).length) {
              console.log(
                "🔍 DEBUG: Sending only changed document types:",
                Object.keys(changedCore)
              );

              // Prepare the API payload with updatedField information
              const apiPayload: any = {
                sectionKey: "documents",
                isAdditional: false,
                data: changedCore,
              };

              // If we have specific field information, include it for efficient change tracking
              if (updatedField) {
                apiPayload.updatedField = {
                  path: updatedField.path,
                  field: updatedField.field,
                  value: updatedField.value,
                  oldValue: updatedField.oldValue,
                };
              }

              await axiosInstance.put(SAVE_ENDPOINT(branchId), apiPayload);
            }
          }

          if (additionalItems.length) {
            await axiosInstance.put(SAVE_ENDPOINT(branchId), {
              sectionKey: "documents",
              isAdditional: true,
              items: additionalItems,
            });
          }

          // Refresh snapshot
          const { data: orgRes } = await axiosInstance.get(
            `/employees/me/org-fields/${branchId}`
          );
          const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
          setEmployee(fresh);
          const freshDocs = buildDocsValuesFromEmployee(fresh);
          (docsSnapshotRef as any).current = deepClone(freshDocs);
          setDocsValues({ documents: freshDocs });
        } catch (e: any) {
          console.error(e);
          toast.error(e?.response?.data?.message || "Failed to save documents");
        }
      },
      1000
    ), // 1 second debounce
    [branchId, docsPathMeta, employee, docsTopAccess, getInnerAccess]
  );

  // ----------------
  // Avatar handlers
  // ----------------
  const personalDetailsAccess = sectionAccess("personaldetails");
  const avatarReadOnly = personalDetailsAccess !== "edit";

  const handleSelectFile = async (file?: File | null) => {
    if (avatarReadOnly) return;
    if (!file || !branchId) return;
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

      const url = data?.url || data?.data?.url;
      if (!url) throw new Error("Upload failed");

      const fileId = data?.id ?? data?.data?.id;
      const key = data?.key ?? data?.data?.key;
      if (!fileId || !key) throw new Error("Upload failed: missing id/key");

      await axiosInstance.put(SAVE_ENDPOINT(branchId), {
        sectionKey: "personaldetails",
        isAdditional: false,
        data: { employeephoto: { fileId, key } },
      });

      const { data: orgRes } = await axiosInstance.get(
        `/employees/me/org-fields/${branchId}`
      );
      const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
      setEmployee(fresh);
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
    if (avatarReadOnly) return;
    if (!branchId) return;
    try {
      setPhotoUploading(true);
      await axiosInstance.put(SAVE_ENDPOINT(branchId), {
        sectionKey: "personaldetails",
        isAdditional: false,
        data: { employeephoto: {} },
      });
      const { data: orgRes } = await axiosInstance.get(
        `/employees/me/org-fields/${branchId}`
      );
      const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
      setEmployee(fresh);
      toast.success("Photo removed");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to remove photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  // ----------------
  // Propagation handlers
  // ----------------
  const closePropagateModal = () => {
    setPropModalOpen(false);
    setPropContext(null);
    reset();
  };

  const handleApplyPropagation = async (payload: any) => {
    const ok = await apply(payload);
    if (ok && branchId) {
      const { data: orgRes } = await axiosInstance.get(
        `/employees/me/org-fields/${branchId}`
      );
      const fresh =
        orgRes?.data?.employee ?? orgRes?.employee ?? orgRes?.data ?? null;
      setEmployee(fresh);
    }
    return ok;
  };

  // ----------------
  // Render
  // ----------------
  if (loading)
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (!employee)
    return (
      <div className="p-6 text-center text-red-500">No employee found</div>
    );

  return (
    <div className="space-y-10">
      {/* Top profile */}
      <TopProfileCard
        data={{
          photoUrl,
          name: `${pd.firstname || ""} ${pd.lastname || ""}`.trim(),
          designation: designation || "",
          location:
            pd.location && pd.state ? `${pd.location}, ${pd.state}` : "",
          mobile: pd.mobile,
          email,
          departments,
        }}
        uploading={photoUploading}
        uploadPct={uploadPct}
        onSelectFile={avatarReadOnly ? undefined : handleSelectFile}
        onRemove={avatarReadOnly ? undefined : handleRemovePhoto}
      />

      {config.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          No sections configured yet.
        </Card>
      ) : (
        <Card className="p-6 shadow-sm border rounded-xl">
          {/* [AUDIT] make Tab controlled */}
          <Tab selectedIndex={tabIndex} onChange={setTabIndex}>
            <Tab.List className="flex flex-wrap gap-0 border-b border-gray-200 pb-0 mb-0 bg-white">
              {config.map((section, i) => {
                const isActive = tabIndex === i;
                // Map section keys to icons
                const getSectionIcon = (key: string) => {
                  const keyLower = key.toLowerCase();
                  if (keyLower.includes("personal")) return UserIcon;
                  if (keyLower.includes("address")) return MapPinIcon;
                  if (keyLower.includes("employment")) return BriefcaseIcon;
                  if (keyLower.includes("payroll")) return CurrencyDollarIcon;
                  if (keyLower.includes("document")) return FolderIcon;
                  return UserIcon; // default
                };
                const IconComponent = getSectionIcon(section.sectionKey);

                return (
                  <Tab.ListItem
                    key={section.sectionKey}
                    className={`
                      px-4 py-3 text-sm font-medium transition-all
                      flex items-center gap-2
                      border-b-2 border-transparent
                      ${
                        isActive
                          ? "text-blue-600 border-blue-600"
                          : "text-gray-500 hover:text-gray-700"
                      }
                    `}
                  >
                    <IconComponent
                      className={`w-4 h-4 ${
                        isActive ? "text-blue-600" : "text-gray-500"
                      }`}
                    />
                    {section.sectionLabel}
                  </Tab.ListItem>
                );
              })}
            </Tab.List>

            <Tab.Panels>
              {config.map((section) => {
                const access = coerceEmployeeAccess(section);
                const canEdit = access === "edit";
                const isDocs = section.sectionKey === "documents";
                const isAddress = section.sectionKey === "address";

                const displaySection = !isDocs
                  ? filterInnersForDisplay(section)
                  : undefined;

                return (
                  <Tab.Panel key={section.sectionKey} className="space-y-8">
                    {isDocs ? (
                      <DocumentsPanel
                        docsDisplaySection={docsDisplaySection || null}
                        docsValues={docsValues}
                        setDocsValues={setDocsValues}
                        docsErrors={docsErrors}
                        selectedDocuments={selectedDocuments}
                        setSelectedDocuments={setSelectedDocuments}
                        activeUploadField={activeUploadField}
                        setActiveUploadField={
                          docsPanelReadOnly
                            ? () => {}
                            : guardedSetActiveUploadField
                        }
                        modalOpen={modalOpen}
                        setModalOpen={
                          docsPanelReadOnly ? () => {} : guardedSetModalOpen
                        }
                        autoSave={
                          docsPanelReadOnly ? async () => {} : docsAutoSave
                        }
                        readOnly={docsPanelReadOnly}
                        employeeId={employee?._id}
                        employeeName={`${
                          employee?.employeeFields?.personaldetails
                            ?.firstName || ""
                        } ${
                          employee?.employeeFields?.personaldetails?.lastName ||
                          ""
                        }`.trim()}
                        onPropagateClick={
                          docsPanelReadOnly
                            ? undefined
                            : (args: {
                                fieldKey: string;
                                fieldLabel?: string;
                                value: any;
                                sectionKey?: string;
                                innerSectionKey?: string;
                              }) => {
                                if (!branchId) return;
                                const innerAcc = getInnerAccess(
                                  args.innerSectionKey
                                );
                                if (innerAcc !== "edit") {
                                  toast.error(
                                    "This document group is read-only."
                                  );
                                  return;
                                }
                                setPropContext({
                                  fieldKey: args.fieldKey,
                                  fieldLabel: args.fieldLabel,
                                  value: args.value,
                                  sectionKey: args.sectionKey,
                                  innerSectionKey: args.innerSectionKey,
                                });
                                setPropModalOpen(true);
                              }
                        }
                      />
                    ) : isAddress ? (
                      <>
                        <div className="flex items-center justify-end mb-4">
                          {canEdit && (
                            <Button
                              size="sm"
                              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() => openDrawerForSection(section)}
                            >
                              Edit
                            </Button>
                          )}
                        </div>

                        {/* View-only address grid */}
                        <div className="space-y-6">
                          {(
                            ((employee?.employeeFields?.address as any[]) || [
                              {},
                            ]) as any[]
                          ).map((addr: any, idx: number) => {
                            // Build full address string
                            const buildFullAddress = (addr: any) => {
                              const parts: string[] = [];

                              // Unit/Flat
                              if (addr?.flatunitnumber) {
                                parts.push(`Unit ${addr.flatunitnumber}`);
                              }

                              // Street number and name
                              const streetParts: string[] = [];
                              if (addr?.streetnumber) {
                                streetParts.push(addr.streetnumber);
                              }
                              if (addr?.streetname) {
                                streetParts.push(addr.streetname);
                              }
                              if (streetParts.length > 0) {
                                parts.push(streetParts.join(" "));
                              }

                              // Suburb/City
                              if (addr?.suburbcity) {
                                parts.push(addr.suburbcity);
                              }

                              // State and ZIP
                              const stateZip: string[] = [];
                              if (addr?.stateterritiory) {
                                stateZip.push(addr.stateterritiory);
                              }
                              if (addr?.zippostalcode) {
                                stateZip.push(addr.zippostalcode);
                              }
                              if (stateZip.length > 0) {
                                parts.push(stateZip.join(" "));
                              }

                              // Country
                              if (addr?.country) {
                                parts.push(addr.country);
                              }

                              return parts.join(", ");
                            };

                            const fullAddress = buildFullAddress(addr);
                            const addressLabel =
                              addr?.addressFor || "Residential Address";

                            return (
                              <div
                                key={idx}
                                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
                              >
                                {/* Header with icon */}
                                <div className="flex items-center gap-3 mb-6">
                                  <HomeIcon className="w-5 h-5 text-blue-600" />
                                  <h4 className="text-lg font-bold text-gray-900">
                                    {addressLabel}
                                  </h4>
                                </div>

                                {/* Address Fields Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 mb-6">
                                  {(section.fields || [])
                                    .filter((f) => f.key !== "addressFor")
                                    .filter((f) =>
                                      passesShowIf(f, (k) => addr?.[k])
                                    )
                                    .map((field) => {
                                      const value = addr?.[field.key];
                                      const isEmpty = !isNonEmpty(value);
                                      const displayValue = isEmpty
                                        ? "Not provided"
                                        : String(value);

                                      return (
                                        <div
                                          key={field.key}
                                          className="space-y-1"
                                        >
                                          <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
                                            {field.label}
                                          </p>
                                          <p
                                            className={`text-sm font-medium ${
                                              isEmpty
                                                ? "text-gray-400 italic"
                                                : "text-gray-900"
                                            }`}
                                          >
                                            {displayValue}
                                          </p>
                                        </div>
                                      );
                                    })}
                                </div>

                                {/* Full Address Display */}
                                {fullAddress && (
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm font-bold text-blue-900 mb-1">
                                      Full Address:
                                    </p>
                                    <p className="text-sm text-blue-800">
                                      {fullAddress}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <SectionPanel
                        section={displaySection!}
                        employee={employee}
                        makeProfileLookup={makeProfileLookup}
                        getValue={getValue}
                        referenceOptions={referenceOptions}
                        readOnly={!canEdit}
                        headerRight={
                          <div className="flex justify-end w-full">
                            {canEdit && (
                              <Button
                                size="sm"
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => openDrawerForSection(section)}
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        }
                        onPropagateClick={
                          canEdit
                            ? (args) => {
                                if (!branchId) return;
                                const innerAcc = getInnerAccessFromSection(
                                  displaySection!,
                                  args.innerSectionKey
                                );
                                if (
                                  args.innerSectionKey &&
                                  innerAcc !== "edit"
                                ) {
                                  toast.error(
                                    "This group is read-only for employees."
                                  );
                                  return;
                                }
                                setPropContext({
                                  fieldKey: args.fieldKey,
                                  fieldLabel: args.fieldLabel,
                                  value: args.value,
                                  sectionKey: args.sectionKey,
                                  innerSectionKey: args.innerSectionKey,
                                });
                                setPropModalOpen(true);
                              }
                            : undefined
                        }
                      />
                    )}
                  </Tab.Panel>
                );
              })}
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
            {editingSection &&
              coerceEmployeeAccess(editingSection) === "edit" && (
                <Button onClick={saveDrawer} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              )}
          </div>
        }
      >
        {editingSection && coerceEmployeeAccess(editingSection) === "edit" ? (
          editingSection.sectionKey === "address" ? (
            <AddressEditor
              section={editingSection}
              addressDraft={addressDraft}
              setAddressDraft={setAddressDraft}
              makeAddressRowLookup={makeAddressRowLookup}
              referenceOptions={referenceOptions}
            />
          ) : (
            <SectionEditGrid
              section={editingSection}
              draft={draft}
              setDraft={setDraft}
              makeDraftLookup={makeDraftLookup}
              referenceOptions={referenceOptions}
            />
          )
        ) : null}
      </EditDrawer>

      {/* Document upload/view modal */}
      {activeUploadField && canEditDocByPath(activeUploadField?.fullPath) && (
        <OrganizationDocumentUploadModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          field={activeUploadField.field}
          fullPath={activeUploadField.fullPath}
          employeeId={employee?._id} // Pass the employee ID
          isEmployeeContext={true} // This is employee context
          formik={{
            values: docsValues,
            setFieldValue: (path: string, val: any) =>
              setDocsValues((prev: any) => {
                const next = deepClone(prev);
                const parts = path.split(".");
                let cur: any = next;
                while (parts.length > 1) {
                  const k = parts.shift() as string;
                  if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
                  cur = cur[k];
                }
                cur[parts[0]] = val;
                return next;
              }),
            setValues: (allVals: any) => {
              setDocsValues(deepClone(allVals ?? { documents: {} }));
            },
          }}
          autoSave={docsAutoSave}
        />
      )}

      {/* Propagation modal */}
      {propContext && branchId && (
        <FieldPropagationModal
          open={propModalOpen}
          onClose={() => {
            setPropModalOpen(false);
            setPropContext(null);
            reset();
          }}
          fieldKey={propContext.fieldKey}
          fieldLabel={propContext.fieldLabel}
          currentBranchId={branchId}
          currentValue={propContext.value}
          preview={preview}
          loading={propLoading}
          onPreview={doPreview}
          onApply={handleApplyPropagation}
        />
      )}
    </div>
  );
}
