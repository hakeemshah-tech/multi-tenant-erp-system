"use client";

import { useEffect, useState } from "react";
import { Button, Input, Title, Text } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Briefcase, Save, Loader2, Plus, X } from "lucide-react";

interface EmploymentSettingsMaster {
  worktype: {
    options: string[];
    defaultOptions: string[];
  };
  employeetype: {
    options: string[];
    defaultOptions: string[];
  };
  employmentstatus: {
    options: string[];
    defaultOptions: string[];
  };
}

export default function EmploymentSettingsMasterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EmploymentSettingsMaster>({
    worktype: {
      options: ["Office Work", "Shift Work"],
      defaultOptions: ["Office Work", "Shift Work"],
    },
    employeetype: {
      options: [
        "Permanent Full Time",
        "Permanent Part Time",
        "Fixed Term Contract",
        "Casual",
        "Labour Hire",
      ],
      defaultOptions: [
        "Permanent Full Time",
        "Permanent Part Time",
        "Fixed Term Contract",
        "Casual",
        "Labour Hire",
      ],
    },
    employmentstatus: {
      options: [
        "Reference Check Started",
        "Reference Check Satisfactory",
        "Reference Check Unsatisfactory",
        "Offer Letter Issued",
        "Offer Accepted",
        "Offer Rejected",
        "Onboard",
        "No Show",
        "Resigned",
        "Terminated",
      ],
      defaultOptions: [
        "Reference Check Started",
        "Reference Check Satisfactory",
        "Reference Check Unsatisfactory",
        "Offer Letter Issued",
        "Offer Accepted",
        "Offer Rejected",
        "Onboard",
        "No Show",
        "Resigned",
        "Terminated",
      ],
    },
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/admin/employment-settings-master");
      const data = res.data.data || {};
      setSettings({
        worktype: data.worktype || {
          options: ["Office Work", "Shift Work"],
          defaultOptions: ["Office Work", "Shift Work"],
        },
        employeetype: data.employeetype || {
          options: [
            "Permanent Full Time",
            "Permanent Part Time",
            "Fixed Term Contract",
            "Casual",
            "Labour Hire",
          ],
          defaultOptions: [
            "Permanent Full Time",
            "Permanent Part Time",
            "Fixed Term Contract",
            "Casual",
            "Labour Hire",
          ],
        },
        employmentstatus: data.employmentstatus || {
          options: [
            "Reference Check Started",
            "Reference Check Satisfactory",
            "Reference Check Unsatisfactory",
            "Offer Letter Issued",
            "Offer Accepted",
            "Offer Rejected",
            "Onboard",
            "No Show",
            "Resigned",
            "Terminated",
          ],
          defaultOptions: [
            "Reference Check Started",
            "Reference Check Satisfactory",
            "Reference Check Unsatisfactory",
            "Offer Letter Issued",
            "Offer Accepted",
            "Offer Rejected",
            "Onboard",
            "No Show",
            "Resigned",
            "Terminated",
          ],
        },
      });
    } catch (error: any) {
      console.error("Failed to fetch employment settings master", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to load employment settings master"
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
      await axiosInstance.put("/admin/employment-settings-master", settings);
      toast.success("Employment settings master saved successfully");
    } catch (error: any) {
      console.error("Failed to save employment settings master", error);
      toast.error(
        error?.response?.data?.message ||
          "Failed to save employment settings master"
      );
    } finally {
      setSaving(false);
    }
  };

  const addOption = (
    fieldKey: "worktype" | "employeetype" | "employmentstatus"
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
    fieldKey: "worktype" | "employeetype" | "employmentstatus",
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
    fieldKey: "worktype" | "employeetype" | "employmentstatus",
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
    fieldKey: "worktype" | "employeetype" | "employmentstatus",
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
            <Briefcase className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <Title as="h1" className="text-2xl font-bold text-gray-900">
              Employment Settings Master
            </Title>
            <Text className="text-sm text-gray-500 mt-1">
              Manage master data for employment settings (Work Type, Employment
              Type, Employment Status)
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
          {/* Work Type */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Work Type Options
              </label>
              <Text className="text-xs text-gray-500">
                Configure available work type options (default options cannot be
                removed)
              </Text>
            </div>
            <div className="space-y-2">
              {(settings.worktype?.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) =>
                      updateOption("worktype", index, e.target.value)
                    }
                    placeholder="Enter work type option"
                    className="flex-1"
                    disabled={isDefaultOption("worktype", option)}
                  />
                  {!isDefaultOption("worktype", option) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption("worktype", index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {isDefaultOption("worktype", option) && (
                    <span className="text-xs text-gray-400 px-2">Default</span>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption("worktype")}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            </div>
          </div>

          {/* Employment Type */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Employment Type Options
              </label>
              <Text className="text-xs text-gray-500">
                Configure available employment type options (default options
                cannot be removed)
              </Text>
            </div>
            <div className="space-y-2">
              {(settings.employeetype?.options || []).map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={option}
                    onChange={(e) =>
                      updateOption("employeetype", index, e.target.value)
                    }
                    placeholder="Enter employment type option"
                    className="flex-1"
                    disabled={isDefaultOption("employeetype", option)}
                  />
                  {!isDefaultOption("employeetype", option) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeOption("employeetype", index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                  {isDefaultOption("employeetype", option) && (
                    <span className="text-xs text-gray-400 px-2">Default</span>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => addOption("employeetype")}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Option
              </Button>
            </div>
          </div>

          {/* Employment Status */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Employment Status Options
              </label>
              <Text className="text-xs text-gray-500">
                Configure available employment status options (default options
                cannot be removed)
              </Text>
            </div>
            <div className="space-y-2">
              {(settings.employmentstatus?.options || []).map(
                (option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) =>
                        updateOption("employmentstatus", index, e.target.value)
                      }
                      placeholder="Enter employment status option"
                      className="flex-1"
                      disabled={isDefaultOption("employmentstatus", option)}
                    />
                    {!isDefaultOption("employmentstatus", option) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeOption("employmentstatus", index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    {isDefaultOption("employmentstatus", option) && (
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
                onClick={() => addOption("employmentstatus")}
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
            <Briefcase className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1">
            <Text className="text-sm font-semibold text-blue-900 mb-1">
              About Master Data
            </Text>
            <Text className="text-xs text-blue-800">
              Master data options will be available to all employers by default.
              Employers can add their own custom options in addition to these
              master options. Default options cannot be removed and will always
              be present.
            </Text>
          </div>
        </div>
      </Card>
    </div>
  );
}
