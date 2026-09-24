"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  Title,
  Text,
  Button,
  Input,
  Textarea,
  Checkbox,
  Select,
} from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";

interface IndustryType {
  _id: string;
  name: string;
}

interface IndustrySubType {
  _id: string;
  name: string;
  description?: string;
  code?: string;
  industryTypeId: string | { _id: string; name: string };
  isActive: boolean;
}

interface IndustrySubTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: IndustrySubType;
}

export default function IndustrySubTypeFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: IndustrySubTypeFormModalProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    industryTypeId: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [industryTypes, setIndustryTypes] = useState<IndustryType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchIndustryTypes();
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      const industryTypeId =
        typeof initialData.industryTypeId === "object"
          ? initialData.industryTypeId._id
          : initialData.industryTypeId;
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        industryTypeId: industryTypeId || "",
        isActive: initialData.isActive ?? true,
      });
    } else {
      setForm({
        name: "",
        description: "",
        industryTypeId: "",
        isActive: true,
      });
    }
  }, [initialData, isOpen]);

  const fetchIndustryTypes = async () => {
    try {
      setLoadingTypes(true);
      const res = await axiosInstance.get("/admin/industry-types");
      setIndustryTypes(res.data.data || []);
    } catch (error: any) {
      console.error("Failed to fetch industry types", error);
      toast.error("Failed to load industry types");
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleIndustryTypeChange = (option: any) => {
    setForm((prev) => ({ ...prev, industryTypeId: option?.value || "" }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setForm((prev) => ({ ...prev, isActive: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!form.industryTypeId) {
      toast.error("Industry Type is required");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        industryTypeId: form.industryTypeId,
        isActive: form.isActive,
      };

      if (initialData) {
        await axiosInstance.put(
          `/admin/industry-sub-types/${initialData._id}`,
          payload
        );
        toast.success("Industry sub type updated successfully");
      } else {
        await axiosInstance.post("/admin/industry-sub-types", payload);
        toast.success("Industry sub type created successfully");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save industry sub type", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save industry sub type. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const industryTypeOptions = industryTypes.map((type) => ({
    label: type.name,
    value: type._id,
  }));

  const selectedIndustryType = industryTypeOptions.find(
    (opt) => opt.value === form.industryTypeId
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" rounded="lg">
      <div className="m-auto px-7 pt-6 pb-7">
        <Title as="h3" className="mb-2">
          {initialData ? "Edit Industry Sub Type" : "Create Industry Sub Type"}
        </Title>
        <Text className="text-gray-600 mb-6">
          {initialData
            ? "Update the industry sub type details below."
            : "Fill in the details to create a new industry sub type."}
        </Text>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Industry Type <span className="text-red-500">*</span>
            </label>
            <Select
              label=""
              value={selectedIndustryType || null}
              onChange={handleIndustryTypeChange}
              options={industryTypeOptions}
              placeholder="Select Industry Type"
              searchable
              disabled={loadingTypes}
            />
            {loadingTypes && (
              <p className="text-xs text-gray-500 mt-1">
                Loading industry types...
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g., Software Development, Medical Services"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter industry sub type description..."
              rows={4}
              className="w-full"
            />
          </div>

          <div>
            <Checkbox
              label="Active"
              checked={form.isActive}
              onChange={handleCheckboxChange}
            />
            <p className="text-xs text-gray-500 mt-1">
              Inactive industry sub types will not be available for selection
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? initialData
                  ? "Updating..."
                  : "Creating..."
                : initialData
                  ? "Update Industry Sub Type"
                  : "Create Industry Sub Type"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
