"use client";

import { Fragment, useState, useRef } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button, Text } from "rizzui";
import {
  Shield,
  Upload,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  FileText,
} from "lucide-react";
import axios from "@/app/lib/axios";
import toast from "react-hot-toast";

interface TamperCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  approvalId: string;
  isPublic?: boolean;
  templateId?: string;
  applicantId?: string;
  token?: string;
}

export default function TamperCheckModal({
  isOpen,
  onClose,
  approvalId,
  isPublic = false,
  templateId,
  applicantId,
  token,
}: TamperCheckModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    message: string;
    storedHash?: string;
    uploadedHash?: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleVerify = async () => {
    if (!file) {
      toast.error("Please select a PDF file to verify");
      return;
    }

    setVerifying(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      let response;
      if (isPublic && templateId && applicantId && token) {
        response = await axios.post(
          `/contract-templates/public/contract/${templateId}/${applicantId}/verify-pdf?token=${token}`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      } else {
        response = await axios.post(
          `/contract-templates/approvals/${approvalId}/verify-pdf`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      }

      setResult({
        isValid: response.data.data?.isValid,
        message: response.data.message,
        storedHash: response.data.data?.storedHash,
        uploadedHash: response.data.data?.uploadedHash,
      });
    } catch (error: any) {
      const message = error?.response?.data?.message || "Verification failed";
      setResult({
        isValid: false,
        message,
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-semibold text-gray-900 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    Tamper Check
                  </span>
                  <button
                    onClick={handleClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Title>

                <div className="mt-4">
                  <Text className="text-gray-600 text-sm mb-4">
                    Upload the contract PDF to verify its authenticity. This
                    will compare the document against the original signed
                    contract.
                  </Text>

                  {/* File Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                      file
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {file ? (
                      <div className="flex items-center justify-center gap-2">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <div className="text-left">
                          <p className="font-medium text-gray-900">
                            {file.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          PDF file only (max 10MB)
                        </p>
                      </>
                    )}
                  </div>

                  {/* Result Display */}
                  {result && (
                    <div
                      className={`mt-4 p-4 rounded-lg ${
                        result.isValid
                          ? "bg-green-50 border border-green-200"
                          : "bg-red-50 border border-red-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {result.isValid ? (
                          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p
                            className={`font-medium ${
                              result.isValid ? "text-green-800" : "text-red-800"
                            }`}
                          >
                            {result.isValid
                              ? "Valid Contract"
                              : "Invalid/Edited Contract"}
                          </p>
                          <p
                            className={`text-sm mt-1 ${
                              result.isValid ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            {result.message}
                          </p>
                          {result.storedHash && result.uploadedHash && (
                            <div className="mt-2 text-xs font-mono">
                              <p className="text-gray-500">
                                Original: {result.storedHash}
                              </p>
                              <p className="text-gray-500">
                                Uploaded: {result.uploadedHash}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" onClick={handleClose}>
                    Close
                  </Button>
                  <Button
                    onClick={handleVerify}
                    disabled={!file || verifying}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Verifying...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Verify Document
                      </>
                    )}
                  </Button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
