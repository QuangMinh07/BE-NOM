const mongoose = require("mongoose");

const ReplySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User", // Liên kết đến người trả lời (cửa hàng hoặc người dùng)
    required: true,
  },
  replyText: {
    type: String,
    required: true,
    trim: true,
  },
  replyDate: {
    type: Date,
    default: Date.now,
  },
});

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
  replies: [ReplySchema], // Danh sách phản hồi của cửa hàng
});

const OrderReview = mongoose.model("OrderReview", OrderReviewSchema);

module.exports = OrderReview;
