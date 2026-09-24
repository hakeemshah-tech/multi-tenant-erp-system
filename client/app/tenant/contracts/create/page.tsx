"use client";

import { useEffect, useState } from "react";
import { Button, Input, Select, Title } from "rizzui";
import {
  contractTypesService,
  ContractType,
} from "@/app/services/contractTypes.service";
import {
  templateTypesService,
  TemplateType,
} from "@/app/services/templateTypes.service";
import { useRouter } from "next/navigation";

export default function CreateContractPage() {
  const router = useRouter();
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [templateTypes, setTemplateTypes] = useState<TemplateType[]>([]);

  const [contractTypeId, setContractTypeId] = useState<any>("");
  const [templateTypeId, setTemplateTypeId] = useState<string>("");

  useEffect(() => {
    contractTypesService.list().then(setContractTypes);
  }, []);

  useEffect(() => {
    const ctId = (contractTypeId as any)?.value ?? contractTypeId;
    if (ctId) {
      templateTypesService.list(ctId).then(setTemplateTypes);
    } else {
      setTemplateTypes([]);
      setTemplateTypeId("");
    }
  }, [contractTypeId]);

  const goToTemplateForm = () => {
    // Placeholder route; implement actual template form later
    router.push(
      `/tenant/contracts/templates/new?contractTypeId=${contractTypeId}&templateTypeId=${templateTypeId}`
    );
  };

  return null;
}
