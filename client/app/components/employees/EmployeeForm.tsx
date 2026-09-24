"use client";

import { useState } from "react";
import { Input, Button, Select } from "rizzui";
import { PhoneInput } from "../shared/PhoneInput";

interface Option {
  label: string;
  value: string;
}

interface EmployeeFormProps {
  initialData?: {
    name?: string;
    email?: string;
    phone?: string;
    designationId?: string;
  };
  designations: Option[];
  onSubmit: (values: any) => void;
  isLoading?: boolean;
}

export default function EmployeeForm({
  initialData = {},
  designations,
  onSubmit,
  isLoading = false,
}: EmployeeFormProps) {
  const [formData, setFormData] = useState({
    name: initialData.name || "",
    email: initialData.email || "",
    phone: initialData.phone || "",
    designationId: initialData.designationId || "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Input
        label="Full Name"
        placeholder="Enter employee name"
        value={formData.name}
        onChange={(e) => handleChange("name", e.target.value)}
      />
      <Input
        label="Email Address"
        type="email"
        placeholder="example@company.com"
        value={formData.email}
        onChange={(e) => handleChange("email", e.target.value)}
      />
      <PhoneInput
        label="Phone Number"
        placeholder="Enter phone number"
        value={formData.phone}
        onChange={(value) => handleChange("phone", value || "")}
        defaultCountry="AU"
      />
      <Select
        label="Job Title"
        placeholder="Select Job Title"
        options={designations}
        value={formData.designationId}
        onChange={(value) => handleChange("designationId", value)}
      />
      <Button type="submit" className="w-full" isLoading={isLoading}>
        Submit
      </Button>
    </form>
  );
}
