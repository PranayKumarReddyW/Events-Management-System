const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: [true, "Role is required"],
      unique: true,
      trim: true,
      lowercase: true,
      enum: {
        values: [
          "student",
          "department_organizer",
          "faculty",
          "admin",
          "super_admin",
        ],
        message: "{VALUE} is not a valid role",
      },
    },
    permissions: [
      {
        type: String,
        trim: true,
        enum: {
          values: [
            // Event permissions
            "event.create",
            "event.read",
            "event.update",
            "event.delete",
            "event.publish",
            // User permissions
            "user.create",
            "user.read",
            "user.update",
            "user.delete",
            // Registration permissions
            "registration.create",
            "registration.read",
            "registration.update",
            "registration.delete",
            // Team permissions
            "team.create",
            "team.read",
            "team.update",
            "team.delete",
            // Payment permissions
            "payment.create",
            "payment.read",
            "payment.refund",
            // Certificate permissions
            "certificate.create",
            "certificate.read",
            "certificate.verify",
            // Analytics permissions
            "analytics.read",
            "analytics.create",
            // Approval permissions
            "approval.create",
            "approval.approve",
            "approval.reject",
            // Admin permissions
            "admin.settings",
            "admin.roles",
            "admin.audit",
          ],
          message: "{VALUE} is not a valid permission",
        },
      },
    ],
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
rolePermissionSchema.index({ isActive: 1 });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);
