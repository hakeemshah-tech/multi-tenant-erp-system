import Cookies from "js-cookie"; // to manipulate cookies on client
import axios from "axios";
import toast from "react-hot-toast";

// The API origin is injected at build time. Behind the Nginx reverse proxy this
// is the relative path `/api`, so the browser never needs to know the internal
// service address.
const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Request interceptor to attach Bearer token and page info
axiosInstance.interceptors.request.use(
  (config) => {
    const token = Cookies.get("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add current page information for audit logging
    if (typeof window !== "undefined") {
      config.headers["x-page"] = window.location.pathname;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// 🔐 Global error handler with toast notifications
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (authentication)
    if (
      typeof window !== "undefined" &&
      error.response?.status === 401 &&
      !originalRequest?.skipAuthRedirect && // 👈 Allow bypass if set
      window.location.pathname !== "/login" // 👈 Don't redirect if already on login page
    ) {
      Cookies.remove("accessToken");
      Cookies.remove("refreshToken");
      window.location.href = "/login";
    }

    // Show toast notification for all API errors (except 401 which redirects)
    if (
      typeof window !== "undefined" &&
      error.response &&
      !originalRequest?.skipToast // 👈 Allow bypass if set
    ) {
      // Extract error message from response
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "An error occurred";

      // Don't show toast for 401 errors (handled by redirect above)
      if (error.response?.status !== 401) {
        toast.error(errorMessage);
      }
    } else if (
      typeof window !== "undefined" &&
      !error.response &&
      !originalRequest?.skipToast
    ) {
      // Network error or no response
      toast.error("Network error. Please check your connection.");
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
