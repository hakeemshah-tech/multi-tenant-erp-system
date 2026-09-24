"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import axiosInstance from "@/app/lib/axios";

interface EmployeePhotoProps {
  employee: any;
  size?: number;
  className?: string;
  alt?: string;
}

export function EmployeePhoto({
  employee,
  size = 40,
  className = "",
  alt = "Employee",
}: EmployeePhotoProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolvePhoto = async () => {
      setLoading(true);
      const avatar =
        employee?.employeeFields?.personaldetails?.employeephoto || null;

      // Legacy/public url (if any)
      if (avatar?.url && typeof avatar.url === "string") {
        setPhotoUrl(avatar.url);
        setLoading(false);
        return;
      }

      // New private file ref
      if (avatar?.fileId) {
        try {
          // Ensure fileId is a string (convert ObjectId to string if needed)
          const fileIdString = String(avatar.fileId);
          const { data } = await axiosInstance.get<{
            url: string;
            expiresIn: number;
          }>(`/uploads/${fileIdString}/url`);
          setPhotoUrl(data?.url || null);
        } catch {
          setPhotoUrl(null);
        }
        setLoading(false);
        return;
      }

      setPhotoUrl(null);
      setLoading(false);
    };

    if (employee) {
      void resolvePhoto();
    }
  }, [employee]);

  if (loading) {
    return (
      <div
        className={`rounded-full bg-gray-200 animate-pulse ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt={alt}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-[6px] ${className}`}
      style={{ width: size, height: size }}
    >
      No Img
    </div>
  );
}
