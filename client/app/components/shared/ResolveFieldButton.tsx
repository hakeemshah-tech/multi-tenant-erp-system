"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Button } from "rizzui";

export function ResolveFieldButton({
  onClick,
  tooltip = "Resolve across Organisations / main profile",
}: {
  onClick: () => void;
  tooltip?: string;
}) {
  return (
    <Button
      size="xs"
      variant="outline"
      className="!px-2 !py-1 border-amber-300 text-amber-700 hover:bg-amber-50"
      onClick={onClick}
      title={tooltip}
    >
      <ExclamationTriangleIcon className="h-4 w-4" />
    </Button>
  );
}
