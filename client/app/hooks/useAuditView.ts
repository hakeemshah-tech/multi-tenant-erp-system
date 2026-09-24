import { useEffect, useRef } from "react";
import { auditViewSection } from "../lib/utils";

export function useAuditView(opts: {
  enabled?: boolean;
  branchId?: string | null;
  sectionKey?: string | null;
  innerSectionKey?: string | null;
}) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (!opts.enabled) return;
    if (!opts.branchId || !opts.sectionKey) return;

    firedRef.current = true;
    auditViewSection({
      branchId: opts.branchId,
      sectionKey: opts.sectionKey,
      innerSectionKey: opts.innerSectionKey ?? null,
    });
  }, [opts.enabled, opts.branchId, opts.sectionKey, opts.innerSectionKey]);
}
