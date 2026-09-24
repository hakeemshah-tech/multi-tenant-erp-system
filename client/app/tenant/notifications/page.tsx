"use client";

import { Button } from "rizzui";
import { Card } from "../../components/ui/Card";
import { StatsCard } from "../../components/ui/StatsCard";
import { FilterButtons } from "../../components/ui/FilterButtons";
import { NotificationCard } from "../../components/ui/NotificationCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { LoadingSpinner } from "../../components/ui/LoadingSpinner";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorAlert } from "../../components/ui/ErrorAlert";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationFilter } from "../../types/notification";
import { Bell, CheckCheck, RefreshCw, Filter, X } from "lucide-react";

const FILTER_OPTIONS = [{ key: "unread", label: "Unread" }];

export default function NotificationsPage() {
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
    loadMore,
    hasMore,
    markingAsRead,
  } = useNotifications();

  const handleMarkAsRead = async (id: string) => {
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  const handleLoadMore = () => {
    loadMore();
  };

  const handleRefresh = () => {
    fetchNotifications();
  };

  const getEmptyStateMessage = () => {
    return "You don't have any unread notifications.";
  };

  return (
    <div className="p-6 mx-auto">
      {/* Header */}
      <PageHeader
        title="Notifications"
        icon={<Bell className="h-6 w-6 text-gray-700" />}
        badge={
          stats.unread > 0 ? (
            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-sm font-medium">
              {stats.unread} unread
            </span>
          ) : undefined
        }
        actions={
          <>
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

            {stats.unread > 0 && (
              <Button variant="outline" size="sm" onClick={handleMarkAllAsRead}>
                <X className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            )}
          </>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatsCard
          title="Total"
          value={stats.total}
          icon={<Bell className="h-6 w-6" />}
          iconBgColor="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatsCard
          title="Unread"
          value={stats.unread}
          icon={<CheckCheck className="h-6 w-6" />}
          iconBgColor="bg-orange-100"
          iconColor="text-orange-600"
          valueColor="text-orange-600"
        />
        <StatsCard
          title="Employee Changes"
          value={stats.employeeDataChanges}
          icon={<Bell className="h-6 w-6" />}
          iconBgColor="bg-green-100"
          iconColor="text-green-600"
          valueColor="text-green-600"
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="h-4 w-4 text-gray-500" />
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

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <Card className="p-8">
          <LoadingSpinner size="md" text="Loading notifications..." />
        </Card>
      ) : notifications.length === 0 ? (
        <EmptyState title="No notifications" message={getEmptyStateMessage()} />
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification._id}
              notification={notification}
              onMarkAsRead={handleMarkAsRead}
              isMarkingAsRead={markingAsRead.includes(notification._id)}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && notifications.length > 0 && (
        <div className="flex justify-center mt-6">
          <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
            {loading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
