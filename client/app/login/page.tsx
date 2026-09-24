"use client";

import { useEffect, useState, Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "../store/hook";
import { loginUser, getProfile } from "../store/slices/authSlice";
import { useRouter, useSearchParams } from "next/navigation";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";
import { PasswordInput } from "../components/shared/PasswordInput";
import Cookies from "js-cookie";

function LoginForm() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { loading, user } = useAppSelector((state) => state.auth);

  const [form, setForm] = useState({ email: "", password: "" });
  const [showInvitationMessage, setShowInvitationMessage] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);

  // Check for pending invitation on mount
  useEffect(() => {
    const pendingEmail = sessionStorage.getItem("pendingInvitationEmail");
    const isInvitationFlow = searchParams.get("invitation") === "true";

    if (pendingEmail && isInvitationFlow) {
      setForm((prev) => ({ ...prev, email: pendingEmail }));
      setShowInvitationMessage(true);
      // toast("Please login to accept your invitation", {
      //   icon: "📧",
      // });
    }
  }, [searchParams]);

  // Check if user is already logged in as admin and redirect
  useEffect(() => {
    // Only check if we have a token (to avoid 401 errors)
    const token =
      typeof window !== "undefined" ? Cookies.get("accessToken") : null;

    if (!token) {
      // No token, user is not logged in - stay on login page
      return;
    }

    const checkAdminAuth = async () => {
      // If user is already in Redux store, check it first
      if (user) {
        if (user.isPlatformAdmin || user.role === "platform-admin") {
          window.location.href = "/admin/awards";
        }
        return;
      }

      // Otherwise, try to get profile (but only if we have a token)
      try {
        const profileResult = await dispatch(getProfile()).unwrap();
        if (
          profileResult &&
          (profileResult.isPlatformAdmin ||
            profileResult.role === "platform-admin")
        ) {
          window.location.href = "/admin/awards";
        }
      } catch {
        // If getProfile fails (401), user is not logged in - stay on login page
        return;
      }
    };

    // Only check admin auth if not in invitation flow
    if (!searchParams.get("invitation")) {
      checkAdminAuth();
    }
  }, [user, dispatch, searchParams]);

  useEffect(() => {
    if (!user || isAdminMode) return;

    // Redirect based on current mode (only for regular users, not admin)
    if (user.currentMode === "organization") {
      // router.push("/tenant");
      window.location.href = "/tenant";
    } else if (user.currentMode === "nexus-profile") {
      // router.push("/nexus-profile");
      window.location.href = "/nexus-profile";
    } else if (user.currentMode === "newbie") {
      // router.push("/onboarding");
      window.location.href = "/onboarding";
    }
  }, [user, router, isAdminMode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error("Please fill in both fields");
      return;
    }

    // Handle admin login
    if (isAdminMode) {
      try {
        setAdminLoading(true);
        const res = await axiosInstance.post("/auth/admin/login", form);

        // Set cookies
        Cookies.set("accessToken", res.data.data.accessToken, { secure: true });
        Cookies.set("refreshToken", res.data.data.refreshToken, {
          secure: true,
        });

        toast.success("Admin login successful!");

        // Redirect to admin dashboard
        setTimeout(() => {
          window.location.href = "/admin/awards";
        }, 100);
      } catch (error: any) {
        const msg =
          error.response?.data?.message || "Login failed. Please try again.";
        toast.error(msg);
      } finally {
        setAdminLoading(false);
      }
      return;
    }

    // Handle regular login
    dispatch(loginUser(form));
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Form Section */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 md:px-12 lg:px-24 py-12">
        <h2 className="text-3xl md:text-4xl font-bold text-primary mb-10 text-center lg:text-left">
          HR NEXUS
        </h2>
        <h3 className="text-2xl font-semibold text-gray-900 mb-2 text-center lg:text-left">
          {isAdminMode ? "Admin Portal" : "Hello, Welcome Back!"}
        </h3>
        <p className="text-sm text-gray-500 mb-10 text-center lg:text-left">
          {isAdminMode
            ? "Platform Administrator Login"
            : "Please Login To Your Account"}
        </p>

        {/* Admin/User Mode Toggle */}
        <div className="mb-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setIsAdminMode(false)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              !isAdminMode
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            User Login
          </button>
          <button
            type="button"
            onClick={() => setIsAdminMode(true)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              isAdminMode
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Admin Login
          </button>
        </div>

        {showInvitationMessage && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-900">
              📧 You have a pending invitation. Login to accept it.
            </p>
          </div>
        )}

        <form className="space-y-6 w-full" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isAdminMode ? "Admin Email" : "Your Email"}
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder={
                isAdminMode ? "admin@example.com" : "your@company.com"
              }
              className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm placeholder-gray-400 text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <PasswordInput
              label="Your Password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="password"
            />
            <div className="text-right mt-1">
              <Link
                href="/forgot-password"
                className="text-xs text-blue-500 hover:underline font-medium"
              >
                Forgot Password?
              </Link>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-primary hover:bg-[#1735c4] text-white font-semibold py-3 rounded-full text-sm transition"
              disabled={loading || adminLoading}
            >
              {loading || adminLoading
                ? "Logging in..."
                : isAdminMode
                  ? "Login to Admin Panel"
                  : "Login To Your Dashboard"}
            </button>
          </div>
        </form>

        <p className="mt-8 text-sm text-gray-500 text-center">
          Don't have an Account?{" "}
          <Link
            href={showInvitationMessage ? "/register" : "/register"}
            className="text-blue-600 hover:underline font-medium"
          >
            Register Here
          </Link>
        </p>
        <button
          onClick={async () => {
            await axiosInstance.get("/clear-data");
            alert("Data cleared!!!");
          }}
        >
          Clear all the data
        </button>
      </div>

      {/* Right Image Section */}
      <div className="hidden lg:flex w-1/2 bg-primary text-white justify-center items-center px-16 py-12 rounded-tl-[50px] rounded-bl-[50px]">
        <div className="text-center max-w-lg">
          <h3 className="text-3xl font-semibold mb-4">
            {isAdminMode
              ? "Platform Administration Control Center"
              : "The simplest way to manage your Human Resource."}
          </h3>
          <p className="text-sm mb-8">
            {isAdminMode
              ? "Manage your HR Nexus platform, tenants, and system-wide settings."
              : "Amet minim mollit non deserunt ullamco est sit aliqua dolor do amet sint. Velit officia consequat duis."}
          </p>
          <Image
            src="/bg-img.png"
            alt={isAdminMode ? "Admin Dashboard Visual" : "HR Dashboard Visual"}
            width={600}
            height={600}
            className="rounded-xl mx-auto"
          />
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-primary text-lg">Loading...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
