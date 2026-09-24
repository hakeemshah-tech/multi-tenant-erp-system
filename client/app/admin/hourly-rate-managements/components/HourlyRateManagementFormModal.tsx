"use client";

import { useEffect, useState, useRef } from "react";
import { Modal, Title, Text, Button, Input, Select } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Plus, Trash2 } from "lucide-react";

interface Rate {
  level: number;
  baseMinimumHourlyRates: number;
}

interface Award {
  _id: string;
  title: string;
}

interface AwardEmployeeType {
  _id: string;
  title: string;
  awardId?: string | { _id: string; title: string };
}

interface HourlyRateManagement {
  _id: string;
  awardId: string | { _id: string; title: string };
  awardEmployeeTypeId: string | { _id: string; title: string };
  startDate: string;
  endDate: string;
  rates: Rate[];
}

interface HourlyRateManagementFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: HourlyRateManagement;
}

export default function HourlyRateManagementFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: HourlyRateManagementFormModalProps) {
  const [awards, setAwards] = useState<Award[]>([]);
  const [allAwardEmployeeTypes, setAllAwardEmployeeTypes] = useState<
    AwardEmployeeType[]
  >([]);
  const [form, setForm] = useState({
    awardId: "",
    awardEmployeeTypeId: "",
    startDate: "",
    endDate: "",
    rates: [{ level: 1.1, baseMinimumHourlyRates: 0 }] as Rate[],
  });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const ratesContainerRef = useRef<HTMLDivElement>(null);
  const lastRateRef = useRef<HTMLDivElement>(null);

  // Filter award employee types based on selected award
  const filteredAwardEmployeeTypes = form.awardId
    ? allAwardEmployeeTypes.filter((type) => {
        const typeAwardId =
          typeof type.awardId === "object" ? type.awardId._id : type.awardId;
        return typeAwardId === form.awardId;
      })
    : [];

  // Fetch awards and award employee types
  useEffect(() => {
    if (isOpen) {
      fetchAwards();
      fetchAwardEmployeeTypes();
    }
  }, [isOpen]);

  const fetchAwards = async () => {
    try {
      const res = await axiosInstance.get("/admin/awards");
      setAwards(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch awards", error);
    }
  };

  const fetchAwardEmployeeTypes = async () => {
    try {
      const res = await axiosInstance.get("/admin/award-employee-types");
      setAllAwardEmployeeTypes(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch award employee types", error);
    }
  };

  useEffect(() => {
    if (initialData) {
      const awardId =
        typeof initialData.awardId === "object"
          ? initialData.awardId._id
          : initialData.awardId;
      const awardEmployeeTypeId =
        typeof initialData.awardEmployeeTypeId === "object"
          ? initialData.awardEmployeeTypeId._id
          : initialData.awardEmployeeTypeId;

      setForm({
        awardId,
        awardEmployeeTypeId,
        startDate: initialData.startDate
          ? new Date(initialData.startDate).toISOString().split("T")[0]
          : "",
        endDate: initialData.endDate
          ? new Date(initialData.endDate).toISOString().split("T")[0]
          : "",
        rates:
          initialData.rates && initialData.rates.length > 0
            ? initialData.rates
            : [{ level: 1.1, baseMinimumHourlyRates: 0 }],
      });
    } else {
      setForm({
        awardId: "",
        awardEmployeeTypeId: "",
        startDate: "",
        endDate: "",
        rates: [{ level: 1.1, baseMinimumHourlyRates: 0 }],
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRateChange = (
    index: number,
    field: keyof Rate,
    value: number
  ) => {
    setForm((prev) => {
      const newRates = [...prev.rates];
      newRates[index] = { ...newRates[index], [field]: value };
      return { ...prev, rates: newRates };
    });
  };

  const addRate = () => {
    setForm((prev) => {
      const lastLevel =
        prev.rates.length > 0 ? prev.rates[prev.rates.length - 1].level : 0.1;
      // Calculate next level and round to 1 decimal place to avoid floating-point precision issues
      const nextLevel = Math.round((lastLevel + 0.1) * 10) / 10;
      return {
        ...prev,
        rates: [
          ...prev.rates,
          {
            level: nextLevel,
            baseMinimumHourlyRates: 0,
          },
        ],
      };
    });
  };

  // Auto-scroll to bottom when a new rate is added
  useEffect(() => {
    if (form.rates.length > 0) {
      setTimeout(() => {
        if (lastRateRef.current) {
          lastRateRef.current.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        } else if (ratesContainerRef.current) {
          ratesContainerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
        }
      }, 150);
    }
  }, [form.rates.length]);

  const removeRate = (index: number) => {
    if (form.rates.length > 1) {
      setForm((prev) => ({
        ...prev,
        rates: prev.rates.filter((_, i) => i !== index),
      }));
    } else {
      toast.error("At least one rate is required");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.awardId) {
      toast.error("Award is required");
      return;
    }

    if (!form.awardEmployeeTypeId) {
      toast.error("Award Employee Type is required");
      return;
    }

    if (!form.startDate) {
      toast.error("Start date is required");
      return;
    }

    if (form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      toast.error("End date must be greater than or equal to start date");
      return;
    }

    if (form.rates.length === 0) {
      toast.error("At least one rate is required");
      return;
    }

    // Validate rates
    for (const rate of form.rates) {
      if (!rate.level || rate.level <= 0) {
        toast.error("All rates must have a valid level");
        return;
      }
      if (!rate.baseMinimumHourlyRates || rate.baseMinimumHourlyRates <= 0) {
        toast.error("All rates must have a valid base minimum hourly rate");
        return;
      }
    }

    try {
      setLoading(true);
      const payload: any = {
        awardId: form.awardId,
        awardEmployeeTypeId: form.awardEmployeeTypeId,
        startDate: form.startDate,
        rates: form.rates,
      };

      if (form.endDate) {
        payload.endDate = form.endDate;
      }

      if (initialData) {
        await axiosInstance.put(
          `/admin/hourly-rate-managements/${initialData._id}`,
          payload
        );
        toast.success("Hourly rate management updated successfully");
      } else {
        await axiosInstance.post("/admin/hourly-rate-managements", payload);
        toast.success("Hourly rate management created successfully");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Failed to save hourly rate management", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save hourly rate management. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" rounded="lg">
      <div className="m-auto px-7 pt-6 pb-7 max-h-[90vh] overflow-y-auto">
        <Title as="h3" className="mb-2">
          {initialData
            ? "Edit Hourly Rate Management"
            : "Create Hourly Rate Management"}
        </Title>
        <Text className="text-gray-600 mb-6">
          {initialData
            ? "Update the hourly rate management details below."
            : "Fill in the details to create a new hourly rate management."}
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
              onChange={(opt: any) => {
                const newAwardId = opt?.value || "";
                setForm((prev) => {
                  // Clear awardEmployeeTypeId if it's not valid for the new award
                  const currentAwardEmployeeType = allAwardEmployeeTypes.find(
                    (t) => t._id === prev.awardEmployeeTypeId
                  );
                  const shouldClearAwardEmployeeType =
                    !newAwardId ||
                    (currentAwardEmployeeType &&
                      (typeof currentAwardEmployeeType.awardId === "object"
                        ? currentAwardEmployeeType.awardId._id
                        : currentAwardEmployeeType.awardId) !== newAwardId);

                  return {
                    ...prev,
                    awardId: newAwardId,
                    awardEmployeeTypeId: shouldClearAwardEmployeeType
                      ? ""
                      : prev.awardEmployeeTypeId,
                  };
                });
              }}
              options={awards.map((award) => ({
                label: award.title,
                value: award._id,
              }))}
              placeholder="Select an award"
              isSearchable
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Award Employee Type <span className="text-red-500">*</span>
            </label>
            <Select
              label=""
              value={
                form.awardEmployeeTypeId
                  ? filteredAwardEmployeeTypes.find(
                      (t) => t._id === form.awardEmployeeTypeId
                    )
                    ? {
                        label:
                          filteredAwardEmployeeTypes.find(
                            (t) => t._id === form.awardEmployeeTypeId
                          )?.title || "",
                        value: form.awardEmployeeTypeId,
                      }
                    : null
                  : null
              }
              onChange={(opt: any) =>
                setForm((prev) => ({
                  ...prev,
                  awardEmployeeTypeId: opt?.value || "",
                }))
              }
              options={filteredAwardEmployeeTypes.map((type) => ({
                label: type.title,
                value: type._id,
              }))}
              placeholder={
                !form.awardId
                  ? "Please select an award first"
                  : filteredAwardEmployeeTypes.length === 0
                    ? "No award employee types found for this award"
                    : "Select an award employee type"
              }
              isSearchable
              disabled={
                !form.awardId || filteredAwardEmployeeTypes.length === 0
              }
            />
            {!form.awardId && (
              <p className="text-xs text-gray-500 mt-1">
                Please select an award first to see available award employee
                types
              </p>
            )}
            {form.awardId && filteredAwardEmployeeTypes.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No award employee types found for the selected award. Please
                create one first.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                name="startDate"
                value={form.startDate}
                onChange={handleChange}
                required
                className="w-full"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <Input
                type="date"
                name="endDate"
                value={form.endDate}
                onChange={handleChange}
                className="w-full"
              />
            </div>
          </div>

          <div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Rates <span className="text-red-500">*</span>
              </label>
            </div>

            <div
              className="space-y-3 border border-gray-200 rounded-lg p-4"
              ref={ratesContainerRef}
            >
              {form.rates.map((rate, index) => (
                <div
                  key={index}
                  ref={index === form.rates.length - 1 ? lastRateRef : null}
                  className="flex gap-3 items-end bg-gray-50 p-3 rounded-lg"
                >
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Level
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={Math.round(rate.level * 10) / 10}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        // Round to 1 decimal place to avoid floating-point precision issues
                        const roundedValue = Math.round(value * 10) / 10;
                        handleRateChange(index, "level", roundedValue);
                      }}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Base Minimum Hourly Rates
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rate.baseMinimumHourlyRates}
                      onChange={(e) =>
                        handleRateChange(
                          index,
                          "baseMinimumHourlyRates",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      required
                      className="w-full"
                    />
                  </div>
                  {form.rates.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      color="danger"
                      onClick={() => removeRate(index)}
                      className="mb-0"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}

              <div className="pt-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addRate}
                  className="flex items-center gap-1 w-full justify-center"
                >
                  <Plus size={14} />
                  Add Rate
                </Button>
              </div>
            </div>
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
                  ? "Update Hourly Rate Management"
                  : "Create Hourly Rate Management"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
