import { useEffect, useState } from "react";
import axiosInstance from "@/app/lib/axios";

export interface Organization {
  _id: string;
  designation?: { name: string };
  branchId?: {
    _id: string;
    name: string;
    logo?: string;
  };
}

export function useOrganizations(shouldFetch: boolean = true) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    // Don't fetch if shouldFetch is false (e.g., in tenant/employer routes)
    if (!shouldFetch) {
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await axiosInstance.get(
        "/employee-profiles/my-organizations/get"
      );
      setOrganizations(res.data.data || []);
    } catch (err: any) {
      // Handle 404 specifically - might be route order issue or profile not found
      if (err?.response?.status === 404) {
        // Check if it's a route issue (response might indicate route not found)
        if (
          err?.response?.data?.message?.includes("not found") ||
          !err?.response?.data
        ) {
          console.warn(
            "Organizations endpoint not found - this may be a backend route configuration issue"
          );
          setOrganizations([]);
          // Don't set error for 404s to avoid showing error messages for missing profiles
          return;
        }
      }
      console.error("Failed to fetch organizations", err);
      setError(err?.response?.data?.message || "Failed to fetch organizations");
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (shouldFetch) {
      fetchOrganizations();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [shouldFetch]);

  return {
    organizations,
    loading,
    error,
    refetch: fetchOrganizations,
  };
}
