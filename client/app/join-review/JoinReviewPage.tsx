// /* eslint-disable react-hooks/rules-of-hooks */
// "use client";

// import React, {
//   useEffect,
//   useMemo,
//   useState,
//   useCallback,
//   startTransition,
// } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Button, Input, Textarea, Checkbox, Select, Tab } from "rizzui";
// import axiosInstance from "@/app/lib/axios";
// import get from "lodash/get";
// import set from "lodash/set";
// import toast from "react-hot-toast";
// import { Card } from "@/app/components/ui/Card";
// import { useFormik } from "formik";

// import DocumentUploadModal from "../components/shared/DocumentUploadModal";
// import FileUploadField from "../components/ui/FileUploadField";
// import DocumentSection from "../components/ui/DocumentSection";
// import ReactDatePicker from "../components/ui/DatePicker";

// import {
//   deepClean,
//   splitProfileAndAdditionalFields,
//   findValueByFieldKeyAnywhere,
//   hasMeaningfulValue,
// } from "@/app/utils/profile-utils";
// import { useDebouncedAutosave } from "@/app/hooks/useDebouncedAutosave";

// // ---------- Access Types ----------
// type EmployeeAccess = "hidden" | "view" | "edit";

// // ---------- Types ----------
// type Field = {
//   key: string;
//   label: string;
//   type:
//     | "text"
//     | "textarea"
//     | "email"
//     | "date"
//     | "number"
//     | "file"
//     | "select"
//     | "checkbox"
//     | "reference";
//   isAdditional?: boolean;
//   placeholder?: string;
//   referenceModel?: string;
//   required?: boolean;
//   options?: string[];
//   showIf?: {
//     fieldKey: string;
//     operator: "equals" | "notEquals";
//     value: any;
//   };
// };

// type InnerSection = {
//   sectionKey: string;
//   sectionLabel: string;
//   requirementMode?: "AND" | "OR";
//   fields: Field[];
//   employeeAccess?: EmployeeAccess; // NEW
// };

// type Section = {
//   sectionKey: string;
//   sectionLabel: string;
//   // legacy booleans that may still come from backend
//   employeerOnlyEditable?: boolean;
//   employerOnlyEditable?: boolean;
//   employeeAccess?: EmployeeAccess; // NEW preferred
//   fields?: Field[];
//   innerSections?: InnerSection[];
// };

// type JoinedConfigResponse = {
//   sections: Section[];
//   tenantName?: string;
//   branchName?: string;
// };

// type ProfileResponse = any;

// // ---------- Access helpers ----------
// function coerceEmployeeAccess(
//   s: Partial<Section | InnerSection> | any
// ): EmployeeAccess {
//   const ea = s?.employeeAccess;
//   if (ea === "hidden" || ea === "view" || ea === "edit") return ea;

//   // Defensive mapping from legacy booleans
//   if (typeof s?.employeerOnlyEditable === "boolean") {
//     return s.employeerOnlyEditable ? "hidden" : "edit";
//   }
//   if (typeof s?.employerOnlyEditable === "boolean") {
//     return s.employerOnlyEditable ? "hidden" : "edit";
//   }
//   return "edit";
// }
// const isEdit = (a: EmployeeAccess) => a === "edit";
// const isHidden = (a: EmployeeAccess) => a === "hidden";

// // ---------- Component ----------
// export default function JoinedCompanyReview() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const branchId = searchParams.get("branchId") as string;
//   const tenantId = searchParams.get("tenantId") as string;

//   // draft key for localStorage
//   const DRAFT_KEY = useMemo(
//     () => `joined-review-draft:${tenantId || "tenant"}:${branchId || "branch"}`,
//     [tenantId, branchId]
//   );

//   // UI + data state
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const [config, setConfig] = useState<JoinedConfigResponse | null>(null);
//   const [sections, setSections] = useState<Section[]>([]);
//   const [profile, setProfile] = useState<ProfileResponse | null>(null);

//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});
//   const [referenceOptions, setReferenceOptions] = useState<
//     Record<string, { label: string; value: string }[]>
//   >({});

//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({});

//   const [saveStatus, setSaveStatus] = useState<
//     "idle" | "saving" | "success" | "error"
//   >("idle");

//   // Document upload modal
//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);
//   const handleOpenModal = (field: any, fullPath: string) => {
//     setActiveUploadField({ field, fullPath });
//     setModalOpen(true);
//   };

//   // Top-level sections visible to employee (exclude "hidden")
//   const visibleSections = useMemo(
//     () => (sections || []).filter((s) => coerceEmployeeAccess(s) !== "hidden"),
//     [sections]
//   );

//   const orgLabel = useMemo(() => {
//     if (!config) return "Organization";
//     if (config.tenantName && config.branchName) {
//       return `${config.tenantName} / ${config.branchName}`;
//     }
//     return config.tenantName || config.branchName || "Organization";
//   }, [config]);

//   // --- Cross-field helpers: index field keys and resolve value globally ---
//   type Occurrence = {
//     sectionKey: string;
//     innerSectionKey?: string | null;
//     type: string; // "file" | "text" | ...
//     isAdditional?: boolean;
//   };

//   const buildFieldKeyIndex = (cfg: Section[]): Record<string, Occurrence[]> => {
//     const map: Record<string, Occurrence[]> = {};
//     for (const section of cfg) {
//       for (const f of section.fields || []) {
//         (map[f.key] ||= []).push({
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           type: f.type,
//           isAdditional: !!f.isAdditional,
//         });
//       }
//       for (const inner of section.innerSections || []) {
//         for (const f of inner.fields || []) {
//           (map[f.key] ||= []).push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             type: f.type,
//             isAdditional: !!f.isAdditional,
//           });
//         }
//       }
//     }
//     return map;
//   };

//   const readExactFromProfile = (
//     prof: any,
//     occ: Occurrence,
//     fieldKey: string
//   ) => {
//     if (occ.isAdditional) {
//       const match = (prof.additionalFields || []).find(
//         (a: any) =>
//           a.sectionKey === occ.sectionKey &&
//           (a.innerSectionKey ?? null) === (occ.innerSectionKey ?? null) &&
//           a.fieldKey === fieldKey
//       );
//       return match?.value;
//     }
//     const path = occ.innerSectionKey
//       ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
//       : `${occ.sectionKey}.${fieldKey}`;
//     return get(prof, path);
//   };

//   const resolveValueForKey = (
//     prof: any,
//     fieldKey: string,
//     occs: Occurrence[]
//   ) => {
//     const candidates: any[] = [];
//     for (const occ of occs) {
//       const v = readExactFromProfile(prof, occ, fieldKey);
//       if (hasMeaningfulValue(v, occ.type)) candidates.push(v);
//     }
//     const addAny = (prof.additionalFields || []).find(
//       (a: any) => a.fieldKey === fieldKey
//     )?.value;
//     if (hasMeaningfulValue(addAny)) candidates.push(addAny);
//     const deep = findValueByFieldKeyAnywhere(prof, fieldKey);
//     if (hasMeaningfulValue(deep)) candidates.push(deep);

//     for (const c of candidates) {
//       if (c && typeof c === "object" && "url" in c && (c as any).url) return c;
//     }
//     for (const c of candidates) {
//       if (typeof c === "string" && c.trim()) return c;
//     }
//     for (const c of candidates) {
//       if (hasMeaningfulValue(c)) return c;
//     }
//     return undefined;
//   };

//   // --- boot data (config + profile) ---
//   useEffect(() => {
//     const boot = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const [{ data: cfgRes }, { data: profRes }] = await Promise.all([
//           axiosInstance.get("/employee-field-config/by-org", {
//             params: { tenantId, branchId },
//           }),
//           axiosInstance.get("/employee-profiles/self/get"),
//         ]);

//         const cfgData = cfgRes?.data || cfgRes;
//         const cfgSectionsRaw: Section[] = cfgData?.sections || [];

//         // normalize access and strip legacy flags
//         const cfgSections: Section[] = cfgSectionsRaw.map((s) => {
//           const copy: Section = {
//             ...s,
//             employeeAccess: coerceEmployeeAccess(s),
//           };
//           if (Array.isArray(copy.innerSections)) {
//             copy.innerSections = copy.innerSections.map((inn) => ({
//               ...inn,
//               employeeAccess: coerceEmployeeAccess(inn),
//             }));
//           }
//           delete (copy as any).employeerOnlyEditable;
//           delete (copy as any).employerOnlyEditable;
//           return copy;
//         });

//         setConfig({
//           sections: cfgSections,
//           tenantName: cfgData?.tenantName,
//           branchName: cfgData?.branchName,
//         });
//         setSections(cfgSections);

//         const prof = profRes?.data || profRes;
//         setProfile(prof);

//         // Build initial values w/ global cross-fill by field key
//         const values: Record<string, any> = {};
//         values["address"] =
//           prof["address"] && Array.isArray(prof["address"])
//             ? prof["address"]
//             : [{}];

//         // pre-seed structure
//         for (const section of cfgSections) {
//           if (section.sectionKey === "address") continue;
//           if (!values[section.sectionKey]) values[section.sectionKey] = {};
//           for (const inner of section.innerSections || []) {
//             if (!values[section.sectionKey][inner.sectionKey]) {
//               values[section.sectionKey][inner.sectionKey] = {};
//             }
//           }
//         }

//         const idx = buildFieldKeyIndex(cfgSections);

//         for (const [fieldKey, occs] of Object.entries(idx)) {
//           const resolved = resolveValueForKey(prof, fieldKey, occs);
//           for (const occ of occs) {
//             const path = occ.innerSectionKey
//               ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
//               : `${occ.sectionKey}.${fieldKey}`;
//             const fallback =
//               occ.type === "checkbox" ? false : occ.type === "file" ? {} : "";
//             set(
//               values,
//               path,
//               hasMeaningfulValue(resolved, occ.type) ? resolved : fallback
//             );
//           }
//         }

//         // Prefill OR-document radio selection
//         const initialSelected: Record<string, string> = {};
//         for (const section of cfgSections) {
//           for (const inner of section.innerSections || []) {
//             if (inner.requirementMode !== "OR") continue;
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const chosen = (inner.fields || []).find((f: any) => {
//               const v = get(values, `${groupPath}.${f.key}`);
//               return (
//                 (typeof v === "string" && !!v) ||
//                 (v && typeof v === "object" && Object.keys(v).length > 0)
//               );
//             });
//             if (chosen) initialSelected[groupPath] = chosen.key;
//           }
//         }

//         setSelectedDocuments(initialSelected);

//         // try load local draft and overlay
//         try {
//           const raw = localStorage.getItem(DRAFT_KEY);
//           if (raw) {
//             const draft = JSON.parse(raw);
//             const draftValues = draft?.values;
//             if (draftValues && typeof draftValues === "object") {
//               setInitialValues({ ...values, ...draftValues });
//             } else {
//               setInitialValues(values);
//             }
//           } else {
//             setInitialValues(values);
//           }
//         } catch {
//           setInitialValues(values);
//         }
//       } catch (e: any) {
//         setError(
//           e?.response?.data?.message || "Unable to load joined company data."
//         );
//       } finally {
//         setLoading(false);
//       }
//     };
//     boot();
//   }, [tenantId, branchId, DRAFT_KEY]);

//   // fetch reference lists used in config
//   useEffect(() => {
//     const loadRef = async () => {
//       const models = new Set<string>();
//       sections.forEach((s) => {
//         (s.fields || []).forEach(
//           (f: any) => f.type === "reference" && models.add(f.referenceModel)
//         );
//         (s.innerSections || []).forEach((inn: any) =>
//           (inn.fields || []).forEach(
//             (f: any) => f.type === "reference" && models.add(f.referenceModel)
//           )
//         );
//       });
//       await Promise.all(
//         Array.from(models).map(async (m) => {
//           try {
//             const res = await axiosInstance.get(`/${m.toLowerCase()}s`);
//             const data = res.data?.data || [];
//             const opts = data.map((item: any) => ({
//               label:
//                 m === "Employee"
//                   ? item?.employeeProfile?.personaldetails?.firstname ||
//                     "Unnamed"
//                   : item?.name || "Unnamed",
//               value: item._id,
//             }));
//             setReferenceOptions((prev) => ({ ...prev, [m]: opts }));
//           } catch (e) {
//             console.error(`Failed to fetch ${m}`, e);
//           }
//         })
//       );
//     };
//     if (sections.length) loadRef();
//   }, [sections]);

//   // ---------- Autosave → Local draft ----------
//   const rawAutoSave = useCallback(
//     async (values: any) => {
//       try {
//         setSaveStatus("saving");
//         const cleaned = deepClean(values);
//         const draft = {
//           values: cleaned,
//           updatedAt: new Date().toISOString(),
//           tenantId,
//           branchId,
//         };
//         localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
//         setSaveStatus("success"); // Draft saved
//       } catch (e) {
//         console.error("Draft save error", e);
//         setSaveStatus("error");
//         toast.error("Failed to save draft locally.");
//       }
//     },
//     [DRAFT_KEY, tenantId, branchId]
//   );
//   const autoSave = useDebouncedAutosave(rawAutoSave, 700);

//   // ---------- Form ----------
//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     validate: (values) => {
//       const evalShowIf = (field: any) => {
//         if (!field.showIf) return true;
//         const findValue = (obj: any, key: string): any => {
//           if (!obj || typeof obj !== "object") return undefined;
//           if (key in obj) return obj[key];
//           for (const k of Object.keys(obj)) {
//             const found = findValue(obj[k], key);
//             if (found !== undefined) return found;
//           }
//           return undefined;
//         };
//         const actual = findValue(values, field.showIf.fieldKey);
//         return field.showIf.operator === "equals"
//           ? actual === field.showIf.value
//           : actual !== field.showIf.value;
//       };

//       const errors: any = {};
//       for (const section of visibleSections) {
//         const sectionAccess = coerceEmployeeAccess(section);
//         const canEditSection = isEdit(sectionAccess);

//         if (canEditSection) {
//           for (const field of section.fields || []) {
//             if (!evalShowIf(field)) continue;
//             const path = `${section.sectionKey}.${field.key}`;
//             const val = get(values, path);
//             if (field.required) {
//               if (field.type === "checkbox") {
//                 if (!val) set(errors, path, "This field is required.");
//               } else if (field.type === "file") {
//                 if (!val?.url) set(errors, path, "Please upload a file.");
//               } else if (field.type === "date") {
//                 if (!val) set(errors, path, "Please select a date.");
//               } else if (
//                 field.type === "select" ||
//                 field.type === "reference"
//               ) {
//                 if (!val) set(errors, path, "Please select an option.");
//               } else if (!val && val !== 0) {
//                 set(errors, path, "This field is required.");
//               }
//             }
//           }
//         }

//         for (const inner of section.innerSections || []) {
//           const innerAccess = coerceEmployeeAccess(inner);
//           if (isHidden(innerAccess)) continue;
//           const canEditInner = isEdit(innerAccess);

//           if (!canEditInner) continue;

//           const mode = inner.requirementMode || "AND";
//           if (mode === "AND") {
//             for (const field of inner.fields || []) {
//               if (!evalShowIf(field)) continue;
//               if (field.type !== "file") continue;
//               if (!field.required) continue;
//               const path = `${section.sectionKey}.${inner.sectionKey}.${field.key}`;
//               const val = get(values, path);
//               if (!val?.url) {
//                 set(errors, path, "Please upload a file.");
//               }
//             }
//           } else {
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const chosenKey = selectedDocuments[groupPath];
//             if (!chosenKey) {
//               set(errors, groupPath, "Select one document to provide.");
//             } else {
//               inner.fields.forEach((f: any) => {
//                 if (f.key !== chosenKey) return;
//                 const path = `${groupPath}.${f.key}`;
//                 const val = get(values, path);
//                 if (f.type === "file" && !val?.url) {
//                   set(errors, path, "Please upload the selected document.");
//                 }
//               });
//             }
//           }
//         }
//       }
//       return errors;
//     },
//     onSubmit: () => {},
//   });

//   // showIf evaluator for RENDER
//   const evaluateShowIfRender = useCallback(
//     (field: any) => {
//       if (!field.showIf) return true;
//       const findValue = (obj: any, key: string): any => {
//         if (!obj || typeof obj !== "object") return undefined;
//         if (key in obj) return obj[key];
//         for (const k of Object.keys(obj)) {
//           const found = findValue(obj[k], key);
//           if (found !== undefined) return found;
//         }
//         return undefined;
//       };
//       const actual = findValue(formik.values, field.showIf.fieldKey);
//       return field.showIf.operator === "equals"
//         ? actual === field.showIf.value
//         : actual !== field.showIf.value;
//     },
//     [formik.values]
//   );

//   // ---------- Address UI (edit/view) ----------
//   const renderAddressSection = (fields: any[], readOnly: boolean) => {
//     const addresses = formik.values.address || [];

//     const handleAdd = () => {
//       if (readOnly) return;
//       const newList = [...addresses, {}];
//       formik.setFieldValue("address", newList);
//       autoSave({ ...formik.values, address: newList });
//     };

//     const handleRemove = (i: number) => {
//       if (readOnly) return;
//       const newList = addresses.filter((_: any, idx: number) => idx !== i);
//       formik.setFieldValue("address", newList);
//       autoSave({ ...formik.values, address: newList });
//     };

//     return (
//       <div className="space-y-6">
//         {addresses.map((address: any, index: number) => {
//           return (
//             <Card
//               key={index}
//               className="relative border border-gray-200 shadow-md p-0 overflow-hidden"
//             >
//               <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
//                 <div className="w-full px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 shadow-sm">
//                   <div className="relative">
//                     <input
//                       type="text"
//                       id={`addressFor-${index}`}
//                       className="peer block w-full px-4 pt-5 pb-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-transparent disabled:bg-gray-50 disabled:text-gray-500"
//                       placeholder="e.g., Home, Office"
//                       value={address?.addressFor || ""}
//                       onChange={(e) => {
//                         if (readOnly) return;
//                         const updated = [...addresses];
//                         updated[index] = {
//                           ...updated[index],
//                           addressFor: e.target.value,
//                         };
//                         formik.setFieldValue("address", updated);
//                       }}
//                       onBlur={() => {
//                         if (readOnly) return;
//                         const updated = [...addresses];
//                         updated[index] = {
//                           ...updated[index],
//                           addressFor: addresses[index]?.addressFor || "",
//                         };
//                         formik.setFieldValue("address", updated);
//                         autoSave({ ...formik.values, address: updated });
//                       }}
//                       disabled={readOnly}
//                     />
//                     <label
//                       htmlFor={`addressFor-${index}`}
//                       className="absolute left-4 top-2 text-xs font-semibold text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold"
//                     >
//                       Address Label (e.g., Home, Office)
//                     </label>
//                   </div>
//                 </div>

//                 {addresses.length > 1 && !readOnly && (
//                   <button
//                     type="button"
//                     onClick={() => handleRemove(index)}
//                     className="ml-4 text-red-500 hover:text-red-600 text-xs"
//                   >
//                     Remove
//                   </button>
//                 )}
//               </div>

//               <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {fields
//                   .filter((f: any) => f.key !== "addressFor")
//                   .map((field: any) => (
//                     <Input
//                       key={`address[${index}].${field.key}`}
//                       label={field.label}
//                       placeholder={field.placeholder}
//                       value={formik.values.address[index]?.[field.key] || ""}
//                       onChange={(e) => {
//                         if (readOnly) return;
//                         const newAddresses = [...addresses];
//                         newAddresses[index] = {
//                           ...newAddresses[index],
//                           [field.key]: e.target.value,
//                         };
//                         formik.setFieldValue("address", newAddresses);
//                       }}
//                       onBlur={() => {
//                         if (readOnly) return;
//                         formik.setFieldTouched(
//                           `address[${index}].${field.key}`,
//                           true
//                         );
//                         autoSave(formik.values);
//                       }}
//                       disabled={readOnly}
//                     />
//                   ))}
//               </div>
//             </Card>
//           );
//         })}
//         {!readOnly && (
//           <Button variant="outline" onClick={handleAdd}>
//             + Add Address
//           </Button>
//         )}
//       </div>
//     );
//   };

//   // ---------- Field renderer (edit/view) ----------
//   const renderField = useCallback(
//     (field: any, pathPrefix: string, readOnly: boolean) => {
//       if (!evaluateShowIfRender(field)) return null;

//       const fullPath = `${pathPrefix}.${field.key}`;
//       const value = get(formik.values, fullPath);
//       const error = get(formik.errors, fullPath);
//       const touched = get(formik.touched, fullPath);
//       const showError = Boolean(touched && error);

//       const Label = (
//         <>
//           {field.label}
//           {field.required && <span className="text-red-500 ml-1">*</span>}
//         </>
//       );

//       const doAutoSave = () => {
//         if (!readOnly) autoSave(formik.values);
//       };

//       switch (field.type) {
//         case "text":
//         case "email":
//           return (
//             <div key={fullPath}>
//               <Input
//                 type={field.type}
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value || ""}
//                 onChange={(e) =>
//                   !readOnly && formik.setFieldValue(fullPath, e.target.value)
//                 }
//                 onBlur={doAutoSave}
//                 disabled={readOnly}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "textarea":
//           return (
//             <div key={fullPath}>
//               <Textarea
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value || ""}
//                 onChange={(e) =>
//                   !readOnly && formik.setFieldValue(fullPath, e.target.value)
//                 }
//                 onBlur={doAutoSave}
//                 disabled={readOnly}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "checkbox":
//           return (
//             <div key={fullPath}>
//               <Checkbox
//                 label={Label}
//                 checked={!!value}
//                 onChange={(e) =>
//                   !readOnly && formik.setFieldValue(fullPath, e.target.checked)
//                 }
//                 onBlur={doAutoSave}
//                 disabled={readOnly}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "date": {
//           return (
//             <div key={fullPath} className="space-y-1">
//               <label className="text-sm font-medium text-gray-700">
//                 {Label}
//               </label>
//               <ReactDatePicker
//                 selected={value ? new Date(value) : null}
//                 dateFormat="dd/MM/yyyy"
//                 onChange={(val) => {
//                   if (readOnly) return;
//                   const iso = val ? val.toISOString() : null;
//                   formik.setFieldValue(fullPath, iso);
//                   const updated = { ...formik.values };
//                   set(updated, fullPath, iso);
//                   autoSave(updated);
//                 }}
//                 inputProps={{
//                   placeholder: field.placeholder,
//                   disabled: readOnly,
//                 }}
//                 onBlur={() =>
//                   !readOnly && formik.setFieldTouched(fullPath, true)
//                 }
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         }
//         case "number":
//           return (
//             <div key={fullPath}>
//               <Input
//                 type="number"
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value ?? ""}
//                 onChange={(e) =>
//                   !readOnly && formik.setFieldValue(fullPath, e.target.value)
//                 }
//                 onBlur={doAutoSave}
//                 disabled={readOnly}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "select":
//           return (
//             <div key={fullPath}>
//               <Select
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={
//                   (field.options || [])
//                     .map((o: string) => ({ label: o, value: o }))
//                     .find((opt: any) => opt.value === value) || null
//                 }
//                 onChange={(opt: any) =>
//                   !readOnly && formik.setFieldValue(fullPath, opt?.value || "")
//                 }
//                 options={(field.options || []).map((o: string) => ({
//                   label: o,
//                   value: o,
//                 }))}
//                 onBlur={doAutoSave}
//                 disabled={readOnly}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "reference": {
//           const opts =
//             referenceOptions[(field as any).referenceModel as string] || [];
//           return (
//             <div key={fullPath}>
//               <Select
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={
//                   opts.find(
//                     (opt) =>
//                       String(opt.value) ===
//                       String(typeof value === "object" ? value?._id : value)
//                   ) || null
//                 }
//                 onChange={(opt: any) => {
//                   if (readOnly) return;
//                   const id = opt?.value || "";
//                   formik.setFieldValue(fullPath, id);
//                   const updated = { ...formik.values };
//                   set(updated, fullPath, id);
//                   autoSave(updated);
//                 }}
//                 options={opts}
//                 onBlur={() =>
//                   !readOnly && formik.setFieldTouched(fullPath, true)
//                 }
//                 disabled={readOnly}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         }
//         case "file": {
//           if (readOnly) {
//             const hasFile =
//               value && typeof value === "object" && (value.url || value.name);
//             return (
//               <div key={fullPath} className="space-y-1">
//                 <label className="text-sm font-medium text-gray-700">
//                   {Label}
//                 </label>
//                 <div className="text-sm rounded-md border p-3 bg-gray-50 text-gray-600">
//                   {hasFile ? (
//                     <div className="space-y-1">
//                       {value.url ? (
//                         <a
//                           href={value.url}
//                           target="_blank"
//                           rel="noreferrer"
//                           className="underline"
//                         >
//                           {value.name || "View file"}
//                         </a>
//                       ) : (
//                         <span>{value.name || "File uploaded"}</span>
//                       )}
//                     </div>
//                   ) : (
//                     <span className="italic text-gray-400">No file</span>
//                   )}
//                 </div>
//               </div>
//             );
//           }
//           return (
//             <FileUploadField
//               key={fullPath}
//               field={field}
//               fullPath={fullPath}
//               value={value}
//               formik={formik}
//               autoSave={autoSave}
//             />
//           );
//         }
//         default:
//           return null;
//       }
//     },
//     [referenceOptions, formik, autoSave, evaluateShowIfRender]
//   );

//   // ---------- Continue (submit to backend + clear draft) ----------
//   const handleContinue = async () => {
//     try {
//       setSaveStatus("saving");
//       const cleaned = deepClean(formik.values);

//       const { profileUpdates, additionalFields } =
//         splitProfileAndAdditionalFields(cleaned, sections);

//       await axiosInstance.put(`/employees/me/employee-fields/${branchId}`, {
//         employeeFields: {
//           ...profileUpdates,
//           additionalFields: additionalFields ?? [],
//         },
//       });

//       // clear local draft after successful submit
//       try {
//         localStorage.removeItem(DRAFT_KEY);
//       } catch {}

//       toast.success("Profile updated");
//       setSaveStatus("success");
//       startTransition(() => router.push("/nexus-profile"));
//     } catch (e: any) {
//       console.error(e);
//       setSaveStatus("error");
//       toast.error(e?.response?.data?.message || "Failed to continue.");
//     }
//   };

//   // ---------- Render ----------
//   if (loading) {
//     return (
//       <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//         <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
//           <div className="h-28 sm:h-32 bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 rounded-xl" />
//           <div className="animate-pulse space-y-4">
//             <div className="h-6 w-48 bg-gray-200 rounded" />
//             <div className="h-4 w-72 bg-gray-200 rounded" />
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {[...Array(6)].map((_, i) => (
//                 <div key={i} className="h-16 bg-gray-100 rounded-xl" />
//               ))}
//             </div>
//           </div>
//         </Card>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="max-w-md mx-auto py-16 px-6">
//         <div className="rounded-2xl border border-red-200 bg-white shadow">
//           <div className="p-5 border-b border-red-100 bg-rose-50 rounded-t-2xl">
//             <h2 className="text-red-700 font-semibold">
//               Couldn’t load details
//             </h2>
//           </div>
//           <div className="p-5 text-sm text-gray-700">{error}</div>
//           <div className="p-5 pt-0">
//             <button
//               onClick={() => router.refresh()}
//               className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
//             >
//               Try again
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
//         {/* Header row */}
//         <div className="flex items-center justify-between flex-wrap gap-2">
//           <div>
//             <h2 className="text-xl font-semibold text-gray-900">
//               Joined Company
//             </h2>
//             {orgLabel ? (
//               <p className="text-sm text-gray-500 mt-1">
//                 Organization: {orgLabel}
//               </p>
//             ) : null}
//           </div>

//           <div
//             className={[
//               "text-xs px-3 py-1.5 rounded-full border shadow-sm",
//               saveStatus === "saving" &&
//                 "border-blue-200 bg-blue-50 text-blue-700",
//               saveStatus === "success" &&
//                 "border-green-200 bg-green-50 text-green-700",
//               saveStatus === "error" && "border-red-200 bg-red-50 text-red-700",
//               saveStatus === "idle" &&
//                 "border-gray-200 bg-gray-50 text-gray-600",
//             ]
//               .filter(Boolean)
//               .join(" ")}
//           >
//             {saveStatus === "saving" && "💾 Saving…"}
//             {saveStatus === "success" && "✅ Draft saved"}
//             {saveStatus === "error" && "⚠️ Save error"}
//             {saveStatus === "idle" && "Autosave (local draft)"}
//           </div>
//         </div>

//         {/* Editable form */}
//         <form
//           onSubmit={formik.handleSubmit}
//           className="space-y-6"
//           id="joinedReviewForm"
//         >
//           <Tab>
//             <Tab.List className="gap-2 border-b pb-2 mb-4">
//               {visibleSections.map((section) => (
//                 <Tab.ListItem
//                   key={section.sectionKey}
//                   className="text-sm font-medium px-4 py-2 rounded-md"
//                 >
//                   {section.sectionLabel}
//                 </Tab.ListItem>
//               ))}
//             </Tab.List>

//             <Tab.Panels>
//               {visibleSections.map((section) => {
//                 const sectionAccess = coerceEmployeeAccess(section);
//                 const readOnlySection = !isEdit(sectionAccess);

//                 const renderInner = (inner: InnerSection) => {
//                   const innerAccess = coerceEmployeeAccess(inner);
//                   if (isHidden(innerAccess)) return null;
//                   const readOnlyInner = !isEdit(innerAccess);

//                   const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//                   const groupError = get(formik.errors, groupPath);

//                   const guardedSetSelected = (updater: any) => {
//                     if (readOnlyInner || readOnlySection) return;
//                     setSelectedDocuments(updater);
//                   };

//                   return (
//                     <div
//                       key={inner.sectionKey}
//                       className="mt-8 border-t border-gray-200 pt-6"
//                     >
//                       <h4 className="text-base font-medium text-gray-700 mb-4">
//                         {inner.sectionLabel}
//                         {(readOnlyInner || readOnlySection) && (
//                           <span className="ml-2 text-xs text-gray-500">
//                             (view only)
//                           </span>
//                         )}
//                       </h4>

//                       {typeof groupError === "string" &&
//                         isEdit(sectionAccess) &&
//                         isEdit(innerAccess) && (
//                           <div className="text-sm text-red-500 mb-3">
//                             {groupError}
//                           </div>
//                         )}

//                       {section.sectionKey === "documents" ? (
//                         <DocumentSection
//                           inner={inner}
//                           sectionKeyPath={groupPath}
//                           selectedDocuments={selectedDocuments}
//                           setSelectedDocuments={
//                             readOnlyInner || readOnlySection
//                               ? () => {}
//                               : guardedSetSelected
//                           }
//                           formik={formik}
//                           onOpenModal={
//                             readOnlyInner || readOnlySection
//                               ? () => {}
//                               : handleOpenModal
//                           }
//                         />
//                       ) : (
//                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                           {(inner.fields || []).map((field: any) =>
//                             renderField(
//                               field,
//                               groupPath,
//                               readOnlyInner || readOnlySection
//                             )
//                           )}
//                         </div>
//                       )}
//                     </div>
//                   );
//                 };

//                 return (
//                   <Tab.Panel key={section.sectionKey}>
//                     {section.sectionKey === "address" ? (
//                       renderAddressSection(
//                         section.fields || [],
//                         readOnlySection
//                       )
//                     ) : (
//                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                         {(section.fields || []).map((field: any) =>
//                           renderField(
//                             field,
//                             section.sectionKey,
//                             readOnlySection
//                           )
//                         )}
//                       </div>
//                     )}

//                     {(section.innerSections || [])
//                       .filter((inn) => coerceEmployeeAccess(inn) !== "hidden")
//                       .map(renderInner)}
//                   </Tab.Panel>
//                 );
//               })}
//             </Tab.Panels>
//           </Tab>
//         </form>
//       </Card>

//       {/* Fixed bottom action bar */}
//       <div className="fixed inset-x-0 bottom-0 z-40">
//         <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
//           <div className="relative">
//             <div className="absolute inset-0 -top-2 blur-xl bg-gradient-to-r from-indigo-400/20 via-fuchsia-400/20 to-sky-400/20 pointer-events-none" />
//             <div className="relative flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur px-4 sm:px-6 py-3 shadow-lg shadow-gray-200/50">
//               <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
//                 Review and edit your details. Changes are saved as a local
//                 draft.
//               </div>
//               <div className="flex items-center gap-3">
//                 {saveStatus === "saving" && (
//                   <span className="text-xs sm:text-sm text-blue-600">
//                     Saving…
//                   </span>
//                 )}
//                 <Button
//                   type="button"
//                   onClick={handleContinue}
//                   className="inline-flex items-center justify-center gap-2 rounded-xl px-5 sm:px-6 py-2.5
//                     bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600
//                     text-white shadow-md hover:shadow-lg transition
//                     hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700
//                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
//                 >
//                   <span className="text-sm font-semibold">Continue</span>
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </div>
//         <div className="h-[env(safe-area-inset-bottom)]" />
//       </div>

//       {/* Document modal (will only open when allowed) */}
//       {activeUploadField && (
//         <DocumentUploadModal
//           isOpen={modalOpen}
//           onClose={() => setModalOpen(false)}
//           field={activeUploadField.field}
//           fullPath={activeUploadField.fullPath}
//           formik={formik}
//           autoSave={autoSave}
//         />
//       )}
//     </div>
//   );
// }
// -------------------------------------------------------

/* eslint-disable react-hooks/rules-of-hooks */
"use client";

import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  startTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input, Textarea, Checkbox, Select } from "rizzui";
import Image from "next/image";
import axiosInstance from "@/app/lib/axios";
import get from "lodash/get";
import set from "lodash/set";
import toast from "react-hot-toast";
import { Card } from "@/app/components/ui/Card";
import { useFormik } from "formik";

import DocumentUploadModal from "../components/shared/DocumentUploadModal";
import FileUploadField from "../components/ui/FileUploadField";
import DocumentSection from "../components/ui/DocumentSection";
import ReactDatePicker from "../components/ui/DatePicker";
import { PhoneInput } from "../components/shared/PhoneInput";
import { COUNTRIES } from "@/app/utils/countries";

import {
  deepClean,
  splitProfileAndAdditionalFields,
  findValueByFieldKeyAnywhere,
  hasMeaningfulValue,
} from "@/app/utils/profile-utils";
import {
  buildDocsValuesFromEmployee,
  mergeAdditionalDocFieldsIntoConfig,
} from "@/app/utils/docs-helpers";

/* ----------------- Access Types ------------------ */
type EmployeeAccess = "hidden" | "view" | "edit";

/* ----------------- Types ------------------ */
type Field = {
  key: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "email"
    | "date"
    | "number"
    | "file"
    | "select"
    | "checkbox"
    | "reference"
    | "phone"
    | "tel";
  isAdditional?: boolean;
  placeholder?: string;
  referenceModel?: string;
  required?: boolean;
  options?: string[];
  showIf?: {
    fieldKey: string;
    operator: "equals" | "notEquals";
    value: any;
  };
};

type InnerSection = {
  sectionKey: string;
  sectionLabel: string;
  requirementMode?: "AND" | "OR";
  fields: Field[];
  employeeAccess?: EmployeeAccess;
};

type Section = {
  sectionKey: string;
  sectionLabel: string;
  // legacy
  employeerOnlyEditable?: boolean;
  employerOnlyEditable?: boolean;
  // preferred
  employeeAccess?: EmployeeAccess;
  fields?: Field[];
  innerSections?: InnerSection[];
};

type JoinedConfigResponse = {
  sections: Section[];
  tenantName?: string;
  branchName?: string;
};

type ProfileResponse = any;

/* ----------------- Access helpers ------------------ */
function coerceEmployeeAccess(
  s: Partial<Section | InnerSection> | any
): EmployeeAccess {
  const ea = s?.employeeAccess;
  if (ea === "hidden" || ea === "view" || ea === "edit") return ea;
  if (typeof s?.employeerOnlyEditable === "boolean") {
    return s.employeerOnlyEditable ? "hidden" : "edit";
  }
  if (typeof s?.employerOnlyEditable === "boolean") {
    return s.employerOnlyEditable ? "hidden" : "edit";
  }
  return "edit";
}
const isEdit = (a: EmployeeAccess) => a === "edit";
const isHidden = (a: EmployeeAccess) => a === "hidden";

/* ----------------- Pretty Stepper UI ------------------ */
/** Lightweight stepper built with RizzUI primitives + Tailwind */
function StepperHeader({
  steps,
  current,
  onStepClick,
}: {
  steps: { key: string; label: string }[];
  current: number;
  onStepClick?: (i: number) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        {/* line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gray-200" />
        {/* progress */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 transition-all"
          style={{
            width:
              steps.length > 1
                ? `${(current / (steps.length - 1)) * 100}%`
                : "0%",
          }}
        />
        {steps.map((s, i) => {
          const active = i === current;
          const done = i < current;
          return (
            <button
              key={s.key}
              type="button"
              disabled={!onStepClick}
              onClick={() => onStepClick?.(i)}
              className="relative z-10 flex flex-col items-center max-w-[160px] mx-1 group"
              title={s.label}
            >
              <div
                className={[
                  "flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold shadow-sm",
                  done
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white border-transparent"
                    : active
                      ? "bg-white text-indigo-700 border-indigo-300"
                      : "bg-white text-gray-500 border-gray-200",
                  "group-hover:shadow",
                ].join(" ")}
              >
                {done ? "✓" : i + 1}
              </div>
              <div
                className={[
                  "mt-2 text-xs font-medium text-center px-2",
                  active ? "text-gray-900" : "text-gray-500",
                ].join(" ")}
              >
                {s.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------- Component ------------------ */
export default function JoinedCompanyReview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const branchId = searchParams.get("branchId") as string;
  const tenantId = searchParams.get("tenantId") as string;

  // UI + data state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<JoinedConfigResponse | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);

  const [initialValues, setInitialValues] = useState<Record<string, any>>({});
  const [referenceOptions, setReferenceOptions] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  const [selectedDocuments, setSelectedDocuments] = useState<
    Record<string, string>
  >({});

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");

  // stepper
  const [currentStep, setCurrentStep] = useState(0);

  // Branch details for logo and name
  const [branchName, setBranchName] = useState<string | null>(null);
  const [logoFileId, setLogoFileId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Document upload modal
  const [modalOpen, setModalOpen] = useState(false);
  const [activeUploadField, setActiveUploadField] = useState<any>(null);
  const handleOpenModal = (field: any, fullPath: string) => {
    setActiveUploadField({ field, fullPath });
    setModalOpen(true);
  };

  // Visible (exclude hidden and view - only show edit sections)
  const visibleSections = useMemo(
    () =>
      (sections || []).filter((s) => {
        const access = coerceEmployeeAccess(s);
        return access !== "hidden" && access !== "view";
      }),
    [sections]
  );
  const activeSection = visibleSections[currentStep];

  const orgLabel = useMemo(() => {
    if (branchName) return branchName;
    return "Organization";
  }, [branchName]);

  /* ---------- Cross-field helpers ---------- */
  type Occurrence = {
    sectionKey: string;
    innerSectionKey?: string | null;
    type: string;
    isAdditional?: boolean;
  };

  const buildFieldKeyIndex = (cfg: Section[]): Record<string, Occurrence[]> => {
    const map: Record<string, Occurrence[]> = {};
    for (const section of cfg) {
      for (const f of section.fields || []) {
        (map[f.key] ||= []).push({
          sectionKey: section.sectionKey,
          innerSectionKey: null,
          type: f.type,
          isAdditional: !!f.isAdditional,
        });
      }
      for (const inner of section.innerSections || []) {
        for (const f of inner.fields || []) {
          (map[f.key] ||= []).push({
            sectionKey: section.sectionKey,
            innerSectionKey: inner.sectionKey,
            type: f.type,
            isAdditional: !!f.isAdditional,
          });
        }
      }
    }
    return map;
  };

  const readExactFromProfile = (
    prof: any,
    occ: Occurrence,
    fieldKey: string
  ) => {
    if (occ.isAdditional) {
      const match = (prof.additionalFields || []).find(
        (a: any) =>
          a.sectionKey === occ.sectionKey &&
          (a.innerSectionKey ?? null) === (occ.innerSectionKey ?? null) &&
          a.fieldKey === fieldKey
      );
      return match?.value;
    }
    const path = occ.innerSectionKey
      ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
      : `${occ.sectionKey}.${fieldKey}`;
    return get(prof, path);
  };

  const resolveValueForKey = (
    prof: any,
    fieldKey: string,
    occs: Occurrence[]
  ) => {
    const candidates: any[] = [];
    for (const occ of occs) {
      const v = readExactFromProfile(prof, occ, fieldKey);
      if (hasMeaningfulValue(v, occ.type)) candidates.push(v);
    }
    const addAny = (prof.additionalFields || []).find(
      (a: any) => a.fieldKey === fieldKey
    )?.value;
    if (hasMeaningfulValue(addAny)) candidates.push(addAny);
    const deep = findValueByFieldKeyAnywhere(prof, fieldKey);
    if (hasMeaningfulValue(deep)) candidates.push(deep);

    for (const c of candidates) {
      if (c && typeof c === "object" && (c as any).url) return c;
    }
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c;
    }
    for (const c of candidates) {
      if (hasMeaningfulValue(c)) return c;
    }
    return undefined;
  };

  /* ---------- Boot (config + profile) ---------- */
  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch config and employee data (which includes documents)
        // Add cache-busting to ensure we get fresh data for the current user
        const [{ data: cfgRes }, { data: orgFieldsRes }] = await Promise.all([
          axiosInstance.get(`/employee-field-config/my/${branchId}`, {
            params: { _t: Date.now() }, // Cache busting
          }),
          axiosInstance.get(`/employees/me/org-fields/${branchId}`, {
            params: { _t: Date.now() }, // Cache busting
          }),
        ]);

        const cfgData = cfgRes?.data || cfgRes;
        const cfgSectionsRaw: Section[] = cfgData?.sections || [];

        const cfgSections: Section[] = cfgSectionsRaw.map((s) => {
          const copy: Section = {
            ...s,
            employeeAccess: coerceEmployeeAccess(s),
          };
          if (Array.isArray(copy.innerSections)) {
            copy.innerSections = copy.innerSections.map((inn) => ({
              ...inn,
              employeeAccess: coerceEmployeeAccess(inn),
            }));
          }
          delete (copy as any).employeerOnlyEditable;
          delete (copy as any).employerOnlyEditable;
          return copy;
        });

        // Merge additional document fields into config
        const docsConfigSection = cfgSections.find(
          (s) => s.sectionKey === "documents"
        );
        const mergedDocsConfig = mergeAdditionalDocFieldsIntoConfig(
          docsConfigSection || null,
          orgFieldsRes?.data?.employee || orgFieldsRes?.employee || null
        );

        if (mergedDocsConfig && docsConfigSection) {
          // Replace the documents section with merged version
          const index = cfgSections.indexOf(docsConfigSection);
          cfgSections[index] = mergedDocsConfig;
        }

        setConfig({
          sections: cfgSections,
        });
        setSections(cfgSections);

        // Get employee data (includes employeeFields.documents)
        const employeeData =
          orgFieldsRes?.data?.employee || orgFieldsRes?.employee || null;
        setProfile(employeeData);

        // Build initial values w/ cross-fill
        const values: Record<string, any> = {};

        // Handle documents section using the same helper as working page
        const documentsData = buildDocsValuesFromEmployee(employeeData);
        values["documents"] = documentsData;

        // Handle address field from employeeFields
        const addressFromFields = employeeData?.employeeFields?.address;
        values["address"] =
          addressFromFields && Array.isArray(addressFromFields)
            ? addressFromFields
            : employeeData?.address && Array.isArray(employeeData?.address)
              ? employeeData.address
              : [{}];

        for (const section of cfgSections) {
          if (
            section.sectionKey === "address" ||
            section.sectionKey === "documents"
          )
            continue;
          if (!values[section.sectionKey]) values[section.sectionKey] = {};
          for (const inner of section.innerSections || []) {
            // Skip view and hidden inner sections
            const innerAccess = coerceEmployeeAccess(inner);
            if (innerAccess === "hidden" || innerAccess === "view") continue;
            if (!values[section.sectionKey][inner.sectionKey]) {
              values[section.sectionKey][inner.sectionKey] = {};
            }
          }
        }

        const idx = buildFieldKeyIndex(cfgSections);
        for (const [fieldKey, occs] of Object.entries(idx)) {
          const resolved = resolveValueForKey(employeeData, fieldKey, occs);
          for (const occ of occs) {
            const path = occ.innerSectionKey
              ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
              : `${occ.sectionKey}.${fieldKey}`;
            const fallback =
              occ.type === "checkbox" ? false : occ.type === "file" ? {} : "";
            set(
              values,
              path,
              hasMeaningfulValue(resolved, occ.type) ? resolved : fallback
            );
          }
        }

        // Prefill OR-document choice
        const initialSelected: Record<string, string> = {};
        for (const section of cfgSections) {
          for (const inner of section.innerSections || []) {
            // Skip view and hidden inner sections
            const innerAccess = coerceEmployeeAccess(inner);
            if (innerAccess === "hidden" || innerAccess === "view") continue;
            if (inner.requirementMode !== "OR") continue;
            const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
            const chosen = (inner.fields || []).find((f: any) => {
              const v = get(values, `${groupPath}.${f.key}`);
              return (
                (typeof v === "string" && !!v) ||
                (v && typeof v === "object" && Object.keys(v).length > 0)
              );
            });
            if (chosen) initialSelected[groupPath] = chosen.key;
          }
        }
        setSelectedDocuments(initialSelected);

        // Set initial values from server data
        setInitialValues(values);

        // reset step back to first
        setCurrentStep(0);
      } catch (e: any) {
        setError(
          e?.response?.data?.message || "Unable to load joined company data."
        );
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [tenantId, branchId]);

  /* ---------- Fetch branch details for logo and name ---------- */
  useEffect(() => {
    const fetchBranchDetails = async () => {
      if (!branchId) return;

      try {
        const res = await axiosInstance.get(`/branches/${branchId}/details`);
        const data = res.data.data;

        // Set branch name
        if (data.name) {
          setBranchName(data.name);
        }

        // Handle logo - could be URL string, fileId string, or { fileId, key } object
        if (data.logo) {
          if (typeof data.logo === "string") {
            // Check if it's a fileId (ObjectId format) or a URL
            const isObjectId = /^[0-9a-fA-F]{24}$/.test(data.logo);
            if (isObjectId) {
              // It's a fileId stored as string
              setLogoFileId(data.logo);
            } else {
              // It's a regular URL string
              setLogoUrl(data.logo);
              setLogoFileId(null);
            }
          } else if (data.logo?.fileId) {
            // If it's an object with fileId
            const fileId = String(data.logo.fileId);
            setLogoFileId(fileId);
          }
        } else {
          setLogoFileId(null);
          setLogoUrl(null);
        }
      } catch (error) {
        console.error("Failed to fetch branch details", error);
      }
    };

    void fetchBranchDetails();
  }, [branchId]);

  /* ---------- Fetch signed URL for logo ---------- */
  useEffect(() => {
    if (!logoFileId) {
      setLogoUrl(null);
      return;
    }

    const fetchSignedUrl = async () => {
      try {
        const urlRes = await axiosInstance.get<{
          url: string;
          expiresIn: number;
        }>(`/uploads/${logoFileId}/url`);
        setLogoUrl(urlRes.data?.url || null);
      } catch (error) {
        console.error("Failed to fetch logo signed URL", error);
        setLogoUrl(null);
      }
    };

    void fetchSignedUrl();
  }, [logoFileId]);

  /* ---------- Reference lists ---------- */
  useEffect(() => {
    const loadRef = async () => {
      const models = new Set<string>();
      sections.forEach((s) => {
        (s.fields || []).forEach(
          (f: any) => f.type === "reference" && models.add(f.referenceModel)
        );
        (s.innerSections || []).forEach((inn: any) =>
          (inn.fields || []).forEach(
            (f: any) => f.type === "reference" && models.add(f.referenceModel)
          )
        );
      });
      await Promise.all(
        Array.from(models)
          .filter((m) => m !== "AwardEmployeeType") // Skip AwardEmployeeType - not needed on join-review page
          .map(async (m) => {
            try {
              const res = await axiosInstance.get(`/${m.toLowerCase()}s`);
              const data = res.data?.data || [];
              const opts = data.map((item: any) => ({
                label:
                  m === "Employee"
                    ? item?.employeeProfile?.personaldetails?.firstname ||
                      "Unnamed"
                    : item?.name || "Unnamed",
                value: item._id,
              }));
              setReferenceOptions((prev) => ({ ...prev, [m]: opts }));
            } catch (e) {
              console.error(`Failed to fetch ${m}`, e);
            }
          })
      );
    };
    if (sections.length) loadRef();
  }, [sections]);

  /* ---------- Autosave → local draft ---------- */
  // Auto-save functionality removed - no longer saving to localStorage
  const autoSave = useCallback(() => {
    // No-op: auto-save disabled
  }, []);

  /* ---------- Form ---------- */
  const formik = useFormik({
    enableReinitialize: true,
    initialValues,
    validate: (values) => {
      // validate ONLY the active step
      const section = activeSection;
      const errors: any = {};
      if (!section) return errors;

      const evalShowIf = (field: any) => {
        if (!field.showIf) return true;
        const findValue = (obj: any, key: string): any => {
          if (!obj || typeof obj !== "object") return undefined;
          if (key in obj) return obj[key];
          for (const k of Object.keys(obj)) {
            const found = findValue(obj[k], key);
            if (found !== undefined) return found;
          }
          return undefined;
        };
        const actual = findValue(values, field.showIf.fieldKey);
        return field.showIf.operator === "equals"
          ? actual === field.showIf.value
          : actual !== field.showIf.value;
      };

      const sectionAccess = coerceEmployeeAccess(section);
      const canEditSection = isEdit(sectionAccess);

      if (canEditSection) {
        for (const field of section.fields || []) {
          if (!evalShowIf(field)) continue;
          const path = `${section.sectionKey}.${field.key}`;
          const val = get(values, path);

          if (field.required) {
            if (field.type === "checkbox") {
              if (!val) set(errors, path, "This field is required.");
            } else if (field.type === "file") {
              // accept either url OR {fileId,key} (e.g., employeephoto)
              const hasUrl = val?.url;
              const hasIdKey = val?.fileId && val?.key;
              if (!hasUrl && !hasIdKey) {
                set(errors, path, "Please upload a file.");
              }
            } else if (field.type === "date") {
              if (!val) {
                set(errors, path, "Please select a date.");
              } else if (field.key === "dob") {
                // Validate DOB: must be at least 18 years ago
                const dobDate = new Date(val);
                const today = new Date();
                const eighteenYearsAgo = new Date(
                  today.getFullYear() - 18,
                  today.getMonth(),
                  today.getDate()
                );
                if (dobDate > eighteenYearsAgo) {
                  set(errors, path, "You must be at least 18 years old.");
                }
              }
            } else if (field.type === "select" || field.type === "reference") {
              if (!val) set(errors, path, "Please select an option.");
            } else if (!val && val !== 0) {
              set(errors, path, "This field is required.");
            }
          }
        }
      }

      for (const inner of section.innerSections || []) {
        const innerAccess = coerceEmployeeAccess(inner);
        // Skip hidden and view sections - only process edit sections
        if (isHidden(innerAccess) || innerAccess === "view") continue;
        const canEditInner = isEdit(innerAccess);
        if (!canEditInner) continue;

        const mode = inner.requirementMode || "AND";
        if (mode === "AND") {
          for (const field of inner.fields || []) {
            if (!evalShowIf(field)) continue;
            if (field.type !== "file") continue;
            if (!field.required) continue;
            const path = `${section.sectionKey}.${inner.sectionKey}.${field.key}`;
            const val = get(values, path);
            const hasUrl = val?.url;
            const hasIdKey = val?.fileId && val?.key;
            if (!hasUrl && !hasIdKey) {
              set(errors, path, "Please upload a file.");
            }
          }
        } else {
          const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
          const chosenKey = selectedDocuments[groupPath];
          if (!chosenKey) {
            set(errors, groupPath, "Select one document to provide.");
          } else {
            inner.fields.forEach((f: any) => {
              if (f.key !== chosenKey) return;
              const path = `${groupPath}.${f.key}`;
              const val = get(values, path);
              const hasUrl = val?.url;
              const hasIdKey = val?.fileId && val?.key;
              if (f.type === "file" && !hasUrl && !hasIdKey) {
                set(errors, path, "Please upload the selected document.");
              }
            });
          }
        }
      }
      return errors;
    },
    onSubmit: () => {},
  });

  /* ---------- showIf (render) ---------- */
  const evaluateShowIfRender = useCallback(
    (field: any) => {
      if (!field.showIf) return true;
      const findValue = (obj: any, key: string): any => {
        if (!obj || typeof obj !== "object") return undefined;
        if (key in obj) return obj[key];
        for (const k of Object.keys(obj)) {
          const found = findValue(obj[k], key);
          if (found !== undefined) return found;
        }
        return undefined;
      };
      const actual = findValue(formik.values, field.showIf.fieldKey);
      return field.showIf.operator === "equals"
        ? actual === field.showIf.value
        : actual !== field.showIf.value;
    },
    [formik.values]
  );

  /* ---------- Address UI ---------- */
  const renderAddressSection = (fields: any[], readOnly: boolean) => {
    const addresses = formik.values.address || [];

    const handleAdd = () => {
      if (readOnly) return;
      const newList = [...addresses, {}];
      formik.setFieldValue("address", newList);
      autoSave({ ...formik.values, address: newList });
    };

    const handleRemove = (i: number) => {
      if (readOnly) return;
      const newList = addresses.filter((_: any, idx: number) => idx !== i);
      formik.setFieldValue("address", newList);
      autoSave({ ...formik.values, address: newList });
    };

    return (
      <div className="space-y-6">
        {addresses.map((address: any, index: number) => {
          return (
            <Card
              key={index}
              className="relative border border-gray-200 shadow-md p-0 overflow-hidden"
            >
              <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
                <div className="w-full px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 shadow-sm">
                  <div className="relative">
                    <input
                      type="text"
                      id={`addressFor-${index}`}
                      className="peer block w-full px-4 pt-5 pb-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-transparent disabled:bg-gray-50 disabled:text-gray-500"
                      placeholder="e.g., Home, Office"
                      value={address?.addressFor || ""}
                      onChange={(e) => {
                        if (readOnly) return;
                        const updated = [...addresses];
                        updated[index] = {
                          ...updated[index],
                          addressFor: e.target.value,
                        };
                        formik.setFieldValue("address", updated);
                      }}
                      onBlur={() => {
                        if (readOnly) return;
                        const updated = [...addresses];
                        updated[index] = {
                          ...updated[index],
                          addressFor: addresses[index]?.addressFor || "",
                        };
                        formik.setFieldValue("address", updated);
                        autoSave({ ...formik.values, address: updated });
                      }}
                      disabled={readOnly}
                    />
                    <label
                      htmlFor={`addressFor-${index}`}
                      className="absolute left-4 top-2 text-xs font-semibold text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold"
                    >
                      Address Label (e.g., Home, Office)
                    </label>
                  </div>
                </div>

                {addresses.length > 1 && !readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="ml-4 text-red-500 hover:text-red-600 text-xs"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {fields
                  .filter((f: any) => f.key !== "addressFor")
                  .map((field: any) => (
                    <Input
                      key={`address[${index}].${field.key}`}
                      label={field.label}
                      placeholder={field.placeholder}
                      value={formik.values.address[index]?.[field.key] || ""}
                      onChange={(e) => {
                        if (readOnly) return;
                        const newAddresses = [...addresses];
                        newAddresses[index] = {
                          ...newAddresses[index],
                          [field.key]: e.target.value,
                        };
                        formik.setFieldValue("address", newAddresses);
                      }}
                      onBlur={() => {
                        if (readOnly) return;
                        formik.setFieldTouched(
                          `address[${index}].${field.key}`,
                          true
                        );
                        autoSave(formik.values);
                      }}
                      disabled={readOnly}
                    />
                  ))}
              </div>
            </Card>
          );
        })}
        {!readOnly && (
          <Button variant="outline" onClick={handleAdd}>
            + Add Address
          </Button>
        )}
      </div>
    );
  };

  /* ---------- Field renderer ---------- */
  const renderField = useCallback(
    (field: any, pathPrefix: string, readOnly: boolean) => {
      if (!evaluateShowIfRender(field)) return null;

      const fullPath = `${pathPrefix}.${field.key}`;
      const value = get(formik.values, fullPath);
      const error = get(formik.errors, fullPath);
      const touched = get(formik.touched, fullPath);
      const showError = Boolean(touched && error);

      const Label = (
        <>
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </>
      );

      const doAutoSave = () => {
        if (!readOnly) autoSave(formik.values);
      };

      switch (field.type) {
        case "text":
        case "email":
          // Check if this is a mobile/phone field - render PhoneInput with country code
          // Check for mobile, phone, or any field key containing "mobile" or "phone"
          const isPhoneField =
            field.key === "mobile" ||
            field.key === "phone" ||
            field.key?.toLowerCase().includes("mobile") ||
            field.key?.toLowerCase().includes("phone") ||
            field.key === "emergency-contact-mobile";
          if (isPhoneField) {
            return (
              <div key={fullPath}>
                <PhoneInput
                  label={Label}
                  placeholder={field.placeholder || "Enter phone number"}
                  value={value || ""}
                  onChange={(val) =>
                    !readOnly && formik.setFieldValue(fullPath, val || "")
                  }
                  onBlur={doAutoSave}
                  disabled={readOnly}
                  defaultCountry="AU"
                  error={showError ? (error as string) : undefined}
                />
              </div>
            );
          }
          // Regular text/email input
          return (
            <div key={fullPath}>
              <Input
                type={field.type}
                label={Label}
                placeholder={field.placeholder}
                value={value || ""}
                onChange={(e) =>
                  !readOnly && formik.setFieldValue(fullPath, e.target.value)
                }
                onBlur={doAutoSave}
                disabled={readOnly}
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
            </div>
          );
        case "textarea":
          return (
            <div key={fullPath}>
              <Textarea
                label={Label}
                placeholder={field.placeholder}
                value={value || ""}
                onChange={(e) =>
                  !readOnly && formik.setFieldValue(fullPath, e.target.value)
                }
                onBlur={doAutoSave}
                disabled={readOnly}
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
            </div>
          );
        case "checkbox":
          return (
            <div key={fullPath}>
              <Checkbox
                label={Label}
                checked={!!value}
                onChange={(e) =>
                  !readOnly && formik.setFieldValue(fullPath, e.target.checked)
                }
                onBlur={doAutoSave}
                disabled={readOnly}
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
            </div>
          );
        case "date": {
          // Check if this is a DOB field - restrict to 18+ years
          const isDOB = field.key === "dob";
          const maxDOBDate = isDOB
            ? (() => {
                const today = new Date();
                const eighteenYearsAgo = new Date(
                  today.getFullYear() - 18,
                  today.getMonth(),
                  today.getDate()
                );
                return eighteenYearsAgo;
              })()
            : undefined;

          return (
            <div key={fullPath} className="space-y-1">
              <label className="text-sm font-medium text-gray-700">
                {Label}
              </label>
              <ReactDatePicker
                selected={value ? new Date(value) : null}
                dateFormat="dd/MM/yyyy"
                maxDate={maxDOBDate}
                showMonthDropdown
                showYearDropdown
                scrollableYearDropdown
                yearDropdownItemNumber={100}
                onChange={(val) => {
                  if (readOnly) return;
                  const iso = val ? val.toISOString() : null;
                  formik.setFieldValue(fullPath, iso);
                  const updated = { ...formik.values };
                  set(updated, fullPath, iso);
                  autoSave(updated);
                }}
                inputProps={{
                  placeholder: isDOB ? "Select DOB (18+)" : field.placeholder,
                  disabled: readOnly,
                }}
                onBlur={() =>
                  !readOnly && formik.setFieldTouched(fullPath, true)
                }
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
              {isDOB && (
                <p className="text-xs text-gray-500 mt-1">
                  Must be at least 18 years old
                </p>
              )}
            </div>
          );
        }
        case "number":
          return (
            <div key={fullPath}>
              <Input
                type="number"
                label={Label}
                placeholder={field.placeholder}
                value={value ?? ""}
                onChange={(e) =>
                  !readOnly && formik.setFieldValue(fullPath, e.target.value)
                }
                onBlur={doAutoSave}
                disabled={readOnly}
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
            </div>
          );
        case "phone":
        case "tel":
          // Also check if field key is mobile for backward compatibility
          if (
            field.key === "mobile" ||
            field.type === "phone" ||
            field.type === "tel"
          ) {
            return (
              <div key={fullPath}>
                <PhoneInput
                  label={Label}
                  placeholder={field.placeholder || "Enter phone number"}
                  value={value || ""}
                  onChange={(val) =>
                    !readOnly && formik.setFieldValue(fullPath, val || "")
                  }
                  onBlur={doAutoSave}
                  disabled={readOnly}
                  defaultCountry="AU"
                  error={showError ? (error as string) : undefined}
                />
              </div>
            );
          }
          // Fallback to text input if not mobile
          return (
            <div key={fullPath}>
              <Input
                type="text"
                label={Label}
                placeholder={field.placeholder}
                value={value || ""}
                onChange={(e) =>
                  !readOnly && formik.setFieldValue(fullPath, e.target.value)
                }
                onBlur={doAutoSave}
                disabled={readOnly}
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
            </div>
          );
        case "select": {
          // Check if this is a country select field
          const isCountrySelect = (field as any).isCountrySelect === true;
          const isMulti = (field as any).isMulti === true;

          // Get options - use COUNTRIES for country selects, otherwise use field.options
          let opts: { label: string; value: string }[] = [];
          if (isCountrySelect) {
            opts = COUNTRIES;
          } else {
            opts = (field.options || []).map((o: string) => ({
              label: o,
              value: o,
            }));
          }

          // Handle multi-select fields
          if (isMulti) {
            // For multi-select, value should be an array
            // Handle comma-separated strings (e.g., "Italian,French,English" -> ["Italian", "French", "English"])
            let currentValues: string[] = [];
            if (Array.isArray(value)) {
              currentValues = value;
            } else if (value) {
              const strValue = String(value).trim();
              // Check if it's a comma-separated string
              if (strValue.includes(",")) {
                currentValues = strValue
                  .split(",")
                  .map((v) => v.trim())
                  .filter((v) => v.length > 0);
              } else {
                currentValues = [strValue];
              }
            }

            return (
              <div key={fullPath} className="space-y-2">
                {/* Display selected values as chips */}
                {currentValues.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {currentValues.map((val: string, idx: number) => {
                      const normalizedVal = String(val).trim();
                      const option = opts.find(
                        (o) => o.value === normalizedVal
                      );
                      const displayLabel = option?.label || normalizedVal;
                      return (
                        <span
                          key={`${normalizedVal}-${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                        >
                          {displayLabel}
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                // Normalize both values for comparison
                                const newValues = currentValues.filter(
                                  (v) => String(v).trim() !== normalizedVal
                                );
                                formik.setFieldValue(fullPath, newValues);
                                const updated = { ...formik.values };
                                set(updated, fullPath, newValues);
                                autoSave(updated);
                              }}
                              className="hover:text-blue-900 focus:outline-none"
                              aria-label={`Remove ${displayLabel}`}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
                <Select
                  label={Label}
                  placeholder={
                    field.placeholder || `Add ${field.label.toLowerCase()}`
                  }
                  value={null}
                  onChange={(opt: any) => {
                    if (readOnly) return;
                    if (opt?.value && !currentValues.includes(opt.value)) {
                      const newValues = [...currentValues, opt.value];
                      formik.setFieldValue(fullPath, newValues);
                      const updated = { ...formik.values };
                      set(updated, fullPath, newValues);
                      autoSave(updated);
                    }
                  }}
                  options={opts.filter((o) => !currentValues.includes(o.value))}
                  onBlur={doAutoSave}
                  disabled={readOnly}
                  searchable={isCountrySelect || opts.length > 10}
                />
                {showError && (
                  <p className="text-xs text-red-500 mt-1">{error as any}</p>
                )}
              </div>
            );
          }

          // Single select
          return (
            <div key={fullPath}>
              <Select
                label={Label}
                placeholder={field.placeholder}
                value={opts.find((opt: any) => opt.value === value) || null}
                onChange={(opt: any) => {
                  if (readOnly) return;
                  formik.setFieldValue(fullPath, opt?.value || "");
                  const updated = { ...formik.values };
                  set(updated, fullPath, opt?.value || "");
                  autoSave(updated);
                }}
                options={opts}
                onBlur={doAutoSave}
                disabled={readOnly}
                searchable={isCountrySelect || opts.length > 10}
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
            </div>
          );
        }
        case "reference": {
          const opts =
            referenceOptions[(field as any).referenceModel as string] || [];
          return (
            <div key={fullPath}>
              <Select
                label={Label}
                placeholder={field.placeholder}
                value={
                  opts.find(
                    (opt) =>
                      String(opt.value) ===
                      String(typeof value === "object" ? value?._id : value)
                  ) || null
                }
                onChange={(opt: any) => {
                  if (readOnly) return;
                  const id = opt?.value || "";
                  formik.setFieldValue(fullPath, id);
                  const updated = { ...formik.values };
                  set(updated, fullPath, id);
                  autoSave(updated);
                }}
                options={opts}
                onBlur={() =>
                  !readOnly && formik.setFieldTouched(fullPath, true)
                }
                disabled={readOnly}
              />
              {showError && (
                <p className="text-xs text-red-500 mt-1">{error as any}</p>
              )}
            </div>
          );
        }
        case "file": {
          if (!isEdit(coerceEmployeeAccess(activeSection || ({} as any)))) {
            const hasFile =
              value && typeof value === "object" && (value.url || value.name);
            return (
              <div key={fullPath} className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  {Label}
                </label>
                <div className="text-sm rounded-md border p-3 bg-gray-50 text-gray-600">
                  {hasFile ? (
                    <div className="space-y-1">
                      {value.url ? (
                        <a
                          href={value.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {value.name || "View file"}
                        </a>
                      ) : (
                        <span>{value.name || "File uploaded"}</span>
                      )}
                    </div>
                  ) : (
                    <span className="italic text-gray-400">No file</span>
                  )}
                </div>
              </div>
            );
          }
          return (
            <FileUploadField
              key={fullPath}
              field={field}
              fullPath={fullPath}
              value={value}
              formik={formik}
              autoSave={autoSave}
            />
          );
        }
        default:
          return null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [referenceOptions, formik, autoSave, evaluateShowIfRender, activeSection]
  );

  /* ---------- Save current step to backend ---------- */
  const saveCurrentToBackend = useCallback(async () => {
    const cleaned = deepClean(formik.values);
    const { profileUpdates, additionalFields } =
      splitProfileAndAdditionalFields(cleaned, sections);

    // Merge with existing profile data to preserve fields not currently edited
    const existingEmployeeFields = profile?.employeeFields || {};
    const existingAdditionalFields =
      existingEmployeeFields.additionalFields || [];

    // Preserve documents section - Filter out empty/non-uploaded documents
    const documentsFromFormik = formik.values.documents;
    const documentsFromExisting = existingEmployeeFields.documents || {};

    // Helper: Filter out documents that don't have fileId and key (not actually uploaded)
    const filterOnlyUploadedDocs = (docs: any) => {
      if (!docs || typeof docs !== "object") return {};

      const filtered: any = {};
      for (const [innerKey, fields] of Object.entries(docs)) {
        if (!fields || typeof fields !== "object") continue;

        const filteredFields: any = {};
        for (const [fieldKey, value] of Object.entries(fields as any)) {
          // Only include documents that have been actually uploaded (have fileId and key)
          if (value && typeof value === "object" && value.fileId && value.key) {
            filteredFields[fieldKey] = value;
          }
        }

        // Only add the inner section if it has at least one valid document
        if (Object.keys(filteredFields).length > 0) {
          filtered[innerKey] = filteredFields;
        }
      }

      return filtered;
    };

    // Use formik documents if they exist, otherwise use existing
    const documentsToSave =
      documentsFromFormik &&
      typeof documentsFromFormik === "object" &&
      Object.keys(documentsFromFormik).length > 0
        ? filterOnlyUploadedDocs(documentsFromFormik)
        : filterOnlyUploadedDocs(documentsFromExisting);

    // Merge additionalFields: preserve existing fields that aren't being updated
    // This is critical for employer-only fields like employmentstatus that aren't in formik.values
    const mergedAdditionalFields = [...existingAdditionalFields];

    // Update or add fields from formik
    additionalFields.forEach((newField: any) => {
      const existingIndex = mergedAdditionalFields.findIndex(
        (f: any) =>
          f.sectionKey === newField.sectionKey &&
          f.fieldKey === newField.fieldKey &&
          (f.innerSectionKey || null) === (newField.innerSectionKey || null)
      );

      if (existingIndex >= 0) {
        // Update existing field
        mergedAdditionalFields[existingIndex] = newField;
      } else {
        // Add new field
        mergedAdditionalFields.push(newField);
      }
    });

    await axiosInstance.put(`/employees/me/employee-fields/${branchId}`, {
      employeeFields: {
        ...existingEmployeeFields,
        ...profileUpdates,
        documents: documentsToSave,
        additionalFields: mergedAdditionalFields,
      },
    });
  }, [formik.values, sections, branchId, profile]);

  /* ---------- Helper: Format validation errors for display ---------- */
  const formatValidationErrors = (errors: any): string[] => {
    const errorMessages: string[] = [];

    const getFieldLabel = (path: string): string => {
      const parts = path.split(".");
      if (parts.length === 2) {
        // Format: sectionKey.fieldKey
        const [sectionKey, fieldKey] = parts;
        const section = sections.find((s) => s.sectionKey === sectionKey);
        if (section) {
          const field = section.fields?.find((f) => f.key === fieldKey);
          if (field) {
            return `${section.sectionLabel || sectionKey} - ${
              field.label || fieldKey
            }`;
          }
        }
      } else if (parts.length === 3) {
        // Format: sectionKey.innerSectionKey.fieldKey
        const [sectionKey, innerSectionKey, fieldKey] = parts;
        const section = sections.find((s) => s.sectionKey === sectionKey);
        if (section) {
          const innerSection = section.innerSections?.find(
            (s) => s.sectionKey === innerSectionKey
          );
          if (innerSection) {
            const field = innerSection.fields?.find((f) => f.key === fieldKey);
            if (field) {
              return `${section.sectionLabel || sectionKey} - ${
                innerSection.sectionLabel || innerSectionKey
              } - ${field.label || fieldKey}`;
            }
          }
        }
      }
      // Fallback: format path as readable text
      return parts
        .map((p) =>
          p.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())
        )
        .join(" - ");
    };

    // Extract all errors recursively (handles both flat and nested structures)
    const extractErrors = (obj: any, prefix = ""): void => {
      if (!obj || typeof obj !== "object") return;

      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;

        const value = obj[key];
        const fullPath = prefix ? `${prefix}.${key}` : key;

        if (typeof value === "string" && value.trim()) {
          // This is an error message string
          const fieldLabel = getFieldLabel(fullPath);
          errorMessages.push(`${fieldLabel}: ${value}`);
        } else if (
          typeof value === "object" &&
          value !== null &&
          !Array.isArray(value)
        ) {
          // Nested error object - recurse
          extractErrors(value, fullPath);
        }
      }
    };

    extractErrors(errors);
    return errorMessages;
  };

  /* ---------- Step controls ---------- */
  const goPrev = () => setCurrentStep((s) => Math.max(0, s - 1));

  const goNext = async () => {
    // Validate active step only
    const errs = await formik.validateForm();
    const hasErrors = Object.keys(errs || {}).length > 0;
    if (hasErrors) {
      // touch all fields in the active section so errors appear
      const sec = activeSection;
      if (sec) {
        for (const f of sec.fields || []) {
          formik.setFieldTouched(`${sec.sectionKey}.${f.key}`, true, false);
        }
        for (const inn of sec.innerSections || []) {
          for (const f of inn.fields || []) {
            formik.setFieldTouched(
              `${sec.sectionKey}.${inn.sectionKey}.${f.key}`,
              true,
              false
            );
          }
        }
      }

      // Show specific error messages
      const errorMessages = formatValidationErrors(errs);
      if (errorMessages.length > 0) {
        // Show all errors (toast can handle multiple lines)
        // For single error, show it directly; for multiple, show first with count
        if (errorMessages.length === 1) {
          toast.error(errorMessages[0]);
        } else {
          // Show first error and indicate more exist
          toast.error(
            `${errorMessages[0]} (${errorMessages.length - 1} more error${
              errorMessages.length > 2 ? "s" : ""
            })`
          );
        }
      } else {
        toast.error("Please fix errors before continuing.");
      }
      return;
    }

    try {
      setSaveStatus("saving");
      await saveCurrentToBackend();
      setSaveStatus("success");
      toast.success("Saved");
      setCurrentStep((s) => Math.min(visibleSections.length - 1, s + 1));
    } catch (e: any) {
      console.error(e);
      setSaveStatus("error");
      toast.error(e?.response?.data?.message || "Failed to save.");
    }
  };

  const finish = async () => {
    // Final validation for the last step
    const errs = await formik.validateForm();
    if (Object.keys(errs || {}).length > 0) {
      console.log(errs, "errors");

      // Touch all fields to show errors visually
      for (const section of sections) {
        for (const f of section.fields || []) {
          formik.setFieldTouched(`${section.sectionKey}.${f.key}`, true, false);
        }
        for (const inn of section.innerSections || []) {
          for (const f of inn.fields || []) {
            formik.setFieldTouched(
              `${section.sectionKey}.${inn.sectionKey}.${f.key}`,
              true,
              false
            );
          }
        }
      }

      // Show specific error messages
      const errorMessages = formatValidationErrors(errs);
      if (errorMessages.length > 0) {
        // Show all errors (toast can handle multiple lines)
        // For single error, show it directly; for multiple, show first with count
        if (errorMessages.length === 1) {
          toast.error(errorMessages[0]);
        } else {
          // Show first error and indicate more exist
          toast.error(
            `${errorMessages[0]} (${errorMessages.length - 1} more error${
              errorMessages.length > 2 ? "s" : ""
            })`
          );
        }
      } else {
        toast.error("Please fix errors before finishing.");
      }
      return;
    }
    try {
      setSaveStatus("saving");
      await saveCurrentToBackend();
      setSaveStatus("success");
      toast.success("Profile updated");
      startTransition(() => router.push("/nexus-profile"));
    } catch (e: any) {
      console.error(e);
      setSaveStatus("error");
      toast.error(e?.response?.data?.message || "Failed to submit.");
    }
  };

  /* ---------- Render ---------- */
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
          <div className="h-28 sm:h-32 bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 rounded-xl" />
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-gray-200 rounded" />
            <div className="h-4 w-72 bg-gray-200 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl" />
              ))}
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto py-16 px-6">
        <div className="rounded-2xl border border-red-200 bg-white shadow">
          <div className="p-5 border-b border-red-100 bg-rose-50 rounded-t-2xl">
            <h2 className="text-red-700 font-semibold">
              Couldn’t load details
            </h2>
          </div>
          <div className="p-5 text-sm text-gray-700">{error}</div>
          <div className="p-5 pt-0">
            <button
              onClick={() => location.reload()}
              className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const steps = visibleSections.map((s) => ({
    key: s.sectionKey,
    label: s.sectionLabel,
  }));

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {logoUrl && (
              <div className="flex-shrink-0">
                <Image
                  src={logoUrl}
                  alt={branchName || "Organization"}
                  width={48}
                  height={48}
                  className="rounded-lg object-cover"
                />
              </div>
            )}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Review & Fill Your Information for{" "}
                {branchName ? (
                  <span className="text-indigo-600">{branchName}</span>
                ) : (
                  "the Organisation"
                )}
              </h2>
            </div>
          </div>

          <div
            className={[
              "text-xs px-3 py-1.5 rounded-full border shadow-sm",
              saveStatus === "saving" &&
                "border-blue-200 bg-blue-50 text-blue-700",
              saveStatus === "success" &&
                "border-green-200 bg-green-50 text-green-700",
              saveStatus === "error" && "border-red-200 bg-red-50 text-red-700",
              saveStatus === "idle" &&
                "border-gray-200 bg-gray-50 text-gray-600",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {saveStatus === "saving" && "💾 Saving…"}
            {saveStatus === "success" && "✅ Draft saved"}
            {saveStatus === "error" && "⚠️ Save error"}
            {saveStatus === "idle" && "Autosave (local draft)"}
          </div>
        </div>

        {/* Stepper */}
        <StepperHeader
          steps={steps}
          current={currentStep}
          // optional: allow jumping to steps already completed
          onStepClick={(i) => {
            if (i <= currentStep) setCurrentStep(i);
          }}
        />

        {/* Active Step Panel */}
        <form onSubmit={formik.handleSubmit} className="space-y-6 mt-6">
          {activeSection ? (
            <>
              {/* Top-level fields */}
              {activeSection.sectionKey === "address" ? (
                renderAddressSection(
                  activeSection.fields || [],
                  !isEdit(coerceEmployeeAccess(activeSection))
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(activeSection.fields || []).map((field: any) =>
                    renderField(
                      field,
                      activeSection.sectionKey,
                      !isEdit(coerceEmployeeAccess(activeSection))
                    )
                  )}
                </div>
              )}

              {/* Inner sections */}
              {(activeSection.innerSections || [])
                .filter((inn) => {
                  const access = coerceEmployeeAccess(inn);
                  return access !== "hidden" && access !== "view";
                })
                .map((inner: any) => {
                  const groupPath = `${activeSection.sectionKey}.${inner.sectionKey}`;
                  const groupError = get(formik.errors, groupPath);
                  const innerReadOnly =
                    !isEdit(coerceEmployeeAccess(activeSection)) ||
                    !isEdit(coerceEmployeeAccess(inner));

                  const guardedSetSelected = (updater: any) => {
                    if (innerReadOnly) return;
                    setSelectedDocuments(updater);
                  };

                  return (
                    <div
                      key={inner.sectionKey}
                      className="mt-8 border-t border-gray-200 pt-6"
                    >
                      <h4 className="text-base font-medium text-gray-700 mb-4">
                        {inner.sectionLabel}
                        {innerReadOnly && (
                          <span className="ml-2 text-xs text-gray-500">
                            (view only)
                          </span>
                        )}
                      </h4>

                      {typeof groupError === "string" && !innerReadOnly && (
                        <div className="text-sm text-red-500 mb-3">
                          {groupError}
                        </div>
                      )}

                      {activeSection.sectionKey === "documents" ? (
                        <DocumentSection
                          inner={inner}
                          sectionKeyPath={groupPath}
                          selectedDocuments={selectedDocuments}
                          setSelectedDocuments={
                            innerReadOnly ? () => {} : guardedSetSelected
                          }
                          formik={formik}
                          onOpenModal={
                            innerReadOnly ? () => {} : handleOpenModal
                          }
                        />
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(inner.fields || []).map((field: any) =>
                            renderField(field, groupPath, innerReadOnly)
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No section available.
            </div>
          )}
        </form>
      </Card>

      {/* Bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <div className="absolute inset-0 -top-2 blur-xl bg-gradient-to-r from-indigo-400/20 via-fuchsia-400/20 to-sky-400/20 pointer-events-none" />
            <div className="relative flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur px-4 sm:px-6 py-3 shadow-lg shadow-gray-200/50">
              <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
                Review and edit your details. and proceed with
                <b> Next</b>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={goPrev}
                  disabled={currentStep === 0}
                  className="rounded-xl"
                >
                  Previous
                </Button>

                {currentStep < visibleSections.length - 1 ? (
                  <Button
                    type="button"
                    onClick={goNext}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 sm:px-6 py-2.5
                    bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600
                    text-white shadow-md hover:shadow-lg transition
                    hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={finish}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-5 sm:px-6 py-2.5
                    bg-gradient-to-r from-emerald-600 to-teal-600
                    text-white shadow-md hover:shadow-lg transition
                    hover:from-emerald-700 hover:to-teal-700
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-400"
                  >
                    Finish
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>

      {/* Document modal */}
      {activeUploadField && (
        <DocumentUploadModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          field={activeUploadField.field}
          fullPath={activeUploadField.fullPath}
          formik={formik}
          autoSave={autoSave}
        />
      )}
    </div>
  );
}

// --------------------------------------------------------
// /* eslint-disable react-hooks/rules-of-hooks */
// "use client";

// import React, {
//   useEffect,
//   useMemo,
//   useState,
//   useCallback,
//   startTransition,
// } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Button, Input, Textarea, Checkbox, Select, Tab } from "rizzui";
// import axiosInstance from "@/app/lib/axios";
// import get from "lodash/get";
// import set from "lodash/set";
// import toast from "react-hot-toast";
// import { Card } from "@/app/components/ui/Card";
// import { useFormik } from "formik";

// import DocumentUploadModal from "../components/shared/DocumentUploadModal";
// import FileUploadField from "../components/ui/FileUploadField";
// import DocumentSection from "../components/ui/DocumentSection";
// import ReactDatePicker from "../components/ui/DatePicker";

// import {
//   deepClean,
//   splitProfileAndAdditionalFields,
//   findValueByFieldKeyAnywhere,
//   hasMeaningfulValue,
// } from "@/app/utils/profile-utils";
// import { useDebouncedAutosave } from "@/app/hooks/useDebouncedAutosave";

// // ---------- Types ----------
// type Field = {
//   key: string;
//   label: string;
//   type:
//     | "text"
//     | "textarea"
//     | "email"
//     | "date"
//     | "number"
//     | "file"
//     | "select"
//     | "checkbox"
//     | "reference";
//   isAdditional?: boolean;
//   placeholder?: string;
//   referenceModel?: string;
//   required?: boolean;
//   options?: string[];
//   showIf?: {
//     fieldKey: string;
//     operator: "equals" | "notEquals";
//     value: any;
//   };
// };

// type InnerSection = {
//   sectionKey: string;
//   sectionLabel: string;
//   requirementMode?: "AND" | "OR";
//   fields: Field[];
// };

// type Section = {
//   sectionKey: string;
//   sectionLabel: string;
//   employeerOnlyEditable?: boolean;
//   fields?: Field[];
//   innerSections?: InnerSection[];
// };

// type JoinedConfigResponse = {
//   sections: Section[];
//   tenantName?: string;
//   branchName?: string;
// };

// type ProfileResponse = any;

// // ---------- Component ----------
// export default function JoinedCompanyReview() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const branchId = searchParams.get("branchId") as string;
//   const tenantId = searchParams.get("tenantId") as string;

//   // UI + data state
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const [config, setConfig] = useState<JoinedConfigResponse | null>(null);
//   const [sections, setSections] = useState<Section[]>([]);
//   const [profile, setProfile] = useState<ProfileResponse | null>(null);

//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});
//   const [referenceOptions, setReferenceOptions] = useState<
//     Record<string, { label: string; value: string }[]>
//   >({});

//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({});

//   const [saveStatus, setSaveStatus] = useState<
//     "idle" | "saving" | "success" | "error"
//   >("idle");

//   // Document upload modal
//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);
//   const handleOpenModal = (field: any, fullPath: string) => {
//     setActiveUploadField({ field, fullPath });
//     setModalOpen(true);
//   };

//   // Visible (non-employer-only) sections
//   const visibleSections = useMemo(
//     () => (sections || []).filter((s) => !s.employeerOnlyEditable),
//     [sections]
//   );

//   const orgLabel = useMemo(() => {
//     if (!config) return "Organization";
//     if (config.tenantName && config.branchName) {
//       return `${config.tenantName} / ${config.branchName}`;
//     }
//     return config.tenantName || config.branchName || "Organization";
//   }, [config]);

//   // --- Cross-field helpers: index field keys once; resolve key globally (ignoring sectionKey) ---
//   type Occurrence = {
//     sectionKey: string;
//     innerSectionKey?: string | null;
//     type: string; // "file" | "text" | ...
//     isAdditional?: boolean;
//   };

//   const buildFieldKeyIndex = (cfg: Section[]): Record<string, Occurrence[]> => {
//     const map: Record<string, Occurrence[]> = {};
//     for (const section of cfg) {
//       for (const f of section.fields || []) {
//         (map[f.key] ||= []).push({
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           type: f.type,
//           isAdditional: !!f.isAdditional,
//         });
//       }
//       for (const inner of section.innerSections || []) {
//         for (const f of inner.fields || []) {
//           (map[f.key] ||= []).push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             type: f.type,
//             isAdditional: !!f.isAdditional,
//           });
//         }
//       }
//     }
//     return map;
//   };

//   const readExactFromProfile = (
//     prof: any,
//     occ: Occurrence,
//     fieldKey: string
//   ) => {
//     if (occ.isAdditional) {
//       const match = (prof.additionalFields || []).find(
//         (a: any) =>
//           a.sectionKey === occ.sectionKey &&
//           (a.innerSectionKey ?? null) === (occ.innerSectionKey ?? null) &&
//           a.fieldKey === fieldKey
//       );
//       return match?.value;
//     }
//     const path = occ.innerSectionKey
//       ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
//       : `${occ.sectionKey}.${fieldKey}`;
//     return get(prof, path);
//   };

//   const resolveValueForKey = (
//     prof: any,
//     fieldKey: string,
//     occs: Occurrence[]
//   ) => {
//     const candidates: any[] = [];
//     // 1) Exact placements
//     for (const occ of occs) {
//       const v = readExactFromProfile(prof, occ, fieldKey);
//       if (hasMeaningfulValue(v, occ.type)) candidates.push(v);
//     }
//     // 2) Any additional field with same key (ignores sectionKey)
//     const addAny = (prof.additionalFields || []).find(
//       (a: any) => a.fieldKey === fieldKey
//     )?.value;
//     if (hasMeaningfulValue(addAny)) candidates.push(addAny);
//     // 3) Deep search anywhere
//     const deep = findValueByFieldKeyAnywhere(prof, fieldKey);
//     if (hasMeaningfulValue(deep)) candidates.push(deep);

//     // Prefer files, then non-empty strings, then anything meaningful
//     for (const c of candidates) {
//       if (c && typeof c === "object" && "url" in c && (c as any).url) return c;
//     }
//     for (const c of candidates) {
//       if (typeof c === "string" && c.trim()) return c;
//     }
//     for (const c of candidates) {
//       if (hasMeaningfulValue(c)) return c;
//     }
//     return undefined;
//   };

//   // --- boot data (config + profile) ---
//   useEffect(() => {
//     const boot = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const [{ data: cfgRes }, { data: profRes }] = await Promise.all([
//           axiosInstance.get("/employee-field-config/by-org", {
//             params: { tenantId, branchId },
//           }),
//           axiosInstance.get("/employee-profiles/self/get"),
//         ]);

//         const cfgData = cfgRes?.data || cfgRes;
//         const cfgSections: Section[] = cfgData?.sections || [];
//         setConfig({
//           sections: cfgSections,
//           tenantName: cfgData?.tenantName,
//           branchName: cfgData?.branchName,
//         });
//         setSections(cfgSections);

//         const prof = profRes?.data || profRes;
//         setProfile(prof);

//         // Build initial values w/ global cross-fill by field key
//         const values: Record<string, any> = {};

//         // special: address as array
//         values["address"] =
//           prof["address"] && Array.isArray(prof["address"])
//             ? prof["address"]
//             : [{}];

//         // pre-seed structure
//         for (const section of cfgSections) {
//           if (section.sectionKey === "address") continue;
//           if (!values[section.sectionKey]) values[section.sectionKey] = {};
//           for (const inner of section.innerSections || []) {
//             if (!values[section.sectionKey][inner.sectionKey]) {
//               values[section.sectionKey][inner.sectionKey] = {};
//             }
//           }
//         }

//         const idx = buildFieldKeyIndex(cfgSections);

//         for (const [fieldKey, occs] of Object.entries(idx)) {
//           const resolved = resolveValueForKey(prof, fieldKey, occs);
//           for (const occ of occs) {
//             const path = occ.innerSectionKey
//               ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
//               : `${occ.sectionKey}.${fieldKey}`;
//             const fallback =
//               occ.type === "checkbox" ? false : occ.type === "file" ? {} : "";
//             set(
//               values,
//               path,
//               hasMeaningfulValue(resolved, occ.type) ? resolved : fallback
//             );
//           }
//         }

//         // Prefill OR-document radio selection
//         const initialSelected: Record<string, string> = {};
//         for (const section of cfgSections) {
//           for (const inner of section.innerSections || []) {
//             if (inner.requirementMode !== "OR") continue;
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const chosen = (inner.fields || []).find((f: any) => {
//               const v = get(values, `${groupPath}.${f.key}`);
//               return (
//                 (typeof v === "string" && !!v) ||
//                 (v && typeof v === "object" && Object.keys(v).length > 0)
//               );
//             });
//             if (chosen) initialSelected[groupPath] = chosen.key;
//           }
//         }

//         setSelectedDocuments(initialSelected);
//         setInitialValues(values);
//       } catch (e: any) {
//         setError(
//           e?.response?.data?.message || "Unable to load joined company data."
//         );
//       } finally {
//         setLoading(false);
//       }
//     };
//     boot();
//   }, [tenantId, branchId]);

//   // fetch reference lists used in config
//   useEffect(() => {
//     const loadRef = async () => {
//       const models = new Set<string>();
//       sections.forEach((s) => {
//         (s.fields || []).forEach(
//           (f: any) => f.type === "reference" && models.add(f.referenceModel)
//         );
//         (s.innerSections || []).forEach((inn: any) =>
//           (inn.fields || []).forEach(
//             (f: any) => f.type === "reference" && models.add(f.referenceModel)
//           )
//         );
//       });
//       await Promise.all(
//         Array.from(models).map(async (m) => {
//           try {
//             const res = await axiosInstance.get(`/${m.toLowerCase()}s`);
//             const data = res.data?.data || [];
//             const opts = data.map((item: any) => ({
//               label:
//                 m === "Employee"
//                   ? item?.employeeProfile?.personaldetails?.firstname ||
//                     "Unnamed"
//                   : item?.name || "Unnamed",
//               value: item._id,
//             }));
//             setReferenceOptions((prev) => ({ ...prev, [m]: opts }));
//           } catch (e) {
//             console.error(`Failed to fetch ${m}`, e);
//           }
//         })
//       );
//     };
//     if (sections.length) loadRef();
//   }, [sections]);

//   // ---------- Autosave ----------
//   const rawAutoSave = useCallback(
//     async (values: any) => {
//       try {
//         setSaveStatus("saving");
//         const cleaned = deepClean(values);
//         const { profileUpdates, additionalFields } =
//           splitProfileAndAdditionalFields(cleaned, sections);
//         const payload = { ...profileUpdates, additionalFields };
//         await axiosInstance.put(`/employee-profiles/self/update`, payload);
//         setSaveStatus("success");
//       } catch (e) {
//         console.error("Auto-save error", e);
//         setSaveStatus("error");
//         toast.error("Auto-save failed.");
//       }
//     },
//     [sections]
//   );
//   const autoSave = useDebouncedAutosave(rawAutoSave, 700);

//   // ---------- Form ----------
//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     validate: (values) => {
//       const evalShowIf = (field: any) => {
//         if (!field.showIf) return true;
//         const findValue = (obj: any, key: string): any => {
//           if (!obj || typeof obj !== "object") return undefined;
//           if (key in obj) return obj[key];
//           for (const k of Object.keys(obj)) {
//             const found = findValue(obj[k], key);
//             if (found !== undefined) return found;
//           }
//           return undefined;
//         };
//         const actual = findValue(values, field.showIf.fieldKey);
//         return field.showIf.operator === "equals"
//           ? actual === field.showIf.value
//           : actual !== field.showIf.value;
//       };

//       const errors: any = {};
//       for (const section of visibleSections) {
//         for (const field of section.fields || []) {
//           if (!evalShowIf(field)) continue;
//           const path = `${section.sectionKey}.${field.key}`;
//           const val = get(values, path);
//           if (field.required) {
//             if (field.type === "checkbox") {
//               if (!val) set(errors, path, "This field is required.");
//             } else if (field.type === "file") {
//               if (!val?.url) set(errors, path, "Please upload a file.");
//             } else if (field.type === "date") {
//               if (!val) set(errors, path, "Please select a date.");
//             } else if (field.type === "select" || field.type === "reference") {
//               if (!val) set(errors, path, "Please select an option.");
//             } else if (!val && val !== 0) {
//               set(errors, path, "This field is required.");
//             }
//           }
//         }

//         for (const inner of section.innerSections || []) {
//           const mode = inner.requirementMode || "AND";

//           if (mode === "AND") {
//             for (const field of inner.fields || []) {
//               if (!evalShowIf(field)) continue;
//               if (field.type !== "file") continue;
//               if (!field.required) continue;

//               const path = `${section.sectionKey}.${inner.sectionKey}.${field.key}`;
//               const val = get(values, path);
//               if (!val?.url) {
//                 set(errors, path, "Please upload a file.");
//               }
//             }
//           } else {
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const chosenKey = selectedDocuments[groupPath];

//             if (!chosenKey) {
//               set(errors, groupPath, "Select one document to provide.");
//             } else {
//               inner.fields.forEach((f: any) => {
//                 if (f.key !== chosenKey) return;
//                 const path = `${groupPath}.${f.key}`;
//                 const val = get(values, path);
//                 if (f.type === "file" && !val?.url) {
//                   set(errors, path, "Please upload the selected document.");
//                 }
//               });
//             }
//           }
//         }
//       }
//       return errors;
//     },
//     onSubmit: () => {},
//   });

//   // showIf evaluator for RENDER
//   const evaluateShowIfRender = useCallback(
//     (field: any) => {
//       if (!field.showIf) return true;
//       const findValue = (obj: any, key: string): any => {
//         if (!obj || typeof obj !== "object") return undefined;
//         if (key in obj) return obj[key];
//         for (const k of Object.keys(obj)) {
//           const found = findValue(obj[k], key);
//           if (found !== undefined) return found;
//         }
//         return undefined;
//       };
//       const actual = findValue(formik.values, field.showIf.fieldKey);
//       return field.showIf.operator === "equals"
//         ? actual === field.showIf.value
//         : actual !== field.showIf.value;
//     },
//     [formik.values]
//   );

//   // ---------- Address UI (editable) ----------
//   const renderAddressSection = (fields: any[]) => {
//     const addresses = formik.values.address || [];

//     const handleAdd = () => {
//       const newList = [...addresses, {}];
//       formik.setFieldValue("address", newList);
//       autoSave({ ...formik.values, address: newList });
//     };

//     const handleRemove = (i: number) => {
//       const newList = addresses.filter((_: any, idx: number) => idx !== i);
//       formik.setFieldValue("address", newList);
//       autoSave({ ...formik.values, address: newList });
//     };

//     return (
//       <div className="space-y-6">
//         {addresses.map((address: any, index: number) => {
//           return (
//             <Card
//               key={index}
//               className="relative border border-gray-200 shadow-md p-0 overflow-hidden"
//             >
//               <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
//                 <div className="w-full px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 shadow-sm">
//                   <div className="relative">
//                     <input
//                       type="text"
//                       id={`addressFor-${index}`}
//                       className="peer block w-full px-4 pt-5 pb-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-transparent"
//                       placeholder="e.g., Home, Office"
//                       value={address?.addressFor || ""}
//                       onChange={(e) => {
//                         const updated = [...addresses];
//                         updated[index] = {
//                           ...updated[index],
//                           addressFor: e.target.value,
//                         };
//                         formik.setFieldValue("address", updated);
//                       }}
//                       onBlur={() => {
//                         const updated = [...addresses];
//                         updated[index] = {
//                           ...updated[index],
//                           addressFor: addresses[index]?.addressFor || "",
//                         };
//                         formik.setFieldValue("address", updated);
//                         autoSave({ ...formik.values, address: updated });
//                       }}
//                     />
//                     <label
//                       htmlFor={`addressFor-${index}`}
//                       className="absolute left-4 top-2 text-xs font-semibold text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold"
//                     >
//                       Address Label (e.g., Home, Office)
//                     </label>
//                   </div>
//                 </div>

//                 {addresses.length > 1 && (
//                   <button
//                     type="button"
//                     onClick={() => handleRemove(index)}
//                     className="ml-4 text-red-500 hover:text-red-600 text-xs"
//                   >
//                     Remove
//                   </button>
//                 )}
//               </div>

//               <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {fields
//                   .filter((f: any) => f.key !== "addressFor")
//                   .map((field: any) => (
//                     <Input
//                       key={`address[${index}].${field.key}`}
//                       label={field.label}
//                       placeholder={field.placeholder}
//                       value={formik.values.address[index]?.[field.key] || ""}
//                       onChange={(e) => {
//                         const newAddresses = [...addresses];
//                         newAddresses[index] = {
//                           ...newAddresses[index],
//                           [field.key]: e.target.value,
//                         };
//                         formik.setFieldValue("address", newAddresses);
//                       }}
//                       onBlur={() => {
//                         formik.setFieldTouched(
//                           `address[${index}].${field.key}`,
//                           true
//                         );
//                         autoSave(formik.values);
//                       }}
//                     />
//                   ))}
//               </div>
//             </Card>
//           );
//         })}
//         <Button variant="outline" onClick={handleAdd}>
//           + Add Address
//         </Button>
//       </div>
//     );
//   };

//   // ---------- Field renderer (editable, autosave) ----------
//   const renderField = useCallback(
//     (field: any, pathPrefix: string) => {
//       if (!evaluateShowIfRender(field)) return null;

//       const fullPath = `${pathPrefix}.${field.key}`;
//       const value = get(formik.values, fullPath);
//       const error = get(formik.errors, fullPath);
//       const touched = get(formik.touched, fullPath);
//       const showError = Boolean(touched && error);

//       const Label = (
//         <>
//           {field.label}
//           {field.required && <span className="text-red-500 ml-1">*</span>}
//         </>
//       );

//       switch (field.type) {
//         case "text":
//         case "email":
//           return (
//             <div key={fullPath}>
//               <Input
//                 type={field.type}
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value || ""}
//                 onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "textarea":
//           return (
//             <div key={fullPath}>
//               <Textarea
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value || ""}
//                 onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "checkbox":
//           return (
//             <div key={fullPath}>
//               <Checkbox
//                 label={Label}
//                 checked={!!value}
//                 onChange={(e) =>
//                   formik.setFieldValue(fullPath, e.target.checked)
//                 }
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "date": {
//           return (
//             <div key={fullPath} className="space-y-1">
//               <label className="text-sm font-medium text-gray-700">
//                 {Label}
//               </label>
//               <ReactDatePicker
//                 selected={value ? new Date(value) : null}
//                 dateFormat="dd/MM/yyyy"
//                 onChange={(val) => {
//                   const iso = val ? val.toISOString() : null;
//                   formik.setFieldValue(fullPath, iso);
//                   const updated = { ...formik.values };
//                   set(updated, fullPath, iso);
//                   autoSave(updated);
//                 }}
//                 inputProps={{ placeholder: field.placeholder }}
//                 onBlur={() => formik.setFieldTouched(fullPath, true)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         }
//         case "number":
//           return (
//             <div key={fullPath}>
//               <Input
//                 type="number"
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value ?? ""}
//                 onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "select":
//           return (
//             <div key={fullPath}>
//               <Select
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={
//                   (field.options || [])
//                     .map((o: string) => ({ label: o, value: o }))
//                     .find((opt: any) => opt.value === value) || null
//                 }
//                 onChange={(opt: any) =>
//                   formik.setFieldValue(fullPath, opt?.value || "")
//                 }
//                 options={(field.options || []).map((o: string) => ({
//                   label: o,
//                   value: o,
//                 }))}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "reference": {
//           const opts =
//             referenceOptions[(field as any).referenceModel as string] || [];
//           return (
//             <div key={fullPath}>
//               <Select
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={
//                   opts.find(
//                     (opt) =>
//                       String(opt.value) ===
//                       String(typeof value === "object" ? value?._id : value)
//                   ) || null
//                 }
//                 onChange={(opt: any) => {
//                   const id = opt?.value || "";
//                   formik.setFieldValue(fullPath, id);
//                   const updated = { ...formik.values };
//                   set(updated, fullPath, id);
//                   autoSave(updated);
//                 }}
//                 options={opts}
//                 onBlur={() => formik.setFieldTouched(fullPath, true)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         }
//         case "file":
//           return (
//             <FileUploadField
//               key={fullPath}
//               field={field}
//               fullPath={fullPath}
//               value={value}
//               formik={formik}
//               autoSave={autoSave}
//             />
//           );
//         default:
//           return null;
//       }
//     },
//     [referenceOptions, formik, autoSave, evaluateShowIfRender]
//   );

//   // ---------- Continue (simple submit; no prompts) ----------
//   const handleContinue = async () => {
//     try {
//       setSaveStatus("saving");

//       const cleaned = deepClean(formik.values);

//       // Split into profile-shaped fields + flattened additionalFields
//       const { profileUpdates, additionalFields } =
//         splitProfileAndAdditionalFields(cleaned, sections);

//       // Write the Employee mirror (keeps backend parity with autosave)
//       await axiosInstance.put("/employees/me/employee-fields", {
//         employeeFields: {
//           ...profileUpdates,
//           additionalFields: additionalFields ?? [],
//         },
//       });

//       toast.success("Profile updated");
//       setSaveStatus("success");
//       startTransition(() => router.push("/nexus-profile"));
//     } catch (e: any) {
//       console.error(e);
//       setSaveStatus("error");
//       toast.error(e?.response?.data?.message || "Failed to continue.");
//     }
//   };

//   // ---------- Render ----------
//   if (loading) {
//     return (
//       <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//         <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
//           <div className="h-28 sm:h-32 bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 rounded-xl" />
//           <div className="animate-pulse space-y-4">
//             <div className="h-6 w-48 bg-gray-200 rounded" />
//             <div className="h-4 w-72 bg-gray-200 rounded" />
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {[...Array(6)].map((_, i) => (
//                 <div key={i} className="h-16 bg-gray-100 rounded-xl" />
//               ))}
//             </div>
//           </div>
//         </Card>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="max-w-md mx-auto py-16 px-6">
//         <div className="rounded-2xl border border-red-200 bg-white shadow">
//           <div className="p-5 border-b border-red-100 bg-rose-50 rounded-t-2xl">
//             <h2 className="text-red-700 font-semibold">
//               Couldn’t load details
//             </h2>
//           </div>
//           <div className="p-5 text-sm text-gray-700">{error}</div>
//           <div className="p-5 pt-0">
//             <button
//               onClick={() => router.refresh()}
//               className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
//             >
//               Try again
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
//         {/* Header row */}
//         <div className="flex items-center justify-between flex-wrap gap-2">
//           <div>
//             <h2 className="text-xl font-semibold text-gray-900">
//               Joined Company
//             </h2>
//             {orgLabel ? (
//               <p className="text-sm text-gray-500 mt-1">
//                 Organization: {orgLabel}
//               </p>
//             ) : null}
//           </div>

//           <div
//             className={[
//               "text-xs px-3 py-1.5 rounded-full border shadow-sm",
//               saveStatus === "saving" &&
//                 "border-blue-200 bg-blue-50 text-blue-700",
//               saveStatus === "success" &&
//                 "border-green-200 bg-green-50 text-green-700",
//               saveStatus === "error" && "border-red-200 bg-red-50 text-red-700",
//               saveStatus === "idle" &&
//                 "border-gray-200 bg-gray-50 text-gray-600",
//             ]
//               .filter(Boolean)
//               .join(" ")}
//           >
//             {saveStatus === "saving" && "💾 Saving…"}
//             {saveStatus === "success" && "✅ Saved"}
//             {saveStatus === "error" && "⚠️ Save error"}
//             {saveStatus === "idle" && "Auto-save enabled"}
//           </div>
//         </div>

//         {/* Editable form */}
//         <form
//           onSubmit={formik.handleSubmit}
//           className="space-y-6"
//           id="joinedReviewForm"
//         >
//           <Tab>
//             <Tab.List className="gap-2 border-b pb-2 mb-4">
//               {visibleSections.map((section) => (
//                 <Tab.ListItem
//                   key={section.sectionKey}
//                   className="text-sm font-medium px-4 py-2 rounded-md"
//                 >
//                   {section.sectionLabel}
//                 </Tab.ListItem>
//               ))}
//             </Tab.List>

//             <Tab.Panels>
//               {visibleSections.map((section) => (
//                 <Tab.Panel key={section.sectionKey}>
//                   {section.sectionKey === "address" ? (
//                     renderAddressSection(section.fields || [])
//                   ) : (
//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                       {(section.fields || []).map((field: any) =>
//                         renderField(field, section.sectionKey)
//                       )}
//                     </div>
//                   )}

//                   {(section.innerSections || []).map((inner: any) => {
//                     const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//                     const groupError = get(formik.errors, groupPath);

//                     return (
//                       <div
//                         key={inner.sectionKey}
//                         className="mt-8 border-t border-gray-200 pt-6"
//                       >
//                         <h4 className="text-base font-medium text-gray-700 mb-4">
//                           {inner.sectionLabel}
//                         </h4>

//                         {typeof groupError === "string" && (
//                           <div className="text-sm text-red-500 mb-3">
//                             {groupError}
//                           </div>
//                         )}

//                         {section.sectionKey === "documents" ? (
//                           <DocumentSection
//                             inner={inner}
//                             sectionKeyPath={groupPath}
//                             selectedDocuments={selectedDocuments}
//                             setSelectedDocuments={setSelectedDocuments}
//                             formik={formik}
//                             onOpenModal={handleOpenModal}
//                           />
//                         ) : (
//                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                             {(inner.fields || []).map((field: any) =>
//                               renderField(field, groupPath)
//                             )}
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </Tab.Panel>
//               ))}
//             </Tab.Panels>
//           </Tab>
//         </form>
//       </Card>

//       {/* Fixed bottom action bar */}
//       <div className="fixed inset-x-0 bottom-0 z-40">
//         <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
//           <div className="relative">
//             <div className="absolute inset-0 -top-2 blur-xl bg-gradient-to-r from-indigo-400/20 via-fuchsia-400/20 to-sky-400/20 pointer-events-none" />
//             <div className="relative flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur px-4 sm:px-6 py-3 shadow-lg shadow-gray-200/50">
//               <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
//                 Review and edit your details. Changes are autosaved.
//               </div>
//               <div className="flex items-center gap-3">
//                 {saveStatus === "saving" && (
//                   <span className="text-xs sm:text-sm text-blue-600">
//                     Saving…
//                   </span>
//                 )}
//                 <Button
//                   type="button"
//                   onClick={handleContinue}
//                   className="inline-flex items-center justify-center gap-2 rounded-xl px-5 sm:px-6 py-2.5
//                     bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600
//                     text-white shadow-md hover:shadow-lg transition
//                     hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700
//                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
//                 >
//                   <span className="text-sm font-semibold">Continue</span>
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </div>
//         <div className="h-[env(safe-area-inset-bottom)]" />
//       </div>

//       {/* Document modal */}
//       {activeUploadField && (
//         <DocumentUploadModal
//           isOpen={modalOpen}
//           onClose={() => setModalOpen(false)}
//           field={activeUploadField.field}
//           fullPath={activeUploadField.fullPath}
//           formik={formik}
//           autoSave={autoSave}
//         />
//       )}
//     </div>
//   );
// }

// ---------------------------

// /* eslint-disable react-hooks/rules-of-hooks */
// "use client";

// import React, {
//   useEffect,
//   useMemo,
//   useState,
//   useCallback,
//   startTransition,
// } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Button, Input, Textarea, Checkbox, Select, Tab } from "rizzui";
// import axiosInstance from "@/app/lib/axios";
// import get from "lodash/get";
// import set from "lodash/set";
// import toast from "react-hot-toast";
// import { Card } from "@/app/components/ui/Card";
// import { useFormik } from "formik";

// import DocumentUploadModal from "../components/shared/DocumentUploadModal";
// import FileUploadField from "../components/ui/FileUploadField";
// import DocumentSection from "../components/ui/DocumentSection";
// import ReactDatePicker from "../components/ui/DatePicker";

// // 👉 if your modal lives elsewhere, adjust this import path
// import AdditionalFieldsPromptModal, {
//   AdditionalCandidate,
// } from "./AdditionalFieldsPromptModal";

// import {
//   deepClean,
//   splitProfileAndAdditionalFields,
//   findValueByFieldKeyAnywhere,
//   hasMeaningfulValue,
//   buildAdditionalCandidates,
// } from "@/app/utils/profile-utils";
// import { useDebouncedAutosave } from "@/app/hooks/useDebouncedAutosave";

// // ---------- Types ----------
// type Field = {
//   key: string;
//   label: string;
//   type:
//     | "text"
//     | "textarea"
//     | "email"
//     | "date"
//     | "number"
//     | "file"
//     | "select"
//     | "checkbox"
//     | "reference";
//   isAdditional?: boolean;
//   placeholder?: string;
//   referenceModel?: string;
//   required?: boolean;
//   options?: string[];
//   showIf?: {
//     fieldKey: string;
//     operator: "equals" | "notEquals";
//     value: any;
//   };
// };

// type InnerSection = {
//   sectionKey: string;
//   sectionLabel: string;
//   requirementMode?: "AND" | "OR";
//   fields: Field[];
// };

// type Section = {
//   sectionKey: string;
//   sectionLabel: string;
//   employeerOnlyEditable?: boolean;
//   fields?: Field[];
//   innerSections?: InnerSection[];
// };

// type JoinedConfigResponse = {
//   sections: Section[];
//   tenantName?: string;
//   branchName?: string;
// };

// type ProfileResponse = any;

// // ---------- Component ----------
// export default function JoinedCompanyReview() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const branchId = searchParams.get("branchId") as string;
//   const tenantId = searchParams.get("tenantId") as string;

//   // UI + data state
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);

//   const [config, setConfig] = useState<JoinedConfigResponse | null>(null);
//   const [sections, setSections] = useState<Section[]>([]);
//   const [profile, setProfile] = useState<ProfileResponse | null>(null);

//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});
//   const [referenceOptions, setReferenceOptions] = useState<
//     Record<string, { label: string; value: string }[]>
//   >({});

//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({});

//   const [saveStatus, setSaveStatus] = useState<
//     "idle" | "saving" | "success" | "error"
//   >("idle");

//   // AdditionalFields prompt (same flow as AcceptInvitation)
//   const [postAcceptOpen, setPostAcceptOpen] = useState(false);
//   const [postAcceptCandidates, setPostAcceptCandidates] = useState<
//     AdditionalCandidate[]
//   >([]);
//   const [postAcceptBusy, setPostAcceptBusy] = useState(false);
//   const [lastCleanValues, setLastCleanValues] = useState<any>(null);

//   // Document upload modal
//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);
//   const handleOpenModal = (field: any, fullPath: string) => {
//     setActiveUploadField({ field, fullPath });
//     setModalOpen(true);
//   };

//   // Visible (non-employer-only) sections
//   const visibleSections = useMemo(
//     () => (sections || []).filter((s) => !s.employeerOnlyEditable),
//     [sections]
//   );

//   const orgLabel = useMemo(() => {
//     if (!config) return "Organization";
//     if (config.tenantName && config.branchName) {
//       return `${config.tenantName} / ${config.branchName}`;
//     }
//     return config.tenantName || config.branchName || "Organization";
//   }, [config]);

//   // --- Cross-field helpers: index field keys once; resolve key globally (ignoring sectionKey) ---
//   type Occurrence = {
//     sectionKey: string;
//     innerSectionKey?: string | null;
//     type: string; // "file" | "text" | ...
//     isAdditional?: boolean;
//   };

//   const buildFieldKeyIndex = (cfg: Section[]): Record<string, Occurrence[]> => {
//     const map: Record<string, Occurrence[]> = {};
//     for (const section of cfg) {
//       for (const f of section.fields || []) {
//         (map[f.key] ||= []).push({
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           type: f.type,
//           isAdditional: !!f.isAdditional,
//         });
//       }
//       for (const inner of section.innerSections || []) {
//         for (const f of inner.fields || []) {
//           (map[f.key] ||= []).push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             type: f.type,
//             isAdditional: !!f.isAdditional,
//           });
//         }
//       }
//     }
//     return map;
//   };

//   const readExactFromProfile = (
//     prof: any,
//     occ: Occurrence,
//     fieldKey: string
//   ) => {
//     if (occ.isAdditional) {
//       const match = (prof.additionalFields || []).find(
//         (a: any) =>
//           a.sectionKey === occ.sectionKey &&
//           (a.innerSectionKey ?? null) === (occ.innerSectionKey ?? null) &&
//           a.fieldKey === fieldKey
//       );
//       return match?.value;
//     }
//     const path = occ.innerSectionKey
//       ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
//       : `${occ.sectionKey}.${fieldKey}`;
//     return get(prof, path);
//   };

//   const resolveValueForKey = (
//     prof: any,
//     fieldKey: string,
//     occs: Occurrence[]
//   ) => {
//     const candidates: any[] = [];
//     // 1) Exact placements
//     for (const occ of occs) {
//       const v = readExactFromProfile(prof, occ, fieldKey);
//       if (hasMeaningfulValue(v, occ.type)) candidates.push(v);
//     }
//     // 2) Any additional field with same key (ignores sectionKey)
//     const addAny = (prof.additionalFields || []).find(
//       (a: any) => a.fieldKey === fieldKey
//     )?.value;
//     if (hasMeaningfulValue(addAny)) candidates.push(addAny);
//     // 3) Deep search anywhere
//     const deep = findValueByFieldKeyAnywhere(prof, fieldKey);
//     if (hasMeaningfulValue(deep)) candidates.push(deep);

//     // Prefer files, then non-empty strings, then anything meaningful
//     for (const c of candidates) {
//       if (c && typeof c === "object" && "url" in c && (c as any).url) return c;
//     }
//     for (const c of candidates) {
//       if (typeof c === "string" && c.trim()) return c;
//     }
//     for (const c of candidates) {
//       if (hasMeaningfulValue(c)) return c;
//     }
//     return undefined;
//   };

//   // --- boot data (config + profile) ---
//   useEffect(() => {
//     const boot = async () => {
//       setLoading(true);
//       setError(null);
//       try {
//         const [{ data: cfgRes }, { data: profRes }] = await Promise.all([
//           axiosInstance.get("/employee-field-config/by-org", {
//             params: { tenantId, branchId },
//           }),
//           axiosInstance.get("/employee-profiles/self/get"),
//         ]);

//         const cfgData = cfgRes?.data || cfgRes;
//         const cfgSections: Section[] = cfgData?.sections || [];
//         setConfig({
//           sections: cfgSections,
//           tenantName: cfgData?.tenantName,
//           branchName: cfgData?.branchName,
//         });
//         setSections(cfgSections);

//         const prof = profRes?.data || profRes;
//         setProfile(prof);

//         // Build initial values w/ global cross-fill by field key
//         const values: Record<string, any> = {};

//         // special: address as array
//         values["address"] =
//           prof["address"] && Array.isArray(prof["address"])
//             ? prof["address"]
//             : [{}];

//         // pre-seed structure
//         for (const section of cfgSections) {
//           if (section.sectionKey === "address") continue;
//           if (!values[section.sectionKey]) values[section.sectionKey] = {};
//           for (const inner of section.innerSections || []) {
//             if (!values[section.sectionKey][inner.sectionKey]) {
//               values[section.sectionKey][inner.sectionKey] = {};
//             }
//           }
//         }

//         const idx = buildFieldKeyIndex(cfgSections);

//         for (const [fieldKey, occs] of Object.entries(idx)) {
//           const resolved = resolveValueForKey(prof, fieldKey, occs);
//           for (const occ of occs) {
//             const path = occ.innerSectionKey
//               ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
//               : `${occ.sectionKey}.${fieldKey}`;
//             const fallback =
//               occ.type === "checkbox" ? false : occ.type === "file" ? {} : "";
//             set(
//               values,
//               path,
//               hasMeaningfulValue(resolved, occ.type) ? resolved : fallback
//             );
//           }
//         }

//         // Prefill OR-document radio selection
//         const initialSelected: Record<string, string> = {};
//         for (const section of cfgSections) {
//           for (const inner of section.innerSections || []) {
//             if (inner.requirementMode !== "OR") continue;
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const chosen = (inner.fields || []).find((f: any) => {
//               const v = get(values, `${groupPath}.${f.key}`);
//               return (
//                 (typeof v === "string" && !!v) ||
//                 (v && typeof v === "object" && Object.keys(v).length > 0)
//               );
//             });
//             if (chosen) initialSelected[groupPath] = chosen.key;
//           }
//         }

//         setSelectedDocuments(initialSelected);
//         setInitialValues(values);
//       } catch (e: any) {
//         setError(
//           e?.response?.data?.message || "Unable to load joined company data."
//         );
//       } finally {
//         setLoading(false);
//       }
//     };
//     boot();
//   }, [tenantId, branchId]);

//   // fetch reference lists used in config
//   useEffect(() => {
//     const loadRef = async () => {
//       const models = new Set<string>();
//       sections.forEach((s) => {
//         (s.fields || []).forEach(
//           (f: any) => f.type === "reference" && models.add(f.referenceModel)
//         );
//         (s.innerSections || []).forEach((inn: any) =>
//           (inn.fields || []).forEach(
//             (f: any) => f.type === "reference" && models.add(f.referenceModel)
//           )
//         );
//       });
//       await Promise.all(
//         Array.from(models).map(async (m) => {
//           try {
//             const res = await axiosInstance.get(`/${m.toLowerCase()}s`);
//             const data = res.data?.data || [];
//             const opts = data.map((item: any) => ({
//               label:
//                 m === "Employee"
//                   ? item?.employeeProfile?.personaldetails?.firstname ||
//                     "Unnamed"
//                   : item?.name || "Unnamed",
//               value: item._id,
//             }));
//             setReferenceOptions((prev) => ({ ...prev, [m]: opts }));
//           } catch (e) {
//             console.error(`Failed to fetch ${m}`, e);
//           }
//         })
//       );
//     };
//     if (sections.length) loadRef();
//   }, [sections]);

//   // ---------- Autosave ----------
//   const rawAutoSave = useCallback(
//     async (values: any) => {
//       try {
//         setSaveStatus("saving");
//         const cleaned = deepClean(values);
//         const { profileUpdates, additionalFields } =
//           splitProfileAndAdditionalFields(cleaned, sections);
//         const payload = { ...profileUpdates, additionalFields };
//         await axiosInstance.put(`/employee-profiles/self/update`, payload);
//         setSaveStatus("success");
//       } catch (e) {
//         console.error("Auto-save error", e);
//         setSaveStatus("error");
//         toast.error("Auto-save failed.");
//       }
//     },
//     [sections]
//   );
//   const autoSave = useDebouncedAutosave(rawAutoSave, 700);

//   // ---------- Form ----------
//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     validate: (values) => {
//       // define local evaluator here so we don’t reference formik before init
//       const evalShowIf = (field: any) => {
//         if (!field.showIf) return true;
//         const findValue = (obj: any, key: string): any => {
//           if (!obj || typeof obj !== "object") return undefined;
//           if (key in obj) return obj[key];
//           for (const k of Object.keys(obj)) {
//             const found = findValue(obj[k], key);
//             if (found !== undefined) return found;
//           }
//           return undefined;
//         };
//         const actual = findValue(values, field.showIf.fieldKey);
//         return field.showIf.operator === "equals"
//           ? actual === field.showIf.value
//           : actual !== field.showIf.value;
//       };

//       const errors: any = {};
//       for (const section of visibleSections) {
//         for (const field of section.fields || []) {
//           if (!evalShowIf(field)) continue;
//           const path = `${section.sectionKey}.${field.key}`;
//           const val = get(values, path);
//           if (field.required) {
//             if (field.type === "checkbox") {
//               if (!val) set(errors, path, "This field is required.");
//             } else if (field.type === "file") {
//               if (!val?.url) set(errors, path, "Please upload a file.");
//             } else if (field.type === "date") {
//               if (!val) set(errors, path, "Please select a date.");
//             } else if (field.type === "select" || field.type === "reference") {
//               if (!val) set(errors, path, "Please select an option.");
//             } else if (!val && val !== 0) {
//               set(errors, path, "This field is required.");
//             }
//           }
//         }

//         for (const inner of section.innerSections || []) {
//           const mode = inner.requirementMode || "AND";

//           if (mode === "AND") {
//             for (const field of inner.fields || []) {
//               if (!evalShowIf(field)) continue;
//               if (field.type !== "file") continue;
//               if (!field.required) continue;

//               const path = `${section.sectionKey}.${inner.sectionKey}.${field.key}`;
//               const val = get(values, path);
//               if (!val?.url) {
//                 set(errors, path, "Please upload a file.");
//               }
//             }
//           } else {
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const chosenKey = selectedDocuments[groupPath];

//             if (!chosenKey) {
//               set(errors, groupPath, "Select one document to provide.");
//             } else {
//               inner.fields.forEach((f: any) => {
//                 if (f.key !== chosenKey) return;
//                 const path = `${groupPath}.${f.key}`;
//                 const val = get(values, path);
//                 if (f.type === "file" && !val?.url) {
//                   set(errors, path, "Please upload the selected document.");
//                 }
//               });
//             }
//           }
//         }
//       }
//       return errors;
//     },
//     // no explicit submit; edits autosave
//     onSubmit: () => {},
//   });

//   // showIf evaluator for RENDER (safe now because formik exists)
//   const evaluateShowIfRender = useCallback(
//     (field: any) => {
//       if (!field.showIf) return true;
//       const findValue = (obj: any, key: string): any => {
//         if (!obj || typeof obj !== "object") return undefined;
//         if (key in obj) return obj[key];
//         for (const k of Object.keys(obj)) {
//           const found = findValue(obj[k], key);
//           if (found !== undefined) return found;
//         }
//         return undefined;
//       };
//       const actual = findValue(formik.values, field.showIf.fieldKey);
//       return field.showIf.operator === "equals"
//         ? actual === field.showIf.value
//         : actual !== field.showIf.value;
//     },
//     [formik.values]
//   );

//   // ---------- Address UI (editable) ----------
//   const renderAddressSection = (fields: any[]) => {
//     const addresses = formik.values.address || [];

//     const handleAdd = () => {
//       const newList = [...addresses, {}];
//       formik.setFieldValue("address", newList);
//       autoSave({ ...formik.values, address: newList });
//     };

//     const handleRemove = (i: number) => {
//       const newList = addresses.filter((_: any, idx: number) => idx !== i);
//       formik.setFieldValue("address", newList);
//       autoSave({ ...formik.values, address: newList });
//     };

//     return (
//       <div className="space-y-6">
//         {addresses.map((address: any, index: number) => {
//           return (
//             <Card
//               key={index}
//               className="relative border border-gray-200 shadow-md p-0 overflow-hidden"
//             >
//               <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
//                 <div className="w-full px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50 shadow-sm">
//                   <div className="relative">
//                     <input
//                       type="text"
//                       id={`addressFor-${index}`}
//                       className="peer block w-full px-4 pt-5 pb-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-transparent"
//                       placeholder="e.g., Home, Office"
//                       value={address?.addressFor || ""}
//                       onChange={(e) => {
//                         const updated = [...addresses];
//                         updated[index] = {
//                           ...updated[index],
//                           addressFor: e.target.value,
//                         };
//                         formik.setFieldValue("address", updated);
//                       }}
//                       onBlur={() => {
//                         const updated = [...addresses];
//                         updated[index] = {
//                           ...updated[index],
//                           addressFor: addresses[index]?.addressFor || "",
//                         };
//                         formik.setFieldValue("address", updated);
//                         autoSave({ ...formik.values, address: updated });
//                       }}
//                     />
//                     <label
//                       htmlFor={`addressFor-${index}`}
//                       className="absolute left-4 top-2 text-xs font-semibold text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold"
//                     >
//                       Address Label (e.g., Home, Office)
//                     </label>
//                   </div>
//                 </div>

//                 {addresses.length > 1 && (
//                   <button
//                     type="button"
//                     onClick={() => handleRemove(index)}
//                     className="ml-4 text-red-500 hover:text-red-600 text-xs"
//                   >
//                     Remove
//                   </button>
//                 )}
//               </div>

//               <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
//                 {fields
//                   .filter((f: any) => f.key !== "addressFor")
//                   .map((field: any) => (
//                     <Input
//                       key={`address[${index}].${field.key}`}
//                       label={field.label}
//                       placeholder={field.placeholder}
//                       value={formik.values.address[index]?.[field.key] || ""}
//                       onChange={(e) => {
//                         const newAddresses = [...addresses];
//                         newAddresses[index] = {
//                           ...newAddresses[index],
//                           [field.key]: e.target.value,
//                         };
//                         formik.setFieldValue("address", newAddresses);
//                       }}
//                       onBlur={() => {
//                         formik.setFieldTouched(
//                           `address[${index}].${field.key}`,
//                           true
//                         );
//                         autoSave(formik.values);
//                       }}
//                     />
//                   ))}
//               </div>
//             </Card>
//           );
//         })}
//         <Button variant="outline" onClick={handleAdd}>
//           + Add Address
//         </Button>
//       </div>
//     );
//   };

//   // ---------- Field renderer (editable, autosave) ----------
//   const renderField = useCallback(
//     (field: any, pathPrefix: string) => {
//       if (!evaluateShowIfRender(field)) return null;

//       const fullPath = `${pathPrefix}.${field.key}`;
//       const value = get(formik.values, fullPath);
//       const error = get(formik.errors, fullPath);
//       const touched = get(formik.touched, fullPath);
//       const showError = Boolean(touched && error);

//       const Label = (
//         <>
//           {field.label}
//           {field.required && <span className="text-red-500 ml-1">*</span>}
//         </>
//       );

//       switch (field.type) {
//         case "text":
//         case "email":
//           return (
//             <div key={fullPath}>
//               <Input
//                 type={field.type}
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value || ""}
//                 onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "textarea":
//           return (
//             <div key={fullPath}>
//               <Textarea
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value || ""}
//                 onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "checkbox":
//           return (
//             <div key={fullPath}>
//               <Checkbox
//                 label={Label}
//                 checked={!!value}
//                 onChange={(e) =>
//                   formik.setFieldValue(fullPath, e.target.checked)
//                 }
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "date": {
//           return (
//             <div key={fullPath} className="space-y-1">
//               <label className="text-sm font-medium text-gray-700">
//                 {Label}
//               </label>
//               <ReactDatePicker
//                 selected={value ? new Date(value) : null}
//                 dateFormat="dd/MM/yyyy"
//                 onChange={(val) => {
//                   const iso = val ? val.toISOString() : null;
//                   formik.setFieldValue(fullPath, iso);
//                   const updated = { ...formik.values };
//                   set(updated, fullPath, iso);
//                   autoSave(updated);
//                 }}
//                 inputProps={{ placeholder: field.placeholder }}
//                 onBlur={() => formik.setFieldTouched(fullPath, true)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         }
//         case "number":
//           return (
//             <div key={fullPath}>
//               <Input
//                 type="number"
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={value ?? ""}
//                 onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "select":
//           return (
//             <div key={fullPath}>
//               <Select
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={
//                   (field.options || [])
//                     .map((o: string) => ({ label: o, value: o }))
//                     .find((opt: any) => opt.value === value) || null
//                 }
//                 onChange={(opt: any) =>
//                   formik.setFieldValue(fullPath, opt?.value || "")
//                 }
//                 options={(field.options || []).map((o: string) => ({
//                   label: o,
//                   value: o,
//                 }))}
//                 onBlur={() => autoSave(formik.values)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         case "reference": {
//           const opts =
//             referenceOptions[(field as any).referenceModel as string] || [];
//           return (
//             <div key={fullPath}>
//               <Select
//                 label={Label}
//                 placeholder={field.placeholder}
//                 value={
//                   opts.find(
//                     (opt) =>
//                       String(opt.value) ===
//                       String(typeof value === "object" ? value?._id : value)
//                   ) || null
//                 }
//                 onChange={(opt: any) => {
//                   const id = opt?.value || "";
//                   formik.setFieldValue(fullPath, id);
//                   const updated = { ...formik.values };
//                   set(updated, fullPath, id);
//                   autoSave(updated);
//                 }}
//                 options={opts}
//                 onBlur={() => formik.setFieldTouched(fullPath, true)}
//               />
//               {showError && (
//                 <p className="text-xs text-red-500 mt-1">{error as any}</p>
//               )}
//             </div>
//           );
//         }
//         case "file":
//           return (
//             <FileUploadField
//               key={fullPath}
//               field={field}
//               fullPath={fullPath}
//               value={value}
//               formik={formik}
//               autoSave={autoSave}
//             />
//           );
//         default:
//           return null;
//       }
//     },
//     [referenceOptions, formik, autoSave, evaluateShowIfRender]
//   );

//   // ----- AdditionalFields prompt handlers -----
//   const handlePostAcceptClose = () => {
//     setPostAcceptOpen(false);
//     startTransition(() => router.push("/nexus-profile"));
//   };

//   const handlePostAcceptConfirm = async (selectedIds: string[]) => {
//     try {
//       setPostAcceptBusy(true);
//       const selected = new Set(selectedIds);

//       const updates = postAcceptCandidates.map((c) => ({
//         sectionKey: c.sectionKey,
//         innerSectionKey: c.innerSectionKey ?? null,
//         fieldKey: c.fieldKey,
//         value: get(lastCleanValues || formik.values, c.path),
//         isShowInProfile: selected.has(c.id),
//       }));

//       await axiosInstance.put(`/employee-profiles/self/update`, {
//         additionalFields: updates,
//       });

//       toast.success("Profile updated");
//       handlePostAcceptClose();
//     } catch (e) {
//       console.error(e);
//       toast.error("Could not update profile. Please try again.");
//     } finally {
//       setPostAcceptBusy(false);
//     }
//   };

//   const handleContinue = async () => {
//     try {
//       setSaveStatus("saving");

//       // 1) Clean current values
//       const cleaned = deepClean(formik.values);
//       setLastCleanValues(cleaned);

//       // 2) Split into profile-shaped fields + flattened additionalFields
//       const { profileUpdates, additionalFields } =
//         splitProfileAndAdditionalFields(cleaned, sections);

//       // 3) Write the Employee mirror (now includes additionalFields!)
//       await axiosInstance.put("/employees/me/employee-fields", {
//         employeeFields: {
//           ...profileUpdates,
//           additionalFields: additionalFields ?? [],
//         },
//       });

//       // 4) Refresh profile to evaluate flags accurately
//       const { data: freshRes } = await axiosInstance.get(
//         `/employee-profiles/self/get`
//       );
//       const freshProfile = freshRes?.data || freshRes;
//       setProfile(freshProfile);

//       // 5) Build raw candidates from current values
//       const rawCandidates = buildAdditionalCandidates(
//         cleaned,
//         sections,
//         freshProfile,
//         get
//       );

//       // 6) Filter OUT anything already marked isShowInProfile === true
//       const alreadyShown = new Set(
//         (freshProfile?.additionalFields || [])
//           .filter((f: any) => f?.isShowInProfile)
//           .map(
//             (f: any) =>
//               `${f.sectionKey}||${f.innerSectionKey ?? ""}||${f.fieldKey}`
//           )
//       );

//       const candidates = rawCandidates.filter(
//         (c) =>
//           !alreadyShown.has(
//             `${c.sectionKey}||${c.innerSectionKey ?? ""}||${c.fieldKey}`
//           )
//       );

//       setSaveStatus("success");

//       if (candidates.length > 0) {
//         setPostAcceptCandidates(candidates);
//         setPostAcceptOpen(true);
//         toast.success("One more step… choose what to show on your profile.");
//       } else {
//         // Nothing new to add, move on
//         startTransition(() => router.push("/nexus-profile"));
//       }
//     } catch (e: any) {
//       console.error(e);
//       setSaveStatus("error");
//       toast.error(e?.response?.data?.message || "Failed to continue.");
//     }
//   };

//   // ---------- Render ----------
//   if (loading) {
//     return (
//       <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//         <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
//           <div className="h-28 sm:h-32 bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 rounded-xl" />
//           <div className="animate-pulse space-y-4">
//             <div className="h-6 w-48 bg-gray-200 rounded" />
//             <div className="h-4 w-72 bg-gray-200 rounded" />
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {[...Array(6)].map((_, i) => (
//                 <div key={i} className="h-16 bg-gray-100 rounded-xl" />
//               ))}
//             </div>
//           </div>
//         </Card>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="max-w-md mx-auto py-16 px-6">
//         <div className="rounded-2xl border border-red-200 bg-white shadow">
//           <div className="p-5 border-b border-red-100 bg-rose-50 rounded-t-2xl">
//             <h2 className="text-red-700 font-semibold">
//               Couldn’t load details
//             </h2>
//           </div>
//           <div className="p-5 text-sm text-gray-700">{error}</div>
//           <div className="p-5 pt-0">
//             <button
//               onClick={() => router.refresh()}
//               className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50"
//             >
//               Try again
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
//         {/* Header row */}
//         <div className="flex items-center justify-between flex-wrap gap-2">
//           <div>
//             <h2 className="text-xl font-semibold text-gray-900">
//               Joined Company
//             </h2>
//             {orgLabel ? (
//               <p className="text-sm text-gray-500 mt-1">
//                 Organization: {orgLabel}
//               </p>
//             ) : null}
//           </div>

//           <div
//             className={[
//               "text-xs px-3 py-1.5 rounded-full border shadow-sm",
//               saveStatus === "saving" &&
//                 "border-blue-200 bg-blue-50 text-blue-700",
//               saveStatus === "success" &&
//                 "border-green-200 bg-green-50 text-green-700",
//               saveStatus === "error" && "border-red-200 bg-red-50 text-red-700",
//               saveStatus === "idle" &&
//                 "border-gray-200 bg-gray-50 text-gray-600",
//             ]
//               .filter(Boolean)
//               .join(" ")}
//           >
//             {saveStatus === "saving" && "💾 Saving…"}
//             {saveStatus === "success" && "✅ Saved"}
//             {saveStatus === "error" && "⚠️ Save error"}
//             {saveStatus === "idle" && "Auto-save enabled"}
//           </div>
//         </div>

//         {/* Editable form */}
//         <form
//           onSubmit={formik.handleSubmit}
//           className="space-y-6"
//           id="joinedReviewForm"
//         >
//           <Tab>
//             <Tab.List className="gap-2 border-b pb-2 mb-4">
//               {visibleSections.map((section) => (
//                 <Tab.ListItem
//                   key={section.sectionKey}
//                   className="text-sm font-medium px-4 py-2 rounded-md"
//                 >
//                   {section.sectionLabel}
//                 </Tab.ListItem>
//               ))}
//             </Tab.List>

//             <Tab.Panels>
//               {visibleSections.map((section) => (
//                 <Tab.Panel key={section.sectionKey}>
//                   {section.sectionKey === "address" ? (
//                     renderAddressSection(section.fields || [])
//                   ) : (
//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                       {(section.fields || []).map((field: any) =>
//                         renderField(field, section.sectionKey)
//                       )}
//                     </div>
//                   )}

//                   {(section.innerSections || []).map((inner: any) => {
//                     const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//                     const groupError = get(formik.errors, groupPath);

//                     return (
//                       <div
//                         key={inner.sectionKey}
//                         className="mt-8 border-t border-gray-200 pt-6"
//                       >
//                         <h4 className="text-base font-medium text-gray-700 mb-4">
//                           {inner.sectionLabel}
//                         </h4>

//                         {typeof groupError === "string" && (
//                           <div className="text-sm text-red-500 mb-3">
//                             {groupError}
//                           </div>
//                         )}

//                         {section.sectionKey === "documents" ? (
//                           <DocumentSection
//                             inner={inner}
//                             sectionKeyPath={groupPath}
//                             selectedDocuments={selectedDocuments}
//                             setSelectedDocuments={setSelectedDocuments}
//                             formik={formik}
//                             onOpenModal={handleOpenModal}
//                           />
//                         ) : (
//                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                             {(inner.fields || []).map((field: any) =>
//                               renderField(field, groupPath)
//                             )}
//                           </div>
//                         )}
//                       </div>
//                     );
//                   })}
//                 </Tab.Panel>
//               ))}
//             </Tab.Panels>
//           </Tab>
//         </form>
//       </Card>

//       {/* Fixed bottom action bar */}
//       <div className="fixed inset-x-0 bottom-0 z-40">
//         <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
//           <div className="relative">
//             <div className="absolute inset-0 -top-2 blur-xl bg-gradient-to-r from-indigo-400/20 via-fuchsia-400/20 to-sky-400/20 pointer-events-none" />
//             <div className="relative flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur px-4 sm:px-6 py-3 shadow-lg shadow-gray-200/50">
//               <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
//                 Review and edit your details. Changes are autosaved.
//               </div>
//               <div className="flex items-center gap-3">
//                 {saveStatus === "saving" && (
//                   <span className="text-xs sm:text-sm text-blue-600">
//                     Saving…
//                   </span>
//                 )}
//                 <Button
//                   type="button"
//                   onClick={handleContinue}
//                   disabled={postAcceptBusy}
//                   className="inline-flex items-center justify-center gap-2 rounded-xl px-5 sm:px-6 py-2.5
//                     bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600
//                     text-white shadow-md hover:shadow-lg transition
//                     hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700
//                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
//                 >
//                   <span className="text-sm font-semibold">Continue</span>
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </div>
//         <div className="h-[env(safe-area-inset-bottom)]" />
//       </div>

//       {/* Document modal */}
//       {activeUploadField && (
//         <DocumentUploadModal
//           isOpen={modalOpen}
//           onClose={() => setModalOpen(false)}
//           field={activeUploadField.field}
//           fullPath={activeUploadField.fullPath}
//           formik={formik}
//           autoSave={autoSave}
//         />
//       )}

//       {/* Post-accept (additional fields show/hide) */}
//       <AdditionalFieldsPromptModal
//         isOpen={postAcceptOpen}
//         onClose={handlePostAcceptClose}
//         candidates={postAcceptCandidates}
//         onConfirm={handlePostAcceptConfirm}
//         loading={postAcceptBusy}
//       />
//     </div>
//   );
// }
