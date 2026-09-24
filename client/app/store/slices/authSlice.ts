// // store/slices/authSlice.ts
// import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import axiosInstance from "@/app/lib/axios";
// import { toast } from "react-toastify";
// import Cookies from "js-cookie";
// import Router from "next/router";

// interface AuthState {
//   loading: boolean;
//   user: any;
//   accessToken: string | null;
//   error: string | null;
// }

// const initialState: AuthState = {
//   loading: false,
//   user: null,
//   accessToken: null,
//   error: null,
// };

// // 🔐 Register
// export const registerTenant = createAsyncThunk(
//   "auth/registerTenant",
//   async (formData, { rejectWithValue }) => {
//     try {
//       const res = await axiosInstance.post("/auth/register", formData);
//       toast.success(res.data.message || "Registration successful!");
//       return res.data;
//     } catch (error: any) {
//       const msg =
//         error.response?.data?.message || "Registration failed. Try again.";
//       toast.error(msg);
//       return rejectWithValue(msg);
//     }
//   }
// );

// // 🔑 Login
// export const loginUser = createAsyncThunk(
//   "auth/loginUser",
//   async (
//     formData: { email: string; password: string },
//     { rejectWithValue }
//   ) => {
//     try {
//       const res = await axiosInstance.post("/auth/login", formData);
//       toast.success(res.data.message || "Login successful!");
//       Cookies.set("accessToken", res.data.data.accessToken, { secure: true });
//       Cookies.set("refreshToken", res.data.data.refreshToken, { secure: true });
//       return res.data.data;
//     } catch (error: any) {
//       const msg = error.response?.data?.message || "Login failed. Try again.";
//       toast.error(msg);
//       return rejectWithValue(msg);
//     }
//   }
// );

// // 👤 Get Profile
// export const getProfile = createAsyncThunk(
//   "auth/getProfile",
//   async (_, { rejectWithValue }) => {
//     try {
//       const res = await axiosInstance.get("/auth/profile");
//       return res.data.data;
//     } catch (err: any) {
//       return rejectWithValue("Invalid or expired token");
//     }
//   }
// );

// // 🚪 Logout (API + clear local state/cookies)
// export const logoutUser = createAsyncThunk(
//   "auth/logoutUser",
//   async (_, { dispatch }) => {
//     try {
//       await axiosInstance.post("/auth/logout");
//     } catch (err) {
//       // Ignore logout error silently
//     } finally {
//       Cookies.remove("accessToken");
//       Cookies.remove("refreshToken");
//       dispatch(logout()); // clear Redux state
//       Router.push("/login"); // navigate
//     }
//   }
// );

// const authSlice = createSlice({
//   name: "auth",
//   initialState,
//   reducers: {
//     logout(state) {
//       state.user = null;
//       state.accessToken = null;
//       state.error = null;
//     },
//   },
//   extraReducers: (builder) => {
//     builder
//       .addCase(registerTenant.pending, (state) => {
//         state.loading = true;
//         state.error = null;
//       })
//       .addCase(registerTenant.fulfilled, (state, action) => {
//         state.loading = false;
//         state.user = action.payload.user;
//         state.accessToken = action.payload.accessToken;
//       })
//       .addCase(registerTenant.rejected, (state, action) => {
//         state.loading = false;
//         state.error = action.payload as string;
//       })
//       .addCase(loginUser.pending, (state) => {
//         state.loading = true;
//         state.error = null;
//       })
//       .addCase(loginUser.fulfilled, (state, action) => {
//         state.loading = false;
//         state.user = action.payload.user;
//         state.accessToken = action.payload.accessToken;
//       })
//       .addCase(loginUser.rejected, (state, action) => {
//         state.loading = false;
//         state.error = action.payload as string;
//       })
//       .addCase(getProfile.pending, (state) => {
//         state.loading = true;
//       })
//       .addCase(getProfile.fulfilled, (state, action) => {
//         state.loading = false;
//         state.user = action.payload;
//       })
//       .addCase(getProfile.rejected, (state, action) => {
//         state.loading = false;
//         state.user = null;
//         state.error = action.payload as string;
//       });
//   },
// });

// export const { logout } = authSlice.actions;
// export default authSlice.reducer;

// store/slices/authSlice.ts
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axiosInstance from "@/app/lib/axios";
import { toast } from "react-toastify";
import Cookies from "js-cookie";
import Router from "next/router";
import { NextResponse } from "next/server";

interface AuthState {
  loading: boolean;
  user: unknown;
  accessToken: string | null;
  error: string | null;
}

const initialState: AuthState = {
  loading: false,
  user: null,
  accessToken: null,
  error: null,
};

// 🆕 Register User (not tenant)
export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (
    formData: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await axiosInstance.post("/auth/register-user", formData);
      toast.success(res.data.message || "User registered successfully!");

      // Set tokens in cookies (same as login)
      Cookies.set("accessToken", res.data.data.accessToken, { secure: true });
      Cookies.set("refreshToken", res.data.data.refreshToken, { secure: true });

      return res.data.data; // return AuthResponse with tokens and user
    } catch (error: any) {
      const msg =
        error.response?.data?.message || "Registration failed. Try again.";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// 🔐 Register Tenant
export const registerTenant = createAsyncThunk(
  "auth/registerTenant",
  async (formData, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.post("/auth/register-tenant", formData);
      toast.success(res.data.message || "Registration successful!");
      return res.data;
    } catch (error: any) {
      const msg =
        error.response?.data?.message || "Registration failed. Try again.";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// 🔑 Login
export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (
    formData: { email: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await axiosInstance.post("/auth/login", formData);
      toast.success(res.data.message || "Login successful!");
      Cookies.set("accessToken", res.data.data.accessToken, { secure: true });
      Cookies.set("refreshToken", res.data.data.refreshToken, { secure: true });

      const role = res.data.data.user.activeAssignment.role;

      // Store auth data first
      const authData = res.data.data;

      // Check for pending invitation token
      const pendingInvitationToken = sessionStorage.getItem(
        "pendingInvitationToken"
      );

      if (pendingInvitationToken) {
        // Clear the stored token
        sessionStorage.removeItem("pendingInvitationToken");
        sessionStorage.removeItem("pendingInvitationBranchId");
        sessionStorage.removeItem("pendingInvitationTenantId");

        // Return data first, then redirect
        setTimeout(() => {
          window.location.href = "/nexus-profile/invitations";
        }, 0);
        return authData;
      }

      // Return data first, then redirect based on role
      setTimeout(() => {
        if (role === "newbie") {
          window.location.href = "/onboarding";
        } else if (role === "tenant-owner") {
          window.location.href = "/tenant";
        } else if (role === "nexus-profile" || role === "employee") {
          window.location.href = "/nexus-profile";
        } else if (role === "organization") {
          window.location.href = "/tenant";
        } else if (role === "admin") {
          window.location.href = "/dashboard";
        }
      }, 0);

      return authData;
    } catch (error: any) {
      const msg = error.response?.data?.message || "Login failed. Try again.";
      toast.error(msg);
      return rejectWithValue(msg);
    }
  }
);

// 👤 Get Profile
export const getProfile = createAsyncThunk(
  "auth/getProfile",
  async (_, { rejectWithValue }) => {
    try {
      const res = await axiosInstance.get("/auth/profile");
      return res.data.data;
    } catch (err: any) {
      return rejectWithValue("Invalid or expired token");
    }
  }
);

// 🚪 Logout
export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { dispatch }) => {
    try {
      await axiosInstance.post("/auth/logout");
    } catch (err) {
      // Ignore logout error silently
    } finally {
      Cookies.remove("accessToken");
      Cookies.remove("refreshToken");
      dispatch(logout());
      Router.push("/login");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout(state) {
      state.user = null;
      state.accessToken = null;
      state.error = null;
    },
    setUser: (state, data) => {
      state.user = data.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Register Tenant
      .addCase(registerTenant.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerTenant.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
      })
      .addCase(registerTenant.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Register User
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        // Safety check - ensure payload exists and has expected structure
        if (action.payload?.user && action.payload?.accessToken) {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
        }
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        // Safety check - ensure payload exists and has expected structure
        if (action.payload?.user && action.payload?.accessToken) {
          state.user = action.payload.user;
          state.accessToken = action.payload.accessToken;
        }
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Profile
      .addCase(getProfile.pending, (state) => {
        state.loading = true;
      })
      .addCase(getProfile.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.loading = false;
        state.user = null;
        state.error = action.payload as string;
      });
  },
});

export const { logout, setUser } = authSlice.actions;
export default authSlice.reducer;
