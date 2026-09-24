"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Input, Textarea } from "rizzui";
import axios from "@/app/lib/axios";
import { toast } from "react-toastify";

function PageContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const onSubmit = async () => {
    try {
      const contractTypeIdsParam =
        params.get("contractTypeIds") || params.get("contractTypeId") || "";
      const employmentTypesParam =
        params.get("employmentTypes") || params.get("employmentType") || "";
      const designationIdsParam = params.get("designationIds") || "";

      // Parse arrays from query params (support both new array format and old single value format)
      const contractTypeIds = contractTypeIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const employmentTypes = employmentTypesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const designationIds = designationIdsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: any = {
        title,
        description,
        designationIds,
      };

      // Always send arrays to support multiple selections
      // Backend will handle both arrays and single values for backward compatibility
      payload.contractTypeIds = contractTypeIds;

      if (employmentTypes.length > 0) {
        payload.employmentTypes = employmentTypes;
      }

      await axios.post("/contract-templates", payload);
      toast.success("Template created");
      router.push("/tenant/configs/contracts");
    } catch (e) {
      toast.error("Failed to create template");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-xl font-semibold">New Contract Template</h1>
      <div className="bg-white p-4 rounded-xl border space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e: any) => setTitle(e.target.value)}
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e: any) => setDescription(e.target.value)}
        />
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button disabled={!title} onClick={onSubmit}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function NewContractTemplatePage() {
  return (
    <Suspense fallback={<div />}>
      <PageContent />
    </Suspense>
  );
}
