"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-toastify";
import axiosInstance from "../lib/axios";
import { Button, Input, Title, Text } from "rizzui";
import { Card } from "../components/ui/Card";
import { Mail, Loader2, LogOut } from "lucide-react";
import { useAppDispatch } from "../store/hook";
import { logoutUser } from "../store/slices/authSlice";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verifyingOTP, setVerifyingOTP] = useState(false);
  const [resendingOTP, setResendingOTP] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  const handleResendOTP = async () => {
    if (!email) {
      return; // Don't show error if email is not set yet (still loading)
    }

    setResendingOTP(true);
    try {
      const response = await axiosInstance.post("/auth/resend-otp", {
        email,
      });

      if (response.data.message) {
        toast.success(
          response.data.message || "OTP code has been sent to your email"
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

  useEffect(() => {
    // Get email from URL params or fetch from user profile
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(emailParam);
      setLoading(false);
      // Auto-send OTP when email is provided
      const sendOTP = async () => {
        try {
          const response = await axiosInstance.post("/auth/resend-otp", {
            email: emailParam,
          });
          if (response.data.message) {
            toast.success("OTP code has been sent to your email");
          }
        } catch (error: any) {
          // Silent fail - user can manually resend
          console.log("Auto-send OTP failed, user can manually resend");
        }
      };
      sendOTP();
    } else {
      // Fetch user email from profile
      const fetchUserEmail = async () => {
        try {
          const token = document.cookie
            .split("; ")
            .find((row) => row.startsWith("accessToken="))
            ?.split("=")[1];

          if (token) {
            const baseUrl =
              process.env.NEXT_PUBLIC_API_BASE_URL ||
              "http://localhost:5000/api";

            const response = await fetch(`${baseUrl}/auth/profile`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (response.ok) {
              const res = await response.json();
              const user = res.data;
              if (user?.email) {
                setEmail(user.email);
                // Auto-send OTP for already registered users
                try {
                  const otpResponse = await axiosInstance.post(
                    "/auth/resend-otp",
                    {
                      email: user.email,
                    }
                  );
                  if (otpResponse.data.message) {
                    toast.success("OTP code has been sent to your email");
                  }
                } catch (error: any) {
                  // Only show error if it's a meaningful error (not just "already sent")
                  if (error?.response?.status !== 400) {
                    console.log(
                      "Auto-send OTP failed, user can manually resend"
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user email:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchUserEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Email is required");
      return;
    }

    if (otpCode.length !== 6 || !/^\d+$/.test(otpCode)) {
      toast.error("Please enter a valid 6-digit OTP code");
      return;
    }

    setVerifyingOTP(true);
    try {
      const response = await axiosInstance.post("/auth/verify-otp", {
        email,
        code: otpCode,
      });

      if (response.data.message) {
        toast.success(response.data.message || "Email verified successfully!");

        // Wait a moment for the backend to update, then redirect
        // Check if there's a pending invitation token
        const pendingInvitationToken = sessionStorage.getItem(
          "pendingInvitationToken"
        );

        setTimeout(() => {
          if (pendingInvitationToken) {
            // Clear the stored invitation data
            sessionStorage.removeItem("pendingInvitationToken");
            sessionStorage.removeItem("pendingInvitationBranchId");
            sessionStorage.removeItem("pendingInvitationTenantId");
            sessionStorage.removeItem("pendingInvitationEmail");

            // Redirect to invitations page to accept invitation
            window.location.href = "/nexus-profile/invitations";
          } else {
            // Redirect to onboarding since user is now verified
            window.location.href = "/onboarding";
          }
        }, 1000);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Visual Section */}
      <div className="hidden lg:flex w-full lg:w-1/2 bg-primary text-white justify-center items-center px-10 xl:px-20 py-12 rounded-tr-[50px] rounded-br-[50px]">
        <div className="text-center max-w-lg">
          <h3 className="text-3xl font-semibold mb-4 leading-snug">
            Verify Your Email Address
          </h3>
          <p className="text-sm mb-8">
            Please check your inbox and enter the verification code to continue.
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
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6 self-start"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <Title as="h1" className="text-2xl font-bold text-gray-900">
              Verify Your Email
            </Title>
            <Text className="text-sm text-gray-500 mt-1">
              Enter the 6-digit code sent to your email
            </Text>
          </div>
        </div>

        <Card className="p-6 shadow-sm border border-gray-200">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-900">
              ✉️ We've sent a 6-digit OTP code to{" "}
              <strong>{email || "your email"}</strong>. Please check your inbox
              and enter the code below.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleVerifyOTP}>
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
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Enter OTP Code
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
              />
              <p className="text-xs text-gray-500 mt-2 text-center">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full bg-[#1A3CE4] hover:bg-[#1735c4] text-white font-semibold py-3 rounded-full"
                disabled={verifyingOTP || otpCode.length !== 6 || !email}
              >
                {verifyingOTP ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Verify Email"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={resendingOTP || !email}
                  className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
                >
                  {resendingOTP ? "Sending..." : "Resend OTP"}
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

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
