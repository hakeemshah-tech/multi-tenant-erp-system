"use client";

import { useRouter } from "next/navigation";
import { Button } from "rizzui";
import { Card } from "@/app/components/ui/Card";
import {
  Users,
  Briefcase,
  ClipboardCheck,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  User,
  FileText,
  Calendar,
  ArrowRight,
  Building,
  Plus,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();

  // Dummy data
  const stats = [
    {
      title: "Total Employees",
      value: "247",
      change: "+12%",
      changeType: "positive" as const,
      icon: Users,
      color: "blue",
      link: "/tenant/employees",
    },
    {
      title: "Active Positions",
      value: "18",
      change: "+3",
      changeType: "positive" as const,
      icon: Briefcase,
      color: "green",
      link: "/tenant/job-titles",
    },
    {
      title: "Pending Approvals",
      value: "8",
      change: "-2",
      changeType: "negative" as const,
      icon: ClipboardCheck,
      color: "orange",
      link: "/tenant/recruitment/contract-approvals",
    },
    {
      title: "Document Compliance",
      value: "94%",
      change: "+2%",
      changeType: "positive" as const,
      icon: CheckCircle,
      color: "purple",
      link: "/tenant/configs/documents",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: "employee_added",
      message: "John Doe joined as Software Engineer",
      time: "2 hours ago",
      icon: User,
      color: "blue",
    },
    {
      id: 2,
      type: "document_expiring",
      message: "5 documents expiring in the next 30 days",
      time: "4 hours ago",
      icon: AlertCircle,
      color: "orange",
    },
    {
      id: 3,
      type: "contract_approved",
      message: "Sarah Smith's contract has been approved",
      time: "1 day ago",
      icon: CheckCircle,
      color: "green",
    },
    {
      id: 4,
      type: "profile_updated",
      message: "Michael Johnson updated their profile",
      time: "2 days ago",
      icon: FileText,
      color: "purple",
    },
  ];

  const quickActions = [
    {
      title: "Add Employee",
      description: "Onboard a new team member",
      icon: User,
      color: "blue",
      link: "/tenant/employees/add",
    },
    {
      title: "Create Position",
      description: "Add a new job position",
      icon: Briefcase,
      color: "green",
      link: "/tenant/job-titles",
    },
    {
      title: "Review Contracts",
      description: "Check pending approvals",
      icon: ClipboardCheck,
      color: "orange",
      link: "/tenant/recruitment/contract-approvals",
    },
    {
      title: "Manage Documents",
      description: "Configure document requirements",
      icon: FileText,
      color: "purple",
      link: "/tenant/configs/documents",
    },
  ];

  const employeeStatusBreakdown = [
    { status: "Onboard", count: 198, percentage: 80, color: "bg-blue-500" },
    { status: "On Leave", count: 12, percentage: 5, color: "bg-yellow-500" },
    { status: "Probation", count: 25, percentage: 10, color: "bg-orange-500" },
    { status: "Terminated", count: 12, percentage: 5, color: "bg-red-500" },
  ];

  const recentEmployees = [
    {
      id: 1,
      name: "John Doe",
      position: "Software Engineer",
      department: "Engineering",
      joinDate: "2024-01-15",
      status: "Onboard",
    },
    {
      id: 2,
      name: "Jane Smith",
      position: "HR Manager",
      department: "Human Resources",
      joinDate: "2024-01-14",
      status: "Onboard",
    },
    {
      id: 3,
      name: "Mike Johnson",
      position: "Product Designer",
      department: "Design",
      joinDate: "2024-01-13",
      status: "Probation",
    },
    {
      id: 4,
      name: "Sarah Williams",
      position: "Marketing Specialist",
      department: "Marketing",
      joinDate: "2024-01-12",
      status: "Onboard",
    },
  ];

  const getIconColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: "text-blue-600 bg-blue-100",
      green: "text-green-600 bg-green-100",
      orange: "text-orange-600 bg-orange-100",
      purple: "text-purple-600 bg-purple-100",
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Welcome back! Here's what's happening with your organization.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar className="w-4 h-4" />
          <span>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card
              key={stat.title}
              className="p-6 bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(stat.link)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">
                    {stat.title}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-3xl font-bold text-gray-900">
                      {stat.value}
                    </h3>
                    <span
                      className={`text-sm font-medium ${
                        stat.changeType === "positive"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {stat.change}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg ${getIconColor(stat.color)}`}>
                  <IconComponent className="w-6 h-6" />
                </div>
              </div>
              <div className="mt-4 flex items-center text-sm text-gray-500">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span>vs last month</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          {/* Employee Status Breakdown */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Employee Status Overview
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/tenant/employees")}
                className="flex items-center gap-2"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              {employeeStatusBreakdown.map((item) => (
                <div key={item.status}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      {item.status}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {item.count} employees
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`${item.color} h-2.5 rounded-full transition-all`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent Employees */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Recent Employees
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/tenant/employees")}
                className="flex items-center gap-2"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Position
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Department
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Join Date
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() =>
                        router.push(`/tenant/employees/${employee.id}`)
                      }
                    >
                      <td className="py-3 px-4 text-sm font-medium text-gray-900">
                        {employee.name}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {employee.position}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {employee.department}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {new Date(employee.joinDate).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            employee.status === "Onboard"
                              ? "bg-blue-100 text-blue-800"
                              : employee.status === "Probation"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {employee.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column - 1/3 width */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Quick Actions
            </h2>
            <div className="space-y-3">
              {quickActions.map((action) => {
                const IconComponent = action.icon;
                return (
                  <button
                    key={action.title}
                    onClick={() => router.push(action.link)}
                    className="w-full p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${getIconColor(action.color)}`}
                      >
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600">
                          {action.title}
                        </h3>
                        <p className="text-xs text-gray-600 mt-1">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 mt-1" />
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Recent Activity
            </h2>
            <div className="space-y-4">
              {recentActivities.map((activity) => {
                const IconComponent = activity.icon;
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0"
                  >
                    <div
                      className={`p-2 rounded-lg ${getIconColor(activity.color)}`}
                    >
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={() => router.push("/tenant/audit")}
            >
              View All Activity
            </Button>
          </Card>

          {/* Document Compliance Chart */}
          <Card className="p-6 bg-white rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Document Compliance
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  Overall Compliance
                </span>
                <span className="text-2xl font-bold text-green-600">94%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full"
                  style={{ width: "94%" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-xs text-gray-600 mb-1">Complete</p>
                  <p className="text-lg font-semibold text-gray-900">232</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 mb-1">Pending</p>
                  <p className="text-lg font-semibold text-orange-600">15</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => router.push("/tenant/configs/documents")}
              >
                Manage Documents
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
