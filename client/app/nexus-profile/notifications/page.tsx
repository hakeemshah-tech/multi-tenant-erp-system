"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Badge } from "rizzui";
import { Card } from "../../components/ui/Card";
import { NotificationCard } from "../../components/ui/NotificationCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { ErrorAlert } from "../../components/ui/ErrorAlert";
import { PageHeader } from "../../components/ui/PageHeader";
import { FilterButtons } from "../../components/ui/FilterButtons";
import { StatsCard } from "../../components/ui/StatsCard";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationFilter } from "../../types/notification";
import { Bell, X, RefreshCw } from "lucide-react";

const FILTER_OPTIONS = [{ key: "unread", label: "Unread" }];

export default function EmployeeNotificationsPage() {
  const {
    notifications,
    stats,
    loading,
    error,
    filter,
    setFilter,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    markingAsRead,
  } = useNotifications();

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleRefresh = () => {
    fetchNotifications();
  };

  const getEmptyStateMessage = () => {
    return "You don't have any unread notifications.";
  };

  const getStatsCards = () => {
    return [
      {
        title: "Unread",
        value: stats.unread,
        icon: <Bell className="h-6 w-6" />,
        iconBgColor: "bg-blue-100",
        iconColor: "text-blue-600",
      },
    ];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        icon={<Bell className="h-6 w-6 text-gray-700" />}
        badge={stats.unread > 0 ? `${stats.unread} unread` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            {notifications.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {getStatsCards().map((stat, index) => (
          <StatsCard
            key={index}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            iconBgColor={stat.iconBgColor}
            iconColor={stat.iconColor}
          />
        ))}
      </div>

      {/* Filter Buttons */}
      <div className="flex justify-between items-center">
        <FilterButtons
          options={FILTER_OPTIONS}
          activeFilter={filter}
          onFilterChange={(newFilter) =>
            setFilter(newFilter as NotificationFilter)
          }
        />
      </div>

      {/* Error State */}
      {error && <ErrorAlert message={error} />}

      {/* Loading State */}
      {loading && <LoadingSpinner text="Loading notifications..." />}

      {/* Empty State */}
      {!loading && !error && notifications.length === 0 && (
        <EmptyState title="No notifications" message={getEmptyStateMessage()} />
      )}

      {/* Notifications List */}
      {!loading && !error && notifications.length > 0 && (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification._id}
              notification={notification}
              onMarkAsRead={markAsRead}
              isMarkingAsRead={markingAsRead.includes(notification._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
