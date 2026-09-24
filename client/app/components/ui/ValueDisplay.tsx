import { formatValueForDisplay } from "../../lib/utils/formatters";

interface ValueDisplayProps {
  label: string;
  value: unknown;
  variant: "old" | "new";
}

export const ValueDisplay = ({ label, value, variant }: ValueDisplayProps) => {
  const isOld = variant === "old";
  const bgColor = isOld
    ? "bg-red-50 border-red-200"
    : "bg-green-50 border-green-200";
  const textColor = isOld ? "text-red-800" : "text-green-800";

  return (
    <div className="mb-2">
      <strong className="text-sm text-gray-700">{label}:</strong>
      <div className={`mt-1 p-3 ${bgColor} border rounded-lg`}>
        <span className={`text-sm ${textColor} font-medium`}>
          {formatValueForDisplay(value)}
        </span>
      </div>
    </div>
  );
};
