"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

interface Department {
  _id: string;
  name: string;
  description?: string;
}

interface Designation {
  _id: string;
  name: string;
  departmentIds: Department[];
}

interface DesignationCardListProps {
  designations: Designation[];
  onEdit?: (designation: Designation) => void;
  onDelete?: (designation: Designation) => void;
  deletingId?: string | null;
}

export default function DesignationCardList({
  designations,
  onEdit,
  onDelete,
  deletingId,
}: DesignationCardListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (designations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-center text-muted-foreground">
        <p className="text-lg font-medium">No Data Found</p>
        <p className="text-sm">Try adjusting your search or add new items.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {designations.map((designation) => {
        const isOpen = expanded === designation._id;
        return (
          <div
            key={designation._id}
            className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-all cursor-pointer hover:shadow-md"
            onClick={() => setExpanded(isOpen ? null : designation._id)}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900 mb-1">
                  {designation.name}
                </h2>
                {isOpen && (
                  <>
                    <p className="text-sm text-gray-500 mb-1">
                      Departments Linked
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {designation.departmentIds.map((dep) => (
                        <span
                          key={dep._id}
                          className="border border-blue-600 text-blue-600 text-xs px-3 py-1 rounded-full bg-blue-50"
                        >
                          {dep.name}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(designation);
                  }}
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(designation);
                  }}
                  title="Delete"
                  disabled={deletingId === designation._id}
                >
                  {deletingId === designation._id ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
                <button
                  className="p-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpanded(isOpen ? null : designation._id);
                  }}
                  title="Toggle"
                >
                  {isOpen ? (
                    <ChevronUp size={18} className="text-gray-400" />
                  ) : (
                    <ChevronDown size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
