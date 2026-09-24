"use client";
import React, { useRef, useState } from "react";
import Image from "next/image";
import { Card } from "@/app/components/ui/Card";
import { PhotoIcon, PencilIcon } from "@heroicons/react/24/solid";
import {
  BriefcaseIcon,
  PhoneIcon,
  MapPinIcon,
  EnvelopeIcon,
  BuildingOfficeIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { Shield, Briefcase } from "lucide-react";

export interface TopProfileData {
  photoUrl?: string;
  name?: string;
  designation?: string;
  location?: string;
  mobile?: string;
  email?: string;
  departments?: string[];
  employmentStatus?: string;
  employmentStatusOptions?: string[];
  onEmploymentStatusChange?: (newStatus: string) => void;
  employmentStatusLoading?: boolean;
  additionalDesignations?: Array<{ _id: string; name: string }>; // Additional job titles
  additionalRoles?: Array<{ roleId: string; name: string }>; // Additional roles
}

export function TopProfileCard({
  data,
  uploading,
  uploadPct = 0,
  onSelectFile,
  onRemove,
}: {
  data: TopProfileData;
  uploading?: boolean;
  uploadPct?: number;
  onSelectFile?: (file: File | null | undefined) => void;
  onRemove?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const {
    photoUrl,
    name,
    designation,
    location,
    mobile,
    email,
    departments = [],
    employmentStatus,
    additionalDesignations = [],
    additionalRoles = [],
  } = data || {};

  return (
    <Card className="relative p-5 bg-white rounded-xl shadow-sm border border-gray-200">
      {/* Employment Status Badge - Top Right */}
      {employmentStatus && (
        <div className="absolute top-3 right-3 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
          <ClockIcon className="w-3.5 h-3.5 text-amber-700" />
          <span className="text-xs font-semibold text-amber-900">
            {employmentStatus}
          </span>
        </div>
      )}

      <div className="flex gap-5 items-start">
        {/* Profile Picture Section */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div
            className={[
              "relative w-20 h-20 rounded-full overflow-hidden border-2 border-blue-200",
              dragOver ? "ring-2 ring-blue-400" : "",
            ].join(" ")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f && onSelectFile) onSelectFile(f);
            }}
          >
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt="Employee Photo"
                width={80}
                height={80}
                className="object-cover w-full h-full"
                priority
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100">
                <PhotoIcon className="w-8 h-8 text-gray-400" />
              </div>
            )}

            {uploading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-1.5">
                <div className="w-5 h-5 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                <span className="text-[9px] text-gray-700">
                  {uploadPct > 0 ? `${uploadPct}%` : "Uploading…"}
                </span>
              </div>
            )}
          </div>

          {/* Edit Photo Button */}
          {onSelectFile && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="mt-1.5 w-7 h-7 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white shadow-sm transition-colors disabled:opacity-50"
            >
              <PencilIcon className="w-3.5 h-3.5" />
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onSelectFile?.(e.target.files?.[0])}
          />
        </div>

        {/* Main Content Section */}
        <div className="flex-1 min-w-0">
          {/* Name */}
          <h1 className="text-xl font-bold text-gray-900 mb-3">
            {name || "—"}
          </h1>

          {/* Compact Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-3">
            {/* Job Title with Additional Job Titles */}
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">
                Job Title
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="flex items-center gap-1.5">
                  <BriefcaseIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-gray-900 font-medium">
                    {designation || "—"}
                  </span>
                </div>
                {additionalDesignations.length > 0 && (
                  <>
                    {additionalDesignations.map((addDesignation) => (
                      <span
                        key={addDesignation._id}
                        className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-medium px-1.5 py-0.5 rounded"
                        title={addDesignation.name}
                      >
                        <Briefcase className="w-2.5 h-2.5" />
                        {addDesignation.name}
                      </span>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Mobile */}
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">
                Mobile
              </p>
              <div className="flex items-center gap-1.5">
                <PhoneIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-gray-900 font-medium">
                  {mobile || "—"}
                </p>
              </div>
            </div>

            {/* Location */}
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">
                Location
              </p>
              <div className="flex items-center gap-1.5">
                <MapPinIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-gray-900 font-medium">
                  {location || "—"}
                </p>
              </div>
            </div>

            {/* Email */}
            <div>
              <p className="text-[10px] text-gray-500 font-medium uppercase mb-1">
                Email
              </p>
              <div className="flex items-center gap-1.5">
                <EnvelopeIcon className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-gray-900 font-medium truncate">
                  {email || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Roles and Departments - Compact Row */}
          {(additionalRoles.length > 0 || departments.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {additionalRoles.length > 0 && (
                <>
                  {additionalRoles.map((role) => (
                    <span
                      key={role.roleId}
                      className="inline-flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-medium px-1.5 py-0.5 rounded"
                      title={role.name}
                    >
                      <Shield className="w-2.5 h-2.5" />
                      {role.name}
                    </span>
                  ))}
                </>
              )}
              {departments.map((dept, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-600 text-[10px] font-medium px-1.5 py-0.5 rounded"
                >
                  <BuildingOfficeIcon className="w-2.5 h-2.5" />
                  {dept}
                </span>
              ))}
            </div>
          )}

          {/* Photo Links - Compact */}
          {photoUrl && (
            <div className="flex items-center gap-3 pt-1">
              <button
                className="text-xs text-red-600 hover:text-red-700 underline disabled:opacity-50"
                onClick={onRemove}
                disabled={uploading}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
