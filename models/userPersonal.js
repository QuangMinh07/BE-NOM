const mongoose = require("mongoose");

const UserPersonalInfoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Tham chiếu đến model User
      required: true,
    },
    dateOfBirth: {
      type: Date,
      default: "",
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    postalCode: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "",
    },
    profilePictureURL: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // Thêm createdAt và updatedAt
  }
);

UserPersonalInfoSchema.index({ userId: 1 });

const UserPersonalInfo = mongoose.model(
  "UserPersonalInfo",
  UserPersonalInfoSchema
);

module.exports = UserPersonalInfo;
