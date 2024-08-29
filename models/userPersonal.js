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
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
    },
    profilePictureURL: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true, // Thêm createdAt và updatedAt
  }
);

UserPersonalInfoSchema.index({ userId: 1 });

const UserPersonalInfo = mongoose.model("UserPersonalInfo", UserPersonalInfoSchema);

module.exports = UserPersonalInfo;
