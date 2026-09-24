// // app/components/shared/DocumentsPanel.tsx
// "use client";

// import { useMemo } from "react";
// import type { SectionConfig, FieldConfig } from "@/app/types/employee-fields";
// import DocumentSection from "@/app/components/ui/DocumentSection";
// import OrganizationDocumentUploadModal from "@/app/components/shared/OrganizationDocumentUploadModal";

// export function DocumentsPanel({
//   docsDisplaySection,
//   docsValues,
//   setDocsValues,
//   docsErrors,
//   selectedDocuments,
//   setSelectedDocuments,
//   activeUploadField,
//   setActiveUploadField,
//   modalOpen,
//   setModalOpen,
//   autoSave,
//   renderDocFieldAction, // NEW
// }: {
//   docsDisplaySection: SectionConfig | null;
//   docsValues: any;
//   setDocsValues: (v: any) => void;
//   docsErrors: any;
//   selectedDocuments: Record<string, string>;
//   setSelectedDocuments: (v: Record<string, string>) => void;
//   activeUploadField: any;
//   setActiveUploadField: (v: any) => void;
//   modalOpen: boolean;
//   setModalOpen: (v: boolean) => void;
//   autoSave: (vals: any) => void;
//   renderDocFieldAction?: (args: {
//     section: SectionConfig;
//     innerKey: string;
//     field: FieldConfig;
//     fullPath: string;
//     value: any;
//   }) => React.ReactNode;
// }) {
//   if (!docsDisplaySection) return null;

//   // Adapter used by your current codebase
//   const formik = {
//     values: docsValues,
//     setFieldValue: (path: string, val: any) =>
//       setDocsValues((prev: any) => {
//         const next = JSON.parse(JSON.stringify(prev));
//         const parts = path.split(".");
//         let cur = next as any;
//         while (parts.length > 1) {
//           const k = parts.shift() as string;
//           if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
//           cur = cur[k];
//         }
//         cur[parts[0]] = val;
//         return next;
//       }),
//     setValues: (allVals: any) => {
//       setDocsValues(JSON.parse(JSON.stringify(allVals ?? { documents: {} })));
//     },
//   };

//   return (
//     <>
//       {(docsDisplaySection.innerSections || []).map((inner) => {
//         const groupPath = `documents.${inner.sectionKey}`;
//         const groupError = (docsErrors || {})?.[groupPath];

//         return (
//           <div key={inner.sectionKey} className="mb-8 border-gray-200 pt-6">
//             <h4 className="text-base font-medium text-gray-700 mb-4">
//               {inner.sectionLabel}
//             </h4>

//             {typeof groupError === "string" && (
//               <div className="text-sm text-red-500 mb-3">
//                 {String(groupError)}
//               </div>
//             )}

//             <DocumentSection
//               inner={inner as any}
//               sectionKeyPath={groupPath}
//               selectedDocuments={selectedDocuments}
//               setSelectedDocuments={setSelectedDocuments}
//               formik={formik}
//               onOpenModal={(field: any, fullPath: string) => {
//                 setActiveUploadField({ field, fullPath });
//                 setModalOpen(true);
//               }}
//               renderFieldAction={(field, fullPath, currentValue) =>
//                 renderDocFieldAction?.({
//                   section: docsDisplaySection,
//                   innerKey: inner.sectionKey,
//                   field,
//                   fullPath,
//                   value: currentValue,
//                 })
//               }
//             />
//           </div>
//         );
//       })}

//       {activeUploadField && (
//         <OrganizationDocumentUploadModal
//           isOpen={modalOpen}
//           onClose={() => setModalOpen(false)}
//           field={activeUploadField.field}
//           fullPath={activeUploadField.fullPath}
//           formik={formik}
//           autoSave={async (vals: any) => {
//             await autoSave(vals);
//           }}
//         />
//       )}
//     </>
//   );
// }

// app/components/shared/DocumentsPanel.tsx
"use client";

import { useMemo } from "react";
import type { SectionConfig, FieldConfig } from "@/app/types/employee-fields";
import DocumentSection from "@/app/components/ui/DocumentSection";
import OrganizationDocumentUploadModal from "@/app/components/shared/OrganizationDocumentUploadModal";

export function DocumentsPanel({
  docsDisplaySection,
  docsValues,
  setDocsValues,
  docsErrors,
  selectedDocuments,
  setSelectedDocuments,
  activeUploadField,
  setActiveUploadField,
  modalOpen,
  setModalOpen,
  autoSave,
  employeeId, // Add employeeId prop
  employeeName, // Add employeeName prop
  canWrite = true, // Add canWrite prop with default true
}: // renderDocFieldAction, // (Removed here; current DocumentSection doesn't accept it)
{
  docsDisplaySection: SectionConfig | null;
  docsValues: any;
  setDocsValues: (v: any) => void;
  docsErrors: any;
  selectedDocuments: Record<string, string>;
  setSelectedDocuments: (v: Record<string, string>) => void;
  activeUploadField: any;
  setActiveUploadField: (v: any) => void;
  modalOpen: boolean;
  setModalOpen: (v: boolean) => void;
  autoSave: (vals: any) => void;
  employeeId: string; // Add employeeId prop type
  employeeName?: string; // Add employeeName prop type
  canWrite?: boolean; // Add canWrite prop type
  renderDocFieldAction?: (args: {
    section: SectionConfig;
    innerKey: string;
    field: FieldConfig;
    fullPath: string;
    value: any;
  }) => React.ReactNode;
}) {
  if (!docsDisplaySection) return null;

  // Minimal, safe Formik-like adapter the rest of the components expect.
  const formik = {
    values: docsValues,
    setFieldValue: (path: string, val: any) =>
      setDocsValues((prev: any) => {
        // deep clone to avoid mutating previous state
        const next = JSON.parse(JSON.stringify(prev ?? { documents: {} }));
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
      const safe = JSON.parse(JSON.stringify(allVals ?? { documents: {} }));
      setDocsValues(safe);
    },
    // include these for compatibility with some consumers,
    // harmless if they don’t read them:
    errors: docsErrors ?? {},
    submitCount: 0,
  };

  return (
    <>
      {(docsDisplaySection.innerSections || []).map((inner) => {
        const groupPath = `documents.${inner.sectionKey}`;
        const groupError = (docsErrors || {})?.[groupPath];

        return (
          <div key={inner.sectionKey} className="mb-8 border-gray-200 pt-6">
            <h4 className="text-base font-medium text-gray-700 mb-4">
              {inner.sectionLabel}
            </h4>

            {typeof groupError === "string" && (
              <div className="text-sm text-red-500 mb-3">
                {String(groupError)}
              </div>
            )}

            <DocumentSection
              inner={inner as any}
              sectionKeyPath={groupPath}
              selectedDocuments={selectedDocuments}
              setSelectedDocuments={setSelectedDocuments}
              formik={formik}
              onOpenModal={(field: any, fullPath: string) => {
                setActiveUploadField({ field, fullPath });
                setModalOpen(true);
              }}
              employeeId={employeeId}
              employeeName={employeeName}
              // If you add onPropagateClick to Section-level container, pass it here:
              // onPropagateClick={(args) => { ... }}
            />
          </div>
        );
      })}

      {activeUploadField && (
        <OrganizationDocumentUploadModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          field={activeUploadField.field}
          fullPath={activeUploadField.fullPath}
          formik={formik}
          autoSave={async (vals: any) => {
            await autoSave(vals);
          }}
          employeeId={employeeId}
          isEmployeeContext={false} // This is employer context
          canWrite={canWrite}
        />
      )}
    </>
  );
}
