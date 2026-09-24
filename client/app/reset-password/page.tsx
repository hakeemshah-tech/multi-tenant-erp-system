"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import axiosInstance from "../lib/axios";
import { Button, Input, Title, Text } from "rizzui";
import { Card } from "../components/ui/Card";
import { Lock, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PasswordInput } from "../components/shared/PasswordInput";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resendingOTP, setResendingOTP] = useState(false);

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleResendOTP = async () => {
    if (!email) {
      toast.error("Email is required");
      return;
    }

    setResendingOTP(true);
    try {
      const response = await axiosInstance.post("/auth/forgot-password", {
        email,
      });

      if (response.data.message) {
        toast.success("Reset code has been resent to your email");
        setOtpCode(""); // Clear the current OTP input
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to resend reset code. Please try again."
      );
    } finally {
      setResendingOTP(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Email is required");
      return;
    }

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      toast.error("Please enter a valid 6-digit OTP code");
      return;
    }

    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setResetting(true);
    try {
      const response = await axiosInstance.post("/auth/reset-password", {
        email,
        code: otpCode,
        newPassword,
      });

      if (response.data.message) {
        toast.success(response.data.message || "Password reset successfully!");

        // Redirect to login page after successful reset
        setTimeout(() => {
          router.push("/login");
        }, 1500);
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to reset password. Please try again."
      );
      setOtpCode(""); // Clear the OTP input on error
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Visual Section */}
      <div className="hidden lg:flex w-full lg:w-1/2 bg-primary text-white justify-center items-center px-10 xl:px-20 py-12 rounded-tr-[50px] rounded-br-[50px]">
        <div className="text-center max-w-lg">
          <h3 className="text-3xl font-semibold mb-4 leading-snug">
            Create New Password
          </h3>
          <p className="text-sm mb-8">
            Enter the verification code sent to your email and create a new
            secure password.
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
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Lock className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <Title as="h1" className="text-2xl font-bold text-gray-900">
              Reset Password
            </Title>
            <Text className="text-sm text-gray-500 mt-1">
              Enter verification code and new password
            </Text>
          </div>
        </div>

        <Card className="p-6 shadow-sm border border-gray-200">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-900">
              ✉️ We've sent a 6-digit verification code to{" "}
              <strong>{email || "your email"}</strong>. Please check your inbox
              and enter the code below along with your new password.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full"
                disabled={!!searchParams.get("email")}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter Verification Code
              </label>
              <Input
                type="text"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setOtpCode(value);
                }}
                placeholder="000000"
                maxLength={6}
                className="w-full text-center text-2xl font-mono tracking-widest"
                required
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <div>
              <PasswordInput
                label="New Password"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>

            <div>
              <PasswordInput
                label="Confirm New Password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full bg-[#1A3CE4] hover:bg-[#1735c4] text-white font-semibold py-3 rounded-full"
                disabled={
                  resetting ||
                  otpCode.length !== 6 ||
                  !email ||
                  !newPassword ||
                  !confirmPassword
                }
              >
                {resetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Resetting...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendingOTP || !email}
                  className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
                >
                  {resendingOTP ? "Sending..." : "Resend Code"}
                </button>
              </div>
            </div>
          </form>
        </Card>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Didn't receive the code? Check your spam folder or{" "}
          <button
            onClick={handleResendOTP}
            disabled={resendingOTP}
            className="text-blue-600 hover:underline font-medium disabled:opacity-50"
          >
            resend
          </button>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-primary text-lg">Loading...</div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
