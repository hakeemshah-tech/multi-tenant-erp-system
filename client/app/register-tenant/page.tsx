"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronDown } from "lucide-react";
import { useAppDispatch, useAppSelector } from "../store/hook";
import { registerTenant } from "../store/slices/authSlice";
import { z } from "zod";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

// ✅ Updated schema (no fullName, email, password)
const registerTenantSchema = z.object({
  companyName: z.string().min(2, "Company name is required"),
  companyLocation: z.string().min(2, "Company location is required"),
  employeeCount: z.string().min(1, "Please select employee count"),
  businessCategory: z
    .string()
    .regex(/^[a-f\d]{24}$/i, "Invalid business category ID"),
});

export default function RegisterTenantPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { loading } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState({
    companyName: "",
    companyLocation: "",
    employeeCount: "",
    businessCategory: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormErrors({ ...formErrors, [e.target.name]: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerTenantSchema.safeParse(form);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0]] = err.message;
        }
      });
      setFormErrors(errors);
      return;
    }

    const resultAction = await dispatch(registerTenant(form));
    if (registerTenant.fulfilled.match(resultAction)) {
      // toast.success("Organization registered successfully!");
      router.push("/tenant");
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Visual Section */}
      <div className="hidden lg:flex w-full lg:w-1/2 bg-primary text-white justify-center items-center px-10 xl:px-20 py-12 rounded-tr-[50px] rounded-br-[50px]">
        <div className="text-center max-w-lg">
          <h3 className="text-3xl font-semibold mb-4 leading-snug">
            The simplest way to manage <br /> your Human Resource.
          </h3>
          <p className="text-sm mb-8">
            A modern, intuitive way to onboard and scale your teams efficiently.
          </p>
          <Image
            src="/bg-img.png"
            alt="HR System Illustration"
            width={600}
            height={600}
            className="rounded-xl mx-auto"
          />
        </div>
      </div>

      {/* Right Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-10">
        <h2 className="text-3xl font-bold text-primary mb-6 text-center lg:text-left">
          HR NEXUS
        </h2>
        <h3 className="text-xl font-semibold text-gray-900 mb-2 text-center lg:text-left">
          Register Your Company
        </h3>
        <p className="text-sm text-gray-500 mb-6 text-center lg:text-left">
          Let's set up your organisation
        </p>

        <form
          className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5"
          onSubmit={handleSubmit}
        >
          {[
            { label: "Company Name", name: "companyName", type: "text" },
            {
              label: "Company Location",
              name: "companyLocation",
              type: "text",
            },
          ].map((field) => (
            <div key={field.name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <input
                type={field.type}
                name={field.name}
                value={(form as any)[field.name]}
                onChange={handleChange}
                placeholder={`Enter ${field.label}`}
                className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm placeholder-gray-400 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formErrors[field.name] && (
                <p className="text-red-500 text-xs mt-1">
                  {formErrors[field.name]}
                </p>
              )}
            </div>
          ))}

          {/* Employee Count */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employee Count
            </label>
            <select
              name="employeeCount"
              value={form.employeeCount}
              onChange={handleChange}
              className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="">Select Employee Count</option>
              <option value="1-10">1-10</option>
              <option value="11-50">11-50</option>
              <option value="51-200">51-200</option>
              <option value="200+">200+</option>
            </select>
            <ChevronDown className="absolute right-3 top-10 w-4 h-4 text-gray-500 pointer-events-none" />
            {formErrors.employeeCount && (
              <p className="text-red-500 text-xs mt-1">
                {formErrors.employeeCount}
              </p>
            )}
          </div>

          {/* Business Category */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Category
            </label>
            <select
              name="businessCategory"
              value={form.businessCategory}
              onChange={handleChange}
              className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="">Select Category</option>
              <option value="665cae944e8b5b401bb9a2de">IT</option>
              <option value="665caf054e8b5b401bb9a2e1">Healthcare</option>
              <option value="665caf144e8b5b401bb9a2e3">Retail</option>
            </select>
            <ChevronDown className="absolute right-3 top-10 w-4 h-4 text-gray-500 pointer-events-none" />
            {formErrors.businessCategory && (
              <p className="text-red-500 text-xs mt-1">
                {formErrors.businessCategory}
              </p>
            )}
          </div>

          <div className="col-span-1 md:col-span-2 mt-6">
            <button
              type="submit"
              className="w-full bg-[#1A3CE4] hover:bg-[#1735c4] text-white font-semibold py-3 rounded-full text-sm transition"
              disabled={loading}
            >
              {loading ? "Registering..." : "Create Organization"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
