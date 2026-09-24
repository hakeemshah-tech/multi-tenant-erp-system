"use client";

import React, { useEffect, useMemo, useState, startTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Checkbox } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import Cookies from "js-cookie";
import Image from "next/image";
import { useAppDispatch } from "@/app/store/hook";
import { getProfile } from "@/app/store/slices/authSlice";

type InvitationPreview = {
  tenantId?: string;
  branchId?: string;
  tenantName?: string;
  branchName?: string;
  invitedEmail?: string;
  designationName?: string;
};

export default function AcceptInvitation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const token = searchParams.get("token");
  const branchId = searchParams.get("branchId");
  const tenantId = searchParams.get("tenantId");

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);

  // Branch details state
  const [branchName, setBranchName] = useState<string>("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFileId, setLogoFileId] = useState<string | null>(null);

  useEffect(() => {
    const boot = async () => {
      if (!token) {
        setError("Invalid invitation link. No token found.");
        setLoading(false);
        return;
      }

      // Check if user is authenticated
      const accessToken = Cookies.get("accessToken");

      if (!accessToken) {
        // User not logged in - store token and check if user exists
        sessionStorage.setItem("pendingInvitationToken", token);
        if (branchId)
          sessionStorage.setItem("pendingInvitationBranchId", branchId);
        if (tenantId)
          sessionStorage.setItem("pendingInvitationTenantId", tenantId);

        // Try to fetch preview to get the invited email
        try {
          const { data } = await axiosInstance.get(
            "/employee-invitation/preview",
            {
              params: { token },
              skipAuthRedirect: true,
            }
          );

          const invitedEmail = data?.data?.email;

          // Store email to pre-fill login/register form
          if (invitedEmail) {
            sessionStorage.setItem("pendingInvitationEmail", invitedEmail);

            // Check if user with this email exists
            try {
              const checkResponse = await axiosInstance.get(
                "/auth/check-email",
                {
                  params: { email: invitedEmail },
                  skipAuthRedirect: true,
                }
              );

              const emailExists = checkResponse.data?.data?.exists;

              if (emailExists) {
                // User has account - redirect to login
                toast("Please login to accept the invitation", {
                  icon: "🔐",
                });
                startTransition(() => router.push("/login?invitation=true"));
              } else {
                // User doesn't have account - redirect to register
                toast("Please register to accept the invitation", {
                  icon: "📝",
                });
                startTransition(() => router.push("/register"));
              }
            } catch {
              // If email check fails, default to login page
              toast("Please login or register to accept the invitation", {
                icon: "ℹ️",
              });
              startTransition(() => router.push("/login?invitation=true"));
            }
          } else {
            // No email found in preview - default to login
            toast("Please login or register to accept the invitation", {
              icon: "ℹ️",
            });
            startTransition(() => router.push("/login?invitation=true"));
          }
        } catch {
          // If preview fails, still redirect to login
          toast("Please login or register to accept the invitation", {
            icon: "ℹ️",
          });
          startTransition(() => router.push("/login?invitation=true"));
        }
        return;
      }

      // User is authenticated - fetch preview
      try {
        const { data } = await axiosInstance.get(
          "/employee-invitation/preview",
          {
            params: { token },
            skipAuthRedirect: true,
          }
        );
        setPreview({
          tenantId: data?.data?.tenantId,
          branchId: data?.data?.branchId,
          tenantName: data?.data?.tenantName,
          branchName: data?.data?.branchName,
          invitedEmail: data?.data?.email,
          designationName: data?.data?.designationName,
        });
      } catch (err: any) {
        const msg = err?.response?.data?.message || "Invalid invitation token";
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    boot();
  }, [token, branchId, tenantId, router]);

  // Fetch branch details for logo and name
  useEffect(() => {
    const fetchBranchDetails = async () => {
      if (!branchId) return;

      try {
        const res = await axiosInstance.get(`/branches/${branchId}/details`, {
          skipAuthRedirect: true,
        });
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
        // Fallback to preview branch name if available
        if (preview?.branchName) {
          setBranchName(preview.branchName);
        }
      }
    };

    void fetchBranchDetails();
  }, [branchId, preview?.branchName]);

  // Fetch signed URL for logo when fileId changes
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
        }>(`/uploads/${logoFileId}/url`, {
          skipAuthRedirect: true,
        });
        setLogoUrl(urlRes.data?.url || null);
      } catch (error) {
        console.error("Failed to fetch logo signed URL", error);
        setLogoUrl(null);
      }
    };

    void fetchSignedUrl();
  }, [logoFileId]);

  const orgLabel = useMemo(() => {
    // Only show branch name, not tenant name
    if (branchName) return branchName;
    if (preview?.branchName) return preview.branchName;
    return "Organisation";
  }, [branchName, preview?.branchName]);

  const onAccept = async () => {
    if (!token) {
      setError("Invalid invitation link.");
      return;
    }
    try {
      setAccepting(true);
      const response = await axiosInstance.post("/employee-invitation/accept", {
        token,
      });

      // Update tokens if new ones are returned
      if (
        response.data?.data?.accessToken &&
        response.data?.data?.refreshToken
      ) {
        Cookies.set("accessToken", response.data.data.accessToken, {
          secure: true,
        });
        Cookies.set("refreshToken", response.data.data.refreshToken, {
          secure: true,
        });
      }

      toast.success("Invitation accepted. Welcome aboard!");

      // Refresh user profile to get updated assignments
      try {
        await dispatch(getProfile()).unwrap();
      } catch (profileError) {
        console.warn(
          "Failed to refresh profile after accepting invitation:",
          profileError
        );
        // Continue anyway - the backend should have the updated assignments
      }

      // Use preview data for branchId and tenantId (from API) or fallback to URL params
      const finalBranchId = preview?.branchId || branchId;
      const finalTenantId = preview?.tenantId || tenantId;

      // Build query for /join/review with tenantId & branchId when available
      const qp = new URLSearchParams();
      if (finalBranchId) qp.set("branchId", finalBranchId);
      if (finalTenantId) qp.set("tenantId", finalTenantId);

      // Small delay to ensure backend has processed the assignment update
      setTimeout(() => {
        startTransition(() => router.push(`/join-review?${qp.toString()}`));
      }, 500);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Failed to accept invitation.";
      toast.error(msg);
      setError(msg);
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-20 px-6">
        <div className="animate-pulse rounded-3xl border border-gray-200/70 shadow-xl shadow-gray-200/50 bg-white/90 backdrop-blur">
          <div className="h-28 rounded-t-3xl bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100" />
          <div className="p-6 space-y-4">
            <div className="h-6 w-2/3 bg-gray-200 rounded" />
            <div className="h-4 w-1/2 bg-gray-200 rounded" />
            <div className="h-4 w-3/5 bg-gray-200 rounded" />
            <div className="h-10 w-full bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error && !preview) {
    return (
      <div className="max-w-md mx-auto py-20 px-6">
        <div className="rounded-3xl border border-red-200 bg-white shadow-lg">
          <div className="rounded-t-3xl bg-gradient-to-r from-rose-50 to-red-50 p-6">
            <h2 className="text-lg font-semibold text-red-700">
              Invitation Error
            </h2>
          </div>
          <div className="p-6 text-sm text-gray-700">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="relative rounded-3xl border border-gray-200/70 shadow-xl shadow-gray-200/50 bg-white/90 backdrop-blur overflow-hidden">
        {/* Top banner */}
        <div className="relative">
          <div className="h-28 sm:h-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500" />
          <div className="absolute inset-0 flex items-center justify-center gap-3">
            {/* Branch Logo */}
            {logoUrl ? (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl overflow-hidden bg-white/90 border border-white/50 shadow-sm shrink-0">
                <Image
                  src={logoUrl}
                  alt={branchName || "Branch"}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              </div>
            ) : branchName ? (
              <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl bg-white/90 border border-white/50 shadow-sm text-lg sm:text-xl font-bold text-indigo-600 shrink-0">
                {branchName.charAt(0).toUpperCase()}
              </div>
            ) : null}

            {/* Branch Name */}
            {branchName && (
              <div className="px-4 py-2 rounded-full bg-white/90 border border-white/50 shadow-sm text-sm sm:text-base font-semibold text-gray-800">
                {branchName}
              </div>
            )}

            {/* Invitation badge - only show if no branch name */}
            {!branchName && (
              <div className="px-5 py-2 rounded-full bg-white/90 border border-white/50 shadow-sm text-xs font-medium text-gray-700">
                Invitation
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
              Join {orgLabel}
            </h1>
            <p className="text-sm text-gray-600">
              You’ve been invited
              {preview?.invitedEmail ? (
                <>
                  {" "}
                  as <span className="font-medium">{preview.invitedEmail}</span>
                </>
              ) : null}
              {preview?.designationName ? (
                <>
                  {" "}
                  for the role of{" "}
                  <span className="font-medium">{preview.designationName}</span>
                </>
              ) : null}
              .
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
            <ul className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="mt-0.5">✅</span>
                <span>Gain access to this organisation’s workspace.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5">🔒</span>
                <span>
                  Your data is handled as per the organisation’s policies.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5">🚪</span>
                <span>You can leave the organisation later from settings.</span>
              </li>
            </ul>
          </div>

          <div className="pt-2">
            <Checkbox
              label={
                <span className="text-sm text-gray-700">
                  I confirm I want to join{" "}
                  <span className="font-medium">{orgLabel}</span>.
                </span>
              }
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={accepting}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={onAccept}
              disabled={!agree || accepting}
              className="rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700"
            >
              {accepting ? "Accepting…" : "✅ Accept Invitation"}
            </Button>
          </div>
        </div>
      </div>

      {/* safe-area for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </div>
  );
}

//--------------------------------------------------NEW -------------------------------//
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
// import toast from "react-hot-toast";
// import get from "lodash/get";
// import set from "lodash/set";
// import { Card } from "@/app/components/ui/Card";
// import { useFormik } from "formik";
// import DocumentUploadModal from "../shared/DocumentUploadModal";

// // ✅ componentized & utils
// import FileUploadField from "../ui/FileUploadField";
// import DocumentSection from "../ui/DocumentSection";
// import AdditionalFieldsPromptModal, {
//   AdditionalCandidate,
// } from "./AdditionalFieldsPromptModal";

// import {
//   deepClean,
//   splitProfileAndAdditionalFields,
//   findValueByFieldKeyAnywhere,
//   buildAdditionalCandidates,
//   hasMeaningfulValue,
// } from "@/app/utils/profile-utils";

// import { useDebouncedAutosave } from "@/app/hooks/useDebouncedAutosave";
// import ReactDatePicker from "../ui/DatePicker";

// // ---------- Types ----------
// type InvitationContext = {
//   tenantId: string;
//   branchId: string;
//   designationId?: string | null;
//   tenantName?: string;
//   branchName?: string;
// };

// // ---------- Main component ----------
// export default function AcceptInvitation() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const token = searchParams.get("token");
//   const branchId = searchParams.get("branchId") as string;
//   const tenantId = searchParams.get("tenantId") as string;

//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);

//   const handleOpenModal = (field: any, fullPath: string) => {
//     setActiveUploadField({ field, fullPath });
//     setModalOpen(true);
//   };

//   const [ctx, setCtx] = useState<InvitationContext | null>(null);
//   const [sections, setSections] = useState<any[]>([]);
//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});
//   const [profile, setProfile] = useState<any>(null);
//   const [referenceOptions, setReferenceOptions] = useState<
//     Record<string, { label: string; value: string }[]>
//   >({});
//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({});
//   const [loading, setLoading] = useState(true);
//   const [saveStatus, setSaveStatus] = useState<
//     "idle" | "saving" | "success" | "error"
//   >("idle");
//   const [error, setError] = useState<string | null>(null);

//   // NEW: modal state for additional-fields prompt
//   const [postAcceptOpen, setPostAcceptOpen] = useState(false);
//   const [postAcceptCandidates, setPostAcceptCandidates] = useState<
//     AdditionalCandidate[]
//   >([]);
//   const [postAcceptBusy, setPostAcceptBusy] = useState(false);
//   const [lastCleanValues, setLastCleanValues] = useState<any>(null);

//   // ⬇️ visible sections for employees (hide employer-only)
//   const visibleSections = useMemo(
//     () => sections.filter((s) => !s.employeerOnlyEditable),
//     [sections]
//   );

//   // --- Cross-field helpers (put above the component) ---
//   type Occurrence = {
//     sectionKey: string;
//     innerSectionKey?: string | null;
//     type: string; // "file" | "text" | ...
//     isAdditional?: boolean;
//   };

//   const buildFieldKeyIndex = (cfg: any[]): Record<string, Occurrence[]> => {
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
//     // collect candidates from all exact places first
//     const candidates: any[] = [];
//     for (const occ of occs) {
//       const v = readExactFromProfile(prof, occ, fieldKey);
//       if (hasMeaningfulValue(v, occ.type)) candidates.push(v);
//     }
//     // any additionalFields by same key
//     const addAny = (prof.additionalFields || []).find(
//       (a: any) => a.fieldKey === fieldKey
//     )?.value;
//     if (hasMeaningfulValue(addAny)) candidates.push(addAny);
//     // deep search anywhere
//     const deep = findValueByFieldKeyAnywhere(prof, fieldKey);
//     if (hasMeaningfulValue(deep)) candidates.push(deep);

//     // pick best for files first (object with url), else non-empty string, else anything meaningful
//     for (const c of candidates) {
//       if (c && typeof c === "object" && "url" in c && c.url) return c;
//     }
//     for (const c of candidates) {
//       if (typeof c === "string" && c.trim()) return c;
//     }
//     for (const c of candidates) {
//       if (hasMeaningfulValue(c)) return c;
//     }
//     return undefined;
//   };

//   useEffect(() => {
//     const boot = async () => {
//       if (!token) return;
//       try {
//         // 1) auth + profile existence
//         const me = await axiosInstance.get("/auth/profile", {
//           skipAuthRedirect: true,
//         });
//         if (!me.data?.data?.isEmployeeProfileCreated) {
//           toast("Please complete your employee profile first.");
//           router.replace(
//             `/create-nexus-profile?next=/accept-invite?token=${token}`
//           );
//           return;
//         }

//         // 2) invitation context
//         const context: InvitationContext = { tenantId, branchId };
//         if (!context?.tenantId || !context?.branchId) {
//           throw new Error("Invalid invitation context.");
//         }
//         setCtx(context);

//         // 3) fetch data
//         const [{ data: employeeRes }, { data: configRes }] = await Promise.all([
//           axiosInstance.get(`/employee-profiles/self/get`),
//           axiosInstance.get("/employee-field-config/by-org", {
//             params: { tenantId: context.tenantId, branchId: context.branchId },
//           }),
//         ]);

//         const prof = employeeRes.data;
//         const cfg = configRes.data?.sections || configRes.data || [];
//         setProfile(prof);
//         setSections(cfg);

//         // 4) initial values with cross-fill by field.key
//         const values: Record<string, any> = {};

//         // address is special
//         values["address"] =
//           prof["address"] && Array.isArray(prof["address"])
//             ? prof["address"]
//             : [{}];

//         // pre-seed all groups to avoid holes when we set deep paths
//         for (const section of cfg) {
//           if (section.sectionKey === "address") continue;
//           if (!values[section.sectionKey]) values[section.sectionKey] = {};
//           for (const inner of section.innerSections || []) {
//             if (!values[section.sectionKey][inner.sectionKey]) {
//               values[section.sectionKey][inner.sectionKey] = {};
//             }
//           }
//         }

//         // field-key index
//         const idx = buildFieldKeyIndex(cfg);

//         // resolve once per fieldKey, write everywhere it appears
//         for (const [fieldKey, occs] of Object.entries(idx)) {
//           const resolved = resolveValueForKey(prof, fieldKey, occs);
//           for (const occ of occs) {
//             const path = occ.innerSectionKey
//               ? `${occ.sectionKey}.${occ.innerSectionKey}.${fieldKey}`
//               : `${occ.sectionKey}.${fieldKey}`;

//             // sensible default shape by type
//             const fallback =
//               occ.type === "checkbox" ? false : occ.type === "file" ? {} : "";

//             set(
//               values,
//               path,
//               hasMeaningfulValue(resolved, occ.type) ? resolved : fallback
//             );
//           }
//         }

//         // 5) Prefill OR-docs radio selection from filled values
//         const initialSelected: Record<string, string> = {};
//         for (const section of cfg) {
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
//         setLoading(false);
//       } catch (err: any) {
//         console.error(err);
//         if (err.response?.status === 401) {
//           toast.error("Please login to continue.");
//           router.replace(`/login?next=/accept-invite?token=${token}`);
//         } else {
//           setError(
//             err?.response?.data?.message || "Unable to load invitation."
//           );
//           setLoading(false);
//         }
//       }
//     };

//     boot();
//   }, [token, router, tenantId, branchId]);

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

//   // only visible fields should validate
//   const evaluateShowIf = useCallback(
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
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//     [] // uses formik at runtime; fine for validation runs
//   );

//   // ⚙️ Formik
//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     validate: (values) => {
//       const errors: any = {};
//       for (const section of visibleSections) {
//         for (const field of section.fields || []) {
//           if (!evaluateShowIf(field)) continue;
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
//               if (!evaluateShowIf(field)) continue;
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
//     onSubmit: async (values) => {
//       try {
//         setSaveStatus("saving");
//         const cleaned = deepClean(values);
//         setLastCleanValues(cleaned);
//         const { profileUpdates, additionalFields } =
//           splitProfileAndAdditionalFields(cleaned, sections);
//         const payload = { ...profileUpdates, additionalFields };

//         // Persist current profile data
//         await axiosInstance.put(`/employee-profiles/self/update`, payload);

//         // Accept invitation
//         await axiosInstance.post("/employee-invitation/accept", { token });

//         // Fetch fresh profile to evaluate isShowInProfile flags accurately
//         const { data: freshRes } = await axiosInstance.get(
//           `/employee-profiles/self/get`
//         );
//         const freshProfile = freshRes.data;
//         setProfile(freshProfile);

//         const candidates = buildAdditionalCandidates(
//           cleaned,
//           sections,
//           freshProfile,
//           get
//         );
//         if (candidates.length > 0) {
//           setPostAcceptCandidates(candidates);
//           setPostAcceptOpen(true);
//           toast.success("Invitation accepted! One more step…");
//         } else {
//           toast.success(
//             "Invitation accepted! You're now part of the organization."
//           );
//           startTransition(() => router.push("/nexus-profile"));
//         }
//         setSaveStatus("success");
//       } catch (e: any) {
//         console.error(e);
//         setSaveStatus("error");
//         toast.error(
//           e?.response?.data?.message || "Failed to accept invitation."
//         );
//       }
//     },
//   });

//   // 🔁 Debounced autosave
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
//       }
//     },
//     [sections]
//   );
//   const autoSave = useDebouncedAutosave(rawAutoSave, 700);

//   // 🔁 Address UI
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

//   const renderField = useCallback(
//     (field: any, pathPrefix: string) => {
//       // respect showIf
//       const findValue = (obj: any, key: string): any => {
//         if (!obj || typeof obj !== "object") return undefined;
//         if (key in obj) return obj[key];
//         for (const k of Object.keys(obj)) {
//           const found = findValue(obj[k], key);
//           if (found !== undefined) return found;
//         }
//         return undefined;
//       };
//       if (field.showIf) {
//         const actual = findValue(formik.values, field.showIf.fieldKey);
//         const visible =
//           field.showIf.operator === "equals"
//             ? actual === field.showIf.value
//             : actual !== field.showIf.value;
//         if (!visible) return null;
//       }

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
//                 dateFormat="dd/MM/yyyy" // ✅ use DD/MM/YYYY everywhere
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
//                   field.options
//                     .map((o: string) => ({ label: o, value: o }))
//                     .find((opt: any) => opt.value === value) || null
//                 }
//                 onChange={(opt: any) =>
//                   formik.setFieldValue(fullPath, opt?.value || "")
//                 }
//                 options={field.options.map((o: string) => ({
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
//           const opts = referenceOptions[field.referenceModel] || [];
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
//     [referenceOptions, formik, autoSave]
//   );

//   // ⬇️ Handlers for the post-accept modal
//   const handlePostAcceptClose = () => {
//     setPostAcceptOpen(false);
//     startTransition(() => router.push("/nexus-profile"));
//   };

//   const handlePostAcceptConfirm = async (selectedIds: string[]) => {
//     try {
//       setPostAcceptBusy(true);

//       // build a full update for *all* candidates, not only the checked ones
//       const selected = new Set(selectedIds);
//       const updates = postAcceptCandidates.map((c) => ({
//         sectionKey: c.sectionKey,
//         innerSectionKey: c.innerSectionKey ?? null,
//         fieldKey: c.fieldKey,
//         // keep the current value so the field isn't removed
//         value: get(lastCleanValues || formik.values, c.path),
//         isShowInProfile: selected.has(c.id), // true if checked, false if unchecked
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

//   if (!token) {
//     return (
//       <div className="max-w-xl mx-auto py-20 px-6 bg-white rounded-xl shadow-md">
//         <div className="p-6 text-center space-y-4">
//           <h2 className="text-xl font-semibold text-red-600">
//             Invalid Invitation
//           </h2>
//           <p className="text-gray-600">
//             No token found. Please check your invite link.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (loading) {
//     return (
//       <div className="max-w-xl mx-auto py-20 px-6 text-center">
//         <p className="text-gray-500">Loading invitation…</p>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="max-w-xl mx-auto py-20 px-6 bg-white rounded-xl shadow-md">
//         <div className="p-6 text-center space-y-4">
//           <h2 className="text-xl font-semibold text-red-600">Uh-oh</h2>
//           <p className="text-gray-600">{error}</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8 border border-gray-200/70 shadow-xl shadow-gray-200/40 rounded-2xl bg-white/90 backdrop-blur">
//         <div className="flex items-center justify-between flex-wrap gap-2">
//           <div>
//             <h2 className="text-xl font-semibold text-gray-900">
//               Accept Invitation
//             </h2>
//             {ctx?.tenantName || ctx?.branchName ? (
//               <p className="text-sm text-gray-500 mt-1">
//                 Organization: {ctx?.tenantName || "Tenant"} /{" "}
//                 {ctx?.branchName || "Branch"}
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

//         <form
//           onSubmit={formik.handleSubmit}
//           className="space-y-6"
//           id="acceptForm"
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
//                     renderAddressSection(section.fields)
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
//           {/*
//           <div className="flex justify-end pt-4">
//             <Button type="submit">✅ Accept Invitation</Button>
//           </div> */}
//         </form>
//       </Card>
//       {/* Fixed bottom action bar */}
//       <div className="fixed inset-x-0 bottom-0 z-40">
//         <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
//           <div className="relative">
//             {/* glow/edge */}
//             <div className="absolute inset-0 -top-2 blur-xl bg-gradient-to-r from-indigo-400/20 via-fuchsia-400/20 to-sky-400/20 pointer-events-none" />
//             {/* bar */}
//             <div className="relative flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/80 backdrop-blur px-4 sm:px-6 py-3 shadow-lg shadow-gray-200/50">
//               <div className="text-xs sm:text-sm text-gray-500 hidden sm:block">
//                 Review your details, then join the organization.
//               </div>

//               <div className="flex items-center gap-3">
//                 {saveStatus === "saving" && (
//                   <span className="text-xs sm:text-sm text-blue-600">
//                     Saving…
//                   </span>
//                 )}
//                 <Button
//                   type="submit"
//                   form="acceptForm"
//                   className="inline-flex items-center justify-center gap-2 rounded-xl px-5 sm:px-6 py-2.5
//                        bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600
//                        text-white shadow-md hover:shadow-lg transition
//                        hover:from-indigo-700 hover:via-purple-700 hover:to-blue-700
//                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400"
//                 >
//                   <span className="text-sm font-semibold">
//                     ✅ Accept Invitation
//                   </span>
//                 </Button>
//               </div>
//             </div>
//           </div>
//         </div>
//         {/* safe-area space for iOS */}
//         <div className="h-[env(safe-area-inset-bottom)]" />
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

//       {/* Post-accept prompt */}
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

// ------------------------------------------ABOVE LATEST CODE---------------------------------

// "use client";

// import { useEffect, useMemo, useState, useCallback, Fragment } from "react";
// import { useRouter, useSearchParams } from "next/navigation";
// import { Button, Input, Textarea, Checkbox, Select, Tab } from "rizzui";
// import axiosInstance from "@/app/lib/axios";
// import toast from "react-hot-toast";
// import get from "lodash/get";
// import set from "lodash/set";
// import ReactDatePicker from "@/app/components/ui/DatePicker";
// import { Card } from "@/app/components/ui/Card";
// import { useFormik } from "formik";
// import { useDropzone } from "react-dropzone";
// import { DownloadIcon, X, Info, CheckCircle2 } from "lucide-react";
// import DocumentUploadModal from "../shared/DocumentUploadModal";

// const formatDDMMYYYY = (d?: string | Date | null) => {
//   if (!d) return "—";
//   const date = typeof d === "string" ? new Date(d) : d;
//   if (!date || isNaN(date.getTime())) return "—";
//   const dd = String(date.getDate()).padStart(2, "0");
//   const mm = String(date.getMonth() + 1).padStart(2, "0");
//   const yyyy = date.getFullYear();
//   return `${dd}/${mm}/${yyyy}`;
// };

// // ---------- Types ----------

// type ValidityUnit = "Days" | "Months" | "Years";

// type InvitationContext = {
//   tenantId: string;
//   branchId: string;
//   designationId?: string | null;
//   tenantName?: string;
//   branchName?: string;
// };

// type AdditionalCandidate = {
//   id: string;
//   sectionKey: string;
//   innerSectionKey?: string | null;
//   fieldKey: string;
//   label: string;
//   sectionLabel: string;
//   innerSectionLabel?: string;
//   path: string; // dot-path into formik values
//   value: any;
// };

// // ---------- Small utils ----------

// const keyOf = (
//   sectionKey: string,
//   innerSectionKey: string | null | undefined,
//   fieldKey: string
// ) => `${sectionKey}||${innerSectionKey ?? ""}||${fieldKey}`;

// const hasMeaningfulValue = (val: any, fieldType?: string) => {
//   if (val === undefined || val === null) return false;
//   if (typeof val === "string") return val.trim().length > 0;
//   if (typeof val === "number") return true;
//   if (typeof val === "boolean") return val === true; // only true is meaningful for prompting
//   if (Array.isArray(val)) return val.length > 0;
//   if (typeof val === "object") {
//     // file field
//     if (fieldType === "file" && val?.url) return true;
//     return Object.keys(val).length > 0;
//   }
//   return !!val;
// };

// const previewValue = (val: any, fieldType?: string) => {
//   if (fieldType === "file") return val?.url ? "File uploaded" : "—";
//   if (typeof val === "boolean") return val ? "Yes" : "No";
//   if (typeof val === "number") return String(val);
//   if (typeof val === "string") {
//     // try date
//     const maybeDate = new Date(val);
//     if (!isNaN(maybeDate.getTime()) && /\d{4}-\d{2}-\d{2}/.test(val)) {
//       return formatDDMMYYYY(val);
//     }
//     return val.length > 36 ? val.slice(0, 33) + "…" : val;
//   }
//   if (typeof val === "object") {
//     if (val?._id && Object.keys(val).length === 1) return `Ref: ${val._id}`;
//     return "—";
//   }
//   return "—";
// };

// // ---------- Upload Field ----------

// const FileUploadField = ({
//   field,
//   fullPath,
//   value,
//   formik,
//   autoSave,
// }: {
//   field: any;
//   fullPath: string;
//   value: any;
//   formik: any;
//   autoSave: (values: any) => void;
// }) => {
//   const fileMeta = field.fileMeta || {};
//   const fileUrl = value?.url || "";
//   const isImage = (url: string) =>
//     /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(url);
//   const isUploadedImage = isImage(fileUrl);

//   const onDrop = useCallback(
//     async (acceptedFiles: File[]) => {
//       const file = acceptedFiles[0];
//       if (!file) return;

//       try {
//         const formData = new FormData();
//         formData.append("file", file);

//         const { data } = await axiosInstance.post("/uploads", formData, {
//           headers: { "Content-Type": "multipart/form-data" },
//         });

//         const uploadedUrl = data?.url || data?.data?.url;
//         if (!uploadedUrl) throw new Error("No file URL returned.");

//         const updated = { ...formik.values };
//         set(updated, `${fullPath}.url`, uploadedUrl);
//         formik.setFieldValue(`${fullPath}.url`, uploadedUrl);
//         autoSave(updated);
//         toast.success("File uploaded");
//       } catch (err) {
//         console.error("Upload error:", err);
//         toast.error("Upload failed");
//       }
//     },
//     [fullPath, formik, autoSave]
//   );

//   const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
//     onDrop,
//     multiple: false,
//     noClick: true,
//     accept: { "application/pdf": [], "image/*": [] },
//   });

//   const metaNodes: JSX.Element[] = [];

//   if (fileMeta.expiryDate) {
//     metaNodes.push(
//       <div key={`${fullPath}.expiryDate`} className="space-y-1">
//         <label className="text-sm font-medium text-gray-700">Expiry Date</label>
//         <ReactDatePicker
//           selected={value?.expiryDate ? new Date(value.expiryDate) : null}
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.expiryDate`,
//               val?.toISOString() || null
//             );
//             autoSave(formik.values);
//           }}
//           dateFormat="dd/MM/yyyy"
//         />
//       </div>
//     );
//   }

//   if (fileMeta.issuingDate) {
//     metaNodes.push(
//       <div key={`${fullPath}.issuingDate`} className="space-y-1">
//         <label className="text-sm font-medium text-gray-700">
//           Issuing Date
//         </label>
//         <ReactDatePicker
//           selected={value?.issuingDate ? new Date(value.issuingDate) : null}
//           onChange={(val) => {
//             formik.setFieldValue(
//               `${fullPath}.issuingDate`,
//               val?.toISOString() || null
//             );
//             autoSave(formik.values);
//           }}
//           dateFormat="dd/MM/yyyy"
//         />
//       </div>
//     );
//   }

//   if (fileMeta.referenceNumber) {
//     metaNodes.push(
//       <div key={`${fullPath}.referenceNumber`} className="space-y-1">
//         <Input
//           label="Reference Number"
//           value={value?.referenceNumber || ""}
//           onChange={(e) => {
//             formik.setFieldValue(`${fullPath}.referenceNumber`, e.target.value);
//             autoSave(formik.values);
//           }}
//         />
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-4 border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
//       <div className="flex justify-between items-center">
//         <label className="block text-sm font-medium text-gray-800">
//           {field.label}
//           {field.required && <span className="text-red-500 ml-1">*</span>}
//         </label>
//       </div>

//       {isUploadedImage ? (
//         <div
//           {...getRootProps()}
//           onClick={open}
//           className="relative cursor-pointer group"
//         >
//           <img
//             src={fileUrl}
//             alt="Uploaded"
//             className="max-w-xs max-h-48 rounded border shadow group-hover:opacity-80 transition"
//           />
//           <div className="text-sm text-gray-500 mt-2">
//             Click or drag another image to replace
//           </div>
//           <input {...getInputProps()} />
//         </div>
//       ) : (
//         <>
//           {fileUrl && (
//             <div className="flex flex-col items-start gap-1 text-sm">
//               <a
//                 href={fileUrl}
//                 target="_blank"
//                 rel="noopener noreferrer"
//                 className="text-blue-600 underline hover:text-blue-800"
//               >
//                 View File (
//                 {decodeURIComponent(fileUrl.split("/").pop() || "file")})
//               </a>
//             </div>
//           )}

//           <div
//             {...getRootProps()}
//             onClick={open}
//             className={`flex flex-col items-center justify-center text-center border-2 border-dashed rounded-md px-4 py-6 transition cursor-pointer ${
//               isDragActive
//                 ? "border-blue-500 bg-blue-50"
//                 : "border-gray-300 bg-gray-50 hover:border-gray-400"
//             }`}
//           >
//             <input {...getInputProps()} />
//             <div className="text-sm text-gray-600">
//               {fileUrl ? (
//                 <>
//                   <p className="text-green-700 font-medium mb-1">
//                     File uploaded ✔
//                   </p>
//                   <p>Click or drag a new file to replace</p>
//                 </>
//               ) : (
//                 <>
//                   <p className="mb-1">No file uploaded</p>
//                   <span>
//                     Drag & drop a file here or{" "}
//                     <span className="text-blue-600 underline cursor-pointer">
//                       browse
//                     </span>
//                   </span>
//                 </>
//               )}
//             </div>
//           </div>
//         </>
//       )}

//       {metaNodes.length > 0 && (
//         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
//           {metaNodes}
//         </div>
//       )}
//     </div>
//   );
// };

// // ---------- New: Post-accept prompt modal ----------

// function AdditionalFieldsPromptModal({
//   isOpen,
//   onClose,
//   candidates,
//   onConfirm,
//   loading,
// }: {
//   isOpen: boolean;
//   onClose: () => void;
//   candidates: AdditionalCandidate[];
//   onConfirm: (selectedIds: string[]) => void | Promise<void>;
//   loading?: boolean;
// }) {
//   const [selected, setSelected] = useState<Record<string, boolean>>({});
//   const allChecked =
//     Object.keys(selected).length > 0 && candidates.every((c) => selected[c.id]);

//   // useEffect(() => {
//   //   if (isOpen) {
//   //     const pre: Record<string, boolean> = {};
//   //     candidates.forEach((c) => (pre[c.id] = true)); // default check all
//   //     setSelected(pre);
//   //   }
//   // }, [isOpen, candidates]);

//   useEffect(() => {
//     if (isOpen) {
//       setSelected({}); // default: nothing selected => isShowInProfile:false by default
//     }
//   }, [isOpen, candidates]);

//   const toggleAll = () => {
//     if (allChecked) {
//       setSelected({});
//     } else {
//       const pre: Record<string, boolean> = {};
//       candidates.forEach((c) => (pre[c.id] = true));
//       setSelected(pre);
//     }
//   };

//   const handleConfirm = () => {
//     const ids = candidates.filter((c) => selected[c.id]).map((c) => c.id);
//     onConfirm(ids);
//   };

//   if (!isOpen) return null;

//   return (
//     <div className="fixed inset-0 z-[100] flex items-center justify-center">
//       <div
//         className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
//         onClick={onClose}
//       />
//       <div className="relative w-[95vw] max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
//         <div className="flex items-center justify-between px-5 py-4 border-b bg-gray-50/60">
//           <div className="flex items-center gap-2 text-gray-900">
//             <CheckCircle2 className="w-5 h-5 text-emerald-600" />
//             <h3 className="text-base font-semibold">Add to Main Profile</h3>
//           </div>
//           <button
//             className="p-2 rounded hover:bg-gray-100"
//             onClick={onClose}
//             aria-label="Close"
//           >
//             <X className="w-4 h-4 text-gray-600" />
//           </button>
//         </div>

//         <div className="px-5 py-4 space-y-4 overflow-y-auto">
//           <div className="flex items-start gap-2 text-sm text-gray-600">
//             <Info className="w-4 h-4 mt-0.5 text-blue-600" />
//             <p>
//               We noticed you’ve filled some{" "}
//               <span className="font-medium text-gray-800">
//                 additional fields
//               </span>
//               . Do you want to show them on your
//               <span className="font-medium text-gray-800"> Main Profile</span>?
//               Select the items to include.
//             </p>
//           </div>

//           <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-2">
//             <div className="text-sm text-gray-700">
//               {candidates.length} field{candidates.length > 1 ? "s" : ""}{" "}
//               eligible
//             </div>
//             <div className="flex items-center gap-3">
//               <Checkbox
//                 label="Select all"
//                 checked={allChecked}
//                 onChange={toggleAll}
//               />
//             </div>
//           </div>

//           <ul className="divide-y border rounded-lg">
//             {candidates.map((c) => (
//               <li key={c.id} className="p-3 hover:bg-gray-50">
//                 <div className="flex items-start gap-3">
//                   <Checkbox
//                     checked={!!selected[c.id]}
//                     onChange={(e) =>
//                       setSelected((s) => ({ ...s, [c.id]: !s[c.id] }))
//                     }
//                   />
//                   <div className="flex-1">
//                     <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
//                       <span className="font-medium text-gray-900">
//                         {c.label}
//                       </span>
//                       <span className="text-xs text-gray-500">
//                         {c.sectionLabel}
//                         {c.innerSectionLabel ? ` › ${c.innerSectionLabel}` : ""}
//                       </span>
//                     </div>
//                     <div className="text-xs text-gray-600 mt-1">
//                       <span className="text-gray-500">Current:</span>{" "}
//                       {previewValue(c.value)}
//                     </div>
//                   </div>
//                 </div>
//               </li>
//             ))}
//           </ul>
//         </div>

//         <div className="flex items-center justify-end gap-3 px-5 py-4 border-t bg-gray-50/60">
//           <Button variant="outline" onClick={onClose} disabled={loading}>
//             Not now
//           </Button>
//           <Button
//             onClick={handleConfirm}
//             disabled={loading || candidates.every((c) => !selected[c.id])}
//           >
//             {loading ? "Updating…" : "Add to Profile"}
//           </Button>
//         </div>
//       </div>
//     </div>
//   );
// }

// // ---------- Main component ----------

// export default function AcceptInvitation() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const token = searchParams.get("token");
//   const branchId = searchParams.get("branchId") as string;
//   const tenantId = searchParams.get("tenantId") as string;

//   const [modalOpen, setModalOpen] = useState(false);
//   const [activeUploadField, setActiveUploadField] = useState<any>(null);

//   const handleOpenModal = (field: any, fullPath: string) => {
//     setActiveUploadField({ field, fullPath });
//     setModalOpen(true);
//   };

//   const [ctx, setCtx] = useState<InvitationContext | null>(null);
//   const [sections, setSections] = useState<any[]>([]);
//   const [initialValues, setInitialValues] = useState<Record<string, any>>({});
//   const [profile, setProfile] = useState<any>(null);
//   const [referenceOptions, setReferenceOptions] = useState<
//     Record<string, { label: string; value: string }[]>
//   >({});
//   const [selectedDocuments, setSelectedDocuments] = useState<
//     Record<string, string>
//   >({});
//   const [loading, setLoading] = useState(true);
//   const [saveStatus, setSaveStatus] = useState<
//     "idle" | "saving" | "success" | "error"
//   >("idle");
//   const [error, setError] = useState<string | null>(null);

//   // NEW: modal state for additional-fields prompt
//   const [postAcceptOpen, setPostAcceptOpen] = useState(false);
//   const [postAcceptCandidates, setPostAcceptCandidates] = useState<
//     AdditionalCandidate[]
//   >([]);
//   const [postAcceptBusy, setPostAcceptBusy] = useState(false);
//   const [lastCleanValues, setLastCleanValues] = useState<any>(null);

//   // ⬇️ visible sections for employees (hide employer-only)
//   const visibleSections = useMemo(
//     () => sections.filter((s) => !s.employeerOnlyEditable),
//     [sections]
//   );

//   // Find the first occurrence of a key anywhere in the profile tree
//   const findValueByFieldKeyAnywhere = (obj: any, targetKey: string): any => {
//     if (!obj || typeof obj !== "object") return undefined;

//     if (Array.isArray(obj)) {
//       for (const item of obj) {
//         const v = findValueByFieldKeyAnywhere(item, targetKey);
//         if (v !== undefined) return v;
//       }
//       return undefined;
//     }

//     for (const [k, v] of Object.entries(obj)) {
//       if (k === targetKey && v !== undefined && v !== null) {
//         // ignore empty objects
//         if (
//           typeof v === "object" &&
//           !Array.isArray(v) &&
//           Object.keys(v).length === 0
//         ) {
//           // keep searching
//         } else {
//           return v;
//         }
//       }
//       const nested = findValueByFieldKeyAnywhere(v as any, targetKey);
//       if (nested !== undefined) return nested;
//     }
//     return undefined;
//   };

//   // 1) Verify login & profile; fetch invitation context, config, profile
//   useEffect(() => {
//     const boot = async () => {
//       if (!token) return;
//       try {
//         const me = await axiosInstance.get("/auth/profile", {
//           skipAuthRedirect: true,
//         });
//         if (!me.data?.data?.isEmployeeProfileCreated) {
//           toast("Please complete your employee profile first.");
//           router.replace(
//             `/create-nexus-profile?next=/accept-invite?token=${token}`
//           );
//           return;
//         }

//         const context: InvitationContext = { tenantId, branchId };
//         if (!context?.tenantId || !context?.branchId) {
//           throw new Error("Invalid invitation context.");
//         }
//         setCtx(context);

//         const [{ data: employeeRes }, { data: configRes }] = await Promise.all([
//           axiosInstance.get(`/employee-profiles/self/get`),
//           axiosInstance.get("/employee-field-config/by-org", {
//             params: { tenantId: context.tenantId, branchId: context.branchId },
//           }),
//         ]);

//         const prof = employeeRes.data;
//         const cfg = configRes.data?.sections || configRes.data || [];
//         setProfile(prof);
//         setSections(cfg);

//         // Build initial values from config + profile (+ additionalFields)
//         const values: Record<string, any> = {};
//         for (const section of cfg) {
//           const group = section.sectionKey;

//           if (group === "address") {
//             values[group] =
//               prof[group] && Array.isArray(prof[group]) ? prof[group] : [{}];
//             continue;
//           }

//           for (const field of section.fields || []) {
//             let val;
//             if (field.isAdditional) {
//               let match =
//                 prof.additionalFields?.find(
//                   (f: any) =>
//                     f.sectionKey === section.sectionKey &&
//                     (f.innerSectionKey ?? null) === null &&
//                     f.fieldKey === field.key
//                 ) || null;

//               if (!match) {
//                 match =
//                   prof.additionalFields?.find(
//                     (f: any) => f.fieldKey === field.key
//                   ) || null;
//               }

//               val = match?.value;

//               // 🔁 NEW: search entire profile object by key if still empty
//               if (
//                 val === undefined ||
//                 val === null ||
//                 (typeof val === "string" && val.trim() === "") ||
//                 (typeof val === "object" &&
//                   !Array.isArray(val) &&
//                   Object.keys(val).length === 0)
//               ) {
//                 const anyVal = findValueByFieldKeyAnywhere(prof, field.key);
//                 if (anyVal !== undefined) val = anyVal;
//               }
//             } else {
//               val = get(prof, `${group}.${field.key}`);
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

//           for (const inner of section.innerSections || []) {
//             for (const field of inner.fields || []) {
//               let val;
//               if (field.isAdditional) {
//                 let match =
//                   prof.additionalFields?.find(
//                     (f: any) =>
//                       f.sectionKey === section.sectionKey &&
//                       (f.innerSectionKey ?? null) === inner.sectionKey &&
//                       f.fieldKey === field.key
//                   ) || null;

//                 if (!match) {
//                   match =
//                     prof.additionalFields?.find(
//                       (f: any) => f.fieldKey === field.key
//                     ) || null;
//                 }

//                 val = match?.value;

//                 // 🔁 NEW: search entire profile object by key if still empty
//                 if (
//                   val === undefined ||
//                   val === null ||
//                   (typeof val === "string" && val.trim() === "") ||
//                   (typeof val === "object" &&
//                     !Array.isArray(val) &&
//                     Object.keys(val).length === 0)
//                 ) {
//                   const anyVal = findValueByFieldKeyAnywhere(prof, field.key);
//                   if (anyVal !== undefined) val = anyVal;
//                 }
//               } else {
//                 val = get(prof, `${group}.${inner.sectionKey}.${field.key}`);
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

//         // build OR doc selections if needed
//         const initialSelectedDocs: Record<string, string> = {};
//         for (const section of cfg) {
//           for (const inner of section.innerSections || []) {
//             if (inner.requirementMode === "OR") {
//               const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//               const selected = inner.fields.find((field: any) => {
//                 let val;
//                 if (field.isAdditional) {
//                   const match = prof.additionalFields?.find(
//                     (f: any) =>
//                       f.sectionKey === section.sectionKey &&
//                       (f.innerSectionKey ?? null) === inner.sectionKey &&
//                       f.fieldKey === field.key
//                   );
//                   val = match?.value;
//                   // 🔁 NEW: search entire profile by key if still empty
//                   if (
//                     val === undefined ||
//                     val === null ||
//                     (typeof val === "string" && val.trim() === "") ||
//                     (typeof val === "object" &&
//                       !Array.isArray(val) &&
//                       Object.keys(val).length === 0)
//                   ) {
//                     const anyVal = findValueByFieldKeyAnywhere(prof, field.key);
//                     if (anyVal !== undefined) val = anyVal;
//                   }
//                 } else {
//                   val = get(
//                     prof,
//                     `${section.sectionKey}.${inner.sectionKey}.${field.key}`
//                   );
//                 }
//                 return (
//                   val &&
//                   (typeof val === "string" ||
//                     (typeof val === "object" && Object.keys(val).length > 0))
//                 );
//               });
//               if (selected) initialSelectedDocs[groupPath] = selected.key;
//             }
//           }
//         }

//         setSelectedDocuments(initialSelectedDocs);
//         setInitialValues(values);
//         setLoading(false);
//       } catch (err: any) {
//         console.error(err);
//         if (err.response?.status === 401) {
//           toast.error("Please login to continue.");
//           router.replace(`/login?next=/accept-invite?token=${token}`);
//         } else {
//           setError(
//             err?.response?.data?.message || "Unable to load invitation."
//           );
//           setLoading(false);
//         }
//       }
//     };
//     boot();
//   }, [token, router]);

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

//   const deepClean = (obj: any): any => {
//     if (Array.isArray(obj)) {
//       return obj.map(deepClean).filter((v) => v !== undefined && v !== null);
//     }
//     if (obj && typeof obj === "object") {
//       const out: any = {};
//       for (const k of Object.keys(obj)) {
//         const v = obj[k];
//         if (
//           v === "" ||
//           (v &&
//             typeof v === "object" &&
//             !Array.isArray(v) &&
//             Object.keys(v).length === 0)
//         )
//           continue;
//         out[k] = typeof v === "object" ? deepClean(v) : v;
//       }
//       return out;
//     }
//     return obj;
//   };

//   // ⬇️ skip employer-only sections when building payload
//   const splitProfileAndAdditionalFields = (values: any, sections: any[]) => {
//     const profileUpdates: any = {};
//     const additionalFields: any[] = [];

//     for (const section of sections) {
//       if (section.employeerOnlyEditable) continue; // 🚫 ignore in employee UI/save

//       const sectionGroup = values[section.sectionKey];
//       if (!sectionGroup) continue;

//       if (section.sectionKey === "address") {
//         profileUpdates["address"] = values["address"];
//         continue;
//       }

//       // top-level fields
//       for (const field of section.fields || []) {
//         const val = sectionGroup[field.key];
//         if (field.isAdditional) {
//           if (val !== undefined) {
//             additionalFields.push({
//               sectionKey: section.sectionKey,
//               innerSectionKey: null,
//               fieldKey: field.key,
//               value: val,
//             });
//           }
//         } else {
//           if (!profileUpdates[section.sectionKey])
//             profileUpdates[section.sectionKey] = {};
//           profileUpdates[section.sectionKey][field.key] = val;
//         }
//       }

//       // inner sections
//       for (const inner of section.innerSections || []) {
//         const innerGroup = sectionGroup?.[inner.sectionKey];
//         if (!innerGroup) continue;

//         for (const field of inner.fields || []) {
//           const val = innerGroup[field.key];
//           if (field.isAdditional) {
//             if (val !== undefined) {
//               additionalFields.push({
//                 sectionKey: section.sectionKey,
//                 innerSectionKey: inner.sectionKey,
//                 fieldKey: field.key,
//                 value: val,
//               });
//             }
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
//   };

//   const evaluateShowIf = (field: any) => {
//     if (!field.showIf) return true;
//     const findValue = (obj: any, key: string): any => {
//       if (!obj || typeof obj !== "object") return undefined;
//       if (key in obj) return obj[key];
//       for (const k of Object.keys(obj)) {
//         const found = findValue(obj[k], key);
//         if (found !== undefined) return found;
//       }
//       return undefined;
//     };
//     const actual = findValue(formik.values, field.showIf.fieldKey);
//     return field.showIf.operator === "equals"
//       ? actual === field.showIf.value
//       : actual !== field.showIf.value;
//   };

//   // 🔎 Build candidates after acceptance
//   const buildAdditionalCandidates = (
//     cleanedValues: any,
//     cfgSections: any[],
//     prof: any
//   ): AdditionalCandidate[] => {
//     const addMapByExact: Record<string, any> = {};
//     const addMapByKey: Record<string, any> = {};
//     (prof?.additionalFields || []).forEach((af: any) => {
//       addMapByExact[
//         `${af.sectionKey}||${af.innerSectionKey ?? ""}||${af.fieldKey}`
//       ] = af;
//       if (!addMapByKey[af.fieldKey]) addMapByKey[af.fieldKey] = af; // fieldKey-only fallback
//     });

//     const cands: AdditionalCandidate[] = [];

//     for (const section of cfgSections) {
//       const sectionLabel = section.sectionLabel || section.sectionKey;
//       // top-level additional fields
//       for (const field of section.fields || []) {
//         if (!field.isAdditional) continue;
//         const path = `${section.sectionKey}.${field.key}`;
//         const val = get(cleanedValues, path);
//         // const id = keyOf(section.sectionKey, null, field.key);
//         // let existing = addMapByExact[id];
//         // // 🔁 fallback by fieldKey only
//         // if (!existing) existing = addMapByKey[field.key];
//         // if (!existing) continue; // ask only if exists in profile.additionalFields
//         // if (existing?.isShowInProfile === true) continue;
//         // if (!hasMeaningfulValue(val, field.type)) continue;
//         const id = keyOf(section.sectionKey, null, field.key);
//         const exact = addMapByExact[id];
//         const existing = exact || addMapByKey[field.key]; // fallback only for value discovery

//         // 🔒 HIDE rule: hide ONLY if exact match is already shown
//         if (exact?.isShowInProfile === true) continue;

//         if (!existing) continue; // no stored record at all
//         if (!hasMeaningfulValue(val, field.type)) continue;
//         cands.push({
//           id,
//           sectionKey: section.sectionKey,
//           innerSectionKey: null,
//           fieldKey: field.key,
//           label: field.label,
//           sectionLabel,
//           path,
//           value: val,
//         });
//       }

//       // inner additional fields
//       for (const inner of section.innerSections || []) {
//         const innerLabel = inner.sectionLabel || inner.sectionKey;
//         for (const field of inner.fields || []) {
//           if (!field.isAdditional) continue;
//           const path = `${section.sectionKey}.${inner.sectionKey}.${field.key}`;
//           const val = get(cleanedValues, path);

//           // const id = keyOf(section.sectionKey, inner.sectionKey, field.key);
//           // let existing = addMapByExact[id];
//           // // 🔁 fallback by fieldKey only
//           // if (!existing) existing = addMapByKey[field.key];
//           // if (!existing) continue;
//           // if (existing?.isShowInProfile === true) continue;
//           // if (!hasMeaningfulValue(val, field.type)) continue;
//           const id = keyOf(section.sectionKey, inner.sectionKey, field.key);
//           const exact = addMapByExact[id];
//           const existing = exact || addMapByKey[field.key];

//           // 🔒 HIDE rule: hide ONLY if exact match is already shown
//           if (exact?.isShowInProfile === true) continue;

//           if (!existing) continue;
//           if (!hasMeaningfulValue(val, field.type)) continue;
//           cands.push({
//             id,
//             sectionKey: section.sectionKey,
//             innerSectionKey: inner.sectionKey,
//             fieldKey: field.key,
//             label: field.label,
//             sectionLabel,
//             innerSectionLabel: innerLabel,
//             path,
//             value: val,
//           });
//         }
//       }
//     }

//     return cands;
//   };

//   const formik = useFormik({
//     enableReinitialize: true,
//     initialValues,
//     validate: (values) => {
//       const errors: any = {};
//       // ✅ validate only visible sections
//       for (const section of visibleSections) {
//         for (const field of section.fields || []) {
//           if (!evaluateShowIf(field)) continue;
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
//               if (!evaluateShowIf(field)) continue;
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
//     onSubmit: async (values) => {
//       try {
//         setSaveStatus("saving");
//         const cleaned = deepClean(values);
//         setLastCleanValues(cleaned);
//         const { profileUpdates, additionalFields } =
//           splitProfileAndAdditionalFields(cleaned, sections);
//         const payload = { ...profileUpdates, additionalFields };

//         // Persist current profile data
//         await axiosInstance.put(`/employee-profiles/self/update`, payload);

//         // Accept invitation
//         await axiosInstance.post("/employee-invitation/accept", { token });

//         // 🔄 Fetch fresh profile to evaluate isShowInProfile flags accurately
//         const { data: freshRes } = await axiosInstance.get(
//           `/employee-profiles/self/get`
//         );
//         const freshProfile = freshRes.data;
//         setProfile(freshProfile);

//         const candidates = buildAdditionalCandidates(
//           cleaned,
//           sections,
//           freshProfile
//         );
//         if (candidates.length > 0) {
//           setPostAcceptCandidates(candidates);
//           setPostAcceptOpen(true);
//           toast.success("Invitation accepted! One more step…");
//         } else {
//           toast.success(
//             "Invitation accepted! You're now part of the organization."
//           );
//           router.push("/nexus-profile");
//         }
//         setSaveStatus("success");
//       } catch (e: any) {
//         console.error(e);
//         setSaveStatus("error");
//         toast.error(
//           e?.response?.data?.message || "Failed to accept invitation."
//         );
//       }
//     },
//   });

//   const autoSave = async (values: any) => {
//     try {
//       setSaveStatus("saving");
//       const cleaned = deepClean(values);
//       const { profileUpdates, additionalFields } =
//         splitProfileAndAdditionalFields(cleaned, sections);
//       const payload = { ...profileUpdates, additionalFields };
//       await axiosInstance.put(`/employee-profiles/self/update`, payload);
//       setSaveStatus("success");
//     } catch (e) {
//       console.error("Auto-save error", e);
//       setSaveStatus("error");
//     }
//   };

//   // 🔁 Address UI
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

//   const renderField = (field: any, pathPrefix: string) => {
//     if (!evaluateShowIf(field)) return null;

//     const fullPath = `${pathPrefix}.${field.key}`;
//     const value = get(formik.values, fullPath);
//     const error = get(formik.errors, fullPath);
//     const touched = get(formik.touched, fullPath);
//     const showError = Boolean(touched && error);

//     const Label = (
//       <>
//         {field.label}
//         {field.required && <span className="text-red-500 ml-1">*</span>}
//       </>
//     );

//     switch (field.type) {
//       case "text":
//       case "email":
//         return (
//           <div key={fullPath}>
//             <Input
//               type={field.type}
//               label={Label}
//               placeholder={field.placeholder}
//               value={value || ""}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//               onBlur={() => autoSave(formik.values)}
//             />
//             {showError && (
//               <p className="text-xs text-red-500 mt-1">{error as any}</p>
//             )}
//           </div>
//         );
//       case "textarea":
//         return (
//           <div key={fullPath}>
//             <Textarea
//               label={Label}
//               placeholder={field.placeholder}
//               value={value || ""}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//               onBlur={() => autoSave(formik.values)}
//             />
//             {showError && (
//               <p className="text-xs text-red-500 mt-1">{error as any}</p>
//             )}
//           </div>
//         );
//       case "checkbox":
//         return (
//           <div key={fullPath}>
//             <Checkbox
//               label={Label}
//               checked={!!value}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.checked)}
//               onBlur={() => autoSave(formik.values)}
//             />
//             {showError && (
//               <p className="text-xs text-red-500 mt-1">{error as any}</p>
//             )}
//           </div>
//         );
//       case "date": {
//         return (
//           <div key={fullPath} className="space-y-1">
//             <label className="text-sm font-medium text-gray-700">{Label}</label>
//             <ReactDatePicker
//               selected={value ? new Date(value) : null}
//               dateFormat="dd/MM/yyyy" // ✅ use DD/MM/YYYY everywhere
//               onChange={(val) => {
//                 const iso = val ? val.toISOString() : null;
//                 formik.setFieldValue(fullPath, iso);
//                 const updated = { ...formik.values };
//                 set(updated, fullPath, iso);
//                 autoSave(updated);
//               }}
//               inputProps={{ placeholder: field.placeholder }}
//               onBlur={() => formik.setFieldTouched(fullPath, true)}
//             />
//             {showError && (
//               <p className="text-xs text-red-500 mt-1">{error as any}</p>
//             )}
//           </div>
//         );
//       }
//       case "number":
//         return (
//           <div key={fullPath}>
//             <Input
//               type="number"
//               label={Label}
//               placeholder={field.placeholder}
//               value={value ?? ""}
//               onChange={(e) => formik.setFieldValue(fullPath, e.target.value)}
//               onBlur={() => autoSave(formik.values)}
//             />
//             {showError && (
//               <p className="text-xs text-red-500 mt-1">{error as any}</p>
//             )}
//           </div>
//         );
//       case "select":
//         return (
//           <div key={fullPath}>
//             <Select
//               label={Label}
//               placeholder={field.placeholder}
//               value={
//                 field.options
//                   .map((o: string) => ({ label: o, value: o }))
//                   .find((opt: any) => opt.value === value) || null
//               }
//               onChange={(opt: any) =>
//                 formik.setFieldValue(fullPath, opt?.value || "")
//               }
//               options={field.options.map((o: string) => ({
//                 label: o,
//                 value: o,
//               }))}
//               onBlur={() => autoSave(formik.values)}
//             />
//             {showError && (
//               <p className="text-xs text-red-500 mt-1">{error as any}</p>
//             )}
//           </div>
//         );
//       case "reference": {
//         const opts = referenceOptions[field.referenceModel] || [];
//         return (
//           <div key={fullPath}>
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
//               onChange={(opt: any) => {
//                 const id = opt?.value || "";
//                 formik.setFieldValue(fullPath, id);
//                 const updated = { ...formik.values };
//                 set(updated, fullPath, id);
//                 autoSave(updated);
//               }}
//               options={opts}
//               onBlur={() => formik.setFieldTouched(fullPath, true)}
//             />
//             {showError && (
//               <p className="text-xs text-red-500 mt-1">{error as any}</p>
//             )}
//           </div>
//         );
//       }
//       case "file":
//         return (
//           <FileUploadField
//             key={fullPath}
//             field={field}
//             fullPath={fullPath}
//             value={value}
//             formik={formik}
//             autoSave={autoSave}
//           />
//         );
//       default:
//         return null;
//     }
//   };

//   const renderDocumentSection = (inner: any, sectionKeyPath: string) => {
//     const mode = inner.requirementMode || "AND";
//     const uniqueKey = sectionKeyPath;
//     const fields = inner.fields || [];

//     return (
//       <div className="overflow-x-auto rounded-lg shadow ring-1 ring-gray-200">
//         {mode === "OR" && (
//           <div className="mt-4 max-w-sm px-3 pb-3">
//             <Select
//               placeholder="Choose document"
//               value={
//                 fields
//                   .map((f: any) => ({ label: f.label, value: f.key }))
//                   .find(
//                     (opt: any) => opt.value === selectedDocuments[uniqueKey]
//                   ) || null
//               }
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

//         <table className="min-w-full text-sm bg-white">
//           <thead className="bg-gray-50 text-gray-700">
//             <tr>
//               <th className="px-4 py-3 border-b font-semibold text-left">
//                 Document
//               </th>
//               <th className="px-4 py-3 border-b font-semibold text-left">
//                 Status
//               </th>
//               <th className="px-4 py-3 border-b font-semibold text-left">
//                 Issue Date
//               </th>
//               <th className="px-4 py-3 border-b font-semibold text-left">
//                 Expiry Date
//               </th>
//               <th className="px-4 py-3 border-b font-semibold text-center">
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

//               const rowError = get(formik.errors, fullPath);
//               const showRowError = Boolean(rowError) && formik.submitCount > 0;

//               const status = value?.url ? "✅ Uploaded" : "❌ Not Uploaded";
//               const issueDate = value?.issuingDate
//                 ? formatDDMMYYYY(value.issuingDate)
//                 : "—";
//               const expiryDate = value?.expiryDate
//                 ? formatDDMMYYYY(value.expiryDate)
//                 : "—";

//               const handleDownload = () => {
//                 if (!value?.url) return;
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
//                   className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
//                 >
//                   <td className="px-4 py-3 border-b font-medium text-gray-900">
//                     {field.label}
//                   </td>

//                   <td className="px-4 py-3 border-b text-gray-700">
//                     <div>{status}</div>
//                     {showRowError && (
//                       <div className="mt-1 text-xs text-red-500">
//                         {String(rowError)}
//                       </div>
//                     )}
//                   </td>

//                   <td className="px-4 py-3 border-b text-gray-700">
//                     {issueDate}
//                   </td>
//                   <td className="px-4 py-3 border-b text-gray-700">
//                     {expiryDate}
//                   </td>

//                   <td className="px-4 py-3 border-b text-center">
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
//                           type="button"
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

//   // ⬇️ Handlers for the post-accept modal
//   const handlePostAcceptClose = () => {
//     setPostAcceptOpen(false);
//     router.push("/nexus-profile");
//   };

//   const handlePostAcceptConfirm = async (selectedIds: string[]) => {
//     try {
//       setPostAcceptBusy(true);

//       // build a full update for *all* candidates, not only the checked ones
//       const selected = new Set(selectedIds);
//       const updates = postAcceptCandidates.map((c) => ({
//         sectionKey: c.sectionKey,
//         innerSectionKey: c.innerSectionKey ?? null,
//         fieldKey: c.fieldKey,
//         // keep the current value so the field isn't removed
//         value: get(lastCleanValues || formik.values, c.path),
//         isShowInProfile: selected.has(c.id), // true if checked, false if unchecked
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

//   if (!token) {
//     return (
//       <div className="max-w-xl mx-auto py-20 px-6 bg-white rounded-xl shadow-md">
//         <div className="p-6 text-center space-y-4">
//           <h2 className="text-xl font-semibold text-red-600">
//             Invalid Invitation
//           </h2>
//           <p className="text-gray-600">
//             No token found. Please check your invite link.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   if (loading) {
//     return (
//       <div className="max-w-xl mx-auto py-20 px-6 text-center">
//         <p className="text-gray-500">Loading invitation…</p>
//       </div>
//     );
//   }

//   if (error) {
//     return (
//       <div className="max-w-xl mx-auto py-20 px-6 bg-white rounded-xl shadow-md">
//         <div className="p-6 text-center space-y-4">
//           <h2 className="text-xl font-semibold text-red-600">Uh-oh</h2>
//           <p className="text-gray-600">{error}</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
//       <Card className="p-6 sm:p-8 space-y-8">
//         <div className="flex items-center justify-between flex-wrap gap-2">
//           <div>
//             <h2 className="text-xl font-semibold text-gray-900">
//               Accept Invitation
//             </h2>
//             {ctx?.tenantName || ctx?.branchName ? (
//               <p className="text-sm text-gray-500 mt-1">
//                 Organization: {ctx?.tenantName || "Tenant"} /{" "}
//                 {ctx?.branchName || "Branch"}
//               </p>
//             ) : null}
//           </div>
//           <div className="text-sm flex items-center gap-2">
//             {saveStatus === "saving" && (
//               <span className="text-blue-500">💾 Saving…</span>
//             )}
//             {saveStatus === "success" && (
//               <span className="text-green-600">✅ Saved</span>
//             )}
//             {saveStatus === "error" && (
//               <span className="text-red-500">⚠️ Save error</span>
//             )}
//             {saveStatus === "idle" && (
//               <span className="text-gray-400">Auto-save enabled</span>
//             )}
//           </div>
//         </div>

//         <form onSubmit={formik.handleSubmit} className="space-y-6">
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
//                     renderAddressSection(section.fields)
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
//                           renderDocumentSection(inner, groupPath)
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

//           <div className="flex justify-end pt-4">
//             <Button type="submit">✅ Accept Invitation</Button>
//           </div>
//         </form>
//       </Card>

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

//       {/* NEW: Post-accept prompt */}
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

// 1) Verify login & profile; fetch invitation context, config, profile
// useEffect(() => {
//   const boot = async () => {
//     if (!token) return;
//     try {
//       const me = await axiosInstance.get("/auth/profile", {
//         skipAuthRedirect: true,
//       });
//       if (!me.data?.data?.isEmployeeProfileCreated) {
//         toast("Please complete your employee profile first.");
//         router.replace(
//           `/create-nexus-profile?next=/accept-invite?token=${token}`
//         );
//         return;
//       }

//       const context: InvitationContext = { tenantId, branchId };
//       if (!context?.tenantId || !context?.branchId) {
//         throw new Error("Invalid invitation context.");
//       }
//       setCtx(context);

//       const [{ data: employeeRes }, { data: configRes }] = await Promise.all([
//         axiosInstance.get(`/employee-profiles/self/get`),
//         axiosInstance.get("/employee-field-config/by-org", {
//           params: { tenantId: context.tenantId, branchId: context.branchId },
//         }),
//       ]);

//       const prof = employeeRes.data;
//       const cfg = configRes.data?.sections || configRes.data || [];
//       setProfile(prof);
//       setSections(cfg);

//       // Build initial values from config + profile (+ additionalFields)
//       const values: Record<string, any> = {};
//       for (const section of cfg) {
//         const group = section.sectionKey;

//         if (group === "address") {
//           values[group] =
//             prof[group] && Array.isArray(prof[group]) ? prof[group] : [{}];
//           continue;
//         }

//         // top-level fields
//         for (const field of section.fields || []) {
//           let val: any;
//           if (field.isAdditional) {
//             // 1) exact additionalFields match
//             let match =
//               prof.additionalFields?.find(
//                 (f: any) =>
//                   f.sectionKey === section.sectionKey &&
//                   (f.innerSectionKey ?? null) === null &&
//                   f.fieldKey === field.key
//               ) || null;

//             // 2) fallback: same fieldKey anywhere in additionalFields
//             if (!match) {
//               match =
//                 prof.additionalFields?.find(
//                   (f: any) => f.fieldKey === field.key
//                 ) || null;
//             }

//             val = match?.value;

//             // 3) NEW: fallback: search entire profile tree for same key
//             if (
//               val === undefined ||
//               val === null ||
//               (typeof val === "string" && val.trim() === "") ||
//               (typeof val === "object" &&
//                 !Array.isArray(val) &&
//                 Object.keys(val).length === 0)
//             ) {
//               const anyVal = findValueByFieldKeyAnywhere(prof, field.key);
//               if (anyVal !== undefined) val = anyVal;
//             }
//           } else {
//             val = get(prof, `${group}.${field.key}`);
//           }

//           set(
//             values,
//             `${group}.${field.key}`,
//             val ??
//               (field.type === "checkbox"
//                 ? false
//                 : field.type === "file"
//                 ? {}
//                 : "")
//           );
//         }

//         // inner sections
//         for (const inner of section.innerSections || []) {
//           for (const field of inner.fields || []) {
//             let val: any;
//             if (field.isAdditional) {
//               // 1) exact additionalFields match
//               let match =
//                 prof.additionalFields?.find(
//                   (f: any) =>
//                     f.sectionKey === section.sectionKey &&
//                     (f.innerSectionKey ?? null) === inner.sectionKey &&
//                     f.fieldKey === field.key
//                 ) || null;

//               // 2) fallback: same fieldKey anywhere in additionalFields
//               if (!match) {
//                 match =
//                   prof.additionalFields?.find(
//                     (f: any) => f.fieldKey === field.key
//                   ) || null;
//               }

//               val = match?.value;

//               // 3) NEW: fallback: search entire profile tree for same key
//               if (
//                 val === undefined ||
//                 val === null ||
//                 (typeof val === "string" && val.trim() === "") ||
//                 (typeof val === "object" &&
//                   !Array.isArray(val) &&
//                   Object.keys(val).length === 0)
//               ) {
//                 const anyVal = findValueByFieldKeyAnywhere(prof, field.key);
//                 if (anyVal !== undefined) val = anyVal;
//               }
//             } else {
//               val = get(prof, `${group}.${inner.sectionKey}.${field.key}`);
//             }

//             set(
//               values,
//               `${group}.${inner.sectionKey}.${field.key}`,
//               val ??
//                 (field.type === "checkbox"
//                   ? false
//                   : field.type === "file"
//                   ? {}
//                   : "")
//             );
//           }
//         }
//       }

//       // Prefill OR docs selection if a value exists
//       const initialSelectedDocs: Record<string, string> = {};
//       for (const section of cfg) {
//         for (const inner of section.innerSections || []) {
//           if (inner.requirementMode === "OR") {
//             const groupPath = `${section.sectionKey}.${inner.sectionKey}`;
//             const selected = inner.fields.find((field: any) => {
//               let val: any;
//               if (field.isAdditional) {
//                 let match = prof.additionalFields?.find(
//                   (f: any) =>
//                     f.sectionKey === section.sectionKey &&
//                     (f.innerSectionKey ?? null) === inner.sectionKey &&
//                     f.fieldKey === field.key
//                 );
//                 val = match?.value;

//                 if (
//                   val === undefined ||
//                   val === null ||
//                   (typeof val === "string" && val.trim() === "") ||
//                   (typeof val === "object" &&
//                     !Array.isArray(val) &&
//                     Object.keys(val).length === 0)
//                 ) {
//                   const anyVal = findValueByFieldKeyAnywhere(prof, field.key);
//                   if (anyVal !== undefined) val = anyVal;
//                 }
//               } else {
//                 val = get(
//                   prof,
//                   `${section.sectionKey}.${inner.sectionKey}.${field.key}`
//                 );
//               }
//               return (
//                 val &&
//                 (typeof val === "string" ||
//                   (typeof val === "object" && Object.keys(val).length > 0))
//               );
//             });
//             if (selected) initialSelectedDocs[groupPath] = selected.key;
//           }
//         }
//       }

//       setSelectedDocuments(initialSelectedDocs);
//       setInitialValues(values);
//       setLoading(false);
//     } catch (err: any) {
//       console.error(err);
//       if (err.response?.status === 401) {
//         toast.error("Please login to continue.");
//         router.replace(`/login?next=/accept-invite?token=${token}`);
//       } else {
//         setError(
//           err?.response?.data?.message || "Unable to load invitation."
//         );
//         setLoading(false);
//       }
//     }
//   };
//   boot();
// }, [token, router, tenantId, branchId]);
