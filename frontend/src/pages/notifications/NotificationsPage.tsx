import { useMyNotifications, useMarkNotificationAsRead } from "@/hooks";
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
import { Bell, Check, Eye } from "lucide-react";
import { formatDate } from "@/utils/date";
import { toast } from "sonner";

export default function NotificationsPage() {
  const { data: notificationsResponse, isLoading } = useMyNotifications();
  const markAsRead = useMarkNotificationAsRead();

  const notifications = notificationsResponse?.data?.data || [];
  const unreadCount = notificationsResponse?.data?.unreadCount || 0;

  const handleMarkAsRead = async (notificationId: string) => {
    // NULL CHECK: Validate notificationId
    if (!notificationId) {
      toast.error("Invalid notification");
      return;
    }

    // DOUBLE-CLICK PREVENTION: Check pending state
    if (markAsRead.isPending) {
      return;
    }

    try {
      await markAsRead.mutateAsync(notificationId);
      toast.success("Notification marked as read");
    } catch (error: any) {
      toast.error("Failed to mark notification as read");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated with the latest events and activities
          </p>
        </div>
        {unreadCount > 0 && (
          <Badge variant="default">{unreadCount} Unread</Badge>
        )}
      </div>

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
          <h3 className="mt-4 text-lg font-semibold">No notifications</h3>
          <p className="text-muted-foreground">
            You're all caught up! Check back later for updates
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification: any) => (
            <Card
              key={notification._id}
              className={!notification.isRead ? "border-primary/50" : ""}
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
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Mark as Read
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{notification.message}</p>
                {notification.actionUrl && (
                  <Button variant="link" className="mt-2 p-0" asChild>
                    <a href={notification.actionUrl}>
                      <Eye className="mr-2 h-4 w-4" />
                      View Details
                    </a>
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
