import { Card } from "./Card";
import { Bell } from "lucide-react";

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
}

export const EmptyState = ({ title, message, icon }: EmptyStateProps) => {
  return (
    <Card className="p-8 text-center">
      <div className="flex justify-center mb-4">
        {icon || <Bell className="h-12 w-12 text-gray-400" />}
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500">{message}</p>
    </Card>
  );
};
