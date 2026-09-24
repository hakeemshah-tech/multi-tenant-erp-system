import { Card } from "./Card";

interface ErrorAlertProps {
  message: string;
  className?: string;
}

export const ErrorAlert = ({ message, className = "" }: ErrorAlertProps) => {
  return (
    <Card className={`p-4 mb-4 border-red-200 bg-red-50 ${className}`}>
      <p className="text-red-800">{message}</p>
    </Card>
  );
};
