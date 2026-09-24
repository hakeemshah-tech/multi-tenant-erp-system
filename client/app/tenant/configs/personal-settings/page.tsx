"use client";

import { useEffect, useState } from "react";
import { Button, Title, Text } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { UserCog, Save, Loader2, Check } from "lucide-react";
import { Checkbox } from "rizzui";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

interface PersonalSettings {
  gender?: {
    allMasterOptions: string[];
    defaultMasterOptions: string[];
    selectedMasterOptions: string[];
  };
  pronouns?: {
    allMasterOptions: string[];
    defaultMasterOptions: string[];
    selectedMasterOptions: string[];
  };
  residencystatus?: {
    allMasterOptions: string[];
    defaultMasterOptions: string[];
    selectedMasterOptions: string[];
  };
  typeofvisa?: {
    allMasterOptions: string[];
    defaultMasterOptions: string[];
    selectedMasterOptions: string[];
  };
}

export default function PersonalSettingsPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("personal-settings", "read");
  const canWrite = hasPermission("personal-settings", "write");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PersonalSettings>({
    gender: {
      allMasterOptions: ["Male", "Female", "Intersex", "Don't want to Specify"],
      defaultMasterOptions: [
        "Male",
        "Female",
        "Intersex",
        "Don't want to Specify",
      ],
      selectedMasterOptions: [
        "Male",
        "Female",
        "Intersex",
        "Don't want to Specify",
      ],
    },
    pronouns: {
      allMasterOptions: ["He/Him", "She/Her", "They/Them"],
      defaultMasterOptions: ["He/Him", "She/Her", "They/Them"],
      selectedMasterOptions: ["He/Him", "She/Her", "They/Them"],
    },
    residencystatus: {
      allMasterOptions: [
        "Australian Citizen",
        "Permanent Resident",
        "Visa Holder",
      ],
      defaultMasterOptions: [
        "Australian Citizen",
        "Permanent Resident",
        "Visa Holder",
      ],
      selectedMasterOptions: [
        "Australian Citizen",
        "Permanent Resident",
        "Visa Holder",
      ],
    },
    typeofvisa: {
      allMasterOptions: ["Work Visa", "Student Visa", "Working Holiday Visa"],
      defaultMasterOptions: [
        "Work Visa",
        "Student Visa",
        "Working Holiday Visa",
      ],
      selectedMasterOptions: [
        "Work Visa",
        "Student Visa",
        "Working Holiday Visa",
      ],
    },
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        "/employee-field-config/personal-settings"
      );
      const data = res.data.data || {};
      setSettings({
        gender: data.gender || {
          allMasterOptions: [
            "Male",
            "Female",
            "Intersex",
            "Don't want to Specify",
          ],
          defaultMasterOptions: [
            "Male",
            "Female",
            "Intersex",
            "Don't want to Specify",
          ],
          selectedMasterOptions: [
            "Male",
            "Female",
            "Intersex",
            "Don't want to Specify",
          ],
        },
        pronouns: data.pronouns || {
          allMasterOptions: ["He/Him", "She/Her", "They/Them"],
          defaultMasterOptions: ["He/Him", "She/Her", "They/Them"],
          selectedMasterOptions: ["He/Him", "She/Her", "They/Them"],
        },
        residencystatus: data.residencystatus || {
          allMasterOptions: [
            "Australian Citizen",
            "Permanent Resident",
            "Visa Holder",
          ],
          defaultMasterOptions: [
            "Australian Citizen",
            "Permanent Resident",
            "Visa Holder",
          ],
          selectedMasterOptions: [
            "Australian Citizen",
            "Permanent Resident",
            "Visa Holder",
          ],
        },
        typeofvisa: data.typeofvisa || {
          allMasterOptions: [
            "Work Visa",
            "Student Visa",
            "Working Holiday Visa",
          ],
          defaultMasterOptions: [
            "Work Visa",
            "Student Visa",
            "Working Holiday Visa",
          ],
          selectedMasterOptions: [
            "Work Visa",
            "Student Visa",
            "Working Holiday Visa",
          ],
        },
      });
    } catch (error: any) {
      console.error("Failed to fetch personal settings", error);
      toast.error(
        error?.response?.data?.message || "Failed to load personal settings"
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
      toast.error("You don't have permission to save personal settings");
      return;
    }

    setSaving(true);
    try {
      const settingsToSave = {
        gender: {
          selectedMasterOptions: settings.gender?.selectedMasterOptions || [],
        },
        pronouns: {
          selectedMasterOptions: settings.pronouns?.selectedMasterOptions || [],
        },
        residencystatus: {
          selectedMasterOptions:
            settings.residencystatus?.selectedMasterOptions || [],
        },
        typeofvisa: {
          selectedMasterOptions:
            settings.typeofvisa?.selectedMasterOptions || [],
        },
      };

      await axiosInstance.put(
        "/employee-field-config/personal-settings",
        settingsToSave
      );
      toast.success("Personal settings saved successfully");
      await fetchSettings(); // Refresh to get updated data
    } catch (error: any) {
      console.error("Failed to save personal settings", error);
      toast.error(
        error?.response?.data?.message || "Failed to save personal settings"
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleMasterOption = (
    fieldKey: "gender" | "pronouns" | "residencystatus" | "typeofvisa",
    option: string,
    checked: boolean
  ) => {
    if (!canWrite) {
      toast.error("You don't have permission to modify personal settings");
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
        section="personal-settings"
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
      section="personal-settings"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <UserCog className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <Title as="h1" className="text-2xl font-bold text-gray-900">
                Personal Settings
              </Title>
              <Text className="text-sm text-gray-500 mt-1">
                Configure personal details options
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
            {/* Gender */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Gender Options
                </label>
                <Text className="text-xs text-gray-500">
                  Select master options from admin. Default options are
                  pre-selected but can be removed.
                </Text>
              </div>
              {/* All Master Options */}
              {(settings.gender?.allMasterOptions || []).length > 0 && (
                <div className="space-y-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text className="text-xs font-medium text-gray-600 mb-3">
                    Master Options (from admin):
                  </Text>
                  {(settings.gender?.allMasterOptions || []).map(
                    (option, index) => {
                      const isSelected = (
                        settings.gender?.selectedMasterOptions || []
                      ).includes(option);
                      const isDefault = (
                        settings.gender?.defaultMasterOptions || []
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
                                "gender",
                                option,
                                e.target.checked
                              )
                            }
                            disabled={!canWrite}
                            label={option}
                            className="flex-1"
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
                      // Select all options
                      const allOpts = settings.gender?.allMasterOptions || [];
                      allOpts.forEach((opt) => {
                        if (
                          !(
                            settings.gender?.selectedMasterOptions || []
                          ).includes(opt)
                        ) {
                          toggleMasterOption("gender", opt, true);
                        }
                      });
                    }}
                    disabled={!canWrite}
                    className="mt-2 flex items-center gap-2 text-xs"
                  >
                    <Check className="w-3 h-3" />
                    Select All
                  </Button>
                </div>
              )}
            </div>

            {/* Pronouns */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Pronouns Options
                </label>
                <Text className="text-xs text-gray-500">
                  Select master options from admin. Default options are
                  pre-selected but can be removed.
                </Text>
              </div>
              {/* All Master Options */}
              {(settings.pronouns?.allMasterOptions || []).length > 0 && (
                <div className="space-y-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text className="text-xs font-medium text-gray-600 mb-3">
                    Master Options (from admin):
                  </Text>
                  {(settings.pronouns?.allMasterOptions || []).map(
                    (option, index) => {
                      const isSelected = (
                        settings.pronouns?.selectedMasterOptions || []
                      ).includes(option);
                      const isDefault = (
                        settings.pronouns?.defaultMasterOptions || []
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
                                "pronouns",
                                option,
                                e.target.checked
                              )
                            }
                            disabled={!canWrite}
                            label={option}
                            className="flex-1"
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
                      const allOpts = settings.pronouns?.allMasterOptions || [];
                      allOpts.forEach((opt) => {
                        if (
                          !(
                            settings.pronouns?.selectedMasterOptions || []
                          ).includes(opt)
                        ) {
                          toggleMasterOption("pronouns", opt, true);
                        }
                      });
                    }}
                    disabled={!canWrite}
                    className="mt-2 flex items-center gap-2 text-xs"
                  >
                    <Check className="w-3 h-3" />
                    Select All
                  </Button>
                </div>
              )}
            </div>

            {/* Residency Status */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Residency Status Options
                </label>
                <Text className="text-xs text-gray-500">
                  Select master options from admin. Default options are
                  pre-selected but can be removed.
                </Text>
              </div>
              {/* All Master Options */}
              {(settings.residencystatus?.allMasterOptions || []).length >
                0 && (
                <div className="space-y-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text className="text-xs font-medium text-gray-600 mb-3">
                    Master Options (from admin):
                  </Text>
                  {(settings.residencystatus?.allMasterOptions || []).map(
                    (option, index) => {
                      const isSelected = (
                        settings.residencystatus?.selectedMasterOptions || []
                      ).includes(option);
                      const isDefault = (
                        settings.residencystatus?.defaultMasterOptions || []
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
                                "residencystatus",
                                option,
                                e.target.checked
                              )
                            }
                            disabled={!canWrite}
                            label={option}
                            className="flex-1"
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
                        settings.residencystatus?.allMasterOptions || [];
                      allOpts.forEach((opt) => {
                        if (
                          !(
                            settings.residencystatus?.selectedMasterOptions ||
                            []
                          ).includes(opt)
                        ) {
                          toggleMasterOption("residencystatus", opt, true);
                        }
                      });
                    }}
                    disabled={!canWrite}
                    className="mt-2 flex items-center gap-2 text-xs"
                  >
                    <Check className="w-3 h-3" />
                    Select All
                  </Button>
                </div>
              )}
            </div>

            {/* Type of Visa */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Type of Visa Options
                </label>
                <Text className="text-xs text-gray-500">
                  Select master options from admin. Default options are
                  pre-selected but can be removed.
                </Text>
              </div>
              {/* All Master Options */}
              {(settings.typeofvisa?.allMasterOptions || []).length > 0 && (
                <div className="space-y-2 mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <Text className="text-xs font-medium text-gray-600 mb-3">
                    Master Options (from admin):
                  </Text>
                  {(settings.typeofvisa?.allMasterOptions || []).map(
                    (option, index) => {
                      const isSelected = (
                        settings.typeofvisa?.selectedMasterOptions || []
                      ).includes(option);
                      const isDefault = (
                        settings.typeofvisa?.defaultMasterOptions || []
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
                                "typeofvisa",
                                option,
                                e.target.checked
                              )
                            }
                            disabled={!canWrite}
                            label={option}
                            className="flex-1"
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
                        settings.typeofvisa?.allMasterOptions || [];
                      allOpts.forEach((opt) => {
                        if (
                          !(
                            settings.typeofvisa?.selectedMasterOptions || []
                          ).includes(opt)
                        ) {
                          toggleMasterOption("typeofvisa", opt, true);
                        }
                      });
                    }}
                    disabled={!canWrite}
                    className="mt-2 flex items-center gap-2 text-xs"
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
              <UserCog className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <Text className="text-sm font-semibold text-blue-900 mb-1">
                About Personal Settings
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
