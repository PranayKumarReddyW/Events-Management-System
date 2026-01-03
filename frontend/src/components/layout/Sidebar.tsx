import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ClipboardList,
  Users,
  CreditCard,
  Award,
  MessageSquare,
  Bell,
  BarChart,
  Home,
  Shield,
  CheckSquare,
} from "lucide-react";

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
    name: "Event Approvals",
    href: "/admin/approvals",
    icon: CheckSquare,
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

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const filteredNav = navigation.filter((item) =>
    item.roles.includes(user?.role || "")
  );

  return (
    <aside className="hidden lg:fixed lg:left-0 lg:top-16 lg:h-[calc(100vh-4rem)] lg:w-64 lg:border-r lg:bg-background lg:overflow-y-auto lg:block">
      <nav className="flex flex-col gap-1 p-4">
        {filteredNav.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.href ||
            location.pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
