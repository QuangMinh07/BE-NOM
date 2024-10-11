const mongoose = require("mongoose");
const { Schema } = mongoose;

// Định nghĩa Schema cho OrderCancellation
const orderCancellationSchema = new Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Tham chiếu đến người dùng
    required: true,
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StoreOrder", // Tham chiếu đến đơn hàng
    required: true,
  },
  cancellationDate: {
    type: Date,
    default: Date.now, // Ngày hủy mặc định là ngày hiện tại
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: "",
  },
  cancellationStatus: {
    type: String,
    enum: ["Canceled"], // Chỉ có trạng thái "Canceled"
    default: "Canceled", // Mặc định là "Canceled"
  },
});

// Tạo Model từ Schema
const OrderCancellation = mongoose.model("OrderCancellation", orderCancellationSchema);

module.exports = OrderCancellation;
