// "use client";

// import React, { Fragment } from "react";
// import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
// import { isNonEmpty } from "@/app/utils/common";
// // import { formatDatePretty } from "@/app/utils/profile-utils";
// import { FieldConfig, SectionConfig } from "@/app/types/employee-fields";

// /* ---------- showIf (equals / notEquals) ---------- */
// type ShowIfOperator = "equals" | "notEquals";

// type ShowIfRule = {
//   fieldKey: string;
//   operator?: ShowIfOperator; // defaults to "equals"
//   value?: any; // required for equals/notEquals
//   // Optional cross-section targeting. Defaults to current section/innerSection.
//   sectionKey?: string;
//   innerSectionKey?: string;
// };

// const normalize = (v: any) =>
//   typeof v === "string" ? v.trim().toLowerCase() : v;

// function evalShowIf({
//   rule,
//   getValue,
//   fallbackSectionKey,
//   fallbackInnerSectionKey,
// }: {
//   rule: ShowIfRule;
//   getValue: (sectionKey: string, fieldKey: string, innerKey?: string) => any;
//   fallbackSectionKey: string;
//   fallbackInnerSectionKey?: string;
// }): boolean {
//   const {
//     fieldKey,
//     operator = "equals",
//     value,
//     sectionKey,
//     innerSectionKey,
//   } = rule;

//   const depSection = sectionKey || fallbackSectionKey;
//   const depInner = innerSectionKey ?? fallbackInnerSectionKey;
//   const depVal = getValue(depSection, fieldKey, depInner);

//   const a = normalize(depVal);
//   const b = normalize(value);

//   if (operator === "equals") return a === b;
//   if (operator === "notEquals") return a !== b;

//   // Fallback (should not occur with current operators): show the field
//   return true;
// }

// function shouldShowField({
//   field,
//   getValue,
//   currentSectionKey,
//   currentInnerSectionKey,
// }: {
//   field: FieldConfig & { showIf?: ShowIfRule };
//   getValue: (sectionKey: string, fieldKey: string, innerKey?: string) => any;
//   currentSectionKey: string;
//   currentInnerSectionKey?: string;
// }) {
//   if (!field?.showIf) return true;
//   return evalShowIf({
//     rule: field.showIf,
//     getValue,
//     fallbackSectionKey: currentSectionKey,
//     fallbackInnerSectionKey: currentInnerSectionKey,
//   });
// }

// /* ---------- component ---------- */
// export function SectionPanel({
//   section,
//   employee,
//   makeProfileLookup,
//   getValue,
//   referenceOptions,
//   headerRight,
//   onPropagateClick, // NEW
// }: {
//   section: SectionConfig;
//   employee: any;
//   makeProfileLookup: (
//     section: SectionConfig,
//     innerKey?: string
//   ) => (key: string) => any;
//   getValue: (sectionKey: string, fieldKey: string, innerKey?: string) => any;
//   referenceOptions?: Record<string, { label: string; value: string }[]>;
//   headerRight?: React.ReactNode;
//   onPropagateClick?: (args: {
//     fieldKey: string;
//     fieldLabel?: string;
//     value: any;
//     sectionKey?: string;
//     innerSectionKey?: string;
//   }) => void;
// }) {
//   // const sectionLookup = makeProfileLookup(section); // not used currently

//   const formatDate = (val: any) => {
//     if (!val) return "";
//     const d = new Date(val);
//     if (isNaN(d.getTime())) return String(val); // fallback if invalid
//     const dd = String(d.getDate()).padStart(2, "0");
//     const mm = String(d.getMonth() + 1).padStart(2, "0");
//     const yyyy = d.getFullYear();
//     return `${dd}/${mm}/${yyyy}`;
//   };

//   // Add after formatDate()
//   const formatDateHyphen = (val: any) => {
//     if (!val) return "";
//     const d = new Date(val);
//     if (isNaN(d.getTime())) return String(val);
//     const dd = String(d.getDate()).padStart(2, "0");
//     const mm = String(d.getMonth() + 1).padStart(2, "0");
//     const yyyy = d.getFullYear();
//     return `${dd}-${mm}-${yyyy}`;
//   };

//   const calcAge = (val: any) => {
//     if (!val) return null;
//     const dob = new Date(val);
//     if (isNaN(dob.getTime())) return null;
//     const now = new Date();
//     let age = now.getFullYear() - dob.getFullYear();
//     const m = now.getMonth() - dob.getMonth();
//     if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
//     return age >= 0 ? age : 0;
//   };

//   const renderValue = (field: FieldConfig, value: any) => {
//     if (!isNonEmpty(value)) return <span className="text-gray-400">—</span>;
//     if (field.key === "dob") {
//       if (!isNonEmpty(value)) return <span className="text-gray-400">—</span>;
//       const dateStr = formatDateHyphen(value);
//       const age = calcAge(value);
//       return (
//         <span>
//           {dateStr}
//           {age !== null ? ` (${age} ${age === 1 ? "year" : "years"})` : ""}
//         </span>
//       );
//     }
//     if (field.type === "file") {
//       const url = typeof value === "string" ? value : value?.url;
//       return (
//         <a
//           href={url}
//           target="_blank"
//           className="text-primary underline text-sm"
//         >
//           View Document
//         </a>
//       );
//     }
//     if (field.type === "date") return <span>{formatDate(value)}</span>;
//     if (field.type === "checkbox") return <span>{value ? "Yes" : "No"}</span>;
//     if (field.type === "reference") {
//       if (typeof value === "object") {
//         return <span>{value?.name || value?._id || "—"}</span>;
//       }
//       const model = field.referenceModel || "";
//       const opts = referenceOptions?.[model] || [];
//       const match = opts.find((o) => String(o.value) === String(value));
//       return <span>{match?.label || String(value)}</span>;
//     }
//     return (
//       <span>{typeof value === "string" ? value : JSON.stringify(value)}</span>
//     );
//   };

//   const FieldRow = ({
//     field,
//     innerSectionKey,
//   }: {
//     field: FieldConfig & { showIf?: ShowIfRule };
//     innerSectionKey?: string;
//   }) => {
//     // 👇 hide profile photo everywhere in SectionPanel
//     if (
//       section.sectionKey === "personaldetails" &&
//       field.key === "employeephoto"
//     ) {
//       return null;
//     }
//     // hide if showIf says not to render
//     if (
//       !shouldShowField({
//         field,
//         getValue,
//         currentSectionKey: section.sectionKey,
//         currentInnerSectionKey: innerSectionKey,
//       })
//     ) {
//       return null;
//     }

//     const v = getValue(section.sectionKey, field.key, innerSectionKey);
//     return (
//       <div className="flex items-start gap-4">
//         <p className="shrink-0 text-sm font-medium text-gray-600 capitalize">
//           {field.label}
//         </p>
//         <div className="flex-1 flex items-center gap-2">
//           {renderValue(field, v)}
//           {onPropagateClick && (
//             <button
//               type="button"
//               onClick={() =>
//                 onPropagateClick({
//                   fieldKey: field.key,
//                   fieldLabel: field.label,
//                   value: v,
//                   sectionKey: section.sectionKey,
//                   innerSectionKey,
//                 })
//               }
//               title="Propagate this field to other Organizations"
//               className="inline-flex items-center rounded-md px-1.5 py-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-amber-200"
//             >
//               <ExclamationTriangleIcon className="w-3.5 h-3.5" />
//             </button>
//           )}
//         </div>
//       </div>
//     );
//   };

//   return (
//     <div className="space-y-8">
//       <div className="flex items-center justify-between">{headerRight}</div>

//       <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
//         {(section.fields || []).map((f) => (
//           <FieldRow
//             key={f.key}
//             field={f as FieldConfig & { showIf?: ShowIfRule }}
//           />
//         ))}
//       </div>

//       {(section.innerSections || []).map((inn) => (
//         <Fragment key={inn.sectionKey}>
//           <div className="pt-6 border-t border-gray-100">
//             <h4 className="text-base font-semibold text-gray-800 mb-4">
//               {inn.sectionLabel}
//             </h4>
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
//               {(inn.fields || []).map((f) => (
//                 <FieldRow
//                   key={f.key}
//                   field={f as FieldConfig & { showIf?: ShowIfRule }}
//                   innerSectionKey={inn.sectionKey}
//                 />
//               ))}
//             </div>
//           </div>
//         </Fragment>
//       ))}
//     </div>
//   );
// }
"use client";

import React, { Fragment, useState } from "react";
import {
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  UserIcon,
  PhoneIcon,
  GlobeAltIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { isNonEmpty } from "@/app/utils/common";
import { FieldConfig, SectionConfig } from "@/app/types/employee-fields";

/* ---------- showIf (equals / notEquals) ---------- */
type ShowIfOperator = "equals" | "notEquals";

type ShowIfRule = {
  fieldKey: string;
  operator?: ShowIfOperator; // defaults to "equals"
  value?: any; // required for equals/notEquals
  // Optional cross-section targeting. Defaults to current section/innerSection.
  sectionKey?: string;
  innerSectionKey?: string;
};

const normalize = (v: any) =>
  typeof v === "string" ? v.trim().toLowerCase() : v;

const isBlank = (s?: string | null) => typeof s !== "string" || s.trim() === "";

const isEmployeePhoto = (f: Pick<FieldConfig, "key" | "label">) => {
  const k = normalize((f as any)?.key);
  const lbl = normalize((f as any)?.label);
  return k === "employeephoto" || lbl === "employeephoto";
};

function evalShowIf({
  rule,
  getValue,
  fallbackSectionKey,
  fallbackInnerSectionKey,
}: {
  rule: ShowIfRule;
  getValue: (sectionKey: string, fieldKey: string, innerKey?: string) => any;
  fallbackSectionKey: string;
  fallbackInnerSectionKey?: string;
}): boolean {
  const {
    fieldKey,
    operator = "equals",
    value,
    sectionKey,
    innerSectionKey,
  } = rule;

  const depSection = sectionKey || fallbackSectionKey;
  const depInner = innerSectionKey ?? fallbackInnerSectionKey;
  const depVal = getValue(depSection, fieldKey, depInner);

  const a = normalize(depVal);
  const b = normalize(value);

  if (operator === "equals") return a === b;
  if (operator === "notEquals") return a !== b;

  // Fallback (should not occur with current operators): show the field
  return true;
}

function shouldShowField({
  field,
  getValue,
  currentSectionKey,
  currentInnerSectionKey,
}: {
  field: FieldConfig & { showIf?: ShowIfRule };
  getValue: (sectionKey: string, fieldKey: string, innerKey?: string) => any;
  currentSectionKey: string;
  currentInnerSectionKey?: string;
}) {
  if (!field?.showIf) return true;
  return evalShowIf({
    rule: field.showIf,
    getValue,
    fallbackSectionKey: currentSectionKey,
    fallbackInnerSectionKey: currentInnerSectionKey,
  });
}

/* ---------- component ---------- */
export function SectionPanel({
  section,
  employee,
  makeProfileLookup,
  getValue,
  referenceOptions,
  headerRight,
  onPropagateClick,
}: {
  section: SectionConfig;
  employee: any;
  makeProfileLookup: (
    section: SectionConfig,
    innerKey?: string
  ) => (key: string) => any;
  getValue: (sectionKey: string, fieldKey: string, innerKey?: string) => any;
  referenceOptions?: Record<string, { label: string; value: string }[]>;
  headerRight?: React.ReactNode;
  onPropagateClick?: (args: {
    fieldKey: string;
    fieldLabel?: string;
    value: any;
    sectionKey?: string;
    innerSectionKey?: string;
  }) => void;
}) {
  // State for DOB visibility toggle
  const [isDobVisible, setIsDobVisible] = useState(false);
  const [isTaxFileNumberVisible, setIsTaxFileNumberVisible] = useState(false);
  const formatDate = (val: any) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  // Hyphen date for DOB display (and age)
  const formatDateHyphen = (val: any) => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const calcAge = (val: any) => {
    if (!val) return null;
    const dob = new Date(val);
    if (isNaN(dob.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - dob.getFullYear();
    const m = now.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
    return age >= 0 ? age : 0;
  };

  const renderValue = (field: FieldConfig, value: any) => {
    if (!isNonEmpty(value)) return <span className="text-gray-400">—</span>;

    // Handle multi-select fields (arrays)
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400">—</span>;
      // Display array values as comma-separated list or chips
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
            >
              {String(item)}
            </span>
          ))}
        </div>
      );
    }

    if (field.key === "dob") {
      const dateStr = formatDateHyphen(value);
      const age = calcAge(value);
      return (
        <div className="flex items-center gap-2">
          <span>
            {isDobVisible ? (
              <>
                {dateStr}
                {age !== null
                  ? ` (${age} ${age === 1 ? "year" : "years"})`
                  : ""}
              </>
            ) : (
              "***********"
            )}
          </span>
          <button
            type="button"
            onClick={() => setIsDobVisible(!isDobVisible)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200 group"
            title={isDobVisible ? "Hide date of birth" : "Show date of birth"}
          >
            {isDobVisible ? (
              <EyeSlashIcon className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
            ) : (
              <EyeIcon className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
            )}
          </button>
        </div>
      );
    }
    if (field.type === "file") {
      const url = typeof value === "string" ? value : value?.url;
      if (!url) return <span className="text-gray-400">—</span>;
      return (
        <a
          href={url}
          target="_blank"
          className="text-primary underline text-sm break-all"
        >
          View Document
        </a>
      );
    }
    if (field.key === "taxfilenumber") {
      return (
        <div className="flex items-center gap-2">
          <span>{isTaxFileNumberVisible ? String(value) : "*****"}</span>
          <button
            type="button"
            onClick={() => setIsTaxFileNumberVisible(!isTaxFileNumberVisible)}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors duration-200 group"
            title={
              isTaxFileNumberVisible
                ? "Hide tax file number"
                : "Show tax file number"
            }
          >
            {isTaxFileNumberVisible ? (
              <EyeSlashIcon className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
            ) : (
              <EyeIcon className="h-4 w-4 text-gray-500 group-hover:text-gray-700" />
            )}
          </button>
        </div>
      );
    }
    if (field.type === "date") return <span>{formatDate(value)}</span>;
    if (field.type === "checkbox") return <span>{value ? "Yes" : "No"}</span>;
    // Special formatting for hourly rate field
    if (field.key === "hourlyrate" && field.type === "number") {
      if (!isNonEmpty(value)) return <span className="text-gray-400">—</span>;
      const numValue =
        typeof value === "string" ? parseFloat(value) : Number(value);
      if (isNaN(numValue)) return <span className="text-gray-400">—</span>;
      return <span>${numValue.toFixed(2)}</span>;
    }
    if (field.type === "reference") {
      const model = field.referenceModel || "";
      const opts = referenceOptions?.[model] || [];

      // Handle object values (populated references)
      if (typeof value === "object" && value !== null) {
        // Try to get title/name from the object itself first
        const title = value?.title || value?.name || value?.label;
        if (title) return <span>{title}</span>;

        // If no title, try to match by ID
        const objId = value?._id || value?.id;
        if (objId) {
          const match = opts.find((o) => String(o.value) === String(objId));
          if (match?.label) return <span>{match.label}</span>;
        }

        // Fallback to ID if nothing else works
        return <span>{String(objId || value?._id || "—")}</span>;
      }

      // Handle string/ID values
      if (typeof value === "string" || typeof value === "number") {
        const match = opts.find((o) => String(o.value) === String(value));
        if (match?.label) {
          return <span>{match.label}</span>;
        }
        // If no match found but options are still loading, show loading state
        if (model && !(model in (referenceOptions || {}))) {
          return <span className="text-gray-400">Loading...</span>;
        }
        // Fallback: show ID (but this shouldn't happen if referenceOptions are loaded)
        return <span className="text-gray-400">{String(value)}</span>;
      }

      return <span className="text-gray-400">—</span>;
    }
    // Handle object values that might be references (even if field type isn't explicitly "reference")
    // This handles cases where the backend returns populated objects
    if (typeof value === "object" && value !== null) {
      // Handle MongoDB ObjectId buffer format (when _id is an object with buffer property)
      let objId: string | null = null;
      if (value?._id) {
        if (typeof value._id === "string") {
          objId = value._id;
        } else if (value._id?.buffer && typeof value._id.buffer === "object") {
          // Convert buffer to string (MongoDB ObjectId buffer format)
          const buffer = value._id.buffer;
          const hex = Array.from(buffer as any)
            .map((b: any) => b.toString(16).padStart(2, "0"))
            .join("");
          objId = hex;
        } else if (value._id?.toString) {
          objId = String(value._id.toString());
        } else {
          objId = String(value._id);
        }
      } else if (value?.id) {
        objId = String(value.id);
      }

      if (objId) {
        // Try to get title/name/label from the object
        const title = value?.title || value?.name || value?.label;
        if (title) return <span>{title}</span>;

        // If no title, try to find in referenceOptions if field type suggests it's a reference
        // Check common reference field keys
        const isLikelyReference =
          field.key === "award" ||
          field.key === "awardtype" ||
          field.key === "awardType" ||
          field.referenceModel;

        if (isLikelyReference) {
          // Try to find in referenceOptions for common models
          const possibleModels = [
            "Award",
            "AwardEmployeeType",
            field.referenceModel,
          ].filter(Boolean) as string[];
          for (const model of possibleModels) {
            if (!model) continue;
            const opts = referenceOptions?.[model] || [];
            const match = opts.find(
              (o: { label: string; value: string }) =>
                String(o.value) === String(objId)
            );
            if (match?.label) return <span>{match.label}</span>;
          }
        }

        // Fallback: show ID
        return <span>{String(objId)}</span>;
      }

      // If it's an object but not a reference, stringify it
      return <span className="break-words">{JSON.stringify(value)}</span>;
    }

    return (
      <span className="break-words">
        {typeof value === "string" ? value : String(value)}
      </span>
    );
  };

  // pre-filter helper so the grid never renders empty tiles
  const shouldRenderField = (
    f: FieldConfig & { showIf?: ShowIfRule },
    innerKey?: string
  ) => {
    if (isEmployeePhoto(f) || isBlank(f?.label)) return false;
    return shouldShowField({
      field: f,
      getValue,
      currentSectionKey: section.sectionKey,
      currentInnerSectionKey: innerKey,
    });
  };

  // Get section icon based on section label/key
  const getSectionIcon = (label: string, key?: string) => {
    const labelLower = label.toLowerCase();
    const keyLower = (key || "").toLowerCase();
    if (labelLower.includes("basic") || labelLower.includes("personal"))
      return UserIcon;
    if (labelLower.includes("contact")) return PhoneIcon;
    if (labelLower.includes("cultural")) return GlobeAltIcon;
    if (labelLower.includes("visa") || labelLower.includes("residency"))
      return CheckCircleIcon;
    if (labelLower.includes("emergency")) return ExclamationTriangleIcon;
    return UserIcon;
  };

  // Check if section should have special styling (emergency contact = red background)
  const isEmergencyContact = (label: string) => {
    return label.toLowerCase().includes("emergency");
  };

  // Check if field should be displayed as a badge (like residency status)
  const shouldShowAsBadge = (field: FieldConfig, value: any) => {
    const labelLower = (field.label || "").toLowerCase();
    return labelLower.includes("residency") && isNonEmpty(value);
  };

  // A single, uniformly aligned label-value row
  const FieldRow = ({
    field,
    innerSectionKey,
  }: {
    field: FieldConfig & { showIf?: ShowIfRule };
    innerSectionKey?: string;
  }) => {
    // defensive: should be filtered already, but keep this guard
    if (isEmployeePhoto(field) || isBlank(field.label)) return null;

    const v = getValue(section.sectionKey, field.key, innerSectionKey);
    const showAsBadge = shouldShowAsBadge(field, v);

    return (
      <div className="space-y-1">
        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
          {field.label}
        </p>
        <div className="flex items-center gap-2 min-w-0">
          {showAsBadge ? (
            <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-full text-sm font-medium">
              <CheckCircleIcon className="w-4 h-4" />
              {String(v)}
            </span>
          ) : (
            <div className="min-w-0 text-sm text-gray-900 font-medium">
              {renderValue(field, v)}
            </div>
          )}
          {onPropagateClick && !showAsBadge && (
            <button
              type="button"
              onClick={() =>
                onPropagateClick({
                  fieldKey: field.key,
                  fieldLabel: field.label,
                  value: v,
                  sectionKey: section.sectionKey,
                  innerSectionKey,
                })
              }
              title="Propagate this field to other Organisations"
              className="inline-flex items-center rounded-md px-1.5 py-1 text-amber-700 hover:text-amber-800 hover:bg-amber-50 border border-amber-200 shrink-0"
            >
              <ExclamationTriangleIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render main section fields if any
  const mainFields = (section.fields || []).filter((f) =>
    shouldRenderField(f as FieldConfig & { showIf?: ShowIfRule })
  );

  return (
    <div className="space-y-6">
      {/* Top bar / actions */}
      {headerRight && (
        <div className="flex items-center justify-end">{headerRight}</div>
      )}

      {/* Main section fields in a card if they exist */}
      {mainFields.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            {mainFields.map((f) => (
              <div key={f.key} className="min-w-0">
                <FieldRow field={f as FieldConfig & { showIf?: ShowIfRule }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inner sections as separate cards */}
      {(section.innerSections || []).map((inn) => {
        const visibleInnerFields =
          (inn.fields || []).filter((f) =>
            shouldRenderField(
              f as FieldConfig & { showIf?: ShowIfRule },
              inn.sectionKey
            )
          ) || [];

        // skip the entire block if no fields will render
        if (visibleInnerFields.length === 0) return null;

        const IconComponent = getSectionIcon(inn.sectionLabel, inn.sectionKey);
        const isEmergency = isEmergencyContact(inn.sectionLabel);

        return (
          <div
            key={inn.sectionKey}
            className={`bg-white rounded-lg shadow-sm border ${
              isEmergency ? "border-red-200 bg-red-50" : "border-gray-200"
            } p-6`}
          >
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-6">
              <div
                className={`p-2 rounded-lg ${
                  isEmergency ? "bg-red-100" : "bg-gray-100"
                }`}
              >
                <IconComponent
                  className={`w-5 h-5 ${
                    isEmergency ? "text-red-600" : "text-gray-600"
                  }`}
                />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">
                {inn.sectionLabel}
              </h4>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {visibleInnerFields.map((f) => (
                <div key={f.key} className="min-w-0">
                  <FieldRow
                    field={f as FieldConfig & { showIf?: ShowIfRule }}
                    innerSectionKey={inn.sectionKey}
                  />
                </div>
              ))}
            </div>

            {/* Visa Expiry Warning (if applicable) */}
            {inn.sectionKey?.toLowerCase().includes("visa") && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    Visa Expiring Soon
                  </p>
                  <p className="text-sm text-amber-800">
                    This employee&apos;s visa expires in approximately 2 years.
                    Consider renewal process.
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
