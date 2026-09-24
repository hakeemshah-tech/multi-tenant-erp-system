"use client";

import { useState, useCallback } from "react";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";

export type BranchHit = {
  path: string;
  currentValue: any;
  sectionKey?: string | null;
  innerSectionKey?: string | null;
};

export type PropagationPreviewItem = {
  employeeId?: string;
  branchId: string;
  branchName: string;
  hits: BranchHit[]; // normalized shape
  differs: boolean;
};

export type PropagationPreviewResponse = {
  fieldKey: string;
  currentBranchId?: string;
  currentValue?: any;
  branches: PropagationPreviewItem[];
  mainProfile: {
    exists: boolean;
    currentValue?: any;
    differs?: boolean;
    occurrences?: BranchHit[]; // raw from API (optional)
  };
};

export type ApplyPropagationPayload = {
  fieldKey: string;
  currentBranchId: string;
  currentValue: any;
  updateMainProfile: boolean;
  selections: Array<{
    branchId: string;
    paths: string[];
  }>;
};

// --- helper: normalize server data into our expected shape (occurrences -> hits)
function normalizePreview(raw: any): PropagationPreviewResponse {
  const data = raw?.data ?? raw;

  const normBranches: PropagationPreviewItem[] = (data?.branches || []).map(
    (b: any) => ({
      employeeId: b.employeeId,
      branchId: b.branchId,
      branchName: b.branchName,
      differs: !!b.differs,
      hits: (b.occurrences || b.hits || []).map((o: any) => ({
        path: o.path,
        currentValue: o.currentValue,
        sectionKey: o.sectionKey ?? null,
        innerSectionKey: o.innerSectionKey ?? null,
      })),
    })
  );

  return {
    fieldKey: data?.fieldKey,
    currentBranchId: data?.currentBranchId,
    currentValue: data?.currentValue,
    branches: normBranches,
    mainProfile: {
      exists: !!data?.mainProfile?.exists,
      currentValue: data?.mainProfile?.currentValue,
      differs: !!data?.mainProfile?.differs,
      occurrences: (data?.mainProfile?.occurrences || []).map((o: any) => ({
        path: o.path,
        currentValue: o.currentValue,
        sectionKey: o.sectionKey ?? null,
        innerSectionKey: o.innerSectionKey ?? null,
      })),
    },
  };
}

export function useFieldPropagation() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PropagationPreviewResponse | null>(
    null
  );

  const doPreview = useCallback(
    async (input: {
      fieldKey: string;
      currentBranchId: string;
      currentValue: any;
    }) => {
      setLoading(true);
      try {
        const { data } = await axiosInstance.post(
          "/employees/me/preview-propagation",
          input
        );
        setPreview(normalizePreview(data));
      } catch (e: any) {
        console.error(e);
        toast.error(e?.response?.data?.message || "Failed to load preview");
        setPreview(null);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const apply = useCallback(async (payload: ApplyPropagationPayload) => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.post(
        "/employees/me/apply-propagation",
        payload
      );
      toast.success(data?.message || "Propagation applied");
      return true;
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to apply propagation");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPreview(null);
  }, []);

  return { loading, preview, doPreview, apply, reset };
}
