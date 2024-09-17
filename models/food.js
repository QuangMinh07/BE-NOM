const mongoose = require("mongoose");

const FoodSchema = new mongoose.Schema({
  foodName: {
    type: String,
    required: true,
    trim: true,
    default: "",
  },
  price: {
    type: Number,
    required: true,
    default: "",
  },
  description: {
    type: String,
    trim: true,
    default: "",
  },
  store: {
    type: mongoose.Schema.Types.ObjectId, // Liên kết với cửa hàng
    ref: "Store",
    required: true,
    default: "",
  },
  imageUrl: {
    type: String, // Đường dẫn tới ảnh của món
    trim: true,
    default: "",
  },
  foodGroup: {
    type: String, // Nhóm món (ví dụ: Đồ ăn nhanh, Nước uống, v.v.)
    trim: true,
    default: "",
  },
  isAvailable: {
    type: Boolean, // Tình trạng còn món hay không
    default: false,
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
