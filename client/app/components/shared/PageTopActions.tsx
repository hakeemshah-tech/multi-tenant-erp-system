"use client";

import { Input, Button } from "rizzui";
import { Search, Filter } from "lucide-react";

interface PageTopActionsProps {
  search: string;
  onSearchChange: (value: string) => void;
  onAddClick: () => void;
  onFilterClick: () => void;
  addLabel?: string;
  placeholder?: string;
  hideAddButton?: boolean; // Hide "Add" button based on permissions
}

export default function PageTopActions({
  search,
  onSearchChange,
  onAddClick,
  onFilterClick,
  addLabel = "Add",
  placeholder = "Search...",
  hideAddButton = false,
}: PageTopActionsProps) {
  return (
    <div className="w-full flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Field */}
      <div className="relative w-full sm:max-w-sm">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
          size={18}
        />
        <Input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          inputClassName="w-full pl-10 pr-4 py-2 rounded-full shadow-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:justify-end">
        <Button
          variant="outline"
          className="rounded-full flex items-center gap-2 text-sm px-5 py-2 border-gray-300 hover:border-blue-500 hover:text-blue-600 transition-colors"
          onClick={onFilterClick}
        >
          <Filter size={16} />
          Select Filter
        </Button>

        {!hideAddButton && (
          <Button
            className="rounded-full bg-blue-600 text-white px-6 py-2 text-sm hover:bg-blue-700 transition-colors shadow-md"
            onClick={onAddClick}
          >
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
