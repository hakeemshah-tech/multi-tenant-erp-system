"use client";

import { useEffect, useState } from "react";
import { Button, Input, Title, Text } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { UserCheck, Save, Loader2, Plus, X } from "lucide-react";

interface PersonalSettingsMaster {
  gender: {
    options: string[];
    defaultOptions: string[];
  };
  pronouns: {
    options: string[];
    defaultOptions: string[];
  };
  residencystatus: {
    options: string[];
    defaultOptions: string[];
  };
  typeofvisa: {
    options: string[];
    defaultOptions: string[];
  };
}

export default function PersonalSettingsMasterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PersonalSettingsMaster>({
    gender: {
      options: ["Male", "Female", "Intersex", "Don't want to Specify"],
      defaultOptions: ["Male", "Female", "Intersex", "Don't want to Specify"],
    },
    pronouns: {
      options: ["He/Him", "She/Her", "They/Them"],
      defaultOptions: ["He/Him", "She/Her", "They/Them"],
    },
    residencystatus: {
      options: ["Australian Citizen", "Permanent Resident", "Visa Holder"],
      defaultOptions: [
        "Australian Citizen",
        "Permanent Resident",
        "Visa Holder",
      ],
    },
    typeofvisa: {
      options: ["Work Visa", "Student Visa", "Working Holiday Visa"],
      defaultOptions: ["Work Visa", "Student Visa", "Working Holiday Visa"],
    },
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/admin/personal-settings-master");
      const data = res.data.data || {};
      setSettings({
        gender: data.gender || {
          options: ["Male", "Female", "Intersex", "Don't want to Specify"],
          defaultOptions: [
            "Male",
            "Female",
            "Intersex",
            "Don't want to Specify",
          ],
        },
        pronouns: data.pronouns || {
          options: ["He/Him", "She/Her", "They/Them"],
          defaultOptions: ["He/Him", "She/Her", "They/Them"],
        },
        residencystatus: data.residencystatus || {
          options: ["Australian Citizen", "Permanent Resident", "Visa Holder"],
          defaultOptions: [
            "Australian Citizen",
            "Permanent Resident",
            "Visa Holder",
          ],
        },
        typeofvisa: data.typeofvisa || {
          options: ["Work Visa", "Student Visa", "Working Holiday Visa"],
          defaultOptions: ["Work Visa", "Student Visa", "Working Holiday Visa"],
        },
      });
    } catch (error: any) {
      console.error("Failed to fetch personal settings master", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to load personal settings master"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axiosInstance.put("/admin/personal-settings-master", settings);
      toast.success("Personal settings master saved successfully");
    } catch (error: any) {
      console.error("Failed to save personal settings master", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to save personal settings master"
      );
    } finally {
      setSaving(false);
    }
  };

  const addOption = (
    fieldKey: "gender" | "pronouns" | "residencystatus" | "typeofvisa"
  ) => {
    setSettings((prev) => ({
      ...prev,
      [fieldKey]: {
        ...prev[fieldKey],
        options: [...(prev[fieldKey]?.options || []), ""],
      },
    }));
  };

  const updateOption = (
    fieldKey: "gender" | "pronouns" | "residencystatus" | "typeofvisa",
    index: number,
    value: string
  ) => {
    setSettings((prev) => {
      const options = [...(prev[fieldKey]?.options || [])];
      options[index] = value;
      return {
        ...prev,
        [fieldKey]: { ...prev[fieldKey], options },
      };
    });
  };

  const removeOption = (
    fieldKey: "gender" | "pronouns" | "residencystatus" | "typeofvisa",
    index: number
  ) => {
    setSettings((prev) => {
      const options = [...(prev[fieldKey]?.options || [])];
      const defaultOptions = prev[fieldKey]?.defaultOptions || [];
      const optionToRemove = options[index];

      // Prevent removing default options
      if (defaultOptions.includes(optionToRemove)) {
        toast.error("Cannot remove default options");
        return prev;
      }

      options.splice(index, 1);
      return {
        ...prev,
        [fieldKey]: { ...prev[fieldKey], options },
      };
    });
  };

  const isDefaultOption = (
    fieldKey: "gender" | "pronouns" | "residencystatus" | "typeofvisa",
    option: string
  ): boolean => {
    return (settings[fieldKey]?.defaultOptions || []).includes(option);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <UserCheck className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <Title as="h1" className="text-2xl font-bold text-gray-900">
              Personal Settings Master
            </Title>
            <Text className="text-sm text-gray-500 mt-1">
              Manage master data for personal settings (Gender, Pronouns,
              Residency Status, Type of Visa)
            </Text>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      {/* Settings Form */}
      <Card className="p-8 shadow-sm border border-gray-200">
        <div className="space-y-8">
          {/* Gender */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Gender Options
              </label>
              <Text className="text-xs text-gray-500">
                Configure available gender options (default options cannot be
                removed)
              </Text>
            </div>
            <div className="space-y-2">
              {(settings.gender?.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) =>
                      updateOption("gender", index, e.target.value)
                    }
                    placeholder="Enter gender option"
                    className="flex-1"
                    disabled={isDefaultOption("gender", option)}
                  />
                  {!isDefaultOption("gender", option) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption("gender", index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {isDefaultOption("gender", option) && (
                    <span className="text-xs text-gray-400 px-2">Default</span>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption("gender")}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            </div>
          </div>

          {/* Pronouns */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Pronouns Options
              </label>
              <Text className="text-xs text-gray-500">
                Configure available pronouns options (default options cannot be
                removed)
              </Text>
            </div>
            <div className="space-y-2">
              {(settings.pronouns?.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) =>
                      updateOption("pronouns", index, e.target.value)
                    }
                    placeholder="Enter pronouns option"
                    className="flex-1"
                    disabled={isDefaultOption("pronouns", option)}
                  />
                  {!isDefaultOption("pronouns", option) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption("pronouns", index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {isDefaultOption("pronouns", option) && (
                    <span className="text-xs text-gray-400 px-2">Default</span>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption("pronouns")}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            </div>
          </div>

          {/* Residency Status */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Residency Status Options
              </label>
              <Text className="text-xs text-gray-500">
                Configure available residency status options (default options
                cannot be removed)
              </Text>
            </div>
            <div className="space-y-2">
              {(settings.residencystatus?.options || []).map(
                (option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) =>
                        updateOption("residencystatus", index, e.target.value)
                      }
                      placeholder="Enter residency status option"
                      className="flex-1"
                      disabled={isDefaultOption("residencystatus", option)}
                    />
                    {!isDefaultOption("residencystatus", option) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeOption("residencystatus", index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {isDefaultOption("residencystatus", option) && (
                      <span className="text-xs text-gray-400 px-2">
                        Default
                      </span>
                    )}
                  </div>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption("residencystatus")}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            </div>
          </div>

          {/* Type of Visa */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Type of Visa Options
              </label>
              <Text className="text-xs text-gray-500">
                Configure available type of visa options (default options cannot
                be removed)
              </Text>
            </div>
            <div className="space-y-2">
              {(settings.typeofvisa?.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) =>
                      updateOption("typeofvisa", index, e.target.value)
                    }
                    placeholder="Enter type of visa option"
                    className="flex-1"
                    disabled={isDefaultOption("typeofvisa", option)}
                  />
                  {!isDefaultOption("typeofvisa", option) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption("typeofvisa", index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {isDefaultOption("typeofvisa", option) && (
                    <span className="text-xs text-gray-400 px-2">Default</span>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption("typeofvisa")}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Info Card */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <div className="flex items-start gap-3">
          <div className="p-1.5 bg-blue-100 rounded-lg mt-0.5">
            <UserCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <Text className="text-sm font-semibold text-blue-900 mb-1">
              About Master Data
            </Text>
            <Text className="text-xs text-blue-800">
              Master data options will be available to all employers by default.
              Employers can select which master options to use. Default options
              cannot be removed and will always be present.
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
