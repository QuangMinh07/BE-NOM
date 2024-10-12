const Cart = require("../models/cart");
const PaymentTransaction = require("../models/PaymentTransaction");

// Hàm để tạo PaymentTransaction từ Cart
const createPaymentTransaction = async (req, res) => {
  try {
    const { paymentMethod, transactionAmount } = req.body;
    const { cartId, storeId } = req.params; // Lấy cartId và storeId từ params

    // Tìm giỏ hàng theo cartId và storeId
    const cart = await Cart.findOne({ _id: cartId, "items.store": storeId }).populate("paymentTransaction");

    if (!cart) {
      return res.status(404).json({ error: "Giỏ hàng hoặc cửa hàng không tồn tại." });
    }

    // Kiểm tra xem giỏ hàng đã có giao dịch thanh toán chưa
    if (cart.paymentTransaction) {
      return res.status(400).json({ error: "Giao dịch thanh toán cho giỏ hàng này đã tồn tại." });
    }

    // Bước 1: Tạo giao dịch thanh toán mới
    const newTransaction = new PaymentTransaction({
      cart: cart._id,
      store: storeId, // Thêm storeId vào giao dịch thanh toán
      paymentMethod, // Sử dụng phương thức thanh toán từ yêu cầu
      transactionAmount: transactionAmount || cart.totalPrice, // Sử dụng tổng giá từ Cart nếu không truyền vào
      transactionStatus: "Pending", // Đánh dấu trạng thái thanh toán là "Pending"
    });

    // Lưu giao dịch thanh toán vào cơ sở dữ liệu
    const savedTransaction = await newTransaction.save();

    // Bước 2: Cập nhật giỏ hàng để tham chiếu tới giao dịch thanh toán mới
    cart.paymentTransaction = savedTransaction._id;
    await cart.save(); // Lưu thông tin giỏ hàng đã liên kết với giao dịch thanh toán

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
