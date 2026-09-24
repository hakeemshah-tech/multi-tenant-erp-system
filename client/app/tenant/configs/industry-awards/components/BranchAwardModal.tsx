"use client";

import { useEffect, useState } from "react";
import { Title, Text, Button, Select } from "rizzui";
import { EditDrawer } from "@/app/components/shared/EditDrawer";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { TrendingUp, Calendar, DollarSign } from "lucide-react";

interface Award {
  _id: string;
  title: string;
}

interface AwardEmployeeType {
  _id: string;
  title: string;
  awardId?: string | { _id: string; title: string };
}

interface Rate {
  level: number;
  baseMinimumHourlyRates: number;
}

interface HourlyRateData {
  rates: Rate[];
  startDate?: string;
  endDate?: string;
}

interface BranchAwardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId: string;
  awards: Award[];
  awardEmployeeTypes: AwardEmployeeType[];
  editingAward?: { awardId: string; awardEmployeeTypeIds: string[] } | null;
}

export default function BranchAwardModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
  awards,
  awardEmployeeTypes,
  editingAward,
}: BranchAwardModalProps) {
  const [selectedAwardId, setSelectedAwardId] = useState<string>("");
  const [selectedAwardEmployeeTypeIds, setSelectedAwardEmployeeTypeIds] =
    useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [ratesData, setRatesData] = useState<
    Record<string, HourlyRateData | null>
  >({});
  const [loadingRates, setLoadingRates] = useState<Record<string, boolean>>({});

  // Filter award employee types based on selected award
  const filteredAwardEmployeeTypes = selectedAwardId
    ? awardEmployeeTypes.filter((type) => {
        const typeAwardId =
          typeof type.awardId === "object" ? type.awardId._id : type.awardId;
        return String(typeAwardId) === String(selectedAwardId);
      })
    : [];

  useEffect(() => {
    if (editingAward) {
      setSelectedAwardId(editingAward.awardId);
      setSelectedAwardEmployeeTypeIds(editingAward.awardEmployeeTypeIds);
    } else {
      setSelectedAwardId("");
      setSelectedAwardEmployeeTypeIds([]);
    }
    // Reset rates data when modal opens/closes
    setRatesData({});
    setLoadingRates({});
  }, [editingAward, isOpen]);

  // Fetch rates for selected award employee types
  useEffect(() => {
    if (selectedAwardId && selectedAwardEmployeeTypeIds.length > 0) {
      selectedAwardEmployeeTypeIds.forEach((typeId) => {
        // Only fetch if we don't already have data and aren't currently loading
        const hasData = ratesData[typeId] !== undefined;
        const isLoading = loadingRates[typeId] === true;

        if (!hasData && !isLoading) {
          fetchRatesForType(typeId);
        }
      });
    } else {
      setRatesData({});
      setLoadingRates({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAwardId, selectedAwardEmployeeTypeIds.join(",")]);

  const fetchRatesForType = async (typeId: string) => {
    if (!selectedAwardId) return;

    setLoadingRates((prev) => ({ ...prev, [typeId]: true }));
    try {
      const res = await axiosInstance.get("/hourly-rate-managements/active", {
        params: {
          awardId: selectedAwardId,
          awardEmployeeTypeId: typeId,
        },
      });

      if (res.data?.data) {
        setRatesData((prev) => ({
          ...prev,
          [typeId]: {
            rates: res.data.data.rates || [],
            startDate: res.data.data.startDate,
            endDate: res.data.data.endDate,
          },
        }));
      } else {
        setRatesData((prev) => ({ ...prev, [typeId]: null }));
      }
    } catch (error) {
      console.error(`Failed to fetch rates for type ${typeId}:`, error);
      setRatesData((prev) => ({ ...prev, [typeId]: null }));
    } finally {
      setLoadingRates((prev) => ({ ...prev, [typeId]: false }));
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleAwardChange = (opt: any) => {
    const newAwardId = opt?.value || "";
    setSelectedAwardId(newAwardId);
    // Clear selected types if award changes
    setSelectedAwardEmployeeTypeIds([]);
  };

  const toggleAwardEmployeeType = (typeId: string) => {
    setSelectedAwardEmployeeTypeIds((prev) => {
      if (prev.includes(typeId)) {
        return prev.filter((id) => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!selectedAwardId) {
      toast.error("Please select an award");
      return;
    }

    if (selectedAwardEmployeeTypeIds.length === 0) {
      toast.error("Please select at least one award employee type");
      return;
    }

    try {
      setLoading(true);
      if (editingAward) {
        // Update existing award
        await axiosInstance.put(
          `/branches/${branchId}/awards/${selectedAwardId}`,
          {
            awardEmployeeTypeIds: selectedAwardEmployeeTypeIds,
          }
        );
        toast.success("Award updated successfully");
      } else {
        // Add new award
        await axiosInstance.post(`/branches/${branchId}/awards`, {
          awardId: selectedAwardId,
          awardEmployeeTypeIds: selectedAwardEmployeeTypeIds,
        });
        toast.success("Award added successfully");
      }
      onSuccess();
    } catch (error: any) {
      console.error("Failed to save branch award", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save branch award. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <EditDrawer
      open={isOpen}
      title={editingAward ? "Edit Branch Award" : "Add Award to Branch"}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              loading ||
              !selectedAwardId ||
              selectedAwardEmployeeTypeIds.length === 0
            }
          >
            {loading
              ? editingAward
                ? "Updating..."
                : "Adding..."
              : editingAward
                ? "Update Award"
                : "Add Award"}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Text className="text-gray-600">
          {editingAward
            ? "Update the award employee types for this award."
            : "Select an award and assign award employee types to this branch."}
        </Text>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Award <span className="text-red-500">*</span>
            </label>
            <Select
              label=""
              value={
                selectedAwardId
                  ? awards.find((a) => a._id === selectedAwardId)
                    ? {
                        label:
                          awards.find((a) => a._id === selectedAwardId)
                            ?.title || "",
                        value: selectedAwardId,
                      }
                    : null
                  : null
              }
              onChange={handleAwardChange}
              options={awards.map((award) => ({
                label: award.title,
                value: award._id,
              }))}
              placeholder="Select an award"
              searchable
              disabled={!!editingAward}
            />
            {editingAward && (
              <p className="text-xs text-gray-500 mt-1">
                Award cannot be changed when editing
              </p>
            )}
          </div>

          {selectedAwardId && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Award Employee Types <span className="text-red-500">*</span>
              </label>
              {filteredAwardEmployeeTypes.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    No award employee types found for the selected award. Please
                    create award employee types first.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredAwardEmployeeTypes.map((type) => {
                    const isSelected = selectedAwardEmployeeTypeIds.includes(
                      type._id
                    );
                    const typeRates = ratesData[type._id];
                    const isLoadingTypeRates = loadingRates[type._id];

                    return (
                      <div
                        key={type._id}
                        className={`border-2 rounded-lg transition-all ${
                          isSelected
                            ? "border-blue-500 bg-blue-50/50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div
                          onClick={() => toggleAwardEmployeeType(type._id)}
                          className="flex items-center gap-3 p-4 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAwardEmployeeType(type._id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">
                              {type.title}
                            </p>
                            {type.description && (
                              <p className="text-xs text-gray-500 mt-1">
                                {type.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Rates Display */}
                        {isSelected && (
                          <div className="px-4 pb-4 border-t border-gray-200 mt-2 pt-4">
                            {isLoadingTypeRates ? (
                              <div className="flex items-center justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                <span className="ml-2 text-sm text-gray-600">
                                  Loading rates...
                                </span>
                              </div>
                            ) : typeRates &&
                              typeRates.rates &&
                              typeRates.rates.length > 0 ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                                  <Calendar className="h-3.5 w-3.5" />
                                  <span>
                                    Valid: {formatDate(typeRates.startDate)}
                                    {typeRates.endDate &&
                                      ` - ${formatDate(typeRates.endDate)}`}
                                    {!typeRates.endDate && " (Ongoing)"}
                                  </span>
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 p-2">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <TrendingUp className="h-3 w-3 text-blue-600" />
                                    <span className="text-[10px] font-semibold text-gray-700 uppercase tracking-wide">
                                      Rates & Levels
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {typeRates.rates
                                      .sort((a, b) => a.level - b.level)
                                      .map((rate, idx) => (
                                        <div
                                          key={idx}
                                          className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded p-1.5 hover:shadow-sm transition-shadow"
                                        >
                                          <div className="flex items-center gap-1 mb-0.5">
                                            <DollarSign className="h-2.5 w-2.5 text-blue-600" />
                                            <span className="text-[10px] font-semibold text-blue-700">
                                              Level {rate.level}
                                            </span>
                                          </div>
                                          <p className="text-xs font-bold text-gray-900">
                                            $
                                            {rate.baseMinimumHourlyRates.toFixed(
                                              2
                                            )}
                                          </p>
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs text-amber-800">
                                  No active rates configured for this award
                                  employee type.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                {selectedAwardEmployeeTypeIds.length} of{" "}
                {filteredAwardEmployeeTypes.length} selected
              </p>
            </div>
          )}
        </form>
      </div>
    </EditDrawer>
  );
}
