/* eslint-disable @typescript-eslint/no-unused-expressions */
// "use client";

// import { Fragment, useEffect, useMemo, useState } from "react";
// import { Input, Button, Textarea, Select } from "rizzui";
// import { Dialog, Transition, Disclosure } from "@headlessui/react";
// import { Plus, X, ChevronsUpDownIcon, Lock, Eye, Pencil } from "lucide-react";
// import toast from "react-hot-toast";
// import axiosInstance from "@/app/lib/axios";

// /* --------------------------- Types --------------------------- */

// type EmployeeAccess = "hidden" | "view" | "edit";

// interface FileMeta {
//   expiryDate?: boolean;
//   issuingDate?: boolean;
//   validityPeriod?: string;
//   expiryIsDisabled?: boolean;
// }

// interface Field {
//   key: string;
//   label: string;
//   placeholder: string;
//   hint?: string;
//   required: boolean;
//   type: string;
//   isAdditional?: boolean;
//   options?: string[];
//   showIf?: {
//     fieldKey: string;
//     operator: "equals" | "notEquals";
//     value: any;
//   };
//   referenceModel?: string;
//   fileMeta?: FileMeta;
// }

// interface InnerSection {
//   sectionKey: string;
//   sectionLabel: string;
//   fields: Field[];
//   requirementMode?: "AND" | "OR";
//   isAdditional?: boolean;
//   innerSections?: InnerSection[];
//   employeeAccess?: EmployeeAccess;
// }

// interface Section {
//   sectionKey: string;
//   sectionLabel: string;
//   fields: Field[];
//   innerSections?: InnerSection[];
//   isAdditional?: boolean;
//   requirementMode?: "AND" | "OR";
//   employeeAccess?: EmployeeAccess;
// }

// /* --------------------------- Helpers --------------------------- */

// const PREDEFINED_FILE_FIELDS = [
//   "Passport",
//   "Birth Certificate",
//   "School Certificate",
//   "Driver's Licence",
//   "Medicare Card",
//   "Police Clearance Certificate",
//   "NDIS Screening Check",
//   "COVID-19 Vaccination Certificate",
//   "First Aid",
//   "CPR",
//   "Manual Handling",
//   "Medication Competency",
//   "Proof of Age Card",
// ];

// const CUSTOM_SENTINEL = "__custom__";

// const slugify = (s: string) =>
//   s
//     .toLowerCase()
//     .trim()
//     .replace(/&/g, "and")
//     .replace(/[^a-z0-9]+/g, "-")
//     .replace(/^-+|-+$/g, "");

// function ensureUniqueKey(base: string, fields: Field[]): string {
//   const existing = new Set(fields.map((f) => f.key));
//   if (!existing.has(base)) return base;
//   let i = 1;
//   while (existing.has(`${base}-${i}`)) i++;
//   return `${base}-${i}`;
// }

// // Legacy → new, defensive mapping
// function coerceEmployeeAccess(node: any): EmployeeAccess {
//   if (
//     node?.employeeAccess === "hidden" ||
//     node?.employeeAccess === "view" ||
//     node?.employeeAccess === "edit"
//   ) {
//     return node.employeeAccess;
//   }
//   if (typeof node?.employeerOnlyEditable === "boolean") {
//     return node.employeerOnlyEditable ? "hidden" : "edit";
//   }
//   if (typeof node?.employerOnlyEditable === "boolean") {
//     return node.employerOnlyEditable ? "hidden" : "edit";
//   }
//   return "edit";
// }

// function sanitizeNode<T extends Section | InnerSection>(n: T): T {
//   const clean: any = { ...n, employeeAccess: coerceEmployeeAccess(n) };
//   delete clean.employeerOnlyEditable;
//   delete clean.employerOnlyEditable;
//   if (Array.isArray(clean.innerSections)) {
//     clean.innerSections = clean.innerSections.map(sanitizeNode);
//   }
//   return clean as T;
// }

// function badgeForAccess(access: EmployeeAccess) {
//   switch (access) {
//     case "hidden":
//       return {
//         label: "Hidden from employees",
//         icon: <Lock size={12} />,
//         className: "bg-amber-100 text-amber-800",
//         title:
//           "Only employer can view & edit. Employees cannot see this section.",
//       };
//     case "view":
//       return {
//         label: "Employee view only",
//         icon: <Eye size={12} />,
//         className: "bg-violet-100 text-violet-800",
//         title: "Employees can view, but only employer can edit.",
//       };
//     case "edit":
//     default:
//       return {
//         label: "Employee can edit",
//         icon: <Pencil size={12} />,
//         className: "bg-emerald-100 text-emerald-800",
//         title: "Employees and employer can view & edit.",
//       };
//   }
// }

// /* --------------------------- Component --------------------------- */

// export default function EmployeeDocumentConfigPage() {
//   const [loading, setLoading] = useState(true);

//   // We edit ONLY the `documents` section subtree
//   const [documentsSection, setDocumentsSection] = useState<Section | null>(
//     null
//   );
//   // Keep a copy of the full config for save / replace
//   const [fullConfig, setFullConfig] = useState<Section[]>([]);

//   // Add Inner Section (under documents or nested) modal
//   const [showSectionModal, setShowSectionModal] = useState(false);
//   const [newSectionLabel, setNewSectionLabel] = useState("");
//   const [newSectionAccess, setNewSectionAccess] =
//     useState<EmployeeAccess>("edit");
//   const [targetPathForNewSection, setTargetPathForNewSection] = useState<
//     number[]
//   >([]);

//   // Add Field modal
//   const [fieldModal, setFieldModal] = useState<{
//     visible: boolean;
//     sectionPath: number[]; // path within documents section
//   }>({ visible: false, sectionPath: [] });
//   const [newFieldChoice, setNewFieldChoice] = useState<string | null>(null);
//   const [newFieldCustomLabel, setNewFieldCustomLabel] = useState("");

//   // Add nested Inner Section modal (reused for nested)
//   const [innerSectionModal, setInnerSectionModal] = useState<{
//     visible: boolean;
//     sectionPath: number[];
//   }>({ visible: false, sectionPath: [] });
//   const [newInnerSectionLabel, setNewInnerSectionLabel] = useState("");

//   /* --------------------------- Load config --------------------------- */

//   useEffect(() => {
//     (async () => {
//       setLoading(true);
//       try {
//         const res = await axiosInstance.get("/employee-field-config");
//         const allSections = (res.data?.data?.sections || []) as Section[];
//         setFullConfig(allSections);

//         const docs =
//           allSections.find(
//             (s) => (s.sectionKey || "").toLowerCase() === "documents"
//           ) || null;

//         if (!docs) {
//           // if somehow there's no documents section, create a root one to work with
//           const fresh: Section = {
//             sectionKey: "documents",
//             sectionLabel: "Documents",
//             fields: [],
//             innerSections: [],
//             employeeAccess: "edit",
//           };
//           setDocumentsSection(fresh);
//         } else {
//           setDocumentsSection(sanitizeNode(docs));
//         }
//       } catch (e) {
//         console.error(e);
//         toast.error("Failed to load document config");
//         setDocumentsSection(null);
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, []);

//   /* --------------------------- Path helpers (within documents) --------------------------- */

//   function resolvePathInDocuments(
//     root: Section,
//     path: number[]
//   ): Section | InnerSection {
//     // path indexes into innerSections recursively from root(documents)
//     let current: Section | InnerSection = root;
//     for (let i = 0; i < path.length; i++) {
//       if (!current.innerSections || current.innerSections[path[i]] == null) {
//         throw new Error(`Invalid path: ${path.join(",")}`);
//       }
//       current = current.innerSections[path[i]];
//     }
//     return current;
//   }

//   function updateDocuments(mutator: (draft: Section) => void) {
//     setDocumentsSection((prev) => {
//       if (!prev) return prev;
//       const copy = structuredClone(prev);
//       mutator(copy);
//       return copy;
//     });
//   }

//   /* --------------------------- Add Section (ALWAYS under documents) --------------------------- */

//   // "Add Section" entry point: we let user choose the target container (default: documents root)
//   const openAddSectionModal = (path: number[] = []) => {
//     setTargetPathForNewSection(path);
//     setNewSectionLabel("");
//     setNewSectionAccess("edit");
//     setShowSectionModal(true);
//   };

//   const addInnerSectionAtPath = () => {
//     if (!documentsSection) return;
//     if (!newSectionLabel.trim()) return;

//     updateDocuments((doc) => {
//       const target =
//         targetPathForNewSection.length === 0
//           ? (doc as Section | InnerSection)
//           : resolvePathInDocuments(doc, targetPathForNewSection);

//       if (!target.innerSections) target.innerSections = [];
//       target.innerSections.push({
//         sectionKey: `inner_${Date.now()}`,
//         sectionLabel: newSectionLabel.trim(),
//         fields: [],
//         innerSections: [],
//         requirementMode: "AND",
//         isAdditional: true,
//         employeeAccess: newSectionAccess,
//       });
//     });

//     setShowSectionModal(false);
//   };

//   /* --------------------------- Field ops --------------------------- */

//   const targetSectionForNewField = useMemo(() => {
//     if (!documentsSection || !fieldModal.sectionPath.length) return null;
//     try {
//       return resolvePathInDocuments(documentsSection, fieldModal.sectionPath);
//     } catch {
//       return null;
//     }
//   }, [documentsSection, fieldModal.sectionPath]);

//   const previewNewFieldLabel = useMemo(() => {
//     return newFieldChoice === CUSTOM_SENTINEL
//       ? newFieldCustomLabel.trim()
//       : (newFieldChoice || "").trim();
//   }, [newFieldChoice, newFieldCustomLabel]);

//   const previewNewFieldKey = useMemo(() => {
//     const base = slugify(previewNewFieldLabel || "");
//     if (!base || !targetSectionForNewField) return "";
//     return ensureUniqueKey(base, targetSectionForNewField.fields || []);
//   }, [previewNewFieldLabel, targetSectionForNewField]);

//   const addFieldToSection = () => {
//     if (!documentsSection) return;

//     const finalLabel = previewNewFieldLabel;
//     if (!finalLabel) {
//       toast.error("Please choose or enter a field label.");
//       return;
//     }
//     const finalKey = previewNewFieldKey;
//     if (!finalKey) {
//       toast.error("Could not generate a key. Try a different label.");
//       return;
//     }

//     updateDocuments((doc) => {
//       const target = resolvePathInDocuments(doc, fieldModal.sectionPath);
//       if (!target.fields) (target as any).fields = [];
//       target.fields.push({
//         key: finalKey,
//         label: finalLabel,
//         placeholder: "",
//         required: false,
//         type: "file",
//         isAdditional: true,
//         fileMeta: {
//           expiryDate: false,
//           issuingDate: false,
//           validityPeriod: undefined,
//           expiryIsDisabled: false,
//         },
//       });
//     });

//     // reset modal state
//     setFieldModal({ visible: false, sectionPath: [] });
//     setNewFieldChoice(null);
//     setNewFieldCustomLabel("");
//   };

//   const handleFieldChange = (
//     path: number[],
//     fieldIndex: number,
//     key: keyof Field,
//     value: any
//   ) => {
//     if (!documentsSection) return;
//     updateDocuments((doc) => {
//       const target = resolvePathInDocuments(doc, path);
//       (target.fields[fieldIndex] as any)[key] = value;
//     });
//   };

//   const deleteFieldAtPath = (path: number[], fieldKey: string) => {
//     const confirmed = window.confirm(
//       "Are you sure you want to delete this field?"
//     );
//     if (!confirmed) return;
//     updateDocuments((doc) => {
//       const target = resolvePathInDocuments(doc, path);
//       target.fields = (target.fields || []).filter((f) => f.key !== fieldKey);
//     });
//     toast.success("Field removed successfully.");
//   };

//   /* --------------------------- Save --------------------------- */

//   const handleSave = async () => {
//     if (!documentsSection) return;
//     try {
//       const res = await axiosInstance.get("/employee-field-config");
//       const allSections = (res.data?.data?.sections || []) as Section[];

//       const nextDocs = sanitizeNode(documentsSection);

//       // Replace the top-level documents section in the full config (or append if missing)
//       const idx = allSections.findIndex(
//         (s) => (s.sectionKey || "").toLowerCase() === "documents"
//       );
//       let final: Section[];
//       if (idx === -1) {
//         final = [...allSections, nextDocs];
//       } else {
//         final = [...allSections];
//         final[idx] = nextDocs;
//       }

//       await axiosInstance.post("/employee-field-config", { sections: final });
//       setFullConfig(final);
//       toast.success("Document config saved successfully.");
//     } catch (e) {
//       console.error(e);
//       toast.error("Failed to save document config");
//     }
//   };

//   /* --------------------------- Render --------------------------- */

//   const renderSection = (
//     section: Section | InnerSection,
//     path: number[],
//     isTopLevelInner = false
//   ) => {
//     const allFieldsAreFiles =
//       section.fields.length > 0 &&
//       section.fields.every((f) => f.type === "file");

//     const additional = !!section.isAdditional;
//     const employeeAccess = coerceEmployeeAccess(section);
//     const badge = badgeForAccess(employeeAccess);

//     return (
//       <div
//         key={section.sectionKey}
//         className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50 mt-4"
//       >
//         <div className="flex items-center justify-between">
//           {/* Left: Title + badges */}
//           <div className="flex items-center gap-3">
//             <h2 className="text-lg font-semibold">{section.sectionLabel}</h2>
//             {additional && (
//               <span
//                 className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-800"
//                 title="This is a custom (additional) section"
//               >
//                 Custom
//               </span>
//             )}
//             <span
//               className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
//               title={badge.title}
//             >
//               {badge.icon} {badge.label}
//             </span>
//           </div>

//           {/* Right: Actions + tri-state on additional sections */}
//           <div className="flex items-center gap-3">
//             {additional && (
//               <div className="hidden md:flex items-center gap-2">
//                 <span className="text-xs text-gray-500">Employee access</span>
//                 <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
//                   <button
//                     type="button"
//                     className={`px-2.5 py-1 text-xs ${
//                       employeeAccess === "edit"
//                         ? "bg-blue-600 text-white"
//                         : "bg-white text-gray-700"
//                     }`}
//                     onClick={() =>
//                       updateDocuments((doc) => {
//                         const target = resolvePathInDocuments(doc, path) as any;
//                         target.employeeAccess = "edit";
//                       })
//                     }
//                     title="Employees can view & edit"
//                   >
//                     Edit
//                   </button>
//                   <button
//                     type="button"
//                     className={`px-2.5 py-1 text-xs border-l ${
//                       employeeAccess === "view"
//                         ? "bg-blue-600 text-white"
//                         : "bg-white text-gray-700"
//                     }`}
//                     onClick={() =>
//                       updateDocuments((doc) => {
//                         const target = resolvePathInDocuments(doc, path) as any;
//                         target.employeeAccess = "view";
//                       })
//                     }
//                     title="Employees can only view"
//                   >
//                     View
//                   </button>
//                   <button
//                     type="button"
//                     className={`px-2.5 py-1 text-xs border-l ${
//                       employeeAccess === "hidden"
//                         ? "bg-blue-600 text-white"
//                         : "bg-white text-gray-700"
//                     }`}
//                     onClick={() =>
//                       updateDocuments((doc) => {
//                         const target = resolvePathInDocuments(doc, path) as any;
//                         target.employeeAccess = "hidden";
//                       })
//                     }
//                     title="Hidden from employees"
//                   >
//                     Hidden
//                   </button>
//                 </div>
//               </div>
//             )}

//             <Button
//               size="sm"
//               onClick={() =>
//                 setFieldModal({ visible: true, sectionPath: path })
//               }
//             >
//               <Plus className="h-4 w-4 mr-1" /> Add Field
//             </Button>
//             {/* <Button
//               size="sm"
//               variant="outline"
//               onClick={() =>
//                 setInnerSectionModal({ visible: true, sectionPath: path })
//               }
//             >
//               + Add Inner Section
//             </Button> */}
//           </div>
//         </div>

//         {employeeAccess === "hidden" && (
//           <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 inline-block">
//             This section is <strong>hidden from employees</strong> and only
//             editable by employer.
//           </p>
//         )}
//         {employeeAccess === "view" && (
//           <p className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded px-2 py-1 inline-block">
//             Employees can <strong>view</strong> this section, but only employer
//             can edit.
//           </p>
//         )}

//         {allFieldsAreFiles && (
//           <div className="flex items-center gap-2 mb-2">
//             <label className="text-sm font-medium">Requirement Mode</label>
//             <select
//               value={section.requirementMode || "AND"}
//               onChange={(e) => {
//                 const mode = e.target.value as "AND" | "OR";
//                 updateDocuments((doc) => {
//                   const target = resolvePathInDocuments(doc, path);
//                   (target as any).requirementMode = mode;
//                 });
//               }}
//               className="border rounded px-2 py-1 text-sm"
//             >
//               <option value="AND">Optional</option>
//               <option value="OR">Any Required</option>
//             </select>
//           </div>
//         )}

//         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//           {section.fields.map((field, fieldIndex) => (
//             <FieldDisclosure
//               key={field.key}
//               field={field}
//               allFields={section.fields}
//               parentRequirementMode={section.requirementMode}
//               onChange={(k, v) =>
//                 handleFieldChange(path, fieldIndex, k as any, v)
//               }
//               onDelete={() => deleteFieldAtPath(path, field.key)}
//             />
//           ))}
//         </div>

//         {section.innerSections?.map((inner, idx) =>
//           renderSection(inner, [...path, idx])
//         )}
//       </div>
//     );
//   };

//   if (loading) return <div className="p-6">Loading...</div>;
//   if (!documentsSection)
//     return (
//       <div className="p-6 text-center text-red-500">
//         Documents section not found.
//       </div>
//     );

//   return (
//     <>
//       <div className="space-y-6 max-w-full">
//         <div className="flex items-center justify-between">
//           <h1 className="text-xl font-semibold">
//             Employee Document Configuration
//           </h1>
//           <div className="flex gap-3">
//             {/* Add Section always adds under the root Documents (inner section) */}
//             <Button
//               onClick={() => openAddSectionModal([])}
//               variant="outline"
//               size="sm"
//             >
//               <Plus className="h-4 w-4 mr-1" /> Add Section
//             </Button>
//             <Button onClick={handleSave}>Save Config</Button>
//           </div>
//         </div>

//         {/* Render documents' inner sections (top level under documents) */}
//         {(documentsSection.innerSections || []).length === 0 ? (
//           <div className="border rounded-lg p-6 text-gray-500 bg-gray-50">
//             No document groups yet. Click “Add Section” to create one under
//             Documents.
//           </div>
//         ) : (
//           documentsSection.innerSections!.map((inner, idx) =>
//             renderSection(inner, [idx], true)
//           )
//         )}
//       </div>

//       {/* Add Section Modal (adds an inner section under a path, default root documents) */}
//       <Modal
//         visible={showSectionModal}
//         title="Add Section under Documents"
//         onClose={() => setShowSectionModal(false)}
//       >
//         <form
//           onSubmit={(e) => {
//             e.preventDefault();
//             addInnerSectionAtPath();
//           }}
//           className="space-y-5"
//         >
//           <Input
//             label="Section Label"
//             placeholder="Enter section name (e.g. Licences)"
//             value={newSectionLabel}
//             onChange={(e) => setNewSectionLabel(e.target.value)}
//           />

//           <fieldset className="space-y-2">
//             <label className="text-sm font-medium text-gray-700">
//               Employee access
//             </label>
//             <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
//               <button
//                 type="button"
//                 className={`px-3 py-1.5 text-sm ${
//                   newSectionAccess === "edit"
//                     ? "bg-blue-600 text-white"
//                     : "bg-white text-gray-700"
//                 }`}
//                 onClick={() => setNewSectionAccess("edit")}
//                 title="Employees can view & edit"
//               >
//                 Edit
//               </button>
//               <button
//                 type="button"
//                 className={`px-3 py-1.5 text-sm border-l ${
//                   newSectionAccess === "view"
//                     ? "bg-blue-600 text-white"
//                     : "bg-white text-gray-700"
//                 }`}
//                 onClick={() => setNewSectionAccess("view")}
//                 title="Employees can only view"
//               >
//                 View
//               </button>
//               <button
//                 type="button"
//                 className={`px-3 py-1.5 text-sm border-l ${
//                   newSectionAccess === "hidden"
//                     ? "bg-blue-600 text-white"
//                     : "bg-white text-gray-700"
//                 }`}
//                 onClick={() => setNewSectionAccess("hidden")}
//                 title="Hidden from employees"
//               >
//                 Hidden
//               </button>
//             </div>
//             <p className="text-xs text-gray-500">
//               Employees can edit, only view, or not see this section at all.
//             </p>
//           </fieldset>

//           <div className="flex justify-end">
//             <Button type="submit">Add Section</Button>
//           </div>
//         </form>
//       </Modal>

//       {/* Add Field Modal */}
//       <Modal
//         visible={fieldModal.visible}
//         title="Add Field"
//         onClose={() => {
//           setFieldModal({ visible: false, sectionPath: [] });
//           setNewFieldChoice(null);
//           setNewFieldCustomLabel("");
//         }}
//       >
//         <form
//           onSubmit={(e) => {
//             e.preventDefault();
//             addFieldToSection();
//           }}
//           className="space-y-5"
//         >
//           <Select
//             label="Field Label"
//             // @ts-ignore rizzui select is often searchable; ignored if not supported
//             isSearchable
//             placeholder="Choose a label or pick 'Custom…'"
//             value={
//               newFieldChoice && newFieldChoice !== CUSTOM_SENTINEL
//                 ? { label: newFieldChoice, value: newFieldChoice }
//                 : newFieldChoice === CUSTOM_SENTINEL
//                 ? { label: "Custom…", value: CUSTOM_SENTINEL }
//                 : null
//             }
//             onChange={(opt) => setNewFieldChoice(opt?.value || null)}
//             options={[
//               ...PREDEFINED_FILE_FIELDS.map((l) => ({ label: l, value: l })),
//               { label: "Custom…", value: CUSTOM_SENTINEL },
//             ]}
//           />

//           {newFieldChoice === CUSTOM_SENTINEL && (
//             <Input
//               label="Custom Label"
//               placeholder='e.g. "Blue Card"'
//               value={newFieldCustomLabel}
//               onChange={(e) => setNewFieldCustomLabel(e.target.value)}
//             />
//           )}

//           <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
//             <Input
//               label="Field Type"
//               value="file"
//               readOnly
//               className="bg-gray-50"
//             />
//             <Input
//               label="Generated Key (preview)"
//               value={targetSectionForNewField ? previewNewFieldKey : ""}
//               readOnly
//               className="bg-gray-50"
//             />
//           </div>

//           <p className="text-xs text-gray-500">
//             Keys are generated from labels (kebab-case) and made unique within
//             the section automatically.
//           </p>

//           <div className="flex justify-end">
//             <Button type="submit">Add Field</Button>
//           </div>
//         </form>
//       </Modal>

//       {/* Add Inner Section (nested) Modal */}
//       {/* <Modal
//         visible={innerSectionModal.visible}
//         title="Add Inner Section"
//         onClose={() =>
//           setInnerSectionModal({ visible: false, sectionPath: [] })
//         }
//       >
//         <form
//           onSubmit={(e) => {
//             e.preventDefault();
//             if (!documentsSection) return;
//             if (!newInnerSectionLabel.trim()) return;
//             updateDocuments((doc) => {
//               const target = resolvePathInDocuments(
//                 doc,
//                 innerSectionModal.sectionPath
//               );
//               if (!target.innerSections) target.innerSections = [];
//               target.innerSections.push({
//                 sectionKey: `inner_${Date.now()}`,
//                 sectionLabel: newInnerSectionLabel.trim(),
//                 fields: [],
//                 innerSections: [],
//                 requirementMode: "AND",
//                 isAdditional: true,
//                 employeeAccess: "edit",
//               });
//             });
//             setInnerSectionModal({ visible: false, sectionPath: [] });
//             setNewInnerSectionLabel("");
//           }}
//           className="space-y-4"
//         >
//           <Input
//             label="Inner Section Label"
//             value={newInnerSectionLabel}
//             onChange={(e) => setNewInnerSectionLabel(e.target.value)}
//           />
//           <div className="flex justify-end">
//             <Button type="submit">Add Inner Section</Button>
//           </div>
//         </form>
//       </Modal> */}
//     </>
//   );
// }

// /* --------------------------- Modal --------------------------- */

// function Modal({
//   visible,
//   title,
//   onClose,
//   children,
// }: {
//   visible: boolean;
//   title: string;
//   onClose: () => void;
//   children: React.ReactNode;
// }) {
//   return (
//     <Transition appear show={visible} as={Fragment}>
//       <Dialog as="div" className="relative z-50" onClose={() => {}}>
//         <Transition.Child
//           as={Fragment}
//           enter="ease-out duration-200"
//           enterFrom="opacity-0"
//           enterTo="opacity-100"
//           leave="ease-in duration-150"
//           leaveFrom="opacity-100"
//           leaveTo="opacity-0"
//         >
//           <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
//         </Transition.Child>
//         <div className="fixed inset-0 overflow-y-auto">
//           <div className="flex min-h-full items-center justify-center p-4">
//             <Transition.Child
//               as={Fragment}
//               enter="ease-out duration-300"
//               enterFrom="opacity-0 scale-95"
//               enterTo="opacity-100 scale-100"
//               leave="ease-in duration-200"
//               leaveFrom="opacity-100 scale-100"
//               leaveTo="opacity-0 scale-95"
//             >
//               <Dialog.Panel className="w-full max-w-md transform rounded-xl bg-white p-6 shadow-xl">
//                 <div className="flex justify-between items-center mb-4">
//                   <Dialog.Title className="text-lg font-semibold">
//                     {title}
//                   </Dialog.Title>
//                   <button
//                     onClick={onClose}
//                     className="text-gray-400 hover:text-gray-600"
//                   >
//                     <X size={20} />
//                   </button>
//                 </div>
//                 {children}
//               </Dialog.Panel>
//             </Transition.Child>
//           </div>
//         </div>
//       </Dialog>
//     </Transition>
//   );
// }

// /* --------------------------- FieldDisclosure --------------------------- */

// function FieldDisclosure({
//   field,
//   onChange,
//   allFields,
//   parentRequirementMode,
//   onDelete,
// }: {
//   field: Field;
//   onChange: (key: keyof Field, value: any) => void;
//   allFields: Field[];
//   parentRequirementMode?: "AND" | "OR";
//   onDelete?: () => void;
// }) {
//   const showIfEnabled = !!field.showIf;

//   const watchedFieldMetadata = field.showIf?.fieldKey
//     ? allFields.find((f) => f.key === field.showIf?.fieldKey)
//     : undefined;

//   // Parse validityPeriod → {years, months}
//   const parseValidity = (str?: string): { years: string; months: string } => {
//     if (!str) return { years: "0", months: "0" };

//     const y = str.match(/^\s*([\d.]+)\s*Years?/i);
//     if (y) {
//       const years = Number(y[1]) || 0;
//       return { years: String(Math.floor(years)), months: "0" };
//     }

//     const m = str.match(/^\s*([\d.]+)\s*Months?/i);
//     if (m) {
//       const monthsTotal = Number(m[1]) || 0;
//       const years = Math.floor(monthsTotal / 12);
//       const months = Math.round(monthsTotal - years * 12);
//       return { years: String(years), months: String(months) };
//     }

//     const d = str.match(/^\s*([\d.]+)\s*Days?/i);
//     if (d) {
//       const days = Number(d[1]) || 0;
//       const monthsApprox = Math.round(days / 30);
//       const years = Math.floor(monthsApprox / 12);
//       const months = monthsApprox - years * 12;
//       return { years: String(years), months: String(months) };
//     }

//     return { years: "0", months: "0" };
//   };

//   // Build a single-unit validityPeriod string the backend accepts
//   const buildValidity = (
//     yearsStr: string,
//     monthsStr: string
//   ): string | undefined => {
//     const years = parseInt((yearsStr || "0").trim(), 10) || 0;
//     const months = parseInt((monthsStr || "0").trim(), 10) || 0;

//     if (years === 0 && months === 0) return undefined;

//     if (years > 0 && months > 0) {
//       const totalMonths = years * 12 + months;
//       return `${totalMonths} ${totalMonths === 1 ? "Month" : "Months"}`;
//     }
//     if (years > 0) {
//       return `${years} ${years === 1 ? "Year" : "Years"}`;
//     }
//     return `${months} ${months === 1 ? "Month" : "Months"}`;
//   };

//   const validity = parseValidity(field.fileMeta?.validityPeriod);

//   const yearsOptions = Array.from({ length: 21 }, (_, n) => ({
//     label: String(n),
//     value: String(n),
//   }));
//   const monthsOptions = Array.from({ length: 13 }, (_, n) => ({
//     label: String(n),
//     value: String(n),
//   }));

//   const validityYearsValue = { label: validity.years, value: validity.years };
//   const validityMonthsValue = {
//     label: validity.months,
//     value: validity.months,
//   };

//   return (
//     <Disclosure as="div">
//       {({ open }) => (
//         <div className="border rounded bg-white">
//           <Disclosure.Button className="w-full flex justify-between items-center p-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
//             <span>{field.label || "(Untitled Field)"}</span>
//             <div className="flex items-center gap-2">
//               {field.isAdditional && (
//                 <button
//                   type="button"
//                   onClick={(e) => {
//                     e.stopPropagation();
//                     onDelete?.();
//                   }}
//                   className="text-red-500 hover:text-red-700"
//                   title="Delete Field"
//                 >
//                   <X size={16} />
//                 </button>
//               )}
//               <ChevronsUpDownIcon
//                 className={`h-5 w-5 transition-transform ${
//                   open ? "rotate-180" : ""
//                 }`}
//               />
//             </div>
//           </Disclosure.Button>

//           <Disclosure.Panel className="p-4 space-y-4 border-t">
//             <Input
//               label="Label"
//               value={field.label}
//               onChange={(e) => onChange("label", e.target.value)}
//             />
//             <Input
//               label="Placeholder"
//               value={field.placeholder}
//               onChange={(e) => onChange("placeholder", e.target.value)}
//             />
//             <Textarea
//               label="Hint"
//               value={field.hint || ""}
//               onChange={(e) => onChange("hint", e.target.value)}
//             />

//             {field.type === "file" && (
//               <div className="space-y-4 border-t pt-4 mt-4">
//                 <div className="flex items-center gap-2">
//                   <label className="text-sm font-medium">Expiry Date</label>
//                   <input
//                     type="checkbox"
//                     checked={field.fileMeta?.expiryDate ?? false}
//                     onChange={(e) =>
//                       onChange("fileMeta", {
//                         ...(field.fileMeta || {}),
//                         expiryDate: e.target.checked,
//                       })
//                     }
//                     className="h-4 w-4"
//                   />
//                 </div>

//                 <div className="flex items-center gap-2">
//                   <label className="text-sm font-medium">Issuing Date</label>
//                   <input
//                     type="checkbox"
//                     checked={field.fileMeta?.issuingDate ?? false}
//                     onChange={(e) =>
//                       onChange("fileMeta", {
//                         ...(field.fileMeta || {}),
//                         issuingDate: e.target.checked,
//                       })
//                     }
//                     className="h-4 w-4"
//                   />
//                 </div>

//                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-md border bg-gray-50">
//                   <div className="sm:col-span-3">
//                     <p className="text-sm font-medium">
//                       Auto-calculate Expiry from Issuing + Validity
//                     </p>
//                   </div>

//                   <Select
//                     label="Years"
//                     value={validityYearsValue}
//                     onChange={(opt) => {
//                       const years = (opt?.value ?? "0").toString();
//                       const str = buildValidity(years, validity.months);
//                       onChange("fileMeta", {
//                         ...(field.fileMeta || {}),
//                         validityPeriod: str,
//                       });
//                     }}
//                     options={yearsOptions}
//                   />

//                   <Select
//                     label="Months"
//                     value={validityMonthsValue}
//                     onChange={(opt) => {
//                       const months = (opt?.value ?? "0").toString();
//                       const str = buildValidity(validity.years, months);
//                       onChange("fileMeta", {
//                         ...(field.fileMeta || {}),
//                         validityPeriod: str,
//                       });
//                     }}
//                     options={monthsOptions}
//                   />

//                   <div className="flex items-center gap-2 pt-5">
//                     <label className="text-sm font-medium">Lock Expiry</label>
//                     <input
//                       type="checkbox"
//                       checked={field.fileMeta?.expiryIsDisabled ?? false}
//                       onChange={(e) =>
//                         onChange("fileMeta", {
//                           ...(field.fileMeta || {}),
//                           expiryIsDisabled: e.target.checked,
//                         })
//                       }
//                       className="h-4 w-4"
//                     />
//                   </div>
//                 </div>
//               </div>
//             )}

//             {/* Required (skip when OR mode on a file group – matches your earlier behavior) */}
//             {(field.type !== "file" || parentRequirementMode !== "OR") && (
//               <div className="flex items-center gap-2">
//                 <label className="text-sm font-medium">Required</label>
//                 <input
//                   type="checkbox"
//                   checked={field.required}
//                   onChange={(e) => onChange("required", e.target.checked)}
//                   className="h-4 w-4"
//                 />
//               </div>
//             )}

//             {/* ShowIf */}
//             <div className="pt-4 border-t mt-4 space-y-3">
//               <div className="flex items-center gap-2">
//                 <input
//                   type="checkbox"
//                   checked={!!field.showIf}
//                   onChange={(e) =>
//                     onChange(
//                       "showIf",
//                       e.target.checked
//                         ? { fieldKey: "", operator: "equals", value: "" }
//                         : undefined
//                     )
//                   }
//                   className="h-4 w-4"
//                 />
//                 <span className="text-sm font-medium">
//                   Show this field only when...
//                 </span>
//               </div>

//               {field.showIf && (
//                 <div className="space-y-2 bg-gray-50 p-3 rounded-md border">
//                   <Select
//                     label="Field to Watch"
//                     placeholder="Select field"
//                     value={
//                       field.showIf?.fieldKey
//                         ? {
//                             label:
//                               allFields.find(
//                                 (f) => f.key === field.showIf?.fieldKey
//                               )?.label || field.showIf?.fieldKey,
//                             value: field.showIf?.fieldKey,
//                           }
//                         : undefined
//                     }
//                     onChange={(opt) =>
//                       onChange("showIf", {
//                         ...(field.showIf || { operator: "equals", value: "" }),
//                         fieldKey: opt?.value,
//                       })
//                     }
//                     options={allFields.map((f) => ({
//                       label: f.label || f.key,
//                       value: f.key,
//                     }))}
//                   />

//                   <Select
//                     label="Operator"
//                     value={
//                       field.showIf?.operator
//                         ? {
//                             label:
//                               field.showIf.operator === "equals"
//                                 ? "Equals"
//                                 : "Not Equals",
//                             value: field.showIf.operator,
//                           }
//                         : undefined
//                     }
//                     onChange={(opt) =>
//                       onChange("showIf", {
//                         ...(field.showIf || { fieldKey: "", value: "" }),
//                         operator: opt?.value,
//                       })
//                     }
//                     options={[
//                       { label: "Equals", value: "equals" },
//                       { label: "Not Equals", value: "notEquals" },
//                     ]}
//                   />

//                   {watchedFieldMetadata?.type === "select" &&
//                   watchedFieldMetadata.options?.length ? (
//                     <Select
//                       label="Value to Match"
//                       placeholder="Select option"
//                       value={
//                         field.showIf?.value
//                           ? {
//                               label: field.showIf.value,
//                               value: field.showIf.value,
//                             }
//                           : undefined
//                       }
//                       onChange={(opt) =>
//                         onChange("showIf", {
//                           ...(field.showIf || {
//                             fieldKey: "",
//                             operator: "equals",
//                           }),
//                           value: opt?.value,
//                         })
//                       }
//                       options={watchedFieldMetadata.options.map((o) => ({
//                         label: o,
//                         value: o,
//                       }))}
//                     />
//                   ) : (
//                     <Input
//                       label="Value to Match"
//                       placeholder="Enter value"
//                       value={field.showIf?.value ?? ""}
//                       onChange={(e) =>
//                         onChange("showIf", {
//                           ...(field.showIf || {
//                             fieldKey: "",
//                             operator: "equals",
//                           }),
//                           value: e.target.value,
//                         })
//                       }
//                     />
//                   )}
//                 </div>
//               )}
//             </div>
//           </Disclosure.Panel>
//         </div>
//       )}
//     </Disclosure>
//   );
// }

"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Input, Button, Textarea, Select } from "rizzui";
import { Dialog, Transition, Disclosure } from "@headlessui/react";
import {
  Plus,
  X,
  ChevronsUpDownIcon,
  Lock,
  Eye,
  Pencil,
  Folder,
  FileText,
  Shield,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Edit,
  Trash2,
  MoreVertical,
  Save,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/app/lib/axios";
import { usePermissions } from "@/app/hooks/usePermissions";

interface Designation {
  _id: string;
  name: string;
}

/* --------------------------- Types --------------------------- */

type EmployeeAccess = "hidden" | "view" | "edit";

interface FileMeta {
  expiryDate?: boolean;
  issuingDate?: boolean;
  validityPeriod?: string;
  expiryIsDisabled?: boolean;
  countryOfIssue?: boolean;
}

interface Field {
  key: string;
  label: string;
  placeholder: string;
  hint?: string;
  required: boolean;
  type: string;
  isAdditional?: boolean;
  options?: string[];
  showIf?: {
    fieldKey: string;
    operator: "equals" | "notEquals";
    value: any;
  };
  referenceModel?: string;
  fileMeta?: FileMeta;
  jobRole?: string[]; // Array of designation IDs
}

interface InnerSection {
  sectionKey: string;
  sectionLabel: string;
  fields: Field[];
  requirementMode?: "AND" | "OR";
  isAdditional?: boolean;
  innerSections?: InnerSection[];
  employeeAccess?: EmployeeAccess;
}

interface Section {
  sectionKey: string;
  sectionLabel: string;
  fields: Field[];
  innerSections?: InnerSection[];
  isAdditional?: boolean;
  requirementMode?: "AND" | "OR";
  employeeAccess?: EmployeeAccess;
}

type DiffChange = { path: string; old: any; new: any };

/* --------------------------- Helpers --------------------------- */

const PREDEFINED_FILE_FIELDS = [
  "Passport",
  "Birth Certificate",
  "School Certificate",
  "Driver's Licence",
  "Medicare Card",
  "Police Clearance Certificate",
  "NDIS Screening Check",
  "COVID-19 Vaccination Certificate",
  "First Aid",
  "CPR",
  "Manual Handling",
  "Medication Competency",
  "Proof of Age Card",
];

const CUSTOM_SENTINEL = "__custom__";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

function ensureUniqueKey(base: string, fields: Field[]): string {
  const existing = new Set(fields.map((f) => f.key));
  if (!existing.has(base)) return base;
  let i = 1;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// legacy → new, defensive mapping
function coerceEmployeeAccess(node: any): EmployeeAccess {
  if (
    node?.employeeAccess === "hidden" ||
    node?.employeeAccess === "view" ||
    node?.employeeAccess === "edit"
  ) {
    return node.employeeAccess;
  }
  if (typeof node?.employeerOnlyEditable === "boolean") {
    return node.employeerOnlyEditable ? "hidden" : "edit";
  }
  if (typeof node?.employerOnlyEditable === "boolean") {
    return node.employerOnlyEditable ? "hidden" : "edit";
  }
  return "edit";
}

function sanitizeNode<T extends Section | InnerSection>(n: T): T {
  const clean: any = { ...n, employeeAccess: coerceEmployeeAccess(n) };
  delete clean.employeerOnlyEditable;
  delete clean.employerOnlyEditable;
  if (Array.isArray(clean.innerSections)) {
    clean.innerSections = clean.innerSections.map(sanitizeNode);
  }
  return clean as T;
}

function badgeForAccess(access: EmployeeAccess) {
  switch (access) {
    case "hidden":
      return {
        label: "Hidden from employees",
        icon: <Lock size={12} />,
        className: "bg-amber-100 text-amber-800",
        title:
          "Only employer can view & edit. Employees cannot see this section.",
      };
    case "view":
      return {
        label: "Employee view only",
        icon: <Eye size={12} />,
        className: "bg-violet-100 text-violet-800",
        title: "Employees can view, but only employer can edit.",
      };
    case "edit":
    default:
      return {
        label: "Employee can edit",
        icon: <Pencil size={12} />,
        className: "bg-emerald-100 text-emerald-800",
        title: "Employees and employer can view & edit.",
      };
  }
}

/* --------------------------- DIFF (only “what changed”) --------------------------- */

const SECTION_META_KEYS: Array<keyof Section> = [
  "sectionLabel",
  "employeeAccess",
  "requirementMode",
  "isAdditional",
];

const INNER_SECTION_META_KEYS: Array<keyof InnerSection> = [
  "sectionLabel",
  "employeeAccess",
  "requirementMode",
  "isAdditional",
];

const FIELD_KEYS: Array<keyof Field> = [
  "label",
  "hint",
  "required",
  "type",
  "options",
  "referenceModel",
  "showIf",
  "fileMeta",
];

// tiny deepEqual (sufficient for our shapes)
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; i++)
        if (!deepEqual(a[i], b[i])) return false;
      return true;
    }
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }
  return false;
}

const byKey = <T extends { sectionKey: string }>(arr: T[]) => {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.sectionKey, x);
  return m;
};
const byFieldKey = (arr: Field[]) => {
  const m = new Map<string, Field>();
  for (const f of arr) m.set(f.key, f);
  return m;
};

const pushChange = (
  out: DiffChange[],
  path: string,
  oldVal: any,
  newVal: any
) => {
  if (!deepEqual(oldVal, newVal))
    out.push({ path, old: oldVal ?? null, new: newVal ?? null });
};

function diffFields(
  acc: DiffChange[],
  basePath: string,
  oldFields: Field[],
  newFields: Field[]
) {
  const oldMap = byFieldKey(oldFields || []);
  const newMap = byFieldKey(newFields || []);

  // deletions
  for (const [fkey, ofield] of oldMap) {
    if (!newMap.has(fkey)) {
      pushChange(acc, `${basePath}.fields[${fkey}]`, ofield, null);
    }
  }

  // additions & edits
  for (const [fkey, nfield] of newMap) {
    const p = `${basePath}.fields[${fkey}]`;
    const ofield = oldMap.get(fkey);
    if (!ofield) {
      pushChange(acc, p, null, nfield);
      continue;
    }
    // property-level updates
    for (const k of FIELD_KEYS) {
      const propPath = `${p}.${String(k)}`;
      // for fileMeta & showIf, you said "which value updated", we still pass old/new (object)
      pushChange(acc, propPath, (ofield as any)[k], (nfield as any)[k]);
    }
  }
}

function diffInnerSections(
  acc: DiffChange[],
  basePath: string,
  oldInners: InnerSection[] = [],
  newInners: InnerSection[] = []
) {
  const oldMap = byKey(oldInners);
  const newMap = byKey(newInners);

  // deletions
  for (const [ikey, osec] of oldMap) {
    if (!newMap.has(ikey))
      pushChange(acc, `${basePath}.inner[${ikey}]`, osec, null);
  }

  // additions & edits
  for (const [ikey, nsec] of newMap) {
    const p = `${basePath}.inner[${ikey}]`;
    const osec = oldMap.get(ikey);
    if (!osec) {
      pushChange(acc, p, null, nsec);
      continue;
    }
    // meta
    for (const mk of INNER_SECTION_META_KEYS) {
      pushChange(
        acc,
        `${p}.${String(mk)}`,
        (osec as any)[mk],
        (nsec as any)[mk]
      );
    }
    // fields
    diffFields(acc, p, osec.fields || [], nsec.fields || []);
    // recurse
    diffInnerSections(
      acc,
      p,
      osec.innerSections || [],
      nsec.innerSections || []
    );
  }
}

function diffDocuments(
  oldDocs: Section | null,
  newDocs: Section | null
): DiffChange[] {
  const acc: DiffChange[] = [];
  const basePath = "documents"; // root label for clarity

  // whole subtree add/remove
  if (!oldDocs && newDocs) {
    pushChange(acc, basePath, null, newDocs);
    return acc;
  }
  if (oldDocs && !newDocs) {
    pushChange(acc, basePath, oldDocs, null);
    return acc;
  }
  if (!oldDocs || !newDocs) return acc;

  // top-level (documents) meta
  for (const mk of SECTION_META_KEYS) {
    pushChange(
      acc,
      `${basePath}.${String(mk)}`,
      (oldDocs as any)[mk],
      (newDocs as any)[mk]
    );
  }

  // documents' own fields (normally empty, but supported)
  diffFields(acc, basePath, oldDocs.fields || [], newDocs.fields || []);

  // inner sections (the real content)
  diffInnerSections(
    acc,
    basePath,
    oldDocs.innerSections || [],
    newDocs.innerSections || []
  );

  return acc;
}

/* --------------------------- Component --------------------------- */

export default function EmployeeDocumentConfigPage() {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("config-documents", "write");

  const [loading, setLoading] = useState(true);

  // We edit ONLY the `documents` section subtree
  const [documentsSection, setDocumentsSection] = useState<Section | null>(
    null
  );
  const [initialDocuments, setInitialDocuments] = useState<Section | null>(
    null
  ); // baseline
  const [fullConfig, setFullConfig] = useState<Section[]>([]);

  // Add Section modal
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [newSectionAccess, setNewSectionAccess] =
    useState<EmployeeAccess>("edit");
  const [targetPathForNewSection, setTargetPathForNewSection] = useState<
    number[]
  >([]);

  // Add Field modal
  const [fieldModal, setFieldModal] = useState<{
    visible: boolean;
    sectionPath: number[];
  }>({
    visible: false,
    sectionPath: [],
  });
  const [newFieldChoice, setNewFieldChoice] = useState<string | null>(null);
  const [newFieldCustomLabel, setNewFieldCustomLabel] = useState("");

  // (nested add section – currently unused)
  const [innerSectionModal, setInnerSectionModal] = useState<{
    visible: boolean;
    sectionPath: number[];
  }>({
    visible: false,
    sectionPath: [],
  });
  const [newInnerSectionLabel, setNewInnerSectionLabel] = useState("");
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [selectedDesignationId, setSelectedDesignationId] = useState<
    string | null
  >(null);

  /* --------------------------- Load config --------------------------- */

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get("/employee-field-config");
        const allSections = (res.data?.data?.sections || []) as Section[];
        setFullConfig(allSections);

        const docs =
          allSections.find(
            (s) => (s.sectionKey || "").toLowerCase() === "documents"
          ) || null;

        if (!docs) {
          const fresh: Section = {
            sectionKey: "documents",
            sectionLabel: "Documents",
            fields: [],
            innerSections: [],
            employeeAccess: "edit",
          };
          const sanitized = sanitizeNode(fresh);
          setDocumentsSection(sanitized);
          setInitialDocuments(structuredClone(sanitized));
        } else {
          const sanitized = sanitizeNode(docs);
          setDocumentsSection(sanitized);
          setInitialDocuments(structuredClone(sanitized)); // baseline
          // Auto-expand first inner section
          if (sanitized.innerSections && sanitized.innerSections.length > 0) {
            setExpandedSections(
              new Set([sanitized.innerSections[0].sectionKey])
            );
          }
        }
      } catch (e) {
        console.error(e);
        toast.error("Failed to load document config");
        setDocumentsSection(null);
        setInitialDocuments(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* --------------------------- Load Designations --------------------------- */

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axiosInstance.get("/designations");
        console.log("data", data);
        setDesignations(data?.data || []);
      } catch (e) {
        console.error("Failed to load designations:", e);
      }
    })();
  }, []);

  /* --------------------------- Filter documents by designation --------------------------- */

  const filterDocumentsByDesignation = (section: Section): Section => {
    if (!selectedDesignationId) return section;

    const filterSection = (
      s: Section | InnerSection
    ): Section | InnerSection | null => {
      // If section has fields, filter them
      const filteredFields = (s.fields || []).filter((field: any) => {
        const jobRoles = field.jobRole || [];
        return jobRoles.includes(selectedDesignationId);
      });

      // Only include section if it has matching fields or it has matching inner sections
      const hasMatchingFields = filteredFields.length > 0;

      const filteredInnerSections = (s.innerSections || [])
        .map(filterSection)
        .filter(Boolean) as (Section | InnerSection)[];

      const hasMatchingInnerSections = filteredInnerSections.length > 0;

      // If no matching fields or inner sections, exclude this section
      if (!hasMatchingFields && !hasMatchingInnerSections) {
        return null;
      }

      return {
        ...s,
        fields: filteredFields,
        innerSections: hasMatchingInnerSections ? filteredInnerSections : [],
      };
    };

    const result = filterSection(section) as Section;
    // If result is null or has no inner sections, return a section with empty innerSections
    if (!result || (result.innerSections || []).length === 0) {
      return {
        ...section,
        innerSections: [],
      };
    }
    return result;
  };

  const filteredDocumentsSection = useMemo(() => {
    if (!documentsSection || !selectedDesignationId) return documentsSection;
    return filterDocumentsByDesignation(documentsSection);
  }, [documentsSection, selectedDesignationId]);

  /* --------------------------- Path helpers --------------------------- */

  function resolvePathInDocuments(
    root: Section,
    path: number[]
  ): Section | InnerSection {
    let current: Section | InnerSection = root;
    for (let i = 0; i < path.length; i++) {
      if (!current.innerSections || current.innerSections[path[i]] == null) {
        throw new Error(`Invalid path: ${path.join(",")}`);
      }
      current = current.innerSections[path[i]];
    }
    return current;
  }

  function updateDocuments(mutator: (draft: Section) => void) {
    setDocumentsSection((prev) => {
      if (!prev) return prev;
      const copy = structuredClone(prev);
      mutator(copy);
      return copy;
    });
  }

  /* --------------------------- Add Section --------------------------- */

  const openAddSectionModal = (path: number[] = []) => {
    setTargetPathForNewSection(path);
    setNewSectionLabel("");
    setNewSectionAccess("edit");
    setShowSectionModal(true);
  };

  const addInnerSectionAtPath = () => {
    if (!documentsSection) return;
    if (!newSectionLabel.trim()) return;

    updateDocuments((doc) => {
      const target =
        targetPathForNewSection.length === 0
          ? (doc as Section | InnerSection)
          : resolvePathInDocuments(doc, targetPathForNewSection);

      if (!target.innerSections) target.innerSections = [];
      target.innerSections.push({
        sectionKey: `inner_${Date.now()}`,
        sectionLabel: newSectionLabel.trim(),
        fields: [],
        innerSections: [],
        requirementMode: "AND",
        isAdditional: true,
        employeeAccess: newSectionAccess,
      });
    });

    setShowSectionModal(false);
  };

  /* --------------------------- Field ops --------------------------- */

  const targetSectionForNewField = useMemo(() => {
    if (!documentsSection || !fieldModal.sectionPath.length) return null;
    try {
      return resolvePathInDocuments(documentsSection, fieldModal.sectionPath);
    } catch {
      return null;
    }
  }, [documentsSection, fieldModal.sectionPath]);

  const previewNewFieldLabel = useMemo(() => {
    return newFieldChoice === CUSTOM_SENTINEL
      ? newFieldCustomLabel.trim()
      : (newFieldChoice || "").trim();
  }, [newFieldChoice, newFieldCustomLabel]);

  const previewNewFieldKey = useMemo(() => {
    const base = slugify(previewNewFieldLabel || "");
    if (!base || !targetSectionForNewField) return "";
    return ensureUniqueKey(base, targetSectionForNewField.fields || []);
  }, [previewNewFieldLabel, targetSectionForNewField]);

  const addFieldToSection = () => {
    if (!documentsSection) return;

    const finalLabel = previewNewFieldLabel;
    if (!finalLabel) {
      toast.error("Please choose or enter a field label.");
      return;
    }
    const finalKey = previewNewFieldKey;
    if (!finalKey) {
      toast.error("Could not generate a key. Try a different label.");
      return;
    }

    updateDocuments((doc) => {
      const target = resolvePathInDocuments(doc, fieldModal.sectionPath);
      if (!target.fields) (target as any).fields = [];
      target.fields.push({
        key: finalKey,
        label: finalLabel,
        placeholder: "",
        required: false,
        type: "file",
        isAdditional: true,
        jobRole: [], // Initialize empty array
        fileMeta: {
          expiryDate: false,
          issuingDate: false,
          validityPeriod: undefined,
          expiryIsDisabled: false,
        },
      });
    });

    setFieldModal({ visible: false, sectionPath: [] });
    setNewFieldChoice(null);
    setNewFieldCustomLabel("");
  };

  const handleFieldChange = (
    path: number[],
    fieldIndex: number,
    key: keyof Field,
    value: any
  ) => {
    if (!documentsSection) return;
    updateDocuments((doc) => {
      const target = resolvePathInDocuments(doc, path);
      (target.fields[fieldIndex] as any)[key] = value;
    });
  };

  const deleteFieldAtPath = (path: number[], fieldKey: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this field?"
    );
    if (!confirmed) return;
    updateDocuments((doc) => {
      const target = resolvePathInDocuments(doc, path);
      target.fields = (target.fields || []).filter((f) => f.key !== fieldKey);
    });
    toast.success("Field removed successfully.");
  };

  /* --------------------------- Save (with “what changed” diff) --------------------------- */

  const handleSave = async () => {
    if (!documentsSection) return;
    try {
      // sanitize working copy
      const nextDocs = sanitizeNode(documentsSection);

      // build final sections by replacing or appending documents section
      let final: Section[];
      const idx = fullConfig.findIndex(
        (s) => (s.sectionKey || "").toLowerCase() === "documents"
      );
      if (idx === -1) {
        final = [...fullConfig, nextDocs];
      } else {
        final = [...fullConfig];
        final[idx] = nextDocs;
      }

      // DIFF: only what changed (old → new) in the documents subtree
      const diff: DiffChange[] = diffDocuments(initialDocuments, nextDocs);

      // Debug: Check if jobRole is in the data
      console.log(
        "🔍 [DEBUG] Saving sections with jobRole:",
        JSON.stringify(final, null, 2)
      );

      await axiosInstance.post("/employee-field-config", {
        sections: final,
        diff, // <- exact updated values only
      });

      // update local baselines
      setFullConfig(final);
      setInitialDocuments(structuredClone(nextDocs));

      toast.success("Document config saved successfully.");
    } catch (e: any) {
      console.error("Failed to save document config:", e);
      const errorMessage =
        e?.response?.data?.message || "Failed to save document config";
      toast.error(errorMessage);
    }
  };

  /* --------------------------- Render --------------------------- */

  // Get section theme colors based on section label
  const getSectionTheme = (sectionLabel: string) => {
    const label = sectionLabel.toLowerCase();
    if (label.includes("identification") || label.includes("id")) {
      return {
        icon: Folder,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
        titleColor: "text-blue-700",
        borderColor: "border-blue-200",
        bgColor: "bg-blue-50/30",
        buttonColor: "bg-blue-600 hover:bg-blue-700",
      };
    } else if (label.includes("certificate")) {
      return {
        icon: FileText,
        iconColor: "text-green-600",
        iconBg: "bg-green-100",
        titleColor: "text-green-700",
        borderColor: "border-green-200",
        bgColor: "bg-green-50/30",
        buttonColor: "bg-green-600 hover:bg-green-700",
      };
    } else if (label.includes("check") || label.includes("clearance")) {
      return {
        icon: Shield,
        iconColor: "text-purple-600",
        iconBg: "bg-purple-100",
        titleColor: "text-purple-700",
        borderColor: "border-purple-200",
        bgColor: "bg-purple-50/30",
        buttonColor: "bg-purple-600 hover:bg-purple-700",
      };
    }
    // Default theme (blue/grey)
    return {
      icon: Folder,
      iconColor: "text-gray-600",
      iconBg: "bg-gray-100",
      titleColor: "text-gray-700",
      borderColor: "border-gray-200",
      bgColor: "bg-gray-50/30",
      buttonColor: "bg-gray-600 hover:bg-gray-700",
    };
  };

  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  const toggleField = (fieldKey: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) {
        next.delete(fieldKey);
      } else {
        next.add(fieldKey);
      }
      return next;
    });
  };

  const renderSection = (
    section: Section | InnerSection,
    path: number[],
    _isTopLevelInner = false
  ) => {
    const allFieldsAreFiles =
      section.fields.length > 0 &&
      section.fields.every((f) => f.type === "file");

    const additional = !!section.isAdditional;
    const employeeAccess = coerceEmployeeAccess(section);
    const badge = badgeForAccess(employeeAccess);
    const theme = getSectionTheme(section.sectionLabel);
    const IconComponent = theme.icon;
    const isExpanded = expandedSections.has(section.sectionKey);

    // Count required roles for each field
    const getRequiredRolesCount = (field: Field) => {
      if (!field.jobRole || field.jobRole.length === 0) {
        return designations.length; // "all roles" if no specific roles
      }
      return field.jobRole.length;
    };

    const getRequiredRolesText = (field: Field) => {
      const count = getRequiredRolesCount(field);
      if (count === designations.length) {
        return "Required for all roles";
      }
      return `Required for ${count} ${count === 1 ? "role" : "roles"}`;
    };

    return (
      <div
        key={section.sectionKey}
        className={`border ${theme.borderColor} rounded-lg overflow-hidden ${theme.bgColor} mb-4`}
      >
        {/* Section Header */}
        <div className={`${theme.bgColor} border-b ${theme.borderColor} p-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div
                className={`${theme.iconBg} p-2.5 rounded-lg flex items-center justify-center`}
              >
                <IconComponent className={`${theme.iconColor} w-5 h-5`} />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {section.sectionLabel}
                </h2>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
                    title={badge.title}
                  >
                    <CheckCircle2 size={12} /> {badge.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    {section.fields.length}{" "}
                    {section.fields.length === 1 ? "document" : "documents"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {allFieldsAreFiles && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">
                    Requirement Mode:
                  </label>
                  <select
                    value={section.requirementMode || "AND"}
                    onChange={(e) => {
                      const mode = e.target.value as "AND" | "OR";
                      updateDocuments((doc) => {
                        const target = resolvePathInDocuments(doc, path);
                        (target as any).requirementMode = mode;
                      });
                    }}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] appearance-none cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <option value="AND">Optional</option>
                    <option value="OR">Any Required</option>
                  </select>
                </div>
              )}

              {canWrite && (
                <button
                  onClick={() =>
                    setFieldModal({ visible: true, sectionPath: path })
                  }
                  className={`${theme.buttonColor} text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors`}
                >
                  <Plus size={14} /> Add Field
                </button>
              )}

              <button
                onClick={() => toggleSection(section.sectionKey)}
                className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
              >
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Section Content (Collapsible) */}
        {isExpanded && (
          <div className="p-4">
            {employeeAccess === "hidden" && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  This section is <strong>hidden from employees</strong> and
                  only editable by employer.
                </p>
              </div>
            )}
            {employeeAccess === "view" && (
              <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-lg">
                <p className="text-xs text-violet-700">
                  Employees can <strong>view</strong> this section, but only
                  employer can edit.
                </p>
              </div>
            )}

            {/* Document Fields Grid */}
            {section.fields.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {section.fields.map((field, fieldIndex) => (
                  <div
                    key={field.key}
                    className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow self-start"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <GripVertical className="w-4 h-4 text-gray-400 mt-1 cursor-move flex-shrink-0" />
                        <div className="bg-blue-50 rounded-lg p-2 flex-shrink-0">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-900 text-sm mb-1.5">
                            {field.label}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2">
                            {field.fileMeta?.expiryDate && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                <Calendar size={12} />
                                Expiry Tracking
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {getRequiredRolesText(field)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {canWrite && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleField(field.key);
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        {canWrite && (
                          <button
                            onClick={() => deleteFieldAtPath(path, field.key)}
                            className="p-1.5 hover:bg-red-50 rounded text-gray-600 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleField(field.key);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded text-gray-600 hover:text-gray-900 transition-colors"
                          title={
                            expandedFields.has(field.key)
                              ? "Collapse"
                              : "Expand"
                          }
                        >
                          {expandedFields.has(field.key) ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    {/* Field Details (Expandable) */}
                    {expandedFields.has(field.key) && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <FieldDisclosure
                          field={field}
                          allFields={section.fields}
                          parentRequirementMode={section.requirementMode}
                          onChange={(k, v) =>
                            handleFieldChange(path, fieldIndex, k as any, v)
                          }
                          onDelete={
                            canWrite
                              ? () => deleteFieldAtPath(path, field.key)
                              : undefined
                          }
                          designations={designations}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm">
                No documents in this section. Click "Add Field" to add one.
              </div>
            )}

            {/* Nested Inner Sections */}
            {section.innerSections?.map((inner, idx) =>
              renderSection(inner, [...path, idx])
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!documentsSection)
    return (
      <div className="p-6 text-center text-red-500">
        Documents section not found.
      </div>
    );

  return (
    <>
      <div className="space-y-6 max-w-full">
        {/* Top Section: Filter and Save Button */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Filter by Job Title:
            </label>
            <select
              value={selectedDesignationId || ""}
              onChange={(e) => setSelectedDesignationId(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] bg-white appearance-none cursor-pointer"
            >
              <option value="">All Documents</option>
              {designations.map((designation) => (
                <option key={designation._id} value={designation._id}>
                  {designation.name}
                </option>
              ))}
            </select>
          </div>
          {canWrite && (
            <div className="flex items-center gap-3">
              <Button
                onClick={handleSave}
                className="bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
              >
                <Save className="h-4 w-4" /> Save Configuration
              </Button>
            </div>
          )}
        </div>

        {!filteredDocumentsSection ||
        (filteredDocumentsSection.innerSections || []).length === 0 ? (
          <div className="border rounded-lg p-6 text-gray-500 bg-gray-50">
            {selectedDesignationId
              ? "No documents are required for this Job Title."
              : 'No document groups yet. Click "Add Section" to create one under Documents.'}
          </div>
        ) : (
          <>
            {filteredDocumentsSection.innerSections!.map((inner, idx) =>
              renderSection(inner, [idx], true)
            )}
            {canWrite && (
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => openAddSectionModal([])}
                  className="border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center gap-2 text-gray-700 font-medium"
                >
                  <Plus className="h-4 w-4" /> Add New Section
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Section Modal */}
      <Modal
        visible={showSectionModal}
        title="Add Section under Documents"
        onClose={() => setShowSectionModal(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addInnerSectionAtPath();
          }}
          className="space-y-5"
        >
          <Input
            label="Section Label"
            placeholder="Enter section name (e.g. Licences)"
            value={newSectionLabel}
            onChange={(e) => setNewSectionLabel(e.target.value)}
          />

          <fieldset className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Employee access
            </label>
            <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
              <button
                type="button"
                className={`px-3 py-1.5 text-sm ${
                  newSectionAccess === "edit"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700"
                }`}
                onClick={() => setNewSectionAccess("edit")}
              >
                Edit
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm border-l ${
                  newSectionAccess === "view"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700"
                }`}
                onClick={() => setNewSectionAccess("view")}
              >
                View
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-sm border-l ${
                  newSectionAccess === "hidden"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700"
                }`}
                onClick={() => setNewSectionAccess("hidden")}
              >
                Hidden
              </button>
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button type="submit">Add Section</Button>
          </div>
        </form>
      </Modal>

      {/* Add Field Modal */}
      <Modal
        visible={fieldModal.visible}
        title="Add Field"
        onClose={() => {
          setFieldModal({ visible: false, sectionPath: [] });
          setNewFieldChoice(null);
          setNewFieldCustomLabel("");
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addFieldToSection();
          }}
          className="space-y-5"
        >
          <Select
            label="Field Label"
            // @ts-ignore searchable if supported
            isSearchable
            placeholder="Choose a label or pick 'Custom…'"
            value={
              newFieldChoice && newFieldChoice !== CUSTOM_SENTINEL
                ? { label: newFieldChoice, value: newFieldChoice }
                : newFieldChoice === CUSTOM_SENTINEL
                  ? { label: "Custom…", value: CUSTOM_SENTINEL }
                  : null
            }
            onChange={(opt) => setNewFieldChoice(opt?.value || null)}
            options={[
              ...PREDEFINED_FILE_FIELDS.map((l) => ({ label: l, value: l })),
              { label: "Custom…", value: CUSTOM_SENTINEL },
            ]}
          />

          {newFieldChoice === CUSTOM_SENTINEL && (
            <Input
              label="Custom Label"
              placeholder='e.g. "Blue Card"'
              value={newFieldCustomLabel}
              onChange={(e) => setNewFieldCustomLabel(e.target.value)}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Field Type"
              value="file"
              readOnly
              className="bg-gray-50"
            />
            <Input
              label="Generated Key (preview)"
              value={targetSectionForNewField ? previewNewFieldKey : ""}
              readOnly
              className="bg-gray-50"
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit">Add Field</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* --------------------------- Modal --------------------------- */

function Modal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Transition appear show={visible} as={Fragment}>
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
                    {title}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

/* --------------------------- FieldDisclosure --------------------------- */

function FieldDisclosure({
  field,
  onChange,
  allFields,
  parentRequirementMode,
  onDelete,
  designations,
}: {
  field: Field;
  onChange: (key: keyof Field, value: any) => void;
  allFields: Field[];
  parentRequirementMode?: "AND" | "OR";
  onDelete?: () => void;
  designations: Designation[];
}) {
  // parse/build validity helpers
  const parseValidity = (str?: string): { years: string; months: string } => {
    if (!str) return { years: "0", months: "0" };
    const y = str.match(/^\s*([\d.]+)\s*Years?/i);
    if (y) return { years: String(Math.floor(Number(y[1]) || 0)), months: "0" };
    const m = str.match(/^\s*([\d.]+)\s*Months?/i);
    if (m) {
      const monthsTotal = Number(m[1]) || 0;
      const years = Math.floor(monthsTotal / 12);
      const months = Math.round(monthsTotal - years * 12);
      return { years: String(years), months: String(months) };
    }
    const d = str.match(/^\s*([\d.]+)\s*Days?/i);
    if (d) {
      const days = Number(d[1]) || 0;
      const monthsApprox = Math.round(days / 30);
      const years = Math.floor(monthsApprox / 12);
      const months = monthsApprox - years * 12;
      return { years: String(years), months: String(months) };
    }
    return { years: "0", months: "0" };
  };

  const buildValidity = (
    yearsStr: string,
    monthsStr: string
  ): string | undefined => {
    const years = parseInt((yearsStr || "0").trim(), 10) || 0;
    const months = parseInt((monthsStr || "0").trim(), 10) || 0;
    if (years === 0 && months === 0) return undefined;
    if (years > 0 && months > 0) {
      const total = years * 12 + months;
      return `${total} ${total === 1 ? "Month" : "Months"}`;
    }
    if (years > 0) return `${years} ${years === 1 ? "Year" : "Years"}`;
    return `${months} ${months === 1 ? "Month" : "Months"}`;
  };

  const validity = parseValidity(field.fileMeta?.validityPeriod);
  const yearsOptions = Array.from({ length: 21 }, (_, n) => ({
    label: String(n),
    value: String(n),
  }));
  const monthsOptions = Array.from({ length: 13 }, (_, n) => ({
    label: String(n),
    value: String(n),
  }));

  // Toggle switch component (toggle on left, label on right)
  const ToggleSwitch = ({
    checked,
    onChange,
    label,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
  }) => {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            checked ? "bg-blue-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <label
          className="text-sm font-medium text-gray-700 cursor-pointer"
          onClick={() => onChange(!checked)}
        >
          {label}
        </label>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Label Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Label
        </label>
        <input
          type="text"
          value={field.label}
          onChange={(e) => onChange("label", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter field label"
        />
      </div>

      {/* Placeholder Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Placeholder
        </label>
        <input
          type="text"
          value={field.placeholder || ""}
          onChange={(e) => onChange("placeholder", e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Enter placeholder text"
        />
      </div>

      {field.type === "file" && (
        <div className="space-y-4 pt-2">
          {/* Expiry Date Toggle */}
          <ToggleSwitch
            checked={field.fileMeta?.expiryDate ?? false}
            onChange={(checked) =>
              onChange("fileMeta", {
                ...(field.fileMeta || {}),
                expiryDate: checked,
              })
            }
            label="Expiry Date"
          />

          {/* Auto-calculate Expiry from Issuing + Validity */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-900 mb-3">
              Auto-calculate Expiry from Issuing + Validity
            </p>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Years
                </label>
                <Select
                  label=""
                  value={{ label: validity.years, value: validity.years }}
                  onChange={(opt) => {
                    const years = (opt?.value ?? "0").toString();
                    const str = buildValidity(years, validity.months);
                    onChange("fileMeta", {
                      ...(field.fileMeta || {}),
                      validityPeriod: str,
                    });
                  }}
                  options={yearsOptions}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Months
                </label>
                <Select
                  label=""
                  value={{ label: validity.months, value: validity.months }}
                  onChange={(opt) => {
                    const months = (opt?.value ?? "0").toString();
                    const str = buildValidity(validity.years, months);
                    onChange("fileMeta", {
                      ...(field.fileMeta || {}),
                      validityPeriod: str,
                    });
                  }}
                  options={monthsOptions}
                />
              </div>
              <div className="pb-1">
                <ToggleSwitch
                  checked={field.fileMeta?.expiryIsDisabled ?? false}
                  onChange={(checked) =>
                    onChange("fileMeta", {
                      ...(field.fileMeta || {}),
                      expiryIsDisabled: checked,
                    })
                  }
                  label="Lock"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Titles Section */}
      <div className="pt-2 border-t border-gray-200">
        <label className="block text-sm font-medium text-gray-900 mb-1.5">
          Job Titles
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Select which Job Titles need this document
        </p>
        <div className="flex flex-wrap gap-2">
          {designations.map((designation) => {
            const isSelected =
              field.jobRole?.includes(designation._id) || false;
            return (
              <button
                key={designation._id}
                type="button"
                onClick={() => {
                  const currentJobRoles = field.jobRole || [];
                  const newJobRoles = isSelected
                    ? currentJobRoles.filter((id) => id !== designation._id)
                    : [...currentJobRoles, designation._id];
                  onChange("jobRole", newJobRoles);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-green-50 border border-green-200 text-green-700 hover:bg-green-100"
                    : "bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100"
                }`}
              >
                {isSelected ? (
                  <CheckCircle2
                    size={16}
                    className="text-green-600 flex-shrink-0"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" />
                )}
                <span>{designation.name}</span>
              </button>
            );
          })}
          {designations.length === 0 && (
            <p className="text-xs text-gray-400">No designations available</p>
          )}
        </div>
      </div>
    </div>
  );
}
