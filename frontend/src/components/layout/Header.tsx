import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LogOut,
  Settings,
  User,
  Menu,
  Calendar,
  ClipboardList,
  Users,
  CreditCard,
  Award,
  MessageSquare,
  BarChart,
  Home,
  Shield,
  Bell,
} from "lucide-react";
import { getInitials } from "@/utils/helpers";
import { toast } from "sonner";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";
import * as React from "react";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
    roles: [
      "student",
      "department_organizer",
      "faculty",
      "admin",
      "super_admin",
    ],
  },
  {
    name: "Events",
    href: "/events",
    icon: Calendar,
    roles: [
      "student",
      "department_organizer",
      "faculty",
      "admin",
      "super_admin",
    ],
  },
  // Student-only sections
  {
    name: "My Registrations",
    href: "/registrations",
    icon: ClipboardList,
    roles: ["student"],
  },
  {
    name: "Teams",
    href: "/teams",
    icon: Users,
    roles: ["student"],
  },
  {
    name: "Payments",
    href: "/payments",
    icon: CreditCard,
    roles: ["student"],
  },
  {
    name: "Certificates",
    href: "/certificates",
    icon: Award,
    roles: ["student"],
  },
  {
    name: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
    roles: ["student"],
  },
  // Organizer & Faculty sections
  {
    name: "My Events",
    href: "/organizer/events",
    icon: Calendar,
    roles: ["department_organizer", "faculty"],
  },
  {
    name: "Notifications",
    href: "/notifications",
    icon: Bell,
    roles: [
      "student",
      "department_organizer",
      "faculty",
      "admin",
      "super_admin",
    ],
  },
  // Admin Section
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: BarChart,
    roles: ["admin", "super_admin"],
  },
  {
    name: "Manage Users",
    href: "/admin/users",
    icon: Shield,
    roles: ["admin", "super_admin"],
  },
  {
    name: "All Events",
    href: "/admin/events",
    icon: Calendar,
    roles: ["admin", "super_admin"],
  },
  {
    name: "Payments",
    href: "/payments",
    icon: CreditCard,
    roles: ["admin", "super_admin"],
  },
  {
    name: "Certificates",
    href: "/certificates",
    icon: Award,
    roles: ["admin", "super_admin"],
  },
  {
    name: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
    roles: ["admin", "super_admin"],
  },
];

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  const handleLogout = async () => {
    try {
      logout();
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(user?.role || "")
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex w-full h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Mobile Menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden min-h-[44px] min-w-[44px]"
              >
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle className="text-left">Navigation</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-2 mt-6">
                {filteredNav.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    location.pathname === item.href ||
                    location.pathname.startsWith(item.href + "/");

                  return (
                    <SheetClose asChild key={item.name}>
                      <Link
                        to={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors min-h-[44px]",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        {item.name}
                      </Link>
                    </SheetClose>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="font-bold text-lg sm:text-xl">EventHub</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 sm:h-9 sm:w-9 rounded-full min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0"
              >
                <Avatar className="h-10 w-10 sm:h-9 sm:w-9">
                  <AvatarImage
                    src={user?.profileImage || undefined}
                    alt={user?.fullName}
                  />
                  <AvatarFallback>
                    {getInitials(user?.fullName || "")}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
