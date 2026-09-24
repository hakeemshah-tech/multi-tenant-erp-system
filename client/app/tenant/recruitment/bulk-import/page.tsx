"use client";

import { useState } from "react";
import { Button, Title, Text } from "rizzui";
import axiosInstance from "@/app/lib/axios";
import toast from "react-hot-toast";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; email: string; error: string }>;
}

export default function BulkImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      if (
        !selectedFile.name.endsWith(".xlsx") &&
        !selectedFile.name.endsWith(".xls")
      ) {
        toast.error("Please upload a valid Excel file (.xlsx or .xls)");
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
  });

  const handleDownloadTemplate = async () => {
    try {
      const response = await axiosInstance.get("/bulk-import/template", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "employee-import-template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Template downloaded successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Failed to download template"
      );
    }
  };

  const handleDownloadDummyData = async () => {
    try {
      const response = await axiosInstance.get("/bulk-import/dummy-data", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "500-dummy-employees.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("500 dummy records downloaded successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Failed to download dummy data"
      );
    }
  };

  const handleDownloadDummyData1000 = async () => {
    try {
      const response = await axiosInstance.get("/bulk-import/dummy-data-1000", {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "1000-dummy-employees.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success("1000 dummy records downloaded successfully");
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Failed to download dummy data"
      );
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await axiosInstance.post(
        "/bulk-import/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const resultData: ImportResult = response.data.data;
      setResult(resultData);

      if (resultData.failed === 0) {
        toast.success(
          `Successfully imported ${resultData.success} employee(s)`
        );
      } else {
        toast.error(
          `Imported ${resultData.success} employee(s), ${resultData.failed} failed`
        );
      }
    } catch (error: any) {
      console.error(error);
      toast.error(
        error?.response?.data?.message || "Failed to process bulk import"
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Title as="h1" className="text-2xl font-bold">
            Bulk Employee Import (Testing)
          </Title>
          <Text className="text-gray-600 mt-1">
            Upload Excel file to import multiple employees at once
          </Text>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleDownloadDummyData}
            variant="outline"
            className="flex items-center gap-2 bg-green-50 hover:bg-green-100 border-green-300 text-green-700"
          >
            <Download size={18} />
            500 Dataset
          </Button>
          <Button
            onClick={handleDownloadDummyData1000}
            variant="outline"
            className="flex items-center gap-2 bg-purple-50 hover:bg-purple-100 border-purple-300 text-purple-700"
          >
            <Download size={18} />
            1000 Dataset
          </Button>
          <Button
            onClick={handleDownloadTemplate}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download size={18} />
            Download Template
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Instructions:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
            <li>Download the template Excel file using the button above</li>
            <li>
              Fill in employee data. Required fields: Email, First Name, Last
              Name, Designation
            </li>
            <li>
              If Password is not provided, a random password will be generated
            </li>
            <li>
              Designation must match an existing designation in your
              organization
            </li>
            {/* <li>Date fields should be in format: YYYY-MM-DD or MM/DD/YYYY</li> */}
          </ul>
        </div>

        {/* File Upload Area */}
        <div>
          <Text className="font-medium mb-3 block">Upload Excel File</Text>
          {!file ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto text-gray-400 mb-3" size={48} />
              <p className="text-sm font-medium text-gray-700 mb-1">
                {isDragActive
                  ? "Drop the Excel file here"
                  : "Drag & drop Excel file here"}
              </p>
              <p className="text-xs text-gray-500">
                or click to browse • Excel files only (.xlsx, .xls)
              </p>
              <p className="text-xs text-gray-400 mt-2">Max file size: 10MB</p>
            </div>
          ) : (
            <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="text-green-600" size={24} />
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Remove
              </Button>
            </div>
          )}
        </div>

        {/* Upload Button */}
        {file && (
          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Processing...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload & Process
                </>
              )}
            </Button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="border-t pt-6 mt-6">
            <h3 className="font-semibold mb-4">Import Results</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="text-green-600" size={20} />
                  <span className="font-semibold text-green-900">Success</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {result.success}
                </p>
                <p className="text-xs text-green-600">employees imported</p>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <XCircle className="text-red-600" size={20} />
                  <span className="font-semibold text-red-900">Failed</span>
                </div>
                <p className="text-2xl font-bold text-red-700">
                  {result.failed}
                </p>
                <p className="text-xs text-red-600">employees failed</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2 text-sm">Error Details:</h4>
                <div className="bg-gray-50 rounded-lg border max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">Row</th>
                        <th className="px-4 py-2 text-left">Email</th>
                        <th className="px-4 py-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((error, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-2">{error.row}</td>
                          <td className="px-4 py-2">{error.email}</td>
                          <td className="px-4 py-2 text-red-600">
                            {error.error}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
