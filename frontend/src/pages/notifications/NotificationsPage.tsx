import { useState } from "react";
import {
  useMyNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@/hooks";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, CheckCheck, Eye, Loader2 } from "lucide-react";
import { formatDate } from "@/utils/date";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function NotificationsPage() {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const {
    data: notificationsResponse,
    isLoading,
    refetch,
  } = useMyNotifications({
    isRead: filter === "unread" ? false : undefined,
  });
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = notificationsResponse?.data?.data || [];
  const unreadCount = notificationsResponse?.data?.unreadCount || 0;

  const handleMarkAsRead = async (notificationId: string) => {
    if (!notificationId || markAsRead.isPending) {
      toast.error("Invalid notification");
      return;
    }

    try {
      await markAsRead.mutateAsync(notificationId);
    } catch (error: any) {
      toast.error("Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    if (markAllAsRead.isPending || unreadCount === 0) {
      return;
    }

    try {
      await markAllAsRead.mutateAsync();
      toast.success("All notifications marked as read");
      refetch();
    } catch (error: any) {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with the latest events and activities
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <Badge variant="default">{unreadCount} Unread</Badge>
          )}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="mr-2 h-4 w-4" />
              )}
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={filter}
        onValueChange={(v) => setFilter(v as "all" | "unread")}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-12">
          <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">
            {filter === "unread"
              ? "No unread notifications"
              : "No notifications"}
          </h3>
          <p className="text-muted-foreground">
            {filter === "unread"
              ? "You're all caught up!"
              : "Check back later for updates"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification: any) => (
            <Card
              key={notification._id}
              className={
                !notification.isRead ? "border-primary/50 bg-primary/5" : ""
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {notification.title}
                      </CardTitle>
                      {!notification.isRead && (
                        <Badge variant="default" className="text-xs">
                          New
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {notification.type}
                      </Badge>
                    </div>
                    <CardDescription>
                      {formatDate(notification.createdAt)}
                    </CardDescription>
                  </div>
                  {!notification.isRead && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkAsRead(notification._id)}
                      disabled={markAsRead.isPending}
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Mark as Read
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-muted-foreground">{notification.message}</p>
                {notification.relatedEvent && (
                  <Button variant="link" className="p-0 h-auto" asChild>
                    <Link to={`/events/${notification.relatedEvent}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Event
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
