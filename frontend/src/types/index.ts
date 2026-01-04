// Core data types matching backend models

export type UserRole =
  | "student"
  | "department_organizer"
  | "faculty"
  | "admin"
  | "super_admin";

export type EventMode = "online" | "offline" | "hybrid";

export type EventType =
  | "workshop"
  | "seminar"
  | "competition"
  | "hackathon"
  | "conference"
  | "webinar"
  | "meetup"
  | "other";

export type EventStatus =
  | "draft"
  | "published"
  | "ongoing"
  | "completed"
  | "cancelled";

export type EventVisibility =
  | "public"
  | "private"
  | "department_only"
  | "club_only";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type RegistrationStatus =
  | "pending"
  | "confirmed"
  | "waitlisted"
  | "cancelled"
  | "rejected";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "not_required";

export type PaymentGatewayStatus = "pending" | "completed" | "failed";

export type PaymentGateway = "stripe" | "razorpay";

export type RefundStatus = "pending" | "rejected" | "completed" | "failed";

export type CertificateType = "participation" | "winner";

export type NotificationChannel = "in_app" | "email" | "sms" | "push";

export type NotificationPriority = "low" | "normal" | "high";

export type DeliveryStatus = "pending" | "delivered" | "failed";

export type CheckInMethod = "qr" | "manual";

export type FeedbackStatus = "pending" | "approved" | "rejected" | "flagged";

export type TeamStatus = "active" | "locked" | "disbanded";

export type SettingsCategory =
  | "general"
  | "email"
  | "payment"
  | "security"
  | "feature"
  | "ui"
  | "notification"
  | "other";

// User types
export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  in_app: boolean;
}

export interface User {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  profilePicture: string | null;
  profileImage: string | null; // alias for profilePicture
  bio: string | null;
  departmentId: string | null;
  department: string | null;
  yearOfStudy: number | null;
  rollNumber: string | null;
  isActive: boolean;
  emailVerified: boolean;
  notificationPreferences: NotificationPreferences;
  lastLogin: string | null;
}

// Event types
export interface Event {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  title: string;
  description: string;
  rules: string | null;
  agenda: string | null;
  schedule?: Array<{
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    venue?: string;
    speakers?: string[];
  }>;
  registrationDeadline: string;
  startDateTime: string;
  endDateTime: string;
  // Convenience aliases for common usage
  startDate: string; // same as startDateTime
  endDate: string; // same as endDateTime
  venue: string | null;
  eventMode: EventMode;
  meetingLink: string | null;
  eventType: EventType;
  minTeamSize: number;
  maxTeamSize: number;
  teamEvent: boolean; // computed: maxTeamSize > 1
  images: string[];
  bannerImage: string | null;
  requiresApproval: boolean;
  isPaid: boolean;
  amount: number;
  registrationFee: number; // alias for amount
  currency: string;
  eligibility: string | null;
  eligibleYears: number[];
  eligibleDepartments: string[];
  allowExternalStudents: boolean;
  maxParticipants: number | null;
  registeredCount: number;
  registrationCount: number; // alias for registeredCount
  status: EventStatus;
  organizerId: string | User; // Can be populated
  organizer: User; // populated field
  clubId: string | null;
  departmentId: string | null;
  visibility: EventVisibility;
  approvalStatus: ApprovalStatus;
  certificateProvided: boolean;
  registrationsOpen: boolean;
  isRegistered?: boolean; // Whether current user is registered for this event
  // Round management
  rounds?: Array<{
    _id?: string;
    name: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    maxParticipants?: number;
    status: "upcoming" | "ongoing" | "completed";
  }>;
  currentRound?: number;
}

// Team types
export interface Team {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  event: string;
  name: string;
  description: string | null;
  leader: string;
  members: string[];
  maxSize: number;
  status: TeamStatus;
  inviteCode: string;
  currentSize?: number;
  isFull?: boolean;
}

// Registration types
export interface EmergencyContact {
  name: string | null;
  phone: string | null;
  relationship: string | null;
}

export interface EventRegistration {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  registrationNumber: string;
  event: string | Event;
  user: string | User;
  team: string | Team | null;
  emergencyContact: EmergencyContact;
  specialRequirements: string | null;
  participantInfo: Record<string, any> | null;
  registrationDate: string;
  status: RegistrationStatus;
  notes: string | null;
  paymentStatus: PaymentStatus;
  payment: string | Payment | null;
  checkInTime: string | null;
  checkedInBy: string | User | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  certificate: string | null;
  // Round management
  currentRound?: number;
  eliminatedInRound?: number | null;
  advancedToRounds?: number[];
}

// Payment types
export interface Payment {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  user: string | User;
  event: string | Event;
  registration: string | EventRegistration;
  amount: number;
  currency: string;
  paymentGateway: PaymentGateway;
  paymentMethod: "online";
  orderId: string | null;
  transactionId: string | null;
  status: PaymentGatewayStatus;
  gatewayResponse: Record<string, any> | null;
  paidAt: string | null;
  refundAmount: number;
  refundedAt: string | null;
  refund?: Refund | null; // virtual field populated from backend
}

export interface Refund {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  payment: string;
  registration: string;
  event: string;
  user: string;
  amount: number;
  originalAmount: number;
  refundPercentage: number;
  reason: string;
  status: RefundStatus;
  requestedAt: string;
  processedBy: string | null;
  processedAt: string | null;
  rejectionReason: string | null;
  refundTransactionId: string | null;
  gatewayResponse: Record<string, any> | null;
  notes: string | null;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  invoiceNumber: string;
  user: string;
  event: string;
  registration: string;
  payment: string;
  amount: number;
  currency: string;
  items: InvoiceItem[];
  subtotal: number;
  total: number;
  status: "paid";
  paidAt: string;
}

// Certificate types
export interface Certificate {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  certificateNumber: string;
  verificationCode: string;
  user: string;
  event: string;
  registration: string;
  type: CertificateType;
  position: number | null;
  filePath: string;
  issuedBy: string;
  issuedDate: string;
  lastUpdated: string | null;
  downloadCount: number;
}

// Notification types
export interface NotificationDeliveryStatus {
  email: DeliveryStatus;
  sms: DeliveryStatus;
  push: DeliveryStatus;
  in_app: DeliveryStatus;
}

export interface Notification {
  _id: string;
  createdAt: string;
  updatedAt: string;
  recipient: string;
  title: string;
  message: string;
  type: string;
  relatedEvent: string | null;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  scheduledFor: string;
  sentBy: string | null;
  deliveryStatus: NotificationDeliveryStatus;
  sentAt: string | null;
  isRead: boolean;
  readAt: string | null;
}

// Attendance types
export interface Attendance {
  _id: string;
  createdAt: string;
  updatedAt: string;
  event: string;
  user: string;
  checkInTime: string;
  checkOutTime: string | null;
  duration: number;
  checkInMethod: CheckInMethod;
  location: string | null;
  deviceInfo: Record<string, any> | null;
  notes: string | null;
  markedBy: string | null;
}

// Feedback types
export interface Feedback {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  event: string;
  submittedBy: string;
  overallRating: number;
  contentQuality: number | null;
  organizationRating: number | null;
  venueRating: number | null;
  speakerRating: number | null;
  comment: string | null;
  suggestions: string | null;
  wouldRecommend: boolean;
  anonymous: boolean;
  submittedAt: string;
  status: FeedbackStatus;
}

// Settings types
export interface Settings {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  key: string;
  value: any;
  category: SettingsCategory;
  description: string | null;
  isPublic: boolean;
  updatedBy: string | null;
}

// Role Permission types
export interface RolePermission {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  role: UserRole;
  permissions: string[];
  description: string | null;
  isActive: boolean;
}

// Audit Log types
export interface AuditLog {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  action: string;
  resource: string;
  resourceId: string | null;
  performedBy: string;
  changes: Record<string, any> | null;
  details: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

// Analytics types
export interface Analytics {
  _id: string;
  __v: number;
  createdAt: string;
  updatedAt: string;
  eventType: string;
  metricType: string;
  metricValue: number;
  metadata: Record<string, any> | null;
  relatedEvent: string | null;
  timestamp: string;
}

// API Response types
export interface Pagination {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

export interface ValidationError {
  field: string;
  message: string;
  type: string;
}

export interface ApiError {
  message: string;
  response?: {
    data?: {
      message?: string;
      errors?: ValidationError[];
      error?: string;
    };
    status?: number;
  };
  status?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: ValidationError[];
  pagination?: Pagination;
}

export interface TeamsResponse {
  success: boolean;
  data: Team[];
  pagination?: Pagination;
}

export interface AuthResponse {
  user: User;
  token: string;
  sessionId: string;
}
