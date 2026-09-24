"use client";

import { useEffect, useState } from "react";
import { Modal, Title, Text, Button, Input, Textarea, Checkbox } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";

interface IndustryType {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface IndustryTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: IndustryType;
}

export default function IndustryTypeFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: IndustryTypeFormModalProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        isActive: initialData.isActive ?? true,
      });
    } else {
      setForm({
        name: "",
        description: "",
        isActive: true,
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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

    try {
      setLoading(true);
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isActive: form.isActive,
      };

      if (initialData) {
        await axiosInstance.put(
          `/admin/industry-types/${initialData._id}`,
          payload
        );
        toast.success("Industry type updated successfully");
      } else {
        await axiosInstance.post("/admin/industry-types", payload);
        toast.success("Industry type created successfully");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save industry type", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save industry type. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" rounded="lg">
      <div className="m-auto px-7 pt-6 pb-7">
        <Title as="h3" className="mb-2">
          {initialData ? "Edit Industry Type" : "Create Industry Type"}
        </Title>
        <Text className="text-gray-600 mb-6">
          {initialData
            ? "Update the industry type details below."
            : "Fill in the details to create a new industry type."}
        </Text>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <Input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g., Technology, Healthcare, Finance"
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
              placeholder="Enter industry type description..."
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
              Inactive industry types will not be available for selection
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
                  ? "Update Industry Type"
                  : "Create Industry Type"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
