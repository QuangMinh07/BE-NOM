const OrderCancellation = require("../models/OrderCancellation");
const StoreOrder = require("../models/storeOrder");
const User = require("../models/user");
const PaymentTransaction = require("../models/PaymentTransaction");
const nodemailer = require("nodemailer");

// Hàm để yêu cầu hủy đơn hàng
const cancelOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params; // Lấy userId và orderId từ params
    const reason = req.body?.reason || "Không có lý do cụ thể"; // Kiểm tra và lấy lý do nếu có

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
    order.paymentStatus = "Failed"; // Cập nhật paymentStatus thành "Failed"
    await order.save(); // Lưu trạng thái đơn hàng

    // Tìm và cập nhật transactionStatus của giao dịch liên quan đến đơn hàng
    const transaction = await PaymentTransaction.findOne({ cart: order.cart });
    if (transaction) {
      transaction.transactionStatus = "Failed"; // Cập nhật transactionStatus thành "Failed"
      await transaction.save();
    } else {
      console.log("Không tìm thấy giao dịch cho giỏ hàng:", order.cart);
    }

    // Gọi hàm gửi email
    await sendCancellationEmails(orderId, reason);

    return res.status(200).json({ message: "Đã hủy đơn hàng thành công.", cancellationRequest });
  } catch (error) {
    console.error("Lỗi khi hủy đơn hàng:", error);
    return res.status(500).json({ message: "Lỗi khi hủy đơn hàng.", error: error.message });
  }
};

const getCancelledOrders = async (req, res) => {
  try {
    const cancelledOrders = await OrderCancellation.find({ cancellationStatus: "Canceled" }).populate("user", "fullName email").populate("order", "orderStatus orderDate items");

    if (!cancelledOrders.length) {
      return res.status(404).json({ message: "Không có đơn hàng đã hủy." });
    }

    return res.status(200).json({ message: "Danh sách đơn hàng đã hủy.", cancelledOrders });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách đơn hàng đã hủy:", error);
    return res.status(500).json({ message: "Lỗi khi lấy danh sách đơn hàng đã hủy.", error: error.message });
  }
};

const sendCancellationEmails = async (orderId, reason) => {
  try {
    // Tìm đơn hàng theo ID và populate thông tin khách hàng, cửa hàng và shipper
    const order = await StoreOrder.findById(orderId)
      .populate("user", "fullName email") // Lấy thông tin khách hàng
      .populate("store", "storeName owner") // Lấy thông tin cửa hàng
      .populate({
        path: "shipper", // Lấy thông tin shipper
        populate: {
          path: "userId", // Lấy thông tin user liên kết với shipper
          select: "email fullName", // Chỉ lấy email và fullName từ User
        },
      });

    if (!order) {
      console.error("Order not found:", orderId);
      return;
    }

    const customerEmail = order.user?.email;
    const customerName = order.user?.fullName || "Khách hàng";

    const storeOwnerId = order.store?.owner;
    let storeOwnerEmail = null;
    let storeOwnerName = "Chủ cửa hàng";

    // Lấy email và tên chủ cửa hàng từ User model
    if (storeOwnerId) {
      const storeOwner = await User.findById(storeOwnerId).select("email fullName");
      if (storeOwner) {
        storeOwnerEmail = storeOwner.email;
        storeOwnerName = storeOwner.fullName || storeOwnerName;
      }
    }

    // Gửi email cho khách hàng
    if (customerEmail) {
      const customerSubject = `Đơn hàng của bạn đã bị hủy: ${order._id}`;
      const customerMessage = `
      Kính gửi ${customerName},

      Đơn hàng của bạn (Mã: ${order._id}) đã bị hủy.
      - Lý do hủy: ${reason}
      - Tổng tiền: ${order.totalAmount.toLocaleString("vi-VN")} VND

      Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi. Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với đội ngũ hỗ trợ.

      Trân trọng,
      Đội ngũ hỗ trợ.
      `;
      await sendNotificationEmail(customerEmail, customerSubject, customerMessage);
      console.log(`Email hủy đơn hàng đã được gửi tới khách hàng: ${customerEmail}`);
    } else {
      console.log("Không tìm thấy email khách hàng để gửi thông báo.");
    }

    // Gửi email cho chủ cửa hàng
    if (storeOwnerEmail) {
      const storeSubject = `Đơn hàng đã bị hủy: ${order._id}`;
      const storeMessage = `
      Kính gửi ${storeOwnerName},

      Đơn hàng (Mã: ${order._id}) tại cửa hàng "${order.store.storeName}" của bạn đã bị hủy.
      - Lý do hủy: ${reason}
      - Tổng tiền: ${order.totalAmount.toLocaleString("vi-VN")} VND

      Hãy kiểm tra và xử lý nếu cần thiết.

      Trân trọng,
      Đội ngũ hỗ trợ.
      `;
      await sendNotificationEmail(storeOwnerEmail, storeSubject, storeMessage);
      console.log(`Email hủy đơn hàng đã được gửi tới cửa hàng: ${storeOwnerEmail}`);
    } else {
      console.log("Không tìm thấy email chủ cửa hàng để gửi thông báo.");
    }
  } catch (error) {
    console.error("Lỗi khi gửi email thông báo hủy đơn hàng:", error.message);
  }
};

const sendNotificationEmail = async (email, subject, message) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${email} with subject: ${subject}`);
  } catch (error) {
    console.error(`Error sending email to ${email}:`, error.message);
  }
};

module.exports = {
  cancelOrder,
  getCancelledOrders,
};
