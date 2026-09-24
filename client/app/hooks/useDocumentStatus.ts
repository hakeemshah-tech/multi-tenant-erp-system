import { useState, useEffect, useCallback, useMemo } from "react";
import {
  documentStatusService,
  DocumentStatus,
  GetDocumentStatusesParams,
} from "../services/documentStatus.service";

export const useDocumentStatus = (params: GetDocumentStatusesParams = {}) => {
  const [documentStatuses, setDocumentStatuses] = useState<DocumentStatus[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Memoize the params to prevent infinite loops
  const memoizedParams = useMemo(
    () => params,
    [
      params.employeeId,
      params.status,
      params.documentType,
      params.page,
      params.limit,
    ]
  );

  const fetchDocumentStatuses = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response =
        await documentStatusService.getDocumentStatuses(memoizedParams);
      setDocumentStatuses(response.documentStatuses);
      setPagination({
        page: response.page,
        limit: response.limit,
        total: response.total,
        totalPages: response.totalPages,
      });
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to fetch document statuses"
      );
      console.error("Error fetching document statuses:", err);
    } finally {
      setLoading(false);
    }
  }, [memoizedParams]);

  const updateDocumentStatus = async (
    employeeId: string,
    sectionKey: string,
    fieldKey: string,
    status: "approved" | "rejected",
    rejectionReason?: string,
    innerSectionKey?: string
  ) => {
    try {
      setError(null);
      const updatedStatus = await documentStatusService.updateDocumentStatus({
        employeeId,
        sectionKey,
        innerSectionKey,
        fieldKey,
        status,
        rejectionReason,
      });

      // Update the local state
      setDocumentStatuses((prev) =>
        prev.map((doc) =>
          doc.employeeId === employeeId &&
          doc.sectionKey === sectionKey &&
          doc.fieldKey === fieldKey &&
          (doc.innerSectionKey === innerSectionKey ||
            (!doc.innerSectionKey && !innerSectionKey))
            ? updatedStatus
            : doc
        )
      );

      return updatedStatus;
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to update document status"
      );
      console.error("Error updating document status:", err);
      throw err;
    }
  };

  const createDocumentStatus = async (params: any) => {
    try {
      setError(null);
      const newStatus =
        await documentStatusService.createDocumentStatus(params);

      // Add to the beginning of the list
      setDocumentStatuses((prev) => [newStatus, ...prev]);

      return newStatus;
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to create document status"
      );
      console.error("Error creating document status:", err);
      throw err;
    }
  };

  useEffect(() => {
    fetchDocumentStatuses();
  }, [fetchDocumentStatuses]);

  return {
    documentStatuses,
    loading,
    error,
    pagination,
    fetchDocumentStatuses,
    updateDocumentStatus,
    createDocumentStatus,
  };
};

export const usePendingDocumentsCount = () => {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await documentStatusService.getPendingDocumentsCount();
      setCount(response.count);
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Failed to fetch pending documents count"
      );
      console.error("Error fetching pending documents count:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return {
    count,
    loading,
    error,
    fetchCount,
  };
};
