"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useAppDispatch, useAppSelector } from "../store/hook";
import { registerUser } from "../store/slices/authSlice";
import { z } from "zod";
import { PhoneInput } from "../components/shared/PhoneInput";
import { PasswordInput } from "../components/shared/PasswordInput";
import { isValidPhoneNumber } from "react-phone-number-input";
import axiosInstance from "../lib/axios";

const registerUserSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  phone: z.string().refine((val) => isValidPhoneNumber(val || ""), {
    message: "Invalid phone number",
  }),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(
      /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
      "Password must contain at least one symbol"
    ),
});

export default function RegisterUserPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { loading } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    password: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showInvitationMessage, setShowInvitationMessage] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [resendingOTP, setResendingOTP] = useState(false);

  // Check for pending invitation email on mount
  useEffect(() => {
    const pendingEmail = sessionStorage.getItem("pendingInvitationEmail");
    if (pendingEmail) {
      setForm((prev) => ({ ...prev, email: pendingEmail }));
      setShowInvitationMessage(true);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormErrors({ ...formErrors, [e.target.name]: "" });

    // Show password validation when user starts typing
    if (e.target.name === "password") {
      setShowPasswordValidation(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = registerUserSchema.safeParse(form);
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

    const resultAction = await dispatch(registerUser(form));
    if (registerUser.fulfilled.match(resultAction)) {
      // Show OTP verification step instead of redirecting
      setShowOTPVerification(true);
      toast.success(
        "Registration successful! Please verify your email with the OTP code sent to your inbox."
      );
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      toast.error("Please enter a valid 6-digit OTP code");
      return;
    }

    setVerifyingOTP(true);
    try {
      const response = await axiosInstance.post("/auth/verify-otp", {
        email: form.email,
        code: otpCode,
      });

      if (response.data.message) {
        toast.success(response.data.message || "Email verified successfully!");

        // Check if there's a pending invitation token
        const pendingInvitationToken = sessionStorage.getItem(
          "pendingInvitationToken"
        );

        if (pendingInvitationToken) {
          // Clear the stored invitation data
          sessionStorage.removeItem("pendingInvitationToken");
          sessionStorage.removeItem("pendingInvitationBranchId");
          sessionStorage.removeItem("pendingInvitationTenantId");
          sessionStorage.removeItem("pendingInvitationEmail");

          // Redirect to invitations page to accept invitation
          window.location.href = "/nexus-profile/invitations";
        } else {
          // Redirect directly to onboarding since user is registered and authenticated
          window.location.href = "/onboarding";
        }
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Invalid OTP code. Please try again."
      );
      setOtpCode(""); // Clear the OTP input on error
    } finally {
      setVerifyingOTP(false);
    }
  };

  const handleResendOTP = async () => {
    setResendingOTP(true);
    try {
      const response = await axiosInstance.post("/auth/resend-otp", {
        email: form.email,
      });

      if (response.data.message) {
        toast.success(
          response.data.message || "OTP code has been resent to your email"
        );
        setOtpCode(""); // Clear the current OTP input
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to resend OTP. Please try again."
      );
    } finally {
      setResendingOTP(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Visual Section */}
      <div className="hidden lg:flex w-full lg:w-1/2 bg-primary text-white justify-center items-center px-10 xl:px-20 py-12 rounded-tr-[50px] rounded-br-[50px]">
        <div className="text-center max-w-lg">
          <h3 className="text-3xl font-semibold mb-4 leading-snug">
            Empower your HR journey, <br /> Get started today.
          </h3>
          <p className="text-sm mb-8">
            Simple, intuitive, and built for modern teams.
          </p>
          <Image
            src="/bg-img.png"
            alt="Visual"
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
          Welcome! Create Your Account
        </h3>
        <p className="text-sm text-gray-500 mb-6 text-center lg:text-left">
          Just a few details to get started
        </p>

        {showInvitationMessage && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-900">
              📧 You have a pending invitation. Register with the email you were
              invited with.
            </p>
          </div>
        )}

        {showOTPVerification ? (
          <div className="space-y-6">
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-900">
                ✉️ We've sent a 6-digit OTP code to{" "}
                <strong>{form.email}</strong>. Please check your inbox and enter
                the code below.
              </p>
            </div>

            <form
              className="grid grid-cols-1 gap-y-5"
              onSubmit={handleVerifyOTP}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter OTP Code
                </label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtpCode(value);
                  }}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-widest placeholder-gray-400 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Enter the 6-digit code sent to your email
                </p>
              </div>

              <div className="mt-6">
                <button
                  type="submit"
                  className="w-full bg-[#1A3CE4] hover:bg-[#1735c4] text-white font-semibold py-3 rounded-full text-sm transition"
                  disabled={verifyingOTP || otpCode.length !== 6}
                >
                  {verifyingOTP ? "Verifying..." : "Verify Email"}
                </button>

                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={resendingOTP}
                    className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
                  >
                    {resendingOTP ? "Sending..." : "Resend OTP"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <form className="grid grid-cols-1 gap-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                placeholder="Enter Full Name"
                className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm placeholder-gray-400 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formErrors.fullName && (
                <p className="text-red-500 text-xs mt-1">
                  {formErrors.fullName}
                </p>
              )}
            </div>

            <PhoneInput
              label="Phone Number"
              value={form.phone}
              onChange={(value) => setForm({ ...form, phone: value || "" })}
              placeholder="Enter phone number"
              error={formErrors.phone}
              defaultCountry="AU"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter Email"
                className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm placeholder-gray-400 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formErrors.email && (
                <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>
              )}
            </div>

            <PasswordInput
              label="Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter Password"
              error={formErrors.password}
              showValidation={showPasswordValidation}
              required
            />

            <div className="mt-6">
              <button
                type="submit"
                className="w-full bg-[#1A3CE4] hover:bg-[#1735c4] text-white font-semibold py-3 rounded-full text-sm transition"
                disabled={loading}
              >
                {loading ? "Registering..." : "Register"}
              </button>

              <p className="mt-6 text-sm text-gray-500 text-center">
                Already have an account?{" "}
                <a
                  href="/login"
                  className="text-blue-600 hover:underline font-medium"
                >
                  Login here
                </a>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
