const OrderCancellation = require("../models/OrderCancellation");
const StoreOrder = require("../models/storeOrder");
const User = require("../models/user");

// Hàm để yêu cầu hủy đơn hàng
const cancelOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params; // Lấy userId và orderId từ params
    const { reason } = req.body; // Lý do hủy đơn hàng truyền qua body

    // Kiểm tra người dùng có tồn tại không
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại." });
    }

    // Kiểm tra đơn hàng có tồn tại không
    const order = await StoreOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Đơn hàng không tồn tại." });
    }

    // Kiểm tra xem trạng thái đơn hàng có thể hủy được hay không
    if (order.orderStatus === "Cancelled") {
      return res.status(400).json({ message: "Đơn hàng đã bị hủy trước đó." });
    }

    // Tạo yêu cầu hủy đơn hàng với trạng thái là "Canceled"
    const cancellationRequest = new OrderCancellation({
      user: userId,
      order: orderId,
      cancellationReason: reason,
      cancellationStatus: "Canceled", // Trạng thái là "Canceled"
    });

    await cancellationRequest.save(); // Lưu yêu cầu hủy vào DB

    // Cập nhật trạng thái của đơn hàng thành "Cancelled"
    order.orderStatus = "Cancelled";
    await order.save(); // Lưu trạng thái đơn hàng

    return res.status(200).json({ message: "Đã hủy đơn hàng thành công.", cancellationRequest });
  } catch (error) {
    console.error("Lỗi khi hủy đơn hàng:", error);
    return res.status(500).json({ message: "Lỗi khi hủy đơn hàng.", error: error.message });
  }
};

module.exports = {
  cancelOrder,
};
