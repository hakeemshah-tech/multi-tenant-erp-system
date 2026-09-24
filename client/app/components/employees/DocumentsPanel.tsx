// "use client";

// import { useCallback } from "react";
// import toast from "react-hot-toast";
// import OrganizationDocumentUploadModal from "@/app/components/shared/OrganizationDocumentUploadModal";
// import DocumentSection from "@/app/components/ui/DocumentSection";
// import type { SectionConfig } from "@/app/types";
// import { setDeep } from "@/app/lib/utils";
// import { useDocsController } from "@/app/hooks";

// type Props = {
//   branchId: string;
//   config: SectionConfig[];
//   employee: any;
//   onEmployeeRefresh: (fresh: any) => void;
// };

// /**
//  * Renders the entire "Documents" section with autosave + upload modal.
//  * Self-contained state using useDocsController.
//  */
// export default function DocumentsPanel({
//   branchId,
//   config,
//   employee,
//   onEmployeeRefresh,
// }: Props) {
//   const {
//     docsDisplaySection,
//     docsValues,
//     setDocsValues,
//     selectedDocuments,
//     setSelectedDocuments,
//     docsErrors,
//     modalOpen,
//     setModalOpen,
//     activeUploadField,
//     handleOpenModal,
//     docsAutoSave,
//   } = useDocsController({ branchId, config, employee, onEmployeeRefresh });

//   if (!docsDisplaySection) return null;

//   const setFieldValue = useCallback(
//     (path: string, val: any) => {
//       setDocsValues((prev: any) => {
//         const next = JSON.parse(JSON.stringify(prev ?? {}));
//         setDeep(next, path, val);
//         return next;
//       });
//     },
//     [setDocsValues]
//   );

//   const setValues = useCallback(
//     (allVals: any) => {
//       setDocsValues(JSON.parse(JSON.stringify(allVals ?? { documents: {} })));
//     },
//     [setDocsValues]
//   );

//   return (
//     <div className="space-y-8">
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
//               formik={{
//                 values: docsValues,
//                 setFieldValue,
//                 setValues,
//               }}
//               onOpenModal={handleOpenModal}
//             />
//           </div>
//         );
//       })}

//       {/* Upload modal */}
//       {activeUploadField && (
//         <OrganizationDocumentUploadModal
//           isOpen={modalOpen}
//           onClose={() => setModalOpen(false)}
//           field={activeUploadField.field}
//           fullPath={activeUploadField.fullPath}
//           formik={{
//             values: docsValues,
//             setFieldValue: (path: string, val: any) =>
//               setDocsValues((prev: any) => {
//                 const next = JSON.parse(JSON.stringify(prev ?? {}));
//                 setDeep(next, path, val);
//                 return next;
//               }),
//             setValues: (allVals: any) => {
//               setDocsValues(
//                 JSON.parse(JSON.stringify(allVals ?? { documents: {} }))
//               );
//             },
//           }}
//           autoSave={async (vals: any) => {
//             try {
//               await docsAutoSave(vals);
//             } catch (e: any) {
//               toast.error(
//                 e?.response?.data?.message || "Failed to save documents"
//               );
//             }
//           }}
//         />
//       )}
//     </div>
//   );
// }
"use client";

import OrganizationDocumentUploadModal from "@/app/components/shared/OrganizationDocumentUploadModal";
import DocumentSection from "@/app/components/ui/DocumentSection";
import { setDeep } from "@/app/lib/utils";

// Hooks: keep BOTH variants so this component can self-initialize when
// you pass either branch props OR admin props, or you can pass a ready controller.
import {
  useDocsController as useDocsControllerBranch, // old/branch
  useDocsControllerAdmin, // new/admin
} from "@/app/hooks";

type Controller = {
  docsDisplaySection: any;
  docsValues: any;
  setDocsValues: (v: any) => void;
  selectedDocuments: Record<string, string>;
  setSelectedDocuments: (v: Record<string, string>) => void;
  docsErrors: any;
  setDocsErrors: (v: any) => void;
  modalOpen: boolean;
  setModalOpen: (b: boolean) => void;
  activeUploadField: any;
  handleOpenModal: (field: any, fullPath: string) => void;
  docsAutoSave: (vals: any) => Promise<void>;
};

// safe no-op controller to avoid crashes on first paint
const defaultController: Controller = {
  docsDisplaySection: null,
  docsValues: { documents: {} },
  setDocsValues: () => {},
  selectedDocuments: {},
  setSelectedDocuments: () => {},
  docsErrors: {},
  setDocsErrors: () => {},
  modalOpen: false,
  setModalOpen: () => {},
  activeUploadField: null,
  handleOpenModal: () => {},
  docsAutoSave: async () => {},
};

type BranchProps = {
  branchId: string;
  config: any[];
  employee: any;
  onEmployeeRefresh?: (emp: any) => void;
};

type AdminProps = {
  id: string | string[];
  config: any[];
  employee: any;
  onEmployeeRefresh?: (emp: any) => void;
};

export default function DocumentsPanel(
  props: { controller?: Controller | null } & Partial<BranchProps> & // you can still pass a ready controller
    Partial<AdminProps>
) {
  const { controller, branchId, id, config, employee, onEmployeeRefresh } =
    props as {
      controller?: Controller | null;
      branchId?: string;
      id?: string | string[];
      config?: any[];
      employee?: any;
      onEmployeeRefresh?: (emp: any) => void;
    };

  // 1) Prefer a passed-in controller (old usage)
  // 2) Else, if branch props are present, build a branch controller
  // 3) Else, if admin props are present, build an admin controller
  // 4) Else, no-op
  let resolved: Controller = defaultController;

  if (controller) {
    resolved = controller;
  } else if (branchId && config && employee && useDocsControllerBranch) {
    resolved = useDocsControllerBranch({
      branchId,
      config,
      employee,
      onEmployeeRefresh,
    }) as unknown as Controller;
  } else if (id && config && employee && useDocsControllerAdmin) {
    const c = useDocsControllerAdmin(
      id,
      config,
      employee,
      onEmployeeRefresh || (() => {})
    ) as unknown as Controller;
    resolved = c;
  }

  const {
    docsDisplaySection,
    docsValues,
    setDocsValues,
    selectedDocuments,
    setSelectedDocuments,
    docsErrors,
    modalOpen,
    setModalOpen,
    activeUploadField,
    handleOpenModal,
    docsAutoSave,
  } = resolved ?? defaultController;

  // nothing to render (no documents section in config)
  if (!docsDisplaySection) return null;

  return (
    <div className="space-y-8">
      {(docsDisplaySection.innerSections || []).map((inner: any) => {
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
              inner={inner}
              sectionKeyPath={groupPath}
              selectedDocuments={selectedDocuments}
              setSelectedDocuments={setSelectedDocuments}
              formik={{
                values: docsValues,
                setFieldValue: (path: string, val: any) =>
                  setDocsValues((prev: any) => {
                    const next =
                      typeof structuredClone === "function"
                        ? structuredClone(prev ?? {})
                        : JSON.parse(JSON.stringify(prev ?? {}));
                    setDeep(next, path, val);
                    return next;
                  }),
                setValues: (allVals: any) =>
                  setDocsValues(
                    typeof structuredClone === "function"
                      ? structuredClone(allVals ?? { documents: {} })
                      : JSON.parse(JSON.stringify(allVals ?? { documents: {} }))
                  ),
              }}
              onOpenModal={handleOpenModal}
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
          formik={{
            values: docsValues,
            setFieldValue: (path: string, val: any) =>
              setDocsValues((prev: any) => {
                const next =
                  typeof structuredClone === "function"
                    ? structuredClone(prev ?? {})
                    : JSON.parse(JSON.stringify(prev ?? {}));
                setDeep(next, path, val);
                return next;
              }),
            setValues: (allVals: any) =>
              setDocsValues(
                typeof structuredClone === "function"
                  ? structuredClone(allVals ?? { documents: {} })
                  : JSON.parse(JSON.stringify(allVals ?? { documents: {} }))
              ),
          }}
          autoSave={docsAutoSave}
        />
      )}
    </div>
  );
}
