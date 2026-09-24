"use client";

import { useEffect, useState } from "react";
import { Button, Table, Input } from "rizzui";
import {
  contractTypesService,
  ContractType,
} from "@/app/services/contractTypes.service";
import { toast } from "react-toastify";

export default function ContractTypesPage() {
  const [items, setItems] = useState<ContractType[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ContractType | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });

  const load = async () => {
    const data = await contractTypesService.list();
    setItems(
      data.filter((d) =>
        [d.title, d.description || ""]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    );
  };

  useEffect(() => {
    load();
  }, [search]);

  const submit = async () => {
    try {
      if (editing) {
        await contractTypesService.update(editing._id, form);
        toast.success("Updated");
      } else {
        await contractTypesService.create(form);
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
