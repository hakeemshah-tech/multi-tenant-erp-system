"use client";

import { useEffect, useState } from "react";
import { Button, Title, Text } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { Briefcase, Save, Loader2, Check } from "lucide-react";
import { Checkbox } from "rizzui";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

interface EmploymentSettings {
  worktype?: {
    allMasterOptions: string[];
    defaultMasterOptions: string[];
    selectedMasterOptions: string[];
  };
  employeetype?: {
    allMasterOptions: string[];
    defaultMasterOptions: string[];
    selectedMasterOptions: string[];
  };
  employmentstatus?: {
    allMasterOptions: string[];
    defaultMasterOptions: string[];
    selectedMasterOptions: string[];
  };
}

export default function EmploymentSettingsPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("employment-settings", "read");
  const canWrite = hasPermission("employment-settings", "write");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<EmploymentSettings>({
    worktype: {
      allMasterOptions: ["Office Work", "Shift Work"],
      defaultMasterOptions: ["Office Work", "Shift Work"],
      selectedMasterOptions: ["Office Work", "Shift Work"],
    },
    employeetype: {
      allMasterOptions: [],
      defaultMasterOptions: [],
      selectedMasterOptions: [],
    },
    employmentstatus: {
      allMasterOptions: [],
      defaultMasterOptions: [],
      selectedMasterOptions: [],
    },
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        "/employee-field-config/employment-settings"
      );
      const data = res.data.data || {};
      setSettings({
        worktype: data.worktype || {
          allMasterOptions: ["Office Work", "Shift Work"],
          defaultMasterOptions: ["Office Work", "Shift Work"],
          selectedMasterOptions: ["Office Work", "Shift Work"],
        },
        employeetype: data.employeetype || {
          allMasterOptions: [],
          defaultMasterOptions: [],
          selectedMasterOptions: [],
        },
        employmentstatus: data.employmentstatus || {
          allMasterOptions: [],
          defaultMasterOptions: [],
          selectedMasterOptions: [],
        },
      });
    } catch (error: any) {
      console.error("Failed to fetch employment settings", error);
      toast.error(
        error?.response?.data?.message || "Failed to load employment settings"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canRead) {
      void fetchSettings();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRead]);

  const handleSave = async () => {
    if (!canWrite) {
      toast.error("You don't have permission to save employment settings");
      return;
    }

    setSaving(true);
    try {
      const settingsToSave = {
        worktype: {
          selectedMasterOptions: settings.worktype?.selectedMasterOptions || [],
        },
        employeetype: {
          selectedMasterOptions:
            settings.employeetype?.selectedMasterOptions || [],
        },
        employmentstatus: {
          selectedMasterOptions:
            settings.employmentstatus?.selectedMasterOptions || [],
        },
      };

      await axiosInstance.put(
        "/employee-field-config/employment-settings",
        settingsToSave
      );
      toast.success("Employment settings saved successfully");
      await fetchSettings(); // Refresh to get updated data
    } catch (error: any) {
      console.error("Failed to save employment settings", error);
      toast.error(
        error?.response?.data?.message || "Failed to save employment settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleMasterOption = (
    fieldKey: "worktype" | "employeetype" | "employmentstatus",
    option: string,
    checked: boolean
  ) => {
    if (!canWrite) {
      toast.error("You don't have permission to edit employment settings");
      return;
    }

    setSettings((prev) => {
      const current = prev[fieldKey] || {
        allMasterOptions: [],
        defaultMasterOptions: [],
        selectedMasterOptions: [],
      };

      let selected = [...(current.selectedMasterOptions || [])];

      if (checked) {
        // Add to selected if not already there
        if (!selected.includes(option)) {
          selected.push(option);
        }
      } else {
        // Remove from selected (including defaults - they can be removed)
        selected = selected.filter((opt) => opt !== option);
      }

      return {
        ...prev,
        [fieldKey]: {
          ...current,
          selectedMasterOptions: selected,
        },
      };
    });
  };

  if (loading) {
    return (
      <PermissionGuard
        section="employment-settings"
        action="read"
        redirectTo="/tenant/my-contract-approvals"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard
      section="employment-settings"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <Title as="h1" className="text-2xl font-bold text-gray-900">
                Employment Settings
              </Title>
              <Text className="text-sm text-gray-500 mt-1">
                Configure employment details options
              </Text>
            </div>
          </div>
          {canWrite ? (
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
          ) : (
            <Text className="text-xs text-gray-400 italic">
              You don&apos;t have permission to save changes
            </Text>
          )}
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
                  Select master options from admin. Default options are
                  pre-selected but can be removed.
                </Text>
              </div>
              {/* All Master Options */}
              {(settings.worktype?.allMasterOptions || []).length > 0 && (
                <div className="space-y-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text className="text-xs font-medium text-gray-600 mb-3">
                    Master Options (from admin):
                  </Text>
                  {(settings.worktype?.allMasterOptions || []).map(
                    (option, index) => {
                      const isSelected = (
                        settings.worktype?.selectedMasterOptions || []
                      ).includes(option);
                      const isDefault = (
                        settings.worktype?.defaultMasterOptions || []
                      ).includes(option);
                      return (
                        <div
                          key={`option-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) =>
                              toggleMasterOption(
                                "worktype",
                                option,
                                e.target.checked
                              )
                            }
                            label={option}
                            className="flex-1"
                            disabled={!canWrite}
                          />
                          {isDefault && (
                            <span className="text-xs text-blue-600 px-2 py-0.5 bg-blue-100 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allOpts = settings.worktype?.allMasterOptions || [];
                      allOpts.forEach((opt) => {
                        if (
                          !(
                            settings.worktype?.selectedMasterOptions || []
                          ).includes(opt)
                        ) {
                          toggleMasterOption("worktype", opt, true);
                        }
                      });
                    }}
                    className="mt-2 flex items-center gap-2 text-xs"
                    disabled={!canWrite}
                  >
                    <Check className="w-3 h-3" />
                    Select All
                  </Button>
                </div>
              )}
            </div>

            {/* Employment Type */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Employment Type Options
                </label>
                <Text className="text-xs text-gray-500">
                  Select master options from admin. Default options are
                  pre-selected but can be removed.
                </Text>
              </div>
              {/* All Master Options */}
              {(settings.employeetype?.allMasterOptions || []).length > 0 && (
                <div className="space-y-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text className="text-xs font-medium text-gray-600 mb-3">
                    Master Options (from admin):
                  </Text>
                  {(settings.employeetype?.allMasterOptions || []).map(
                    (option, index) => {
                      const isSelected = (
                        settings.employeetype?.selectedMasterOptions || []
                      ).includes(option);
                      const isDefault = (
                        settings.employeetype?.defaultMasterOptions || []
                      ).includes(option);
                      return (
                        <div
                          key={`option-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) =>
                              toggleMasterOption(
                                "employeetype",
                                option,
                                e.target.checked
                              )
                            }
                            label={option}
                            className="flex-1"
                            disabled={!canWrite}
                          />
                          {isDefault && (
                            <span className="text-xs text-blue-600 px-2 py-0.5 bg-blue-100 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allOpts =
                        settings.employeetype?.allMasterOptions || [];
                      allOpts.forEach((opt) => {
                        if (
                          !(
                            settings.employeetype?.selectedMasterOptions || []
                          ).includes(opt)
                        ) {
                          toggleMasterOption("employeetype", opt, true);
                        }
                      });
                    }}
                    className="mt-2 flex items-center gap-2 text-xs"
                    disabled={!canWrite}
                  >
                    <Check className="w-3 h-3" />
                    Select All
                  </Button>
                </div>
              )}
            </div>

            {/* Employment Status */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Employment Status Options
                </label>
                <Text className="text-xs text-gray-500">
                  Select master options from admin. Default options are
                  pre-selected but can be removed.
                </Text>
              </div>
              {/* All Master Options */}
              {(settings.employmentstatus?.allMasterOptions || []).length >
                0 && (
                <div className="space-y-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text className="text-xs font-medium text-gray-600 mb-3">
                    Master Options (from admin):
                  </Text>
                  {(settings.employmentstatus?.allMasterOptions || []).map(
                    (option, index) => {
                      const isSelected = (
                        settings.employmentstatus?.selectedMasterOptions || []
                      ).includes(option);
                      const isDefault = (
                        settings.employmentstatus?.defaultMasterOptions || []
                      ).includes(option);
                      return (
                        <div
                          key={`option-${index}`}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) =>
                              toggleMasterOption(
                                "employmentstatus",
                                option,
                                e.target.checked
                              )
                            }
                            label={option}
                            className="flex-1"
                            disabled={!canWrite}
                          />
                          {isDefault && (
                            <span className="text-xs text-blue-600 px-2 py-0.5 bg-blue-100 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allOpts =
                        settings.employmentstatus?.allMasterOptions || [];
                      allOpts.forEach((opt) => {
                        if (
                          !(
                            settings.employmentstatus?.selectedMasterOptions ||
                            []
                          ).includes(opt)
                        ) {
                          toggleMasterOption("employmentstatus", opt, true);
                        }
                      });
                    }}
                    className="mt-2 flex items-center gap-2 text-xs"
                    disabled={!canWrite}
                  >
                    <Check className="w-3 h-3" />
                    Select All
                  </Button>
                </div>
              )}
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
                About Employment Settings
              </Text>
              <Text className="text-xs text-blue-800">
                All options come from master data. Default options are
                pre-selected but can be removed. You can select or deselect any
                master option. Selected options will be available when creating
                or editing employee records.
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
