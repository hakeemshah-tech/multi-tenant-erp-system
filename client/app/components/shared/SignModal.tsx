import { Fragment, useRef, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Button, Text, Tab, Input, Loader } from "rizzui";
import {
  X,
  PenTool,
  Stamp,
  Upload,
  Trash2,
  Save,
  RotateCcw,
} from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import toast from "react-hot-toast";

interface SignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (signatureData: string) => Promise<void>;
  userName: string;
}

export default function SignModal({
  isOpen,
  onClose,
  onSign,
  userName,
}: SignModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  // Tab 1: Draw State
  const [isEmpty, setIsEmpty] = useState(true);

  // Tab 2: Stamp State
  const [generatedStamp, setGeneratedStamp] = useState<string | null>(null);

  // Tab 3: Upload State
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset states when closed
      setIsEmpty(true);
      setGeneratedStamp(null);
      setUploadedImage(null);
      setActiveTab(0);
    } else {
      // Generate stamp on open if not already (or just let user click generate)
    }
  }, [isOpen]);

  const clearSignature = () => {
    sigCanvas.current?.clear();
    setIsEmpty(true);
  };

  const handleDrawEnd = () => {
    setIsEmpty(sigCanvas.current?.isEmpty() ?? true);
  };

  const generateStamp = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = "#111827"; // gray-900
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 380, 180);

    // Text
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";

    // "DIGITALLY SIGNED"
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("DIGITALLY SIGNED", 200, 60);

    // Name
    ctx.font = "bold 32px serif";
    ctx.fillText(userName, 200, 110);

    // Date
    const now = new Date();
    const dateStr = now.toLocaleString();
    ctx.font = "16px monospace";
    ctx.fillText(dateStr, 200, 150);

    // ID
    const uniqueId = Math.random().toString(36).substring(2, 9).toUpperCase();
    ctx.fillText(`ID: ${uniqueId}`, 200, 175);

    setGeneratedStamp(canvas.toDataURL("image/png"));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size must be less than 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === "string") {
        setUploadedImage(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const getFinalSignature = (): string | null => {
    if (activeTab === 0) {
      if (sigCanvas.current?.isEmpty()) return null;
      // Trim whitespace for better fit
      return (
        sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png") || null
      );
    }
    if (activeTab === 1) return generatedStamp;
    if (activeTab === 2) return uploadedImage;
    return null;
  };

  const handleSubmit = async () => {
    const signatureData = getFinalSignature();
    if (!signatureData) {
      toast.error("Please provide a signature first");
      return;
    }

    setLoading(true);
    try {
      await onSign(signatureData);
      // Note: onSign callback is responsible for closing the modal
      // Do NOT call onClose() here as it may reset parent state (e.g., pendingAction)
    } catch (error) {
      console.error("Sign error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 flex justify-between items-center mb-4"
                >
                  <span>Sign Document</span>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                <Tab selectedIndex={activeTab} onChange={setActiveTab}>
                  <Tab.List className="grid grid-cols-3 w-full">
                    <Tab.ListItem>
                      <PenTool className="w-4 h-4 mr-2" /> Draw
                    </Tab.ListItem>
                    <Tab.ListItem>
                      <Stamp className="w-4 h-4 mr-2" /> Digital
                    </Tab.ListItem>
                    <Tab.ListItem>
                      <Upload className="w-4 h-4 mr-2" /> Upload
                    </Tab.ListItem>
                  </Tab.List>

                  <Tab.Panels className="mt-4 min-h-[300px] border rounded-lg bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden">
                    <Tab.Panel className="w-full h-full p-4 flex flex-col items-center">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white w-full h-[200px] relative">
                        <SignatureCanvas
                          ref={sigCanvas}
                          canvasProps={{
                            className: "w-full h-full rounded-lg",
                          }}
                          onEnd={handleDrawEnd}
                        />
                        {isEmpty && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400">
                            <Text>Sign here</Text>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between w-full mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={clearSignature}
                          disabled={isEmpty}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" /> Clear
                        </Button>
                      </div>
                    </Tab.Panel>

                    <Tab.Panel className="w-full h-full p-4 flex flex-col items-center">
                      <div className="flex-1 flex items-center justify-center w-full">
                        {generatedStamp ? (
                          <img
                            src={generatedStamp}
                            alt="Stamp"
                            className="max-w-full max-h-[200px] border shadow-sm bg-white"
                          />
                        ) : (
                          <Text className="text-gray-400">
                            No stamp generated yet
                          </Text>
                        )}
                      </div>
                      <Button
                        className="mt-4"
                        onClick={generateStamp}
                        variant="outline"
                      >
                        <RotateCcw className="w-4 h-4 mr-2" />{" "}
                        {generatedStamp ? "Regenerate" : "Generate Stamp"}
                      </Button>
                    </Tab.Panel>

                    <Tab.Panel className="w-full h-full p-4 flex flex-col items-center">
                      <div className="flex-1 flex items-center justify-center w-full mb-4">
                        {uploadedImage ? (
                          <div className="relative group">
                            <img
                              src={uploadedImage}
                              alt="Upload"
                              className="max-w-full max-h-[200px] border shadow-sm bg-white"
                            />
                            <button
                              onClick={() => setUploadedImage(null)}
                              className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <Upload className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                            <Text className="text-gray-500">
                              Upload signature image (PNG/JPG)
                            </Text>
                            <Text className="text-xs text-gray-400 mt-1">
                              Max 2MB
                            </Text>
                          </div>
                        )}
                      </div>
                      <div className="relative">
                        <Button as="span" variant="outline">
                          Choose File
                        </Button>
                        <input
                          type="file"
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          accept="image/png, image/jpeg"
                          onChange={handleFileUpload}
                        />
                      </div>
                    </Tab.Panel>
                  </Tab.Panels>
                </Tab>

                <div className="mt-6 flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    isLoading={loading}
                    disabled={
                      (activeTab === 0 && isEmpty) ||
                      (activeTab === 1 && !generatedStamp) ||
                      (activeTab === 2 && !uploadedImage) ||
                      loading
                    }
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Sign & Submit
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
