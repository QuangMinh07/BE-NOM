const mongoose = require("mongoose");

const FoodSchema = new mongoose.Schema({
  foodName: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  store: {
    type: mongoose.Schema.Types.ObjectId, // Liên kết với cửa hàng
    ref: "Store",
    required: true,
  },
  imageUrl: {
    type: String, // Đường dẫn tới ảnh của món
    trim: true,
    default: "",
  },
  foodGroup: {
    type: String, // Nhóm món (ví dụ: Đồ ăn nhanh, Nước uống, v.v.)
    trim: true,
  },
  isAvailable: {
    type: Boolean, // Tình trạng còn món hay không
    default: true,
  },
  sellingTime: [
    {
      day: {
        type: String, // Ngày bán (ví dụ: Monday, Tuesday, v.v.)
      },
      timeSlots: [
        {
          open: {
            type: String, // Thời gian mở bán (hh:mm)
          },
          close: {
            type: String, // Thời gian đóng bán (hh:mm)
          },
        },
      ],
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const Food = mongoose.model("Food", FoodSchema);

module.exports = Food;
