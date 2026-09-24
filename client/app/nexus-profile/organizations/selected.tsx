"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import axiosInstance from "@/app/lib/axios";
import { Tab } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import { TopProfileCard } from "@/app/components/shared/TopProfileCard";
import toast from "react-hot-toast";
import get from "lodash/get";
import set from "lodash/set";

/* =============================
   Types
   ============================= */
type FileLike = { url?: string; [k: string]: any };

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
  options?: string[];
  referenceModel?: string;
  placeholder?: string;
  required?: boolean;
  isAdditional?: boolean;
  showIf?: {
    fieldKey: string;
    operator: "equals" | "notEquals";
    value: any;
  };
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
   Utils (same logic as your self view)
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

const guessType = (v: any): Field["type"] => {
  if (typeof v === "boolean") return "checkbox";
  if (typeof v === "number") return "number";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v) || !isNaN(Date.parse(v))) return "date";
    return "text";
  }
  if (isObject(v)) {
    if ("url" in v && typeof (v as FileLike).url === "string") return "file";
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

// Build sections from profile (for non-docs view)
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
    "documents", // docs handled separately
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
          !("url" in val) &&
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

  // 2) Derive sections from profile
  const profSections = deriveSectionsFromProfile(profile);

  // 3) Union: config first, then add profile-only fields
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

// showIf helpers
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

// file helpers
const isFileValue = (v: any) =>
  v && typeof v === "object" && typeof v.url === "string";

/* =============================
   Page: Organization Employee View (READ-ONLY)
   ============================= */
export default function OrganizationEmployeeProfileView() {
  const search = useSearchParams();
  const tenantId = search.get("tenantId") || "";
  const branchId = search.get("branchId") || "";
  const employeeId = search.get("employeeId") || "";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null); // Store full employee object
  const [roles, setRoles] = useState<any[]>([]); // Store roles for mapping
  const [cfgSections, setCfgSections] = useState<Section[]>([]);

  // Fetch roles once on component mount
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const res = await axiosInstance.get("/roles");
        setRoles(res.data.data || []);
      } catch (error) {
        console.error("Failed to fetch roles", error);
      }
    };
    fetchRoles();
  }, []);

  // Fetch org-specific employee + config
  useEffect(() => {
    (async () => {
      if (!tenantId || !branchId || !employeeId) {
        setLoading(false);
        toast.error("Missing tenantId, branchId, or employeeId");
        return;
      }
      try {
        const [{ data: empRes }, { data: cfgRes }] = await Promise.all([
          axiosInstance.get(`/employees/${employeeId}`),
          axiosInstance.get("/employee-field-config/by-org", {
            params: { tenantId, branchId },
          }),
        ]);

        // Try to be defensive about shape - match the working page structure
        const emp = empRes?.data ?? empRes ?? null;
        const prof = emp?.employeeProfile ?? emp?.profile ?? emp ?? null;

        // Debug: Log employee data structure
        console.log("🔍 DEBUG: Employee data structure:", {
          empRes,
          emp,
          additionalDesignationIds: emp?.additionalDesignationIds,
          additionalRoleIds: emp?.additionalRoleIds,
          designation: emp?.designation,
          employeeProfile: emp?.employeeProfile,
        });

        const cfg = cfgRes?.data?.sections || cfgRes?.data || [];
        setEmployee(emp); // Store full employee object
        setProfile(prof); // Store profile for display sections
        setCfgSections(cfg);
      } catch (err) {
        console.error("Failed to load org employee profile/config", err);
        toast.error("Couldn't load organisation profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, branchId, employeeId]);

  // Build display sections (config-first) + filter hidden fields
  const sections = useMemo<Section[]>(() => {
    const base = buildDisplaySections(profile || {}, cfgSections);

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
  }, [profile, cfgSections]);

  // Docs display section (config + visible additionalFields)
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

    const visibleDocAdds = (profile?.additionalFields || []).filter(
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

    for (const a of visibleDocAdds) {
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
  }, [docsCfgSection, profile]);

  // Build docs values = profile.documents + visible additionalFields
  const buildDocsValuesFromProfile = useCallback((p: any) => {
    const base = { ...(p?.documents || {}) };
    const adds = Array.isArray(p?.additionalFields) ? p.additionalFields : [];

    for (const a of adds) {
      if (a?.sectionKey !== "documents" || a?.isShowInProfile !== true)
        continue;

      const path =
        a?.innerSectionKey && a.innerSectionKey !== null
          ? `${a.innerSectionKey}.${a.fieldKey}`
          : `${a.fieldKey}`;

      const existing = get(base, path);
      const existingHasUrl =
        typeof existing === "string"
          ? !!existing
          : !!(existing && typeof existing === "object" && existing.url);

      if (!existingHasUrl && a?.value) {
        set(base, path, a.value);
      }
    }
    return base;
  }, []);

  const docsValues = useMemo(
    () => ({ documents: buildDocsValuesFromProfile(profile || {}) }),
    [profile, buildDocsValuesFromProfile]
  );

  /* ---------- Render helpers ---------- */
  const renderValue = (f: Field, v: any) => {
    const Empty = <span className="text-sm text-gray-400">—</span>;

    if (isEmptyValue(v)) return Empty;

    switch (f.type) {
      case "checkbox":
        return <span className="text-sm">{v ? "Yes" : "No"}</span>;
      case "date": {
        try {
          const d = new Date(v);
          return (
            <span className="text-sm">
              {isNaN(d.getTime()) ? String(v) : d.toLocaleDateString()}
            </span>
          );
        } catch {
          return <span className="text-sm">{String(v)}</span>;
        }
      }
      case "file": {
        const url = typeof v === "string" ? v : v?.url;
        const name =
          typeof v === "string"
            ? v.split("/").pop()
            : v?.name || (v?.url || "").split("/").pop();
        return url ? (
          <a
            href={url}
            target="_blank"
            className="text-blue-600 underline text-sm"
          >
            {name || "View"}
          </a>
        ) : (
          Empty
        );
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

  // Prepare data for TopProfileCard
  const pd = profile?.personaldetails || {};
  const photo = pd?.employeephoto?.url;
  const fname = pd?.firstname;
  const lname = pd?.lastname;
  const location = pd?.location;
  const state = pd?.state;
  const mobile = pd?.mobile;

  // Try common email locations
  const email =
    profile?.email ||
    profile?.user?.email ||
    profile?.personaldetails?.email ||
    "—";

  // Get designation, departments, additional designations, and roles using useMemo
  // EXACTLY matching the working page implementation
  const { designation, departments, additionalDesignations, additionalRoles } =
    useMemo(() => {
      if (!employee) {
        return {
          designation: "",
          departments: [],
          additionalDesignations: [],
          additionalRoles: [],
        };
      }

      // Get designation and departments - EXACT match to working page
      const des = employee?.designation?.name || "";
      const depts: string[] = Array.isArray(
        employee?.designation?.departmentIds
      )
        ? (employee.designation.departmentIds || [])
            .map((d: any) => d?.name)
            .filter(Boolean)
        : [];

      // Get additional designations - EXACT match to working page
      const addDesignations: Array<{ _id: string; name: string }> =
        Array.isArray(employee?.additionalDesignationIds)
          ? employee.additionalDesignationIds
              .map((d: any) => ({
                _id: d?._id || d,
                name: d?.name || "Unknown",
              }))
              .filter((d: any) => d.name !== "Unknown")
          : [];

      // Get additional roles - EXACT match to working page
      const additionalRoleIds = employee?.additionalRoleIds || [];
      const addRoles: Array<{ roleId: string; name: string }> =
        additionalRoleIds
          .map((roleId: string) => {
            const role = roles.find((r) => r.roleId === roleId);
            return role ? { roleId: role.roleId, name: role.name } : null;
          })
          .filter((r: any) => r !== null);

      // Comprehensive debug logging
      console.log("🔍 DEBUG: TopProfileCard Data Extraction:", {
        hasEmployee: !!employee,
        employeeId: employee?._id,
        employeeKeys: employee ? Object.keys(employee) : [],
        designation: des,
        departmentsCount: depts.length,
        additionalDesignationIdsRaw: employee?.additionalDesignationIds,
        additionalDesignationIdsType: Array.isArray(
          employee?.additionalDesignationIds
        )
          ? "array"
          : typeof employee?.additionalDesignationIds,
        additionalDesignationIdsLength: Array.isArray(
          employee?.additionalDesignationIds
        )
          ? employee.additionalDesignationIds.length
          : 0,
        additionalRoleIdsRaw: employee?.additionalRoleIds,
        additionalRoleIdsType: Array.isArray(employee?.additionalRoleIds)
          ? "array"
          : typeof employee?.additionalRoleIds,
        additionalRoleIdsLength: Array.isArray(employee?.additionalRoleIds)
          ? employee.additionalRoleIds.length
          : 0,
        rolesCount: roles.length,
        rolesSample: roles
          .slice(0, 3)
          .map((r) => ({ roleId: r.roleId, name: r.name })),
        extractedAdditionalDesignations: addDesignations,
        extractedAdditionalRoles: addRoles,
      });

      return {
        designation: des,
        departments: depts,
        additionalDesignations: addDesignations,
        additionalRoles: addRoles,
      };
    }, [employee, roles]);

  /* ---------- Render ---------- */
  if (loading)
    return <div className="p-6 text-center text-gray-500">Loading...</div>;
  if (!profile)
    return (
      <div className="p-6 text-center text-red-500">
        No organisation employee profile found
      </div>
    );

  // Final debug log before rendering TopProfileCard
  console.log("🔍 DEBUG: Final data being passed to TopProfileCard:", {
    additionalDesignations,
    additionalRoles,
    additionalDesignationsLength: additionalDesignations.length,
    additionalRolesLength: additionalRoles.length,
  });

  return (
    <div className="space-y-10">
      {/* Top profile */}
      <TopProfileCard
        data={{
          photoUrl: photo,
          name: `${fname || ""} ${lname || ""}`.trim(),
          designation: designation,
          location: location && state ? `${location}, ${state}` : "",
          mobile: mobile,
          email: email,
          departments: departments,
          additionalDesignations: additionalDesignations,
          additionalRoles: additionalRoles,
        }}
        uploading={false}
        uploadPct={0}
        onSelectFile={() => {}}
        onRemove={() => {}}
      />

      <Card className="p-6 shadow-sm border rounded-xl">
        <Tab>
          <Tab.List className="flex flex-wrap gap-2 border-b pb-2 mb-6">
            {sections.map((section) => (
              <Tab.ListItem
                key={section.sectionKey}
                className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100"
              >
                {section.sectionLabel}
              </Tab.ListItem>
            ))}
            {docsDisplaySection && (
              <Tab.ListItem
                key="documents"
                className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100"
              >
                Documents
              </Tab.ListItem>
            )}
          </Tab.List>

          <Tab.Panels>
            {sections.map((section) => {
              const viewSource = profile;
              return (
                <Tab.Panel key={section.sectionKey} className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">
                      {section.sectionLabel}
                    </h3>
                    {/* READ-ONLY: no edit button */}
                  </div>

                  {section.sectionKey === "address" ? (
                    (() => {
                      const addrList =
                        Array.isArray(profile?.address) &&
                        profile.address.length
                          ? profile.address
                          : [{}];

                      return (
                        <div className="space-y-6">
                          {addrList.map((addr: any, idx: number) => (
                            <div
                              key={idx}
                              className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 border border-gray-200 rounded-xl bg-gray-50"
                            >
                              {section.fields
                                .filter(
                                  (f) => f.key !== "id" && f.key !== "_id"
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
                          ))}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {section.fields.map((f) => {
                        if (!shouldShow(viewSource, f)) return null;
                        const v = getWithAdditionalFallback(
                          profile,
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
                  {section.innerSections.map((inner) => (
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
                            profile,
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

            {/* Documents Panel (read-only) */}
            {docsDisplaySection && (
              <Tab.Panel key="documents" className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-gray-900">
                    Documents
                  </h3>
                </div>

                {(docsDisplaySection.innerSections || []).map((inner) => (
                  <div
                    key={inner.sectionKey}
                    className="mt-8 border-t border-gray-200 pt-6"
                  >
                    <h4 className="text-base font-medium text-gray-700 mb-4">
                      {inner.sectionLabel}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {(inner.fields || []).map((f) => {
                        const val =
                          get(
                            docsValues,
                            `documents.${inner.sectionKey}.${f.key}`
                          ) ?? null;

                        const fieldLike: Field = { ...f, type: "file" };
                        return (
                          <div key={f.key} className="space-y-1">
                            <div className="flex gap-4 items-start">
                              <p className="w-40 text-sm font-medium text-gray-600 capitalize">
                                {f.label}
                              </p>
                              <div className="flex-1">
                                {renderValue(fieldLike, val)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </Tab.Panel>
            )}
          </Tab.Panels>
        </Tab>
      </Card>
    </div>
  );
}
