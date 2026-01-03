import { useState } from "react";
import { Link } from "react-router-dom";
import {
  useMyNotifications,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@/hooks";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Bell, Check, Eye, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notificationsResponse, isLoading } = useMyNotifications({
    limit: 5,
  });
  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = notificationsResponse?.data?.data || [];
  const unreadCount = notificationsResponse?.data?.unreadCount || 0;

  const handleMarkAsRead = async (
    notificationId: string,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!notificationId || markAsRead.isPending) {
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
    } catch (error: any) {
      toast.error("Failed to mark all as read");
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96">
        <div className="flex items-center justify-between px-2 py-2">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsRead.isPending}
              className="h-8 text-xs"
            >
              {markAllAsRead.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Check className="h-3 w-3 mr-1" />
              )}
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <>
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((notification: any) => (
                <DropdownMenuItem
                  key={notification._id}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 cursor-pointer",
                    !notification.isRead && "bg-primary/5"
                  )}
                  asChild
                >
                  <Link
                    to={notification.actionUrl || "/notifications"}
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium line-clamp-1">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(
                            new Date(notification.createdAt),
                            {
                              addSuffix: true,
                            }
                          )}
                        </p>
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 flex-shrink-0"
                          onClick={(e) => handleMarkAsRead(notification._id, e)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </Link>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link
                to="/notifications"
                className="w-full flex items-center justify-center py-2"
                onClick={() => setOpen(false)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View all notifications
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
