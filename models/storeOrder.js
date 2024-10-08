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
  cart: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Cart", // Tham chiếu đến giỏ hàng
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
    enum: ["Pending", "Paid", "Failed"],
    default: "Pending",
  },
  foods: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Food", // Tham chiếu đến món ăn
      required: true,
    },
  ],
});

// Phương thức cập nhật phương thức thanh toán và tạo PaymentTransaction
storeOrderSchema.methods.updatePaymentMethod = async function (newPaymentMethod) {
  const validMethods = ["Momo", "VNPay", "BankCard", "Cash"];
  if (!validMethods.includes(newPaymentMethod)) {
    throw new Error("Phương thức thanh toán không hợp lệ");
  }

  // Cập nhật phương thức thanh toán của đơn hàng
  this.paymentMethod = newPaymentMethod;
  await this.save();

  // Tạo giao dịch thanh toán mới trong PaymentTransaction
  const PaymentTransaction = require("./PaymentTransaction"); // Tham chiếu tới PaymentTransaction model
  const newTransaction = new PaymentTransaction({
    cart: this._id, // Tham chiếu đến đơn hàng (hoặc giỏ hàng)
    paymentMethod: newPaymentMethod,
    transactionAmount: this.totalAmount,
    transactionStatus: "Pending", // Trạng thái giao dịch có thể cập nhật sau
  });

  await newTransaction.save(); // Lưu giao dịch
};

// Tạo Model từ Schema
const StoreOrder = mongoose.model("StoreOrder", storeOrderSchema);

module.exports = StoreOrder;
