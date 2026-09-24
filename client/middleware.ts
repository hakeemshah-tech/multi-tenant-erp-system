// import { NextRequest, NextResponse } from "next/server";
// import { jwtDecode } from "jwt-decode";

// export function middleware(req: NextRequest) {
//   const token = req.cookies.get("accessToken")?.value;
//   const { pathname } = req.nextUrl;

//   // If logged in and trying to access public routes like login or register
//   if (token && ["/login", "/register"].includes(pathname)) {
//     const payload: any = jwtDecode(token);

//     // Redirect based on role (you can extend this)
//     if (payload.role === "tenant-owner") {
//       return NextResponse.redirect(new URL("/tenant", req.url));
//     }

//     // Default fallback (optional)
//     return NextResponse.redirect(new URL("/", req.url));
//   }

//   // Protect tenant routes
//   if (!token && pathname.startsWith("/tenant")) {
//     return NextResponse.redirect(new URL("/login", req.url));
//   }

//   // If on home page and logged in, redirect based on role
//   if (token && pathname === "/") {
//     const payload: any = jwtDecode(token);
//     if (payload.role === "tenant-owner") {
//       return NextResponse.redirect(new URL("/tenant", req.url));
//     }
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/", "/login", "/register", "/tenant/:path*"],
// };
// --------------------------------------------------------------------------

// middleware.ts
// import { NextRequest, NextResponse } from "next/server";
// import { jwtDecode } from "jwt-decode";

// const protectedRoutes = [
//   "/dashboard",
//   "/tenant",
//   "/nexus-profile",
//   "/onboarding",
// ];
// const publicRoutes = [
//   "/login",
//   "/register",
//   "/register-user",
//   "/otp",
//   "/set-password",
// ];

// export default function middleware(req: NextRequest) {
//   const path = req.nextUrl.pathname;
//   const token = req.cookies.get("accessToken")?.value;

//   let user: any = null;

//   if (token) {
//     try {
//       const decoded: any = jwtDecode(token);
//       const now = Date.now() / 1000;
//       if (decoded.exp && decoded.exp < now) throw new Error("Token expired");

//       user = {
//         id: decoded.userId,
//         role: decoded.role,
//         tenantId: decoded.tenantId,
//         branchId: decoded.branchId,
//       };
//     } catch (err) {
//       console.warn("Token invalid/expired", err);
//     }
//   }

//   // Not logged in and trying to access protected routes
//   if (!user && protectedRoutes.some((r) => path.startsWith(r))) {
//     return NextResponse.redirect(new URL("/login", req.url));
//   }

//   // Logged in and trying to access public routes
//   if (user && publicRoutes.includes(path)) {
//     // redirect based on role or current mode
//     if (user.role === "newbie") {
//       return NextResponse.redirect(new URL("/onboarding", req.url));
//     }

//     if (user.role === "tenant-owner") {
//       return NextResponse.redirect(new URL("/tenant", req.url));
//     }

//     if (user.role === "nexus-profile") {
//       return NextResponse.redirect(new URL("/nexus-profile", req.url));
//     }
//     if (user.role === "admin") {
//       return NextResponse.redirect(new URL("/dashboard", req.url));
//     }
//     // return NextResponse.redirect(new URL("/dashboard", req.url)); // fallback
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
// };

import { NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/tenant",
  "/nexus-profile",
  "/onboarding",
];

const publicRoutes = [
  "/login",
  "/register",
  "/register-user",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/otp",
  "/set-password",
];

export default async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const token = req.cookies.get("accessToken")?.value;

  let user: any = null;

  if (token) {
    try {
      // Middleware runs on the server, so it talks to the API over the internal
      // Docker network rather than through the public reverse proxy.
      const baseUrl =
        process.env.INTERNAL_API_BASE_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://localhost:5000/api";

      const apiResponse = await fetch(`${baseUrl}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (apiResponse.ok) {
        const res = await apiResponse.json();
        user = res.data;
      } else {
        console.warn("Failed to fetch user profile", apiResponse.statusText);
      }
    } catch (err) {
      console.error("Error fetching user profile:", err);
    }
  }

  // Not logged in and trying to access protected routes
  if (!user && protectedRoutes.some((r) => path.startsWith(r))) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Check if user is verified for routes that require verification
  // Allow access to public routes (login, register, verify-email)
  const verificationRequiredRoutes = [
    "/onboarding",
    "/tenant",
    "/nexus-profile",
  ];
  const isVerificationRequired = verificationRequiredRoutes.some((r) =>
    path.startsWith(r)
  );
  const isPublicRoute = publicRoutes.some(
    (r) => path === r || path.startsWith(r)
  );

  // If user is not verified and trying to access protected routes, redirect to verify-email
  if (
    user &&
    isVerificationRequired &&
    !isPublicRoute &&
    !user.isVerified &&
    !user.isPlatformAdmin
  ) {
    // Redirect to verify-email page with email parameter
    const verifyUrl = new URL("/verify-email", req.url);
    if (user.email) {
      verifyUrl.searchParams.set("email", user.email);
    }
    return NextResponse.redirect(verifyUrl);
  }

  // Logged in and trying to access public routes
  // BUT: Don't redirect if user is on verify-email page (they need to verify first)
  if (user && publicRoutes.includes(path) && path !== "/verify-email") {
    // If user is verified, redirect based on role
    if (user.isVerified || user.isPlatformAdmin) {
      // Check if user is platform admin first
      if (user.isPlatformAdmin || user.role === "platform-admin") {
        return NextResponse.redirect(new URL("/admin/awards", req.url));
      }

      const role = user.role === "admin" ? user.role : user.currentMode;
      if (role === "newbie") {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      if (role === "tenant-owner") {
        return NextResponse.redirect(new URL("/tenant", req.url));
      }

      if (role === "nexus-profile") {
        return NextResponse.redirect(new URL("/nexus-profile", req.url));
      }

      if (role === "organization") {
        return NextResponse.redirect(new URL("/tenant", req.url));
      }

      if (role === "admin") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }
    // If user is not verified and on public routes (except verify-email), allow them to stay
    // They will be redirected to verify-email when trying to access protected routes
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
