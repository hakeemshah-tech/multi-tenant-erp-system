import { ReactNode } from "react";
import { cn } from "@/lib/utils"; // if you're using classNames helper

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: string; // e.g., "p-4", "p-6"
  rounded?: string; // e.g., "rounded-xl"
  shadow?: string; // e.g., "shadow-sm"
  border?: boolean;
}

export function Card({
  children,
  className,
  padding = "p-6",
  rounded = "rounded-xl",
  shadow = "shadow-sm",
  border = true,
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white",
        padding,
        rounded,
        shadow,
        border && "border border-gray-200",
        className
      )}
    >
      {children}
    </div>
  );
}
