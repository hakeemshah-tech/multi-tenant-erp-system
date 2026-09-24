// "use client";

// import { useCallback, useEffect, useState } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { Input, Select, Button, Textarea, Checkbox, Tab } from "rizzui";
// import { useFormik } from "formik";
// import axiosInstance from "@/app/lib/axios";
// import ReactDatePicker from "@/app/components/ui/DatePicker";
// import { Card } from "@/app/components/ui/Card";
// import set from "lodash/set";
// import get from "lodash/get";
// import toast from "react-hot-toast";
// import { useDropzone } from "react-dropzone";

// const DRAFT_STORAGE_KEY = "employeeProfileDraft";

// // Utility: Load draft from localStorage
// const loadDraft = () => {
//   try {
//     const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
//     if (!raw) return null;
//     return JSON.parse(raw);
//   } catch (e) {
//     console.error("Failed to load draft from localStorage", e);
//     return null;
//   }
// };

// // Utility: Save draft to localStorage
// const saveDraft = (values) => {
//   try {
//     localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
//   } catch (e) {
//     console.error("Failed to save draft to localStorage", e);
//   }
// };

// // Utility: Clear draft after submit
// const clearDraft = () => {
//   try {
//     localStorage.removeItem(DRAFT_STORAGE_KEY);
//   } catch (e) {
//     console.error("Failed to clear draft from localStorage", e);
//   }
// };

// export default function EmployeeProfileForm() {
//   const params = useParams();
//   const employeeId = params?.id as string;
//   const router = useRouter();

//   const [sections, setSections] = useState<any[]>([]);
//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});
//   const [profileId, setProfileId] = useState<string | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [saveStatus, setSaveStatus] = useState<
//     "idle" | "saving" | "success" | "error"
//   >("idle");

//   const [referenceOptions, setReferenceOptions] = useState<
//     Record<string, { label: string; value: string }[]>
//   >({});

//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({});

//   // Replace autoSave function to save to localStorage instead
//   const autoSave = async (values: any) => {
//     saveDraft(values);
//     setSaveStatus("idle");
//   };

//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     validate: (values) => {
//       const errors: any = {};

//       for (const section of sections) {
//         // Top-level fields
//         if (section.fields?.length) {
//           for (const field of section.fields) {
//             const path = `${section.sectionKey}.${field.key}`;
//             const val = get(values, path);
//             if (field.required) {
//               if (field.type === "checkbox") {
//                 if (!val) set(errors, path, "This field is required.");
//               } else if (field.type === "file") {
//                 if (!val?.url) set(errors, path, "Please upload a file.");
//               } else if (field.type === "date") {
//                 if (!val) set(errors, path, "Please select a date.");
//               } else if (field.type === "select") {
//                 if (!val) set(errors, path, "Please select an option.");
//               } else if (!val || val === "") {
//                 set(errors, path, "This field is required.");
//               }
//             }
//           }
//         }

//         if (section.innerSections?.length) {
//           for (const inner of section.innerSections) {
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const groupValues = get(values, groupPath);

//             if (inner.requirementMode === "OR") {
//               const anyFilled = inner.fields.some((f) => {
//                 const v = get(values, `${groupPath}.${f.key}`);
//                 return v?.url;
//               });

//               if (!anyFilled) {
//                 inner.fields.forEach((f) => {
//                   set(
//                     errors,
//                     `${groupPath}.${f.key}`,
//                     "At least one document is required."
//                   );
//                 });
//               }
//             }

//             if (inner.requirementMode === "AND") {
//               let hasError = false;

//               for (const field of inner.fields) {
//                 const path = `${groupPath}.${field.key}`;
//                 const val = get(values, path);

//                 let isEmpty = false;
//                 if (field.type === "checkbox") {
//                   isEmpty = !val;
//                 } else if (field.type === "file") {
//                   isEmpty = !val?.url;
//                 } else if (field.type === "date") {
//                   isEmpty = !val;
//                 } else if (field.type === "select") {
//                   isEmpty = !val;
//                 } else {
//                   isEmpty = val === "" || val === null || val === undefined;
//                 }

//                 if (isEmpty) {
//                   set(errors, path, "This field is required.");
//                   hasError = true;
//                 }
//               }

//               if (hasError) {
//                 // Optional: add a section-level error
//                 set(
//                   errors,
//                   groupPath,
//                   "All fields in this section are required."
//                 );
//               }
//             }
//           }
//         }
//       }

//       return errors;
//     },
//     onSubmit: async (values) => {
//       try {
//         setSaveStatus("saving");
//         const cleanedValues = deepCleanFileFields(values);
//         const { profileUpdates, additionalFields } =
//           splitProfileAndAdditionalFields(cleanedValues, sections);

//         if (Object.keys(profileUpdates).length > 0) {
//           await axiosInstance.post(`/employee-profiles/self`, profileUpdates);
//         }

//         setSaveStatus("success");
//         toast.success("Profile submitted successfully!");
//         clearDraft();
//         router.replace("/nexus-profile");
//       } catch (error) {
//         setSaveStatus("error");
//         toast.error("Failed to submit profile");
//         console.error("Submit error:", error);
//       }
//     },
//   });

//   // Optional: indicate draft is saved
//   // useEffect(() => {
//   //   const timeout = setTimeout(() => {
//   //     setSaveStatus("idle");
//   //   }, 3000);
//   //   return () => clearTimeout(timeout);
//   // }, [formik.values]);

//   const [draggingField, setDraggingField] = useState<string | null>(null);

//   const fetchReferenceData = async (model: string) => {
//     try {
//       const res = await axiosInstance.get(`/${model.toLowerCase()}s`);
//       const data = res.data?.data || [];

//       const options = data.map((item: any) => ({
//         label:
//           model === "Employee"
//             ? item?.employeeProfile?.personaldetails?.firstname || "Unnamed"
//             : item?.name || "Unnamed",
//         value: item._id,
//       }));

//       setReferenceOptions((prev) => ({
//         ...prev,
//         [model]: options,
//       }));
//     } catch (err) {
//       console.error(`Failed to fetch ${model} data`, err);
//     }
//   };

//   useEffect(() => {
//     const loadReferenceOptions = async () => {
//       const allModels = new Set<string>();

//       for (const section of sections) {
//         for (const field of section.fields || []) {
//           if (field.type === "reference") allModels.add(field.referenceModel);
//         }
//         for (const inner of section.innerSections || []) {
//           for (const field of inner.fields || []) {
//             if (field.type === "reference") allModels.add(field.referenceModel);
//           }
//         }
//       }

//       await Promise.all(Array.from(allModels).map(fetchReferenceData));
//     };

//     if (sections.length) loadReferenceOptions();
//   }, [sections]);

//   function splitProfileAndAdditionalFields(
//     values: any,
//     sections: any[]
//   ): {
//     profileUpdates: any;
//     additionalFields: any[];
//   } {
//     const profileUpdates: any = {};
//     const additionalFields: any[] = [];

//     for (const section of sections) {
//       const sectionGroup = values[section.sectionKey];
//       if (!sectionGroup) continue;

//       // Special handling for address
//       if (section.sectionKey === "address") {
//         profileUpdates["address"] = values["address"];
//         continue;
//       }

//       // Top-level fields
//       for (const field of section.fields || []) {
//         const val = sectionGroup[field.key];

//         if (field.isAdditional) {
//           additionalFields.push({
//             sectionKey: section.sectionKey,
//             innerSectionKey: null,
//             fieldKey: field.key,
//             value: val,
//           });
//         } else {
//           if (!profileUpdates[section.sectionKey])
//             profileUpdates[section.sectionKey] = {};
//           profileUpdates[section.sectionKey][field.key] = val;
//         }
//       }

//       // Inner sections
//       for (const inner of section.innerSections || []) {
//         const innerGroup = sectionGroup?.[inner.sectionKey];
//         if (!innerGroup) continue;

//         for (const field of inner.fields || []) {
//           const val = innerGroup[field.key];

//           if (field.isAdditional) {
//             additionalFields.push({
//               sectionKey: section.sectionKey,
//               innerSectionKey: inner.sectionKey,
//               fieldKey: field.key,
//               value: val,
//             });
//           } else {
//             if (!profileUpdates[section.sectionKey])
//               profileUpdates[section.sectionKey] = {};
//             if (!profileUpdates[section.sectionKey][inner.sectionKey]) {
//               profileUpdates[section.sectionKey][inner.sectionKey] = {};
//             }
//             profileUpdates[section.sectionKey][inner.sectionKey][field.key] =
//               val;
//           }
//         }
//       }
//     }

//     return { profileUpdates, additionalFields };
//   }

//   useEffect(() => {
//     // if (!employeeId) return;

//     const fetchData = async () => {
//       try {
//         const configRes = await axiosInstance.get(
//           "/employee-field-config/profile-config"
//         );

//         const profile = {};
//         const configSections = configRes.data.data;

//         const values: Record<string, any> = {};
//         console.log(configSections, "helllooooo");

//         for (const section of configSections) {
//           const group = section.sectionKey;

//           // Address special case
//           if (group === "address") {
//             values[group] =
//               profile[group] && Array.isArray(profile[group])
//                 ? profile[group]
//                 : [{}];
//             continue;
//           }

//           console.log(section, "section");

//           // Top-level fields
//           for (const field of section.fields) {
//             let val;
//             if (field.isAdditional) {
//               // Find value from additionalFields
//               const match = empRes.data.additionalFields.find(
//                 (f: any) =>
//                   f.sectionKey === section.sectionKey &&
//                   f.innerSectionKey === null &&
//                   f.fieldKey === field.key
//               );
//               val = match?.value;
//             } else {
//               val = get(profile, `${group}.${field.key}`);
//             }

//             set(
//               values,
//               `${group}.${field.key}`,
//               val ??
//                 (field.type === "checkbox"
//                   ? false
//                   : field.type === "file"
//                   ? {}
//                   : "")
//             );
//           }

//           // Inner sections
//           for (const inner of section.innerSections || []) {
//             for (const field of inner.fields) {
//               let val;
//               if (field.isAdditional) {
//                 const match = empRes.data.additionalFields.find(
//                   (f: any) =>
//                     f.sectionKey === section.sectionKey &&
//                     f.innerSectionKey === inner.sectionKey &&
//                     f.fieldKey === field.key
//                 );
//                 val = match?.value;
//               } else {
//                 val = get(profile, `${group}.${inner.sectionKey}.${field.key}`);
//               }

//               set(
//                 values,
//                 `${group}.${inner.sectionKey}.${field.key}`,
//                 val ??
//                   (field.type === "checkbox"
//                     ? false
//                     : field.type === "file"
//                     ? {}
//                     : "")
//               );
//             }
//           }
//         }

//         setProfileId(profile._id);
//         setSections(configSections);

//         const draft = loadDraft();
//         if (draft) {
//           console.log("Applying draft from localStorage");
//           Object.assign(values, draft); // override default values with draft
//         }

//         setInitialValues(values);

//         setLoading(false);

//         // Build initial selectedDocuments
//         const initialSelectedDocs: Record<string, string> = {};

//         for (const section of configSections) {
//           for (const inner of section.innerSections || []) {
//             if (inner.requirementMode === "OR") {
//               const groupPath = `${section.sectionKey}.${inner.sectionKey}`;

//               const selected = inner.fields.find((field: any) => {
//                 let val;
//                 if (field.isAdditional) {
//                   const match = empRes.data.additionalFields.find(
//                     (f: any) =>
//                       f.sectionKey === section.sectionKey &&
//                       f.innerSectionKey === inner.sectionKey &&
//                       f.fieldKey === field.key
//                   );
//                   val = match?.value;
//                 } else {
//                   val = get(
//                     profile,
//                     `${section.sectionKey}.${inner.sectionKey}.${field.key}`
//                   );
//                 }

//                 return (
//                   val &&
//                   (typeof val === "string" ||
//                     (typeof val === "object" && Object.keys(val).length > 0))
//                 );
//               });

//               if (selected) {
//                 initialSelectedDocs[groupPath] = selected.key;
//               }
//             }
//           }
//         }

//         setSelectedDocuments(initialSelectedDocs);
//       } catch (err) {
//         console.error("Failed to load profile", err);
//         setLoading(false);
//       }
//     };

//     fetchData();
//   }, [employeeId]);

//   function deepCleanFileFields(obj: any): any {
//     if (Array.isArray(obj)) {
//       return obj
//         .map(deepCleanFileFields)
//         .filter((val) => val !== undefined && val !== null);
//     }

//     if (typeof obj === "object" && obj !== null) {
//       const cleaned: any = {};
//       for (const key in obj) {
//         const val = obj[key];

//         if (
//           val === "" || // Remove empty strings
//           (typeof val === "object" && // Remove empty objects
//             val !== null &&
//             Object.keys(val).length === 0)
//         ) {
//           continue;
//         }

//         if (val instanceof Date) {
//           cleaned[key] = val;
//         } else if (typeof val === "object") {
//           const nested = deepCleanFileFields(val);
//           if (
//             nested !== null &&
//             nested !== undefined &&
//             (typeof nested !== "object" || Object.keys(nested).length > 0)
//           ) {
//             cleaned[key] = nested;
//           }
//         } else {
//           cleaned[key] = val;
//         }
//       }
//       return cleaned;
//     }

//     return obj;
//   }

//   const evaluateShowIf = (field: any) => {
//     if (!field.showIf) return true;
//     const findFieldValue = (obj: any, key: string): any => {
//       if (typeof obj !== "object" || obj === null) return undefined;
//       if (key in obj) return obj[key];
//       for (const k of Object.keys(obj)) {
//         const result = findFieldValue(obj[k], key);
//         if (result !== undefined) return result;
//       }
//       return undefined;
//     };
//     const actualValue = findFieldValue(formik.values, field.showIf.fieldKey);
//     return field.showIf.operator === "equals"
//       ? actualValue === field.showIf.value
//       : actualValue !== field.showIf.value;
//   };

//   const renderAddressSection = (fields: any[]) => {
//     const addresses = formik.values.address || [];

//     const handleAdd = () => {
//       const newList = [...addresses, {}];
//       formik.setFieldValue("address", newList);
//       autoSave({ ...formik.values, address: newList });
//     };

//     const handleRemove = (i: number) => {
//       const newList = addresses.filter((_, idx) => idx !== i);
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
//               {/* Top bar with editable addressFor */}
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

//               {/* Address fields */}
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

//   function FileUploadField({
//     field,
//     fullPath,
//     value,
//     formik,
//     autoSave,
//     renderHint,
//     renderError,
//   }: {
//     field: any;
//     fullPath: string;
//     value: any;
//     formik: any;
//     autoSave: (values: any) => void;
//     renderHint: () => JSX.Element;
//     renderError: () => JSX.Element;
//   }) {
//     const fileMetaElements = [];
//     const fileMeta = field.fileMeta || {};

//     const fileUrl = value?.url || "";
//     const isImage = (url: string) =>
//       /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
//     const isUploadedImage = isImage(fileUrl);

//     const onDrop = useCallback(
//       async (acceptedFiles: File[]) => {
//         const file = acceptedFiles[0];
//         if (!file) return;

//         try {
//           const formData = new FormData();
//           formData.append("file", file);

//           const { data } = await axiosInstance.post("/uploads", formData, {
//             headers: { "Content-Type": "multipart/form-data" },
//           });

//           const fileUrl = data?.url || data?.data?.url;
//           if (!fileUrl) throw new Error("No file URL returned.");

//           const updated = { ...formik.values };
//           set(updated, `${fullPath}.url`, fileUrl);
//           formik.setFieldValue(`${fullPath}.url`, fileUrl);
//           autoSave(updated);
//           toast.success("File Uploaded");
//         } catch (err) {
//           console.error("Upload error:", err);
//           toast.error("Upload failed");
//         }
//       },
//       [fullPath, formik, autoSave]
//     );

//     const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
//       onDrop,
//       multiple: false,
//       noClick: true, // prevent automatic open on dropzone click
//       accept: {
//         "application/pdf": [],
//         "image/*": [],
//       },
//     });

//     // Handle file metadata fields
//     if (fileMeta.expiryDate) {
//       fileMetaElements.push(
//         <div key={`${fullPath}.expiryDate`} className="space-y-1">
//           <label className="text-sm font-medium text-gray-700">
//             Expiry Date
//           </label>
//           <ReactDatePicker
//             selected={value?.expiryDate ? new Date(value.expiryDate) : null}
//             onChange={(val) => {
//               formik.setFieldValue(
//                 `${fullPath}.expiryDate`,
//                 val?.toISOString() || null
//               );
//               autoSave(formik.values);
//             }}
//           />
//         </div>
//       );
//     }

//     if (fileMeta.issuingDate) {
//       fileMetaElements.push(
//         <div key={`${fullPath}.issuingDate`} className="space-y-1">
//           <label className="text-sm font-medium text-gray-700">
//             Issuing Date
//           </label>
//           <ReactDatePicker
//             selected={value?.issuingDate ? new Date(value.issuingDate) : null}
//             onChange={(val) => {
//               formik.setFieldValue(
//                 `${fullPath}.issuingDate`,
//                 val?.toISOString() || null
//               );
//               autoSave(formik.values);
//             }}
//           />
//         </div>
//       );
//     }

//     if (fileMeta.referenceNumber) {
//       fileMetaElements.push(
//         <div key={`${fullPath}.referenceNumber`} className="space-y-1">
//           <Input
//             label="Reference Number"
//             value={value?.referenceNumber || ""}
//             onChange={(e) => {
//               formik.setFieldValue(
//                 `${fullPath}.referenceNumber`,
//                 e.target.value
//               );
//               autoSave(formik.values);
//             }}
//           />
//         </div>
//       );
//     }

//     return (
//       <div
//         key={fullPath}
//         className="space-y-4 border border-gray-200 rounded-xl p-4 bg-white shadow-sm"
//       >
//         <div className="flex justify-between items-center">
//           <label className="block text-sm font-medium text-gray-800">
//             {field.label}
//             {field.required && <span className="text-red-500 ml-1">*</span>}
//           </label>
//         </div>

//         {/* IMAGE PREVIEW + DROP OVERLAY */}
//         {isUploadedImage && (
//           <div
//             {...getRootProps()}
//             onClick={open}
//             className="relative cursor-pointer group"
//           >
//             <img
//               src={fileUrl}
//               alt="Uploaded Preview"
//               className="max-w-xs max-h-48 rounded border shadow group-hover:opacity-80 transition"
//             />
//             <div className="text-sm text-gray-500 mt-2">
//               Click or drag another image to replace
//             </div>
//             <input {...getInputProps()} />
//           </div>
//         )}

//         {/* NON-IMAGE FILE INFO + DROPZONE */}
//         {!isUploadedImage && (
//           <>
//             {fileUrl && (
//               <div className="flex flex-col items-start gap-1 text-sm">
//                 <a
//                   href={fileUrl}
//                   target="_blank"
//                   rel="noopener noreferrer"
//                   className="text-blue-600 underline hover:text-blue-800"
//                 >
//                   View File (
//                   {decodeURIComponent(fileUrl.split("/").pop() || "file")})
//                 </a>
//               </div>
//             )}

//             <div
//               {...getRootProps()}
//               onClick={open} // ✅ This makes "click to browse" work
//               className={`flex flex-col items-center justify-center text-center border-2 border-dashed rounded-md px-4 py-6 transition cursor-pointer
//           ${
//             isDragActive
//               ? "border-blue-500 bg-blue-50"
//               : "border-gray-300 bg-gray-50 hover:border-gray-400"
//           }`}
//             >
//               <input {...getInputProps()} />
//               <div className="text-sm text-gray-600">
//                 {fileUrl ? (
//                   <>
//                     <p className="text-green-700 font-medium mb-1">
//                       File uploaded ✔
//                     </p>
//                     <p>Click or drag a new file to replace</p>
//                   </>
//                 ) : (
//                   <>
//                     <p className="mb-1">No file uploaded</p>
//                     <span>
//                       Drag & drop a file here or{" "}
//                       <span className="text-blue-600 underline cursor-pointer">
//                         browse
//                       </span>
//                     </span>
//                   </>
//                 )}
//               </div>
//             </div>
//           </>
//         )}

//         {/* Extra Metadata */}
//         {fileMetaElements.length > 0 && (
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//             {fileMetaElements}
//           </div>
//         )}
//         {renderHint()}
//         {renderError()}
//       </div>
//     );
//   }

//   const renderField = (field: any, pathPrefix: string) => {
//     if (!evaluateShowIf(field)) return null;

//     const fullPath = `${pathPrefix}.${field.key}`;
//     const value = get(formik.values, fullPath);
//     const error = get(formik.errors, fullPath);
//     const touched = get(formik.touched, fullPath);
//     const showError = Boolean(touched && error);

//     const renderHint = () =>
//       field.hint && <p className="text-xs text-gray-400 mt-1">{field.hint}</p>;

//     const renderError = () =>
//       showError && <p className="text-xs text-red-500 mt-1">{error}</p>;

//     switch (field.type) {
//       case "text":
//       case "email":
//         return (
//           <div key={fullPath}>
//             <Input
//               type={field.type}
//               label={
//                 <>
//                   {field.label}
//                   {field.required && (
//                     <span className="text-red-500 ml-1">*</span>
//                   )}
//                 </>
//               }
//               placeholder={field.placeholder}
//               required={field.required}
//               value={value}
//               onBlur={(e) => {
//                 formik.handleBlur(e);
//                 autoSave(formik.values);
//               }}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//             />
//             {renderHint()}
//             {renderError()}
//           </div>
//         );

//       case "textarea":
//         return (
//           <div key={fullPath}>
//             <Textarea
//               label={
//                 <>
//                   {field.label}
//                   {field.required && (
//                     <span className="text-red-500 ml-1">*</span>
//                   )}
//                 </>
//               }
//               placeholder={field.placeholder}
//               required={field.required}
//               value={value}
//               onBlur={(e) => {
//                 formik.handleBlur(e);
//                 autoSave(formik.values);
//               }}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//             />
//             {renderHint()}
//             {renderError()}
//           </div>
//         );

//       case "checkbox":
//         return (
//           <div key={fullPath}>
//             <Checkbox
//               label={
//                 <>
//                   {field.label}
//                   {field.required && (
//                     <span className="text-red-500 ml-1">*</span>
//                   )}
//                 </>
//               }
//               checked={value}
//               onBlur={(e) => {
//                 formik.handleBlur(e);
//                 autoSave(formik.values);
//               }}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.checked)}
//             />
//             {renderHint()}
//             {renderError()}
//           </div>
//         );

//       case "date":
//         const isDOB = field.key === "dob";
//         let ageText = "";

//         if (isDOB && value) {
//           const dob = new Date(value);
//           const now = new Date();
//           let age = now.getFullYear() - dob.getFullYear();
//           const m = now.getMonth() - dob.getMonth();
//           if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
//             age--;
//           }
//           ageText = ` (${age} years old)`;
//         }

//         const currentYear = new Date().getFullYear();
//         const maxDOBDate = new Date();
//         maxDOBDate.setFullYear(currentYear - 18);

//         return (
//           <div key={fullPath} className="space-y-1">
//             <label className="text-sm font-medium text-gray-700">
//               {field.label}
//               {ageText}
//               {field.required && <span className="text-red-500 ml-1">*</span>}
//             </label>
//             <ReactDatePicker
//               selected={value ? new Date(value) : null}
//               showMonthDropdown
//               showYearDropdown
//               scrollableYearDropdown
//               yearDropdownItemNumber={100}
//               dateFormat="dd/MM/yy"
//               maxDate={isDOB ? maxDOBDate : undefined}
//               onChange={(val) => {
//                 if (val) {
//                   const iso = val.toISOString();

//                   // Update Formik
//                   formik.setFieldValue(fullPath, iso);

//                   // Update age if DOB
//                   if (isDOB) {
//                     const now = new Date();
//                     const dob = new Date(val);
//                     let age = now.getFullYear() - dob.getFullYear();
//                     const m = now.getMonth() - dob.getMonth();
//                     if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
//                       age--;
//                     }
//                     formik.setFieldValue("personaldetails.age", age);
//                   }

//                   // Save updated value
//                   const updated = { ...formik.values };
//                   set(updated, fullPath, iso);
//                   autoSave(updated);
//                 }
//               }}
//               inputProps={{ placeholder: field.placeholder }}
//               onBlur={() => {
//                 formik.setFieldTouched(fullPath, true);
//               }}
//             />
//             {renderHint()}
//             {renderError()}
//           </div>
//         );

//       case "number":
//         return (
//           <div key={fullPath}>
//             <Input
//               type="number"
//               label={
//                 <>
//                   {field.label}
//                   {field.required && (
//                     <span className="text-red-500 ml-1">*</span>
//                   )}
//                 </>
//               }
//               placeholder={field.placeholder}
//               required={field.required}
//               value={value}
//               onBlur={(e) => {
//                 formik.handleBlur(e);
//                 autoSave(formik.values);
//               }}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//               disabled={fullPath === "personaldetails.age"}
//             />
//             {renderHint()}
//             {renderError()}
//           </div>
//         );

//       case "select":
//         return (
//           <div key={fullPath}>
//             <Select
//               label={
//                 <>
//                   {field.label}
//                   {field.required && (
//                     <span className="text-red-500 ml-1">*</span>
//                   )}
//                 </>
//               }
//               placeholder={field.placeholder}
//               required={field.required}
//               value={field.options
//                 .map((o: string) => ({ label: o, value: o }))
//                 .find((opt) => opt.value === value)}
//               onChange={(opt: any) =>
//                 formik.setFieldValue(fullPath, opt?.value || "")
//               }
//               options={field.options.map((o: string) => ({
//                 label: o,
//                 value: o,
//               }))}
//               onBlur={() => {
//                 formik.setFieldTouched(fullPath, true);
//                 autoSave(formik.values);
//               }}
//             />
//             {renderHint()}
//             {renderError()}
//           </div>
//         );

//       case "reference": {
//         const modelOptions = referenceOptions[field.referenceModel] || [];

//         return (
//           <div key={fullPath}>
//             <Select
//               label={
//                 <>
//                   {field.label}
//                   {field.required && (
//                     <span className="text-red-500 ml-1">*</span>
//                   )}
//                 </>
//               }
//               placeholder={field.placeholder}
//               value={
//                 modelOptions.find(
//                   (opt) =>
//                     String(opt.value) ===
//                     String(typeof value === "object" ? value._id : value)
//                 ) || null
//               }
//               onChange={(opt: any) => {
//                 const selectedId = opt?.value || "";
//                 formik.setFieldValue(fullPath, selectedId);

//                 const updated = { ...formik.values };
//                 set(updated, fullPath, selectedId);

//                 autoSave(updated);
//               }}
//               options={modelOptions}
//               onBlur={() => {
//                 formik.setFieldTouched(fullPath, true);
//               }}
//             />
//             {renderHint()}
//             {renderError()}
//           </div>
//         );
//       }

//       case "file": {
//         return (
//           <FileUploadField
//             field={field}
//             fullPath={fullPath}
//             value={value}
//             formik={formik}
//             autoSave={autoSave}
//             renderHint={renderHint}
//             renderError={renderError}
//           />
//         );
//       }

//       default:
//         return null;
//     }
//   };

//   const renderDocumentSection = (innerSection: any, sectionKeyPath: string) => {
//     const mode = innerSection.requirementMode || "AND";
//     const uniqueKey = sectionKeyPath;

//     if (mode === "OR") {
//       const selectedKey = selectedDocuments[uniqueKey];

//       return (
//         <div className="space-y-4">
//           <p className="text-sm font-medium text-gray-700 mb-2">
//             Select a document to upload
//           </p>

//           <Select
//             placeholder="Choose document"
//             value={innerSection.fields
//               .map((f: any) => ({ label: f.label, value: f.key }))
//               .find((opt) => opt.value === selectedKey)}
//             onChange={(opt) =>
//               setSelectedDocuments((prev) => ({
//                 ...prev,
//                 [uniqueKey]: opt?.value,
//               }))
//             }
//             options={innerSection.fields.map((f: any) => ({
//               label: f.label,
//               value: f.key,
//             }))}
//           />

//           {selectedKey && (
//             <div className="mt-4">
//               {renderField(
//                 innerSection.fields.find((f: any) => f.key === selectedKey),
//                 sectionKeyPath
//               )}
//             </div>
//           )}
//         </div>
//       );
//     }

//     // AND Mode: Show all fields
//     return (
//       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//         {innerSection.fields.map((field: any) =>
//           renderField(field, sectionKeyPath)
//         )}
//       </div>
//     );
//   };

//   if (loading) return <div className="p-6">Loading profile...</div>;

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8">
//         <h2 className="text-xl font-semibold text-gray-900 mb-2">
//           Complete Employee Profile
//         </h2>
//         <div className="text-sm flex items-center gap-2">
//           {saveStatus === "saving" && (
//             <span className="text-blue-500">💾 Saving...</span>
//           )}
//           {saveStatus === "success" && (
//             <span className="text-green-600">✅ Saved</span>
//           )}
//           {saveStatus === "error" && (
//             <span className="text-red-500">⚠️ Error while saving</span>
//           )}
//           {saveStatus === "idle" && (
//             <span className="text-gray-400">Auto-save enabled</span>
//           )}
//         </div>
//         <form
//           onSubmit={formik.handleSubmit}
//           className="space-y-6"
//           id="employee-profile-form"
//         >
//           <Tab>
//             <Tab.List className="gap-2 border-b pb-2 mb-4">
//               {sections.map((section) => (
//                 <Tab.ListItem
//                   key={section.sectionKey}
//                   className="text-sm font-medium px-4 py-2 rounded-md"
//                 >
//                   {section.sectionLabel}
//                 </Tab.ListItem>
//               ))}
//             </Tab.List>
//             <Tab.Panels>
//               {sections.map((section) => (
//                 <Tab.Panel key={section.sectionKey}>
//                   {section.sectionKey === "address" ? (
//                     renderAddressSection(section.fields)
//                   ) : (
//                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                       {section.fields.map((field: any) =>
//                         renderField(field, section.sectionKey)
//                       )}
//                     </div>
//                   )}

//                   {section.innerSections?.map((inner: any) => {
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

//                         {/* Show section-level error */}
//                         {typeof groupError === "string" && (
//                           <div className="text-sm text-red-500 mb-3">
//                             {groupError}
//                           </div>
//                         )}

//                         {section.sectionKey === "documents" ? (
//                           renderDocumentSection(inner, groupPath)
//                         ) : (
//                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                             {inner.fields.map((field: any) =>
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
//           {/* <Button type="submit">Save Profile</Button> */}
//         </form>
//       </Card>
//       <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg px-6 py-4 z-50">
//         <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
//           {/* Auto-save Status */}
//           <div className="text-sm text-gray-500 flex items-center gap-2">
//             <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium shadow-sm">
//               ✅ Auto-save draft is enabled
//             </span>
//           </div>

//           {/* Save Button */}
//           <Button
//             type="submit"
//             form="employee-profile-form"
//             size="lg"
//             className="bg-blue-600 text-white hover:bg-blue-700 shadow-md px-6 py-3 text-base font-semibold rounded-lg"
//           >
//             💾 Save Profile
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// }
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { PhoneInput } from "../components/shared/PhoneInput";

const CreateEmployeeProfile = () => {
  const router = useRouter();

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = () => {
    router.push("/next-step");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e8f1fc] via-white to-[#f2f6fd] flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.75, ease: "easeOut" }}
        className="w-full max-w-4xl bg-white shadow-xl rounded-3xl px-10 md:px-20 py-16 md:py-20"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-[#2778e3] to-indigo-500">
          Create Your Employee Profile
        </h1>

        <div className="space-y-10 text-center text-[1.25rem] md:text-[1.5rem] text-gray-700 leading-loose">
          {/* Name Section */}
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-4">
            <span>Hello, my name is</span>
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleChange}
              placeholder="First Name"
              className="w-44 md:w-56 border-b-2 border-[#2778e3] focus:border-blue-600 bg-transparent placeholder-gray-400 text-[#2778e3] font-semibold text-center py-2 outline-none transition-all"
            />
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleChange}
              placeholder="Last Name"
              className="w-44 md:w-56 border-b-2 border-[#2778e3] focus:border-blue-600 bg-transparent placeholder-gray-400 text-[#2778e3] font-semibold text-center py-2 outline-none transition-all"
            />
            <span>and I’m excited to get started.</span>
          </div>

          {/* Contact Section */}
          <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-4">
            <span>You can reach me at</span>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Work Email"
              className="w-60 md:w-72 border-b-2 border-[#2778e3] focus:border-blue-600 bg-transparent placeholder-gray-400 text-[#2778e3] font-medium text-center py-2 outline-none transition-all"
            />
            <span>or on my phone at</span>
            <div className="w-48 md:w-60">
              <PhoneInput
                value={form.phone}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, phone: value || "" }))
                }
                placeholder="Mobile Number"
                defaultCountry="AU"
                className="[&_.PhoneInputInput]:border-b-2 [&_.PhoneInputInput]:border-[#2778e3] [&_.PhoneInputInput]:focus:border-blue-600 [&_.PhoneInputInput]:bg-transparent [&_.PhoneInputInput]:placeholder-gray-400 [&_.PhoneInputInput]:text-[#2778e3] [&_.PhoneInputInput]:font-medium [&_.PhoneInputInput]:text-center [&_.PhoneInputInput]:py-2 [&_.PhoneInputInput]:outline-none [&_.PhoneInputInput]:transition-all [&_.PhoneInputInput]:border-none [&_.PhoneInputInput]:shadow-none [&_.PhoneInputCountrySelect]:border-none [&_.PhoneInputCountrySelect]:bg-transparent [&_.PhoneInputCountrySelect]:text-[#2778e3]"
              />
            </div>
            <span>.</span>
          </div>
        </div>

        <div className="mt-16 flex justify-center">
          <motion.button
            onClick={handleSubmit}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            className="px-10 py-4 bg-[#2778e3] hover:bg-blue-700 text-white text-lg md:text-xl font-semibold rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
          >
            Create Profile →
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateEmployeeProfile;
