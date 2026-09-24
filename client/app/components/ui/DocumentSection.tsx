// "use client";
// import React, { useMemo } from "react";
// import { Button, Select } from "rizzui";
// import { DownloadIcon } from "lucide-react";
// import get from "lodash/get";
// import { formatDDMMYYYY } from "@/app/utils/profile-utils";

// type Props = {
//   inner: any;
//   sectionKeyPath: string;
//   selectedDocuments: Record<string, string>;
//   setSelectedDocuments: React.Dispatch<
//     React.SetStateAction<Record<string, string>>
//   >;
//   formik: any;
//   onOpenModal: (field: any, fullPath: string) => void;
// };

// const DocumentSection: React.FC<Props> = React.memo(function DocumentSection({
//   inner,
//   sectionKeyPath,
//   selectedDocuments,
//   setSelectedDocuments,
//   formik,
//   onOpenModal,
// }) {
//   const mode = inner.requirementMode || "AND";
//   const uniqueKey = sectionKeyPath;
//   const fields = inner.fields || [];

//   const filtered = useMemo(
//     () =>
//       mode === "AND"
//         ? fields
//         : fields.filter((f: any) => selectedDocuments[uniqueKey] === f.key),
//     [mode, fields, selectedDocuments, uniqueKey]
//   );

//   return (
//     <div className="overflow-x-auto rounded-lg shadow ring-1 ring-gray-200">
//       {mode === "OR" && (
//         <div className="mt-4 max-w-sm px-3 pb-3">
//           <Select
//             placeholder="Choose document"
//             value={
//               fields
//                 .map((f: any) => ({ label: f.label, value: f.key }))
//                 .find(
//                   (opt: any) => opt.value === selectedDocuments[uniqueKey]
//                 ) || null
//             }
//             onChange={(opt: any) =>
//               setSelectedDocuments((prev) => ({
//                 ...prev,
//                 [uniqueKey]: opt?.value,
//               }))
//             }
//             options={fields.map((f: any) => ({ label: f.label, value: f.key }))}
//           />
//         </div>
//       )}

//       <table className="min-w-full text-sm bg-white">
//         <thead className="bg-gray-50 text-gray-700">
//           <tr>
//             <th className="px-4 py-3 border-b font-semibold text-left">
//               Document
//             </th>
//             <th className="px-4 py-3 border-b font-semibold text-left">
//               Status
//             </th>
//             <th className="px-4 py-3 border-b font-semibold text-left">
//               Issue Date
//             </th>
//             <th className="px-4 py-3 border-b font-semibold text-left">
//               Expiry Date
//             </th>
//             <th className="px-4 py-3 border-b font-semibold text-center">
//               Action
//             </th>
//           </tr>
//         </thead>
//         <tbody>
//           {filtered.map((field: any, index: number) => {
//             const fullPath = `${sectionKeyPath}.${field.key}`;
//             const value = get(formik.values, fullPath);
//             const rowError = get(formik.errors, fullPath);
//             const showRowError = Boolean(rowError) && formik.submitCount > 0;

//             const status = value?.url ? "✅ Uploaded" : "❌ Not Uploaded";
//             const issueDate = value?.issuingDate
//               ? formatDDMMYYYY(value.issuingDate)
//               : "—";
//             const expiryDate = value?.expiryDate
//               ? formatDDMMYYYY(value.expiryDate)
//               : "—";

//             const handleDownload = () => {
//               if (!value?.url) return;
//               const link = document.createElement("a");
//               link.href = value.url;
//               link.download = field.label || "document";
//               document.body.appendChild(link);
//               link.click();
//               document.body.removeChild(link);
//             };

//             return (
//               <tr
//                 key={field.key}
//                 className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
//               >
//                 <td className="px-4 py-3 border-b font-medium text-gray-900">
//                   {field.label}
//                 </td>
//                 <td className="px-4 py-3 border-b text-gray-700">
//                   <div>{status}</div>
//                   {showRowError && (
//                     <div className="mt-1 text-xs text-red-500">
//                       {String(rowError)}
//                     </div>
//                   )}
//                 </td>
//                 <td className="px-4 py-3 border-b text-gray-700">
//                   {issueDate}
//                 </td>
//                 <td className="px-4 py-3 border-b text-gray-700">
//                   {expiryDate}
//                 </td>
//                 <td className="px-4 py-3 border-b text-center">
//                   <div className="flex items-center justify-center gap-2">
//                     <Button
//                       size="sm"
//                       className="bg-blue-600 hover:bg-blue-700 text-white rounded-md"
//                       onClick={() => onOpenModal(field, fullPath)}
//                     >
//                       {value?.url ? "View / Edit" : "Upload"}
//                     </Button>
//                     {value?.url && (
//                       <button
//                         onClick={handleDownload}
//                         className="p-2 rounded-md hover:bg-gray-100"
//                         title="Download"
//                         type="button"
//                       >
//                         <DownloadIcon className="w-4 h-4 text-gray-600" />
//                       </button>
//                     )}
//                   </div>
//                 </td>
//               </tr>
//             );
//           })}
//         </tbody>
//       </table>
//     </div>
//   );
// });

"use client";
import React, { useMemo, useState } from "react";
import { Button, Select } from "rizzui";
import { DownloadIcon } from "lucide-react";
import get from "lodash/get";
import axiosInstance from "@/app/lib/axios";
import { formatDDMMYYYY } from "@/app/utils/profile-utils";
import {
  ExclamationTriangleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import DocumentHistorySidebar from "../shared/DocumentHistorySidebar";

type Props = {
  inner: any;
  sectionKeyPath: string;
  selectedDocuments: Record<string, string>;
  setSelectedDocuments: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  formik: any;
  onOpenModal: (field: any, fullPath: string) => void;
  onPropagateClick?: (args: {
    fieldKey: string;
    fieldLabel?: string;
    value: any;
    sectionKey?: string;
    innerSectionKey?: string;
  }) => void;
  employeeId?: string;
  employeeName?: string;
};

const DocumentSection: React.FC<Props> = React.memo(function DocumentSection({
  inner,
  sectionKeyPath,
  selectedDocuments,
  setSelectedDocuments,
  formik,
  onOpenModal,
  onPropagateClick,
  employeeId,
  employeeName,
}) {
  const [historySidebarOpen, setHistorySidebarOpen] = useState(false);
  const [selectedDocumentForHistory, setSelectedDocumentForHistory] = useState<{
    employeeId: string;
    documentName: string;
    sectionKey: string;
    fieldKey: string;
    innerSectionKey?: string;
  } | null>(null);
  const mode = inner.requirementMode || "AND";
  const uniqueKey = sectionKeyPath;
  const fields = inner.fields || [];

  // Get all fields that have values (uploaded documents)
  const fieldsWithValues = useMemo(() => {
    return fields.filter((f: any) => {
      const fullPath = `${sectionKeyPath}.${f.key}`;
      const value = get(formik.values, fullPath);
      return value?.fileId && value?.key;
    });
  }, [fields, sectionKeyPath, formik.values]);

  // Get available fields (without values) for OR mode
  const availableFields = useMemo(() => {
    const withValuesKeys = new Set(fieldsWithValues.map((f: any) => f.key));
    return fields.filter((f: any) => !withValuesKeys.has(f.key));
  }, [fields, fieldsWithValues]);

  const filtered = useMemo(() => {
    if (mode === "AND") {
      return fields;
    }
    // OR mode: Show all uploaded documents + currently selected document if not uploaded yet
    const uploadedFields = fieldsWithValues;
    const selected = selectedDocuments[uniqueKey];
    const hasSelected =
      selected && !uploadedFields.find((f: any) => f.key === selected);

    if (hasSelected) {
      const selectedField = fields.find((f: any) => f.key === selected);
      return [...uploadedFields, selectedField].filter(Boolean);
    }

    return uploadedFields;
  }, [mode, fields, fieldsWithValues, selectedDocuments, uniqueKey]);

  return (
    <>
      <div className="overflow-x-auto rounded-lg shadow ring-1 ring-gray-200">
        {mode === "OR" && (
          <div className="mt-4 max-w-sm px-3 pb-3">
            <Select
              placeholder="Choose document"
              value={
                availableFields
                  .map((f: any) => ({ label: f.label, value: f.key }))
                  .find(
                    (opt: any) => opt.value === selectedDocuments[uniqueKey]
                  ) || null
              }
              onChange={(opt: any) =>
                setSelectedDocuments((prev) => ({
                  ...prev,
                  [uniqueKey]: opt?.value,
                }))
              }
              options={availableFields.map((f: any) => ({
                label: f.label,
                value: f.key,
              }))}
            />
          </div>
        )}

        <table className="min-w-full text-sm bg-white">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-3 border-b font-semibold text-left">
                Document
              </th>
              <th className="px-4 py-3 border-b font-semibold text-left">
                Status
              </th>
              <th className="px-4 py-3 border-b font-semibold text-left">
                Issue Date
              </th>
              <th className="px-4 py-3 border-b font-semibold text-left">
                Expiry Date
              </th>
              {fields.some(
                (f: any) => f.key === "passport" && f.fileMeta?.countryOfIssue
              ) && (
                <th className="px-4 py-3 border-b font-semibold text-left">
                  Country of Issue
                </th>
              )}
              <th className="px-4 py-3 border-b font-semibold text-center">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((field: any, index: number) => {
              if (!field) return null; // Guard against undefined fields

              const fullPath = `${sectionKeyPath}.${field.key}`;
              const value = get(formik.values, fullPath);
              const rowError = get(formik.errors, fullPath);
              const showRowError = Boolean(rowError) && formik.submitCount > 0;

              const hasFile = Boolean(value?.fileId && value?.key);

              // Get the actual document status
              const getDocumentStatus = () => {
                if (!value) return "❌ Not Uploaded";

                // Check if it's a file reference object with status
                if (value.status) {
                  switch (value.status) {
                    case "pendingToApprove":
                      return "🟡 Pending Approval";
                    case "approved":
                      return "✅ Approved";
                    case "rejected":
                      return "❌ Rejected";
                    case "expired":
                      return "⏰ Expired";
                    default:
                      return "❓ Unknown";
                  }
                }

                // Fallback for legacy documents without status
                if (hasFile) {
                  return "✅ Uploaded";
                }

                return "❌ Not Uploaded";
              };

              const status = getDocumentStatus();

              const issueDate = value?.issuingDate
                ? formatDDMMYYYY(value.issuingDate)
                : "—";
              const expiryDate = value?.expiryDate
                ? formatDDMMYYYY(value.expiryDate)
                : "—";
              const isPassport = field.key === "passport";
              const showCountryOfIssue =
                isPassport && field.fileMeta?.countryOfIssue;
              const countryOfIssue = value?.countryOfIssue || "—";

              const handleDownload = async () => {
                if (!hasFile) return;
                try {
                  // Ensure fileId is a string (convert ObjectId to string if needed)
                  const fileIdString = String(value.fileId);
                  const { data } = await axiosInstance.get<{
                    url: string;
                    expiresIn: number;
                  }>(`/uploads/${fileIdString}/url`);
                  const url = data?.url;
                  if (!url) return;

                  const a = document.createElement("a");
                  a.href = url;
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  // best-effort filename from key tail
                  a.download =
                    field.label ||
                    String(value.key).split("/").pop() ||
                    "document";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                } catch (e) {
                  // optional: toast error if you use react-hot-toast here
                  console.error("Failed to get signed URL", e);
                }
              };

              return (
                <tr
                  key={field.key}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="px-4 py-3 border-b font-medium text-gray-900">
                    <div className="inline-flex items-center gap-2">
                      <span>{field.label}</span>
                      {onPropagateClick && (
                        <button
                          type="button"
                          className="inline-flex items-center rounded-md px-1.5 py-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-amber-200"
                          title="Propagate this document field to other Organisations"
                          onClick={() =>
                            onPropagateClick({
                              fieldKey: field.key,
                              fieldLabel: field.label,
                              value,
                              sectionKey: "documents",
                              innerSectionKey: inner.sectionKey,
                            })
                          }
                        >
                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3 border-b text-gray-700">
                    <div>{status}</div>
                    {showRowError && (
                      <div className="mt-1 text-xs text-red-500">
                        {String(rowError)}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3 border-b text-gray-700">
                    {issueDate}
                  </td>
                  <td className="px-4 py-3 border-b text-gray-700">
                    {expiryDate}
                  </td>

                  {showCountryOfIssue && (
                    <td className="px-4 py-3 border-b text-gray-700">
                      {countryOfIssue}
                    </td>
                  )}

                  <td className="px-4 py-3 border-b text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                        onClick={() => onOpenModal(field, fullPath)}
                      >
                        {hasFile ? "View / Edit" : "Upload"}
                      </Button>

                      {hasFile && (
                        <>
                          <button
                            onClick={handleDownload}
                            className="p-2 rounded-md hover:bg-gray-100"
                            title="Download"
                            type="button"
                          >
                            <DownloadIcon className="w-4 h-4 text-gray-600" />
                          </button>
                          <button
                            onClick={() => {
                              const pathParts = sectionKeyPath.split(".");
                              const sectionKey = pathParts[0];
                              // For documents, the sectionKeyPath is "documents.certificates"
                              // So pathParts[1] is the innerSectionKey
                              const innerSectionKey =
                                pathParts.length >= 2
                                  ? pathParts[1]
                                  : undefined;

                              console.log(
                                `🔍 [DEBUG] DocumentSection - sectionKeyPath:`,
                                sectionKeyPath
                              );
                              console.log(
                                `🔍 [DEBUG] DocumentSection - pathParts:`,
                                pathParts
                              );
                              console.log(
                                `🔍 [DEBUG] DocumentSection - sectionKey:`,
                                sectionKey,
                                "innerSectionKey:",
                                innerSectionKey,
                                "fieldKey:",
                                field.key
                              );

                              setSelectedDocumentForHistory({
                                employeeId: employeeId || "",
                                documentName: field.label,
                                sectionKey,
                                fieldKey: field.key,
                                innerSectionKey,
                              });
                              setHistorySidebarOpen(true);
                            }}
                            className="p-2 rounded-md hover:bg-gray-100"
                            title="View History"
                            type="button"
                          >
                            <ClockIcon className="w-4 h-4 text-gray-600" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Document History Sidebar */}
      {selectedDocumentForHistory && (
        <DocumentHistorySidebar
          isOpen={historySidebarOpen}
          onClose={() => {
            setHistorySidebarOpen(false);
            setSelectedDocumentForHistory(null);
          }}
          documentId={selectedDocumentForHistory.employeeId}
          documentName={selectedDocumentForHistory.documentName}
          employeeName={employeeName}
          sectionKey={selectedDocumentForHistory.sectionKey}
          fieldKey={selectedDocumentForHistory.fieldKey}
          innerSectionKey={selectedDocumentForHistory.innerSectionKey}
        />
      )}
    </>
  );
});

export default DocumentSection;
