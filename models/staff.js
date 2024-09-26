const mongoose = require("mongoose");

// Định nghĩa modal Staff
const staffSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true, // Loại bỏ khoảng trắng dư thừa
    },
    isActive: {
      type: Boolean,
      default: false, // Mặc định là true
    },
    store: {
      type: mongoose.Schema.Types.ObjectId, // Liên kết với storeId của cửa hàng
      ref: "Store",
      required: true, // Bắt buộc phải có storeId
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Link to a registered user
      default: null, // Initially, no user registered
    },
  },
  {
    timestamps: true, // Thêm createdAt và updatedAt tự động
  }
);

// Tạo model Staff từ schema
const Staff = mongoose.model("Staff", staffSchema);

module.exports = Staff;
