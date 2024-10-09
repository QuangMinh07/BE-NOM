const mongoose = require("mongoose");
const { Schema } = mongoose;

// Định nghĩa Schema cho PaymentTransaction
const paymentTransactionSchema = new Schema({
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cart", // Tham chiếu tới Cart hoặc đơn hàng
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["Momo", "VNPay", "BankCard", "Cash"], // Phương thức thanh toán
    required: true,
  },
  transactionAmount: {
    type: Number,
    required: true, // Số tiền giao dịch
  },
  transactionDate: {
    type: Date,
    default: Date.now, // Ngày giao dịch, mặc định là ngày hiện tại
  },
  transactionStatus: {
    type: String,
    enum: ["Pending", "Success", "Failed"], // Trạng thái giao dịch
    default: "Pending",
  },
});

// Tạo Model từ Schema
const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);

module.exports = PaymentTransaction;
