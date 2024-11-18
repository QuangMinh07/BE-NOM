const express = require("express");
const router = express.Router();
const { createPaymentTransaction } = require("../controllers/PaymentTransactioncontroller"); // Đường dẫn tới hàm addStaff
const { authenticateToken } = require("../middlewares/authMiddleware");
const PaymentTransaction = require("../models/PaymentTransaction");
const Cart = require("../models/cart");

// Route POST thêm nhân viên mới
router.post("/create-payment/:cartId/:storeId", authenticateToken, createPaymentTransaction);

// router.get("/payment-success", async (req, res) => {
//   try {
//     const { orderCode, transactionId, status } = req.query;
//     if (status !== "SUCCESS") {
//       return res.send("Giao dịch không thành công.");
//     }
//     const paymentTransaction = await PaymentTransaction.findOne({ orderCode });

//     if (!paymentTransaction) {
//       return res.status(404).send("Không tìm thấy giao dịch.");
//     }
//     paymentTransaction.transactionStatus = "Success";
//     await paymentTransaction.save();
//     res.send("Thanh toán thành công! Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.");
//   } catch (error) {
//     console.error("Lỗi khi xử lý thanh toán thành công:", error);
//     res.status(500).send("Đã xảy ra lỗi khi xử lý thanh toán.");
//   }
// });

router.get("/payment-success", async (req, res) => {
  try {
    const { orderCode, status } = req.query;

    if (status !== "SUCCESS") {
      return res.send("Giao dịch không thành công.");
    }

    // Tìm giao dịch thanh toán
    const paymentTransaction = await PaymentTransaction.findOne({ orderCode });

    if (!paymentTransaction) {
      return res.status(404).send("Không tìm thấy giao dịch.");
    }

    // Cập nhật trạng thái thanh toán
    paymentTransaction.transactionStatus = "Success";
    await paymentTransaction.save();
    // Tạo đơn hàng tự động
    const cart = await Cart.findById(paymentTransaction.cart).populate("items.food");

    if (!cart) {
      return res.status(404).send("Giỏ hàng không tồn tại.");
    }

    const newOrder = new StoreOrder({
      store: cart.items[0].store, // Giả sử tất cả món thuộc cùng một cửa hàng
      user: cart.user,
      cart: cart._id,
      cartSnapshot, // Lưu snapshot của giỏ hàng
      foods: cart.items.map((item) => item.food._id), // Tham chiếu đến các món ăn
      totalAmount: paymentTransaction.transactionAmount, // Tổng số tiền từ giỏ hàng
      deliveryAddress: cart.deliveryAddress, // Địa chỉ lấy từ giỏ hàng
      receiverName: cart.receiverName, // Tên người nhận lấy từ giỏ hàng
      receiverPhone: cart.receiverPhone, // Số điện thoại người nhận lấy từ giỏ hàng
      orderDate: new Date(), // Thời gian tạo đơn hàng là hiện tại
      orderStatus: "Pending", // Trạng thái đơn hàng ban đầu là "Pending"
      paymentStatus: "Paid", // Trạng thái thanh toán ban đầu là "Pending"
      paymentMethod: paymentMethod, // Thêm phương thức thanh toán
      useLoyaltyPoints: useLoyaltyPoints || false, // Lưu trạng thái sử dụng điểm tích lũy
    });

    await newOrder.save();

    // Xóa giỏ hàng
    await Cart.findByIdAndDelete(cart._id);

    res.send("Thanh toán thành công! Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi.");
  } catch (error) {
    console.error("Lỗi khi xử lý thanh toán thành công:", error);
    res.status(500).send("Đã xảy ra lỗi khi xử lý thanh toán.");
  }
});

router.get("/payment-cancel", async (req, res) => {
  try {
    const { orderCode } = req.query;
    const paymentTransaction = await PaymentTransaction.findOne({ orderCode });

    if (!paymentTransaction) {
      return res.status(404).send("Không tìm thấy giao dịch.");
    }
    paymentTransaction.transactionStatus = "Failed";
    await paymentTransaction.save();
    res.send("Bạn đã hủy giao dịch thanh toán.");
  } catch (error) {
    console.error("Lỗi khi xử lý hủy thanh toán:", error);
    res.status(500).send("Đã xảy ra lỗi khi xử lý hủy thanh toán.");
  }
});

module.exports = router;
