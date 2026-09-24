"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Table, Input, Select } from "rizzui";
import {
  templateTypesService,
  TemplateType,
} from "@/app/services/templateTypes.service";
import {
  contractTypesService,
  ContractType,
} from "@/app/services/contractTypes.service";
import { toast } from "react-toastify";

export default function TemplateTypesPage() {
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [selectedContractTypeId, setSelectedContractTypeId] = useState<any>("");
  const [items, setItems] = useState<TemplateType[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TemplateType | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });

  const filtered = useMemo(
    () =>
      items.filter((d) =>
        [d.title, d.description || ""]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [items, search]
  );

  const load = async () => {
    const ctId =
      ((selectedContractTypeId as any)?.value ?? selectedContractTypeId) ||
      undefined;
    const [cts, tts] = await Promise.all([
      contractTypesService.list(),
      templateTypesService.list(ctId),
    ]);
    setContractTypes(cts);
    setItems(tts);
  };

  useEffect(() => {
    load();
  }, [selectedContractTypeId, search]);

  const submit = async () => {
    const ctId =
      (selectedContractTypeId as any)?.value ?? selectedContractTypeId;
    if (!ctId) {
      toast.error("Select a Contract Type first");
      return;
    }
    try {
      if (editing) {
        await templateTypesService.update(editing._id, { ...form });
        toast.success("Updated");
      } else {
        await templateTypesService.create({ ...form, contractTypeId: ctId });
        toast.success("Created");
      }
      setForm({ title: "", description: "" });
      setEditing(null);
      load();
    } catch {
      toast.error("Failed to save");
    }
  };

  return null;
}
