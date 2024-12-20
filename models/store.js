const mongoose = require("mongoose");

const StoreSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true,
    trim: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId, // Liên kết với userId của người bán
    ref: "User",
    required: true,
  },
  storeAddress: {
    type: String,
    trim: true,
    required: true,
  },
  bankAccount: {
    type: String,
    trim: true,
  },
  foodType: {
    type: String,
    trim: true,
  },
  sellingTime: [
    {
      day: {
        type: String, // Ngày bán (ví dụ: Monday, Tuesday, v.v.)
        default: "", // Giá trị mặc định là chuỗi rỗng
      },
      timeSlots: [
        {
          open: {
            type: String, // Thời gian mở bán (hh:mm)
            default: "", // Giá trị mặc định là chuỗi rỗng
          },
          close: {
            type: String, // Thời gian đóng bán (hh:mm)
            default: "", // Giá trị mặc định là chuỗi rỗng
          },
        },
      ],
    },
  ],
  staffList: [
    {
      staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff", // Liên kết với mô hình Staff
      },
      roleId: {
        type: String,
        default: "",
      },
    },
  ],

  isOpen: {
    type: Boolean,
    default: false,
  },

  foods: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food", // Liên kết với mô hình Food
    },
  ],

  foodGroups: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodGroup", // Liên kết với mô hình FoodGroup
    },
  ],

  branches: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store", // Liên kết với các chi nhánh
    },
  ],

  imageURL: { type: String, default: "" },

  averageRating: {
    type: Number,
    default: 0, // Sao trung bình ban đầu là 0
  },
  lockStatus: {
    type: String,
    enum: ["unlocked", "locked", "pending_delete"],
    default: "unlocked", // Mặc định là không bị khóa
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Store = mongoose.model("Store", StoreSchema);

module.exports = Store;
