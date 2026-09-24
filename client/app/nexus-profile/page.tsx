"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function NexusProfilePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to organizations page as default
    router.replace("/nexus-profile/organizations");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
