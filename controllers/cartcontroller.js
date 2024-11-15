const Cart = require("../models/cart");
const Food = require("../models/food");
const Store = require("../models/store");

// Hàm thêm món ăn vào giỏ hàng mà không yêu cầu địa chỉ giao hàng
const addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { foodId, quantity } = req.body;

    // Tìm món ăn theo foodId và lấy thông tin store
    const food = await Food.findById(foodId).populate("store");
    if (!food) {
      return res.status(404).json({ message: "Món ăn không tồn tại" });
    }

    // Tìm giỏ hàng của người dùng theo userId và storeId
    let cart = await Cart.findOne({
      user: userId,
      "items.store": food.store._id, // Kiểm tra chính xác storeId
    });

    if (!cart) {
      // Nếu không có giỏ hàng, kiểm tra xem có giỏ hàng rỗng trước đó không
      cart = await Cart.findOne({ user: userId });

      if (cart && cart.items.length === 0) {
        // Nếu giỏ hàng tồn tại nhưng rỗng (items.length === 0), sử dụng giỏ hàng cũ
        console.log("Using existing empty cart");
      } else {
        // Nếu giỏ hàng hoàn toàn không tồn tại, tạo giỏ hàng mới
        cart = new Cart({ user: userId, items: [], totalPrice: 0 });
        console.log("Created a new cart for user");
      }
    }

    // Thêm hoặc cập nhật món ăn trong giỏ hàng
    const existingItemIndex = cart.items.findIndex((item) => item.food.toString() === foodId);

    if (existingItemIndex !== -1) {
      // Nếu món ăn đã có trong giỏ, tăng số lượng
      cart.items[existingItemIndex].quantity += quantity;
      cart.items[existingItemIndex].price = cart.items[existingItemIndex].quantity * food.price;
    } else {
      // Nếu món ăn chưa có trong giỏ, thêm món mới
      cart.items.push({
        food: food._id,
        store: food.store._id, // Liên kết món ăn với cửa hàng
        quantity,
        price: food.price * quantity,
      });
    }

    // Cập nhật tổng số tiền trong giỏ hàng
    cart.totalPrice = cart.items.reduce((total, item) => total + item.price, 0);

    // Lưu lại giỏ hàng sau khi cập nhật
    await cart.save();

    res.status(200).json({ message: "Thêm vào giỏ hàng thành công!", cart });
  } catch (error) {
    console.error("Lỗi khi thêm vào giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi thêm vào giỏ hàng", error });
  }
};

// Hàm cập nhật địa chỉ giao hàng và thanh toán
const checkout = async (req, res) => {
  try {
    const { userId, storeId } = req.params; // Nhận cả userId và storeId từ params
    const { deliveryAddress, receiverName, receiverPhone, description } = req.body;

    // Tìm giỏ hàng của người dùng và cửa hàng tương ứng
    const cart = await Cart.findOne({ user: userId, "items.store": storeId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Cập nhật thông tin giao hàng
    cart.deliveryAddress = deliveryAddress;
    cart.receiverName = receiverName;
    cart.receiverPhone = receiverPhone;
    cart.description = description;

    // Lưu lại giỏ hàng sau khi cập nhật
    await cart.save();

    // Trả về thông tin cập nhật thành công
    res.status(200).json({ message: "Cập nhật địa chỉ giao hàng thành công!", cart });
  } catch (error) {
    console.error("Lỗi khi cập nhật địa chỉ:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật địa chỉ", error });
  }
};

const getCart = async (req, res) => {
  try {
    const { userId } = req.params;

    // Tìm tất cả giỏ hàng của người dùng và populate thông tin món ăn từ mô hình Food và thông tin cửa hàng từ mô hình Store trong items
    const carts = await Cart.find({ user: userId })
      .populate({
        path: "items.food", // Tham chiếu đến mô hình Food dựa trên foodId
        select: "foodName price imageUrl", // Lấy thêm trường imageUrl của món ăn
      })
      .populate({
        path: "items.store", // Tham chiếu đến mô hình Store dựa trên storeId trong mỗi item
        select: "storeName _id", // Chỉ lấy trường storeName
      });

    console.log("Cart Data:", carts); // Log dữ liệu giỏ hàng để kiểm tra

    if (!carts || carts.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Tạo phản hồi chứa thông tin giỏ hàng cho từng giỏ hàng của người dùng
    const cartDetails = carts.map((cart) => ({
      _id: cart._id, // ID của giỏ hàng
      totalPrice: cart.totalPrice, // Tổng tiền của giỏ hàng
      deliveryAddress: cart.deliveryAddress, // Địa chỉ giao hàng
      receiverName: cart.receiverName, // Tên người nhận
      receiverPhone: cart.receiverPhone, // Số điện thoại người nhận
      description: cart.description, // Mô tả thêm nếu có
      items: cart.items
        .map((item) => {
          // Kiểm tra nếu món ăn và cửa hàng tồn tại trong dữ liệu đã populate
          if (item.food && item.store) {
            return {
              foodId: item.food._id, // Trả về ID món ăn
              foodName: item.food.foodName, // Tên món ăn từ Food model
              price: item.food.price, // Giá món ăn từ Food model
              quantity: item.quantity, // Số lượng món ăn trong giỏ
              totalItemPrice: item.quantity * item.food.price, // Tính tổng giá của món ăn trong giỏ
              imageUrl: item.food.imageUrl, // Đường dẫn ảnh món ăn
              storeId: item.store._id, // ID của cửa hàng
              storeName: item.store.storeName, // Tên cửa hàng từ Store model
            };
          }
          console.warn("Không tìm thấy món ăn hoặc cửa hàng cho ID:", item.food, item.store); // Cảnh báo nếu không có thông tin món ăn hoặc cửa hàng
          return null; // Trả về null nếu không có thông tin món ăn hoặc cửa hàng
        })
        .filter((item) => item !== null), // Lọc các phần tử null ra khỏi mảng
    }));

    // Gửi phản hồi chứa danh sách các giỏ hàng
    res.status(200).json({
      message: "Lấy thông tin giỏ hàng thành công!",
      carts: cartDetails,
    });
  } catch (error) {
    console.error("Lỗi khi lấy thông tin giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi lấy thông tin giỏ hàng", error });
  }
};

const updateShippingInfo = async (req, res) => {
  try {
    const { userId, storeId } = req.params; // Nhận cả userId và storeId từ params
    const { deliveryAddress, receiverName, receiverPhone, description } = req.body;

    // Tìm giỏ hàng của người dùng và cửa hàng tương ứng
    const cart = await Cart.findOne({ user: userId, "items.store": storeId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Cập nhật thông tin giao hàng
    cart.deliveryAddress = deliveryAddress || cart.deliveryAddress;
    cart.receiverName = receiverName || cart.receiverName;
    cart.receiverPhone = receiverPhone || cart.receiverPhone;

    // Cập nhật mô tả nếu có (chấp nhận chuỗi rỗng)
    if (description !== undefined) {
      cart.description = description;
    }

    // Lưu lại giỏ hàng sau khi cập nhật
    await cart.save();

    // Trả về thông tin cập nhật thành công
    res.status(200).json({
      message: "Cập nhật thông tin giao hàng thành công!",
      cart: {
        deliveryAddress: cart.deliveryAddress,
        receiverName: cart.receiverName,
        receiverPhone: cart.receiverPhone,
        description: cart.description,
      },
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật thông tin giao hàng:", error);
    res.status(500).json({ message: "Lỗi khi cập nhật thông tin giao hàng", error });
  }
};

const removeFromCart = async (req, res) => {
  try {
    const { userId, foodId } = req.params; // Lấy đúng foodId từ params

    // Tìm giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Tìm món ăn theo foodId
    const itemIndex = cart.items.findIndex((item) => item.food.toString() === foodId);
    if (itemIndex === -1) {
      return res.status(404).json({ message: "Món ăn không tồn tại trong giỏ hàng" });
    }

    // Xóa món ăn khỏi giỏ hàng
    cart.items.splice(itemIndex, 1);

    // Cập nhật tổng giá tiền
    cart.totalPrice = cart.items.reduce((total, item) => total + item.price * item.quantity, 0);

    // Lưu giỏ hàng sau khi xóa
    await cart.save();

    res.status(200).json({
      message: "Xóa món ăn khỏi giỏ hàng thành công!",
      cart,
    });
  } catch (error) {
    console.error("Lỗi khi xóa món ăn khỏi giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi xóa món ăn khỏi giỏ hàng", error });
  }
};

// Hàm lấy giỏ hàng theo userId và storeId
const getCartByStoreId = async (req, res) => {
  try {
    const { userId, storeId } = req.params;

    // Tìm giỏ hàng của người dùng với cửa hàng cụ thể
    const cart = await Cart.findOne({
      user: userId,
      "items.store": storeId, // Tìm giỏ hàng với storeId cụ thể
    }).populate({
      path: "items.food", // Lấy thông tin món ăn từ food model
      select: "foodName price", // Chỉ lấy các trường cần thiết từ food
    });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Lọc các món trong giỏ hàng theo storeId
    const storeCartItems = cart.items.filter((item) => item.store.toString() === storeId.toString());

    if (storeCartItems.length === 0) {
      return res.status(404).json({ message: "Không có món ăn nào trong giỏ hàng từ cửa hàng này." });
    }

    // Tính tổng giá trị chính xác, tránh nhân đôi
    const totalPrice = storeCartItems.reduce((total, item) => {
      return total + item.food.price * item.quantity; // Sử dụng giá từ food model
    }, 0);

    // Trả về thông tin giỏ hàng từ cửa hàng, bao gồm cả cartId và thông tin giao hàng
    res.status(200).json({
      message: "Lấy giỏ hàng thành công!",
      cart: {
        cartId: cart._id, // Trả về cartId
        storeId,
        items: storeCartItems,
        totalPrice: totalPrice, // Tổng giá chính xác
        deliveryAddress: cart.deliveryAddress || "", // Địa chỉ giao hàng
        receiverName: cart.receiverName || "", // Tên người nhận
        receiverPhone: cart.receiverPhone || "", // Số điện thoại người nhận
        description: cart.description || "", // Mô tả thêm (nếu có)
      },
    });
  } catch (error) {
    console.error("Lỗi khi lấy giỏ hàng theo storeId:", error);
    res.status(500).json({ message: "Lỗi khi lấy giỏ hàng theo storeId", error });
  }
};

const deleteCartById = async (req, res) => {
  try {
    const { cartId } = req.params;

    // Tìm và xóa giỏ hàng theo cartId
    const cart = await Cart.findByIdAndDelete(cartId);

    if (!cart) {
      return res.status(404).json({ message: "Giỏ hàng không tồn tại" });
    }

    res.status(200).json({ message: "Xóa giỏ hàng thành công!", cart });
  } catch (error) {
    console.error("Lỗi khi xóa giỏ hàng:", error);
    res.status(500).json({ message: "Lỗi khi xóa giỏ hàng", error });
  }
};

module.exports = {
  addToCart,
  checkout,
  getCart,
  updateShippingInfo,
  removeFromCart,
  getCartByStoreId,
  deleteCartById
};
