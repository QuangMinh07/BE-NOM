const Cart = require("../models/cart");
const PaymentTransaction = require("../models/PaymentTransaction");

// Hàm để tạo PaymentTransaction từ Cart
const createPaymentTransaction = async (req, res) => {
  try {
    const { paymentMethod, transactionAmount } = req.body;
    const { cartId } = req.params; // Lấy cartId từ params

    // Tìm giỏ hàng theo cartId
    const cart = await Cart.findById(cartId);
    if (!cart) {
      return res.status(404).json({ error: "Giỏ hàng không tồn tại." });
    }

    // Bước 1: Cập nhật phương thức thanh toán trong Cart
    cart.paymentMethod = paymentMethod;
    await cart.save(); // Lưu thông tin phương thức thanh toán vào giỏ hàng

    // Bước 2: Tạo giao dịch thanh toán mới và lấy phương thức thanh toán từ Cart
    const newTransaction = new PaymentTransaction({
      cart: cartId,
      paymentMethod: cart.paymentMethod, // Lấy từ Cart để đảm bảo giống nhau
      transactionAmount: transactionAmount || cart.totalPrice, // Sử dụng tổng giá từ Cart nếu không truyền vào
      transactionStatus: "Pending", // Đánh dấu trạng thái thanh toán là "Pending"
    });

    // Lưu giao dịch thanh toán vào cơ sở dữ liệu
    const savedTransaction = await newTransaction.save();

    res.status(201).json({
      message: "Giao dịch thanh toán được tạo thành công.",
      transaction: savedTransaction,
    });
  } catch (error) {
    console.error("Lỗi khi tạo giao dịch thanh toán:", error);
    res.status(500).json({ error: "Lỗi khi tạo giao dịch thanh toán." });
  }
};

module.exports = { createPaymentTransaction };
