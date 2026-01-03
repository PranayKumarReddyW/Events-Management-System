import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EventsPage from "@/pages/events/EventsPage";
import EventDetailPage from "@/pages/events/EventDetailPage";
import EventTeamsPage from "@/pages/events/EventTeamsPage";
import MyRegistrationsPage from "@/pages/registrations/MyRegistrationsPage";
import { Loader2 } from "lucide-react";
import DashboardPage from "@/pages/DashboardPage";
import CreateEventPage from "@/pages/events/CreateEventPage";
import TeamsPage from "@/pages/teams/TeamsPage";
import CreateTeamPage from "@/pages/teams/CreateTeamPage";
import TeamDetailPage from "@/pages/teams/TeamDetailPage";
import CertificatesPage from "@/pages/certificates/CertificatesPage";
import PaymentsPage from "@/pages/payments/PaymentsPage";
import FeedbackPage from "@/pages/feedback/FeedbackPage";
import NotificationsPage from "@/pages/notifications/NotificationsPage";
import ProfilePage from "@/pages/profile/ProfilePage";
import SettingsPage from "@/pages/settings/SettingsPage";
import ChangePasswordPage from "@/pages/settings/ChangePasswordPage";
import AnalyticsPage from "@/pages/admin/AnalyticsPage";
import UsersPage from "@/pages/admin/UsersPage";
import EventsManagementPage from "@/pages/admin/EventsManagementPage";
import EventApprovalsPage from "@/pages/admin/EventApprovalsPage";
import ParticipantsPage from "@/pages/events/ParticipantsPage";
import OrganizerEventsPage from "@/pages/organizer/OrganizerEventsPage";
import ResultsManagementPage from "@/pages/organizer/ResultsManagementPage";
import EventAnalyticsPage from "@/pages/events/EventAnalyticsPage";
import NotFoundPage from "@/pages/NotFoundPage";
import UnauthorizedPage from "@/pages/UnauthorizedPage";

// Protected route wrapper
function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (requiredRole && !requiredRole.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route
        path="/auth/reset-password/:token"
        element={<ResetPasswordPage />}
      />
      <Route path="/auth/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />

        {/* Event routes */}
        <Route path="events" element={<EventsPage />} />
        <Route
          path="events/create"
          element={
            <ProtectedRoute requiredRole={["department_organizer", "faculty"]}>
              <CreateEventPage />
            </ProtectedRoute>
          }
        />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="events/:id/teams" element={<EventTeamsPage />} />
        <Route
          path="events/:id/edit"
          element={
            <ProtectedRoute requiredRole={["department_organizer", "faculty"]}>
              <CreateEventPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="events/:eventId/participants"
          element={
            <ProtectedRoute requiredRole={["department_organizer", "faculty"]}>
              <ParticipantsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="events/:eventId/results"
          element={
            <ProtectedRoute requiredRole={["department_organizer", "faculty"]}>
              <ResultsManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="events/:eventId/analytics"
          element={
            <ProtectedRoute
              requiredRole={[
                "department_organizer",
                "faculty",
                "admin",
                "super_admin",
              ]}
            >
              <EventAnalyticsPage />
            </ProtectedRoute>
          }
        />

        {/* Organizer/Faculty routes */}
        <Route
          path="organizer/events"
          element={
            <ProtectedRoute requiredRole={["department_organizer", "faculty"]}>
              <OrganizerEventsPage />
            </ProtectedRoute>
          }
        />

        {/* Registration routes - Students only */}
        <Route
          path="registrations"
          element={
            <ProtectedRoute requiredRole={["student"]}>
              <MyRegistrationsPage />
            </ProtectedRoute>
          }
        />

        {/* Team routes - Students only */}
        <Route
          path="teams"
          element={
            <ProtectedRoute requiredRole={["student"]}>
              <TeamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="teams/create"
          element={
            <ProtectedRoute requiredRole={["student"]}>
              <CreateTeamPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="teams/:id"
          element={
            <ProtectedRoute requiredRole={["student"]}>
              <TeamDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Certificates - Students and Admins only */}
        <Route
          path="certificates"
          element={
            <ProtectedRoute requiredRole={["student", "admin", "super_admin"]}>
              <CertificatesPage />
            </ProtectedRoute>
          }
        />

        {/* Payments - Students and Admins only */}
        <Route
          path="payments"
          element={
            <ProtectedRoute requiredRole={["student", "admin", "super_admin"]}>
              <PaymentsPage />
            </ProtectedRoute>
          }
        />

        {/* Feedback - Students and Admins only */}
        <Route
          path="feedback"
          element={
            <ProtectedRoute requiredRole={["student", "admin", "super_admin"]}>
              <FeedbackPage />
            </ProtectedRoute>
          }
        />

        {/* Common routes for all authenticated users */}
        <Route
          path="settings/change-password"
          element={<ChangePasswordPage />}
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />

        {/* Admin routes */}
        <Route
          path="admin/analytics"
          element={
            <ProtectedRoute requiredRole={["admin", "super_admin"]}>
              <AnalyticsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute requiredRole={["admin", "super_admin"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/events"
          element={
            <ProtectedRoute requiredRole={["admin", "super_admin"]}>
              <EventsManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/approvals"
          element={
            <ProtectedRoute requiredRole={["admin", "super_admin"]}>
              <EventApprovalsPage />
            </ProtectedRoute>
          }
        />

        {/* 404 route */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
