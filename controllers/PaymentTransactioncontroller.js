const PayOS = require("@payos/node");
const QRCode = require("qrcode"); // Import thư viện qrcode
const Cart = require("../models/cart");
const PaymentTransaction = require("../models/PaymentTransaction");
const User = require("../models/user");
require("dotenv").config();

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID;
const PAYOS_API_KEY = process.env.PAYOS_API_KEY;
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY;

if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) {
  console.error("Các biến môi trường PayOS chưa được thiết lập đầy đủ.");
}

const payOS = new PayOS(PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY);

console.log("PayOS Config:", payOS);

const createPaymentTransaction = async (req, res) => {
  try {
    const { paymentMethod, useLoyaltyPoints } = req.body;
    const { cartId, storeId } = req.params;

    const cart = await Cart.findOne({ _id: cartId, "items.store": storeId }).populate("items.food", "foodName price").populate("paymentTransaction").populate("user", "name email phone loyaltyPoints").populate("items.store", "storeName").populate("items.combos.foods.foodId", "foodName price");
    if (!cart) {
      return res.status(404).json({ error: "Giỏ hàng hoặc cửa hàng không tồn tại." });
    }

    // if (cart.paymentTransaction) {
    //   return res.status(400).json({ error: "Giao dịch thanh toán cho giỏ hàng này đã tồn tại." });
    // }

    if (cart.paymentTransaction) {
      // Nếu giao dịch đã tồn tại, chuyển sang cập nhật
      return updatePaymentTransaction(req, res);
    }

    const user = cart.user;
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    let discount = 0;
    if (useLoyaltyPoints) {
      discount = Math.min(user.loyaltyPoints || 0, cart.totalPrice);
    }

    const transactionAmount = Math.round(Math.max(0, cart.totalPrice - discount));
    const orderCode = Date.now();
    if (orderCode > 9007199254740991) {
      throw new Error("orderCode vượt quá giá trị tối đa cho phép.");
    }

    let paymentUrl = "";
    let qrCodeDataUrl = "";

    if (paymentMethod === "PayOS") {
      try {
        const paymentItems = (cart.items || []).map((item) => {
          if (!item.food || !item.food.foodName || !item.price || !item.quantity) {
            throw new Error(`Dữ liệu sản phẩm không hợp lệ: ${JSON.stringify(item)}`);
          }

          return {
            name: item.food.foodName,
            quantity: item.quantity,
            price: Math.round(item.price),
            code: item.food._id.toString(),
          };
        });

        if (paymentItems.length === 0) {
          throw new Error("Danh sách sản phẩm trong giỏ hàng trống.");
        }
        const customerInfo = {
          name: user.name || "Khách hàng",
          email: user.email || "email@example.com",
          phone: user.phone || "0123456789",
        };

        const returnUrl = `${process.env.SERVER_URL}/v1/PaymentTransaction/payment-success`;
        const cancelUrl = `${process.env.SERVER_URL}/v1/PaymentTransaction/payment-cancel`;
        const notifyUrl = `${process.env.SERVER_URL}/webhook/payos`;

        if (!returnUrl || !cancelUrl || !notifyUrl) {
          throw new Error("Các URL trả về, hủy bỏ hoặc thông báo không hợp lệ.");
        }
        let description = `Thanh toán đơn hàng ${orderCode}`;
        if (description.length > 25) {
          description = description.substring(0, 25);
        }

        const paymentLinkRequest = {
          orderCode: orderCode,
          amount: transactionAmount,
          currency: "VND",
          description: description,
          returnUrl: returnUrl,
          cancelUrl: cancelUrl,
          notifyUrl: notifyUrl,
          items: paymentItems,
          customerInfo: customerInfo,
          extraData: "",
        };
        for (const [key, value] of Object.entries(paymentLinkRequest)) {
          if (value === undefined || value === null) {
            throw new Error(`Trường ${key} bị thiếu hoặc không hợp lệ.`);
          }
        }

        console.log("paymentLinkRequest:", paymentLinkRequest);
        const paymentLinkResponse = await payOS.createPaymentLink(paymentLinkRequest);

        if (!paymentLinkResponse || !paymentLinkResponse.checkoutUrl) {
          throw new Error("Không thể tạo liên kết thanh toán PayOS");
        }

        paymentUrl = paymentLinkResponse.checkoutUrl;

        qrCodeDataUrl = paymentLinkResponse.qrCode;
      } catch (payosError) {
        console.error("Lỗi khi tạo payment link PayOS:", payosError);
        return res.status(500).json({
          error: "Không thể tạo liên kết thanh toán PayOS",
          details: payosError.message,
        });
      }
    }

    if (cart.paymentTransaction) {
      // Nếu đã có giao dịch thanh toán, cập nhật thay vì tạo mới
      const transaction = await PaymentTransaction.findById(cart.paymentTransaction);
      if (!transaction) {
        return res.status(404).json({ error: "Không tìm thấy giao dịch thanh toán liên kết với giỏ hàng này." });
      }

      let discount = 0;
      if (useLoyaltyPoints) {
        discount = Math.min(cart.user.loyaltyPoints || 0, cart.totalPrice);
      }

      transaction.paymentMethod = paymentMethod;
      transaction.transactionAmount = Math.round(Math.max(0, cart.totalPrice - discount));
      transaction.transactionDate = new Date();
      await transaction.save();

      return res.status(200).json({
        message: "Cập nhật giao dịch thanh toán thành công.",
        transaction,
      });
    }

    const newTransaction = new PaymentTransaction({
      cart: cart._id,
      paymentMethod,
      transactionAmount: transactionAmount,
      transactionStatus: "Pending",
      transactionDate: new Date(),
      paymentUrl,
      orderCode,
      useLoyaltyPoints, // Thêm trường này
      cartSnapshot: {
        totalPrice: cart.totalPrice,
        deliveryAddress: cart.deliveryAddress,
        receiverName: cart.receiverName,
        receiverPhone: cart.receiverPhone,
        items: cart.items.map((item) => ({
          foodName: item.food.foodName,
          storeName: item.store.storeName,
          quantity: item.quantity,
          price: item.price,
          combos: item.combos
            ? {
                totalPrice: item.combos.totalPrice,
                totalQuantity: item.combos.totalQuantity,
                foods: item.combos.foods.map((comboFood) => ({
                  foodName: comboFood.foodId.foodName,
                  price: comboFood.price,
                })),
              }
            : null,
        })),
      },
    });

    const savedTransaction = await newTransaction.save();

    cart.paymentTransaction = savedTransaction._id;
    await cart.save();

    res.status(201).json({
      message: "Giao dịch thanh toán được tạo thành công.",
      transaction: savedTransaction,
      paymentLink: paymentUrl,
      qrCode: qrCodeDataUrl,
      discountedTotal: transactionAmount,
    });
  } catch (error) {
    console.error("Lỗi khi tạo giao dịch thanh toán:", error);
    res.status(500).json({
      error: "Lỗi khi tạo giao dịch thanh toán.",
      details: error.message,
    });
  }
};

const updatePaymentTransaction = async (req, res) => {
  try {
    const { paymentMethod, useLoyaltyPoints } = req.body;
    const { cartId, storeId } = req.params;

    const cart = await Cart.findOne({ _id: cartId, "items.store": storeId })
      .populate("paymentTransaction")
      .populate({
        path: "items.food",
        select: "foodName",
      })
      .populate("user", "name email phone loyaltyPoints");

    if (!cart) {
      return res.status(404).json({ error: "Giỏ hàng hoặc cửa hàng không tồn tại." });
    }

    const user = cart.user;
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    if (!cart.paymentTransaction) {
      return res.status(404).json({ error: "Không có giao dịch thanh toán nào để cập nhật." });
    }

    const transaction = await PaymentTransaction.findById(cart.paymentTransaction);
    if (!transaction) {
      return res.status(404).json({ error: "Không tìm thấy giao dịch thanh toán liên kết với giỏ hàng này." });
    }

    let discount = 0;
    if (useLoyaltyPoints) {
      discount = Math.min(user.loyaltyPoints || 0, cart.totalPrice);
    }

    const transactionAmount = Math.round(Math.max(0, cart.totalPrice - discount));
    const orderCode = transaction.orderCode || Date.now(); // Dùng mã đơn hàng cũ hoặc tạo mới nếu cần

    let paymentUrl = transaction.paymentUrl; // Giữ URL thanh toán cũ nếu không cần cập nhật
    let qrCodeDataUrl = transaction.qrCode || ""; // Giữ mã QR cũ nếu không cần cập nhật

    // Nếu phương thức thanh toán là PayOS, xử lý lại logic tương tự
    if (paymentMethod === "PayOS") {
      try {
        const paymentItems = (cart.items || []).map((item) => {
          if (!item.food || !item.food.foodName || !item.price || !item.quantity) {
            throw new Error(`Dữ liệu sản phẩm không hợp lệ: ${JSON.stringify(item)}`);
          }

          return {
            name: item.food.foodName,
            quantity: item.quantity,
            price: Math.round(item.price),
            code: item.food._id.toString(),
          };
        });

        if (paymentItems.length === 0) {
          throw new Error("Danh sách sản phẩm trong giỏ hàng trống.");
        }

        const customerInfo = {
          name: user.name || "Khách hàng",
          email: user.email || "email@example.com",
          phone: user.phone || "0123456789",
        };

        const returnUrl = `${process.env.SERVER_URL}/payment-success`;
        const cancelUrl = `${process.env.SERVER_URL}/payment-cancel`;
        const notifyUrl = `${process.env.SERVER_URL}/webhook/payos`;

        if (!returnUrl || !cancelUrl || !notifyUrl) {
          throw new Error("Các URL trả về, hủy bỏ hoặc thông báo không hợp lệ.");
        }

        let description = `Thanh toán đơn hàng ${orderCode}`;
        if (description.length > 25) {
          description = description.substring(0, 25);
        }

        const paymentLinkRequest = {
          orderCode: orderCode,
          amount: transactionAmount,
          currency: "VND",
          description: description,
          returnUrl: returnUrl,
          cancelUrl: cancelUrl,
          notifyUrl: notifyUrl,
          items: paymentItems,
          customerInfo: customerInfo,
          extraData: "",
        };

        console.log("paymentLinkRequest (update):", paymentLinkRequest);
        const paymentLinkResponse = await payOS.createPaymentLink(paymentLinkRequest);

        if (!paymentLinkResponse || !paymentLinkResponse.checkoutUrl) {
          throw new Error("Không thể tạo liên kết thanh toán PayOS");
        }

        paymentUrl = paymentLinkResponse.checkoutUrl;

        // Tạo lại mã QR nếu URL thanh toán thay đổi
        qrCodeDataUrl = paymentLinkResponse.qrCode;
      } catch (payosError) {
        console.error("Lỗi khi tạo payment link PayOS (update):", payosError);
        return res.status(500).json({
          error: "Không thể tạo lại liên kết thanh toán PayOS",
          details: payosError.message,
        });
      }
    }

    // Cập nhật thông tin giao dịch
    transaction.paymentMethod = paymentMethod;
    transaction.transactionAmount = transactionAmount;
    transaction.transactionStatus = "Pending"; // Có thể tùy chỉnh trạng thái nếu cần
    transaction.transactionDate = new Date();
    transaction.paymentUrl = paymentUrl; // Cập nhật URL mới nếu có
    transaction.qrCode = qrCodeDataUrl; // Cập nhật mã QR mới nếu có

    await transaction.save();

    res.status(200).json({
      message: "Cập nhật giao dịch thanh toán thành công.",
      transaction,
      paymentLink: paymentUrl,
      qrCode: qrCodeDataUrl,
      discountedTotal: transactionAmount,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật giao dịch thanh toán:", error);
    res.status(500).json({
      error: "Lỗi khi cập nhật giao dịch thanh toán.",
      details: error.message,
    });
  }
};

const deletePaymentTransaction = async (orderCode) => {
  try {
    const transaction = await PaymentTransaction.findOne({ orderCode });

    if (!transaction) {
      throw new Error("Không tìm thấy giao dịch thanh toán với orderCode đã cung cấp.");
    }

    // Xóa giao dịch thanh toán
    await PaymentTransaction.deleteOne({ _id: transaction._id });

    return { success: true, message: "Phương thức thanh toán đã được xóa thành công." };
  } catch (error) {
    console.error("Lỗi khi xóa phương thức thanh toán:", error.message);
    return { success: false, message: error.message };
  }
};

module.exports = { createPaymentTransaction, updatePaymentTransaction, deletePaymentTransaction };
