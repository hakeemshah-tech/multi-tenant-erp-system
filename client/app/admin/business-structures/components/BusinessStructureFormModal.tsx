"use client";

import { useEffect, useState } from "react";
import { Modal, Title, Text, Button, Input, Textarea, Checkbox } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";

interface BusinessStructure {
  _id: string;
  name: string;
  description?: string;
  code?: string;
  isActive: boolean;
}

interface BusinessStructureFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: BusinessStructure;
}

export default function BusinessStructureFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: BusinessStructureFormModalProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    code: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        description: initialData.description || "",
        code: initialData.code || "",
        isActive: initialData.isActive ?? true,
      });
    } else {
      setForm({
        name: "",
        description: "",
        code: "",
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
        code: form.code.trim() || undefined,
        isActive: form.isActive,
      };

      if (initialData) {
        await axiosInstance.put(
          `/admin/business-structures/${initialData._id}`,
          payload
        );
        toast.success("Business structure updated successfully");
      } else {
        await axiosInstance.post("/admin/business-structures", payload);
        toast.success("Business structure created successfully");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save business structure", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save business structure. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" rounded="lg">
      <div className="m-auto px-7 pt-6 pb-7">
        <Title as="h3" className="mb-2">
          {initialData
            ? "Edit Business Structure"
            : "Create Business Structure"}
        </Title>
        <Text className="text-gray-600 mb-6">
          {initialData
            ? "Update the business structure details below."
            : "Fill in the details to create a new business structure."}
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
              placeholder="e.g., Corporation, Partnership, LLC"
              required
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Code
            </label>
            <Input
              name="code"
              value={form.code}
              onChange={handleChange}
              placeholder="e.g., CORP, PART, LLC"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional unique code for the business structure
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Enter business structure description..."
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
              Inactive business structures will not be available for selection
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
                  ? "Update Business Structure"
                  : "Create Business Structure"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
