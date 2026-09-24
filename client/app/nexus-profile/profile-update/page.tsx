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
// import debounce from "lodash/debounce";
// import toast from "react-hot-toast";
// import { useDropzone } from "react-dropzone";
// import DocumentUploadModal from "../../components/shared/DocumentUploadModal";
// import { DownloadIcon } from "lucide-react";

// const DRAFT_STORAGE_KEY = "employeeProfileDraft";

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
//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);

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

//   const handleOpenModal = (field: any, fullPath: string) => {
//     setActiveUploadField({ field, fullPath });
//     setModalOpen(true);
//   };

//   const autoSave = useCallback(
//     debounce(async (values: any) => {
//       try {
//         setSaveStatus("saving");
//         const cleanedValues = deepCleanFileFields(values);
//         const { profileUpdates, additionalFields } =
//           splitProfileAndAdditionalFields(cleanedValues, sections);

//         if (Object.keys(profileUpdates).length > 0) {
//           await axiosInstance.put(
//             `/employee-profiles/self/update`,
//             profileUpdates
//           );
//         }

//         setSaveStatus("success");
//       } catch (err) {
//         console.error("Auto-save failed", err);
//         setSaveStatus("error");
//       }
//     }, 1000), // 1 second debounce
//     [sections]
//   );

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
//           await axiosInstance.put(
//             `/employee-profiles/self/update`,
//             profileUpdates
//           );
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
//         // const configRes = await axiosInstance.get(
//         //   "/employee-field-config/profile-config"
//         // );

//         const [{ data: employeeRes }, { data: configRes }] = await Promise.all([
//           axiosInstance.get(`/employee-profiles/self/get`),
//           axiosInstance.get("/employee-field-config/profile-config"),
//         ]);
//         console.log(employeeRes.data, "empl");
//         console.log(configRes.data, "sections");

//         const profile = employeeRes.data;
//         const configSections = configRes.data;

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
//             Issue Date
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
//     const fields = innerSection.fields || [];

//     return (
//       <div className="overflow-x-auto rounded-lg shadow ring-1 ring-gray-200">
//         {mode === "OR" && (
//           <div className="mt-4 max-w-sm px-2 pb-3">
//             <Select
//               placeholder="Choose document"
//               value={fields
//                 .map((f: any) => ({ label: f.label, value: f.key }))
//                 .find((opt: any) => opt.value === selectedDocuments[uniqueKey])}
//               onChange={(opt: any) =>
//                 setSelectedDocuments((prev) => ({
//                   ...prev,
//                   [uniqueKey]: opt?.value,
//                 }))
//               }
//               options={fields.map((f: any) => ({
//                 label: f.label,
//                 value: f.key,
//               }))}
//             />
//           </div>
//         )}

//         <table className="min-w-full text-sm border-collapse bg-white">
//           <thead className="bg-gray-50 text-gray-700">
//             <tr>
//               <th className="px-5 py-3 border-b font-semibold">Document</th>
//               <th className="px-5 py-3 border-b font-semibold">Status</th>
//               <th className="px-5 py-3 border-b font-semibold">Issue Date</th>
//               <th className="px-5 py-3 border-b font-semibold">Expiry Date</th>
//               <th className="px-5 py-3 border-b font-semibold">Uploaded</th>
//               <th className="px-5 py-3 border-b font-semibold text-center">
//                 Action
//               </th>
//             </tr>
//           </thead>
//           <tbody>
//             {(mode === "AND"
//               ? fields
//               : fields.filter(
//                   (f: any) => selectedDocuments[uniqueKey] === f.key
//                 )
//             ).map((field: any, index: number) => {
//               const fullPath = `${sectionKeyPath}.${field.key}`;
//               const value = get(formik.values, fullPath);

//               // Get the actual document status
//               const getDocumentStatus = () => {
//                 if (!value) return "❌ Not Uploaded";

//                 // Check if it's a file reference object with status
//                 if (value.status) {
//                   switch (value.status) {
//                     case "pendingToApprove":
//                       return "🟡 Pending Approval";
//                     case "approved":
//                       return "✅ Approved";
//                     case "rejected":
//                       return "❌ Rejected";
//                     case "expired":
//                       return "⏰ Expired";
//                     default:
//                       return "❓ Unknown";
//                   }
//                 }

//                 // Fallback for legacy documents without status
//                 if (value?.url || value?.fileId) {
//                   return "✅ Uploaded";
//                 }

//                 return "❌ Not Uploaded";
//               };

//               const status = getDocumentStatus();
//               const issueDate = value?.issuingDate
//                 ? new Date(value.issuingDate).toLocaleDateString()
//                 : "—";
//               const expiryDate = value?.expiryDate
//                 ? new Date(value.expiryDate).toLocaleDateString()
//                 : "—";
//               const uploadedAt = value?.url
//                 ? new Date(
//                     value?.url?.split("?")[0]?.split("/").pop()?.split("-")?.[0]
//                   ).toLocaleDateString()
//                 : "—";

//               const handleDownload = () => {
//                 const link = document.createElement("a");
//                 link.href = value.url;
//                 link.download = field.label || "document";
//                 document.body.appendChild(link);
//                 link.click();
//                 document.body.removeChild(link);
//               };

//               return (
//                 <tr
//                   key={field.key}
//                   className={`border-b ${
//                     index % 2 === 0 ? "bg-white" : "bg-gray-50"
//                   }`}
//                 >
//                   <td className="px-5 py-3 font-medium text-gray-900">
//                     {field.label}
//                   </td>
//                   <td className="px-5 py-3 text-gray-700">{status}</td>
//                   <td className="px-5 py-3 text-gray-700">{issueDate}</td>
//                   <td className="px-5 py-3 text-gray-700">{expiryDate}</td>
//                   <td className="px-5 py-3 text-gray-700">{uploadedAt}</td>
//                   <td className="px-5 py-3 text-center">
//                     <div className="flex items-center justify-center gap-2">
//                       <Button
//                         size="sm"
//                         className="bg-blue-600 hover:bg-blue-700 text-white rounded-md"
//                         onClick={() => handleOpenModal(field, fullPath)}
//                       >
//                         {value?.url ? "View / Edit" : "Upload"}
//                       </Button>
//                       {value?.url && (
//                         <button
//                           onClick={handleDownload}
//                           className="p-2 rounded-md hover:bg-gray-100"
//                           title="Download"
//                         >
//                           <DownloadIcon className="w-4 h-4 text-gray-600" />
//                         </button>
//                       )}
//                     </div>
//                   </td>
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
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
//               ✅ Auto-save is enabled
//             </span>
//           </div>
//         </div>
//       </div>

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

// {
//   /* Save Button */
// }
// {
//   /* <Button
//             type="submit"
//             form="employee-profile-form"
//             size="lg"
//             className="bg-blue-600 text-white hover:bg-blue-700 shadow-md px-6 py-3 text-base font-semibold rounded-lg"
//           >
//             💾 Save Profile
//           </Button> */
// }

// // const renderDocumentSection = (innerSection: any, sectionKeyPath: string) => {
// //   const mode = innerSection.requirementMode || "AND";
// //   const uniqueKey = sectionKeyPath;

// //   if (mode === "OR") {
// //     const selectedKey = selectedDocuments[uniqueKey];

// //     return (
// //       <div className="space-y-4">
// //         <p className="text-sm font-medium text-gray-700 mb-2">
// //           Select a document to upload
// //         </p>

// //         <Select
// //           placeholder="Choose document"
// //           value={innerSection.fields
// //             .map((f: any) => ({ label: f.label, value: f.key }))
// //             .find((opt) => opt.value === selectedKey)}
// //           onChange={(opt) =>
// //             setSelectedDocuments((prev) => ({
// //               ...prev,
// //               [uniqueKey]: opt?.value,
// //             }))
// //           }
// //           options={innerSection.fields.map((f: any) => ({
// //             label: f.label,
// //             value: f.key,
// //           }))}
// //         />

// //         {selectedKey && (
// //           <div className="mt-4">
// //             {renderField(
// //               innerSection.fields.find((f: any) => f.key === selectedKey),
// //               sectionKeyPath
// //             )}
// //           </div>
// //         )}
// //       </div>
// //     );
// //   }

// //   // AND Mode: Show all fields
// //   return (
// //     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
// //       {innerSection.fields.map((field: any) =>
// //         renderField(field, sectionKeyPath)
// //       )}
// //     </div>
// //   );
// // };

// // if (section.innerSections?.length) {
// //   for (const inner of section.innerSections) {
// //     const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
// //     const groupValues = get(values, groupPath);

// //     if (inner.requirementMode === "OR") {
// //       const anyFilled = inner.fields.some((f) => {
// //         const v = get(values, `${groupPath}.${f.key}`);
// //         return v?.url;
// //       });

// //       if (!anyFilled) {
// //         inner.fields.forEach((f) => {
// //           set(
// //             errors,
// //             `${groupPath}.${f.key}`,
// //             "At least one document is required."
// //           );
// //         });
// //       }
// //     }

// //     if (inner.requirementMode === "AND") {
// //       let hasError = false;

// //       for (const field of inner.fields) {
// //         const path = `${groupPath}.${field.key}`;
// //         const val = get(values, path);

// //         let isEmpty = false;
// //         if (field.type === "checkbox") {
// //           isEmpty = !val;
// //         } else if (field.type === "file") {
// //           isEmpty = !val?.url;
// //         } else if (field.type === "date") {
// //           isEmpty = !val;
// //         } else if (field.type === "select") {
// //           isEmpty = !val;
// //         } else {
// //           isEmpty = val === "" || val === null || val === undefined;
// //         }

// //         if (isEmpty) {
// //           set(errors, path, "This field is required.");
// //           hasError = true;
// //         }
// //       }

// //       if (hasError) {
// //         // Optional: add a section-level error
// //         set(
// //           errors,
// //           groupPath,
// //           "All fields in this section are required."
// //         );
// //       }
// //     }
// //   }
// // }

// // Optional: indicate draft is saved
// // useEffect(() => {
// //   const timeout = setTimeout(() => {
// //     setSaveStatus("idle");
// //   }, 3000);
// //   return () => clearTimeout(timeout);
// // }, [formik.values]);

// // const draft = loadDraft();
// // if (draft) {
// //   console.log("Applying draft from localStorage");
// //   Object.assign(values, draft); // override default values with draft
// // }

// // const renderDocumentSection = (innerSection: any, sectionKeyPath: string) => {
// //   const mode = innerSection.requirementMode || "AND";
// //   const uniqueKey = sectionKeyPath;
// //   const fields = innerSection.fields || [];

// //   return (
// //     <div className="overflow-x-auto rounded-lg shadow ring-1 ring-gray-200">
// //       {mode === "OR" && (
// //         <div className="mt-4 max-w-sm m px-2 pb-3">
// //           <Select
// //             placeholder="Choose document"
// //             value={fields
// //               .map((f: any) => ({ label: f.label, value: f.key }))
// //               .find((opt: any) => opt.value === selectedDocuments[uniqueKey])}
// //             onChange={(opt: any) =>
// //               setSelectedDocuments((prev) => ({
// //                 ...prev,
// //                 [uniqueKey]: opt?.value,
// //               }))
// //             }
// //             options={fields.map((f: any) => ({
// //               label: f.label,
// //               value: f.key,
// //             }))}
// //           />
// //         </div>
// //       )}
// //       <table className="min-w-full text-sm text-left border-collapse bg-white">
// //         <thead className="bg-gray-50 text-gray-700">
// //           <tr>
// //             <th className="px-5 py-3 border-b font-semibold">Document</th>
// //             <th className="px-5 py-3 border-b font-semibold">Status</th>
// //             <th className="px-5 py-3 border-b font-semibold">Issue Date</th>
// //             <th className="px-5 py-3 border-b font-semibold">Expiry Date</th>
// //             <th className="px-5 py-3 border-b font-semibold">Uploaded</th>
// //             <th className="px-5 py-3 border-b font-semibold text-center">
// //               Action
// //             </th>
// //           </tr>
// //         </thead>
// //         <tbody>
// //           {(mode === "AND"
// //             ? fields
// //             : fields.filter(
// //                 (f: any) => selectedDocuments[uniqueKey] === f.key
// //               )
// //           ).map((field: any, index: number) => {
// //             const fullPath = `${sectionKeyPath}.${field.key}`;
// //             const value = get(formik.values, fullPath);

// //             const status = value?.url ? "✅ Uploaded" : "❌ Not Uploaded";
// //             const issueDate = value?.issuingDate
// //               ? new Date(value.issuingDate).toLocaleDateString()
// //               : "—";
// //             const expiryDate = value?.expiryDate
// //               ? new Date(value.expiryDate).toLocaleDateString()
// //               : "—";
// //             const uploadedAt = value?.url
// //               ? new Date(
// //                   value?.url?.split("?")[0]?.split("/").pop()?.split("-")?.[0]
// //                 ).toLocaleDateString()
// //               : "—";

// //             return (
// //               <tr
// //                 key={field.key}
// //                 className={`border-b ${
// //                   index % 2 === 0 ? "bg-white" : "bg-gray-50"
// //                 }`}
// //               >
// //                 <td className="px-5 py-3 text-sm font-medium text-gray-900">
// //                   {field.label}
// //                 </td>
// //                 <td className="px-5 py-3 text-gray-700">{status}</td>
// //                 <td className="px-5 py-3 text-gray-700">{issueDate}</td>
// //                 <td className="px-5 py-3 text-gray-700">{expiryDate}</td>
// //                 <td className="px-5 py-3 text-gray-700">{uploadedAt}</td>
// //                 <td className="px-5 py-3 text-center">
// //                   <Button
// //                     size="sm"
// //                     className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1 rounded-md"
// //                     onClick={() => handleOpenModal(field, fullPath)}
// //                   >
// //                     {value?.url ? "View / Edit" : "Upload"}
// //                   </Button>
// //                 </td>
// //               </tr>
// //             );
// //           })}
// //         </tbody>
// //       </table>
// //     </div>
// //   );
// // };

// // const autoSave = async (values: any) => {
// //   console.log(values, "just showw");
// //   // setSaveStatus("saving");
// //   // const cleanedValues = deepCleanFileFields(values);
// //   // console.log(cleanedValues, "show it cleaned");

// //   // const { profileUpdates, additionalFields } =
// //   //   splitProfileAndAdditionalFields(cleanedValues, sections);

// //   // console.log(profileUpdates, "show after");

// //   // if (Object.keys(profileUpdates).length > 0) {
// //   //   await axiosInstance.put(
// //   //     `/employee-profiles/${profileId}`,
// //   //     profileUpdates
// //   //   );
// //   //   setSaveStatus("success");
// //   // }

// //   // if (additionalFields.length > 0) {
// //   //   await axiosInstance.put(`/employees/${employeeId}`, {
// //   //     additionalFields,
// //   //   });
// //   //   setSaveStatus("success");
// //   // }
// // };

// // Utility: Load draft from localStorage
// // const loadDraft = () => {
// //   try {
// //     const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
// //     if (!raw) return null;
// //     return JSON.parse(raw);
// //   } catch (e) {
// //     console.error("Failed to load draft from localStorage", e);
// //     return null;
// //   }
// // };

// // Replace autoSave function to save to localStorage instead
// // const autoSave = async (values: any) => {
// //   saveDraft(values);
// //   setSaveStatus("idle");
// // };

// // Utility: Save draft to localStorage
// // const saveDraft = (values) => {
// //   try {
// //     localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(values));
// //   } catch (e) {
// //     console.error("Failed to save draft to localStorage", e);
// //   }
// // };

// "use client";

// import {
//   useEffect,
//   useMemo,
//   useState,
//   Fragment,
//   useCallback,
//   useRef,
// } from "react";
// import { useParams } from "next/navigation";
// import { Tab, Button, Input, Select, Checkbox, Textarea } from "rizzui";
// import axiosInstance from "@/app/lib/axios";

// import Image from "next/image";
// import { Card } from "@/app/components/ui/Card";
// import { PencilIcon, XMarkIcon } from "@heroicons/react/24/solid";
// import Link from "next/link";
// import { useSelector } from "react-redux";
// import { Dialog, Transition } from "@headlessui/react";
// import toast from "react-hot-toast";
// import { useFormik } from "formik";
// import get from "lodash/get";
// import set from "lodash/set";

// // ✅ AcceptInvitation-style components/flows
// import DocumentUploadModal from "../components/shared/DocumentUploadModal";
// import DocumentSection from "../components/ui/DocumentSection";
// import { useDebouncedAutosave } from "@/app/hooks/useDebouncedAutosave";
// import { deepClean } from "@/app/utils/profile-utils";
// import PropagationConsentModal from "./PropagationConsentModal";

// //

// /* =============================
//    Types
//    ============================= */
// type FileLike = { url?: string; [k: string]: any };

// type Field = {
//   key: string;
//   label: string;
//   type:
//     | "text"
//     | "email"
//     | "number"
//     | "checkbox"
//     | "date"
//     | "file"
//     | "reference"
//     | "select"
//     | "textarea"
//     | "object"
//     | "unknown";
//   options?: string[]; // for select
//   referenceModel?: string; // for reference
//   placeholder?: string;
//   required?: boolean;
//   isAdditional?: boolean;
//   showIf?: {
//     fieldKey: string;
//     operator: "equals" | "notEquals";
//     value: any;
//   };
// };

// type InnerSection = {
//   sectionKey: string;
//   sectionLabel: string;
//   fields: Field[];
//   requirementMode?: "AND" | "OR";
// };

// type Section = {
//   sectionKey: string;
//   sectionLabel: string;
//   fields: Field[];
//   innerSections: InnerSection[];
// };

// /* =============================
//    Utils
//    ============================= */

// // Hide specific fields per section (keys are raw schema keys)
// const HIDDEN_FIELDS: Record<string, Set<string>> = {
//   personaldetails: new Set(["employeephoto"]),
// };

// const isHiddenField = (sectionKey: string, fieldKey: string) => {
//   const k = (sectionKey || "").toLowerCase().replace(/\s+/g, "");
//   return HIDDEN_FIELDS[k]?.has(fieldKey) ?? false;
// };

// const prettyLabel = (k: string) =>
//   k
//     .replace(/([a-z])([A-Z])/g, "$1 $2")
//     .replace(/[_\-]+/g, " ")
//     .replace(/\b\w/g, (m) => m.toUpperCase())
//     .trim();

// const isObject = (v: any) => v && typeof v === "object" && !Array.isArray(v);
// const isEmptyObject = (v: any) => isObject(v) && Object.keys(v).length === 0;
// const isEmptyValue = (v: any) =>
//   v === null ||
//   v === undefined ||
//   v === "" ||
//   (Array.isArray(v) && v.length === 0) ||
//   isEmptyObject(v);

// const guessType = (v: any): Field["type"] => {
//   if (typeof v === "boolean") return "checkbox";
//   if (typeof v === "number") return "number";
//   if (typeof v === "string") {
//     if (/^\d{4}-\d{2}-\d{2}/.test(v) || !isNaN(Date.parse(v))) return "date";
//     return "text";
//   }
//   if (isObject(v)) {
//     if ("url" in v && typeof (v as FileLike).url === "string") return "file";
//     if ("_id" in v || "name" in v) return "reference";
//     return "object";
//   }
//   return "unknown";
// };

// // visible additional field fallback (non-docs view)
// const getWithAdditionalFallback = (
//   profile: any,
//   sectionKey: string,
//   fieldKey: string,
//   innerKey?: string
// ) => {
//   const mainVal = innerKey
//     ? profile?.[sectionKey]?.[innerKey]?.[fieldKey]
//     : profile?.[sectionKey]?.[fieldKey];

//   if (!isEmptyValue(mainVal)) return mainVal;

//   const found = (profile?.additionalFields || []).find(
//     (f: any) =>
//       f.sectionKey === sectionKey &&
//       f.fieldKey === fieldKey &&
//       (innerKey ? f.innerSectionKey === innerKey : !f.innerSectionKey) &&
//       f.isShowInProfile === true
//   );
//   return found?.value;
// };

// // 🔧 Address helpers
// const sanitizeAddressArray = (arr: any[]): any[] => {
//   return (arr || [])
//     .map((addr) => {
//       if (!isObject(addr)) return {};
//       const out: Record<string, any> = {};
//       Object.keys(addr).forEach((k) => {
//         if (k === "id" || k === "_id") return;
//         const v = addr[k];
//         if (!isEmptyValue(v)) out[k] = v;
//       });
//       return out;
//     })
//     .filter((obj) => !isEmptyObject(obj));
// };

// const sanitizeSectionTree = (section: Section, draft: DraftShape) => {
//   const out: Record<string, any> = {};

//   // top-level fields
//   for (const f of section.fields) {
//     const v = draft[f.key];
//     if (!isEmptyValue(v)) out[f.key] = v;
//   }

//   // inner sections
//   for (const inn of section.innerSections || []) {
//     const group = draft.__inners?.[inn.sectionKey] || {};
//     const groupOut: Record<string, any> = {};
//     for (const f of inn.fields) {
//       const v = group[f.key];
//       if (!isEmptyValue(v)) groupOut[f.key] = v;
//     }
//     if (!isEmptyObject(groupOut)) out[inn.sectionKey] = groupOut;
//   }

//   return out;
// };

// // 🆕: types for propagation preview/apply
// // 🆕 keep in sync with backend
// type PropTarget =
//   | { kind: "path"; employeePath: string }
//   | { kind: "additionalField"; fieldKey: string };

// type PropOverlap = {
//   employeeId: string;
//   tenantId: string;
//   branchId: string;
//   tenantName?: string;
//   branchName?: string;
//   fieldKey: string;
//   profilePath: string;
//   newValue: any;
//   oldValue: any;
//   sectionKey?: string;
//   innerSectionKey?: string | null;
//   target: PropTarget;
// };

// // 🆕: deepEqual (tiny fast)
// const deepEqualFast = (a: any, b: any) => {
//   if (a === b) return true;
//   try {
//     return JSON.stringify(a) === JSON.stringify(b);
//   } catch {
//     return false;
//   }
// };

// // 🆕: diff only changed document fields (so preview stays small)
// const diffDocsSubtree = (prev: any = {}, next: any = {}) => {
//   const groups = [
//     "identificationdocuments",
//     "certificates",
//     "checksandclearance",
//   ] as const;

//   const out: any = {};
//   for (const grp of groups) {
//     const p = prev?.[grp] || {};
//     const n = next?.[grp] || {};
//     const grpOut: any = {};
//     const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
//     for (const k of keys) {
//       if (!deepEqualFast(p[k], n[k])) {
//         grpOut[k] = n[k];
//       }
//     }
//     if (Object.keys(grpOut).length) out[grp] = grpOut;
//   }
//   return out;
// };

// // Build sections from profile (for non-docs view); documents come from config
// const deriveSectionsFromProfile = (profile: any): Section[] => {
//   if (!profile || typeof profile !== "object") return [];

//   const EXCLUDE = new Set([
//     "userId",
//     "_id",
//     "__v",
//     "createdAt",
//     "updatedAt",
//     "additionalFields",
//     "designation",
//   ]);

//   const sections: Section[] = [];
//   const topKeys = Object.keys(profile).filter((k) => !EXCLUDE.has(k));

//   for (const sectionKey of topKeys) {
//     const sectionVal = profile[sectionKey];

//     if (sectionKey === "address" && Array.isArray(sectionVal)) {
//       const first = sectionVal[0] || {};
//       const fields: Field[] = Object.keys(first)
//         .filter((fk) => fk !== "id" && fk !== "_id")
//         .map((fk) => ({
//           key: fk,
//           label: prettyLabel(fk),
//           type: guessType(first[fk]),
//         }));
//       sections.push({
//         sectionKey,
//         sectionLabel: prettyLabel(sectionKey),
//         fields,
//         innerSections: [],
//       });
//       continue;
//     }

//     if (isObject(sectionVal)) {
//       const fields: Field[] = [];
//       const innerSections: InnerSection[] = [];

//       for (const key of Object.keys(sectionVal)) {
//         const val = sectionVal[key];

//         if (
//           isObject(val) &&
//           !("url" in val) &&
//           !("_id" in val) &&
//           !("name" in val)
//         ) {
//           const innerFields: Field[] = Object.keys(val).map((ik) => ({
//             key: ik,
//             label: prettyLabel(ik),
//             type: guessType(val[ik]),
//           }));
//           innerSections.push({
//             sectionKey: key,
//             sectionLabel: prettyLabel(key),
//             fields: innerFields,
//           });
//         } else {
//           fields.push({
//             key,
//             label: prettyLabel(key),
//             type: guessType(val),
//           });
//         }
//       }

//       // fold in visible additionalFields
//       const adds: any[] = profile?.additionalFields || [];
//       const addsForSection = adds.filter(
//         (a) => a.sectionKey === sectionKey && a.isShowInProfile === true
//       );

//       for (const add of addsForSection.filter((a) => !a.innerSectionKey)) {
//         if (!fields.some((f) => f.key === add.fieldKey)) {
//           fields.push({
//             key: add.fieldKey,
//             label: prettyLabel(add.fieldKey),
//             type: guessType(add.value),
//           });
//         }
//       }

//       const innerGroups: Record<string, Field[]> = {};
//       for (const add of addsForSection.filter((a) => a.innerSectionKey)) {
//         const ikey = add.innerSectionKey as string;
//         if (!innerGroups[ikey]) innerGroups[ikey] = [];
//         if (!innerGroups[ikey].some((f) => f.key === add.fieldKey)) {
//           innerGroups[ikey].push({
//             key: add.fieldKey,
//             label: prettyLabel(add.fieldKey),
//             type: guessType(add.value),
//           });
//         }
//       }
//       for (const [ikey, extraFields] of Object.entries(innerGroups)) {
//         const existing = innerSections.find((i) => i.sectionKey === ikey);
//         if (existing) {
//           for (const ef of extraFields) {
//             if (!existing.fields.some((f) => f.key === ef.key)) {
//               existing.fields.push(ef);
//             }
//           }
//         } else {
//           innerSections.push({
//             sectionKey: ikey,
//             sectionLabel: prettyLabel(ikey),
//             fields: extraFields,
//           });
//         }
//       }

//       sections.push({
//         sectionKey,
//         sectionLabel: prettyLabel(sectionKey),
//         fields,
//         innerSections,
//       });
//     } else {
//       sections.push({
//         sectionKey,
//         sectionLabel: prettyLabel(sectionKey),
//         fields: [
//           {
//             key: sectionKey,
//             label: prettyLabel(sectionKey),
//             type: guessType(sectionVal),
//           },
//         ],
//         innerSections: [],
//       });
//     }
//   }

//   const weight = (k: string) => {
//     const n = k.toLowerCase();
//     if (n.includes("personal")) return 0;
//     if (n.includes("document")) return 1;
//     if (n.includes("bank")) return 2;
//     if (n.includes("address")) return 3;
//     return 10;
//   };
//   sections.sort((a, b) => weight(a.sectionKey) - weight(b.sectionKey));

//   return sections;
// };

// // put near deriveSectionsFromProfile
// const buildDisplaySections = (profile: any, cfg: any[]): Section[] => {
//   // 1) Normalize config into Section[]
//   const cfgSectionsNorm: Section[] = (cfg || []).map((s: any) => ({
//     sectionKey: s.sectionKey,
//     sectionLabel: s.sectionLabel ?? prettyLabel(s.sectionKey),
//     fields: (s.fields || []).map((f: any) => ({
//       key: f.key,
//       label: f.label ?? prettyLabel(f.key),
//       type: f.type,
//       options: f.options,
//       referenceModel: f.referenceModel,
//       placeholder: f.placeholder,
//       required: f.required,
//       isAdditional: f.isAdditional,
//       showIf: f.showIf,
//     })),
//     innerSections: (s.innerSections || []).map((inn: any) => ({
//       sectionKey: inn.sectionKey,
//       sectionLabel: inn.sectionLabel ?? prettyLabel(inn.sectionKey),
//       requirementMode: inn.requirementMode,
//       fields: (inn.fields || []).map((f: any) => ({
//         key: f.key,
//         label: f.label ?? prettyLabel(f.key),
//         type: f.type,
//         options: f.options,
//         referenceModel: f.referenceModel,
//         placeholder: f.placeholder,
//         required: f.required,
//         isAdditional: f.isAdditional,
//         showIf: f.showIf,
//       })),
//     })),
//   }));

//   // 2) Derive sections from profile to scoop up extras
//   const profSections = deriveSectionsFromProfile(profile);

//   // 3) Union: start with config, then add any profile-only fields
//   const map = new Map<string, Section>();
//   cfgSectionsNorm.forEach((s) => map.set(s.sectionKey, { ...s }));

//   const upsertField = (list: Field[], f: Field) => {
//     if (!list.some((x) => x.key === f.key)) list.push(f);
//   };

//   profSections.forEach((ps) => {
//     const target =
//       map.get(ps.sectionKey) ||
//       ({
//         sectionKey: ps.sectionKey,
//         sectionLabel: ps.sectionLabel,
//         fields: [],
//         innerSections: [],
//       } as Section);

//     ps.fields.forEach((f) =>
//       upsertField(target.fields, {
//         ...f,
//         // keep any guessed type/label only if config didn't define it
//         label: target.fields.find((x) => x.key === f.key)?.label ?? f.label,
//         type: target.fields.find((x) => x.key === f.key)?.type ?? f.type,
//       })
//     );

//     ps.innerSections.forEach((pin) => {
//       const tin =
//         target.innerSections.find((x) => x.sectionKey === pin.sectionKey) ||
//         (() => {
//           const n: InnerSection = {
//             sectionKey: pin.sectionKey,
//             sectionLabel: pin.sectionLabel,
//             fields: [],
//           };
//           target.innerSections.push(n);
//           return n;
//         })();

//       pin.fields.forEach((f) =>
//         upsertField(tin.fields, {
//           ...f,
//           label: tin.fields.find((x) => x.key === f.key)?.label ?? f.label,
//           type: tin.fields.find((x) => x.key === f.key)?.type ?? f.type,
//         })
//       );
//     });

//     map.set(ps.sectionKey, target);
//   });

//   // 4) Order: keep config order first, then any leftovers (profile-only)
//   const cfgOrder = cfgSectionsNorm.map((s) => s.sectionKey);
//   const leftovers = Array.from(map.values()).filter(
//     (s) => !cfgOrder.includes(s.sectionKey)
//   );
//   const weight = (k: string) => {
//     const n = k.toLowerCase();
//     if (n.includes("personal")) return 0;
//     if (n.includes("document")) return 1;
//     if (n.includes("bank")) return 2;
//     if (n.includes("address")) return 3;
//     return 10;
//   };
//   leftovers.sort((a, b) => weight(a.sectionKey) - weight(b.sectionKey));

//   return [...cfgOrder.map((k) => map.get(k)!), ...leftovers];
// };

// /* =============================
//    Drawer helpers (showIf + render)
//    ============================= */
// type DraftShape = {
//   [k: string]: any;
//   __inners?: Record<string, Record<string, any>>;
// };

// const SAVE_SELF_SECTION_ENDPOINT = `/employee-profiles/self/update`;

// const buildDraftFromSection = (employee: any, section: Section): DraftShape => {
//   const d: DraftShape = { __inners: {} };

//   for (const f of section.fields) {
//     if (isHiddenField(section.sectionKey, f.key)) continue; // ⬅️ add this line
//     d[f.key] =
//       getWithAdditionalFallback(employee, section.sectionKey, f.key) ??
//       (f.type === "checkbox" ? false : "");
//   }

//   for (const inn of section.innerSections || []) {
//     d.__inners![inn.sectionKey] = {};
//     for (const f of inn.fields) {
//       if (isHiddenField(section.sectionKey, f.key)) continue; // ⬅️ add this line
//       d.__inners![inn.sectionKey][f.key] =
//         getWithAdditionalFallback(
//           employee,
//           section.sectionKey,
//           f.key,
//           inn.sectionKey
//         ) ?? (f.type === "checkbox" ? false : "");
//     }
//   }

//   return d;
// };

// const extractItemsFromDraft = (section: Section, draft: DraftShape) => {
//   const items: Array<{
//     fieldKey: string;
//     value: any;
//     innerSectionKey?: string;
//   }> = [];

//   for (const f of section.fields) {
//     if (Object.prototype.hasOwnProperty.call(draft, f.key)) {
//       items.push({ fieldKey: f.key, value: draft[f.key] });
//     }
//   }
//   for (const inn of section.innerSections || []) {
//     const group = draft.__inners?.[inn.sectionKey] || {};
//     for (const f of inn.fields) {
//       if (Object.prototype.hasOwnProperty.call(group, f.key)) {
//         items.push({
//           innerSectionKey: inn.sectionKey,
//           fieldKey: f.key,
//           value: group[f.key],
//         });
//       }
//     }
//   }
//   return items;
// };

// // turn draft into a simple tree so showIf can find values by key easily
// const draftToTree = (section: Section, draft: DraftShape) => {
//   const tree: any = { [section.sectionKey]: {} };
//   for (const f of section.fields) {
//     tree[section.sectionKey][f.key] = draft[f.key];
//   }
//   for (const inn of section.innerSections || []) {
//     tree[section.sectionKey][inn.sectionKey] = {
//       ...(draft.__inners?.[inn.sectionKey] || {}),
//     };
//   }
//   return tree;
// };

// const findValueInTree = (obj: any, key: string): any => {
//   if (!obj || typeof obj !== "object") return undefined;
//   if (key in obj) return obj[key];
//   for (const k of Object.keys(obj)) {
//     const v = obj[k];
//     if (v && typeof v === "object") {
//       const found = findValueInTree(v, key);
//       if (found !== undefined) return found;
//     }
//   }
//   return undefined;
// };

// const shouldShow = (source: any, field: Field): boolean => {
//   if (!field?.showIf) return true;
//   const actual = findValueInTree(source, field.showIf.fieldKey);
//   return field.showIf.operator === "equals"
//     ? actual === field.showIf.value
//     : actual !== field.showIf.value;
// };

// /* =============================
//    Component
//    ============================= */

// // 🆕 File helpers
// // 🆕 File helpers
// const isFileValue = (v: any) =>
//   v && typeof v === "object" && typeof v.url === "string";
// const getFileExt = (url: string) => {
//   try {
//     const clean = url.split("?")[0].split("#")[0];
//     const m = clean.match(/\.([a-z0-9]+)$/i);
//     return m ? m[1].toLowerCase() : "";
//   } catch {
//     return "";
//   }
// };
// const isImageExt = (ext: string) =>
//   ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"].includes(ext);
// const isPdfExt = (ext: string) => ext === "pdf";

// const prettyPath = (overlap: PropOverlap) => {
//   // profile side path
//   const from = overlap.profilePath;

//   // org side
//   let to = "";
//   if (overlap.target.kind === "path") {
//     to = overlap.target.employeePath; // e.g., employeeFields.documents.identificationdocuments.passport
//   } else {
//     to = `employeeFields.additionalFields[fieldKey=${overlap.target.fieldKey}]`;
//   }

//   let where = overlap.sectionKey || "";
//   if (overlap.innerSectionKey) where += ` / ${overlap.innerSectionKey}`;

//   return { from, to, where };
// };

// /* =============================
//    Helpers (add)
//    ============================= */

// // Build a fieldKey -> newValue map from the preview payload
// const buildFieldKeyValueMap = (updates: any) => {
//   const m = new Map<string, any>();
//   if (!updates || typeof updates !== "object") return m;

//   // 1) additionalFields has explicit fieldKey/value, prefer these
//   if (Array.isArray(updates.additionalFields)) {
//     updates.additionalFields.forEach((a: any) => {
//       if (a?.fieldKey != null) m.set(String(a.fieldKey), a.value);
//     });
//   }

//   // Small helper to treat file-like { url: string } as a leaf value
//   const isFileLike = (v: any) =>
//     v && typeof v === "object" && typeof v.url === "string";

//   // 2) Recursively walk any object/array and collect leaf keys
//   const walk = (node: any) => {
//     if (node == null) return;

//     // Arrays: walk each element
//     if (Array.isArray(node)) {
//       node.forEach(walk);
//       return;
//     }

//     // Objects: for each key, if value is a non-file object → recurse,
//     // otherwise record as a leaf { key: value }
//     if (typeof node === "object") {
//       Object.entries(node).forEach(([k, v]) => {
//         if (v && typeof v === "object" && !isFileLike(v) && !Array.isArray(v)) {
//           walk(v);
//         } else {
//           m.set(String(k), v);
//         }
//       });
//     }
//   };

//   // 3) Walk every top-level section except additionalFields (already handled)
//   Object.entries(updates).forEach(([k, v]) => {
//     if (k === "additionalFields") return;
//     walk(v);
//   });

//   return m;
// };

// export default function EmployeeProfileView() {
//   const { user } = useSelector((state: any) => state.auth);
//   const { id } = useParams(); // kept for consistency

//   const [employee, setEmployee] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   // Drawer state
//   const [drawerOpen, setDrawerOpen] = useState(false);
//   const [editingSection, setEditingSection] = useState<Section | null>(null);
//   const [draft, setDraft] = useState<DraftShape>({ __inners: {} });
//   const [saving, setSaving] = useState(false);
//   // 🔧 Address: dedicated draft
//   const [addressDraft, setAddressDraft] = useState<any[]>([]);

//   const [dirty, setDirty] = useState(false);
//   const initialDraftRef = useRef<any>(null);

//   type OrgFieldPreview = {
//     employeeId: string;
//     tenantId: string;
//     branchId: string;
//     tenantName?: string;
//     branchName?: string;
//     fieldKey: string;
//     occurrences?: number;
//   };

//   // 🆕: Propagation modal state
//   /* =============================
//    Component state (replace old propagation state)
//    ============================= */
//   // 🆕: Propagation modal state
//   const [propModalOpen, setPropModalOpen] = useState(false);
//   const [propOverlaps, setPropOverlaps] = useState<OrgFieldPreview[]>([]);
//   const propResolverRef = useRef<
//     | null
//     | ((result: {
//         action: "apply" | "skip" | "cancel";
//         selected: OrgFieldPreview[];
//       }) => void)
//   >(null);

//   // 🆕: Keep a snapshot of last-saved documents to compute diffs for preview
//   const docsSnapshotRef = useRef<any>({});

//   const deepEqual = (a: any, b: any) => {
//     try {
//       return JSON.stringify(a) === JSON.stringify(b);
//     } catch {
//       return false;
//     }
//   };

//   const safeCloseDrawer = () => {
//     if (saving) return;
//     if (dirty && !confirm("Discard unsaved changes?")) return;
//     closeDrawer();
//   };

//   // Track dirty state against the snapshot taken when opening the drawer
//   useEffect(() => {
//     if (!drawerOpen) return;
//     const baseline = initialDraftRef.current;
//     const current =
//       editingSection?.sectionKey === "address" ? addressDraft : draft;
//     setDirty(!deepEqual(current, baseline));
//   }, [drawerOpen, editingSection, draft, addressDraft]);

//   // Cmd/Ctrl + S to save while drawer is open
//   useEffect(() => {
//     if (!drawerOpen) return;
//     const onKey = (e: KeyboardEvent) => {
//       const metaS = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
//       if (metaS) {
//         e.preventDefault();
//         if (!saving && dirty) saveDrawer();
//       }
//       if (e.key === "Escape") {
//         e.preventDefault();
//         safeCloseDrawer();
//       }
//     };
//     window.addEventListener("keydown", onKey);
//     return () => window.removeEventListener("keydown", onKey);
//   }, [drawerOpen, saving, dirty]); // saveDrawer is stable in this component

//   // ⚙️ field-config sections from API
//   const [cfgSections, setCfgSections] = useState<Section[]>([]);

//   // reference dropdown options for reference fields
//   const [referenceOptions, setReferenceOptions] = useState<
//     Record<string, { label: string; value: string }[]>
//   >({});

//   // ---- Documents: AcceptInvitation-like state ----
//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);
//   const handleOpenModal = (field: any, fullPath: string) => {
//     setActiveUploadField({ field, fullPath });
//     setModalOpen(true);
//   };
//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({}); // OR groups

//   /* ---------- Config overlay ---------- */
//   const applyConfigOverlay = (
//     baseSections: Section[],
//     cfg: any[]
//   ): Section[] => {
//     const cfgBySection = new Map<string, any>(
//       (cfg || []).map((s: any) => [s.sectionKey, s])
//     );

//     return baseSections.map((sec) => {
//       const cfgSec = cfgBySection.get(sec.sectionKey);

//       const patchedFields = sec.fields.map((f) => {
//         const cf = cfgSec?.fields?.find((x: any) => x.key === f.key);
//         if (!cf) return f;
//         return {
//           ...f,
//           label: cf.label ?? f.label,
//           type: (cf.type as Field["type"]) ?? f.type,
//           placeholder: cf.placeholder ?? f.placeholder,
//           required: cf.required ?? f.required,
//           options: cf.options ?? f.options,
//           referenceModel: cf.referenceModel ?? f.referenceModel,
//           showIf: cf.showIf ?? f.showIf,
//           isAdditional: cf.isAdditional ?? f.isAdditional,
//         };
//       });

//       const patchedInner = (sec.innerSections || []).map((inn) => {
//         const ci = cfgSec?.innerSections?.find(
//           (x: any) => x.sectionKey === inn.sectionKey
//         );

//         const patchedInnerFields = inn.fields.map((f) => {
//           const cf = ci?.fields?.find((x: any) => x.key === f.key);
//           if (!cf) return f;
//           return {
//             ...f,
//             label: cf.label ?? f.label,
//             type: (cf.type as Field["type"]) ?? f.type,
//             placeholder: cf.placeholder ?? f.placeholder,
//             required: cf.required ?? f.required,
//             options: cf.options ?? f.options,
//             referenceModel: cf.referenceModel ?? f.referenceModel,
//             showIf: cf.showIf ?? f.showIf,
//             isAdditional: cf.isAdditional ?? f.isAdditional,
//           };
//         });

//         return {
//           ...inn,
//           sectionLabel: ci?.sectionLabel ?? inn.sectionLabel,
//           requirementMode: ci?.requirementMode ?? inn.requirementMode,
//           fields: patchedInnerFields,
//         };
//       });

//       return {
//         ...sec,
//         sectionLabel: cfgSec?.sectionLabel ?? sec.sectionLabel,
//         fields: patchedFields,
//         innerSections: patchedInner,
//       };
//     });
//   };

//   // Fetch employee + field config together
//   useEffect(() => {
//     (async () => {
//       try {
//         const [{ data: empRes }, { data: cfgRes }] = await Promise.all([
//           axiosInstance.get(`/employee-profiles/self/get`),
//           axiosInstance.get(`/employee-field-config/profile-config`),
//         ]);

//         const emp = empRes?.data || null;
//         const cfg = cfgRes?.data?.sections || cfgRes?.data || [];
//         setEmployee(emp);
//         setCfgSections(cfg);
//       } catch (err) {
//         console.error("Failed to fetch profile/config", err);
//         toast.error("Could not load profile.");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [id]);

//   // helper to map config field → Field type
//   const mapCfgField = (cf: any): Field => ({
//     key: cf.key,
//     label: cf.label ?? prettyLabel(cf.key),
//     type: (cf.type as Field["type"]) ?? "text",
//     placeholder: cf.placeholder,
//     required: cf.required,
//     options: cf.options,
//     referenceModel: cf.referenceModel,
//     showIf: cf.showIf,
//     isAdditional: cf.isAdditional,
//   });

//   // Build sections (config-first), overlaying any hints from profile
//   const sections = useMemo<Section[]>(() => {
//     const base = buildDisplaySections(employee || {}, cfgSections);

//     // Remove hidden fields from sections (so they never render/edit)
//     return base.map((s) => {
//       const cleaned: Section = {
//         ...s,
//         fields: (s.fields || []).filter(
//           (f) => !isHiddenField(s.sectionKey, f.key)
//         ),
//         innerSections: (s.innerSections || []).map((inn) => ({
//           ...inn,
//           fields: (inn.fields || []).filter(
//             (f) => !isHiddenField(s.sectionKey, f.key)
//           ),
//         })),
//       };
//       return cleaned;
//     });
//   }, [employee, cfgSections]);

//   // Docs config section (from API)
//   const docsCfgSection: Section | null = useMemo(() => {
//     return (
//       (cfgSections || []).find((s) => s.sectionKey === "documents") || null
//     );
//   }, [cfgSections]);

//   const docsDisplaySection: Section | null = useMemo(() => {
//     if (!docsCfgSection) return null;

//     // shallow clone is enough here since we only push into innerSections/fields
//     const clone: Section = {
//       ...docsCfgSection,
//       innerSections: [...(docsCfgSection.innerSections || [])].map((inn) => ({
//         ...inn,
//         fields: [...(inn.fields || [])],
//       })),
//     };

//     const VISIBLE_DOC_ADDS = (employee?.additionalFields || []).filter(
//       (a: any) => a?.sectionKey === "documents" && a?.isShowInProfile === true
//     );

//     const ensureInner = (key: string, label?: string) => {
//       let target = clone.innerSections.find((s) => s.sectionKey === key);
//       if (!target) {
//         target = {
//           sectionKey: key,
//           sectionLabel: label ?? prettyLabel(key),
//           fields: [],
//           requirementMode: "AND",
//         };
//         clone.innerSections.push(target);
//       }
//       return target;
//     };

//     for (const a of VISIBLE_DOC_ADDS) {
//       const innerKey = a?.innerSectionKey ?? "__other_docs";
//       const innerLabel = a?.innerSectionKey ? undefined : "Other Documents";
//       const inner = ensureInner(innerKey, innerLabel);

//       if (!inner.fields.some((f) => f.key === a.fieldKey)) {
//         inner.fields.push({
//           key: a.fieldKey,
//           label: prettyLabel(a.fieldKey),
//           type: "file",
//           isAdditional: true,
//         } as Field);
//       }
//     }

//     return clone;
//   }, [docsCfgSection, employee]);

//   // Map each documents path to meta (isAdditional, fieldKey, innerSectionKey)
//   const docsPathMeta = useMemo(() => {
//     const map: Record<
//       string,
//       {
//         isAdditional: boolean;
//         fieldKey: string;
//         innerSectionKey?: string | null;
//       }
//     > = {};
//     (docsDisplaySection?.innerSections || []).forEach((inner) => {
//       (inner.fields || []).forEach((f) => {
//         const path = `documents.${inner.sectionKey}.${f.key}`;
//         map[path] = {
//           isAdditional: !!f.isAdditional,
//           fieldKey: f.key,
//           innerSectionKey: inner.sectionKey ?? null,
//         };
//       });
//     });
//     return map;
//   }, [docsDisplaySection]);

//   // ⬇️ NEW: build "display" docs section = config + visible additionalFields

//   useEffect(() => {
//     (async () => {
//       try {
//         const [{ data: empRes }, { data: cfgRes }] = await Promise.all([
//           axiosInstance.get(`/employee-profiles/self/get`),
//           axiosInstance.get(`/employee-field-config/profile-config`),
//         ]);

//         const emp = empRes?.data || null;
//         const cfg = cfgRes?.data?.sections || cfgRes?.data || [];
//         setEmployee(emp);
//         setCfgSections(cfg);

//         // 🆕 init docs snapshot for diffing
//         docsSnapshotRef.current = emp?.documents ?? {};
//       } catch (err) {
//         console.error("Failed to fetch profile/config", err);
//         toast.error("Could not load profile.");
//       } finally {
//         setLoading(false);
//       }
//     })();
//   }, [id]);

//   // 🆕: simple modal Promise
//   const openPropagationModal = (overlaps: OrgFieldPreview[]) => {
//     setPropOverlaps(overlaps);
//     setPropModalOpen(true);

//     return new Promise<{
//       action: "apply" | "skip" | "cancel";
//       selected: OrgFieldPreview[];
//     }>((resolve) => {
//       propResolverRef.current = resolve;
//     });
//   };

//   // 🆕: utility: run preview → (optionally) modal → (optionally) apply → then saveFn
//   const ensurePropagationThenSave = async (
//     updatesForPreview: any,
//     saveFn: () => Promise<void>
//   ) => {
//     try {
//       // 1) ask backend what org keys would change (per employee, fieldKey)
//       const { data } = await axiosInstance.post(
//         `/employee-profiles/self/preview-propagation`,
//         { updates: updatesForPreview }
//       );
//       const overlaps: OrgFieldPreview[] = data?.overlaps || [];

//       if (!overlaps.length) {
//         await saveFn();
//         return;
//       }

//       // 2) get user choice
//       const choice = await openPropagationModal(overlaps);
//       if (choice.action === "cancel") return;

//       // 3) apply (if chosen) at fieldKey level
//       if (choice.action === "apply" && choice.selected.length) {
//         const map = buildFieldKeyValueMap(updatesForPreview);

//         const selections = choice.selected
//           .map((o) => ({
//             employeeId: o.employeeId,
//             fieldKey: o.fieldKey,
//             value: map.get(o.fieldKey),
//           }))
//           .filter((s) => s.value !== undefined);

//         if (selections.length) {
//           await axiosInstance.post(
//             `/employee-profiles/self/apply-propagation`,
//             {
//               selections,
//             }
//           );
//         }
//       }

//       // 4) now save the profile changes
//       await saveFn();
//     } catch (e: any) {
//       console.error(e);
//       toast.error(e?.response?.data?.message || "Something went wrong");
//     }
//   };
//   // ------- Documents: initial values (merge additionalFields into documents) -------
//   const buildDocsValuesFromProfile = useCallback((profile: any) => {
//     const base = { ...(profile?.documents || {}) };
//     const adds = Array.isArray(profile?.additionalFields)
//       ? profile.additionalFields
//       : [];

//     for (const a of adds) {
//       // ⬇️ only include visible additions
//       if (a?.sectionKey !== "documents" || a?.isShowInProfile !== true)
//         continue;

//       const path =
//         a?.innerSectionKey && a.innerSectionKey !== null
//           ? `${a.innerSectionKey}.${a.fieldKey}`
//           : `${a.fieldKey}`;

//       const existing = get(base, path);
//       const existingHasUrl =
//         typeof existing === "string"
//           ? !!existing
//           : !!(existing && typeof existing === "object" && existing.url);

//       if (!existingHasUrl && a?.value) {
//         set(base, path, a.value);
//       }
//     }
//     return base;
//   }, []);

//   const docsInitialValues = useMemo(
//     () => ({ documents: buildDocsValuesFromProfile(employee || {}) }),
//     [employee, buildDocsValuesFromProfile]
//   );

//   const docsFormik = useFormik({
//     enableReinitialize: true,
//     initialValues: docsInitialValues,
//     onSubmit: () => {},
//   });

//   // Prefill OR-selection per inner section using config + values (documents + additionalFields)
//   useEffect(() => {
//     if (!docsCfgSection) return;

//     const initial: Record<string, string> = {};
//     const values = docsFormik.values;

//     for (const inner of docsCfgSection.innerSections || []) {
//       if (inner.requirementMode !== "OR") continue;
//       const groupPath = `documents.${inner.sectionKey}`;

//       // find the first field that has a value
//       const chosen = (inner.fields || []).find((f) => {
//         const v = get(values, `${groupPath}.${f.key}`);
//         const has =
//           (typeof v === "string" && !!v) ||
//           (isObject(v) && Object.keys(v).length > 0);
//         return has;
//       });
//       if (chosen) initial[groupPath] = chosen.key;
//     }

//     setSelectedDocuments(initial);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [docsCfgSection, docsFormik.initialValues]);

//   // Debounced autosave: only update the documents subtree
//   // 🆕: Debounced autosave with propagation prompt
//   const rawDocsAutoSave = useCallback(
//     async (values: any) => {
//       const cleaned = deepClean(values || {});
//       const nextDocs = cleaned?.documents || {};
//       const prevDocs = docsSnapshotRef.current || {};
//       const changedDocs = diffDocsSubtree(prevDocs, nextDocs);

//       // nothing changed? do nothing
//       if (isEmptyObject(changedDocs)) return;

//       // Split changes by core vs additional
//       const coreChanged: any = {};
//       const additionalItems: Array<{
//         sectionKey: "documents";
//         innerSectionKey?: string | null;
//         fieldKey: string;
//         value: any;
//       }> = [];

//       Object.entries(changedDocs).forEach(([innerKey, fieldsAny]) => {
//         const fields = fieldsAny as Record<string, any>;
//         Object.entries(fields).forEach(([fieldKey, value]) => {
//           const fullPath = `documents.${innerKey}.${fieldKey}`;
//           const meta = docsPathMeta[fullPath];

//           if (meta?.isAdditional) {
//             additionalItems.push({
//               sectionKey: "documents",
//               innerSectionKey: meta.innerSectionKey ?? innerKey,
//               fieldKey,
//               value,
//             });
//           } else {
//             if (!coreChanged[innerKey]) coreChanged[innerKey] = {};
//             coreChanged[innerKey][fieldKey] = value;
//           }
//         });
//       });

//       // Build one preview payload for both branches (so the modal includes them)
//       const updatesForPreview: any = {};
//       if (!isEmptyObject(coreChanged))
//         updatesForPreview.documents = coreChanged;
//       if (additionalItems.length)
//         updatesForPreview.additionalFields = additionalItems;

//       const doSave = async () => {
//         const calls: Promise<any>[] = [];

//         // Save the whole documents tree (keeps UI in sync)
//         if (!isEmptyObject(coreChanged)) {
//           calls.push(
//             axiosInstance.put(`/employee-profiles/self/update`, {
//               documents: nextDocs,
//             })
//           );
//         }

//         // ✅ Build a merged list of ALL additionalFields (existing + changed)
//         const prevAllAdds = Array.isArray(employee?.additionalFields)
//           ? employee.additionalFields
//           : [];

//         const keyOf = (a: any) =>
//           `${a.sectionKey || ""}::${a.innerSectionKey ?? ""}::${a.fieldKey}`;

//         const map = new Map<string, any>();
//         // seed with everything we already have
//         prevAllAdds.forEach((a) => {
//           map.set(keyOf(a), {
//             sectionKey: a.sectionKey,
//             innerSectionKey: a.innerSectionKey ?? null,
//             fieldKey: a.fieldKey,
//             value: a.value,
//             isAdditional: a.isAdditional ?? true,
//             isShowInProfile: a.isShowInProfile ?? false,
//           });
//         });

//         // overwrite with the newly changed additional document fields
//         additionalItems.forEach((it) => {
//           map.set(
//             keyOf({
//               sectionKey: "documents",
//               innerSectionKey: it.innerSectionKey,
//               fieldKey: it.fieldKey,
//             }),
//             {
//               sectionKey: "documents",
//               innerSectionKey: it.innerSectionKey ?? null,
//               fieldKey: it.fieldKey,
//               value: it.value,
//               isAdditional: true,
//               isShowInProfile: true,
//             }
//           );
//         });

//         // ensure any visible doc-additional fields present in the form but missing in prevAllAdds are included
//         (docsDisplaySection?.innerSections || []).forEach((inner) => {
//           (inner.fields || []).forEach((f) => {
//             if (!f.isAdditional) return;
//             const k = keyOf({
//               sectionKey: "documents",
//               innerSectionKey: inner.sectionKey,
//               fieldKey: f.key,
//             });
//             if (!map.has(k)) {
//               const val = get(nextDocs, `${inner.sectionKey}.${f.key}`);
//               if (!isEmptyValue(val)) {
//                 map.set(k, {
//                   sectionKey: "documents",
//                   innerSectionKey: inner.sectionKey ?? null,
//                   fieldKey: f.key,
//                   value: val,
//                   isAdditional: true,
//                   isShowInProfile: true,
//                 });
//               }
//             }
//           });
//         });

//         const mergedAdditionalFields = Array.from(map.values());

//         // send the full merged array so nothing is lost
//         calls.push(
//           axiosInstance.put(`/employee-profiles/self/update`, {
//             additionalFields: mergedAdditionalFields,
//           })
//         );

//         await Promise.all(calls);

//         // keep local page + snapshot in sync
//         setEmployee((prev: any) => ({
//           ...(prev || {}),
//           documents: nextDocs,
//           additionalFields: mergedAdditionalFields,
//         }));
//         docsSnapshotRef.current = nextDocs;
//       };

//       await ensurePropagationThenSave(updatesForPreview, doSave);
//     },
//     [docsPathMeta, employee, docsDisplaySection]
//   );

//   const docsAutoSave = useDebouncedAutosave(rawDocsAutoSave, 700);

//   /* ---------- Reference options (from config) ---------- */
//   useEffect(() => {
//     const loadRef = async () => {
//       const models = new Set<string>();
//       (cfgSections || []).forEach((s: any) => {
//         (s.fields || []).forEach(
//           (f: any) =>
//             f.type === "reference" &&
//             f.referenceModel &&
//             models.add(f.referenceModel)
//         );
//         (s.innerSections || []).forEach((inn: any) =>
//           (inn.fields || []).forEach(
//             (f: any) =>
//               f.type === "reference" &&
//               f.referenceModel &&
//               models.add(f.referenceModel)
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
//     if (cfgSections.length) loadRef();
//   }, [cfgSections]);

//   /* ---------- Header Card ---------- */
//   const { user: authUser } = useSelector((state: any) => state.auth);
//   const renderTopProfile = () => {
//     const photo = employee?.personaldetails?.employeephoto?.url;
//     const fname = employee?.personaldetails?.firstname;
//     const lname = employee?.personaldetails?.lastname;
//     const location = employee?.personaldetails?.location;
//     const state = employee?.personaldetails?.state;
//     const mobile = employee?.personaldetails?.mobile;
//     const email = authUser?.email;

//     return (
//       <Card className="relative p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200">
//         <div className="flex flex-col sm:flex-row gap-10 items-center sm:items-start">
//           <div className="flex-shrink-0">
//             <div className="w-28 h-28 rounded-full border border-gray-300 bg-gray-100 overflow-hidden shadow">
//               {photo ? (
//                 <Image
//                   src={photo}
//                   alt="Employee Photo"
//                   width={112}
//                   height={112}
//                   className="object-cover w-full h-full"
//                 />
//               ) : (
//                 <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
//                   No Photo
//                 </div>
//               )}
//             </div>
//           </div>

//           <div className="w-full">
//             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-5">
//               <div>
//                 <p className="text-[12px] text-gray-500 font-medium uppercase">
//                   Full Name
//                 </p>
//                 <p className="text-base text-gray-900 font-semibold">
//                   {fname || "—"} {lname || ""}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-[12px] text-gray-500 font-medium uppercase">
//                   Location
//                 </p>
//                 <p className="text-base text-gray-800">
//                   {location && state ? `${location}, ${state}` : "—"}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-[12px] text-gray-500 font-medium uppercase">
//                   Mobile
//                 </p>
//                 <p className="text-base text-gray-800">{mobile || "—"}</p>
//               </div>
//               <div>
//                 <p className="text-[12px] text-gray-500 font-medium uppercase">
//                   Email
//                 </p>
//                 <p className="text-base text-gray-800">{email || "—"}</p>
//               </div>
//             </div>
//           </div>
//         </div>
//       </Card>
//     );
//   };

//   const openDrawerForSection = (section: Section) => {
//     if (section.sectionKey === "address") {
//       const current =
//         Array.isArray(employee?.address) && employee.address.length
//           ? employee.address
//           : [{}];
//       const cleaned = current.map((a: any) => {
//         const copy = { ...a };
//         delete copy.id;
//         delete copy._id;
//         return copy;
//       });
//       setEditingSection(section);
//       setAddressDraft(cleaned);
//       initialDraftRef.current = cleaned; // 👈 baseline
//       setDirty(false); // 👈 reset
//       setDrawerOpen(true);
//       return;
//     }

//     if (section.sectionKey === "documents") return;

//     const d = buildDraftFromSection(employee, section);
//     setEditingSection(section);
//     setDraft(d);
//     initialDraftRef.current = d; // 👈 baseline
//     setDirty(false); // 👈 reset
//     setDrawerOpen(true);
//   };

//   const closeDrawer = () => {
//     setDrawerOpen(false);
//     setEditingSection(null);
//     setDraft({ __inners: {} });
//     setAddressDraft([]);
//   };

//   const saveDrawer = async () => {
//     if (!editingSection) return;
//     setSaving(true);
//     try {
//       const sk = editingSection.sectionKey;
//       const skNorm = (sk || "").toLowerCase();

//       // documents are handled by autosave
//       if (skNorm === "documents") {
//         setSaving(false);
//         return;
//       }

//       let previewUpdates: any = {};
//       let doSave: () => Promise<void>;

//       if (skNorm === "address") {
//         // ✅ keep payload shape
//         const payload = sanitizeAddressArray(addressDraft);
//         previewUpdates = { address: payload };
//         doSave = async () => {
//           await axiosInstance.put(`/employee-profiles/self/update`, {
//             address: payload,
//           });
//         };
//       } else if (
//         skNorm === "personaldetails" ||
//         skNorm === "personal details"
//       ) {
//         // ✅ keep payload shape
//         const payload = sanitizeSectionTree(editingSection, draft);
//         previewUpdates = { [sk]: payload };
//         doSave = async () => {
//           await axiosInstance.put(`/employee-profiles/self/update`, {
//             [sk]: payload,
//           });
//         };
//       } else {
//         // Other sections saved as { sectionKey, items }, DO NOT CHANGE payload
//         const items = extractItemsFromDraft(editingSection, draft);

//         // Preview as additionalFields so backend can match by fieldKey
//         previewUpdates = {
//           additionalFields: items.map(({ fieldKey, value }) => ({
//             fieldKey,
//             value,
//           })),
//         };

//         doSave = async () => {
//           await axiosInstance.put(SAVE_SELF_SECTION_ENDPOINT, {
//             sectionKey: editingSection.sectionKey,
//             items,
//           });
//         };
//       }

//       // Preview → (optionally) apply → save
//       await ensurePropagationThenSave(previewUpdates, doSave);

//       toast.success("Section saved");
//       const { data } = await axiosInstance.get(`/employee-profiles/self/get`);
//       setEmployee(data?.data || null);
//       closeDrawer();
//     } catch (e: any) {
//       console.error(e);
//       toast.error(e?.response?.data?.message || "Failed to save");
//     } finally {
//       setSaving(false);
//     }
//   };

//   /* ---------- Render helpers ---------- */
//   const EMPTY_PLACEHOLDER = <span className="text-sm text-gray-400">—</span>;

//   const renderValue = (f: Field, v: any) => {
//     const Empty = <span className="text-sm text-gray-400">—</span>;

//     if (isEmptyValue(v)) {
//       // checkbox can be blank (unset), still show placeholder
//       if (f.type === "checkbox") return Empty;
//       if (f.type === "file") return Empty;
//       if (f.type === "reference") return Empty;
//       return Empty;
//     }

//     switch (f.type) {
//       case "checkbox":
//         return <span className="text-sm">{v ? "Yes" : "No"}</span>;
//       case "date": {
//         try {
//           const d = new Date(v);
//           return (
//             <span className="text-sm">
//               {isNaN(d.getTime()) ? String(v) : d.toLocaleDateString()}
//             </span>
//           );
//         } catch {
//           return <span className="text-sm">{String(v)}</span>;
//         }
//       }
//       case "file": {
//         const url = typeof v === "string" ? v : v?.url;
//         const name =
//           typeof v === "string"
//             ? v.split("/").pop()
//             : v?.name || (v?.url || "").split("/").pop();
//         return url ? (
//           <a
//             href={url}
//             target="_blank"
//             className="text-blue-600 underline text-sm"
//           >
//             {name || "View"}
//           </a>
//         ) : (
//           Empty
//         );
//       }
//       case "reference":
//         return (
//           <span className="text-sm">
//             {isObject(v) ? v?.name || v?._id || "—" : String(v)}
//           </span>
//         );
//       default:
//         return (
//           <span className="text-sm">
//             {typeof v === "string" ? v : JSON.stringify(v)}
//           </span>
//         );
//     }
//   };

//   // const DrawerField = ({
//   //   field,
//   //   value,
//   //   onChange,
//   // }: {
//   //   field: Field;
//   //   value: any;
//   //   onChange: (v: any) => void;
//   // }) => {
//   //   const Label = (
//   //     <>
//   //       {field.label}
//   //       {field.required && <span className="text-red-500 ml-1">*</span>}
//   //     </>
//   //   );

//   //   switch (field.type) {
//   //     case "number":
//   //       return (
//   //         <Input
//   //           type="number"
//   //           label={Label}
//   //           value={value ?? ""}
//   //           onChange={(e) =>
//   //             onChange(e.target.value === "" ? "" : Number(e.target.value))
//   //           }
//   //         />
//   //       );
//   //     case "checkbox":
//   //       return (
//   //         <div className="pt-6">
//   //           <Checkbox
//   //             label={Label}
//   //             checked={!!value}
//   //             onChange={(e) => onChange(e.target.checked)}
//   //           />
//   //         </div>
//   //       );
//   //     case "date":
//   //       return (
//   //         <Input
//   //           type="date"
//   //           label={Label}
//   //           value={value ? String(value).substring(0, 10) : ""}
//   //           onChange={(e) => onChange(e.target.value || "")}
//   //         />
//   //       );
//   //     case "select":
//   //       return (
//   //         <Select
//   //           label={Label}
//   //           placeholder={field.placeholder}
//   //           value={
//   //             (field.options || [])
//   //               .map((o) => ({ label: o, value: o }))
//   //               .find((opt) => opt.value === value) || null
//   //           }
//   //           onChange={(opt: any) => onChange(opt?.value || "")}
//   //           options={(field.options || []).map((o) => ({
//   //             label: o,
//   //             value: o,
//   //           }))}
//   //         />
//   //       );
//   //     case "reference": {
//   //       const opts = referenceOptions[field.referenceModel || ""] || [];
//   //       return (
//   //         <Select
//   //           label={Label}
//   //           placeholder={field.placeholder}
//   //           value={
//   //             opts.find(
//   //               (opt) =>
//   //                 String(opt.value) ===
//   //                 String(typeof value === "object" ? value?._id : value)
//   //             ) || null
//   //           }
//   //           onChange={(opt: any) => onChange(opt?.value || "")}
//   //           options={opts}
//   //         />
//   //       );
//   //     }
//   //     case "textarea":
//   //       return (
//   //         <Textarea
//   //           label={Label}
//   //           placeholder={field.placeholder}
//   //           value={value ?? ""}
//   //           onChange={(e) => onChange(e.target.value)}
//   //         />
//   //       );
//   //     case "file":
//   //       return (
//   //         <div className="space-y-2">
//   //           <label className="block text-sm font-medium text-gray-700">
//   //             {Label}
//   //           </label>
//   //           {value ? (
//   //             <a
//   //               className="inline-block text-blue-600 underline text-sm"
//   //               target="_blank"
//   //               href={typeof value === "string" ? value : (value as any)?.url}
//   //             >
//   //               View current file
//   //             </a>
//   //           ) : (
//   //             <p className="text-xs text-gray-400">No file uploaded</p>
//   //           )}
//   //           <input
//   //             type="file"
//   //             onChange={async (e) => {
//   //               const f = e.target.files?.[0];
//   //               if (!f) return;
//   //               try {
//   //                 const formData = new FormData();
//   //                 formData.append("file", f);
//   //                 const { data } = await axiosInstance.post(
//   //                   "/uploads",
//   //                   formData,
//   //                   { headers: { "Content-Type": "multipart/form-data" } }
//   //                 );
//   //                 const url = data?.url || data?.data?.url;
//   //                 onChange(url ? { url } : url);
//   //                 toast.success("File uploaded");
//   //               } catch {
//   //                 toast.error("Upload failed");
//   //               }
//   //             }}
//   //           />
//   //         </div>
//   //       );
//   //     default: {
//   //       // text/email/object/unknown -> text
//   //       const typeProp =
//   //         field.type === "email"
//   //           ? "email"
//   //           : field.type === "text"
//   //           ? "text"
//   //           : "text";
//   //       return (
//   //         <Input
//   //           type={typeProp as any}
//   //           label={Label}
//   //           placeholder={field.placeholder}
//   //           value={
//   //             field.type === "object"
//   //               ? typeof value === "string"
//   //                 ? value
//   //                 : JSON.stringify(value ?? "", null, 2)
//   //               : value ?? ""
//   //           }
//   //           onChange={(e) => onChange(e.target.value)}
//   //         />
//   //       );
//   //     }
//   //   }
//   // };

//   // ✅ add this inside EmployeeProfileView (near other hooks)
//   const renderDrawerField = useCallback(
//     (field: Field, value: any, onChange: (v: any) => void) => {
//       const Label = (
//         <>
//           {field.label}
//           {field.required && <span className="text-red-500 ml-1">*</span>}
//         </>
//       );

//       switch (field.type) {
//         case "number":
//           return (
//             <Input
//               type="number"
//               label={Label}
//               value={value ?? ""}
//               onChange={(e) =>
//                 onChange(e.target.value === "" ? "" : Number(e.target.value))
//               }
//             />
//           );
//         case "checkbox":
//           return (
//             <div className="pt-6">
//               <Checkbox
//                 label={Label}
//                 checked={!!value}
//                 onChange={(e) => onChange(e.target.checked)}
//               />
//             </div>
//           );
//         case "date":
//           return (
//             <Input
//               type="date"
//               label={Label}
//               value={value ? String(value).substring(0, 10) : ""}
//               onChange={(e) => onChange(e.target.value || "")}
//             />
//           );
//         case "select":
//           return (
//             <Select
//               label={Label}
//               placeholder={field.placeholder}
//               value={
//                 (field.options || [])
//                   .map((o) => ({ label: o, value: o }))
//                   .find((opt) => opt.value === value) || null
//               }
//               onChange={(opt: any) => onChange(opt?.value || "")}
//               options={(field.options || []).map((o) => ({
//                 label: o,
//                 value: o,
//               }))}
//             />
//           );
//         case "reference": {
//           const opts = referenceOptions[field.referenceModel || ""] || [];
//           return (
//             <Select
//               label={Label}
//               placeholder={field.placeholder}
//               value={
//                 opts.find(
//                   (opt) =>
//                     String(opt.value) ===
//                     String(typeof value === "object" ? value?._id : value)
//                 ) || null
//               }
//               onChange={(opt: any) => onChange(opt?.value || "")}
//               options={opts}
//             />
//           );
//         }
//         case "textarea":
//           return (
//             <Textarea
//               label={Label}
//               placeholder={field.placeholder}
//               value={value ?? ""}
//               onChange={(e) => onChange(e.target.value)}
//             />
//           );
//         case "file":
//           return (
//             <div className="space-y-2">
//               <label className="block text-sm font-medium text-gray-700">
//                 {Label}
//               </label>
//               {value ? (
//                 <a
//                   className="inline-block text-blue-600 underline text-sm"
//                   target="_blank"
//                   href={typeof value === "string" ? value : (value as any)?.url}
//                 >
//                   View current file
//                 </a>
//               ) : (
//                 <p className="text-xs text-gray-400">No file uploaded</p>
//               )}
//               <input
//                 type="file"
//                 onChange={async (e) => {
//                   const f = e.target.files?.[0];
//                   if (!f) return;
//                   try {
//                     const formData = new FormData();
//                     formData.append("file", f);
//                     const { data } = await axiosInstance.post(
//                       "/uploads",
//                       formData,
//                       { headers: { "Content-Type": "multipart/form-data" } }
//                     );
//                     const url = data?.url || data?.data?.url;
//                     onChange(url ? { url } : url);
//                     toast.success("File uploaded");
//                   } catch {
//                     toast.error("Upload failed");
//                   }
//                 }}
//               />
//             </div>
//           );
//         default: {
//           const typeProp =
//             field.type === "email"
//               ? "email"
//               : field.type === "text"
//               ? "text"
//               : "text";
//           return (
//             <Input
//               type={typeProp as any}
//               label={Label}
//               placeholder={field.placeholder}
//               value={
//                 field.type === "object"
//                   ? typeof value === "string"
//                     ? value
//                     : JSON.stringify(value ?? "", null, 2)
//                   : value ?? ""
//               }
//               onChange={(e) => onChange(e.target.value)}
//             />
//           );
//         }
//       }
//     },
//     [referenceOptions]
//   );

//   /* ---------- Render ---------- */
//   if (loading)
//     return <div className="p-6 text-center text-gray-500">Loading...</div>;
//   if (!employee)
//     return (
//       <div className="p-6 text-center text-red-500">No employee found</div>
//     );

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 space-y-10">
//       {renderTopProfile()}

//       <Card className="p-6 shadow-sm border rounded-xl">
//         <Tab>
//           <Tab.List className="flex flex-wrap gap-2 border-b pb-2 mb-6">
//             {sections.map((section) => (
//               <Tab.ListItem
//                 key={section.sectionKey}
//                 className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 transition"
//               >
//                 {section.sectionLabel}
//               </Tab.ListItem>
//             ))}
//           </Tab.List>

//           <Tab.Panels>
//             {sections.map((section) => {
//               // sources for showIf in VIEW: current employee tree
//               const viewSource = employee;

//               return (
//                 <Tab.Panel key={section.sectionKey} className="space-y-8">
//                   <div className="flex items-center justify-between">
//                     <h3 className="text-base font-semibold text-gray-900">
//                       {section.sectionLabel}
//                     </h3>

//                     {section.sectionKey !== "documents" && (
//                       <Button
//                         size="sm"
//                         className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
//                         onClick={() => openDrawerForSection(section)}
//                       >
//                         <PencilIcon className="w-4 h-4" />
//                         Edit
//                       </Button>
//                     )}
//                   </div>

//                   {/* 📄 Documents: EXACT UI + uploading from AcceptInvitation using CONFIG */}
//                   {section.sectionKey === "documents" ? (
//                     <>
//                       {(docsDisplaySection?.innerSections || []).map(
//                         (inner) => {
//                           const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//                           const groupError = get(docsFormik.errors, groupPath);

//                           return (
//                             <div
//                               key={inner.sectionKey}
//                               className="mt-8 border-t border-gray-200 pt-6"
//                             >
//                               <h4 className="text-base font-medium text-gray-700 mb-4">
//                                 {inner.sectionLabel}
//                               </h4>

//                               {typeof groupError === "string" && (
//                                 <div className="text-sm text-red-500 mb-3">
//                                   {String(groupError)}
//                                 </div>
//                               )}

//                               <DocumentSection
//                                 inner={inner}
//                                 sectionKeyPath={groupPath}
//                                 selectedDocuments={selectedDocuments}
//                                 setSelectedDocuments={setSelectedDocuments}
//                                 formik={docsFormik}
//                                 onOpenModal={handleOpenModal}
//                               />
//                             </div>
//                           );
//                         }
//                       )}
//                     </>
//                   ) : section.sectionKey === "address" ? (
//                     // Address view (always shows at least one blank card so empty fields are visible)
//                     (() => {
//                       const addrList =
//                         Array.isArray(employee?.address) &&
//                         employee.address.length
//                           ? employee.address
//                           : [{}]; // at least one blank card so fields show

//                       return (
//                         <div className="space-y-6">
//                           {addrList.map((addr: any, idx: number) => (
//                             <div
//                               key={idx}
//                               className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 border border-gray-200 rounded-xl bg-gray-50"
//                             >
//                               {section.fields
//                                 .filter(
//                                   (f) => f.key !== "id" && f.key !== "_id"
//                                 )
//                                 .map((f) => {
//                                   if (!shouldShow(viewSource, f)) return null;
//                                   const v = addr?.[f.key];
//                                   return (
//                                     <div key={f.key} className="space-y-1">
//                                       <div className="flex gap-4 items-start">
//                                         <p className="w-40 text-sm font-medium text-gray-600 capitalize">
//                                           {f.label}
//                                         </p>
//                                         <div className="flex-1">
//                                           {renderValue(f, v)}
//                                         </div>
//                                       </div>
//                                     </div>
//                                   );
//                                 })}
//                             </div>
//                           ))}
//                         </div>
//                       );
//                     })()
//                   ) : (
//                     // Generic sections (VIEW) with showIf
//                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
//                       {section.fields.map((f) => {
//                         if (!shouldShow(viewSource, f)) return null;
//                         const v = getWithAdditionalFallback(
//                           employee,
//                           section.sectionKey,
//                           f.key
//                         );
//                         return (
//                           <div key={f.key} className="space-y-1">
//                             <div className="flex gap-4 items-start">
//                               <p className="w-40 text-sm font-medium text-gray-600 capitalize">
//                                 {f.label}
//                               </p>
//                               <div className="flex-1">{renderValue(f, v)}</div>
//                             </div>
//                           </div>
//                         );
//                       })}
//                     </div>
//                   )}

//                   {/* Non-docs inner sections (VIEW) with showIf */}
//                   {section.sectionKey !== "documents" &&
//                     section.innerSections.map((inner) => (
//                       <div
//                         key={inner.sectionKey}
//                         className="pt-6 border-t border-gray-100"
//                       >
//                         <div className="flex items-center justify-between mb-4">
//                           <h4 className="text-base font-semibold text-gray-800">
//                             {inner.sectionLabel}
//                           </h4>
//                         </div>
//                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
//                           {inner.fields.map((f) => {
//                             if (!shouldShow(viewSource, f)) return null;
//                             const v = getWithAdditionalFallback(
//                               employee,
//                               section.sectionKey,
//                               f.key,
//                               inner.sectionKey
//                             );
//                             return (
//                               <div key={f.key} className="space-y-1">
//                                 <div className="flex gap-4 items-start">
//                                   <p className="w-40 text-sm font-medium text-gray-600 capitalize">
//                                     {f.label}
//                                   </p>
//                                   <div className="flex-1">
//                                     {renderValue(f, v)}
//                                   </div>
//                                 </div>
//                               </div>
//                             );
//                           })}
//                         </div>
//                       </div>
//                     ))}
//                 </Tab.Panel>
//               );
//             })}
//           </Tab.Panels>
//         </Tab>
//       </Card>

//       {/* Drawer (for non-doc sections) */}
//       <Transition.Root show={drawerOpen} as={Fragment}>
//         <Dialog as="div" onClose={() => {}} className="relative z-50">
//           <Transition.Child
//             as={Fragment}
//             enter="ease-out duration-200"
//             enterFrom="opacity-0"
//             enterTo="opacity-100"
//             leave="ease-in duration-150"
//             leaveFrom="opacity-100"
//             leaveTo="opacity-0"
//           >
//             <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
//           </Transition.Child>

//           <div className="fixed inset-0 overflow-hidden">
//             <div className="absolute inset-0 overflow-hidden">
//               <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
//                 <Transition.Child
//                   as={Fragment}
//                   enter="transform transition ease-in-out duration-300"
//                   enterFrom="translate-x-full"
//                   enterTo="translate-x-0"
//                   leave="transform transition ease-in-out duration-200"
//                   leaveFrom="translate-x-0"
//                   leaveTo="translate-x-full"
//                 >
//                   <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
//                     <div className="flex h-full flex-col bg-white shadow-xl">
//                       {/* Header */}
//                       <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b px-6 py-4">
//                         <div className="flex items-center justify-between gap-3">
//                           <div>
//                             <Dialog.Title className="text-base font-semibold text-gray-900">
//                               {editingSection?.sectionLabel}
//                             </Dialog.Title>
//                             <p className="mt-0.5 text-xs text-gray-500">
//                               Changes in this drawer are{" "}
//                               <span className="font-semibold">
//                                 not auto-saved
//                               </span>
//                               . Click{" "}
//                               <span className="font-semibold">Save</span>
//                             </p>
//                           </div>

//                           <div className="flex items-center gap-3">
//                             <span
//                               className={[
//                                 "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
//                                 dirty
//                                   ? "bg-amber-100 text-amber-800"
//                                   : "bg-emerald-100 text-emerald-700",
//                               ].join(" ")}
//                             >
//                               {dirty ? "Unsaved changes" : "All changes saved"}
//                             </span>
//                             <button
//                               onClick={safeCloseDrawer}
//                               className="rounded-md p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
//                               aria-label="Close"
//                             >
//                               <XMarkIcon className="w-5 h-5" />
//                             </button>
//                           </div>
//                         </div>
//                       </div>

//                       {/* Body */}
//                       <div
//                         className="flex-1 overflow-y-auto px-6 py-6"
//                         onKeyDownCapture={(e) => e.stopPropagation()}
//                         onKeyUpCapture={(e) => e.stopPropagation()}
//                         onMouseDownCapture={(e) => e.stopPropagation()}
//                       >
//                         {editingSection?.sectionKey === "address" ? (
//                           <div className="space-y-6">
//                             {addressDraft.map((address, index) => (
//                               <Card
//                                 key={index}
//                                 className="relative border border-gray-200 shadow-sm p-0 overflow-hidden"
//                               >
//                                 <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
//                                   <div className="w-full px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50">
//                                     <div className="relative">
//                                       <input
//                                         type="text"
//                                         className="peer block w-full px-4 pt-5 pb-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-transparent"
//                                         placeholder="e.g., Home, Office"
//                                         value={address?.addressFor || ""}
//                                         onChange={(e) => {
//                                           const updated = [...addressDraft];
//                                           updated[index] = {
//                                             ...updated[index],
//                                             addressFor: e.target.value,
//                                           };
//                                           setAddressDraft(updated);
//                                         }}
//                                       />
//                                       <label className="absolute left-4 top-2 text-xs font-semibold text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold">
//                                         Address Label (e.g., Home, Office)
//                                       </label>
//                                     </div>
//                                   </div>

//                                   {addressDraft.length > 1 && (
//                                     <button
//                                       type="button"
//                                       onClick={() => {
//                                         const next = addressDraft.filter(
//                                           (_, i) => i !== index
//                                         );
//                                         setAddressDraft(next);
//                                       }}
//                                       className="ml-4 text-red-500 hover:text-red-600 text-xs"
//                                     >
//                                       Remove
//                                     </button>
//                                   )}
//                                 </div>

//                                 <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
//                                   {editingSection.fields
//                                     .filter(
//                                       (f) =>
//                                         f.key !== "addressFor" &&
//                                         f.key !== "id" &&
//                                         f.key !== "_id"
//                                     )
//                                     .map((field) => (
//                                       <Input
//                                         key={`address[${index}].${field.key}`}
//                                         label={field.label}
//                                         placeholder={field.label}
//                                         value={
//                                           addressDraft[index]?.[field.key] || ""
//                                         }
//                                         onChange={(e) => {
//                                           const updated = [...addressDraft];
//                                           updated[index] = {
//                                             ...updated[index],
//                                             [field.key]: e.target.value,
//                                           };
//                                           setAddressDraft(updated);
//                                         }}
//                                       />
//                                     ))}
//                                 </div>
//                               </Card>
//                             ))}

//                             <Button
//                               variant="outline"
//                               onClick={() =>
//                                 setAddressDraft((prev) => [...prev, {}])
//                               }
//                             >
//                               + Add Address
//                             </Button>
//                           </div>
//                         ) : (
//                           <>
//                             {/* Top-level fields with showIf */}
//                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                               {editingSection?.fields
//                                 .filter((f) =>
//                                   shouldShow(
//                                     draftToTree(editingSection!, draft),
//                                     f
//                                   )
//                                 )
//                                 .map((f) => (
//                                   <div key={`top.${f.key}`}>
//                                     {renderDrawerField(f, draft[f.key], (v) =>
//                                       setDraft((d) => ({ ...d, [f.key]: v }))
//                                     )}
//                                   </div>
//                                 ))}
//                             </div>

//                             {/* Inner sections with showIf */}
//                             {editingSection?.innerSections?.map((inn) => (
//                               <div
//                                 key={inn.sectionKey}
//                                 className="mt-8 border-t pt-6"
//                               >
//                                 <h4 className="text-sm font-semibold text-gray-800 mb-4">
//                                   {inn.sectionLabel}
//                                 </h4>
//                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                                   {inn.fields
//                                     .filter((f) =>
//                                       shouldShow(
//                                         draftToTree(editingSection!, draft),
//                                         f
//                                       )
//                                     )
//                                     .map((f) => (
//                                       <div
//                                         key={`inner.${inn.sectionKey}.${f.key}`}
//                                       >
//                                         {renderDrawerField(
//                                           f,
//                                           draft.__inners?.[inn.sectionKey]?.[
//                                             f.key
//                                           ],
//                                           (v) =>
//                                             setDraft((d) => ({
//                                               ...d,
//                                               __inners: {
//                                                 ...(d.__inners || {}),
//                                                 [inn.sectionKey]: {
//                                                   ...(d.__inners?.[
//                                                     inn.sectionKey
//                                                   ] || {}),
//                                                   [f.key]: v,
//                                                 },
//                                               },
//                                             }))
//                                         )}
//                                       </div>
//                                     ))}
//                                 </div>
//                               </div>
//                             ))}
//                           </>
//                         )}
//                       </div>

//                       {/* Footer */}
//                       <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur border-t px-6 py-4">
//                         <div className="flex justify-end items-center gap-3">
//                           <Button
//                             variant="outline"
//                             onClick={safeCloseDrawer}
//                             disabled={saving}
//                           >
//                             Cancel
//                           </Button>
//                           <Button
//                             onClick={saveDrawer}
//                             disabled={saving || !dirty}
//                           >
//                             {saving ? "Saving…" : "Save"}
//                           </Button>
//                         </div>
//                       </div>
//                     </div>
//                   </Dialog.Panel>
//                 </Transition.Child>
//               </div>
//             </div>
//           </div>
//         </Dialog>
//       </Transition.Root>

//       {/* Documents upload modal (same as AcceptInvitation) */}
//       {activeUploadField && (
//         <DocumentUploadModal
//           isOpen={modalOpen}
//           onClose={() => setModalOpen(false)}
//           field={activeUploadField.field}
//           fullPath={activeUploadField.fullPath}
//           formik={docsFormik}
//           autoSave={docsAutoSave}
//         />
//       )}

//       {/* 🆕 Propagation consent modal */}
//       <PropagationConsentModal
//         open={propModalOpen}
//         overlaps={propOverlaps}
//         confirming={false}
//         onClose={() => {
//           setPropModalOpen(false);
//           const r = propResolverRef.current;
//           propResolverRef.current = null;
//           r?.({ action: "cancel", selected: [] });
//         }}
//         onSkip={() => {
//           setPropModalOpen(false);
//           const r = propResolverRef.current;
//           propResolverRef.current = null;
//           r?.({ action: "skip", selected: [] });
//         }}
//         onConfirm={(selected) => {
//           setPropModalOpen(false);
//           const r = propResolverRef.current;
//           propResolverRef.current = null;
//           r?.({ action: "apply", selected });
//         }}
//       />
//     </div>
//   );
// }

"use client";

import {
  useEffect,
  useMemo,
  useState,
  Fragment,
  useCallback,
  useRef,
} from "react";
import { useParams } from "next/navigation";
import { Tab, Button, Input, Select, Checkbox, Textarea } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import Image from "next/image";
import { Card } from "@/app/components/ui/Card";
import { PencilIcon, XMarkIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useSelector } from "react-redux";
import { Dialog, Transition } from "@headlessui/react";
import toast from "react-hot-toast";
import { useFormik } from "formik";
import get from "lodash/get";
import set from "lodash/set";

// ✅ AcceptInvitation-style components/flows
import DocumentUploadModal from "../../components/shared/DocumentUploadModal";
import DocumentSection from "../../components/ui/DocumentSection";
import { useDebouncedAutosave } from "@/app/hooks/useDebouncedAutosave";
import { deepClean } from "@/app/utils/profile-utils";
import PropagationConsentModal from "../PropagationConsentModal";

/* =============================
   Types
   ============================= */
type Field = {
  key: string;
  label: string;
  type:
    | "text"
    | "email"
    | "number"
    | "checkbox"
    | "date"
    | "file"
    | "reference"
    | "select"
    | "textarea"
    | "object"
    | "unknown";
  options?: string[]; // for select
  referenceModel?: string; // for reference
  placeholder?: string;
  required?: boolean;
  isAdditional?: boolean;
  showIf?: {
    fieldKey: string;
    operator: "equals" | "notEquals";
    value: any;
  };
};

type FileRef = {
  fileId?: string;
  key?: string;
  issuingDate?: string;
  expiryDate?: string;
  referenceNumber?: string;
  points?: number;
  // legacy support
  url?: string;
  name?: string;
};

type InnerSection = {
  sectionKey: string;
  sectionLabel: string;
  fields: Field[];
  requirementMode?: "AND" | "OR";
};

type Section = {
  sectionKey: string;
  sectionLabel: string;
  fields: Field[];
  innerSections: InnerSection[];
};

/* =============================
   Utils
   ============================= */

// Hide specific fields per section (keys are raw schema keys)
const HIDDEN_FIELDS: Record<string, Set<string>> = {
  personaldetails: new Set(["employeephoto"]),
};

const isHiddenField = (sectionKey: string, fieldKey: string) => {
  const k = (sectionKey || "").toLowerCase().replace(/\s+/g, "");
  return HIDDEN_FIELDS[k]?.has(fieldKey) ?? false;
};

const prettyLabel = (k: string) =>
  k
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

const isObject = (v: any) => v && typeof v === "object" && !Array.isArray(v);
const isEmptyObject = (v: any) => isObject(v) && Object.keys(v).length === 0;
const isEmptyValue = (v: any) =>
  v === null ||
  v === undefined ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  isEmptyObject(v);

// file-ish detectors
const isFileRef = (v: any): v is FileRef =>
  v && typeof v === "object" && (("fileId" in v && "key" in v) || "url" in v);

// type guesser (kept)
const guessType = (v: any): Field["type"] => {
  if (typeof v === "boolean") return "checkbox";
  if (typeof v === "number") return "number";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v) || !isNaN(Date.parse(v))) return "date";
    return "text";
  }
  if (isObject(v)) {
    if (isFileRef(v)) return "file";
    if ("_id" in v || "name" in v) return "reference";
    return "object";
  }
  return "unknown";
};

// visible additional field fallback (non-docs view)
const getWithAdditionalFallback = (
  profile: any,
  sectionKey: string,
  fieldKey: string,
  innerKey?: string
) => {
  const mainVal = innerKey
    ? profile?.[sectionKey]?.[innerKey]?.[fieldKey]
    : profile?.[sectionKey]?.[fieldKey];

  if (!isEmptyValue(mainVal)) return mainVal;

  const found = (profile?.additionalFields || []).find(
    (f: any) =>
      f.sectionKey === sectionKey &&
      f.fieldKey === fieldKey &&
      (innerKey ? f.innerSectionKey === innerKey : !f.innerSectionKey) &&
      f.isShowInProfile === true
  );
  return found?.value;
};

// 🔧 Address helpers
const sanitizeAddressArray = (arr: any[]): any[] => {
  return (arr || [])
    .map((addr) => {
      if (!isObject(addr)) return {};
      const out: Record<string, any> = {};
      Object.keys(addr).forEach((k) => {
        if (k === "id" || k === "_id") return;
        const v = addr[k];
        if (!isEmptyValue(v)) out[k] = v;
      });
      return out;
    })
    .filter((obj) => !isEmptyObject(obj));
};

const sanitizeSectionTree = (section: Section, draft: DraftShape) => {
  const out: Record<string, any> = {};

  // top-level fields
  for (const f of section.fields) {
    const v = draft[f.key];
    if (!isEmptyValue(v)) out[f.key] = v;
  }

  // inner sections
  for (const inn of section.innerSections || []) {
    const group = draft.__inners?.[inn.sectionKey] || {};
    const groupOut: Record<string, any> = {};
    for (const f of inn.fields) {
      const v = group[f.key];
      if (!isEmptyValue(v)) groupOut[f.key] = v;
    }
    if (!isEmptyObject(groupOut)) out[inn.sectionKey] = groupOut;
  }

  return out;
};

// 🆕: types for propagation preview/apply
// 🆕 keep in sync with backend
type PropTarget =
  | { kind: "path"; employeePath: string }
  | { kind: "additionalField"; fieldKey: string };

type PropOverlap = {
  employeeId: string;
  tenantId: string;
  branchId: string;
  tenantName?: string;
  branchName?: string;
  fieldKey: string;
  profilePath: string;
  newValue: any;
  oldValue: any;
  sectionKey?: string;
  innerSectionKey?: string | null;
  target: PropTarget;
};

// 🆕: deepEqual (tiny fast)
const deepEqualFast = (a: any, b: any) => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

// 🆕: diff only changed document fields (so preview stays small)
const diffDocsSubtree = (prev: any = {}, next: any = {}) => {
  const groups = [
    "identificationdocuments",
    "certificates",
    "checksandclearance",
  ] as const;

  const out: any = {};
  for (const grp of groups) {
    const p = prev?.[grp] || {};
    const n = next?.[grp] || {};
    const grpOut: any = {};
    const keys = new Set([...Object.keys(p), ...Object.keys(n)]);
    for (const k of keys) {
      if (!deepEqualFast(p[k], n[k])) {
        grpOut[k] = n[k];
      }
    }
    if (Object.keys(grpOut).length) out[grp] = grpOut;
  }
  return out;
};

// Build sections from profile (for non-docs view); documents come from config
const deriveSectionsFromProfile = (profile: any): Section[] => {
  if (!profile || typeof profile !== "object") return [];

  const EXCLUDE = new Set([
    "userId",
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "additionalFields",
    "designation",
  ]);

  const sections: Section[] = [];
  const topKeys = Object.keys(profile).filter((k) => !EXCLUDE.has(k));

  for (const sectionKey of topKeys) {
    const sectionVal = profile[sectionKey];

    if (sectionKey === "address" && Array.isArray(sectionVal)) {
      const first = sectionVal[0] || {};
      const fields: Field[] = Object.keys(first)
        .filter((fk) => fk !== "id" && fk !== "_id")
        .map((fk) => ({
          key: fk,
          label: prettyLabel(fk),
          type: guessType(first[fk]),
        }));
      sections.push({
        sectionKey,
        sectionLabel: prettyLabel(sectionKey),
        fields,
        innerSections: [],
      });
      continue;
    }

    if (isObject(sectionVal)) {
      const fields: Field[] = [];
      const innerSections: InnerSection[] = [];

      for (const key of Object.keys(sectionVal)) {
        const val = sectionVal[key];

        if (
          isObject(val) &&
          !isFileRef(val) &&
          !("_id" in val) &&
          !("name" in val)
        ) {
          const innerFields: Field[] = Object.keys(val).map((ik) => ({
            key: ik,
            label: prettyLabel(ik),
            type: guessType(val[ik]),
          }));
          innerSections.push({
            sectionKey: key,
            sectionLabel: prettyLabel(key),
            fields: innerFields,
          });
        } else {
          fields.push({
            key,
            label: prettyLabel(key),
            type: guessType(val),
          });
        }
      }

      // fold in visible additionalFields
      const adds: any[] = profile?.additionalFields || [];
      const addsForSection = adds.filter(
        (a) => a.sectionKey === sectionKey && a.isShowInProfile === true
      );

      for (const add of addsForSection.filter((a) => !a.innerSectionKey)) {
        if (!fields.some((f) => f.key === add.fieldKey)) {
          fields.push({
            key: add.fieldKey,
            label: prettyLabel(add.fieldKey),
            type: guessType(add.value),
          });
        }
      }

      const innerGroups: Record<string, Field[]> = {};
      for (const add of addsForSection.filter((a) => a.innerSectionKey)) {
        const ikey = add.innerSectionKey as string;
        if (!innerGroups[ikey]) innerGroups[ikey] = [];
        if (!innerGroups[ikey].some((f) => f.key === add.fieldKey)) {
          innerGroups[ikey].push({
            key: add.fieldKey,
            label: prettyLabel(add.fieldKey),
            type: guessType(add.value),
          });
        }
      }
      for (const [ikey, extraFields] of Object.entries(innerGroups)) {
        const existing = innerSections.find((i) => i.sectionKey === ikey);
        if (existing) {
          for (const ef of extraFields) {
            if (!existing.fields.some((f) => f.key === ef.key)) {
              existing.fields.push(ef);
            }
          }
        } else {
          innerSections.push({
            sectionKey: ikey,
            sectionLabel: prettyLabel(ikey),
            fields: extraFields,
          });
        }
      }

      sections.push({
        sectionKey,
        sectionLabel: prettyLabel(sectionKey),
        fields,
        innerSections,
      });
    } else {
      sections.push({
        sectionKey,
        sectionLabel: prettyLabel(sectionKey),
        fields: [
          {
            key: sectionKey,
            label: prettyLabel(sectionKey),
            type: guessType(sectionVal),
          },
        ],
        innerSections: [],
      });
    }
  }

  const weight = (k: string) => {
    const n = k.toLowerCase();
    if (n.includes("personal")) return 0;
    if (n.includes("document")) return 1;
    if (n.includes("bank")) return 2;
    if (n.includes("address")) return 3;
    return 10;
  };
  sections.sort((a, b) => weight(a.sectionKey) - weight(b.sectionKey));

  return sections;
};

// put near deriveSectionsFromProfile
const buildDisplaySections = (profile: any, cfg: any[]): Section[] => {
  // 1) Normalize config into Section[]
  const cfgSectionsNorm: Section[] = (cfg || []).map((s: any) => ({
    sectionKey: s.sectionKey,
    sectionLabel: s.sectionLabel ?? prettyLabel(s.sectionKey),
    fields: (s.fields || []).map((f: any) => ({
      key: f.key,
      label: f.label ?? prettyLabel(f.key),
      type: f.type,
      options: f.options,
      referenceModel: f.referenceModel,
      placeholder: f.placeholder,
      required: f.required,
      isAdditional: f.isAdditional,
      showIf: f.showIf,
    })),
    innerSections: (s.innerSections || []).map((inn: any) => ({
      sectionKey: inn.sectionKey,
      sectionLabel: inn.sectionLabel ?? prettyLabel(inn.sectionKey),
      requirementMode: inn.requirementMode,
      fields: (inn.fields || []).map((f: any) => ({
        key: f.key,
        label: f.label ?? prettyLabel(f.key),
        type: f.type,
        options: f.options,
        referenceModel: f.referenceModel,
        placeholder: f.placeholder,
        required: f.required,
        isAdditional: f.isAdditional,
        showIf: f.showIf,
      })),
    })),
  }));

  // 2) Derive sections from profile to scoop up extras
  const profSections = deriveSectionsFromProfile(profile);

  // 3) Union: start with config, then add any profile-only fields
  const map = new Map<string, Section>();
  cfgSectionsNorm.forEach((s) => map.set(s.sectionKey, { ...s }));

  const upsertField = (list: Field[], f: Field) => {
    if (!list.some((x) => x.key === f.key)) list.push(f);
  };

  profSections.forEach((ps) => {
    const target =
      map.get(ps.sectionKey) ||
      ({
        sectionKey: ps.sectionKey,
        sectionLabel: ps.sectionLabel,
        fields: [],
        innerSections: [],
      } as Section);

    ps.fields.forEach((f) =>
      upsertField(target.fields, {
        ...f,
        label: target.fields.find((x) => x.key === f.key)?.label ?? f.label,
        type: target.fields.find((x) => x.key === f.key)?.type ?? f.type,
      })
    );

    ps.innerSections.forEach((pin) => {
      const tin =
        target.innerSections.find((x) => x.sectionKey === pin.sectionKey) ||
        (() => {
          const n: InnerSection = {
            sectionKey: pin.sectionKey,
            sectionLabel: pin.sectionLabel,
            fields: [],
          };
          target.innerSections.push(n);
          return n;
        })();

      pin.fields.forEach((f) =>
        upsertField(tin.fields, {
          ...f,
          label: tin.fields.find((x) => x.key === f.key)?.label ?? f.label,
          type: tin.fields.find((x) => x.key === f.key)?.type ?? f.type,
        })
      );
    });

    map.set(ps.sectionKey, target);
  });

  // 4) Order
  const cfgOrder = cfgSectionsNorm.map((s) => s.sectionKey);
  const leftovers = Array.from(map.values()).filter(
    (s) => !cfgOrder.includes(s.sectionKey)
  );
  const weight = (k: string) => {
    const n = k.toLowerCase();
    if (n.includes("personal")) return 0;
    if (n.includes("document")) return 1;
    if (n.includes("bank")) return 2;
    if (n.includes("address")) return 3;
    return 10;
  };
  leftovers.sort((a, b) => weight(a.sectionKey) - weight(b.sectionKey));

  return [...cfgOrder.map((k) => map.get(k)!), ...leftovers];
};

/* =============================
   Drawer helpers (showIf + render)
   ============================= */
type DraftShape = {
  [k: string]: any;
  __inners?: Record<string, Record<string, any>>;
};

const SAVE_SELF_SECTION_ENDPOINT = `/employee-profiles/self/update`;

const buildDraftFromSection = (employee: any, section: Section): DraftShape => {
  const d: DraftShape = { __inners: {} };

  for (const f of section.fields) {
    if (isHiddenField(section.sectionKey, f.key)) continue;
    d[f.key] =
      getWithAdditionalFallback(employee, section.sectionKey, f.key) ??
      (f.type === "checkbox" ? false : "");
  }

  for (const inn of section.innerSections || []) {
    d.__inners![inn.sectionKey] = {};
    for (const f of inn.fields) {
      if (isHiddenField(section.sectionKey, f.key)) continue;
      d.__inners![inn.sectionKey][f.key] =
        getWithAdditionalFallback(
          employee,
          section.sectionKey,
          f.key,
          inn.sectionKey
        ) ?? (f.type === "checkbox" ? false : "");
    }
  }

  return d;
};

const extractItemsFromDraft = (section: Section, draft: DraftShape) => {
  const items: Array<{
    fieldKey: string;
    value: any;
    innerSectionKey?: string;
  }> = [];

  for (const f of section.fields) {
    if (Object.prototype.hasOwnProperty.call(draft, f.key)) {
      items.push({ fieldKey: f.key, value: draft[f.key] });
    }
  }
  for (const inn of section.innerSections || []) {
    const group = draft.__inners?.[inn.sectionKey] || {};
    for (const f of inn.fields) {
      if (Object.prototype.hasOwnProperty.call(group, f.key)) {
        items.push({
          innerSectionKey: inn.sectionKey,
          fieldKey: f.key,
          value: group[f.key],
        });
      }
    }
  }
  return items;
};

// turn draft into a simple tree so showIf can find values by key easily
const draftToTree = (section: Section, draft: DraftShape) => {
  const tree: any = { [section.sectionKey]: {} };
  for (const f of section.fields) {
    tree[section.sectionKey][f.key] = draft[f.key];
  }
  for (const inn of section.innerSections || []) {
    tree[section.sectionKey][inn.sectionKey] = {
      ...(draft.__inners?.[inn.sectionKey] || {}),
    };
  }
  return tree;
};

const findValueInTree = (obj: any, key: string): any => {
  if (!obj || typeof obj !== "object") return undefined;
  if (key in obj) return obj[key];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object") {
      const found = findValueInTree(v, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
};

const shouldShow = (source: any, field: Field): boolean => {
  if (!field?.showIf) return true;
  const actual = findValueInTree(source, field.showIf.fieldKey);
  return field.showIf.operator === "equals"
    ? actual === field.showIf.value
    : actual !== field.showIf.value;
};

/* =============================
   Signed preview helpers (NEW)
   ============================= */

function usePreviewUrl(fileId?: string) {
  const [url, setUrl] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!fileId) return;
    try {
      // Ensure fileId is a string (convert ObjectId to string if needed)
      const fileIdString = String(fileId);
      const { data } = await axiosInstance.get<{
        url: string;
        expiresIn: number;
      }>(`/uploads/${fileIdString}/url`);
      setUrl(data?.url || null);
    } catch {
      setUrl(null);
    }
  }, [fileId]);

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    refresh();
    // optional: auto-refresh near expiry if you want:
    // const t = setInterval(refresh, 8000);
    // return () => clearInterval(t);
  }, [fileId, refresh]);

  return { url, refresh };
}

function FilePreviewLink({ value }: { value: FileRef | string }) {
  // Legacy string URL
  if (typeof value === "string") {
    const name = value.split("/").pop();
    return (
      <a
        href={value}
        target="_blank"
        className="text-blue-600 underline text-sm"
      >
        {name || "View"}
      </a>
    );
  }

  // New fileRef
  if (value?.fileId && value?.key) {
    const { url, refresh } = usePreviewUrl(value.fileId);
    const label =
      value?.referenceNumber ||
      value?.name ||
      (value?.key ? value.key.split("/").pop() : "View");

    if (!url) {
      return (
        <button
          className="text-blue-600 underline text-sm"
          onClick={() => refresh()}
          type="button"
        >
          Load preview
        </button>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        className="text-blue-600 underline text-sm"
        onClick={(e) => {
          // if user clicks after it expired, try to refresh
          setTimeout(() => {
            // best-effort refresh for next click
            refresh();
          }, 0);
        }}
      >
        {label || "View"}
      </a>
    );
  }

  // Legacy object with url
  if ((value as any)?.url) {
    const u = (value as any).url as string;
    const name = u.split("/").pop();
    return (
      <a href={u} target="_blank" className="text-blue-600 underline text-sm">
        {name || "View"}
      </a>
    );
  }

  return <span className="text-sm text-gray-400">—</span>;
}

/* =============================
   Component
   ============================= */

// 🆕: types used later
type DraftShape = {
  [k: string]: any;
  __inners?: Record<string, Record<string, any>>;
};

type OrgFieldPreview = {
  employeeId: string;
  tenantId: string;
  branchId: string;
  tenantName?: string;
  branchName?: string;
  fieldKey: string;
  occurrences?: number;
};

// 🆕: deep compare
const deepEqual = (a: any, b: any) => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export default function EmployeeProfileView() {
  const { user } = useSelector((state: any) => state.auth);
  const { id } = useParams(); // kept for consistency

  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [draft, setDraft] = useState<DraftShape>({ __inners: {} });
  const [saving, setSaving] = useState(false);
  // 🔧 Address: dedicated draft
  const [addressDraft, setAddressDraft] = useState<any[]>([]);

  const [dirty, setDirty] = useState(false);
  const initialDraftRef = useRef<any>(null);

  // 🆕: Propagation modal state
  const [propModalOpen, setPropModalOpen] = useState(false);
  const [propOverlaps, setPropOverlaps] = useState<OrgFieldPreview[]>([]);
  const propResolverRef = useRef<
    | null
    | ((result: {
        action: "apply" | "skip" | "cancel";
        selected: OrgFieldPreview[];
      }) => void)
  >(null);

  // 🆕: Keep a snapshot of last-saved documents to compute diffs for preview
  const docsSnapshotRef = useRef<any>({});

  const safeCloseDrawer = () => {
    if (saving) return;
    if (dirty && !confirm("Discard unsaved changes?")) return;
    closeDrawer();
  };

  // Track dirty state against the snapshot taken when opening the drawer
  useEffect(() => {
    if (!drawerOpen) return;
    const baseline = initialDraftRef.current;
    const current =
      editingSection?.sectionKey === "address" ? addressDraft : draft;
    setDirty(!deepEqual(current, baseline));
  }, [drawerOpen, editingSection, draft, addressDraft]);

  // Cmd/Ctrl + S to save while drawer is open
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const metaS = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s";
      if (metaS) {
        e.preventDefault();
        if (!saving && dirty) saveDrawer();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        safeCloseDrawer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, saving, dirty]);

  // ⚙️ field-config sections from API
  const [cfgSections, setCfgSections] = useState<Section[]>([]);

  // reference dropdown options for reference fields
  const [referenceOptions, setReferenceOptions] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  // ---- Documents: AcceptInvitation-like state ----
  const [modalOpen, setModalOpen] = useState(false);
  const [activeUploadField, setActiveUploadField] = useState<any>(null);
  const handleOpenModal = (field: any, fullPath: string) => {
    setActiveUploadField({ field, fullPath });
    setModalOpen(true);
  };
  const [selectedDocuments, setSelectedDocuments] = useState<
    Record<string, string>
  >({}); // OR groups

  /* ---------- Config overlay ---------- */
  const applyConfigOverlay = (
    baseSections: Section[],
    cfg: any[]
  ): Section[] => {
    const cfgBySection = new Map<string, any>(
      (cfg || []).map((s: any) => [s.sectionKey, s])
    );

    return baseSections.map((sec) => {
      const cfgSec = cfgBySection.get(sec.sectionKey);

      const patchedFields = sec.fields.map((f) => {
        const cf = cfgSec?.fields?.find((x: any) => x.key === f.key);
        if (!cf) return f;
        return {
          ...f,
          label: cf.label ?? f.label,
          type: (cf.type as Field["type"]) ?? f.type,
          placeholder: cf.placeholder ?? f.placeholder,
          required: cf.required ?? f.required,
          options: cf.options ?? f.options,
          referenceModel: cf.referenceModel ?? f.referenceModel,
          showIf: cf.showIf ?? f.showIf,
          isAdditional: cf.isAdditional ?? f.isAdditional,
        };
      });

      const patchedInner = (sec.innerSections || []).map((inn) => {
        const ci = cfgSec?.innerSections?.find(
          (x: any) => x.sectionKey === inn.sectionKey
        );

        const patchedInnerFields = inn.fields.map((f) => {
          const cf = ci?.fields?.find((x: any) => x.key === f.key);
          if (!cf) return f;
          return {
            ...f,
            label: cf.label ?? f.label,
            type: (cf.type as Field["type"]) ?? f.type,
            placeholder: cf.placeholder ?? f.placeholder,
            required: cf.required ?? f.required,
            options: cf.options ?? f.options,
            referenceModel: cf.referenceModel ?? f.referenceModel,
            showIf: cf.showIf ?? f.showIf,
            isAdditional: cf.isAdditional ?? f.isAdditional,
          };
        });

        return {
          ...inn,
          sectionLabel: ci?.sectionLabel ?? inn.sectionLabel,
          requirementMode: ci?.requirementMode ?? inn.requirementMode,
          fields: patchedInnerFields,
        };
      });

      return {
        ...sec,
        sectionLabel: cfgSec?.sectionLabel ?? sec.sectionLabel,
        fields: patchedFields,
        innerSections: patchedInner,
      };
    });
  };

  // Fetch employee + field config together
  useEffect(() => {
    (async () => {
      try {
        const [{ data: empRes }, { data: cfgRes }] = await Promise.all([
          axiosInstance.get(`/employee-profiles/self/get`),
          axiosInstance.get(`/employee-field-config/profile-config`),
        ]);

        const emp = empRes?.data || null;
        const cfg = cfgRes?.data?.sections || cfgRes?.data || [];
        setEmployee(emp);
        setCfgSections(cfg);
      } catch (err) {
        console.error("Failed to fetch profile/config", err);
        toast.error("Could not load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Build sections (config-first), overlaying any hints from profile
  const sections = useMemo<Section[]>(() => {
    const base = buildDisplaySections(employee || {}, cfgSections);

    // Remove hidden fields from sections (so they never render/edit)
    return base.map((s) => {
      const cleaned: Section = {
        ...s,
        fields: (s.fields || []).filter(
          (f) => !isHiddenField(s.sectionKey, f.key)
        ),
        innerSections: (s.innerSections || []).map((inn) => ({
          ...inn,
          fields: (inn.fields || []).filter(
            (f) => !isHiddenField(s.sectionKey, f.key)
          ),
        })),
      };
      return cleaned;
    });
  }, [employee, cfgSections]);

  // Docs config section (from API)
  const docsCfgSection: Section | null = useMemo(() => {
    return (
      (cfgSections || []).find((s) => s.sectionKey === "documents") || null
    );
  }, [cfgSections]);

  const docsDisplaySection: Section | null = useMemo(() => {
    if (!docsCfgSection) return null;

    const clone: Section = {
      ...docsCfgSection,
      innerSections: [...(docsCfgSection.innerSections || [])].map((inn) => ({
        ...inn,
        fields: [...(inn.fields || [])],
      })),
    };

    // include visible additional document fields
    const VISIBLE_DOC_ADDS = (employee?.additionalFields || []).filter(
      (a: any) => a?.sectionKey === "documents" && a?.isShowInProfile === true
    );

    const ensureInner = (key: string, label?: string) => {
      let target = clone.innerSections.find((s) => s.sectionKey === key);
      if (!target) {
        target = {
          sectionKey: key,
          sectionLabel: label ?? prettyLabel(key),
          fields: [],
          requirementMode: "AND",
        };
        clone.innerSections.push(target);
      }
      return target;
    };

    for (const a of VISIBLE_DOC_ADDS) {
      const innerKey = a?.innerSectionKey ?? "__other_docs";
      const innerLabel = a?.innerSectionKey ? undefined : "Other Documents";
      const inner = ensureInner(innerKey, innerLabel);

      if (!inner.fields.some((f) => f.key === a.fieldKey)) {
        inner.fields.push({
          key: a.fieldKey,
          label: prettyLabel(a.fieldKey),
          type: "file",
          isAdditional: true,
        } as Field);
      }
    }

    return clone;
  }, [docsCfgSection, employee]);

  // Map each documents path to meta (isAdditional, fieldKey, innerSectionKey)
  const docsPathMeta = useMemo(() => {
    const map: Record<
      string,
      {
        isAdditional: boolean;
        fieldKey: string;
        innerSectionKey?: string | null;
      }
    > = {};
    (docsDisplaySection?.innerSections || []).forEach((inner) => {
      (inner.fields || []).forEach((f) => {
        const path = `documents.${inner.sectionKey}.${f.key}`;
        map[path] = {
          isAdditional: !!f.isAdditional,
          fieldKey: f.key,
          innerSectionKey: inner.sectionKey ?? null,
        };
      });
    });
    return map;
  }, [docsDisplaySection]);

  // second fetch also creates snapshot for doc diffs
  useEffect(() => {
    (async () => {
      try {
        const [{ data: empRes }, { data: cfgRes }] = await Promise.all([
          axiosInstance.get(`/employee-profiles/self/get`),
          axiosInstance.get(`/employee-field-config/profile-config`),
        ]);

        const emp = empRes?.data || null;
        const cfg = cfgRes?.data?.sections || cfgRes?.data || [];
        setEmployee(emp);
        setCfgSections(cfg);

        // snapshot for diffing
        docsSnapshotRef.current = emp?.documents ?? {};
      } catch (err) {
        console.error("Failed to fetch profile/config", err);
        toast.error("Could not load profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // 🆕: simple modal Promise
  const openPropagationModal = (overlaps: OrgFieldPreview[]) => {
    setPropOverlaps(overlaps);
    setPropModalOpen(true);

    return new Promise<{
      action: "apply" | "skip" | "cancel";
      selected: OrgFieldPreview[];
    }>((resolve) => {
      propResolverRef.current = resolve;
    });
  };

  // 🆕: utility: run preview → (optionally) modal → (optionally) apply → then saveFn
  const ensurePropagationThenSave = async (
    updatesForPreview: any,
    saveFn: () => Promise<void>
  ) => {
    try {
      const { data } = await axiosInstance.post(
        `/employee-profiles/self/preview-propagation`,
        { updates: updatesForPreview }
      );
      const overlaps: OrgFieldPreview[] = data?.overlaps || [];

      if (!overlaps.length) {
        await saveFn();
        return;
      }

      const choice = await openPropagationModal(overlaps);
      if (choice.action === "cancel") return;

      if (choice.action === "apply" && choice.selected.length) {
        const map = buildFieldKeyValueMap(updatesForPreview);

        const selections = choice.selected
          .map((o) => ({
            employeeId: o.employeeId,
            fieldKey: o.fieldKey,
            value: map.get(o.fieldKey),
          }))
          .filter((s) => s.value !== undefined);

        if (selections.length) {
          await axiosInstance.post(
            `/employee-profiles/self/apply-propagation`,
            {
              selections,
            }
          );
        }
      }

      await saveFn();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Something went wrong");
    }
  };

  // ------- Documents: initial values (merge additionalFields into documents) -------
  // Make sure we support both new {fileId,key} and legacy {url}
  const buildDocsValuesFromProfile = useCallback((profile: any) => {
    const base = { ...(profile?.documents || {}) };
    const adds = Array.isArray(profile?.additionalFields)
      ? profile.additionalFields
      : [];

    for (const a of adds) {
      if (a?.sectionKey !== "documents" || a?.isShowInProfile !== true)
        continue;

      const innerPath =
        a?.innerSectionKey && a.innerSectionKey !== null
          ? `${a.innerSectionKey}.${a.fieldKey}`
          : `${a.fieldKey}`;

      const existing = get(base, innerPath);

      // prefer existing document tree value if present
      const hasExisting =
        (typeof existing === "string" && !!existing) ||
        (isObject(existing) &&
          (isFileRef(existing) || Object.keys(existing).length > 0));

      if (!hasExisting && a?.value) {
        set(base, innerPath, a.value);
      }
    }
    return base;
  }, []);

  const docsInitialValues = useMemo(
    () => ({ documents: buildDocsValuesFromProfile(employee || {}) }),
    [employee, buildDocsValuesFromProfile]
  );

  const docsFormik = useFormik({
    enableReinitialize: true,
    initialValues: docsInitialValues,
    onSubmit: () => {},
  });

  // Prefill OR-selection per inner section
  useEffect(() => {
    if (!docsCfgSection) return;

    const initial: Record<string, string> = {};
    const values = docsFormik.values;

    for (const inner of docsCfgSection.innerSections || []) {
      if (inner.requirementMode !== "OR") continue;
      const groupPath = `documents.${inner.sectionKey}`;

      const chosen = (inner.fields || []).find((f) => {
        const v = get(values, `${groupPath}.${f.key}`);
        const has =
          (typeof v === "string" && !!v) ||
          (isObject(v) && Object.keys(v).length > 0);
        return has;
      });
      if (chosen) initial[groupPath] = chosen.key;
    }

    setSelectedDocuments(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsCfgSection, docsFormik.initialValues]);

  // Debounced autosave: only update the documents subtree
  const rawDocsAutoSave = useCallback(
    async (values: any) => {
      const cleaned = deepClean(values || {});
      const nextDocs = cleaned?.documents || {};
      const prevDocs = docsSnapshotRef.current || {};
      const changedDocs = diffDocsSubtree(prevDocs, nextDocs);

      if (isEmptyObject(changedDocs)) return;

      // Split changes by core vs additional
      const coreChanged: any = {};
      const additionalItems: Array<{
        sectionKey: "documents";
        innerSectionKey?: string | null;
        fieldKey: string;
        value: any;
      }> = [];

      Object.entries(changedDocs).forEach(([innerKey, fieldsAny]) => {
        const fields = fieldsAny as Record<string, any>;
        Object.entries(fields).forEach(([fieldKey, value]) => {
          const fullPath = `documents.${innerKey}.${fieldKey}`;
          const meta = docsPathMeta[fullPath];

          if (meta?.isAdditional) {
            additionalItems.push({
              sectionKey: "documents",
              innerSectionKey: meta.innerSectionKey ?? innerKey,
              fieldKey,
              value,
            });
          } else {
            if (!coreChanged[innerKey]) coreChanged[innerKey] = {};

            // Exclude status field from being sent to backend unless explicitly needed
            // Status should only be set when documents are uploaded, not when dates are changed
            if (value && typeof value === "object") {
              const { status, ...valueWithoutStatus } = value;
              coreChanged[innerKey][fieldKey] = valueWithoutStatus;
            } else {
              coreChanged[innerKey][fieldKey] = value;
            }
          }
        });
      });

      // Build preview payload
      const updatesForPreview: any = {};
      if (!isEmptyObject(coreChanged))
        updatesForPreview.documents = coreChanged;
      if (additionalItems.length)
        updatesForPreview.additionalFields = additionalItems;

      const doSave = async () => {
        const calls: Promise<any>[] = [];

        // Save documents tree (contains {fileId,key,...})
        if (!isEmptyObject(coreChanged)) {
          calls.push(
            axiosInstance.put(`/employee-profiles/self/update`, {
              documents: nextDocs,
            })
          );
        }

        // Merge additionalFields
        const prevAllAdds = Array.isArray(employee?.additionalFields)
          ? employee.additionalFields
          : [];

        const keyOf = (a: any) =>
          `${a.sectionKey || ""}::${a.innerSectionKey ?? ""}::${a.fieldKey}`;

        const map = new Map<string, any>();
        prevAllAdds.forEach((a) => {
          map.set(keyOf(a), {
            sectionKey: a.sectionKey,
            innerSectionKey: a.innerSectionKey ?? null,
            fieldKey: a.fieldKey,
            value: a.value,
            isAdditional: a.isAdditional ?? true,
            isShowInProfile: a.isShowInProfile ?? false,
          });
        });

        additionalItems.forEach((it) => {
          map.set(
            keyOf({
              sectionKey: "documents",
              innerSectionKey: it.innerSectionKey,
              fieldKey: it.fieldKey,
            }),
            {
              sectionKey: "documents",
              innerSectionKey: it.innerSectionKey ?? null,
              fieldKey: it.fieldKey,
              value: it.value,
              isAdditional: true,
              isShowInProfile: true,
            }
          );
        });

        (docsDisplaySection?.innerSections || []).forEach((inner) => {
          (inner.fields || []).forEach((f) => {
            if (!f.isAdditional) return;
            const k = keyOf({
              sectionKey: "documents",
              innerSectionKey: inner.sectionKey,
              fieldKey: f.key,
            });
            if (!map.has(k)) {
              const val = get(nextDocs, `${inner.sectionKey}.${f.key}`);
              if (!isEmptyValue(val)) {
                map.set(k, {
                  sectionKey: "documents",
                  innerSectionKey: inner.sectionKey ?? null,
                  fieldKey: f.key,
                  value: val,
                  isAdditional: true,
                  isShowInProfile: true,
                });
              }
            }
          });
        });

        const mergedAdditionalFields = Array.from(map.values());

        calls.push(
          axiosInstance.put(`/employee-profiles/self/update`, {
            additionalFields: mergedAdditionalFields,
          })
        );

        await Promise.all(calls);

        // keep local page + snapshot in sync
        setEmployee((prev: any) => ({
          ...(prev || {}),
          documents: nextDocs,
          additionalFields: mergedAdditionalFields,
        }));
        docsSnapshotRef.current = nextDocs;
      };

      await ensurePropagationThenSave(updatesForPreview, doSave);
    },
    [docsPathMeta, employee, docsDisplaySection]
  );

  const docsAutoSave = useDebouncedAutosave(rawDocsAutoSave, 700);

  /* ---------- Reference options (from config) ---------- */
  useEffect(() => {
    const loadRef = async () => {
      const models = new Set<string>();
      (cfgSections || []).forEach((s: any) => {
        (s.fields || []).forEach(
          (f: any) =>
            f.type === "reference" &&
            f.referenceModel &&
            models.add(f.referenceModel)
        );
        (s.innerSections || []).forEach((inn: any) =>
          (inn.fields || []).forEach(
            (f: any) =>
              f.type === "reference" &&
              f.referenceModel &&
              models.add(f.referenceModel)
          )
        );
      });

      await Promise.all(
        Array.from(models).map(async (m) => {
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
    if (cfgSections.length) loadRef();
  }, [cfgSections]);

  /* ---------- Header Card ---------- */
  const { user: authUser } = useSelector((state: any) => state.auth);
  const renderTopProfile = () => {
    const photoUrl =
      employee?.personaldetails?.employeephoto?.url ||
      // if you later switch to fileRef for photo:
      undefined;
    const fname = employee?.personaldetails?.firstname;
    const lname = employee?.personaldetails?.lastname;
    const location = employee?.personaldetails?.location;
    const state = employee?.personaldetails?.state;
    const mobile = employee?.personaldetails?.mobile;
    const email = authUser?.email;

    return (
      <Card className="relative p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200">
        <div className="flex flex-col sm:flex-row gap-10 items-center sm:items-start">
          <div className="flex-shrink-0">
            <div className="w-28 h-28 rounded-full border border-gray-300 bg-gray-100 overflow-hidden shadow">
              {photoUrl ? (
                <Image
                  src={photoUrl}
                  alt="Employee Photo"
                  width={112}
                  height={112}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                  No Photo
                </div>
              )}
            </div>
          </div>

          <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-5">
              <div>
                <p className="text-[12px] text-gray-500 font-medium uppercase">
                  Full Name
                </p>
                <p className="text-base text-gray-900 font-semibold">
                  {fname || "—"} {lname || ""}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-gray-500 font-medium uppercase">
                  Location
                </p>
                <p className="text-base text-gray-800">
                  {location && state ? `${location}, ${state}` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[12px] text-gray-500 font-medium uppercase">
                  Mobile
                </p>
                <p className="text-base text-gray-800">{mobile || "—"}</p>
              </div>
              <div>
                <p className="text-[12px] text-gray-500 font-medium uppercase">
                  Email
                </p>
                <p className="text-base text-gray-800">{email || "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  const openDrawerForSection = (section: Section) => {
    if (section.sectionKey === "address") {
      const current =
        Array.isArray(employee?.address) && employee.address.length
          ? employee.address
          : [{}];
      const cleaned = current.map((a: any) => {
        const copy = { ...a };
        delete copy.id;
        delete copy._id;
        return copy;
      });
      setEditingSection(section);
      setAddressDraft(cleaned);
      initialDraftRef.current = cleaned;
      setDirty(false);
      setDrawerOpen(true);
      return;
    }

    if (section.sectionKey === "documents") return;

    const d = buildDraftFromSection(employee, section);
    setEditingSection(section);
    setDraft(d);
    initialDraftRef.current = d;
    setDirty(false);
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingSection(null);
    setDraft({ __inners: {} });
    setAddressDraft([]);
  };

  const saveDrawer = async () => {
    if (!editingSection) return;
    setSaving(true);
    try {
      const sk = editingSection.sectionKey;
      const skNorm = (sk || "").toLowerCase();

      // documents are handled by autosave
      if (skNorm === "documents") {
        setSaving(false);
        return;
      }

      let previewUpdates: any = {};
      let doSave: () => Promise<void>;

      if (skNorm === "address") {
        const payload = sanitizeAddressArray(addressDraft);
        previewUpdates = { address: payload };
        doSave = async () => {
          await axiosInstance.put(`/employee-profiles/self/update`, {
            address: payload,
          });
        };
      } else if (
        skNorm === "personaldetails" ||
        skNorm === "personal details"
      ) {
        const payload = sanitizeSectionTree(editingSection, draft);
        previewUpdates = { [sk]: payload };
        doSave = async () => {
          await axiosInstance.put(`/employee-profiles/self/update`, {
            [sk]: payload,
          });
        };
      } else {
        const items = extractItemsFromDraft(editingSection, draft);
        previewUpdates = {
          additionalFields: items.map(({ fieldKey, value }) => ({
            fieldKey,
            value,
          })),
        };
        doSave = async () => {
          await axiosInstance.put(SAVE_SELF_SECTION_ENDPOINT, {
            sectionKey: editingSection.sectionKey,
            items,
          });
        };
      }

      await ensurePropagationThenSave(previewUpdates, doSave);

      toast.success("Section saved");
      const { data } = await axiosInstance.get(`/employee-profiles/self/get`);
      setEmployee(data?.data || null);
      closeDrawer();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Render helpers ---------- */
  const EMPTY_PLACEHOLDER = <span className="text-sm text-gray-400">—</span>;

  const renderValue = (f: Field, v: any) => {
    const Empty = <span className="text-sm text-gray-400">—</span>;

    if (isEmptyValue(v)) {
      if (f.type === "checkbox") return Empty;
      if (f.type === "file") return Empty;
      if (f.type === "reference") return Empty;
      return Empty;
    }

    switch (f.type) {
      case "checkbox":
        return <span className="text-sm">{v ? "Yes" : "No"}</span>;
      case "date": {
        try {
          const d = new Date(v);
          if (isNaN(d.getTime()))
            return <span className="text-sm">{String(v)}</span>;

          const dd = String(d.getDate()).padStart(2, "0");
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const yyyy = d.getFullYear();

          // If this field is DOB, append age
          if ((f.key || "").toLowerCase() === "dob") {
            const today = new Date();
            let age = today.getFullYear() - d.getFullYear();
            const m = today.getMonth() - d.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
            return (
              <span className="text-sm">
                {`${dd}/${mm}/${yyyy}`} ({age} years)
              </span>
            );
          }

          // generic date
          return <span className="text-sm">{`${dd}/${mm}/${yyyy}`}</span>;
        } catch {
          return <span className="text-sm">{String(v)}</span>;
        }
      }
      case "file": {
        // NEW: support {fileId,key} previews via signed URL;
        // also supports legacy string/legacy {url}
        return <FilePreviewLink value={v} />;
      }
      case "reference":
        return (
          <span className="text-sm">
            {isObject(v) ? v?.name || v?._id || "—" : String(v)}
          </span>
        );
      default:
        return (
          <span className="text-sm">
            {typeof v === "string" ? v : JSON.stringify(v)}
          </span>
        );
    }
  };

  // Build a fieldKey -> newValue map from the preview payload
  const buildFieldKeyValueMap = (updates: any) => {
    const m = new Map<string, any>();
    if (!updates || typeof updates !== "object") return m;

    if (Array.isArray(updates.additionalFields)) {
      updates.additionalFields.forEach((a: any) => {
        if (a?.fieldKey != null) m.set(String(a.fieldKey), a.value);
      });
    }

    const isFileLikeLegacy = (v: any) =>
      v && typeof v === "object" && typeof v.url === "string";

    const walk = (node: any) => {
      if (node == null) return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node === "object") {
        Object.entries(node).forEach(([k, v]) => {
          if (
            v &&
            typeof v === "object" &&
            !isFileLikeLegacy(v) &&
            !Array.isArray(v)
          ) {
            walk(v);
          } else {
            m.set(String(k), v);
          }
        });
      }
    };

    Object.entries(updates).forEach(([k, v]) => {
      if (k === "additionalFields") return;
      walk(v);
    });

    return m;
  };

  // Drawer input renderer (kept; now file preview supports new model too)
  const renderDrawerField = useCallback(
    (field: Field, value: any, onChange: (v: any) => void) => {
      const Label = (
        <>
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </>
      );

      switch (field.type) {
        case "number":
          return (
            <Input
              type="number"
              label={Label}
              value={value ?? ""}
              onChange={(e) =>
                onChange(e.target.value === "" ? "" : Number(e.target.value))
              }
            />
          );
        case "checkbox":
          return (
            <div className="pt-6">
              <Checkbox
                label={Label}
                checked={!!value}
                onChange={(e) => onChange(e.target.checked)}
              />
            </div>
          );
        case "date": {
          const toYMD = (date: Date) =>
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
              2,
              "0"
            )}-${String(date.getDate()).padStart(2, "0")}`;

          const isDob = (field.key || "").toLowerCase() === "dob";
          const today = new Date();
          const eighteenYearsAgo = new Date(
            today.getFullYear() - 18,
            today.getMonth(),
            today.getDate()
          );
          const maxDob = toYMD(eighteenYearsAgo);

          const resolvedValue =
            value && String(value).slice(0, 10)
              ? String(value).slice(0, 10)
              : isDob
                ? maxDob // default DOB to exactly 18 years ago if empty
                : "";

          return (
            <Input
              type="date"
              label={Label}
              value={resolvedValue}
              onChange={(e) => onChange(e.target.value || "")}
              max={isDob ? maxDob : undefined} // prevent selecting <18
              placeholder={isDob ? "Select DOB (18+)" : undefined}
            />
          );
        }
        case "select":
          return (
            <Select
              label={Label}
              placeholder={field.placeholder}
              value={
                (field.options || [])
                  .map((o) => ({ label: o, value: o }))
                  .find((opt) => opt.value === value) || null
              }
              onChange={(opt: any) => onChange(opt?.value || "")}
              options={(field.options || []).map((o) => ({
                label: o,
                value: o,
              }))}
            />
          );
        case "reference": {
          const opts = referenceOptions[field.referenceModel || ""] || [];
          return (
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
              onChange={(opt: any) => onChange(opt?.value || "")}
              options={opts}
            />
          );
        }
        case "textarea":
          return (
            <Textarea
              label={Label}
              placeholder={field.placeholder}
              value={value ?? ""}
              onChange={(e) => onChange(e.target.value)}
            />
          );
        case "file":
          return (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {Label}
              </label>
              {value ? (
                <FilePreviewLink value={value} />
              ) : (
                <p className="text-xs text-gray-400">No file uploaded</p>
              )}

              {/* NOTE: for non-doc sections you can keep legacy upload,
                  or adopt the same modal/doc flow. This keeps your current UX. */}
              <input
                type="file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const formData = new FormData();
                    formData.append("file", f);
                    const { data } = await axiosInstance.post(
                      "/uploads",
                      formData,
                      { headers: { "Content-Type": "multipart/form-data" } }
                    );
                    // New response: { id, key, url, expiresIn }
                    const fileId = data?.id;
                    const key = data?.key;
                    if (!fileId || !key) throw new Error("Invalid upload");

                    // Persist using your existing section update API if needed,
                    // or just update the draft value (non-doc sections are saved on Save)
                    onChange({ fileId, key });

                    toast.success("File uploaded");
                  } catch (err) {
                    console.error(err);
                    toast.error("Upload failed");
                  }
                }}
              />
            </div>
          );
        default: {
          const typeProp =
            field.type === "email"
              ? "email"
              : field.type === "text"
                ? "text"
                : "text";
          return (
            <Input
              type={typeProp as any}
              label={Label}
              placeholder={field.placeholder}
              value={
                field.type === "object"
                  ? typeof value === "string"
                    ? value
                    : JSON.stringify(value ?? "", null, 2)
                  : (value ?? "")
              }
              onChange={(e) => onChange(e.target.value)}
            />
          );
        }
      }
    },
    [referenceOptions]
  );

  /* ---------- Render ---------- */
  if (loading)
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (!employee)
    return (
      <div className="p-6 text-center text-red-500">No employee found</div>
    );

  return (
    <div className="space-y-10">
      {renderTopProfile()}

      <Card className="p-6 shadow-sm border rounded-xl">
        <Tab>
          <Tab.List className="flex flex-wrap gap-2 border-b pb-2 mb-6">
            {sections.map((section) => (
              <Tab.ListItem
                key={section.sectionKey}
                className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 transition"
              >
                {section.sectionLabel}
              </Tab.ListItem>
            ))}
          </Tab.List>

          <Tab.Panels>
            {sections.map((section) => {
              // sources for showIf in VIEW: current employee tree
              const viewSource = employee;

              return (
                <Tab.Panel key={section.sectionKey} className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">
                      {section.sectionLabel}
                    </h3>

                    {section.sectionKey !== "documents" && (
                      <Button
                        size="sm"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => openDrawerForSection(section)}
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {/* 📄 Documents: config + autosave; now using fileId/key values */}
                  {section.sectionKey === "documents" ? (
                    <>
                      {(docsDisplaySection?.innerSections || []).map(
                        (inner) => {
                          const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
                          const groupError = get(docsFormik.errors, groupPath);

                          return (
                            <div
                              key={inner.sectionKey}
                              className="mt-8 border-t border-gray-200 pt-6"
                            >
                              <h4 className="text-base font-medium text-gray-700 mb-4">
                                {inner.sectionLabel}
                              </h4>

                              {typeof groupError === "string" && (
                                <div className="text-sm text-red-500 mb-3">
                                  {String(groupError)}
                                </div>
                              )}

                              <DocumentSection
                                inner={inner}
                                sectionKeyPath={groupPath}
                                selectedDocuments={selectedDocuments}
                                setSelectedDocuments={setSelectedDocuments}
                                formik={docsFormik}
                                onOpenModal={handleOpenModal}
                                employeeId={employee?._id}
                                employeeName={`${
                                  employee?.employeeFields?.personaldetails
                                    ?.firstName || ""
                                } ${
                                  employee?.employeeFields?.personaldetails
                                    ?.lastName || ""
                                }`.trim()}
                              />
                            </div>
                          );
                        }
                      )}
                    </>
                  ) : section.sectionKey === "address" ? (
                    // Address view
                    (() => {
                      const addrList =
                        Array.isArray(employee?.address) &&
                        employee.address.length
                          ? employee.address
                          : [{}];

                      return (
                        <div className="space-y-6">
                          {addrList.map((addr: any, idx: number) => (
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

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                {section.fields
                                  .filter(
                                    (f) =>
                                      f.key !== "addressFor" &&
                                      f.key !== "id" &&
                                      f.key !== "_id"
                                  )
                                  .map((f) => {
                                    if (!shouldShow(viewSource, f)) return null;
                                    const v = addr?.[f.key];
                                    return (
                                      <div key={f.key} className="space-y-1">
                                        <div className="flex gap-4 items-start">
                                          <p className="w-40 text-sm font-medium text-gray-600 capitalize">
                                            {f.label}
                                          </p>
                                          <div className="flex-1">
                                            {renderValue(f, v)}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    // Generic sections (VIEW) with showIf
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {section.fields.map((f) => {
                        if (!shouldShow(viewSource, f)) return null;
                        const v = getWithAdditionalFallback(
                          employee,
                          section.sectionKey,
                          f.key
                        );
                        return (
                          <div key={f.key} className="space-y-1">
                            <div className="flex gap-4 items-start">
                              <p className="w-40 text-sm font-medium text-gray-600 capitalize">
                                {f.label}
                              </p>
                              <div className="flex-1">{renderValue(f, v)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Non-docs inner sections (VIEW) with showIf */}
                  {section.sectionKey !== "documents" &&
                    section.innerSections.map((inner) => (
                      <div
                        key={inner.sectionKey}
                        className="pt-6 border-t border-gray-100"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-base font-semibold text-gray-800">
                            {inner.sectionLabel}
                          </h4>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {inner.fields.map((f) => {
                            if (!shouldShow(viewSource, f)) return null;
                            const v = getWithAdditionalFallback(
                              employee,
                              section.sectionKey,
                              f.key,
                              inner.sectionKey
                            );
                            return (
                              <div key={f.key} className="space-y-1">
                                <div className="flex gap-4 items-start">
                                  <p className="w-40 text-sm font-medium text-gray-600 capitalize">
                                    {f.label}
                                  </p>
                                  <div className="flex-1">
                                    {renderValue(f, v)}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </Tab.Panel>
              );
            })}
          </Tab.Panels>
        </Tab>
      </Card>

      {/* Drawer (for non-doc sections) */}
      <Transition.Root show={drawerOpen} as={Fragment}>
        <Dialog as="div" onClose={() => {}} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
                <Transition.Child
                  as={Fragment}
                  enter="transform transition ease-in-out duration-300"
                  enterFrom="translate-x-full"
                  enterTo="translate-x-0"
                  leave="transform transition ease-in-out duration-200"
                  leaveFrom="translate-x-0"
                  leaveTo="translate-x-full"
                >
                  <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                    <div className="flex h-full flex-col bg-white shadow-xl">
                      {/* Header */}
                      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b px-6 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <Dialog.Title className="text-base font-semibold text-gray-900">
                              {editingSection?.sectionLabel}
                            </Dialog.Title>
                            <p className="mt-0.5 text-xs text-gray-500">
                              Changes in this drawer are{" "}
                              <span className="font-semibold">
                                not auto-saved
                              </span>
                              . Click{" "}
                              <span className="font-semibold">Save</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={[
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                                dirty
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-100 text-emerald-700",
                              ].join(" ")}
                            >
                              {dirty ? "Unsaved changes" : "All changes saved"}
                            </span>
                            <button
                              onClick={safeCloseDrawer}
                              className="rounded-md p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                              aria-label="Close"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Body */}
                      <div
                        className="flex-1 overflow-y-auto px-6 py-6"
                        onKeyDownCapture={(e) => e.stopPropagation()}
                        onKeyUpCapture={(e) => e.stopPropagation()}
                        onMouseDownCapture={(e) => e.stopPropagation()}
                      >
                        {editingSection?.sectionKey === "address" ? (
                          <div className="space-y-6">
                            {addressDraft.map((address, index) => (
                              <Card
                                key={index}
                                className="relative border border-gray-200 shadow-sm p-0 overflow-hidden"
                              >
                                <div className="bg-gray-50 border-b border-gray-200 px-4 py-2 flex justify-between items-center">
                                  <div className="w-full px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-gray-50">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        className="peer block w-full px-4 pt-5 pb-2 text-sm bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder-transparent"
                                        placeholder="e.g., Home, Office"
                                        value={address?.addressFor || ""}
                                        onChange={(e) => {
                                          const updated = [...addressDraft];
                                          updated[index] = {
                                            ...updated[index],
                                            addressFor: e.target.value,
                                          };
                                          setAddressDraft(updated);
                                        }}
                                      />
                                      <label className="absolute left-4 top-2 text-xs font-semibold text-gray-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-focus:top-2 peer-focus:text-xs peer-focus:font-semibold">
                                        Address Label (e.g., Home, Office)
                                      </label>
                                    </div>
                                  </div>

                                  {addressDraft.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const next = addressDraft.filter(
                                          (_, i) => i !== index
                                        );
                                        setAddressDraft(next);
                                      }}
                                      className="ml-4 text-red-500 hover:text-red-600 text-xs"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>

                                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {editingSection.fields
                                    .filter(
                                      (f) =>
                                        f.key !== "addressFor" &&
                                        f.key !== "id" &&
                                        f.key !== "_id"
                                    )
                                    .map((field) => (
                                      <Input
                                        key={`address[${index}].${field.key}`}
                                        label={field.label}
                                        placeholder={field.label}
                                        value={
                                          addressDraft[index]?.[field.key] || ""
                                        }
                                        onChange={(e) => {
                                          const updated = [...addressDraft];
                                          updated[index] = {
                                            ...updated[index],
                                            [field.key]: e.target.value,
                                          };
                                          setAddressDraft(updated);
                                        }}
                                      />
                                    ))}
                                </div>
                              </Card>
                            ))}

                            <Button
                              variant="outline"
                              onClick={() =>
                                setAddressDraft((prev) => [...prev, {}])
                              }
                            >
                              + Add Address
                            </Button>
                          </div>
                        ) : (
                          <>
                            {/* Top-level fields with showIf */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {editingSection?.fields
                                .filter((f) =>
                                  shouldShow(
                                    draftToTree(editingSection!, draft),
                                    f
                                  )
                                )
                                .map((f) => (
                                  <div key={`top.${f.key}`}>
                                    {renderDrawerField(f, draft[f.key], (v) =>
                                      setDraft((d) => ({ ...d, [f.key]: v }))
                                    )}
                                  </div>
                                ))}
                            </div>

                            {/* Inner sections with showIf */}
                            {editingSection?.innerSections?.map((inn) => (
                              <div
                                key={inn.sectionKey}
                                className="mt-8 border-t pt-6"
                              >
                                <h4 className="text-sm font-semibold text-gray-800 mb-4">
                                  {inn.sectionLabel}
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {inn.fields
                                    .filter((f) =>
                                      shouldShow(
                                        draftToTree(editingSection!, draft),
                                        f
                                      )
                                    )
                                    .map((f) => (
                                      <div
                                        key={`inner.${inn.sectionKey}.${f.key}`}
                                      >
                                        {renderDrawerField(
                                          f,
                                          draft.__inners?.[inn.sectionKey]?.[
                                            f.key
                                          ],
                                          (v) =>
                                            setDraft((d) => ({
                                              ...d,
                                              __inners: {
                                                ...(d.__inners || {}),
                                                [inn.sectionKey]: {
                                                  ...(d.__inners?.[
                                                    inn.sectionKey
                                                  ] || {}),
                                                  [f.key]: v,
                                                },
                                              },
                                            }))
                                        )}
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>

                      {/* Footer */}
                      <div className="sticky bottom-0 z-10 bg-white/80 backdrop-blur border-t px-6 py-4">
                        <div className="flex justify-end items-center gap-3">
                          <Button
                            variant="outline"
                            onClick={safeCloseDrawer}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={saveDrawer}
                            disabled={saving || !dirty}
                          >
                            {saving ? "Saving…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Documents upload modal (uses new /uploads and auto-saves with {fileId,key}) */}
      {activeUploadField && (
        <DocumentUploadModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          field={activeUploadField.field}
          fullPath={activeUploadField.fullPath}
          formik={docsFormik}
          autoSave={docsAutoSave}
        />
      )}

      {/* 🆕 Propagation consent modal */}
      <PropagationConsentModal
        open={propModalOpen}
        overlaps={propOverlaps}
        confirming={false}
        onClose={() => {
          setPropModalOpen(false);
          const r = propResolverRef.current;
          propResolverRef.current = null;
          r?.({ action: "cancel", selected: [] });
        }}
        onSkip={() => {
          setPropModalOpen(false);
          const r = propResolverRef.current;
          propResolverRef.current = null;
          r?.({ action: "skip", selected: [] });
        }}
        onConfirm={(selected) => {
          setPropModalOpen(false);
          const r = propResolverRef.current;
          propResolverRef.current = null;
          r?.({ action: "apply", selected });
        }}
      />
    </div>
  );
}
