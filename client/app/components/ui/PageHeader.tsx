import { ReactNode } from "react";
import { Button } from "rizzui";

interface PageHeaderProps {
  title: string;
  icon?: ReactNode;
  badge?: ReactNode;
  actions?: ReactNode;
}

export const PageHeader = ({
  title,
  icon,
  badge,
  actions,
}: PageHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-3">
        {icon}
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        {badge}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
};
