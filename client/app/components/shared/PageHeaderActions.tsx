"use client";

import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Filter, Search } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderActionsProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAddClick: () => void;
  onFilterClick?: () => void;
  addLabel?: string;
  filterLabel?: string;
  placeholder?: string;
  children?: ReactNode;
}

export const PageHeaderActions = ({
  search,
  onSearchChange,
  onAddClick,
  onFilterClick,
  addLabel = "Add",
  filterLabel = "Select Filter",
  placeholder = "Search...",
  children,
}: PageHeaderActionsProps) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 w-full mb-6">
      {/* Search Input with Icon */}
      <div className="relative w-full max-w-sm">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          size={18}
        />
        <Input
          type="text"
          placeholder={placeholder}
          className="pl-10 pr-4 py-2 rounded-full bg-[#fff] text-muted-foreground w-full"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap justify-end gap-3 items-center w-full sm:w-auto">
        {onFilterClick && (
          <Button
            variant="outline"
            className="flex items-center gap-2 rounded-full text-muted-foreground border-muted"
            onClick={onFilterClick}
          >
            <Filter size={16} /> {filterLabel}
          </Button>
        )}
        <Button
          className="rounded-full px-6 bg-[#1509FA] text-white hover:bg-[#0e07b8]"
          onClick={onAddClick}
        >
          {addLabel}
        </Button>
        {children}
      </div>
    </div>
  );
};
