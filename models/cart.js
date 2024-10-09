const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Liên kết với người dùng
    required: true,
  },
  items: [
    {
      food: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Food", // Liên kết với món ăn
        required: true,
      },
      store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Store", // Liên kết với cửa hàng chứa món ăn
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
        default: 1, // Số lượng mặc định là 1
      },
      price: {
        type: Number,
        required: true,
      },
    },
  ],
  totalPrice: {
    type: Number,
    required: true,
    default: 0,
  },
  deliveryAddress: {
    type: String, // Địa chỉ giao hàng
    default: "",
  },
  receiverName: {
    type: String, // Tên người nhận
    required: true,
  },
  receiverPhone: {
    type: String, // Số điện thoại người nhận
    required: true,
  },
  description: {
    type: String, // Mô tả (nếu có)
    default: "",
  },
  paymentTransaction: {
    type: mongoose.Schema.Types.ObjectId, // Tham chiếu tới giao dịch thanh toán
    ref: "PaymentTransaction",
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

const Cart = mongoose.model("Cart", CartSchema);
module.exports = Cart;
