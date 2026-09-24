"use client";

import { Button, Popover } from "rizzui";
import { Plus } from "lucide-react";

type FieldHelperProps = {
  fields: {
    employee: string[];
    organization: string[];
    custom: { key: string; label: string; type: string }[];
  };
  onInsert: (placeholder: string) => void;
  buttonLabel?: string;
  buttonSize?: "sm" | "md" | "lg";
  employeeFieldOptions?: { key: string; label: string }[];
};

const employeeFieldLabels: Record<string, string> = {
  name: "Full Name",
  email: "Email",
  position: "Position",
  startDate: "Start Date",
  location: "Location",
  hours: "Working Hours",
  pay: "Pay/Salary",
  department: "Department",
  supervisor: "Supervisor",
};

const organizationFieldLabels: Record<string, string> = {
  employerName: "Employer Name",
  abn: "ABN",
  address: "Address",
  defaultGoverningLaw: "Governing Law",
  superNote: "Super Note",
};

export default function FieldPlaceholderHelper({
  fields,
  onInsert,
  buttonLabel = "Insert Field",
  buttonSize = "sm",
  employeeFieldOptions = [],
}: FieldHelperProps) {
  // Helper function to get employee field label
  const getEmployeeFieldLabel = (fieldKey: string): string => {
    const option = employeeFieldOptions.find((opt) => opt.key === fieldKey);
    if (option) return option.label;
    return employeeFieldLabels[fieldKey] || fieldKey;
  };
  return (
    <Popover>
      <Popover.Trigger>
        <Button
          size={buttonSize}
          variant="outline"
          className="flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          {buttonLabel}
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-80 p-0">
        {({ setOpen }) => (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">
                Insert Field Placeholder
              </h4>
            </div>

            {/* Employee Fields */}
            {fields.employee.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 mb-2">
                  Employee Fields
                </h5>
                <div className="space-y-1">
                  {fields.employee.map((fieldKey) => (
                    <button
                      key={fieldKey}
                      onClick={() => {
                        onInsert(`{{employee.${fieldKey}}}`);
                        setOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-blue-50 border border-transparent hover:border-blue-200 flex items-center justify-between"
                    >
                      <span className="text-gray-700 font-medium">
                        {getEmployeeFieldLabel(fieldKey)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Organization Fields removed */}

            {/* Custom Fields */}
            {fields.custom.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-gray-700 mb-2">
                  Custom Fields
                </h5>
                <div className="space-y-1">
                  {fields.custom.map((field) => (
                    <button
                      key={field.key}
                      onClick={() => {
                        onInsert(`{{custom.${field.key}}}`);
                        setOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-purple-50 border border-transparent hover:border-purple-200 flex items-center justify-between"
                    >
                      <span className="text-gray-700 font-medium">
                        {field.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {fields.employee.length === 0 && fields.custom.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                No fields available. Configure fields in the Fields step first.
              </p>
            )}
          </div>
        )}
      </Popover.Content>
    </Popover>
  );
}
