# Event Management System API (v1)

Base URL: `/api/v1`

## Authentication

All protected endpoints require:

- Header: `Authorization: Bearer <JWT>`

## Standard Response Envelope

Most endpoints respond using:

```json
{
  "success": true,
  "message": "optional human message",
  "data": {},
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 10 }
}
```

Errors (validation and app errors) typically respond using:

```json
{
  "success": false,
  "message": "Error message",
  "errors": [
    { "field": "field.path", "message": "Validation failed", "type": "..." }
  ]
}
```

## Common Types

### MongoDB Document Fields (present on all Mongoose documents)

- `_id`: `string` (ObjectId)
- `__v`: `number`
- `createdAt`: `string` (ISO datetime)
- `updatedAt`: `string` (ISO datetime)

## Data Models (Source of Truth)

These schemas reflect the backend models after alignment with controller logic.

### User

- `_id`, `__v`, `createdAt`, `updatedAt`
- `fullName`: `string`
- `email`: `string`
- `phone`: `string | null`
- `role`: `"student" | "organizer" | "admin" | "super_admin" | "faculty" | "club_lead"`
- `profilePicture`: `string | null`
- `bio`: `string | null`
- `departmentId`: `string | null` (ObjectId → Department)
- `department`: `string | null`
- `yearOfStudy`: `number | null`
- `rollNumber`: `string | null`
- `isActive`: `boolean`
- `emailVerified`: `boolean`
- `notificationPreferences`:
  - `email`: `boolean`
  - `sms`: `boolean`
  - `push`: `boolean`
  - `in_app`: `boolean`
- `lastLogin`: `string | null` (ISO datetime)

### Event

- `_id`, `__v`, `createdAt`, `updatedAt`
- `title`: `string`
- `description`: `string`
- `rules`: `string | null`
- `registrationDeadline`: `string` (ISO datetime)
- `startDateTime`: `string` (ISO datetime)
- `endDateTime`: `string` (ISO datetime)
- `venue`: `string | null`
- `eventMode`: `"online" | "offline" | "hybrid"`
- `meetingLink`: `string | null`
- `eventType`: `"workshop" | "seminar" | "competition" | "hackathon" | "conference" | "webinar" | "meetup" | "other"`
- `minTeamSize`: `number`
- `maxTeamSize`: `number`
- `images`: `string[]`
- `bannerImage`: `string | null`
- `requiresApproval`: `boolean`
- `isPaid`: `boolean`
- `amount`: `number`
- `currency`: `string` (default `"INR"`)
- `eligibility`: `string | null`
- `maxParticipants`: `number | null`
- `registeredCount`: `number`
- `status`: `"draft" | "published" | "cancelled" | "completed"`
- `organizerId`: `string` (ObjectId → User)
- `clubId`: `string | null` (ObjectId → Club)
- `departmentId`: `string | null` (ObjectId → Department)
- `visibility`: `"public" | "private" | "department_only" | "club_only"`
- `approvalStatus`: `"pending" | "approved" | "rejected"`
- `certificateProvided`: `boolean`

### Team

- `_id`, `__v`, `createdAt`, `updatedAt`
- `event`: `string` (ObjectId → Event)
- `name`: `string`
- `description`: `string | null`
- `leader`: `string` (ObjectId → User)
- `members`: `string[]` (ObjectId → User)
- `maxSize`: `number`
- `status`: `"active" | "locked" | "disbanded"`
- `inviteCode`: `string`
- Virtuals:
  - `currentSize`: `number`
  - `isFull`: `boolean`

### EventRegistration

- `_id`, `__v`, `createdAt`, `updatedAt`
- `registrationNumber`: `string` (e.g. `REG-2025-000001`)
- `event`: `string` (ObjectId → Event)
- `user`: `string` (ObjectId → User)
- `team`: `string | null` (ObjectId → Team)
- `emergencyContact`:
  - `name`: `string | null`
  - `phone`: `string | null`
  - `relationship`: `string | null`
- `specialRequirements`: `string | null`
- `participantInfo`: `object | null`
- `registrationDate`: `string` (ISO datetime)
- `status`: `"pending" | "confirmed" | "waitlisted" | "cancelled" | "rejected"`
- `notes`: `string | null`
- `paymentStatus`: `"pending" | "paid" | "failed" | "refund_pending" | "refunded" | "not_required"`
- `payment`: `string | null` (ObjectId → Payment)
- `checkInTime`: `string | null` (ISO datetime)
- `checkedInBy`: `string | null` (ObjectId → User)
- `cancelledAt`: `string | null` (ISO datetime)
- `cancellationReason`: `string | null`
- `certificate`: `string | null` (ObjectId → Certificate)

### Payment

- `_id`, `__v`, `createdAt`, `updatedAt`
- `user`: `string` (ObjectId → User)
- `event`: `string` (ObjectId → Event)
- `registration`: `string` (ObjectId → EventRegistration)
- `amount`: `number`
- `currency`: `string`
- `paymentGateway`: `"stripe" | "razorpay"`
- `paymentMethod`: `"online"`
- `orderId`: `string | null`
- `transactionId`: `string | null`
- `status`: `"pending" | "completed" | "failed"`
- `gatewayResponse`: `object | null`
- `paidAt`: `string | null` (ISO datetime)
- `refundAmount`: `number`
- `refundedAt`: `string | null` (ISO datetime)

### Refund

- `_id`, `__v`, `createdAt`, `updatedAt`
- `payment`: `string` (ObjectId → Payment)
- `registration`: `string` (ObjectId → EventRegistration)
- `event`: `string` (ObjectId → Event)
- `user`: `string` (ObjectId → User)
- `amount`: `number`
- `originalAmount`: `number`
- `refundPercentage`: `number` (0..100)
- `reason`: `string`
- `status`: `"pending" | "rejected" | "completed" | "failed"`
- `requestedAt`: `string` (ISO datetime)
- `processedBy`: `string | null` (ObjectId → User)
- `processedAt`: `string | null` (ISO datetime)
- `rejectionReason`: `string | null`
- `refundTransactionId`: `string | null`
- `gatewayResponse`: `object | null`
- `notes`: `string | null`

### Invoice

- `_id`, `__v`, `createdAt`, `updatedAt`
- `invoiceNumber`: `string`
- `user`: `string` (ObjectId → User)
- `event`: `string` (ObjectId → Event)
- `registration`: `string` (ObjectId → EventRegistration)
- `payment`: `string` (ObjectId → Payment)
- `amount`: `number`
- `currency`: `string`
- `items`: `{ description: string, quantity: number, unitPrice: number, total: number }[]`
- `subtotal`: `number`
- `total`: `number`
- `status`: `"paid"`
- `paidAt`: `string` (ISO datetime)

### Certificate

- `_id`, `__v`, `createdAt`, `updatedAt`
- `certificateNumber`: `string` (e.g. `CERT-2025-000001`)
- `verificationCode`: `string`
- `user`: `string` (ObjectId → User)
- `event`: `string` (ObjectId → Event)
- `registration`: `string` (ObjectId → EventRegistration)
- `type`: `"participation" | "winner"`
- `position`: `number | null`
- `filePath`: `string`
- `issuedBy`: `string` (ObjectId → User)
- `issuedDate`: `string` (ISO datetime)
- `lastUpdated`: `string | null` (ISO datetime)
- `downloadCount`: `number`

### Notification

- `_id`, `createdAt`, `updatedAt`
- `recipient`: `string` (ObjectId → User)
- `title`: `string`
- `message`: `string`
- `type`: `string`
- `relatedEvent`: `string | null` (ObjectId → Event)
- `channels`: `("in_app" | "email" | "sms" | "push")[]`
- `priority`: `"low" | "normal" | "high"`
- `scheduledFor`: `string` (ISO datetime)
- `sentBy`: `string | null` (ObjectId → User)
- `deliveryStatus`:
  - `email`: `"pending" | "delivered" | "failed"`
  - `sms`: `"pending" | "delivered" | "failed"`
  - `push`: `"pending" | "delivered" | "failed"`
  - `in_app`: `"pending" | "delivered" | "failed"`
- `sentAt`: `string | null` (ISO datetime)
- `isRead`: `boolean`
- `readAt`: `string | null` (ISO datetime)

### Attendance

- `_id`, `createdAt`, `updatedAt`
- `event`: `string` (ObjectId → Event)
- `user`: `string` (ObjectId → User)
- `checkInTime`: `string` (ISO datetime)
- `checkOutTime`: `string | null` (ISO datetime)
- `duration`: `number`
- `checkInMethod`: `"qr" | "manual"`
- `location`: `string | null`
- `deviceInfo`: `object | null`
- `notes`: `string | null`
- `markedBy`: `string | null` (ObjectId → User)

### Feedback

- `_id`, `__v`, `createdAt`, `updatedAt`
- `event`: `string` (ObjectId → Event)
- `submittedBy`: `string` (ObjectId → User)
- `overallRating`: `number` (1..5)
- `contentQuality`: `number | null` (1..5)
- `organizationRating`: `number | null` (1..5)
- `venueRating`: `number | null` (1..5)
- `speakerRating`: `number | null` (1..5)
- `comment`: `string | null`
- `suggestions`: `string | null`
- `wouldRecommend`: `boolean`
- `anonymous`: `boolean`
- `submittedAt`: `string` (ISO datetime)
- `status`: `"pending" | "approved" | "rejected" | "flagged"`

### RolePermission

- `_id`, `__v`, `createdAt`, `updatedAt`
- `role`: `"student" | "organizer" | "admin" | "super_admin" | "faculty" | "club_lead"`
- `permissions`: `string[]` (permission keys)
- `description`: `string | null`
- `isActive`: `boolean`

### Settings

- `_id`, `__v`, `createdAt`, `updatedAt`
- `key`: `string`
- `value`: `any`
- `category`: `"general" | "email" | "payment" | "security" | "feature" | "ui" | "notification" | "other"`
- `description`: `string | null`
- `isPublic`: `boolean`
- `updatedBy`: `string | null` (ObjectId → User)

### AuditLog (Admin)

- `_id`, `__v`, `createdAt`, `updatedAt`
- `action`: `string` (e.g. `create|update|delete|login|logout|system|bulk_*`)
- `resource`: `string` (e.g. `user|event|payment|...`)
- `resourceId`: `string | null` (ObjectId)
- `performedBy`: `string` (ObjectId → User)
- `changes`: `object | null`
- `details`: `string | null`
- `ipAddress`: `string | null`
- `userAgent`: `string | null`

### Analytics (Custom Tracking)

Note: analytics “tracking” records are stored in the `Analytics` collection.

- `_id`, `__v`, `createdAt`, `updatedAt`
- `eventType`: `string`
- `metricType`: `string`
- `metricValue`: `number`
- `metadata`: `object | null`
- `relatedEvent`: `string | null` (ObjectId → Event)
- `timestamp`: `string` (ISO datetime)

## Endpoints

### Health / Info

- `GET /health` (public): app health
- `GET /` (public): API info (under `/api/v1/`)

---

## Auth (`/auth`)

### Register

**POST** `/auth/register`

Request

- Headers: `Content-Type: application/json`
- Body

```json
{
  "fullName": "string",
  "email": "string",
  "password": "string",
  "phone": "string (optional)",
  "role": "student|organizer|admin|super_admin|faculty|club_lead (optional)",
  "departmentId": "string (ObjectId, optional)",
  "yearOfStudy": 1,
  "rollNumber": "string (optional)"
}
```

Response (201)

```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user": { "...": "User" },
    "token": "string",
    "sessionId": "string"
  }
}
```

### Login

**POST** `/auth/login`

Request

- Headers: `Content-Type: application/json`
- Body

```json
{
  "email": "string",
  "password": "string"
}
```

Response (200)

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "...": "User" },
    "token": "string",
    "sessionId": "string"
  }
}
```

### Forgot Password

**POST** `/auth/forgot-password`

Request

- Headers: `Content-Type: application/json`
- Body

```json
{
  "email": "string"
}
```

Response (200)

```json
{
  "success": true,
  "message": "If the email exists, a password reset link has been sent"
}
```

### Reset Password

**POST** `/auth/reset-password/:token`

Path Params

- `token`: string

Request

- Headers: `Content-Type: application/json`
- Body

```json
{
  "password": "string"
}
```

Response (200)

```json
{
  "success": true,
  "message": "Password reset successful"
}
```

### Get Current User

**GET** `/auth/me` (protected)

Request

- Headers: `Authorization: Bearer <JWT>`

Response (200)

```json
{
  "success": true,
  "data": {
    "user": {
      "...": "User",
      "departmentId": { "_id": "string", "name": "string", "code": "string" }
    }
  }
}
```

### Logout

**POST** `/auth/logout` (protected)

Request

- Headers: `Authorization: Bearer <JWT>`

Response (200)

```json
{
  "success": true,
  "message": "Logout successful"
}
```

### Update Profile

**PUT** `/auth/profile` (protected)

Request

- Headers: `Authorization: Bearer <JWT>`
- Body (allowed keys; all optional)

```json
{
  "fullName": "string",
  "phone": "string",
  "bio": "string",
  "profilePicture": "string",
  "yearOfStudy": 1
}
```

Response (200)

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": { "...": "User" }
  }
}
```

### Change Password

**POST** `/auth/change-password` (protected)

Request

- Headers: `Authorization: Bearer <JWT>`
- Body

```json
{
  "currentPassword": "string",
  "newPassword": "string"
}
```

Response (200)

```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

---

## Events (`/events`)

- `GET /events` (public)

  - Query (optional):
    - `page`: number (default `1`)
    - `limit`: number (default `10`)
    - `search`: string (searches `title`, `description`, `tags`)
    - `category`: string
    - `eventType`: string
    - `status`: string
    - `visibility`: string
    - `eventMode`: `online|offline|hybrid`
    - `isPaid`: `true|false`
    - `startDate`: ISO date/datetime
    - `endDate`: ISO date/datetime
    - `departmentId`: ObjectId
    - `clubId`: ObjectId
    - `sortBy`: string (default `startDateTime`)
    - `order`: `asc|desc` (default `asc`)
  - Response `data`:
    - `events`: Event[] (populated: `organizerId`, `clubId`, `departmentId`)
    - `pagination`: `{ total, page, limit, pages }`

- `GET /events/:id` (public)

  - Path Params:
    - `id`: string (Event `_id` OR `slug`)
  - Response (200) `data`:
    - `event`: Event (populated: `organizerId`, `organizers`, `clubId`, `departmentId`)

- `GET /events/my/events` (protected)

  - Query (optional): `page`, `limit`
  - Response (200) `data`:
    - `events`: Event[]
    - `pagination`: `{ total, page, limit, pages }`

- `POST /events` (protected, organizer+)

  - `multipart/form-data` uploads: `images` (max 5)
  - Body uses `schemas.eventCreate` (see [backend/src/middleware/validation.js](src/middleware/validation.js))
  - Response `data`: Event

- `PUT /events/:id` (protected)

  - `multipart/form-data` uploads: `images` (max 5)
  - Body: partial Event fields

- `DELETE /events/:id` (protected)

- `POST /events/:id/publish` (protected)

  - Response (200) `data`:
    - `event`: Event

---

## Registrations (`/registrations`)

All routes are protected (JWT required).

### Get My Registrations

**GET** `/registrations/my`

Query (optional)

- `status`: `pending|confirmed|waitlisted|cancelled|rejected`
- `paymentStatus`: `pending|paid|failed|refund_pending|refunded|not_required`
- `page`: number (default `1`)
- `limit`: number (default `10`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "EventRegistration" }],
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 10 }
}
```

### Register For Event

**POST** `/registrations`

Request Body

```json
{
  "eventId": "string",
  "teamId": "string (optional)",
  "emergencyContact": {
    "name": "string (optional)",
    "phone": "string (optional)",
    "relationship": "string (optional)"
  },
  "specialRequirements": "string (optional)",
  "participantInfo": { "any": "object (optional)" }
}
```

Response (201)

```json
{
  "success": true,
  "data": {
    "...": "EventRegistration (populated event/user/team minimal fields)"
  },
  "message": "Registration successful | Registration submitted for approval"
}
```

### Get Registration By ID

**GET** `/registrations/:id`

Path Params

- `id`: string (EventRegistration `_id`)

Response (200)

```json
{
  "success": true,
  "data": {
    "...": "EventRegistration (populated event,user,team,payment,certificate)"
  }
}
```

### Cancel Registration

**PUT** `/registrations/:id/cancel`

Request Body (optional)

```json
{
  "reason": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "EventRegistration" },
  "message": "Registration cancelled successfully"
}
```

### Get Event Registrations (Organizer+)

**GET** `/registrations/event/:eventId` (organizer/admin)

Path Params

- `eventId`: string

Query (optional)

- `status`
- `paymentStatus`
- `search`: string (matches user `fullName` or `email`)
- `page`: number (default `1`)
- `limit`: number (default `20`)

Response (200)

```json
{
  "success": true,
  "data": [
    { "...": "EventRegistration (populated user/team/payment minimal fields)" }
  ],
  "stats": {
    "totalRegistrations": 0,
    "confirmed": 0,
    "pending": 0,
    "cancelled": 0,
    "checkedIn": 0,
    "paidCount": 0
  },
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 20 }
}
```

### Update Registration Status (Organizer+)

**PUT** `/registrations/:id/status` (organizer/admin)

Request Body

```json
{
  "status": "pending|confirmed|waitlisted|cancelled|rejected",
  "notes": "string (optional)"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "EventRegistration" },
  "message": "Registration status updated successfully"
}
```

### Check-in Participant (Organizer+)

**POST** `/registrations/:id/checkin` (organizer/admin)

Response (200)

```json
{
  "success": true,
  "data": { "...": "EventRegistration" },
  "message": "Participant checked in successfully"
}
```

### Bulk Check-in (Organizer+)

**POST** `/registrations/bulk-checkin` (organizer/admin)

Request Body

```json
{
  "eventId": "string",
  "registrationIds": ["string"]
}
```

Response (200)

```json
{
  "success": true,
  "message": "0 participants checked in successfully",
  "data": {
    "checkedInCount": 0
  }
}
```

### Export Registrations (Organizer+)

**GET** `/registrations/event/:eventId/export` (organizer/admin)

Query (optional)

- `format`: `json|csv` (default `json`)

Response (200, JSON)

```json
{
  "success": true,
  "data": [{ "...": "EventRegistration (populated user/team/payment)" }]
}
```

Response (200, CSV)

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename=registrations-<eventId>.csv`
- Columns:
  - `Registration Number`, `Name`, `Email`, `Phone`, `Department`, `Roll Number`, `Team`, `Status`, `Payment Status`, `Amount`, `Registration Date`, `Check-in Time`

---

## Teams (`/teams`)

### Get Team By ID (Public)

**GET** `/teams/:id`

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team (populated event, leader, members)" }
}
```

### Get Teams For Event (Public)

**GET** `/teams/event/:eventId`

Query (optional)

- `status`: `active|locked|disbanded`
- `search`: string (matches team `name`)
- `page`: number (default `1`)
- `limit`: number (default `20`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Team" }],
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 20 }
}
```

All remaining routes are protected.

### Create Team

**POST** `/teams`

Request Body

```json
{
  "name": "string",
  "eventId": "string",
  "description": "string (optional)"
}
```

Response (201)

```json
{
  "success": true,
  "data": { "...": "Team (populated event, leader, members)" },
  "message": "Team created successfully"
}
```

### Get My Teams

**GET** `/teams/my`

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Team" }]
}
```

### Join Team With Invite Code

**POST** `/teams/join`

Request Body

```json
{
  "inviteCode": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team" },
  "message": "Successfully joined the team"
}
```

### Leave Team

**POST** `/teams/:id/leave`

Response (200)

```json
{
  "success": true,
  "message": "Left team successfully"
}
```

### Update Team

**PUT** `/teams/:id`

Request Body (all optional)

```json
{
  "name": "string",
  "description": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team" },
  "message": "Team updated successfully"
}
```

### Add Team Member (Leader Only)

**POST** `/teams/:id/members`

Request Body

```json
{
  "userId": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team" },
  "message": "Member added successfully"
}
```

### Remove Team Member (Leader Or Self)

**DELETE** `/teams/:id/members/:userId`

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team" },
  "message": "Member removed successfully"
}
```

### Transfer Leadership (Leader Only)

**PUT** `/teams/:id/transfer-leadership`

Request Body

```json
{
  "newLeaderId": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team" },
  "message": "Leadership transferred successfully"
}
```

### Lock Team (Leader Only)

**PUT** `/teams/:id/lock`

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team" },
  "message": "Team locked successfully"
}
```

### Unlock Team (Leader Only)

**PUT** `/teams/:id/unlock`

Response (200)

```json
{
  "success": true,
  "data": { "...": "Team" },
  "message": "Team unlocked successfully"
}
```

### Disband Team (Leader Only)

**DELETE** `/teams/:id`

Response (200)

```json
{
  "success": true,
  "message": "Team disbanded successfully"
}
```

---

## Payments (`/payments`)

### Stripe Webhook (Public)

**POST** `/payments/webhook/stripe`

Request

- Headers:
  - `Content-Type: application/json`
  - `stripe-signature: <signature>`
- Body: raw Stripe webhook event JSON (unparsed raw body is required)

Response (200)

```json
{ "received": true }
```

### Razorpay Webhook (Public)

**POST** `/payments/webhook/razorpay`

Request

- Headers: `Content-Type: application/json`
- Body: Razorpay webhook payload JSON

Response (200)

```json
{ "received": true }
```

All remaining routes are protected.

### Initiate Payment

**POST** `/payments/initiate`

Request Body

```json
{
  "registrationId": "string",
  "paymentMethod": "stripe|razorpay (optional; default stripe)"
}
```

Response (200)

```json
{
  "success": true,
  "data": {
    "payment": { "...": "Payment" },
    "clientSecret": "string|null",
    "orderId": "string",
    "amount": 0,
    "currency": "INR"
  },
  "message": "Payment initiated successfully"
}
```

### Verify Payment

**POST** `/payments/verify`

Request Body

```json
{
  "paymentId": "string",
  "paymentIntentId": "string (Stripe only)",
  "razorpay_payment_id": "string (Razorpay only)",
  "razorpay_order_id": "string (Razorpay only)",
  "razorpay_signature": "string (Razorpay only)"
}
```

Response (200)

```json
{
  "success": true,
  "data": {
    "payment": { "...": "Payment" },
    "invoice": { "...": "Invoice" }
  },
  "message": "Payment verified successfully"
}
```

### Get Payment By ID

**GET** `/payments/:id`

Response (200)

```json
{
  "success": true,
  "data": { "...": "Payment (populated user,event,registration)" }
}
```

### Get My Payments

**GET** `/payments/my`

Query (optional)

- `status`: `pending|completed|failed`
- `page`: number (default `1`)
- `limit`: number (default `10`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Payment (populated event,registration)" }],
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 10 }
}
```

### Request Refund

**POST** `/payments/:id/refund`

Request Body

```json
{
  "reason": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Refund" },
  "message": "Refund request submitted successfully"
}
```

### Get Event Payments (Organizer+)

**GET** `/payments/event/:eventId` (organizer/admin)

Query (optional)

- `status`: `pending|completed|failed`
- `page`: number (default `1`)
- `limit`: number (default `20`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Payment (populated user,registration)" }],
  "stats": {
    "totalPayments": 0,
    "completedPayments": 0,
    "pendingPayments": 0,
    "failedPayments": 0,
    "totalAmount": 0
  },
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 20 }
}
```

### Process Refund (Organizer+)

**PUT** `/payments/refunds/:id/process` (organizer/admin)

Request Body

```json
{
  "action": "approve|reject",
  "notes": "string (optional; used as rejection reason when action=reject)"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Refund" },
  "message": "Refund processed successfully | Refund request rejected"
}
```

### Payment Stats (Admin)

**GET** `/payments/stats` (admin)

Query (optional)

- `startDate`: ISO date/datetime
- `endDate`: ISO date/datetime

Response (200)

```json
{
  "success": true,
  "data": {
    "overall": {
      "totalPayments": 0,
      "completedPayments": 0,
      "pendingPayments": 0,
      "failedPayments": 0,
      "totalRevenue": 0,
      "totalRefunded": 0
    },
    "byMethod": [{ "_id": "stripe|razorpay", "count": 0, "totalAmount": 0 }]
  }
}
```

---

## Certificates (`/certificates`)

### Get Certificate By ID (Public)

**GET** `/certificates/:id`

Response (200)

```json
{
  "success": true,
  "data": { "...": "Certificate (populated user,event,issuedBy)" }
}
```

### Download Certificate PDF (Public)

**GET** `/certificates/:id/download`

Response (200)

- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="Certificate_<certificateNumber>.pdf"`
- Body: PDF stream

### Verify Certificate (Public)

**GET** `/certificates/verify/:certificateNumber`

Path Params

- `certificateNumber`: string (e.g. `CERT-2025-000001`)

Query (optional)

- `verificationCode`: string

Success Response (200)

```json
{
  "success": true,
  "verified": true,
  "data": {
    "certificateNumber": "string",
    "recipientName": "string",
    "eventTitle": "string",
    "eventDate": "2025-01-01T00:00:00.000Z",
    "type": "participation|winner",
    "position": 1,
    "issuedDate": "2025-01-01T00:00:00.000Z",
    "issuedBy": "string"
  },
  "message": "Certificate verified successfully"
}
```

Failure Response Examples

```json
{ "success": false, "verified": false, "message": "Certificate not found" }
```

```json
{ "success": false, "verified": false, "message": "Invalid verification code" }
```

All remaining routes are protected.

### Get My Certificates

**GET** `/certificates/my`

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Certificate (populated event,issuedBy)" }]
}
```

### Generate Certificates (Organizer+)

**POST** `/certificates/generate` (organizer/admin)

Request Body

```json
{
  "eventId": "string",
  "certificateType": "participation|winner (optional; default participation)",
  "registrationIds": ["string"],
  "template": "string (optional)"
}
```

Response (200)

```json
{
  "success": true,
  "data": {
    "generated": 0,
    "certificates": [{ "...": "Certificate" }],
    "errors": [{ "userId": "string", "email": "string", "error": "string" }]
  },
  "message": "Successfully generated 0 certificate(s)"
}
```

### Bulk Generate Certificates (Organizer+)

**POST** `/certificates/bulk-generate` (organizer/admin)

Request Body

```json
{
  "eventId": "string",
  "template": "string (optional)"
}
```

Response (200)

```json
{
  "success": true,
  "data": {
    "participation": 0,
    "winner": 0,
    "errors": [
      { "user": "string", "type": "participation|winner", "error": "string" }
    ]
  },
  "message": "Generated 0 participation and 0 winner certificates"
}
```

### Get Event Certificates (Organizer+)

**GET** `/certificates/event/:eventId` (organizer/admin)

Query (optional)

- `type`: `participation|winner`
- `page`: number (default `1`)
- `limit`: number (default `20`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Certificate (populated user,registration)" }],
  "stats": {
    "totalCertificates": 0,
    "byType": [{ "type": "participation|winner", "count": 1 }],
    "totalDownloads": 0
  },
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 20 }
}
```

### Regenerate Certificate (Organizer+)

**POST** `/certificates/:id/regenerate` (organizer/admin)

Response (200)

```json
{
  "success": true,
  "data": { "...": "Certificate" },
  "message": "Certificate regenerated successfully"
}
```

### Revoke Certificate (Admin)

**DELETE** `/certificates/:id` (admin)

Request Body

```json
{
  "reason": "string (optional)"
}
```

Response (200)

```json
{
  "success": true,
  "message": "Certificate revoked successfully"
}
```

### Certificate Stats (Admin)

**GET** `/certificates/stats` (admin)

Response (200)

```json
{
  "success": true,
  "data": {
    "overall": {
      "totalCertificates": 0,
      "byType": ["participation", "winner"],
      "totalDownloads": 0,
      "avgDownloadsPerCertificate": 0
    },
    "byType": [{ "_id": "participation|winner", "count": 0, "downloads": 0 }],
    "recent": [{ "...": "Certificate (populated user,event)" }]
  }
}
```

---

## Feedback (`/feedback`)

Public:

- `GET /feedback/event/:eventId/public`

Protected:

- `POST /feedback`

  - Body (required):
    - `eventId`: ObjectId
    - `overallRating`: number (1..5)
  - Body (optional):
    - `contentQuality`: number (1..5)
    - `organizationRating`: number (1..5)
    - `venueRating`: number (1..5)
    - `speakerRating`: number (1..5)
    - `comment`: string
    - `suggestions`: string
    - `wouldRecommend`: boolean
    - `anonymous`: boolean
    - `isAnonymous`: boolean (alias)
  - Response `201 data`: Feedback (populated: `event{title}`, `submittedBy{fullName,email}`)

- `GET /feedback/my`

  - Response `data`: Feedback[] (populated: `event{title,startDateTime,eventType,banner}`)

- `GET /feedback/:id`

  - Response `data`: Feedback (populated: `event{title,organizer}`, `submittedBy{fullName,email,profilePicture}`)

- `PUT /feedback/:id`

  - Body (optional): `overallRating`, `contentQuality`, `organizationRating`, `venueRating`, `speakerRating`, `comment`, `suggestions`, `wouldRecommend`
  - Response `data`: Feedback

- `DELETE /feedback/:id`

Organizer+:

- `GET /feedback/event/:eventId`

  - Query (optional): `status`, `minRating`, `page`, `limit`
  - Response:
    - `data`: Feedback[]
    - `stats`: object (aggregates like `totalFeedback`, `avgOverallRating`, etc.)
    - `ratingDistribution`: `{ _id: number, count: number }[]`
    - `pagination`: `{ total, page, pages, limit }`

- `GET /feedback/event/:eventId/summary`
- `GET /feedback/event/:eventId/export`

  - Query: `format=json|csv` (default `json`)
  - Response:
    - `json`: `{ success, data, stats }`
    - `csv`: `text/csv` download

- `PUT /feedback/:id/status`

  - Body: `{ status: "pending"|"approved"|"rejected"|"flagged" }`

---

## Analytics (`/analytics`)

Protected:

- `POST /analytics/track`

  - Body:
    - `eventType`: string
    - `metricType`: string
    - `metricValue`: number
    - `metadata`: object (optional)
    - `relatedEvent`: ObjectId (optional)
  - Response `201 data`: Analytics

Organizer+:

- `GET /analytics/events/:eventId`

  - Response `data` (nested analytics object):
    - `event`: Event
    - `registrations`: `{ total, confirmed, pending, cancelled, checkedIn }`
    - `registrationTimeline`: `{ date: string, count: number }[]`
    - `payments`: `{ totalRevenue, totalTransactions, avgTransaction }`
    - `paymentTimeline`: `{ date: string, revenue: number }[]`
    - `feedback`: `{ avgRating, count }`
    - `feedbackDistribution`: `{ rating: number, count: number }[]`
    - `demographics`: `{ byDepartment: { departmentId, departmentName, count }[], byYear: { year, count }[] }`
    - `certificates`: `{ totalGenerated, totalDownloaded }`
    - `metrics`: `{ attendanceRate, conversionRate, revenuePerParticipant }`

- `GET /analytics/compare`

  - Query: `eventIds` (comma-separated ObjectIds)
  - Response `data`: comparisons array:
    - `{ eventId, title, eventType, date, capacity, registrations, revenue, feedback, attendanceRate }`

- `GET /analytics/events/:eventId/export` (alias)

  - Note: currently forwards to the general export handler (the `eventId` path param is not used).

- `GET /analytics/export`

  - Access: Admin
  - Query:
    - `type`: `events|registrations|payments|feedback|<any>`
    - `startDate`: ISO date/datetime (optional)
    - `endDate`: ISO date/datetime (optional)
    - `format`: `json|csv` (default `json`)
  - Response:
    - `json`: `{ success, data: any[] }`
    - `csv`: `text/csv` download (basic JSON-stringified payload)

Admin:

- `GET /analytics/dashboard`
- `GET /analytics/users`
- `GET /analytics/performance`

  - Query: `period=7d|30d|90d|1y` (default `30d`)
  - Response `data`:
    - `period`
    - `events`: `{ totalEvents, publishedEvents, completedEvents, cancelledEvents }`
    - `registrations`: `{ total, confirmed, cancelled }`
    - `payments`: `{ total, successful, failed }`
    - `rates`: `{ confirmationRate, paymentSuccessRate, eventCompletionRate }`

---

## Notifications (`/notifications`)

All routes are protected.

### Get My Notifications

**GET** `/notifications/my`

Query (optional)

- `isRead`: `true|false`
- `type`: string
- `page`: number (default `1`)
- `limit`: number (default `20`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Notification" }],
  "unreadCount": 0,
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 20 }
}
```

### Get Notification Preferences

**GET** `/notifications/preferences`

Response (200)

```json
{
  "success": true,
  "data": {
    "email": true,
    "sms": true,
    "push": true,
    "in_app": true
  }
}
```

### Update Notification Preferences

**PUT** `/notifications/preferences`

Request Body (all optional)

```json
{
  "email": true,
  "sms": true,
  "push": true,
  "in_app": true
}
```

Response (200)

```json
{
  "success": true,
  "data": {
    "email": true,
    "sms": true,
    "push": true,
    "in_app": true
  },
  "message": "Notification preferences updated successfully"
}
```

### Mark Notification As Read

**PUT** `/notifications/:id/read`

Response (200)

```json
{
  "success": true,
  "data": { "...": "Notification" },
  "message": "Notification marked as read"
}
```

### Mark All Notifications As Read

**PUT** `/notifications/read-all`

Response (200)

```json
{
  "success": true,
  "message": "0 notification(s) marked as read"
}
```

### Delete Notification

**DELETE** `/notifications/:id`

Response (200)

```json
{
  "success": true,
  "message": "Notification deleted successfully"
}
```

### Delete All Notifications

**DELETE** `/notifications/`

Response (200)

```json
{
  "success": true,
  "message": "0 notification(s) deleted"
}
```

### Create Notification (Organizer+)

**POST** `/notifications` (organizer/admin)

Request Body

```json
{
  "recipients": "all | userId | userId[]",
  "title": "string",
  "message": "string",
  "type": "string",
  "relatedEvent": "string (optional)",
  "channels": ["in_app", "email", "sms", "push"],
  "priority": "low|normal|high (optional; default normal)",
  "scheduledFor": "2025-01-01T00:00:00.000Z (optional)"
}
```

Response (201)

```json
{
  "success": true,
  "data": [{ "...": "Notification" }],
  "message": "0 notification(s) created successfully"
}
```

### Bulk Notify Event Participants (Organizer+)

**POST** `/notifications/bulk/event/:eventId` (organizer/admin)

Request Body

```json
{
  "title": "string",
  "message": "string",
  "channels": ["in_app", "email", "sms", "push"],
  "status": "confirmed|pending|cancelled|rejected|waitlisted (optional; default confirmed)"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "sent": 0 },
  "message": "Notification sent to 0 participant(s)"
}
```

### Get Sent Notifications (Organizer+)

**GET** `/notifications/sent` (organizer/admin)

Query (optional)

- `page`: number (default `1`)
- `limit`: number (default `20`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Notification (populated recipient, relatedEvent)" }],
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 20 }
}
```

### Resend Failed Notifications (Organizer+)

**POST** `/notifications/resend-failed` (organizer/admin)

Response (200)

```json
{
  "success": true,
  "message": "0 notification(s) resent"
}
```

### Notification Stats (Admin)

**GET** `/notifications/stats` (admin)

Query (optional)

- `startDate`: ISO date/datetime
- `endDate`: ISO date/datetime

Response (200)

```json
{
  "success": true,
  "data": {
    "overview": { "total": 0, "read": 0, "unread": 0 },
    "byType": [{ "_id": "string", "count": 0 }],
    "byChannel": [{ "_id": "in_app|email|sms|push", "count": 0 }],
    "delivery": {
      "emailDelivered": 0,
      "smsDelivered": 0,
      "emailFailed": 0,
      "smsFailed": 0
    }
  }
}
```

---

## Attendance (`/attendance`)

All routes are protected.

### Get My Attendance

**GET** `/attendance/my`

Query (optional)

- `page`: number (default `1`)
- `limit`: number (default `20`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Attendance (populated event)" }],
  "stats": {
    "totalEvents": 0,
    "totalDuration": 0,
    "avgDuration": 0
  },
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 20 }
}
```

### Self Check-in (QR)

**POST** `/attendance/self-checkin`

Request Body

```json
{
  "qrData": "string (JSON string containing at least eventId)",
  "location": "string (optional)"
}
```

Response (201)

```json
{
  "success": true,
  "data": { "...": "Attendance" },
  "message": "Check-in successful"
}
```

### Check-in (Organizer+)

**POST** `/attendance/checkin` (organizer/admin)

Request Body

```json
{
  "eventId": "string",
  "userId": "string",
  "method": "manual|qr (optional; default manual)",
  "location": "string (optional)",
  "deviceInfo": { "any": "object (optional)" },
  "qrCode": "string (optional)"
}
```

Response (201)

```json
{
  "success": true,
  "data": { "...": "Attendance (populated event,user,markedBy)" },
  "message": "Check-in successful"
}
```

### Check-out (Organizer+)

**POST** `/attendance/checkout` (organizer/admin)

Request Body

```json
{
  "eventId": "string",
  "userId": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Attendance" },
  "message": "Check-out successful"
}
```

### Bulk Check-in (Organizer+)

**POST** `/attendance/bulk-checkin` (organizer/admin)

Request Body

```json
{
  "eventId": "string",
  "userIds": ["string"]
}
```

Response (200)

```json
{
  "success": true,
  "data": {
    "success": ["string"],
    "failed": [{ "userId": "string", "reason": "string" }]
  },
  "message": "0 check-in(s) successful, 0 failed"
}
```

### Get Event Attendance (Organizer+)

**GET** `/attendance/event/:eventId` (organizer/admin)

Query (optional)

- `page`: number (default `1`)
- `limit`: number (default `50`)

Response (200)

```json
{
  "success": true,
  "data": [{ "...": "Attendance (populated user,markedBy)" }],
  "stats": {
    "totalCheckIns": 0,
    "activeCheckIns": 0,
    "completedSessions": 0,
    "avgDuration": 0
  },
  "methodStats": [{ "_id": "manual|qr", "count": 0 }],
  "pagination": { "total": 0, "page": 1, "pages": 1, "limit": 50 }
}
```

### Generate Event QR Code (Organizer+)

**GET** `/attendance/event/:eventId/qrcode` (organizer/admin)

Response (200)

```json
{
  "success": true,
  "data": {
    "qrCode": "string (data URL)",
    "qrData": "string (JSON string)",
    "event": { "id": "string", "title": "string" }
  }
}
```

### Attendance Report (Organizer+)

**GET** `/attendance/event/:eventId/report` (organizer/admin)

Query (optional)

- `format`: `json|csv` (default `json`)

Response (200, JSON)

```json
{
  "success": true,
  "data": {
    "summary": {
      "eventTitle": "string",
      "totalRegistrations": 0,
      "totalAttendance": 0,
      "attendanceRate": "0.00",
      "avgDuration": 0
    },
    "attendance": [
      {
        "name": "string",
        "email": "string",
        "phone": "string",
        "department": "string",
        "rollNumber": "string",
        "checkInTime": "2025-01-01T00:00:00.000Z",
        "checkOutTime": "2025-01-01T00:00:00.000Z|\"\"",
        "duration": 0,
        "method": "manual|qr"
      }
    ]
  }
}
```

Response (200, CSV)

- `Content-Type: text/csv`
- `Content-Disposition: attachment; filename=attendance-<eventId>.csv`
- Columns:
  - `Name`, `Email`, `Phone`, `Department`, `Roll Number`, `Check-in Time`, `Check-out Time`, `Duration (minutes)`, `Method`

### Update Attendance Record (Organizer+)

**PUT** `/attendance/:id` (organizer/admin)

Request Body (all optional)

```json
{
  "checkInTime": "2025-01-01T00:00:00.000Z",
  "checkOutTime": "2025-01-01T00:00:00.000Z",
  "notes": "string"
}
```

Response (200)

```json
{
  "success": true,
  "data": { "...": "Attendance" },
  "message": "Attendance updated successfully"
}
```

### Delete Attendance Record (Admin)

**DELETE** `/attendance/:id` (admin)

Response (200)

```json
{
  "success": true,
  "message": "Attendance record deleted successfully"
}
```

### Attendance Stats (Admin)

**GET** `/attendance/stats` (admin)

Query (optional)

- `startDate`: ISO date/datetime
- `endDate`: ISO date/datetime

Response (200)

```json
{
  "success": true,
  "data": {
    "overall": { "totalCheckIns": 0, "avgDuration": 0, "totalDuration": 0 },
    "byMethod": [{ "_id": "manual|qr", "count": 0 }],
    "topEvents": [{ "eventTitle": "string", "count": 0 }]
  }
}
```

---

## Admin (`/admin`)

All routes require `admin` or `superadmin` (alias supported).

- `GET /admin/dashboard`

  - Response `data`:
    - `overview`: `{ totalUsers, totalEvents, totalRegistrations, totalRevenue }`
    - `distributions`: `{ eventsByStatus, usersByRole }`
    - `recent`: `{ users, events, payments }`

- `GET /admin/users`

  - Query (optional): `role`, `department`, `isActive`, `search`, `page`, `limit`
  - Response:
    - `data`: User[]
    - `pagination`: `{ total, page, pages, limit }`

- `PUT /admin/users/:id/role`

  - Body: `{ role }`
  - Response: `{ success, message, data: User }`

- `PUT /admin/users/:id/status`

  - Body: `{ isActive: boolean }`
  - Response: `{ success, message, data: User }`

- `DELETE /admin/users/:id`

  - Response: `{ success, message }`

- `DELETE /admin/users/inactive/cleanup`

  - Query (optional): `daysInactive` (number, default `365`)
  - Response: `{ success, message }`

- `GET /admin/events`

  - Query (optional): `status`, `eventType`, `search`, `page`, `limit`
  - Response:
    - `data`: Event[] (populated: `organizer`)
    - `pagination`: `{ total, page, pages, limit }`

- `DELETE /admin/events/:id`

  - Response: `{ success, message }`

- `GET /admin/audit-logs`

  - Query (optional): `action`, `resource`, `performedBy`, `startDate`, `endDate`, `page`, `limit`
  - Response:
    - `data`: AuditLog[]
    - `pagination`: `{ total, page, pages, limit }`

- `GET /admin/settings`

  - Query (optional): `category`
  - Response `data`: grouped by category: `{ [category: string]: { [key: string]: any } }`

- `PUT /admin/settings/:key`

  - Params: `key`
  - Body:
    - `value`: any
    - `category`: string (default `general`)
    - `description`: string (optional)
  - Response: `{ success, message, data: Settings }`

- `GET /admin/permissions`

  - Response `data`: RolePermission[]

- `PUT /admin/permissions/:roleId`

  - Params: `roleId` (string; role identifier)
  - Body:
    - `role`: string (optional; if present, overrides `roleId`)
    - `permissions`: string[]
    - `description`: string (optional)
  - Response: `{ success, message, data: RolePermission }`

- `GET /admin/statistics`

  - Query: `period=7d|30d|90d|1y` (default `30d`)
  - Response `data`:
    - `period`
    - `users`: `{ new, total, growthRate }`
    - `events`: `{ new, total, active }`
    - `registrations`: `{ new, total }`
    - `revenue`: `{ amount, transactions }`
    - `certificates`: number
    - `feedback`: `{ count, avgRating }`
    - `dailyActivity`: `{ _id: "YYYY-MM-DD", newUsers }[]`

- `GET /admin/health`

  - Response `data`:
    - `status`, `timestamp`
    - `services.database`: `{ status, readyState }`
    - `services.redis`: `{ status }`
    - `system`: `{ uptime, memory, nodeVersion }`

- `POST /admin/cache/clear`

  - Response: `{ success, message }`

- `GET /admin/reports/generate`

  - Query: `startDate`, `endDate`, `format=json` (csv not implemented)
  - Response `data`: report object `{ generatedAt, period, users, events, registrations, revenue, certificates, feedback }`
