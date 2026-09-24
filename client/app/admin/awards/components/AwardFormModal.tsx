"use client";

import { useEffect, useState } from "react";
import { Modal, Title, Text, Button, Input, Textarea } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";

interface Award {
  _id: string;
  title: string;
  description?: string;
  icon?: string;
  isActive: boolean;
}

interface AwardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Award;
}

export default function AwardFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AwardFormModalProps) {
  const [form, setForm] = useState({
    title: "",
    description: "",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || "",
        description: initialData.description || "",
      });
    } else {
      setForm({
        title: "",
        description: "",
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
      };

      if (initialData) {
        await axiosInstance.put(`/admin/awards/${initialData._id}`, payload);
        toast.success("Award updated successfully");
      } else {
        await axiosInstance.post("/admin/awards", payload);
        toast.success("Award created successfully");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save award", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save award. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" rounded="lg">
      <div className="m-auto px-7 pt-6 pb-7">
        <Title as="h3" className="mb-2">
          {initialData ? "Edit Award" : "Create Award"}
        </Title>
        <Text className="text-gray-600 mb-6">
          {initialData
            ? "Update the award details below."
            : "Fill in the details to create a new award."}
        </Text>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., Employee of the Month"
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
              placeholder="Enter award description..."
              rows={4}
              className="w-full"
            />
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
                  ? "Update Award"
                  : "Create Award"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
