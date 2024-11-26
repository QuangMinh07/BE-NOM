const mongoose = require("mongoose");
const { Schema } = mongoose;

// Định nghĩa Schema cho PaymentTransaction
const paymentTransactionSchema = new Schema({
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cart",
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["Momo", "VNPay", "BankCard", "Cash", "PayOS"],
    required: true,
  },
  transactionAmount: {
    type: Number,
    required: true,
  },
  transactionDate: {
    type: Date,
    default: Date.now,
  },
  transactionStatus: {
    type: String,
    enum: ["Pending", "Success", "Failed"],
    default: "Pending",
  },
  paymentUrl: {
    type: String,
    required: function () {
      return this.paymentMethod === "PayOS";
    },
  }, // Chỉ bắt buộc nếu là PayOS

  orderCode: {
    type: String,
    required: true,
    unique: true,
  },

  useLoyaltyPoints: { type: Boolean, default: false }, // Thêm trường này
});

const PaymentTransaction = mongoose.model("PaymentTransaction", paymentTransactionSchema);

module.exports = PaymentTransaction;
