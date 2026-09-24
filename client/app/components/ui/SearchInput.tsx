"use client";

import { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/app/lib/utils";

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export default function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <div
      className={cn(
        "flex items-center w-full max-w-sm bg-[#F5F7FB] rounded-full px-4 py-2",
        className
      )}
    >
      <Search className="w-4 h-4 text-[#8CA1C3] mr-2" />
      <input
        type="text"
        className="w-full bg-transparent text-sm text-[#8CA1C3] placeholder-[#8CA1C3] focus:outline-none"
        placeholder="Search for something"
        {...props}
      />
    </div>
  );
}
