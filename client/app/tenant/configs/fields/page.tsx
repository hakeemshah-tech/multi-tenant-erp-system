// "use client";

// import { Fragment, useEffect, useState } from "react";
// import { Input, Button, Textarea, Select, Tab } from "rizzui";
// import { Dialog, Transition, Disclosure } from "@headlessui/react";
// import { Plus, X, ChevronsUpDown, Lock, Eye, Pencil } from "lucide-react";
// import toast from "react-hot-toast";
// import axiosInstance from "@/app/lib/axios";

// /** -------------------------
//  * Types
//  * ------------------------- */
// type EmployeeAccess = "hidden" | "view" | "edit";

// interface FileMeta {
//   expiryDate?: boolean;
//   points?: number;
//   referenceNumber?: boolean;
//   issuingDate?: boolean;
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
//   employeeAccess?: EmployeeAccess; // NEW
// }

// interface Section {
//   sectionKey: string;
//   sectionLabel: string;
//   fields: Field[];
//   innerSections?: InnerSection[];
//   isAdditional?: boolean;
//   requirementMode?: "AND" | "OR"; // only used if all top-level fields are file
//   employeeAccess?: EmployeeAccess; // NEW
// }

// /** -------------------------
//  * Helpers
//  * ------------------------- */

// // Legacy -> new, defensive mapping in case the API still returns the old boolean for any document.
// function coerceEmployeeAccess(
//   s: Partial<Section | InnerSection>
// ): EmployeeAccess {
//   if (
//     s.employeeAccess === "hidden" ||
//     s.employeeAccess === "view" ||
//     s.employeeAccess === "edit"
//   ) {
//     return s.employeeAccess;
//   }
//   return "edit";
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
//       return {
//         label: "Employee can edit",
//         icon: <Pencil size={12} />,
//         className: "bg-emerald-100 text-emerald-800",
//         title: "Employees and employer can view & edit.",
//       };
//   }
// }

// /** -------------------------
//  * Component
//  * ------------------------- */
// export default function EmployeeConfigPage() {
//   const [sections, setSections] = useState<Section[]>([]);
//   const [loading, setLoading] = useState(true);

//   // Modal states
//   const [showSectionModal, setShowSectionModal] = useState(false);
//   const [newSectionLabel, setNewSectionLabel] = useState("");
//   const [newSectionAccess, setNewSectionAccess] =
//     useState<EmployeeAccess>("edit");

//   const [fieldModal, setFieldModal] = useState<{
//     visible: boolean;
//     sectionPath: number[];
//   }>({ visible: false, sectionPath: [] });

//   const [innerSectionModal, setInnerSectionModal] = useState<{
//     visible: boolean;
//     sectionPath: number[];
//   }>({ visible: false, sectionPath: [] });

//   const [newField, setNewField] = useState<{ label: string; type: string }>({
//     label: "",
//     type: "text",
//   });

//   const [newInnerSectionLabel, setNewInnerSectionLabel] = useState("");

//   const confirmDeleteField = (fieldKeyToDelete: string) => {
//     const confirmed = window.confirm(
//       "Are you sure you want to delete this field?"
//     );
//     if (!confirmed) return;

//     setSections((prev) => {
//       const updated = structuredClone(prev);

//       const removeFieldByKey = (
//         section: Section | InnerSection
//       ): Section | InnerSection => {
//         section.fields = section.fields.filter(
//           (f) => f.key !== fieldKeyToDelete
//         );
//         if (section.innerSections) {
//           section.innerSections = section.innerSections.map(removeFieldByKey);
//         }
//         return section;
//       };

//       return updated.map(removeFieldByKey) as Section[];
//     });

//     toast.success("Field removed successfully.");
//   };

//   const fetchConfig = async () => {
//     try {
//       const res = await axiosInstance.get("/employee-field-config");
//       const rawSections: any[] = res?.data?.data?.sections || [];

//       // Defensive legacy mapping (recursively)
//       const mapLegacy = (s: any): Section | InnerSection => {
//         const mapped: any = {
//           ...s,
//           employeeAccess: coerceEmployeeAccess(s),
//         };
//         if (Array.isArray(mapped.innerSections)) {
//           mapped.innerSections = mapped.innerSections.map(mapLegacy);
//         }
//         return mapped;
//       };

//       setSections(rawSections.map(mapLegacy) as Section[]);
//     } catch (error) {
//       console.error("Failed to load config", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchConfig();
//   }, []);

//   const handleInputChange = (
//     path: number[],
//     fieldIndex: number,
//     key: keyof Field,
//     value: any
//   ) => {
//     setSections((prev) => {
//       const updated = structuredClone(prev);
//       const targetSection = resolveSectionPath(updated, path);
//       (targetSection.fields[fieldIndex] as any)[key] = value;
//       return updated;
//     });
//   };

//   const handleSave = async () => {
//     try {
//       const sanitize = (s: any): any => {
//         const copy = { ...s, employeeAccess: coerceEmployeeAccess(s) };
//         delete (copy as any).employeerOnlyEditable;
//         delete (copy as any).employerOnlyEditable;
//         if (Array.isArray(copy.innerSections)) {
//           copy.innerSections = copy.innerSections.map(sanitize);
//         }
//         return copy;
//       };

//       const payload = sections.map(sanitize);
//       await axiosInstance.post("/employee-field-config", { sections: payload });
//       toast.success("Configuration saved successfully.");
//     } catch (error) {
//       console.error("Save failed", error);
//       toast.error("Failed to save configuration");
//     }
//   };

//   const addSection = () => {
//     if (!newSectionLabel.trim()) return;
//     setSections((prev) => [
//       ...prev,
//       {
//         sectionKey: `section_${Date.now()}`,
//         sectionLabel: newSectionLabel,
//         fields: [],
//         innerSections: [],
//         isAdditional: true,
//         employeeAccess: newSectionAccess,
//       },
//     ]);
//     setNewSectionLabel("");
//     setNewSectionAccess("edit");
//     setShowSectionModal(false);
//   };

//   const addFieldToSection = () => {
//     if (!fieldModal.sectionPath.length || !newField.label.trim()) return;
//     setSections((prev) => {
//       const copy = structuredClone(prev);
//       const target = resolveSectionPath(copy, fieldModal.sectionPath);

//       target.fields.push({
//         key: `field_${Date.now()}`,
//         label: newField.label,
//         placeholder: "",
//         required: false,
//         type: newField.type,
//         isAdditional: true,
//         ...(newField.type === "reference" && { referenceModel: "" }),
//       });
//       return copy;
//     });
//     setFieldModal({ visible: false, sectionPath: [] });
//     setNewField({ label: "", type: "text" });
//   };

//   const addInnerSection = () => {
//     if (!innerSectionModal.sectionPath.length || !newInnerSectionLabel.trim())
//       return;
//     setSections((prev) => {
//       const copy = structuredClone(prev);
//       const target = resolveSectionPath(copy, innerSectionModal.sectionPath);

//       if (!target.innerSections) target.innerSections = [];
//       target.innerSections.push({
//         sectionKey: `inner_${Date.now()}`,
//         sectionLabel: newInnerSectionLabel,
//         fields: [],
//         innerSections: [],
//         requirementMode: "AND",
//         isAdditional: true,
//         employeeAccess: "edit", // default for new inner sections
//       });
//       return copy;
//     });
//     setInnerSectionModal({ visible: false, sectionPath: [] });
//     setNewInnerSectionLabel("");
//   };

//   function resolveSectionPath(
//     sectionsArr: Section[],
//     path: number[]
//   ): Section | InnerSection {
//     let current: Section | InnerSection = sectionsArr[path[0]];
//     for (let i = 1; i < path.length; i++) {
//       if (!current.innerSections || !current.innerSections[path[i]]) {
//         throw new Error(`Invalid section path: ${path.join(",")}`);
//       }
//       current = current.innerSections[path[i]];
//     }
//     return current;
//   }

//   const renderSection = (section: Section | InnerSection, path: number[]) => {
//     const allFieldsAreFiles =
//       section.fields.length > 0 &&
//       section.fields.every((f) => f.type === "file");

//     const topLevel = path.length === 1;
//     const additional = "isAdditional" in section && !!section.isAdditional;
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

//           {/* Right: actions + tri-state access control */}
//           <div className="flex items-center gap-3">
//             {/* Show for ANY isAdditional section (top-level or inner) */}
//             {"isAdditional" in section && section.isAdditional && (
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
//                       setSections((prev) => {
//                         const copy = structuredClone(prev);
//                         const target = resolveSectionPath(copy, path);
//                         (target as Section | InnerSection).employeeAccess =
//                           "edit";
//                         return copy;
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
//                       setSections((prev) => {
//                         const copy = structuredClone(prev);
//                         const target = resolveSectionPath(copy, path);
//                         (target as Section | InnerSection).employeeAccess =
//                           "view";
//                         return copy;
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
//                       setSections((prev) => {
//                         const copy = structuredClone(prev);
//                         const target = resolveSectionPath(copy, path);
//                         (target as Section | InnerSection).employeeAccess =
//                           "hidden";
//                         return copy;
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
//               + Add Field
//             </Button>

//             {/* Prevent 2nd-level nesting: show "+ Add Inner Section" ONLY on top-level */}
//             {topLevel && (
//               <Button
//                 size="sm"
//                 variant="outline"
//                 onClick={() =>
//                   setInnerSectionModal({ visible: true, sectionPath: path })
//                 }
//               >
//                 + Add Inner Section
//               </Button>
//             )}
//           </div>
//         </div>

//         {employeeAccess === "hidden" && (
//           <p
//             className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 inline-block"
//             title="This section is hidden from employees and cannot be viewed or edited by them."
//           >
//             This section is <strong>hidden from employees</strong> and only
//             editable by employer.
//           </p>
//         )}

//         {employeeAccess === "view" && (
//           <p
//             className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded px-2 py-1 inline-block"
//             title="Employees can view but not edit this section."
//           >
//             Employees can <strong>view</strong> this section, but only employer
//             can edit.
//           </p>
//         )}

//         {allFieldsAreFiles && (
//           <div className="flex items-center gap-2 mb-2">
//             <label className="text-sm font-medium">Requirement Mode</label>
//             <select
//               value={(section as any).requirementMode || "AND"}
//               onChange={(e) => {
//                 const mode = e.target.value as "AND" | "OR";
//                 setSections((prev) => {
//                   const copy = structuredClone(prev);
//                   const target = resolveSectionPath(copy, path);
//                   (target as any).requirementMode = mode;
//                   return copy;
//                 });
//               }}
//               className="border rounded px-2 py-1 text-sm"
//             >
//               <option value="AND">All Required</option>
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
//               parentRequirementMode={(section as any).requirementMode}
//               onChange={(k, v) =>
//                 handleInputChange(path, fieldIndex, k as any, v)
//               }
//               confirmDeleteField={confirmDeleteField}
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

//   // --- IMPORTANT: keep original index when filtering to avoid path mismatches
//   const visibleTopSections = sections
//     .map((s, idx) => ({ section: s, idx }))
//     .filter((x) => (x.section.sectionKey || "").toLowerCase() !== "documents");

//   return (
//     <>
//       <div className="space-y-6 max-w-full">
//         <div className="flex items-center justify-between">
//           <h1 className="text-xl font-semibold">
//             Employee Field Configuration
//           </h1>
//           <div className="flex gap-3">
//             <Button
//               onClick={() => setShowSectionModal(true)}
//               variant="outline"
//               size="sm"
//             >
//               <Plus className="h-4 w-4 mr-1" /> Add Section
//             </Button>
//             <Button onClick={handleSave}>Save Config</Button>
//           </div>
//         </div>

//         {/* ---------- Tabs wrapper for top-level sections ---------- */}
//         {visibleTopSections.length === 0 ? (
//           <div className="p-8 text-center text-gray-500 border rounded-xl">
//             No sections configured yet.
//           </div>
//         ) : (
//           <Tab>
//             {/* Tab headers */}
//             <Tab.List className="flex w-full overflow-x-auto gap-2 pb-2 border-b mb-4">
//               {visibleTopSections.map(({ section }) => (
//                 <Tab.ListItem
//                   key={section.sectionKey}
//                   className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-gray-200 transition whitespace-nowrap"
//                 >
//                   {section.sectionLabel}
//                 </Tab.ListItem>
//               ))}
//             </Tab.List>

//             {/* Panels */}
//             <Tab.Panels>
//               {visibleTopSections.map(({ section, idx }) => (
//                 <Tab.Panel key={section.sectionKey}>
//                   {/* Use the REAL index from sections for path resolution */}
//                   {renderSection(section, [idx])}
//                 </Tab.Panel>
//               ))}
//             </Tab.Panels>
//           </Tab>
//         )}
//       </div>

//       {/* Add Section Modal */}
//       <Modal
//         visible={showSectionModal}
//         title="Add Section"
//         onClose={() => setShowSectionModal(false)}
//       >
//         <form
//           onSubmit={(e) => {
//             e.preventDefault();
//             addSection();
//           }}
//           className="space-y-5"
//         >
//           <Input
//             label="Section Label"
//             placeholder="Enter section name"
//             value={newSectionLabel}
//             onChange={(e) => setNewSectionLabel(e.target.value)}
//           />

//           <div className="text-xs text-gray-600 bg-gray-50 border rounded px-3 py-2">
//             New sections are created as <strong>Custom (Additional)</strong>.
//           </div>

//           {/* Employee access (tri-state) */}
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
//               Choose whether employees can edit, only view, or not see this
//               section at all.
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
//         onClose={() => setFieldModal({ visible: false, sectionPath: [] })}
//       >
//         <form
//           onSubmit={(e) => {
//             e.preventDefault();
//             addFieldToSection();
//           }}
//           className="space-y-4"
//         >
//           <Input
//             label="Field Label"
//             value={newField.label}
//             onChange={(e) =>
//               setNewField((f) => ({ ...f, label: e.target.value }))
//             }
//           />
//           <Select
//             label="Field Type"
//             value={{ label: newField.type, value: newField.type }}
//             onChange={(opt) =>
//               setNewField((f) => ({ ...f, type: opt?.value || "text" }))
//             }
//             options={[
//               "text",
//               "number",
//               "email",
//               "date",
//               "select",
//               "checkbox",
//               "file",
//               "textarea",
//               "reference",
//             ].map((t) => ({ label: t, value: t }))}
//           />

//           <div className="flex justify-end">
//             <Button type="submit">Add Field</Button>
//           </div>
//         </form>
//       </Modal>

//       {/* Add Inner Section Modal */}
//       <Modal
//         visible={innerSectionModal.visible}
//         title="Add Inner Section"
//         onClose={() =>
//           setInnerSectionModal({ visible: false, sectionPath: [] })
//         }
//       >
//         <form
//           onSubmit={(e) => {
//             e.preventDefault();
//             addInnerSection();
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
//       </Modal>
//     </>
//   );
// }

// /** -------------------------
//  * UI helpers
//  * ------------------------- */
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

// function TagInput({
//   label,
//   value,
//   onChange,
//   placeholder = "Add option and press Enter",
// }: {
//   label: string;
//   value: string[];
//   onChange: (newTags: string[]) => void;
//   placeholder?: string;
// }) {
//   const [inputValue, setInputValue] = useState("");

//   const handleAdd = () => {
//     const trimmed = inputValue.trim();
//     if (trimmed && !value.includes(trimmed)) {
//       onChange([...value, trimmed]);
//     }
//     setInputValue("");
//   };

//   const handleRemove = (tag: string) => {
//     onChange(value.filter((v) => v !== tag));
//   };

//   return (
//     <div>
//       <label className="block text-sm font-medium text-gray-700 mb-1">
//         {label}
//       </label>
//       <div className="flex flex-wrap gap-2 mb-2">
//         {value.map((tag) => (
//           <span
//             key={tag}
//             className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded"
//           >
//             {tag}
//             <button
//               type="button"
//               onClick={() => handleRemove(tag)}
//               className="text-blue-700 hover:text-blue-900"
//             >
//               ×
//             </button>
//           </span>
//         ))}
//       </div>
//       <input
//         type="text"
//         className="w-full border px-3 py-2 rounded"
//         placeholder={placeholder}
//         value={inputValue}
//         onChange={(e) => setInputValue(e.target.value)}
//         onKeyDown={(e) => {
//           if (e.key === "Enter") {
//             e.preventDefault();
//             handleAdd();
//           }
//         }}
//       />
//     </div>
//   );
// }

// function FieldDisclosure({
//   field,
//   onChange,
//   allFields,
//   parentRequirementMode,
//   confirmDeleteField,
// }: {
//   field: Field;
//   onChange: (key: string, value: any) => void;
//   allFields: Field[];
//   parentRequirementMode?: "AND" | "OR";
//   confirmDeleteField?: (fieldKey: string) => void;
// }) {
//   const showIfEnabled = !!field.showIf;

//   const watchedFieldMetadata = field.showIf?.fieldKey
//     ? allFields.find((f) => f.key === field.showIf?.fieldKey)
//     : undefined;

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
//                     confirmDeleteField?.(field.key);
//                   }}
//                   className="text-red-500 hover:text-red-700"
//                   title="Delete Field"
//                 >
//                   <X size={16} />
//                 </button>
//               )}
//               <ChevronsUpDown
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
//             <Select
//               label="Type"
//               value={{ label: field.type, value: field.type }}
//               onChange={(opt) => onChange("type", opt?.value)}
//               options={[
//                 "text",
//                 "number",
//                 "email",
//                 "date",
//                 "select",
//                 "checkbox",
//                 "file",
//                 "textarea",
//                 "reference",
//               ].map((t) => ({ label: t, value: t }))}
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

//                 <Input
//                   label="Points"
//                   type="number"
//                   value={field.fileMeta?.points ?? 0}
//                   onChange={(e) =>
//                     onChange("fileMeta", {
//                       ...(field.fileMeta || {}),
//                       points: parseInt(e.target.value) || 0,
//                     })
//                   }
//                 />
//                 <div className="flex items-center gap-2">
//                   <label className="text-sm font-medium">
//                     Reference Number
//                   </label>
//                   <input
//                     type="checkbox"
//                     checked={field.fileMeta?.referenceNumber ?? false}
//                     onChange={(e) =>
//                       onChange("fileMeta", {
//                         ...(field.fileMeta || {}),
//                         referenceNumber: e.target.checked,
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
//               </div>
//             )}

//             {field.type === "select" && (
//               <TagInput
//                 label="Options"
//                 value={field.options || []}
//                 onChange={(newTags) => onChange("options", newTags)}
//               />
//             )}

//             {field.type === "reference" && (
//               <Select
//                 label="Reference Model"
//                 value={
//                   field.referenceModel
//                     ? {
//                         label: field.referenceModel,
//                         value: field.referenceModel,
//                       }
//                     : null
//                 }
//                 onChange={(opt) => onChange("referenceModel", opt?.value || "")}
//                 options={[
//                   { label: "Employee", value: "Employee" },
//                   { label: "Department", value: "Department" },
//                   { label: "Branch", value: "Branch" },
//                   { label: "Designation", value: "Designation" },
//                 ]}
//               />
//             )}

//             {!(field.type === "file" && parentRequirementMode) && (
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
//             <div className="pt-4 border-t mt-4 space-y-3">
//               <div className="flex items-center gap-2">
//                 <input
//                   type="checkbox"
//                   checked={showIfEnabled}
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
//               {showIfEnabled && (
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

import { Fragment, useEffect, useState } from "react";
import { Input, Button, Textarea, Select, Tab } from "rizzui";
import { Dialog, Transition, Disclosure } from "@headlessui/react";
import { Plus, X, ChevronsUpDown, Lock, Eye, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import axiosInstance from "@/app/lib/axios";
import { usePermissions } from "@/app/hooks/usePermissions";

/** -------------------------
 * Types
 * ------------------------- */
type EmployeeAccess = "hidden" | "view" | "edit";

interface FileMeta {
  expiryDate?: boolean;
  points?: number;
  referenceNumber?: boolean;
  issuingDate?: boolean;
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
}

interface InnerSection {
  sectionKey: string;
  sectionLabel: string;
  fields: Field[];
  requirementMode?: "AND" | "OR";
  isAdditional?: boolean;
  innerSections?: InnerSection[];
  employeeAccess?: EmployeeAccess; // NEW
}

interface Section {
  sectionKey: string;
  sectionLabel: string;
  fields: Field[];
  innerSections?: InnerSection[];
  isAdditional?: boolean;
  requirementMode?: "AND" | "OR"; // only used if all top-level fields are file
  employeeAccess?: EmployeeAccess; // NEW
}

type DiffChange = { path: string; old: any; new: any };

/** -------------------------
 * Helpers
 * ------------------------- */

// Defensive mapping for access
function coerceEmployeeAccess(
  s: Partial<Section | InnerSection>
): EmployeeAccess {
  if (
    s.employeeAccess === "hidden" ||
    s.employeeAccess === "view" ||
    s.employeeAccess === "edit"
  ) {
    return s.employeeAccess;
  }
  return "edit";
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
      return {
        label: "Employee can edit",
        icon: <Pencil size={12} />,
        className: "bg-emerald-100 text-emerald-800",
        title: "Employees and employer can view & edit.",
      };
  }
}

function deepEqual(a: any, b: any) {
  // Small, predictable deep equal for our payloads
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    // arrays
    if (Array.isArray(a) || Array.isArray(b)) {
      if (!Array.isArray(a) || !Array.isArray(b)) return false;
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    // objects
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!deepEqual(a[k], (b as any)[k])) return false;
    }
    return true;
  }
  return false;
}

// Safe, stable clone used before diff
function stableSanitize<T extends Section | InnerSection>(s: T): T {
  const copy: any = { ...s, employeeAccess: coerceEmployeeAccess(s) };
  delete copy.employeerOnlyEditable;
  delete copy.employerOnlyEditable;
  if (Array.isArray(copy.innerSections)) {
    copy.innerSections = copy.innerSections.map(stableSanitize);
  }
  return copy;
}

function sanitizeSectionsForSave(sections: Section[]) {
  return sections.map(stableSanitize);
}

/** -------------------------
 * Diff builder
 * ------------------------- */

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
  "placeholder",
  "hint",
  "required",
  "type",
  "options",
  "referenceModel",
  "fileMeta",
  "showIf",
];

function byKey<T extends { sectionKey: string }>(arr: T[]) {
  const m = new Map<string, T>();
  for (const x of arr) m.set(x.sectionKey, x);
  return m;
}
function byFieldKey(arr: Field[]) {
  const m = new Map<string, Field>();
  for (const f of arr) m.set(f.key, f);
  return m;
}

function pushChange(out: DiffChange[], path: string, oldVal: any, newVal: any) {
  if (!deepEqual(oldVal, newVal)) {
    out.push({ path, old: oldVal ?? null, new: newVal ?? null });
  }
}

function diffFields(
  acc: DiffChange[],
  basePath: string,
  oldFields: Field[],
  newFields: Field[]
) {
  const oldMap = byFieldKey(oldFields);
  const newMap = byFieldKey(newFields);

  // deletions
  for (const [key, ofield] of oldMap) {
    if (!newMap.has(key)) {
      pushChange(acc, `${basePath}.fields[${key}]`, ofield, null);
    }
  }

  // additions & edits
  for (const [key, nfield] of newMap) {
    const path = `${basePath}.fields[${key}]`;
    const ofield = oldMap.get(key);
    if (!ofield) {
      pushChange(acc, path, null, nfield);
      continue;
    }
    // edits (property-level)
    for (const k of FIELD_KEYS) {
      const p = `${path}.${String(k)}`;
      pushChange(acc, p, (ofield as any)[k], (nfield as any)[k]);
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
    if (!newMap.has(ikey)) {
      pushChange(acc, `${basePath}.inner[${ikey}]`, osec, null);
    }
  }

  // additions & edits
  for (const [ikey, nsec] of newMap) {
    const path = `${basePath}.inner[${ikey}]`;
    const osec = oldMap.get(ikey);
    if (!osec) {
      pushChange(acc, path, null, nsec);
      continue;
    }
    // meta diff
    for (const mk of INNER_SECTION_META_KEYS) {
      pushChange(
        acc,
        `${path}.${String(mk)}`,
        (osec as any)[mk],
        (nsec as any)[mk]
      );
    }
    // field diff
    diffFields(acc, path, osec.fields || [], nsec.fields || []);
    // recurse
    diffInnerSections(
      acc,
      path,
      osec.innerSections || [],
      nsec.innerSections || []
    );
  }
}

function diffSections(oldS: Section[], newS: Section[]): DiffChange[] {
  const acc: DiffChange[] = [];
  const oldMap = byKey(oldS);
  const newMap = byKey(newS);

  // deletions
  for (const [skey, osec] of oldMap) {
    if (!newMap.has(skey)) {
      pushChange(acc, `section[${skey}]`, osec, null);
    }
  }

  // additions & edits
  for (const [skey, nsec] of newMap) {
    const path = `section[${skey}]`;
    const osec = oldMap.get(skey);
    if (!osec) {
      pushChange(acc, path, null, nsec);
      continue;
    }
    // section meta
    for (const mk of SECTION_META_KEYS) {
      pushChange(
        acc,
        `${path}.${String(mk)}`,
        (osec as any)[mk],
        (nsec as any)[mk]
      );
    }
    // fields
    diffFields(acc, path, osec.fields || [], nsec.fields || []);
    // inner sections
    diffInnerSections(
      acc,
      path,
      osec.innerSections || [],
      nsec.innerSections || []
    );
  }

  return acc;
}

/** -------------------------
 * Component
 * ------------------------- */
export default function EmployeeConfigPage() {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("fields", "write");

  const [sections, setSections] = useState<Section[]>([]);
  const [initialSections, setInitialSections] = useState<Section[]>([]); // ← frozen baseline for diff
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [newSectionLabel, setNewSectionLabel] = useState("");
  const [newSectionAccess, setNewSectionAccess] =
    useState<EmployeeAccess>("edit");

  const [fieldModal, setFieldModal] = useState<{
    visible: boolean;
    sectionPath: number[];
  }>({ visible: false, sectionPath: [] });

  const [innerSectionModal, setInnerSectionModal] = useState<{
    visible: boolean;
    sectionPath: number[];
  }>({ visible: false, sectionPath: [] });

  const [newField, setNewField] = useState<{ label: string; type: string }>({
    label: "",
    type: "text",
  });

  const [newInnerSectionLabel, setNewInnerSectionLabel] = useState("");

  const confirmDeleteField = (fieldKeyToDelete: string) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this field?"
    );
    if (!confirmed) return;

    setSections((prev) => {
      const updated = structuredClone(prev);

      const removeFieldByKey = (
        section: Section | InnerSection
      ): Section | InnerSection => {
        section.fields = section.fields.filter(
          (f) => f.key !== fieldKeyToDelete
        );
        if (section.innerSections) {
          section.innerSections = section.innerSections.map(removeFieldByKey);
        }
        return section;
      };

      return updated.map(removeFieldByKey) as Section[];
    });

    toast.success("Field removed successfully.");
  };

  const fetchConfig = async () => {
    try {
      const res = await axiosInstance.get("/employee-field-config");
      const rawSections: any[] = res?.data?.data?.sections || [];

      // Defensive legacy mapping (recursively)
      const mapLegacy = (s: any): Section | InnerSection => {
        const mapped: any = {
          ...s,
          employeeAccess: coerceEmployeeAccess(s),
        };
        if (Array.isArray(mapped.innerSections)) {
          mapped.innerSections = mapped.innerSections.map(mapLegacy);
        }
        return mapped;
      };

      const mapped = rawSections.map(mapLegacy) as Section[];
      setSections(mapped);
      // Keep a frozen copy to diff against when saving
      setInitialSections(structuredClone(mapped));
    } catch (error) {
      console.error("Failed to load config", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleInputChange = (
    path: number[],
    fieldIndex: number,
    key: keyof Field,
    value: any
  ) => {
    setSections((prev) => {
      const updated = structuredClone(prev);
      const targetSection = resolveSectionPath(updated, path);
      (targetSection.fields[fieldIndex] as any)[key] = value;
      return updated;
    });
  };

  const handleSave = async () => {
    try {
      // 1) sanitize new sections
      const payload = sanitizeSectionsForSave(sections);

      // 2) sanitize the original baseline (ensuring same normalization before diff)
      const baseline = sanitizeSectionsForSave(initialSections);

      // 3) build a precise diff
      const diff: DiffChange[] = diffSections(baseline, payload);

      // 4) POST both sections + diff
      await axiosInstance.post("/employee-field-config", {
        sections: payload,
        diff,
      });

      // 5) On success, update the baseline to the latest saved config
      setInitialSections(structuredClone(payload));

      toast.success("Configuration saved successfully.");
    } catch (error: any) {
      console.error("Save failed", error);
      const errorMessage =
        error?.response?.data?.message || "Failed to save configuration";
      toast.error(errorMessage);
    }
  };

  const addSection = () => {
    if (!newSectionLabel.trim()) return;
    setSections((prev) => [
      ...prev,
      {
        sectionKey: `section_${Date.now()}`,
        sectionLabel: newSectionLabel,
        fields: [],
        innerSections: [],
        isAdditional: true,
        employeeAccess: newSectionAccess,
      },
    ]);
    setNewSectionLabel("");
    setNewSectionAccess("edit");
    setShowSectionModal(false);
  };

  const addFieldToSection = () => {
    if (!fieldModal.sectionPath.length || !newField.label.trim()) return;
    setSections((prev) => {
      const copy = structuredClone(prev);
      const target = resolveSectionPath(copy, fieldModal.sectionPath);

      target.fields.push({
        key: newField.label.toLowerCase(),
        label: newField.label,
        placeholder: "",
        required: false,
        type: newField.type,
        isAdditional: true,
        ...(newField.type === "reference" && { referenceModel: "" }),
      });
      return copy;
    });
    setFieldModal({ visible: false, sectionPath: [] });
    setNewField({ label: "", type: "text" });
  };

  const addInnerSection = () => {
    if (!innerSectionModal.sectionPath.length || !newInnerSectionLabel.trim())
      return;
    setSections((prev) => {
      const copy = structuredClone(prev);
      const target = resolveSectionPath(copy, innerSectionModal.sectionPath);

      if (!target.innerSections) target.innerSections = [];
      target.innerSections.push({
        sectionKey: `inner_${Date.now()}`,
        sectionLabel: newInnerSectionLabel,
        fields: [],
        innerSections: [],
        requirementMode: "AND",
        isAdditional: true,
        employeeAccess: "edit", // default
      });
      return copy;
    });
    setInnerSectionModal({ visible: false, sectionPath: [] });
    setNewInnerSectionLabel("");
  };

  function resolveSectionPath(
    sectionsArr: Section[],
    path: number[]
  ): Section | InnerSection {
    let current: Section | InnerSection = sectionsArr[path[0]];
    for (let i = 1; i < path.length; i++) {
      if (!current.innerSections || !current.innerSections[path[i]]) {
        throw new Error(`Invalid section path: ${path.join(",")}`);
      }
      current = current.innerSections[path[i]];
    }
    return current;
  }

  const renderSection = (section: Section | InnerSection, path: number[]) => {
    const allFieldsAreFiles =
      section.fields.length > 0 &&
      section.fields.every((f) => f.type === "file");

    const topLevel = path.length === 1;
    const additional = "isAdditional" in section && !!section.isAdditional;
    const employeeAccess = coerceEmployeeAccess(section);
    const badge = badgeForAccess(employeeAccess);

    return (
      <div
        key={section.sectionKey}
        className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50 mt-4"
      >
        <div className="flex items-center justify-between">
          {/* Left: Title + badges */}
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{section.sectionLabel}</h2>
            {additional && (
              <span
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-800"
                title="This is a custom (additional) section"
              >
                Custom
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
              title={badge.title}
            >
              {badge.icon} {badge.label}
            </span>
          </div>

          {/* Right: actions + tri-state access control */}
          <div className="flex items-center gap-3">
            {"isAdditional" in section && section.isAdditional && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-gray-500">Employee access</span>
                <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs ${
                      employeeAccess === "edit"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700"
                    }`}
                    onClick={() =>
                      setSections((prev) => {
                        const copy = structuredClone(prev);
                        const target = resolveSectionPath(copy, path);
                        (target as Section | InnerSection).employeeAccess =
                          "edit";
                        return copy;
                      })
                    }
                    title="Employees can view & edit"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs border-l ${
                      employeeAccess === "view"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700"
                    }`}
                    onClick={() =>
                      setSections((prev) => {
                        const copy = structuredClone(prev);
                        const target = resolveSectionPath(copy, path);
                        (target as Section | InnerSection).employeeAccess =
                          "view";
                        return copy;
                      })
                    }
                    title="Employees can only view"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 text-xs border-l ${
                      employeeAccess === "hidden"
                        ? "bg-blue-600 text-white"
                        : "bg-white text-gray-700"
                    }`}
                    onClick={() =>
                      setSections((prev) => {
                        const copy = structuredClone(prev);
                        const target = resolveSectionPath(copy, path);
                        (target as Section | InnerSection).employeeAccess =
                          "hidden";
                        return copy;
                      })
                    }
                    title="Hidden from employees"
                  >
                    Hidden
                  </button>
                </div>
              </div>
            )}

            {canWrite && (
              <>
                <Button
                  size="sm"
                  onClick={() =>
                    setFieldModal({ visible: true, sectionPath: path })
                  }
                >
                  + Add Field
                </Button>

                {topLevel && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setInnerSectionModal({ visible: true, sectionPath: path })
                    }
                  >
                    + Add Inner Section
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {employeeAccess === "hidden" && (
          <p
            className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-2 py-1 inline-block"
            title="This section is hidden from employees and cannot be viewed or edited by them."
          >
            This section is <strong>hidden from employees</strong> and only
            editable by employer.
          </p>
        )}

        {employeeAccess === "view" && (
          <p
            className="text-xs text-violet-700 bg-violet-50 border border-violet-100 rounded px-2 py-1 inline-block"
            title="Employees can view but not edit this section."
          >
            Employees can <strong>view</strong> this section, but only employer
            can edit.
          </p>
        )}

        {allFieldsAreFiles && (
          <div className="flex items-center gap-2 mb-2">
            <label className="text-sm font-medium">Requirement Mode</label>
            <select
              value={(section as any).requirementMode || "AND"}
              onChange={(e) => {
                const mode = e.target.value as "AND" | "OR";
                setSections((prev) => {
                  const copy = structuredClone(prev);
                  const target = resolveSectionPath(copy, path);
                  (target as any).requirementMode = mode;
                  return copy;
                });
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="AND">All Required</option>
              <option value="OR">Any Required</option>
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {section.fields.map((field, fieldIndex) => (
            <FieldDisclosure
              key={field.key}
              field={field}
              allFields={section.fields}
              parentRequirementMode={(section as any).requirementMode}
              onChange={(k, v) =>
                handleInputChange(path, fieldIndex, k as any, v)
              }
              confirmDeleteField={canWrite ? confirmDeleteField : undefined}
            />
          ))}
        </div>

        {section.innerSections?.map((inner, idx) =>
          renderSection(inner, [...path, idx])
        )}
      </div>
    );
  };

  if (loading) return <div className="p-6">Loading...</div>;

  // keep original index when filtering to avoid path mismatches
  const visibleTopSections = sections
    .map((s, idx) => ({ section: s, idx }))
    .filter((x) => (x.section.sectionKey || "").toLowerCase() !== "documents");

  return (
    <>
      <div className="space-y-6 max-w-full">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            Employee Field Configuration
          </h1>
          {canWrite && (
            <div className="flex gap-3">
              <Button
                onClick={() => setShowSectionModal(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Section
              </Button>
              <Button onClick={handleSave}>Save Config</Button>
            </div>
          )}
        </div>

        {/* ---------- Tabs wrapper for top-level sections ---------- */}
        {visibleTopSections.length === 0 ? (
          <div className="p-8 text-center text-gray-500 border rounded-xl">
            No sections configured yet.
          </div>
        ) : (
          <Tab>
            <Tab.List className="flex w-full overflow-x-auto gap-2 pb-2 border-b mb-4">
              {visibleTopSections.map(({ section }) => (
                <Tab.ListItem
                  key={section.sectionKey}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 data-[state=active]:bg-blue-600 data-[state=active]:text-white hover:bg-gray-200 transition whitespace-nowrap"
                >
                  {section.sectionLabel}
                </Tab.ListItem>
              ))}
            </Tab.List>

            <Tab.Panels>
              {visibleTopSections.map(({ section, idx }) => (
                <Tab.Panel key={section.sectionKey}>
                  {renderSection(section, [idx])}
                </Tab.Panel>
              ))}
            </Tab.Panels>
          </Tab>
        )}
      </div>

      {/* Add Section Modal */}
      <Modal
        visible={showSectionModal}
        title="Add Section"
        onClose={() => setShowSectionModal(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSection();
          }}
          className="space-y-5"
        >
          <Input
            label="Section Label"
            placeholder="Enter section name"
            value={newSectionLabel}
            onChange={(e) => setNewSectionLabel(e.target.value)}
          />

          <div className="text-xs text-gray-600 bg-gray-50 border rounded px-3 py-2">
            New sections are created as <strong>Custom (Additional)</strong>.
          </div>

          {/* Employee access (tri-state) */}
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
                title="Employees can view & edit"
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
                title="Employees can only view"
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
                title="Hidden from employees"
              >
                Hidden
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Choose whether employees can edit, only view, or not see this
              section at all.
            </p>
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
        onClose={() => setFieldModal({ visible: false, sectionPath: [] })}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addFieldToSection();
          }}
          className="space-y-4"
        >
          <Input
            label="Field Label"
            value={newField.label}
            onChange={(e) =>
              setNewField((f) => ({ ...f, label: e.target.value }))
            }
          />
          <Select
            label="Field Type"
            value={{ label: newField.type, value: newField.type }}
            onChange={(opt) =>
              setNewField((f) => ({ ...f, type: opt?.value || "text" }))
            }
            options={[
              "text",
              "number",
              "email",
              "date",
              "select",
              "checkbox",
              "file",
              "textarea",
              "reference",
            ].map((t) => ({ label: t, value: t }))}
          />

          <div className="flex justify-end">
            <Button type="submit">Add Field</Button>
          </div>
        </form>
      </Modal>

      {/* Add Inner Section Modal */}
      <Modal
        visible={innerSectionModal.visible}
        title="Add Inner Section"
        onClose={() =>
          setInnerSectionModal({ visible: false, sectionPath: [] })
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addInnerSection();
          }}
          className="space-y-4"
        >
          <Input
            label="Inner Section Label"
            value={newInnerSectionLabel}
            onChange={(e) => setNewInnerSectionLabel(e.target.value)}
          />
          <div className="flex justify-end">
            <Button type="submit">Add Inner Section</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/** -------------------------
 * UI helpers
 * ------------------------- */
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

function TagInput({
  label,
  value,
  onChange,
  placeholder = "Add option and press Enter",
}: {
  label: string;
  value: string[];
  onChange: (newTags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInputValue("");
  };

  const handleRemove = (tag: string) => {
    onChange(value.filter((v) => v !== tag));
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="text-blue-700 hover:text-blue-900"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        className="w-full border px-3 py-2 rounded"
        placeholder={placeholder}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
    </div>
  );
}

function FieldDisclosure({
  field,
  onChange,
  allFields,
  parentRequirementMode,
  confirmDeleteField,
}: {
  field: Field;
  onChange: (key: string, value: any) => void;
  allFields: Field[];
  parentRequirementMode?: "AND" | "OR";
  confirmDeleteField?: (fieldKey: string) => void;
}) {
  const showIfEnabled = !!field.showIf;

  const watchedFieldMetadata = field.showIf?.fieldKey
    ? allFields.find((f) => f.key === field.showIf?.fieldKey)
    : undefined;

  return (
    <Disclosure as="div">
      {({ open }) => (
        <div className="border rounded bg-white">
          <Disclosure.Button className="w-full flex justify-between items-center p-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50">
            <span>{field.label || "(Untitled Field)"}</span>
            <div className="flex items-center gap-2">
              {field.isAdditional && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDeleteField?.(field.key);
                  }}
                  className="text-red-500 hover:text-red-700"
                  title="Delete Field"
                >
                  <X size={16} />
                </button>
              )}
              <ChevronsUpDown
                className={`h-5 w-5 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            </div>
          </Disclosure.Button>
          <Disclosure.Panel className="p-4 space-y-4 border-t">
            <Input
              label="Label"
              value={field.label}
              onChange={(e) => onChange("label", e.target.value)}
            />
            <Input
              label="Placeholder"
              value={field.placeholder}
              onChange={(e) => onChange("placeholder", e.target.value)}
            />
            <Input
              label="Hint"
              value={field.hint || ""}
              onChange={(e) => onChange("hint", e.target.value)}
            />
            <Select
              label="Type"
              value={{ label: field.type, value: field.type }}
              onChange={(opt) => onChange("type", opt?.value)}
              options={[
                "text",
                "number",
                "email",
                "date",
                "select",
                "checkbox",
                "file",
                "textarea",
                "reference",
              ].map((t) => ({ label: t, value: t }))}
            />

            {field.type === "file" && (
              <div className="space-y-4 border-t pt-4 mt-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Expiry Date</label>
                  <input
                    type="checkbox"
                    checked={field.fileMeta?.expiryDate ?? false}
                    onChange={(e) =>
                      onChange("fileMeta", {
                        ...(field.fileMeta || {}),
                        expiryDate: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </div>

                <Input
                  label="Points"
                  type="number"
                  value={field.fileMeta?.points ?? 0}
                  onChange={(e) =>
                    onChange("fileMeta", {
                      ...(field.fileMeta || {}),
                      points: parseInt(e.target.value) || 0,
                    })
                  }
                />
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">
                    Reference Number
                  </label>
                  <input
                    type="checkbox"
                    checked={field.fileMeta?.referenceNumber ?? false}
                    onChange={(e) =>
                      onChange("fileMeta", {
                        ...(field.fileMeta || {}),
                        referenceNumber: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Issue Date</label>
                  <input
                    type="checkbox"
                    checked={field.fileMeta?.issuingDate ?? false}
                    onChange={(e) =>
                      onChange("fileMeta", {
                        ...(field.fileMeta || {}),
                        issuingDate: e.target.checked,
                      })
                    }
                    className="h-4 w-4"
                  />
                </div>
              </div>
            )}

            {field.type === "select" && (
              <TagInput
                label="Options"
                value={field.options || []}
                onChange={(newTags) => onChange("options", newTags)}
              />
            )}

            {field.type === "reference" && (
              <Select
                label="Reference Model"
                value={
                  field.referenceModel
                    ? {
                        label: field.referenceModel,
                        value: field.referenceModel,
                      }
                    : null
                }
                onChange={(opt) => onChange("referenceModel", opt?.value || "")}
                options={[
                  { label: "Employee", value: "Employee" },
                  { label: "Department", value: "Department" },
                  { label: "Organization", value: "Branch" },
                  { label: "Job Title", value: "Designation" },
                  { label: "Award", value: "Award" },
                  { label: "Award Employee Type", value: "AwardEmployeeType" },
                ]}
              />
            )}

            {!(field.type === "file" && parentRequirementMode) && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Required</label>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => onChange("required", e.target.checked)}
                  className="h-4 w-4"
                />
              </div>
            )}
            <div className="pt-4 border-t mt-4 space-y-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!field.showIf}
                  onChange={(e) =>
                    onChange(
                      "showIf",
                      e.target.checked
                        ? { fieldKey: "", operator: "equals", value: "" }
                        : undefined
                    )
                  }
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium">
                  Show this field only when...
                </span>
              </div>
              {!!field.showIf && (
                <div className="space-y-2 bg-gray-50 p-3 rounded-md border">
                  <Select
                    label="Field to Watch"
                    placeholder="Select field"
                    value={
                      field.showIf?.fieldKey
                        ? {
                            label:
                              allFields.find(
                                (f) => f.key === field.showIf?.fieldKey
                              )?.label || field.showIf?.fieldKey,
                            value: field.showIf?.fieldKey,
                          }
                        : undefined
                    }
                    onChange={(opt) =>
                      onChange("showIf", {
                        ...(field.showIf || { operator: "equals", value: "" }),
                        fieldKey: opt?.value,
                      })
                    }
                    options={allFields.map((f) => ({
                      label: f.label || f.key,
                      value: f.key,
                    }))}
                  />
                  <Select
                    label="Operator"
                    value={
                      field.showIf?.operator
                        ? {
                            label:
                              field.showIf.operator === "equals"
                                ? "Equals"
                                : "Not Equals",
                            value: field.showIf.operator,
                          }
                        : undefined
                    }
                    onChange={(opt) =>
                      onChange("showIf", {
                        ...(field.showIf || { fieldKey: "", value: "" }),
                        operator: opt?.value,
                      })
                    }
                    options={[
                      { label: "Equals", value: "equals" },
                      { label: "Not Equals", value: "notEquals" },
                    ]}
                  />

                  {watchedFieldMetadata?.type === "select" &&
                  watchedFieldMetadata.options?.length ? (
                    <Select
                      label="Value to Match"
                      placeholder="Select option"
                      value={
                        field.showIf?.value
                          ? {
                              label: field.showIf.value,
                              value: field.showIf.value,
                            }
                          : undefined
                      }
                      onChange={(opt) =>
                        onChange("showIf", {
                          ...(field.showIf || {
                            fieldKey: "",
                            operator: "equals",
                          }),
                          value: opt?.value,
                        })
                      }
                      options={watchedFieldMetadata.options.map((o) => ({
                        label: o,
                        value: o,
                      }))}
                    />
                  ) : (
                    <Input
                      label="Value to Match"
                      placeholder="Enter value"
                      value={field.showIf?.value ?? ""}
                      onChange={(e) =>
                        onChange("showIf", {
                          ...(field.showIf || {
                            fieldKey: "",
                            operator: "equals",
                          }),
                          value: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              )}
            </div>
          </Disclosure.Panel>
        </div>
      )}
    </Disclosure>
  );
}
