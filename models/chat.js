const mongoose = require("mongoose");

const chatSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // ID khách hàng
    shipperId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipper", required: true }, // ID shipper
    messages: [
      {
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // ID người gửi
        receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // ID người nhận
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Chat", chatSchema);
