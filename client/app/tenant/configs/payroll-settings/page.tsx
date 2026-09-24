"use client";

import { useEffect, useState } from "react";
import { Button, Input, Select, Title, Text } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { DollarSign, Save, Loader2 } from "lucide-react";
import { usePermissions } from "@/app/hooks/usePermissions";
import PermissionGuard from "@/app/tenant/components/PermissionGuard";

interface PayrollSettings {
  supercontribution: number | null;
  probationperiod: string | null;
  casualrate: number | null;
  annualleave: number | null;
}

const PROBATION_PERIOD_OPTIONS = [
  "1 Month",
  "2 Months",
  "3 Months",
  "4 Months",
  "5 Months",
  "6 Months",
  "7 Months",
  "8 Months",
  "9 Months",
  "10 Months",
  "11 Months",
  "12 Months",
];

export default function PayrollSettingsPage() {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission("payroll-settings", "read");
  const canWrite = hasPermission("payroll-settings", "write");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PayrollSettings>({
    supercontribution: null,
    probationperiod: null,
    casualrate: null,
    annualleave: null,
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        "/employee-field-config/payroll-settings"
      );
      const data = res.data.data || {};
      setSettings({
        supercontribution: data.supercontribution ?? null,
        probationperiod: data.probationperiod ?? null,
        casualrate: data.casualrate ?? null,
        annualleave: data.annualleave ?? null,
      });
    } catch (error: any) {
      console.error("Failed to fetch payroll settings", error);
      toast.error(
        error?.response?.data?.message || "Failed to load payroll settings"
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
    if (!canWrite) return;

    setSaving(true);
    try {
      await axiosInstance.put(
        "/employee-field-config/payroll-settings",
        settings
      );
      toast.success("Payroll settings saved successfully");
    } catch (error: any) {
      console.error("Failed to save payroll settings", error);
      toast.error(
        error?.response?.data?.message || "Failed to save payroll settings"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PermissionGuard
        section="payroll-settings"
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
      section="payroll-settings"
      action="read"
      redirectTo="/tenant/my-contract-approvals"
    >
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <Title as="h1" className="text-2xl font-bold text-gray-900">
                Payroll Settings
              </Title>
              <Text className="text-sm text-gray-500 mt-1">
                Configure default values for payroll fields
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Super Contribution */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Super Contribution %
                </label>
                <Text className="text-xs text-gray-500">
                  Default superannuation contribution percentage
                </Text>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.supercontribution ?? ""}
                  disabled={!canWrite}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings((prev) => ({
                      ...prev,
                      supercontribution: val ? parseFloat(val) : null,
                    }));
                  }}
                  placeholder="e.g., 11"
                  className="w-full"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  %
                </span>
              </div>
            </div>

            {/* Probation Period */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Probation Period
                </label>
                <Text className="text-xs text-gray-500">
                  Default probation period for new employees
                </Text>
              </div>
              <Select
                value={
                  settings.probationperiod
                    ? {
                        label: settings.probationperiod,
                        value: settings.probationperiod,
                      }
                    : null
                }
                isDisabled={!canWrite}
                onChange={(opt: any) =>
                  setSettings((prev) => ({
                    ...prev,
                    probationperiod: opt?.value || null,
                  }))
                }
                options={PROBATION_PERIOD_OPTIONS.map((opt) => ({
                  label: opt,
                  value: opt,
                }))}
                placeholder="Select probation period"
                className="w-full"
              />
            </div>

            {/* Casual Rate */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Casual Rate %
                </label>
                <Text className="text-xs text-gray-500">
                  Default casual loading percentage
                </Text>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.casualrate ?? ""}
                  disabled={!canWrite}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings((prev) => ({
                      ...prev,
                      casualrate: val ? parseFloat(val) : null,
                    }));
                  }}
                  placeholder="e.g., 25"
                  className="w-full"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  %
                </span>
              </div>
            </div>

            {/* Annual Leave */}
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                  Annual Leave %
                </label>
                <Text className="text-xs text-gray-500">
                  Default annual leave percentage
                </Text>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={settings.annualleave ?? ""}
                  disabled={!canWrite}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettings((prev) => ({
                      ...prev,
                      annualleave: val ? parseFloat(val) : null,
                    }));
                  }}
                  placeholder="e.g., 10.5"
                  className="w-full"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  %
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-blue-100 rounded-lg mt-0.5">
              <DollarSign className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <Text className="text-sm font-semibold text-blue-900 mb-1">
                About Default Values
              </Text>
              <Text className="text-xs text-blue-800">
                These default values will be automatically applied to new
                employees when they are created. Existing employees will not be
                affected unless their values are currently null, in which case
                they will be updated to the new defaults.
              </Text>
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
