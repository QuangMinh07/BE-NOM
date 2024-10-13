const mongoose = require("mongoose");

const ShipperInfoSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Tham chiếu đến mô hình User
      required: true,
    },
    personalInfoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserPersonalInfo", // Tham chiếu đến mô hình UserPersonalInfo
      required: true,
    },
    temporaryAddress: {
      type: String, // Địa chỉ tạm trú
      trim: true,
      default: "",
    },
    bankAccount: {
      type: String, // Số tài khoản
      trim: true,
      default: "",
    },
    vehicleNumber: {
      type: String, // Mã số xe
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true, // Thêm createdAt và updatedAt
  }
);

const ShipperInfo = mongoose.model("ShipperInfo", ShipperInfoSchema);

module.exports = ShipperInfo;
