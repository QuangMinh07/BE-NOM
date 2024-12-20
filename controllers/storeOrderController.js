const StoreOrder = require("../models/storeOrder");
const ShipperInfo = require("../models/shipper");
const Cart = require("../models/cart");
const User = require("../models/user");
const Chat = require("../models/chat");
const PaymentTransaction = require("../models/PaymentTransaction");
const { cancelOrder } = require("../controllers/OrderCancellationController"); // Import hàm hủy đơn hàng
const nodemailer = require("nodemailer");
const Store = require("../models/store");

const createOrderFromCart = async (req, res) => {
  try {
    const { cartId } = req.params; // Lấy cartId từ params
    const { useLoyaltyPoints } = req.body; // Lấy trạng thái sử dụng điểm tích lũy từ body
    console.log("Received useLoyaltyPoints:", useLoyaltyPoints); // Log giá trị nhận được

    // Tìm giỏ hàng theo cartId và populate thông tin món ăn
    const cart = await Cart.findById(cartId)
      .populate({
        path: "items.food",
        select: "foodName price",
      })
      .populate({
        path: "items.combos.foods.foodId",
        select: "foodName price",
      })
      .populate({
        path: "paymentTransaction", // Liên kết đến PaymentTransaction
        select: "paymentMethod transactionAmount transactionDate transactionStatus paymentUrl orderCode", // Chọn các trường bạn cần lấy
      });
    if (!cart) {
      return res.status(404).json({ error: "Giỏ hàng không tồn tại." });
    }

    // Log toàn bộ thông tin giỏ hàng và thông tin giao dịch thanh toán
    console.log("Cart Details:", cart);

    // Kiểm tra thông tin người dùng
    const user = await User.findById(cart.user);
    if (!user) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    const paymentTransaction = cart.paymentTransaction; // Đảm bảo paymentTransaction đã được populate từ giỏ hàng
    // Kiểm tra phương thức thanh toán
    if (!paymentTransaction) {
      return res.status(400).json({ error: "Vui lòng chọn phương thức thanh toán trước khi thanh toán." });
    }

    // Kiểm tra địa chỉ giao hàng
    if (!cart.deliveryAddress) {
      return res.status(400).json({ error: "Vui lòng nhập địa chỉ giao hàng trước khi thanh toán." });
    }

    let discount = 0; // Số tiền giảm giá (nếu sử dụng điểm tích lũy)
    let loyaltyPointsUsed = 0; // Điểm tích lũy đã sử dụng

    if (useLoyaltyPoints) {
      // Kiểm tra nếu người dùng có đủ điểm tích lũy
      if (user.loyaltyPoints <= 0) {
        return res.status(400).json({ error: "Bạn không có điểm tích lũy để sử dụng." });
      }

      // Tính toán số điểm tích lũy được sử dụng, không vượt quá giá trị đơn hàng
      discount = Math.min(user.loyaltyPoints, cart.totalPrice); // Giảm tối đa bằng giá trị đơn hàng
      loyaltyPointsUsed = discount; // Ghi lại số điểm đã sử dụng
      user.loyaltyPoints -= discount; // Trừ toàn bộ điểm đã sử dụng
      await user.save(); // Lưu lại điểm tích lũy đã cập nhật
    }

    // Kiểm tra nếu phương thức thanh toán có trong giỏ hàng
    const paymentMethod = paymentTransaction.paymentMethod; // Lấy phương thức thanh toán từ paymentTransaction

    let paymentStatus = "Pending"; // Mặc định paymentStatus là "Pending"
    if (paymentMethod === "PayOS") {
      paymentStatus = "Paid"; // Nếu là PayOS thì paymentStatus là "Paid"
    }

    // Tạo danh sách món ăn từ giỏ hàng
    const foodDetails = cart.items.map((item) => ({
      foodName: item.food.foodName,
      quantity: item.quantity,
      price: item.price,
    }));

    // Tạo snapshot của giỏ hàng trước khi xóa
    const cartSnapshot = {
      totalPrice: cart.totalPrice,
      deliveryAddress: cart.deliveryAddress,
      receiverName: cart.receiverName,
      receiverPhone: cart.receiverPhone,
      items: cart.items.map((item) => ({
        foodName: item.food.foodName,
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
    };

    // Cập nhật totalAmount sau khi áp dụng discount
    const totalAmount = cart.totalPrice - discount;

    // Tạo đơn hàng mới từ thông tin giỏ hàng, bao gồm snapshot
    const newOrder = new StoreOrder({
      store: cart.items[0].store, // Giả sử tất cả món thuộc cùng một cửa hàng
      user: cart.user,
      cart: cart._id,
      cartSnapshot, // Lưu snapshot của giỏ hàng
      foods: cart.items.map((item) => item.food._id), // Tham chiếu đến các món ăn
      totalAmount: totalAmount, // Tổng số tiền từ giỏ hàng
      deliveryAddress: cart.deliveryAddress, // Địa chỉ lấy từ giỏ hàng
      receiverName: cart.receiverName, // Tên người nhận lấy từ giỏ hàng
      receiverPhone: cart.receiverPhone, // Số điện thoại người nhận lấy từ giỏ hàng
      orderDate: new Date(), // Thời gian tạo đơn hàng là hiện tại
      orderStatus: "Pending", // Trạng thái đơn hàng ban đầu là "Pending"
      paymentStatus: paymentStatus, // Trạng thái thanh toán ban đầu là "Pending"
      paymentMethod: paymentMethod, // Thêm phương thức thanh toán
      useLoyaltyPoints: useLoyaltyPoints || false, // Lưu trạng thái sử dụng điểm tích lũy
      loyaltyPointsUsed,
    });

    // Lưu đơn hàng vào cơ sở dữ liệu
    const savedOrder = await newOrder.save();

    // Xóa giỏ hàng trong MongoDB sau khi tạo đơn hàng thành công
    await Cart.findByIdAndDelete(cartId);

    // Thực hiện populate cho user và store sau khi lưu đơn hàng
    const populatedOrder = await StoreOrder.findById(savedOrder._id)
      .populate("user", "fullName") // Lấy tên người dùng
      .populate("store", "storeName"); // Lấy tên cửa hàng

    // Truy vấn để lấy thông tin `store`
    const store = await Store.findById(savedOrder.store).select("storeName owner");

    // Truy vấn để lấy thông tin `owner`
    const storeOwner = await User.findById(store.owner).select("email fullName");

    // Gửi email cho cửa hàng khi đơn hàng được tạo
    if (storeOwner.email) {
      const storeSubject = `Đơn hàng mới từ cửa hàng: ${store.storeName}`;
      const storeMessage = `
      Kính gửi ${storeOwner.fullName},

      Một đơn hàng mới đã được tạo tại cửa hàng "${store.storeName}" của bạn.
      - Mã đơn hàng: ${savedOrder._id}
      - Khách hàng: ${user.fullName}
      - Tổng tiền: ${savedOrder.totalAmount.toLocaleString("vi-VN")} VND
      - Phương thức thanh toán: ${paymentMethod === "Cash" ? "Tiền mặt" : "Online qua PayOS"}
      - Ngày đặt hàng: ${new Date(savedOrder.orderDate).toLocaleString("vi-VN")}

      Vui lòng kiểm tra và xử lý đơn hàng kịp thời.

      Trân trọng,
      Đội ngũ hỗ trợ.
      `;
      await sendNotificationEmail(storeOwner.email, storeSubject, storeMessage);
      console.log(`Email thông báo đơn hàng mới đã được gửi tới cửa hàng: ${storeOwner.email}`);
    } else {
      console.log("Không tìm thấy email của chủ cửa hàng.");
    }

    // Trả về toàn bộ thông tin đơn hàng và các chi tiết bao gồm ID và tên người dùng và cửa hàng
    res.status(201).json({
      message: "Đơn hàng được tạo thành công.",
      orderDetails: {
        orderId: populatedOrder._id,
        user: {
          userId: populatedOrder.user._id, // Hiển thị ID người dùng
          fullName: populatedOrder.user.fullName, // Hiển thị tên người dùng
        },
        store: {
          storeId: populatedOrder.store._id, // Hiển thị ID cửa hàng
          storeName: populatedOrder.store.storeName, // Hiển thị tên cửa hàng
        },
        foods: foodDetails, // Chi tiết món ăn: tên, số lượng, giá
        totalAmount: populatedOrder.totalAmount,
        deliveryAddress: populatedOrder.deliveryAddress,
        receiverName: populatedOrder.receiverName,
        receiverPhone: populatedOrder.receiverPhone,
        orderDate: populatedOrder.orderDate,
        orderStatus: populatedOrder.orderStatus,
        paymentStatus: populatedOrder.paymentStatus,
        paymentMethod: populatedOrder.paymentMethod, // Phương thức thanh toán
        cartSnapshot: populatedOrder.cartSnapshot, // Thêm thông tin snapshot của giỏ hàng
        loyaltyPointsUsed, // Điểm tích lũy đã sử dụng
      },
    });

    // Thiết lập kiểm tra tự động hủy sau 1 phút nếu đơn hàng vẫn chưa được xác nhận
    setTimeout(async () => {
      try {
        const updatedOrder = await StoreOrder.findById(savedOrder._id);

        if (!updatedOrder) {
          console.log(`Không tìm thấy đơn hàng ${savedOrder._id}`);
          return;
        }

        // Kiểm tra trạng thái đơn hàng, nếu là "Pending" hoặc "Processing" thì hủy
        if (["Pending", "Processing"].includes(updatedOrder.orderStatus)) {
          await cancelOrder(
            { params: { userId: cart.user, orderId: savedOrder._id } },
            {
              status: () => ({
                json: (data) => console.log(`Đơn hàng ${savedOrder._id} đã bị hủy tự động sau 5 phút:`, data),
              }),
            }
          );
        } else {
          console.log(`Đơn hàng ${savedOrder._id} không bị hủy vì trạng thái hiện tại là: ${updatedOrder.orderStatus}`);
        }
      } catch (error) {
        console.error(`Lỗi khi kiểm tra hoặc hủy đơn hàng ${savedOrder._id}:`, error.message);
      }
    }, 5 * 60 * 1000); // Hủy sau 5 phút
  } catch (error) {
    console.error("Lỗi khi tạo đơn hàng từ giỏ hàng:", error);
    res.status(500).json({ error: "Lỗi khi tạo đơn hàng." });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;

    // Tìm đơn hàng theo orderId và populate thông tin người dùng, cửa hàng, shipper và món ăn
    const order = await StoreOrder.findById(orderId)
      .populate("user", "fullName")
      .populate("store", "storeName storeAddress")
      .populate({
        path: "foods",
        select: "foodName price",
      })
      .populate({
        path: "shipper",
        populate: {
          path: "userId",
          select: "fullName",
        },
        select: "temporaryAddress vehicleNumber bankAccount",
      });

    if (!order) {
      return res.status(404).json({ message: "Đơn hàng không tồn tại." });
    }

    // Lấy thông tin snapshot giỏ hàng (cartSnapshot) từ đơn hàng
    const cartSnapshot = order.cartSnapshot ? order.cartSnapshot : null;

    // Kiểm tra xem user, store và shipper có tồn tại không
    const user = order.user ? order.user : null;
    const store = order.store ? order.store : null;
    const shipper = order.shipper ? order.shipper : null;

    // Chuẩn bị dữ liệu trả về
    const orderDetails = {
      orderId: order._id,
      store: store
        ? {
            storeId: store._id,
            storeName: store.storeName,
            storeAddress: store.storeAddress,
          }
        : null,
      user: user
        ? {
            userId: user._id,
            fullName: user.fullName,
          }
        : null,
      foods: order.foods.map((food) => ({
        foodId: food._id,
        foodName: food.foodName,
        price: food.price,
        quantity: order.foods.find((f) => f._id.equals(food._id)).quantity, // Giả sử bạn lưu quantity
      })),
      cartSnapshot: cartSnapshot
        ? {
            totalPrice: cartSnapshot.totalPrice,
            deliveryAddress: cartSnapshot.deliveryAddress,
            receiverName: cartSnapshot.receiverName,
            receiverPhone: cartSnapshot.receiverPhone,
            items: cartSnapshot.items.map((item) => ({
              foodName: item.foodName,
              quantity: item.quantity,
              price: item.price,
              combos: item.combos
                ? {
                    totalPrice: item.combos.totalPrice,
                    totalQuantity: item.combos.totalQuantity,
                    foods: item.combos.foods.map((combo) => ({
                      foodName: combo.foodName,
                      price: combo.price,
                    })),
                  }
                : null,
            })),
          }
        : null,
      shipper: shipper
        ? {
            shipperId: shipper._id,
            fullName: shipper.userId.fullName,
            temporaryAddress: shipper.temporaryAddress,
            vehicleNumber: shipper.vehicleNumber,
            bankAccount: shipper.bankAccount,
          }
        : null,
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      loyaltyPointsUsed: order.loyaltyPointsUsed || 0, // Điểm tích lũy đã sử dụng
    };

    res.status(200).json({ message: "Chi tiết đơn hàng", orderDetails });
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết đơn hàng:", error);
    res.status(500).json({ error: "Lỗi khi lấy chi tiết đơn hàng." });
  }
};

// Lấy tất cả đơn hàng
const getAllOrders = async (req, res) => {
  try {
    // Lấy tất cả các đơn hàng và populate thông tin người dùng và cửa hàng
    const orders = await StoreOrder.find()
      .populate("user", "fullName") // Lấy tên người dùng
      .populate("store", "storeName imageURL") // Lấy tên cửa hàng và ảnh
      .populate("foods", "foodName price imageUrl _id quantity"); // Lấy tên và giá món ăn

    // Nếu không có đơn hàng
    if (orders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào." });
    }

    // Chuẩn bị dữ liệu trả về
    const allOrdersDetails = orders.map((order) => ({
      orderId: order._id,
      user: {
        userId: order.user._id,
        fullName: order.user.fullName,
      },
      store: {
        storeId: order.store._id,
        storeName: order.store.storeName,
        imageURL: order.store.imageURL, // Đảm bảo lấy imageURL từ store
      },
      foods: order.foods.map((food) => ({
        foodId: food._id,
        foodName: food.foodName,
        price: food.price,
        imageUrl: food.imageUrl,
        quantity: food.quantity, // Giả sử bạn lưu quantity
        userId: order.user._id, // Thêm userId cho mỗi món ăn
      })),
      cartSnapshotItems: order.cartSnapshot.items.map((item) => ({
        foodName: item.foodName,
        quantity: item.quantity, // Lấy quantity từ cartSnapshot.items
        price: item.price,
        foodId: item._id,
      })),
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    }));

    // Trả về tất cả đơn hàng
    res.status(200).json({ message: "Danh sách đơn hàng", allOrdersDetails });
  } catch (error) {
    console.error("Lỗi khi lấy tất cả đơn hàng:", error);
    res.status(500).json({ error: "Lỗi khi lấy tất cả đơn hàng." });
  }
};

// Cập nhật phương thức thanh toán cho đơn hàng
const updatePaymentMethod = async (req, res) => {
  const { orderId, paymentMethod } = req.body; // Lấy id của đơn hàng và phương thức thanh toán từ request

  try {
    const order = await StoreOrder.findById(orderId); // Tìm đơn hàng theo id
    if (!order) {
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    }

    // Cập nhật phương thức thanh toán
    await order.updatePaymentMethod(paymentMethod);

    return res.status(200).json({ message: "Phương thức thanh toán đã được cập nhật." });
  } catch (error) {
    return res.status(500).json({ message: "Có lỗi xảy ra", error: error.message });
  }
};

const { Expo } = require("expo-server-sdk");

// Khởi tạo một thể hiện của Expo SDK
let expo = new Expo();

const updateOrderStatus = async (req, res) => {
  const { orderId } = req.body; // Lấy orderId từ body của request
  const { storeId, userId } = req.params; // Lấy storeId và userId từ params của URL

  try {
    // Tìm đơn hàng theo ID
    const order = await StoreOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Đơn hàng không tồn tại" });
    }

    // Kiểm tra xem đơn hàng có thuộc về cửa hàng hiện tại hay không
    if (!order.store.equals(storeId)) {
      return res.status(403).json({ message: "Bạn không có quyền cập nhật đơn hàng này" });
    }

    // Danh sách trạng thái hợp lệ theo thứ tự
    const statusOrder = ["Pending", "Processing", "Shipped", "Completed", "Received", "Delivered", "Cancelled"];

    // Lấy chỉ mục của trạng thái hiện tại
    const currentStatusIndex = statusOrder.indexOf(order.orderStatus);

    // Nếu trạng thái hiện tại là cuối cùng hoặc đã bị hủy, không thể cập nhật tiếp
    if (currentStatusIndex === -1 || currentStatusIndex === statusOrder.length - 1 || order.orderStatus === "Cancelled") {
      return res.status(400).json({ message: "Không thể cập nhật thêm trạng thái đơn hàng" });
    }

    // Chuyển sang trạng thái tiếp theo
    const nextStatus = statusOrder[currentStatusIndex + 1];
    order.orderStatus = nextStatus;

    // Kiểm tra vai trò người dùng để xác định xem có phải shipper không
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (user.roleId === "shipper") {
      // Nếu người dùng là shipper, lấy thông tin shipper liên kết với người dùng
      const shipperInfo = await ShipperInfo.findOne({ userId: user._id });
      if (!shipperInfo) {
        return res.status(404).json({ message: "Không tìm thấy thông tin shipper" });
      }
      order.shipper = shipperInfo._id; // Cập nhật shipperId vào đơn hàng
    }

    // Nếu trạng thái chuyển sang "Delivered", cập nhật paymentStatus
    if (nextStatus === "Delivered") {
      // Cập nhật paymentStatus thành "Paid"
      order.paymentStatus = "Paid";
      console.log("paymentStatus đã được cập nhật thành 'Paid'");

      // Tìm và cập nhật transactionStatus của giao dịch tương ứng với đơn hàng
      const transaction = await PaymentTransaction.findOne({ cart: order.cart });
      if (transaction) {
        transaction.transactionStatus = "Success";
        await transaction.save();
      } else {
        console.log("Không tìm thấy giao dịch cho giỏ hàng:", order.cart);
      }

      // Cộng điểm loyaltyPoints cho khách hàng
      const customerId = order.user; // Lấy userId của khách hàng từ đơn hàng
      const customer = await User.findById(customerId);
      if (customer) {
        customer.loyaltyPoints += 100; // Cộng 100 điểm
        await customer.save(); // Lưu cập nhật vào MongoDB
        console.log(`LoyaltyPoints của user ${customerId} đã tăng lên ${customer.loyaltyPoints}`);
      } else {
        console.log("Không tìm thấy khách hàng để cộng điểm loyaltyPoints");
      }

      // Xóa phòng chat dựa trên roomId (orderId của đơn hàng)
      await Chat.deleteOne({ roomId: orderId });
      console.log(`Phòng chat với roomId ${orderId} đã bị xóa.`);
    }

    // Lưu đơn hàng đã cập nhật
    await order.save();

    // Gửi thông báo cho tài khoản khách hàng
    const customerId = order.user; // Lấy userId của khách hàng từ đơn hàng
    const customer = await User.findById(customerId);

    if (customer && customer.expoPushToken) {
      // Tạo thông báo
      let messages = [];
      if (Expo.isExpoPushToken(customer.expoPushToken)) {
        messages.push({
          to: customer.expoPushToken,
          sound: "default",
          body: `Trạng thái đơn hàng của bạn đã được cập nhật sang ${nextStatus}.`,
          data: { orderId: order._id, orderStatus: nextStatus },
        });

        // Log thông báo sắp gửi
        console.log("Sending push notification to:", customer.expoPushToken);
      }

      // Gửi thông báo
      let chunks = expo.chunkPushNotifications(messages);
      let tickets = [];
      for (let chunk of chunks) {
        try {
          let ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);

          // Log thông báo đã gửi thành công
          console.log("Push notification sent successfully:", ticketChunk);
        } catch (error) {
          // Log lỗi nếu có
          console.error("Error sending push notification:", error);
        }
      }
    } else {
      // Log khi không tìm thấy expoPushToken của người dùng
      console.log(`No expoPushToken found for user: ${customerId}`);
    }

    await sendOrderUpdateEmails(orderId);

    return res.status(200).json({
      message: `Trạng thái đơn hàng đã được cập nhật sang ${nextStatus} ${user.roleId === "shipper" ? "và thêm shipper vào đơn hàng" : ""}`,
      updatedOrder: order,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật trạng thái đơn hàng:", error);
    res.status(500).json({ message: "Có lỗi xảy ra", error: error.message });
  }
};

const getOrdersByStore = async (req, res) => {
  const { storeId } = req.params; // Lấy storeId từ params

  try {
    // Tìm tất cả các đơn hàng thuộc về cửa hàng có storeId
    const orders = await StoreOrder.find({ store: storeId })
      .populate("user", "fullName") // Lấy tên người dùng
      .populate("store", "storeName") // Lấy tên cửa hàng
      .populate("foods", "foodName price"); // Lấy tên và giá món ăn

    // Nếu không có đơn hàng nào cho cửa hàng
    if (orders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào cho cửa hàng này." });
    }

    // Chuẩn bị dữ liệu trả về
    const storeOrdersDetails = orders.map((order) => ({
      orderId: order._id,
      user: {
        userId: order.user._id,
        fullName: order.user.fullName,
      },
      store: {
        storeId: order.store._id,
        storeName: order.store.storeName,
      },
      foods: order.foods.map((food) => ({
        foodName: food.foodName,
        price: food.price,
        quantity: order.foods.find((f) => f._id.equals(food._id)).quantity, // Giả sử bạn lưu quantity
      })),
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
    }));

    // Trả về danh sách đơn hàng của cửa hàng
    res.status(200).json({ message: "Danh sách đơn hàng của cửa hàng", storeOrdersDetails });
  } catch (error) {
    console.error("Lỗi khi lấy đơn hàng theo cửa hàng:", error);
    res.status(500).json({ error: "Lỗi khi lấy đơn hàng theo cửa hàng." });
  }
};

const getDeliveredOrdersAndRevenue = async (req, res) => {
  try {
    const { storeId } = req.params; // Lấy storeId từ params

    // Tìm tất cả các đơn hàng của cửa hàng cụ thể có trạng thái "Delivered"
    const deliveredOrders = await StoreOrder.find({ store: storeId, orderStatus: "Delivered" })
      .populate("user", "fullName") // Lấy tên người dùng
      .populate("store", "storeName") // Lấy tên cửa hàng
      .populate("foods", "foodName price"); // Lấy tên và giá món ăn

    // Nếu không có đơn hàng nào với trạng thái "Delivered" cho cửa hàng này
    if (deliveredOrders.length === 0) {
      return res.status(404).json({ message: "Không có đơn hàng nào đã được giao cho cửa hàng này." });
    }

    // Tính tổng doanh thu bằng cách cộng tất cả totalAmount của các đơn hàng
    const totalRevenue = deliveredOrders.reduce((sum, order) => sum + order.totalAmount, 0);

    // Chuẩn bị dữ liệu trả về
    const deliveredOrdersDetails = deliveredOrders.map((order) => ({
      orderId: order._id,
      user: {
        userId: order.user._id,
        fullName: order.user.fullName,
      },
      store: {
        storeId: order.store._id,
        storeName: order.store.storeName,
      },
      foods: order.foods.map((food) => ({
        foodName: food.foodName,
        price: food.price,
        quantity: order.foods.find((f) => f._id.equals(food._id)).quantity, // Giả sử bạn lưu quantity
      })),
      totalAmount: order.totalAmount,
      orderDate: order.orderDate,
      deliveryAddress: order.deliveryAddress,
    }));

    // Trả về danh sách đơn hàng đã giao cho cửa hàng này và tổng doanh thu
    res.status(200).json({
      message: "Danh sách đơn hàng đã được giao và tổng doanh thu cho cửa hàng",
      deliveredOrdersDetails,
      totalRevenue,
    });
  } catch (error) {
    console.error("Lỗi khi lấy đơn hàng đã giao và tính doanh thu:", error);
    res.status(500).json({ error: "Lỗi khi lấy đơn hàng đã giao và tính doanh thu." });
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

const sendOrderUpdateEmails = async (orderId) => {
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

    const statusMessages = {
      Processing: "Đơn hàng đang xử lý",
      Shipped: "Shipper đã chấp nhận giao đơn hàng",
      Completed: "Đơn hàng đang hoàn thành",
      Received: "Shipper đã nhận hàng",
      Delivered: "Đơn hàng đã giao thành công",
    };

    // Lấy thông báo trạng thái
    const statusMessage = statusMessages[order.orderStatus] || "Trạng thái đơn hàng không xác định";

    // Kiểm tra phương thức thanh toán
    const paymentMessage = order.paymentMethod === "Cash" ? "Thanh toán: Tiền mặt" : "Thanh toán: Online qua PayOS";

    const customerEmail = order.user?.email; // Email khách hàng
    const customerName = order.user?.fullName || "Khách hàng"; // Tên khách hàng

    const storeName = order.store?.storeName || "Cửa hàng"; // Tên cửa hàng
    const ownerId = order.store?.owner; // ID chủ cửa hàng

    const shipperEmail = order.shipper?.userId?.email; // Email của shipper
    const shipperName = order.shipper?.userId?.fullName || "Shipper"; // Tên shipper

    let storeOwnerEmail = null;
    let storeOwnerName = "Chủ cửa hàng";

    // Lấy email và tên của chủ cửa hàng từ User model
    if (ownerId) {
      const storeOwner = await User.findById(ownerId).select("email fullName");
      if (storeOwner) {
        storeOwnerEmail = storeOwner.email;
        storeOwnerName = storeOwner.fullName || storeOwnerName;
      }
    }

    // Gửi email thông báo cho khách hàng
    if (customerEmail) {
      const customerSubject = `Cập nhật trạng thái đơn hàng: ${orderId}`;
      const customerMessage = `
      Kính gửi ${customerName},

      Đơn hàng của bạn (Mã: ${orderId}) đã được cập nhật trạng thái:
      - Trạng thái hiện tại: ${statusMessage}
      - Tổng tiền: ${order.totalAmount.toLocaleString("vi-VN")} VND
      - Phương thức thanh toán: ${paymentMessage}
      - Ngày đặt hàng: ${new Date(order.orderDate).toLocaleString("vi-VN")}

      Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi. Nếu bạn có bất kỳ câu hỏi nào, vui lòng liên hệ với đội ngũ hỗ trợ.

      Trân trọng,
      Đội ngũ hỗ trợ.
      `;
      await sendNotificationEmail(customerEmail, customerSubject, customerMessage);
      console.log(`Email thông báo trạng thái đơn hàng đã được gửi tới khách hàng: ${customerEmail}`);
    } else {
      console.log(`Không tìm thấy email của khách hàng cho đơn hàng: ${orderId}`);
    }

    // Gửi email thông báo cho cửa hàng khi đơn hàng ở trạng thái Shipped, Received, hoặc Delivered
    if (["Shipped", "Received", "Delivered"].includes(order.orderStatus) && storeOwnerEmail) {
      const storeSubject = `Thông báo trạng thái đơn hàng: ${orderId}`;
      const storeMessage = `
      Kính gửi ${storeOwnerName},

      Đơn hàng (Mã: ${orderId}) tại cửa hàng "${storeName}" của bạn đã được cập nhật trạng thái:
      - Trạng thái hiện tại: ${statusMessage}
      - Tổng tiền: ${order.totalAmount.toLocaleString("vi-VN")} VND
      - Khách hàng: ${customerName}
      - Phương thức thanh toán: ${paymentMessage}

      Hãy kiểm tra và xử lý đơn hàng nếu cần thiết.

      Trân trọng,
      Đội ngũ hỗ trợ.
      `;
      await sendNotificationEmail(storeOwnerEmail, storeSubject, storeMessage);
      console.log(`Email thông báo trạng thái ${order.orderStatus} của đơn hàng đã được gửi tới cửa hàng: ${storeOwnerEmail}`);
    } else if (!storeOwnerEmail) {
      console.log(`Không tìm thấy email của chủ cửa hàng cho đơn hàng: ${orderId}`);
    }

    // Gửi email thông báo khi trạng thái là Completed
    if (order.orderStatus === "Completed") {
      // Gửi email cho shipper
      if (shipperEmail) {
        const completedShipperSubject = `Thông báo hoàn tất giao hàng: ${orderId}`;
        const completedShipperMessage = `
        Kính gửi ${shipperName},

        Đơn hàng (Mã: ${orderId}) mà bạn phụ trách đã được hoàn tất.
        - Tổng tiền: ${order.totalAmount.toLocaleString("vi-VN")} VND
        - Khách hàng: ${customerName}
        - Phương thức thanh toán: ${paymentMessage}

        Cảm ơn bạn đã làm việc hiệu quả. Chúc bạn có thêm nhiều đơn hàng thành công.

        Trân trọng,
        Đội ngũ hỗ trợ.
        `;
        await sendNotificationEmail(shipperEmail, completedShipperSubject, completedShipperMessage);
        console.log(`Email thông báo hoàn tất giao hàng đã được gửi tới shipper: ${shipperEmail}`);
      }
    }
  } catch (error) {
    console.error("Lỗi khi gửi email thông báo:", error.message);
  }
};

module.exports = {
  updatePaymentMethod,
  createOrderFromCart,
  getOrderDetails,
  getAllOrders,
  updateOrderStatus,
  getOrdersByStore,
  getDeliveredOrdersAndRevenue,
};
