"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import axiosInstance from "../lib/axios";
import { Button, Input, Title, Text } from "rizzui";
import { Card } from "../components/ui/Card";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const response = await axiosInstance.post("/auth/forgot-password", {
        email,
      });

      if (response.data.message) {
        toast.success(response.data.message);
        // Redirect to reset password page with email
        setTimeout(() => {
          router.push(`/reset-password?email=${encodeURIComponent(email)}`);
        }, 1000);
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          "Failed to send reset code. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Visual Section */}
      <div className="hidden lg:flex w-full lg:w-1/2 bg-primary text-white justify-center items-center px-10 xl:px-20 py-12 rounded-tr-[50px] rounded-br-[50px]">
        <div className="text-center max-w-lg">
          <h3 className="text-3xl font-semibold mb-4 leading-snug">
            Reset Your Password
          </h3>
          <p className="text-sm mb-8">
            Enter your email address and we'll send you a verification code to
            reset your password.
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
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <Title as="h1" className="text-2xl font-bold text-gray-900">
              Forgot Password?
            </Title>
            <Text className="text-sm text-gray-500 mt-1">
              No worries, we'll help you reset it
            </Text>
          </div>
        </div>

        <Card className="p-6 shadow-sm border border-gray-200">
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-900">
              Enter your email address and we'll send you a 6-digit verification
              code to reset your password.
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
                required
              />
            </div>

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full bg-[#1A3CE4] hover:bg-[#1735c4] text-white font-semibold py-3 rounded-full"
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Code"
                )}
              </Button>
            </div>
          </form>
        </Card>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Remember your password?{" "}
          <Link
            href="/login"
            className="text-blue-600 hover:underline font-medium"
          >
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
