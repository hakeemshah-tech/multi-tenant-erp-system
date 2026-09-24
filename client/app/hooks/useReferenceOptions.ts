import { useEffect, useState, useRef } from "react";
import axiosInstance from "@/app/lib/axios";
import { SectionConfig } from "../types/employee-fields";

export function useReferenceOptions(
  config: SectionConfig[],
  branchId?: string
) {
  const [referenceOptions, setReferenceOptions] = useState<
    Record<string, { label: string; value: string }[]>
  >({});

  // OPTIMIZATION: Cache branch awards data to prevent duplicate API calls
  const branchAwardsCacheRef = useRef<{ branchId: string; data: any } | null>(
    null
  );
  const previousConfigLengthRef = useRef<number>(0);

  useEffect(() => {
    const models = new Set<string>();
    for (const s of config) {
      (s.fields || []).forEach(
        (f) =>
          f.type === "reference" &&
          f.referenceModel &&
          models.add(f.referenceModel)
      );
      (s.innerSections || []).forEach((inn) =>
        (inn.fields || []).forEach(
          (f) =>
            f.type === "reference" &&
            f.referenceModel &&
            models.add(f.referenceModel)
        )
      );
    }
    if (!models.size) return;

    // OPTIMIZATION: Only re-fetch if config actually changed (length or branchId changed)
    const configChanged = config.length !== previousConfigLengthRef.current;
    const branchIdChanged = branchId !== branchAwardsCacheRef.current?.branchId;

    if (!configChanged && !branchIdChanged && branchAwardsCacheRef.current) {
      // Config hasn't meaningfully changed, skip re-fetching
      return;
    }

    previousConfigLengthRef.current = config.length;

    (async () => {
      // OPTIMIZATION: Fetch branch awards once and cache it for both Award and AwardEmployeeType
      let cachedBranchAwards: any = null;
      const needsBranchAwards =
        branchId && (models.has("Award") || models.has("AwardEmployeeType"));

      if (needsBranchAwards) {
        // Check cache first
        if (
          branchAwardsCacheRef.current?.branchId === branchId &&
          branchAwardsCacheRef.current?.data
        ) {
          cachedBranchAwards = branchAwardsCacheRef.current.data;
        } else {
          // Fetch once and cache
          try {
            const { data } = await axiosInstance.get(
              `/branches/${branchId}/awards`
            );
            cachedBranchAwards = data?.data;
            branchAwardsCacheRef.current = {
              branchId: branchId!,
              data: cachedBranchAwards,
            };
          } catch (err) {
            console.error("Failed to fetch branch awards", err);
            cachedBranchAwards = null;
          }
        }
      }

      await Promise.all(
        Array.from(models).map(async (m) => {
          try {
            let rows: any[] = [];

            // Special handling for Award and AwardEmployeeType when branchId is provided
            if (m === "Award" && branchId && cachedBranchAwards) {
              // Use cached branch awards data
              const branch = cachedBranchAwards;
              if (branch?.awards && Array.isArray(branch.awards)) {
                // Extract unique awards from branch
                const awardMap = new Map();
                branch.awards.forEach((ba: any) => {
                  const award =
                    typeof ba.awardId === "object"
                      ? ba.awardId
                      : { _id: ba.awardId };
                  if (award._id && !awardMap.has(String(award._id))) {
                    awardMap.set(String(award._id), {
                      _id: award._id,
                      title: award.title || "Unknown Award",
                      description: award.description,
                      icon: award.icon,
                    });
                  }
                });
                rows = Array.from(awardMap.values());
              }
            } else if (
              m === "AwardEmployeeType" &&
              branchId &&
              cachedBranchAwards
            ) {
              // Use cached branch awards data
              const branch = cachedBranchAwards;
              if (branch?.awards && Array.isArray(branch.awards)) {
                // Extract all award employee types from branch awards
                const typeMap = new Map();
                branch.awards.forEach((ba: any) => {
                  const baAwardId =
                    typeof ba.awardId === "object"
                      ? ba.awardId._id
                      : ba.awardId;
                  if (
                    ba.awardEmployeeTypeIds &&
                    Array.isArray(ba.awardEmployeeTypeIds)
                  ) {
                    ba.awardEmployeeTypeIds.forEach((type: any) => {
                      const awardEmployeeType =
                        typeof type === "object" ? type : { _id: type };
                      if (
                        awardEmployeeType._id &&
                        !typeMap.has(String(awardEmployeeType._id))
                      ) {
                        typeMap.set(String(awardEmployeeType._id), {
                          _id: awardEmployeeType._id,
                          title: awardEmployeeType.title || "Unknown Type",
                          description: awardEmployeeType.description,
                          awardId: baAwardId,
                        });
                      }
                    });
                  }
                });
                rows = Array.from(typeMap.values());
              }
            } else {
              // Default behavior for other models
              const endpoint =
                m === "Employee"
                  ? "/employees"
                  : m === "Department"
                    ? "/departments"
                    : m === "Designation"
                      ? "/designations"
                      : m === "Branch"
                        ? "/branches"
                        : m === "Tenant"
                          ? "/tenants"
                          : m === "Award"
                            ? "/awards"
                            : m === "AwardEmployeeType"
                              ? "/award-employee-types"
                              : `/${m.toLowerCase()}s`;
              const { data } = await axiosInstance.get(endpoint);
              rows = data?.data || data || [];
            }

            const opts = rows
              .map((row: any) => {
                const value = row?._id || row?.id;
                if (!value) return null;
                if (m === "Employee") {
                  const pd = row?.employeeProfile?.personaldetails;
                  const label =
                    [pd?.firstname, pd?.lastname].filter(Boolean).join(" ") ||
                    row?.name ||
                    row?.email ||
                    "Unnamed";
                  return { label, value: String(value) };
                }
                // For AwardEmployeeType, include awardId for filtering
                const baseOption = {
                  label: row?.name || row?.title || row?.code || "Unnamed",
                  value: String(value),
                };
                if (m === "AwardEmployeeType" && row?.awardId) {
                  return { ...baseOption, awardId: String(row.awardId) };
                }
                return baseOption;
              })
              .filter(Boolean) as {
              label: string;
              value: string;
              awardId?: string;
            }[];
            setReferenceOptions((prev) => ({ ...prev, [m]: opts }));
          } catch (e) {
            console.error(`Failed loading ref options for ${m}`, e);
          }
        })
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.length, branchId]); // Use config.length instead of config array to prevent unnecessary re-runs

  return referenceOptions;
}
