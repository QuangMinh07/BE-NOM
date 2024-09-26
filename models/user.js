const mongoose = require("mongoose");
const moment = require("moment-timezone");

const UserSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      trim: true,
      lowercase: true,
      required: function () {
        // Chỉ yêu cầu userName khi không đăng nhập bằng Google
        return !this.googleId && !this.facebookId;
      },
      unique: true,
    },
    fullName: {
      type: String,
      trim: true,
      default: "",
    },
    phoneNumber: {
      type: String,
      // Chỉ yêu cầu phoneNumber khi không đăng nhập bằng Google
      required: function () {
        return !this.googleId && !this.facebookId;
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      minlength: 8,
      // Chỉ yêu cầu password khi không đăng nhập bằng Google
      required: function () {
        return !this.googleId && !this.facebookId;
      },
    },
    roleId: {
      type: String,
      enum: ["admin", "customer", "seller", "shipper", "staff"],
      default: "customer",
      required: true,
    },

    isApproved: {
      type: Boolean,
      default: false, // Trạng thái mặc định là chưa được duyệt
    },

    address: {
      type: String,
      trim: true,
      default: "",
    },
    createdAt: { type: Date, default: Date.now },
    facebookId: {
      type: String,
      unique: true,
      sparse: true,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    resetToken: String,
    resetTokenExpiry: Date,
    loyaltyPoints: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastActive: {
      type: Date,
      default: Date.now, // Thiết lập thời gian hoạt động mặc định là thời gian hiện tại khi tạo user
    },
    isVerified: { type: Boolean, default: false },
    verificationCode: {
      type: String,
      trim: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    verificationCodeExpiry: Date,

    lastLogin: Date,

    representativeName: {
      type: String,
      trim: true,
      default: "",
    },
    cccd: {
      type: String, // Số CCCD hoặc CMND
      trim: true,
      default: "",
    },

    storeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store", // Tham chiếu đến mô hình Store
      },
    ],
    businessType: {
      type: String, // Loại kinh doanh
      trim: true,
      default: "",
    },
    idImage: {
      type: String,
      trim: true,
      default: "",
    },
    storeCount: {
      type: Number,
      default: 0, // Số lượng cửa hàng bắt đầu từ 0
      min: 0, // Giá trị tối thiểu của storeCount là 0
    },
  },
  {
    validateBeforeSave: true,
    timestamps: true,
  }
);

UserSchema.index({ userName: 1, email: 1 });

UserSchema.methods.getFullName = function () {
  return this.fullName;
};

UserSchema.statics.findByUserName = function (userName) {
  return this.findOne({ userName: userName });
};

const User = mongoose.model("User", UserSchema);

module.exports = User;
