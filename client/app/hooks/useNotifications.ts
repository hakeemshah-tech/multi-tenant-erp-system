import { useState, useEffect, useCallback } from "react";
import axiosInstance from "@/app/lib/axios";
import {
  Notification,
  NotificationStats,
  NotificationFilter,
} from "../types/notification";

interface UseNotificationsReturn {
  notifications: Notification[];
  stats: NotificationStats;
  loading: boolean;
  error: string | null;
  filter: NotificationFilter;
  setFilter: (filter: NotificationFilter) => void;
  fetchNotifications: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMore: () => void;
  hasMore: boolean;
  markingAsRead: string[];
}

export const useNotifications = (): UseNotificationsReturn => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    employeeDataChanges: 0,
    fieldChangeRequests: 0,
    fieldChangeApproved: 0,
    fieldChangeRejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>("unread");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [markingAsRead, setMarkingAsRead] = useState<string[]>([]);

  const limit = 20;

  const fetchNotifications = useCallback(
    async (
      pageNum: number = 1,
      reset: boolean = false,
      currentFilter: NotificationFilter = filter
    ) => {
      try {
        setLoading(true);
        setError(null);

        const params: Record<string, unknown> = {
          limit,
          skip: (pageNum - 1) * limit,
        };

        // Only filter by read status, not by type
        if (currentFilter === "unread") {
          params.isRead = false;
        }

        const response = await axiosInstance.get("/notifications", { params });
        const newNotifications = response.data.data || [];

        if (reset) {
          setNotifications(newNotifications);
        } else {
          setNotifications((prev) => [...prev, ...newNotifications]);
        }

        setHasMore(newNotifications.length === limit);
        setPage(pageNum);
      } catch (err: unknown) {
        console.error("Error fetching notifications:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load notifications";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [filter]
  );

  const fetchStats = async () => {
    try {
      const response = await axiosInstance.get("/notifications/stats");
      setStats(
        response.data.data || {
          total: 0,
          unread: 0,
          employeeDataChanges: 0,
          fieldChangeRequests: 0,
          fieldChangeApproved: 0,
          fieldChangeRejected: 0,
        }
      );
    } catch (err: unknown) {
      console.error("Error fetching notification stats:", err);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      setMarkingAsRead((prev) => [...prev, notificationId]);

      // Call the API to mark the notification as read
      await axiosInstance.post("/notifications/mark-read", {
        notificationIds: [notificationId],
      });

      // Remove from UI after successful API call
      setNotifications((prev) =>
        prev.filter((notif) => notif._id !== notificationId)
      );

      // Update stats
      setStats((prev) => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1),
      }));
    } catch (err: unknown) {
      console.error("Error marking notification as read:", err);
    } finally {
      setMarkingAsRead((prev) => prev.filter((id) => id !== notificationId));
    }
  };

  const markAllAsRead = async () => {
    try {
      // Get all notification IDs
      const notificationIds = notifications.map((notif) => notif._id);

      if (notificationIds.length === 0) return;

      // Call the API to mark all notifications as read
      await axiosInstance.post("/notifications/mark-read", {
        notificationIds,
      });

      // Clear the UI after successful API call
      setNotifications([]);

      // Update stats
      setStats((prev) => ({
        ...prev,
        unread: 0,
      }));
    } catch (err: unknown) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchNotifications(page + 1, false);
    }
  };

  const handleFilterChange = (newFilter: NotificationFilter) => {
    setFilter(newFilter);
    setPage(1);
    setHasMore(true);
    fetchNotifications(1, true, newFilter);
  };

  const refreshNotifications = () => {
    fetchNotifications(1, true);
    fetchStats();
  };

  useEffect(() => {
    fetchNotifications(1, true);
    fetchStats();
  }, [fetchNotifications]);

  return {
    notifications,
    stats,
    loading,
    error,
    filter,
    setFilter: handleFilterChange,
    fetchNotifications: refreshNotifications,
    markAsRead,
    markAllAsRead,
    loadMore,
    hasMore,
    markingAsRead,
  };
};
