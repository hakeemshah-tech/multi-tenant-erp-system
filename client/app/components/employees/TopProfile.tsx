// "use client";

// import Image from "next/image";
// import { useRef, useState } from "react";
// import toast from "react-hot-toast";
// import {
//   ArrowUpTrayIcon,
//   PhotoIcon,
//   TrashIcon,
// } from "@heroicons/react/24/solid";
// import axiosInstance from "@/app/lib/axios";
// import { Card } from "@/app/components/ui/Card";
// import { SAVE_ENDPOINT } from "@/app/lib/utils";

// type Props = {
//   branchId: string;
//   employee: any;
//   onEmployeeUpdated: (fresh: any) => void;
// };

// export default function TopProfile({
//   branchId,
//   employee,
//   onEmployeeUpdated,
// }: Props) {
//   const fileInputRef = useRef<HTMLInputElement | null>(null);
//   const [dragOver, setDragOver] = useState(false);
//   const [photoUploading, setPhotoUploading] = useState(false);
//   const [uploadPct, setUploadPct] = useState(0);

//   const photo = employee?.employeeFields?.personaldetails?.employeephoto?.url;
//   const pd = employee?.employeeFields?.personaldetails || {};
//   const email = employee?.employeeFields?.userId?.email;
//   const designation = employee?.designation?.name;
//   const departments = Array.isArray(employee?.designation?.departmentIds)
//     ? employee.designation.departmentIds
//         .map((d: any) => d?.name)
//         .filter(Boolean)
//     : [];

//   const handleSelectFile = async (file?: File | null) => {
//     if (!file || !branchId) return;
//     if (!file.type.startsWith("image/")) {
//       toast.error("Please select an image file");
//       return;
//     }
//     const maxMB = 5;
//     if (file.size > maxMB * 1024 * 1024) {
//       toast.error(`Image must be ≤ ${maxMB}MB`);
//       return;
//     }

//     try {
//       setPhotoUploading(true);
//       setUploadPct(0);
//       const formData = new FormData();
//       formData.append("file", file);

//       const { data } = await axiosInstance.post("/uploads", formData, {
//         headers: { "Content-Type": "multipart/form-data" },
//         onUploadProgress: (e) => {
//           if (!e.total) return;
//           const pct = Math.round((e.loaded / e.total) * 100);
//           setUploadPct(pct);
//         },
//       });

//       const url = data?.url || data?.data?.url;
//       if (!url) throw new Error("Upload failed");

//       await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//         sectionKey: "personaldetails",
//         isAdditional: false,
//         data: { employeephoto: { url } },
//       });

//       const { data: orgRes } = await axiosInstance.get(
//         `/employees/me/org-fields/${branchId}`
//       );
//       const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
//       onEmployeeUpdated(fresh);
//       toast.success("Photo updated");
//     } catch (err: any) {
//       console.error(err);
//       toast.error(err?.response?.data?.message || "Failed to update photo");
//     } finally {
//       setPhotoUploading(false);
//       setUploadPct(0);
//       if (fileInputRef.current) fileInputRef.current.value = "";
//     }
//   };

//   const handleRemovePhoto = async () => {
//     if (!branchId) return;
//     try {
//       setPhotoUploading(true);
//       await axiosInstance.put(SAVE_ENDPOINT(branchId), {
//         sectionKey: "personaldetails",
//         isAdditional: false,
//         data: { employeephoto: {} },
//       });
//       const { data: orgRes } = await axiosInstance.get(
//         `/employees/me/org-fields/${branchId}`
//       );
//       const fresh = orgRes?.data?.employee ?? orgRes?.employee ?? null;
//       onEmployeeUpdated(fresh);
//       toast.success("Photo removed");
//     } catch (err: any) {
//       console.error(err);
//       toast.error(err?.response?.data?.message || "Failed to remove photo");
//     } finally {
//       setPhotoUploading(false);
//     }
//   };

//   return (
//     <Card className="relative p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200">
//       <div className="flex flex-col sm:flex-row gap-10 items-center sm:items-start">
//         {/* Avatar uploader */}
//         <div className="flex-shrink-0">
//           <div
//             className={[
//               "group relative w-32 h-32 rounded-full overflow-hidden shadow ring-1 ring-gray-200",
//               dragOver ? "ring-2 ring-blue-400" : "",
//             ].join(" ")}
//             onDragOver={(e) => {
//               e.preventDefault();
//               setDragOver(true);
//             }}
//             onDragLeave={() => setDragOver(false)}
//             onDrop={(e) => {
//               e.preventDefault();
//               setDragOver(false);
//               const f = e.dataTransfer.files?.[0];
//               if (f) handleSelectFile(f);
//             }}
//           >
//             {photo ? (
//               <Image
//                 src={photo}
//                 alt="Employee Photo"
//                 width={128}
//                 height={128}
//                 className="object-cover w-full h-full"
//                 priority
//               />
//             ) : (
//               <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
//                 <PhotoIcon className="w-8 h-8 mb-1" />
//                 <span className="text-xs">No Photo</span>
//               </div>
//             )}

//             {/* Hover overlay */}
//             <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/40 flex items-center justify-center">
//               <button
//                 onClick={() => fileInputRef.current?.click()}
//                 className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full bg-white/90 hover:bg-white shadow"
//                 disabled={photoUploading}
//               >
//                 <ArrowUpTrayIcon className="w-4 h-4" />
//                 {photo ? "Change Photo" : "Upload Photo"}
//               </button>
//             </div>

//             {/* Uploading overlay */}
//             {photoUploading && (
//               <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
//                 <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
//                 <span className="text-xs text-gray-700">
//                   {uploadPct > 0 ? `${uploadPct}%` : "Uploading…"}
//                 </span>
//               </div>
//             )}
//           </div>

//           <input
//             ref={fileInputRef}
//             type="file"
//             accept="image/*"
//             className="hidden"
//             onChange={(e) => handleSelectFile(e.target.files?.[0])}
//           />

//           <div className="flex items-center gap-3 mt-3">
//             <button
//               className="text-xs text-blue-700 hover:text-blue-800 underline disabled:opacity-50"
//               onClick={() => fileInputRef.current?.click()}
//               disabled={photoUploading}
//             >
//               {photo ? "Replace photo" : "Upload photo"}
//             </button>
//             {photo && (
//               <>
//                 <span className="text-gray-300">•</span>
//                 <button
//                   className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
//                   onClick={handleRemovePhoto}
//                   disabled={photoUploading}
//                 >
//                   <TrashIcon className="w-4 h-4" />
//                   Remove
//                 </button>
//               </>
//             )}
//           </div>
//           <p className="mt-1 text-[11px] text-gray-500">
//             PNG/JPG up to 5MB. Drag & drop supported.
//           </p>
//         </div>

//         {/* Profile meta */}
//         <div className="w-full">
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-5">
//             <div>
//               <p className="text-[12px] text-gray-500 font-medium uppercase">
//                 Full Name
//               </p>
//               <p className="text-base text-gray-900 font-semibold">
//                 {(pd.firstname || "") + " " + (pd.lastname || "")}
//               </p>
//             </div>
//             <div>
//               <p className="text-[12px] text-gray-500 font-medium uppercase">
//                 Designation
//               </p>
//               <p className="text-base text-gray-900 font-semibold">
//                 {designation || "—"}
//               </p>
//             </div>
//             <div>
//               <p className="text-[12px] text-gray-500 font-medium uppercase">
//                 Location
//               </p>
//               <p className="text-base text-gray-800">
//                 {pd.location && pd.state ? `${pd.location}, ${pd.state}` : "—"}
//               </p>
//             </div>
//             <div>
//               <p className="text-[12px] text-gray-500 font-medium uppercase">
//                 Mobile
//               </p>
//               <p className="text-base text-gray-800">{pd.mobile || "—"}</p>
//             </div>
//             <div>
//               <p className="text-[12px] text-gray-500 font-medium uppercase">
//                 Email
//               </p>
//               <p className="text-base text-gray-800">{email || "—"}</p>
//             </div>
//             {departments.length > 0 && (
//               <div className="col-span-full">
//                 <p className="text-[12px] text-gray-500 font-medium uppercase mb-1">
//                   Departments
//                 </p>
//                 <div className="flex flex-wrap gap-2">
//                   {departments.map((dept: string, idx: number) => (
//                     <span
//                       key={idx}
//                       className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full border border-blue-200"
//                     >
//                       {dept}
//                     </span>
//                   ))}
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>
//       </div>
//     </Card>
//   );
// }

"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowUpTrayIcon,
  PhotoIcon,
  TrashIcon,
} from "@heroicons/react/24/solid";
import axiosInstance from "@/app/lib/axios";
import { Card } from "@/app/components/ui/Card";

type Props = {
  employee: any;
  onEmployeeUpdated: (fresh: any) => void;
  onSavePhoto: (urlOrNull: string | null) => Promise<void>;
  fetchEmployee: () => Promise<any>;
};

export default function TopProfile({
  employee,
  onEmployeeUpdated,
  onSavePhoto,
  fetchEmployee,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  const photo = employee?.employeeFields?.personaldetails?.employeephoto?.url;
  const pd = employee?.employeeFields?.personaldetails || {};
  const designation = employee?.designation?.name;
  const departments = Array.isArray(employee?.designation?.departmentIds)
    ? employee.designation.departmentIds
        .map((d: any) => d?.name)
        .filter(Boolean)
    : [];

  const handleSelectFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return toast.error("Please select an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be ≤ 5MB");

    try {
      setPhotoUploading(true);
      setUploadPct(0);
      const formData = new FormData();
      formData.append("file", file);

      const { data } = await axiosInstance.post("/uploads", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setUploadPct(Math.round((e.loaded / e.total) * 100));
        },
      });

      const url = data?.url || data?.data?.url;
      if (!url) throw new Error("Upload failed");

      await onSavePhoto(url);
      const fresh = await fetchEmployee();
      onEmployeeUpdated(fresh);
      toast.success("Photo updated");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to update photo");
    } finally {
      setPhotoUploading(false);
      setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    try {
      setPhotoUploading(true);
      await onSavePhoto(null);
      const fresh = await fetchEmployee();
      onEmployeeUpdated(fresh);
      toast.success("Photo removed");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to remove photo");
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <Card className="relative p-6 bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200">
      <div className="flex flex-col sm:flex-row gap-10 items-center sm:items-start">
        {/* avatar */}
        <div className="flex-shrink-0">
          <div
            className={[
              "group relative w-32 h-32 rounded-full overflow-hidden shadow ring-1 ring-gray-200",
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
              if (f) handleSelectFile(f);
            }}
          >
            {photo ? (
              <Image
                src={photo}
                alt="Employee Photo"
                width={128}
                height={128}
                className="object-cover w-full h-full"
                priority
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
                <PhotoIcon className="w-8 h-8 mb-1" />
                <span className="text-xs">No Photo</span>
              </div>
            )}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-black/40 flex items-center justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full bg-white/90 hover:bg-white shadow"
                disabled={photoUploading}
              >
                <ArrowUpTrayIcon className="w-4 h-4" />
                {photo ? "Change Photo" : "Upload Photo"}
              </button>
            </div>
            {photoUploading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
                <span className="text-xs text-gray-700">
                  {uploadPct > 0 ? `${uploadPct}%` : "Uploading…"}
                </span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleSelectFile(e.target.files?.[0] || null)}
          />

          <div className="flex items-center gap-3 mt-3">
            <button
              className="text-xs text-blue-700 hover:text-blue-800 underline disabled:opacity-50"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
            >
              {photo ? "Replace photo" : "Upload photo"}
            </button>
            {photo && (
              <>
                <span className="text-gray-300">•</span>
                <button
                  className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                  onClick={handleRemovePhoto}
                >
                  <TrashIcon className="w-4 h-4" /> Remove
                </button>
              </>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            PNG/JPG up to 5MB. Drag & drop supported.
          </p>
        </div>

        {/* meta */}
        <div className="w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-5">
            <div>
              <p className="text-[12px] text-gray-500 font-medium uppercase">
                Full Name
              </p>
              <p className="text-base text-gray-900 font-semibold">
                {(pd.firstname || "") + " " + (pd.lastname || "")}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-gray-500 font-medium uppercase">
                Job Title
              </p>
              <p className="text-base text-gray-900 font-semibold">
                {designation || "—"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-gray-500 font-medium uppercase">
                Location
              </p>
              <p className="text-base text-gray-800">
                {pd.location && pd.state ? `${pd.location}, ${pd.state}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[12px] text-gray-500 font-medium uppercase">
                Mobile
              </p>
              <p className="text-base text-gray-800">{pd.mobile || "—"}</p>
            </div>
            <div>
              <p className="text-[12px] text-gray-500 font-medium uppercase">
                Email
              </p>
              <p className="text-base text-gray-800">
                {employee?.employeeFields?.userId?.email || "—"}
              </p>
            </div>
            {departments.length > 0 && (
              <div className="col-span-full">
                <p className="text-[12px] text-gray-500 font-medium uppercase mb-1">
                  Departments
                </p>
                <div className="flex flex-wrap gap-2">
                  {departments.map((d: string, i: number) => (
                    <span
                      key={i}
                      className="inline-block bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1 rounded-full border border-blue-200"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
