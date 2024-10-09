const mongoose = require("mongoose");
const { Schema } = mongoose;

// Định nghĩa Schema cho StoreOrder
const storeOrderSchema = new Schema({
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store",
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["Momo", "VNPay", "BankCard", "Cash"],
    required: true,
  },
  orderStatus: {
    type: String,
    enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
    default: "Pending",
  },
  paymentStatus: {
    type: String,
    enum: ["Pending", "Paid", "Failed"], // Trạng thái thanh toán
    default: "Pending",
  },
});

// Tạo Model từ Schema
const StoreOrder = mongoose.model("StoreOrder", storeOrderSchema);

module.exports = StoreOrder;
