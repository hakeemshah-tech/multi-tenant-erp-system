import { ReactNode } from "react";
import { Card } from "../ui/Card";

interface StatsCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  iconBgColor: string;
  iconColor: string;
  valueColor?: string;
}

export const StatsCard = ({
  title,
  value,
  icon,
  iconBgColor,
  iconColor,
  valueColor = "text-gray-900",
}: StatsCardProps) => {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-3xl font-bold ${valueColor}`}>{value}</p>
        </div>
        <div
          className={`flex items-center justify-center w-12 h-12 ${iconBgColor} rounded-full`}
        >
          <div className={`h-6 w-6 ${iconColor}`}>{icon}</div>
        </div>
      </div>
    </Card>
  );
};
