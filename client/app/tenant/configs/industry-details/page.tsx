"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Button, Input, Textarea, Select, Checkbox, Title, Text } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { useAppSelector } from "@/app/store/hook";
import { useDropzone } from "react-dropzone";
import { PhoneInput } from "@/app/components/shared/PhoneInput";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Clock,
  DollarSign,
  Plus,
  Trash2,
  Save,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";

// Australian states
const AUSTRALIAN_STATES = [
  "New South Wales",
  "Victoria",
  "Queensland",
  "Western Australia",
  "South Australia",
  "Tasmania",
  "Northern Territory",
  "Australian Capital Territory",
];

const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface BusinessStructure {
  _id: string;
  name: string;
  code?: string;
}

interface IndustryType {
  _id: string;
  name: string;
  code?: string;
}

interface IndustrySubType {
  _id: string;
  name: string;
  code?: string;
  industryTypeId: string | { _id: string };
}

interface BranchDetails {
  _id: string;
  name: string;
  logo?: string;
  abn?: string;
  acn?: string;
  businessStructureId?: string | { _id: string; name: string };
  industryTypeIds?: string[] | Array<{ _id: string; name: string }>;
  industrySubTypeIds?: string[] | Array<{ _id: string; name: string }>;
  addresses?: Array<{
    buildingPropertyName?: string;
    flatUnitNumber?: string;
    streetNumber?: string;
    streetName?: string;
    suburbCity?: string;
    stateTerritory?: string;
    country?: string;
    zipPostalCode?: string;
  }>;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  physicalWorkLocations?: Array<{ state: string; place: string }>;
  businessHoursOfOperation?: {
    officeWorker?: {
      startTime?: string;
      endTime?: string;
      weekDays?: string[];
    };
    shiftWorker?: {
      description?: string;
      weekDays?: string[];
    };
  };
  isNotForProfit?: boolean;
  isSalaryPackagingAvailable?: boolean;
  salaryPackagingMaximumAmount?: number;
}

export default function BranchDetailsPage() {
  const { user } = useAppSelector((state) => state.auth);
  const { hasPermission, hasFullAccess } = usePermissions();
  const canRead =
    hasFullAccess || hasPermission("organisation-details", "read");
  const canWrite =
    hasFullAccess || hasPermission("organisation-details", "write");

  const branchId = user?.activeAssignment?.branchId
    ? String(user.activeAssignment.branchId)
    : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branchDetails, setBranchDetails] = useState<BranchDetails | null>(
    null
  );
  const [businessStructures, setBusinessStructures] = useState<
    BusinessStructure[]
  >([]);
  const [industryTypes, setIndustryTypes] = useState<IndustryType[]>([]);
  const [industrySubTypes, setIndustrySubTypes] = useState<IndustrySubType[]>(
    []
  );

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFileId, setLogoFileId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    logo: "",
    abn: "",
    acn: "",
    businessStructureId: "",
    industryTypeIds: [] as string[],
    industrySubTypeIds: [] as string[],
    addresses: [] as Array<{
      buildingPropertyName: string;
      flatUnitNumber: string;
      streetNumber: string;
      streetName: string;
      suburbCity: string;
      stateTerritory: string;
      country: string;
      zipPostalCode: string;
    }>,
    email: "",
    phone: "",
    websiteUrl: "",
    physicalWorkLocations: [] as Array<{ state: string; place: string }>,
    businessHoursOfOperation: {
      officeWorker: {
        startTime: "",
        endTime: "",
        weekDays: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
        ] as string[],
      },
      shiftWorker: {
        description: "",
        weekDays: [] as string[],
      },
    },
    isNotForProfit: false,
    isSalaryPackagingAvailable: false,
    salaryPackagingMaximumAmount: 0,
  });

  useEffect(() => {
    if (branchId) {
      fetchBranchDetails();
      fetchReferenceData();
    }
  }, [branchId]);

  // Fetch signed URL for logo when fileId changes (only on load/change, no auto-refresh)
  useEffect(() => {
    if (!logoFileId) {
      setLogoPreviewUrl(null);
      return;
    }

    const fetchSignedUrl = async () => {
      try {
        const urlRes = await axiosInstance.get<{
          url: string;
          expiresIn: number;
        }>(`/uploads/${logoFileId}/url`);
        setLogoPreviewUrl(urlRes.data?.url || null);
      } catch (error) {
        console.error("Failed to fetch logo signed URL", error);
        setLogoPreviewUrl(null);
      }
    };

    void fetchSignedUrl();
  }, [logoFileId]);

  const fetchBranchDetails = async () => {
    if (!branchId) return;
    try {
      setLoading(true);
      const res = await axiosInstance.get(`/branches/${branchId}/details`);
      const data = res.data.data;

      // Normalize the data
      const normalizedData = {
        ...data,
        businessStructureId:
          data.businessStructureId &&
          typeof data.businessStructureId === "object" &&
          data.businessStructureId !== null
            ? data.businessStructureId._id
            : data.businessStructureId || "",
        industryTypeIds: (data.industryTypeIds || []).map((id: any) =>
          id && typeof id === "object" && id !== null ? id._id : id
        ),
        industrySubTypeIds: (data.industrySubTypeIds || []).map((id: any) =>
          id && typeof id === "object" && id !== null ? id._id : id
        ),
      };

      setBranchDetails(data);

      // Handle logo - could be URL string, fileId string, or { fileId, key } object
      if (normalizedData.logo) {
        if (typeof normalizedData.logo === "string") {
          // Check if it's a fileId (ObjectId format) or a URL
          const isObjectId = /^[0-9a-fA-F]{24}$/.test(normalizedData.logo);
          if (isObjectId) {
            // It's a fileId stored as string - let useEffect fetch the signed URL
            setLogoFileId(normalizedData.logo);
          } else {
            // It's a regular URL string - use it directly
            setLogoFileId(null);
            setLogoPreviewUrl(normalizedData.logo);
          }
        } else if (normalizedData.logo?.fileId) {
          // If it's an object with fileId - let useEffect fetch the signed URL
          const fileId = String(normalizedData.logo.fileId);
          setLogoFileId(fileId);
        }
      } else {
        setLogoFileId(null);
        setLogoPreviewUrl(null);
      }

      setForm({
        name: normalizedData.name || "",
        // Store the original logo value from database (fileId or URL), not the signed URL
        logo: normalizedData.logo || "",
        abn: normalizedData.abn || "",
        acn: normalizedData.acn || "",
        businessStructureId: normalizedData.businessStructureId || "",
        industryTypeIds: normalizedData.industryTypeIds || [],
        industrySubTypeIds: normalizedData.industrySubTypeIds || [],
        addresses: normalizedData.addresses || [],
        email: normalizedData.email || "",
        phone: normalizedData.phone || "",
        websiteUrl: normalizedData.websiteUrl || "",
        physicalWorkLocations: normalizedData.physicalWorkLocations || [],
        businessHoursOfOperation: normalizedData.businessHoursOfOperation
          ? {
              ...normalizedData.businessHoursOfOperation,
              officeWorker: {
                ...normalizedData.businessHoursOfOperation.officeWorker,
                weekDays:
                  normalizedData.businessHoursOfOperation.officeWorker
                    ?.weekDays &&
                  normalizedData.businessHoursOfOperation.officeWorker.weekDays
                    .length > 0
                    ? normalizedData.businessHoursOfOperation.officeWorker
                        .weekDays
                    : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
              },
            }
          : {
              officeWorker: {
                startTime: "",
                endTime: "",
                weekDays: [
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                ],
              },
              shiftWorker: { description: "", weekDays: [] },
            },
        isNotForProfit: normalizedData.isNotForProfit || false,
        isSalaryPackagingAvailable:
          normalizedData.isSalaryPackagingAvailable || false,
        salaryPackagingMaximumAmount:
          normalizedData.salaryPackagingMaximumAmount || 0,
      });
    } catch (error: any) {
      console.error("Failed to fetch branch details", error);
      toast.error(
        error.response?.data?.message || "Failed to fetch branch details"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [businessStructuresRes, industryTypesRes, industrySubTypesRes] =
        await Promise.all([
          axiosInstance.get("/business-structures"),
          axiosInstance.get("/industry-types"),
          axiosInstance.get("/industry-sub-types"),
        ]);

      setBusinessStructures(businessStructuresRes.data.data || []);
      setIndustryTypes(industryTypesRes.data.data || []);
      setIndustrySubTypes(industrySubTypesRes.data.data || []);
    } catch (error) {
      console.error("Failed to fetch reference data", error);
    }
  };

  // Filter industry sub types based on selected industry types
  const filteredIndustrySubTypes = industrySubTypes.filter((subType) => {
    const subTypeIndustryTypeId =
      typeof subType.industryTypeId === "object"
        ? subType.industryTypeId._id
        : subType.industryTypeId;
    return form.industryTypeIds.includes(subTypeIndustryTypeId);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return;

    try {
      setSaving(true);
      const payload = {
        ...form,
        salaryPackagingMaximumAmount:
          form.isSalaryPackagingAvailable && form.salaryPackagingMaximumAmount
            ? form.salaryPackagingMaximumAmount
            : undefined,
      };

      await axiosInstance.put(`/branches/${branchId}/details`, payload);
      toast.success("Branch details updated successfully");
      await fetchBranchDetails();
    } catch (error: any) {
      console.error("Failed to update branch details", error);
      toast.error(
        error.response?.data?.message || "Failed to update branch details"
      );
    } finally {
      setSaving(false);
    }
  };

  const addAddress = () => {
    setForm((prev) => ({
      ...prev,
      addresses: [
        ...prev.addresses,
        {
          buildingPropertyName: "",
          flatUnitNumber: "",
          streetNumber: "",
          streetName: "",
          suburbCity: "",
          stateTerritory: "",
          country: "",
          zipPostalCode: "",
        },
      ],
    }));
  };

  const removeAddress = (index: number) => {
    setForm((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((_, i) => i !== index),
    }));
  };

  const updateAddress = (index: number, field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      addresses: prev.addresses.map((addr, i) =>
        i === index ? { ...addr, [field]: value } : addr
      ),
    }));
  };

  const addPhysicalWorkLocation = () => {
    setForm((prev) => ({
      ...prev,
      physicalWorkLocations: [
        ...prev.physicalWorkLocations,
        { state: "", place: "" },
      ],
    }));
  };

  const removePhysicalWorkLocation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      physicalWorkLocations: prev.physicalWorkLocations.filter(
        (_, i) => i !== index
      ),
    }));
  };

  const updatePhysicalWorkLocation = (
    index: number,
    field: "state" | "place",
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      physicalWorkLocations: prev.physicalWorkLocations.map((loc, i) =>
        i === index ? { ...loc, [field]: value } : loc
      ),
    }));
  };

  // Logo upload handler
  const onLogoDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    try {
      setLogoUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axiosInstance.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Upload response can be at root or under data.data
      const payload = data?.data ?? data ?? {};
      const uploadedUrl = payload?.url;
      const uploadedId = payload?.id || payload?.fileId;
      const uploadedKey = payload?.key;

      if (!uploadedId) {
        throw new Error("No file ID returned from upload");
      }

      // Store fileId in form state (not the URL, as it expires)
      const fileIdString = String(uploadedId);
      setForm((prev) => ({ ...prev, logo: fileIdString }));
      setLogoFileId(fileIdString);

      // Use the signed URL for preview (it will expire, but we'll refresh it)
      if (uploadedUrl) {
        setLogoPreviewUrl(uploadedUrl);
      } else {
        // If no URL in response, fetch it
        try {
          const urlRes = await axiosInstance.get<{
            url: string;
            expiresIn: number;
          }>(`/uploads/${fileIdString}/url`);
          setLogoPreviewUrl(urlRes.data?.url || null);
        } catch (error) {
          console.error("Failed to fetch logo URL", error);
        }
      }

      toast.success("Logo uploaded successfully");
    } catch (error: any) {
      console.error("Logo upload error:", error);
      toast.error(
        error.response?.data?.error ||
          "Failed to upload logo. Please try again."
      );
    } finally {
      setLogoUploading(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: onLogoDrop,
    multiple: false,
    noClick: true,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"],
    },
  });

  const removeLogo = () => {
    setForm((prev) => ({ ...prev, logo: "" }));
    setLogoPreviewUrl(null);
    setLogoFileId(null);
  };

  if (loading) {
    return (
      <PermissionGuard
        section="organisation-details"
        action="read"
        redirectTo="/tenant/my-contract-approvals"
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading branch details...</p>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  if (!branchId) {
    return (
      <PermissionGuard
        section="organisation-details"
        action="read"
        redirectTo="/tenant/my-contract-approvals"
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600">No branch selected</p>
          </div>
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard
      section="organisation-details"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <Title as="h2" className="text-2xl font-bold text-gray-900">
                Organisation Details
              </Title>
              <Text className="text-gray-600 mt-1">
                Manage your Organisation information and settings
              </Text>
            </div>
            {canWrite && (
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="text-blue-600" size={24} />
              <Title as="h3" className="text-xl font-semibold">
                Basic Information
              </Title>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo
                </label>
                <div className="space-y-3">
                  {logoPreviewUrl ? (
                    <div className="relative inline-block">
                      <div className="w-32 h-32 rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                        <Image
                          src={logoPreviewUrl}
                          alt="Branch logo"
                          width={128}
                          height={128}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      </div>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md"
                          title="Remove logo"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div
                      {...(canWrite ? getRootProps() : {})}
                      onClick={canWrite ? open : undefined}
                      className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
                        canWrite
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-50"
                      } ${
                        isDragActive
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
                      } ${
                        logoUploading ? "opacity-50 pointer-events-none" : ""
                      }`}
                    >
                      <input
                        {...(canWrite ? getInputProps() : {})}
                        disabled={!canWrite}
                      />
                      <div className="flex flex-col items-center justify-center text-center">
                        {logoUploading ? (
                          <>
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                            <p className="text-sm text-gray-600">
                              Uploading...
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="text-gray-400 mb-2" size={32} />
                            <p className="text-sm font-medium text-gray-700 mb-1">
                              {isDragActive
                                ? "Drop the image here"
                                : "Upload Logo"}
                            </p>
                            <p className="text-xs text-gray-500">
                              Drag & drop an image or click to browse
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              PNG, JPG, GIF, WEBP or SVG (max 10MB)
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {logoPreviewUrl && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={open}
                        disabled={logoUploading}
                        className="flex items-center gap-2"
                      >
                        <Upload size={16} />
                        Replace Logo
                      </Button>
                      <input {...getInputProps()} className="hidden" />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  value={form.name}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                  placeholder="Branch name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ABN
                </label>
                <Input
                  type="text"
                  value={form.abn}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, abn: e.target.value }))
                  }
                  placeholder="Australian Business Number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ACN
                </label>
                <Input
                  type="text"
                  value={form.acn}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, acn: e.target.value }))
                  }
                  placeholder="Australian Company Number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Structure
                </label>
                <Select
                  label=""
                  value={
                    form.businessStructureId
                      ? businessStructures.find(
                          (bs) => bs._id === form.businessStructureId
                        )
                        ? {
                            label:
                              businessStructures.find(
                                (bs) => bs._id === form.businessStructureId
                              )?.name || "",
                            value: form.businessStructureId,
                          }
                        : null
                      : null
                  }
                  disabled={!canWrite}
                  onChange={(opt) =>
                    setForm((prev) => ({
                      ...prev,
                      businessStructureId: opt?.value || "",
                    }))
                  }
                  options={businessStructures.map((bs) => ({
                    label: bs.name,
                    value: bs._id,
                  }))}
                  placeholder="Select Business Structure"
                  searchable
                />
              </div>
            </div>
          </div>

          {/* Industry Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Building2 className="text-blue-600" size={24} />
              <Title as="h3" className="text-xl font-semibold">
                Industry Information
              </Title>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry Types (Multi-select)
                </label>
                <Select
                  label=""
                  value={null}
                  disabled={!canWrite}
                  onChange={(opt) => {
                    if (
                      opt?.value &&
                      !form.industryTypeIds.includes(opt.value)
                    ) {
                      setForm((prev) => ({
                        ...prev,
                        industryTypeIds: [...prev.industryTypeIds, opt.value],
                        // Keep existing industry sub types - only filter when removing industry types
                      }));
                    }
                  }}
                  options={industryTypes
                    .filter((it) => !form.industryTypeIds.includes(it._id))
                    .map((it) => ({
                      label: it.name + (it.code ? ` (${it.code})` : ""),
                      value: it._id,
                    }))}
                  placeholder="Select Industry Type"
                  searchable
                />
                {form.industryTypeIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.industryTypeIds.map((id) => {
                      const type = industryTypes.find((it) => it._id === id);
                      return type ? (
                        <span
                          key={id}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {type.name}
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  industryTypeIds: prev.industryTypeIds.filter(
                                    (tid) => tid !== id
                                  ),
                                  industrySubTypeIds:
                                    prev.industrySubTypeIds.filter((sid) => {
                                      const subType = industrySubTypes.find(
                                        (st) => st._id === sid
                                      );
                                      if (!subType) return false;
                                      const subTypeIndustryTypeId =
                                        typeof subType.industryTypeId ===
                                        "object"
                                          ? subType.industryTypeId._id
                                          : subType.industryTypeId;
                                      return subTypeIndustryTypeId !== id;
                                    }),
                                }))
                              }
                              className="ml-2 text-blue-600 hover:text-blue-800"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry Sub Types (Multi-select)
                </label>
                <Select
                  label=""
                  value={null}
                  disabled={!canWrite || form.industryTypeIds.length === 0}
                  onChange={(opt) => {
                    if (
                      opt?.value &&
                      !form.industrySubTypeIds.includes(opt.value)
                    ) {
                      setForm((prev) => ({
                        ...prev,
                        industrySubTypeIds: [
                          ...prev.industrySubTypeIds,
                          opt.value,
                        ],
                      }));
                    }
                  }}
                  options={filteredIndustrySubTypes
                    .filter((ist) => !form.industrySubTypeIds.includes(ist._id))
                    .map((ist) => ({
                      label: ist.name + (ist.code ? ` (${ist.code})` : ""),
                      value: ist._id,
                    }))}
                  placeholder={
                    form.industryTypeIds.length === 0
                      ? "Select Industry Types first"
                      : "Select Industry Sub Type"
                  }
                  searchable
                />
                {form.industrySubTypeIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {form.industrySubTypeIds.map((id) => {
                      const subType = industrySubTypes.find(
                        (ist) => ist._id === id
                      );
                      return subType ? (
                        <span
                          key={id}
                          className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          {subType.name}
                          {canWrite && (
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  industrySubTypeIds:
                                    prev.industrySubTypeIds.filter(
                                      (sid) => sid !== id
                                    ),
                                }))
                              }
                              className="ml-2 text-green-600 hover:text-green-800"
                            >
                              ×
                            </button>
                          )}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Mail className="text-blue-600" size={24} />
              <Title as="h3" className="text-xl font-semibold">
                Contact Information
              </Title>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  value={form.email}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="branch@example.com"
                />
              </div>

              <div>
                <PhoneInput
                  label="Phone"
                  value={form.phone}
                  disabled={!canWrite}
                  onChange={(val) =>
                    setForm((prev) => ({ ...prev, phone: val || "" }))
                  }
                  placeholder="Enter phone number"
                  defaultCountry="AU"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Website URL
                </label>
                <Input
                  type="text"
                  value={form.websiteUrl}
                  disabled={!canWrite}
                  onChange={(e) => {
                    let value = e.target.value.trim();

                    // Normalize URL: add https:// if missing
                    if (value && !value.match(/^https?:\/\//i)) {
                      // If it starts with www., add https://
                      if (value.startsWith("www.")) {
                        value = "https://" + value;
                      } else if (value.includes(".") && !value.includes(" ")) {
                        // If it looks like a domain (has a dot and no spaces), add https://
                        value = "https://" + value;
                      }
                    }

                    setForm((prev) => ({ ...prev, websiteUrl: value }));
                  }}
                  placeholder="https://www.example.com or www.example.com or example.com"
                />
              </div>
            </div>
          </div>

          {/* Addresses */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <MapPin className="text-blue-600" size={24} />
                <Title as="h3" className="text-xl font-semibold">
                  Addresses
                </Title>
              </div>
              {canWrite && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addAddress}
                  className="flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Address
                </Button>
              )}
            </div>

            {form.addresses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No addresses added. Click "Add Address" to add one.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {form.addresses.map((address, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900">
                        Address {index + 1}
                      </h4>
                      {canWrite && (
                        <Button
                          type="button"
                          variant="outline"
                          color="danger"
                          size="sm"
                          onClick={() => removeAddress(index)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Building / Property Name
                        </label>
                        <Input
                          value={address.buildingPropertyName}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(
                              index,
                              "buildingPropertyName",
                              e.target.value
                            )
                          }
                          placeholder="Building name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Flat/Unit Number
                        </label>
                        <Input
                          value={address.flatUnitNumber}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(
                              index,
                              "flatUnitNumber",
                              e.target.value
                            )
                          }
                          placeholder="Unit 5"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Street Number
                        </label>
                        <Input
                          value={address.streetNumber}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(index, "streetNumber", e.target.value)
                          }
                          placeholder="123"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Street Name
                        </label>
                        <Input
                          value={address.streetName}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(index, "streetName", e.target.value)
                          }
                          placeholder="Main Street"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Suburb / City
                        </label>
                        <Input
                          value={address.suburbCity}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(index, "suburbCity", e.target.value)
                          }
                          placeholder="Sydney"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State / Territory
                        </label>
                        <Input
                          value={address.stateTerritory}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(
                              index,
                              "stateTerritory",
                              e.target.value
                            )
                          }
                          placeholder="NSW"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Country
                        </label>
                        <Input
                          value={address.country}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(index, "country", e.target.value)
                          }
                          placeholder="Australia"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Zip / Postal Code
                        </label>
                        <Input
                          value={address.zipPostalCode}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateAddress(
                              index,
                              "zipPostalCode",
                              e.target.value
                            )
                          }
                          placeholder="2000"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Physical Work Locations */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <MapPin className="text-blue-600" size={24} />
                <Title as="h3" className="text-xl font-semibold">
                  Physical Work Locations
                </Title>
              </div>
              {canWrite && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={addPhysicalWorkLocation}
                  className="flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Location
                </Button>
              )}
            </div>

            {form.physicalWorkLocations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>No locations added. Click "Add Location" to add one.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {form.physicalWorkLocations.map((location, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 flex items-center gap-4"
                  >
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          State
                        </label>
                        <Select
                          label=""
                          value={
                            location.state
                              ? {
                                  label: location.state,
                                  value: location.state,
                                }
                              : null
                          }
                          onChange={(opt) =>
                            updatePhysicalWorkLocation(
                              index,
                              "state",
                              opt?.value || ""
                            )
                          }
                          options={AUSTRALIAN_STATES.map((state) => ({
                            label: state,
                            value: state,
                          }))}
                          placeholder="Select State"
                          searchable
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Place
                        </label>
                        <Input
                          value={location.place}
                          onChange={(e) =>
                            updatePhysicalWorkLocation(
                              index,
                              "place",
                              e.target.value
                            )
                          }
                          placeholder="Enter place name"
                        />
                      </div>
                    </div>
                    {canWrite && (
                      <Button
                        type="button"
                        variant="outline"
                        color="danger"
                        size="sm"
                        onClick={() => removePhysicalWorkLocation(index)}
                        className="mt-6"
                      >
                        <Trash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Business Hours of Operation */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <Clock className="text-blue-600" size={24} />
              <Title as="h3" className="text-xl font-semibold">
                Business Hours of Operation
              </Title>
            </div>

            <div className="space-y-6">
              {/* Office Worker */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">
                  Office Worker
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <Input
                      type="time"
                      value={
                        form.businessHoursOfOperation.officeWorker.startTime
                      }
                      disabled={!canWrite}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          businessHoursOfOperation: {
                            ...prev.businessHoursOfOperation,
                            officeWorker: {
                              ...prev.businessHoursOfOperation.officeWorker,
                              startTime: e.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <Input
                      type="time"
                      value={form.businessHoursOfOperation.officeWorker.endTime}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          businessHoursOfOperation: {
                            ...prev.businessHoursOfOperation,
                            officeWorker: {
                              ...prev.businessHoursOfOperation.officeWorker,
                              endTime: e.target.value,
                            },
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days
                    </label>
                    <Select
                      label=""
                      value={null}
                      onChange={(opt) => {
                        if (
                          opt?.value &&
                          !form.businessHoursOfOperation.officeWorker.weekDays.includes(
                            opt.value
                          )
                        ) {
                          setForm((prev) => ({
                            ...prev,
                            businessHoursOfOperation: {
                              ...prev.businessHoursOfOperation,
                              officeWorker: {
                                ...prev.businessHoursOfOperation.officeWorker,
                                weekDays: [
                                  ...prev.businessHoursOfOperation.officeWorker
                                    .weekDays,
                                  opt.value,
                                ],
                              },
                            },
                          }));
                        }
                      }}
                      options={WEEK_DAYS.filter(
                        (day) =>
                          !form.businessHoursOfOperation.officeWorker.weekDays.includes(
                            day
                          )
                      ).map((day) => ({ label: day, value: day }))}
                      placeholder="Select Day"
                    />
                    {form.businessHoursOfOperation.officeWorker.weekDays
                      .length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.businessHoursOfOperation.officeWorker.weekDays.map(
                          (day) => (
                            <span
                              key={day}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {day}
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      businessHoursOfOperation: {
                                        ...prev.businessHoursOfOperation,
                                        officeWorker: {
                                          ...prev.businessHoursOfOperation
                                            .officeWorker,
                                          weekDays:
                                            prev.businessHoursOfOperation.officeWorker.weekDays.filter(
                                              (d) => d !== day
                                            ),
                                        },
                                      },
                                    }))
                                  }
                                  className="ml-1 text-blue-600 hover:text-blue-800"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Shift Worker */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-4">Shift Worker</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <Input
                      type="text"
                      value={
                        form.businessHoursOfOperation.shiftWorker.description
                      }
                      disabled={!canWrite}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          businessHoursOfOperation: {
                            ...prev.businessHoursOfOperation,
                            shiftWorker: {
                              ...prev.businessHoursOfOperation.shiftWorker,
                              description: e.target.value,
                            },
                          },
                        }))
                      }
                      placeholder="Enter shift worker hours description"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Days
                    </label>
                    <Select
                      label=""
                      value={null}
                      disabled={!canWrite}
                      onChange={(opt) => {
                        if (
                          opt?.value &&
                          !form.businessHoursOfOperation.shiftWorker.weekDays.includes(
                            opt.value
                          )
                        ) {
                          setForm((prev) => ({
                            ...prev,
                            businessHoursOfOperation: {
                              ...prev.businessHoursOfOperation,
                              shiftWorker: {
                                ...prev.businessHoursOfOperation.shiftWorker,
                                weekDays: [
                                  ...prev.businessHoursOfOperation.shiftWorker
                                    .weekDays,
                                  opt.value,
                                ],
                              },
                            },
                          }));
                        }
                      }}
                      options={WEEK_DAYS.filter(
                        (day) =>
                          !form.businessHoursOfOperation.shiftWorker.weekDays.includes(
                            day
                          )
                      ).map((day) => ({ label: day, value: day }))}
                      placeholder="Select Day"
                    />
                    {form.businessHoursOfOperation.shiftWorker.weekDays.length >
                      0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {form.businessHoursOfOperation.shiftWorker.weekDays.map(
                          (day) => (
                            <span
                              key={day}
                              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800"
                            >
                              {day}
                              {canWrite && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((prev) => ({
                                      ...prev,
                                      businessHoursOfOperation: {
                                        ...prev.businessHoursOfOperation,
                                        shiftWorker: {
                                          ...prev.businessHoursOfOperation
                                            .shiftWorker,
                                          weekDays:
                                            prev.businessHoursOfOperation.shiftWorker.weekDays.filter(
                                              (d) => d !== day
                                            ),
                                        },
                                      },
                                    }))
                                  }
                                  className="ml-1 text-green-600 hover:text-green-800"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign className="text-blue-600" size={24} />
              <Title as="h3" className="text-xl font-semibold">
                Additional Information
              </Title>
            </div>

            <div className="space-y-6">
              <div>
                <Checkbox
                  label="Not For Profit Organisation"
                  checked={form.isNotForProfit}
                  disabled={!canWrite}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isNotForProfit: e.target.checked,
                    }))
                  }
                />
              </div>

              <div>
                <Checkbox
                  label="Salary Packaging Available"
                  checked={form.isSalaryPackagingAvailable}
                  disabled={!canWrite}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      isSalaryPackagingAvailable: checked,
                      // Clear amount if disabled
                      salaryPackagingMaximumAmount: checked
                        ? prev.salaryPackagingMaximumAmount
                        : 0,
                    }));
                  }}
                />
              </div>

              {form.isSalaryPackagingAvailable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Packaging Maximum Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium z-10">
                      $
                    </span>
                    <Input
                      type="number"
                      value={form.salaryPackagingMaximumAmount || ""}
                      disabled={!canWrite}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          salaryPackagingMaximumAmount:
                            parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="Enter maximum amount"
                      className="pl-7"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Submit Button */}
          {canWrite && (
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          )}
          {!canWrite && (
            <div className="flex justify-end">
              <p className="text-sm text-gray-500 italic">
                You don&apos;t have permission to save changes
              </p>
            </div>
          )}
        </form>
      </div>
    </PermissionGuard>
  );
}
