"use client";

import { useEffect, useState } from "react";
import { Modal, Title, Text, Button, Input, Textarea, Select } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";

interface Award {
  _id: string;
  title: string;
}

interface AwardEmployeeType {
  _id: string;
  title: string;
  description?: string;
  awardId?: string | { _id: string; title: string };
}

interface AwardEmployeeTypeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: AwardEmployeeType;
}

export default function AwardEmployeeTypeFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: AwardEmployeeTypeFormModalProps) {
  const [awards, setAwards] = useState<Award[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    awardId: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetchingAwards, setFetchingAwards] = useState(false);

  // Fetch awards when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAwards();
    }
  }, [isOpen]);

  const fetchAwards = async () => {
    try {
      setFetchingAwards(true);
      const res = await axiosInstance.get("/admin/awards");
      setAwards(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch awards", error);
      toast.error("Failed to load awards");
    } finally {
      setFetchingAwards(false);
    }
  };

  useEffect(() => {
    if (initialData) {
      const awardIdValue =
        typeof initialData.awardId === "object"
          ? initialData.awardId._id
          : initialData.awardId || "";

      setForm({
        title: initialData.title || "",
        description: initialData.description || "",
        awardId: awardIdValue,
      });
    } else {
      setForm({
        title: "",
        description: "",
        awardId: "",
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

    if (!form.awardId) {
      toast.error("Award is required");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        awardId: form.awardId,
      };

      if (initialData) {
        await axiosInstance.put(
          `/admin/award-employee-types/${initialData._id}`,
          payload
        );
        toast.success("Award employee type updated successfully");
      } else {
        await axiosInstance.post("/admin/award-employee-types", payload);
        toast.success("Award employee type created successfully");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save award employee type", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save award employee type. Please try again."
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
            ? "Edit Award Employee Type"
            : "Create Award Employee Type"}
        </Title>
        <Text className="text-gray-600 mb-6">
          {initialData
            ? "Update the award employee type details below."
            : "Fill in the details to create a new award employee type."}
        </Text>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Award <span className="text-red-500">*</span>
            </label>
            <Select
              label=""
              value={
                form.awardId
                  ? awards.find((a) => a._id === form.awardId)
                    ? {
                        label:
                          awards.find((a) => a._id === form.awardId)?.title ||
                          "",
                        value: form.awardId,
                      }
                    : null
                  : null
              }
              onChange={(opt: any) =>
                setForm((prev) => ({
                  ...prev,
                  awardId: opt?.value || "",
                }))
              }
              options={awards.map((award) => ({
                label: award.title,
                value: award._id,
              }))}
              placeholder="Select an award"
              isSearchable
              disabled={fetchingAwards}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              name="title"
              value={form.title}
              onChange={handleChange}
              placeholder="e.g., Full-time Employee"
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
              placeholder="Enter description..."
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
                  ? "Update Award Employee Type"
                  : "Create Award Employee Type"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
