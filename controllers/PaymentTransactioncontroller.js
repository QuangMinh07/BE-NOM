const Cart = require("../models/cart");
const PaymentTransaction = require("../models/PaymentTransaction");
const User = require("../models/user");

// Hàm để tạo PaymentTransaction từ Cart
const createPaymentTransaction = async (req, res) => {
  try {
    const { paymentMethod, useLoyaltyPoints } = req.body;
    const { cartId, storeId } = req.params;

    // Tìm giỏ hàng theo cartId và storeId
    const cart = await Cart.findOne({ _id: cartId, "items.store": storeId }).populate("paymentTransaction");
    if (!cart) {
      return res.status(404).json({ error: "Giỏ hàng hoặc cửa hàng không tồn tại." });
    }

    // Kiểm tra nếu giỏ hàng đã có giao dịch thanh toán
    if (cart.paymentTransaction) {
      return res.status(400).json({ error: "Giao dịch thanh toán cho giỏ hàng này đã tồn tại." });
    }

    // Tính toán giảm giá (discount)
    let discount = 0;
    if (useLoyaltyPoints) {
      const user = await User.findById(cart.user); // Tìm người dùng
      if (!user) {
        return res.status(404).json({ error: "Người dùng không tồn tại." });
      }
      if (user.loyaltyPoints > 0) {
        discount = Math.min(user.loyaltyPoints, cart.totalPrice); // Áp dụng giảm giá
      }
    }

    // Cập nhật `cart` để đảm bảo giảm giá được phản ánh đúng
    const transactionAmount = Math.max(0, cart.totalPrice - discount);

    console.log("Cart Total Price:", cart.totalPrice);
    console.log("Discount:", discount);
    console.log("Transaction Amount:", transactionAmount);

    // Tạo giao dịch thanh toán mới
    const newTransaction = new PaymentTransaction({
      cart: cart._id,
      store: storeId,
      paymentMethod,
      transactionAmount, // Tổng giá trị sau giảm giá
      transactionStatus: "Pending",
      transactionDate: new Date(),
    });

    // Lưu giao dịch thanh toán vào cơ sở dữ liệu
    const savedTransaction = await newTransaction.save();

    // Cập nhật giỏ hàng để tham chiếu tới giao dịch thanh toán mới
    cart.paymentTransaction = savedTransaction._id;
    await cart.save();

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
