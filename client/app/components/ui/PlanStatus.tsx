"use client";

interface PlanStatusProps {
  status?: "Active" | "Expired";
  daysLeft?: number;
}

export default function PlanStatus({
  status = "Active",
  daysLeft = 11,
}: PlanStatusProps) {
  return (
    <div className="flex items-center px-6 py-4 rounded-full bg-white shadow-md text-sm">
      <span className="bg-green-600 text-white text-xs font-medium px-2 py-0.5 rounded-full mr-2">
        {status}
      </span>
      <span className="text-[#667085]">
        Your plan will expire in {daysLeft} days
      </span>
    </div>
  );
}
