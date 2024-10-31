const mongoose = require("mongoose");

const OrderReviewSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StoreOrder", // Liên kết đến đơn hàng
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Liên kết đến người dùng
    required: true,
  },
  store: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Store", // Liên kết đến cửa hàng
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    trim: true,
    default: "",
  },
  reviewDate: {
    type: Date,
    default: Date.now,
  },
});

const OrderReview = mongoose.model("orderReview", OrderReviewSchema);

module.exports = OrderReview;
