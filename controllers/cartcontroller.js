const Cart = require("../models/cart");
const Food = require("../models/food");
const Store = require("../models/store");
// Hàm thêm món ăn vào giỏ hàng mà không yêu cầu địa chỉ giao hàng
const addToCart = async (req, res) => {
  try {
    const { userId } = req.params;
    const { foodId, quantity, combos } = req.body;

    // Tìm món ăn theo foodId và lấy thông tin store
    const food = await Food.findById(foodId).populate("store");
    if (!food) {
      return res.status(404).json({ message: "Món ăn không tồn tại" });
    }

    // Tìm giỏ hàng của người dùng theo userId và storeId
    let cart = await Cart.findOne({
      user: userId,
      "items.store": food.store._id,
    });

    if (!cart) {
      // Nếu không có giỏ hàng, kiểm tra xem có giỏ hàng rỗng trước đó không
      cart = await Cart.findOne({ user: userId });

      if (cart && cart.items.length === 0) {
        console.log("Using existing empty cart");
      } else {
        cart = new Cart({ user: userId, items: [], totalPrice: 0 });
        console.log("Created a new cart for user");
      }
    }

    // Tính tổng giá và chi tiết món trong combo
    let comboTotalPrice = 0;
    let comboFoodDetails = [];
    if (combos && combos.length > 0) {
      for (const combo of combos) {
        const comboFood = await Food.findById(combo.foodId);
        if (comboFood) {
          const effectivePrice = comboFood.isDiscounted && comboFood.discountedPrice ? comboFood.discountedPrice : comboFood.price || 0;
          const comboQuantity = combo.quantity || 1;
          comboTotalPrice += effectivePrice * comboQuantity;
          comboFoodDetails.push({
            foodId: comboFood._id,
            price: effectivePrice,
            quantity: comboQuantity,
          });
        }
      }
    }

    const isItemMatching = (existingItem, newCombos, newQuantity) => {
      const existingCombos = existingItem.combos.foods || [];

      // Kiểm tra nếu số lượng món chính không khớp
      if (existingItem.quantity !== newQuantity) {
        return false;
      }

      // Kiểm tra nếu số lượng combo không khớp
      if (existingCombos.length !== newCombos.length) {
        return false;
      }

      // Sắp xếp và so sánh từng combo
      const sortedExisting = [...existingCombos].sort((a, b) => a.foodId.toString().localeCompare(b.foodId.toString()));
      const sortedNew = [...newCombos].sort((a, b) => a.foodId.toString().localeCompare(b.foodId.toString()));

      return sortedExisting.every((existingCombo, index) => {
        const newCombo = sortedNew[index];
        return existingCombo.foodId.toString() === newCombo.foodId.toString() && existingCombo.price === newCombo.price && existingCombo.quantity === newCombo.quantity;
      });
    };

    // Tìm món trong giỏ hàng có id và các combo trùng khớp
    // Kiểm tra nếu món đã tồn tại
    const existingItemIndex = cart.items.findIndex((item) => {
      return item.food.toString() === foodId && isItemMatching(item, comboFoodDetails, quantity);
    });

    if (existingItemIndex !== -1) {
      // Nếu món ăn đã có trong giỏ, tăng số lượng
      const existingItem = cart.items[existingItemIndex];
      existingItem.quantity += quantity;
      existingItem.price = existingItem.quantity * food.price;

      if (combos && combos.length > 0) {
        // Cập nhật số lượng combo
        existingItem.combos.foods = existingItem.combos.foods.map((combo, index) => ({
          ...combo,
          quantity: combo.quantity + (comboFoodDetails[index]?.quantity || 0),
        }));
        existingItem.combos.totalQuantity = existingItem.combos.foods.reduce((total, combo) => total + combo.quantity, 0);
        existingItem.combos.totalPrice = existingItem.combos.foods.reduce((total, combo) => total + combo.price * combo.quantity, 0);
      }
    } else {
      // Nếu món ăn chưa có trong giỏ, thêm món mới
      cart.items.push({
        food: food._id,
        store: food.store._id,
        quantity: quantity || 1,
        price: (food.isDiscounted && food.discountedPrice ? food.discountedPrice : food.price || 0) * (quantity || 1),
        originalPrice: food.price || 0,
        discountedPrice: food.isDiscounted && food.discountedPrice ? food.discountedPrice : null,
        combos:
          combos && combos.length > 0
            ? {
                foods: comboFoodDetails,
                totalQuantity: combos.length,
                totalPrice: comboTotalPrice || 0,
              }
            : { foods: [], totalQuantity: 0, totalPrice: 0 },
        totalPrice: (food.isDiscounted && food.discountedPrice ? food.discountedPrice : food.price || 0) * (quantity || 1) + (comboTotalPrice || 0),
      });
    }

    const itemPrice = (food.isDiscounted && food.discountedPrice ? food.discountedPrice : food.price || 0) * (quantity || 1);
    const comboTotal = comboTotalPrice || 0;

    if (!Number.isFinite(itemPrice + comboTotal)) {
      throw new Error("Invalid item price or combo total.");
    }

    cart.items.forEach((item) => {
      console.log("Item price:", item.price);
      console.log("Item quantity:", item.quantity);
      console.log("Item combos totalPrice:", item.combos?.totalPrice || 0);
      console.log("Item totalPrice:", item.totalPrice);
    });

    // Cập nhật tổng giá trị giỏ hàng
    // Cập nhật tổng giá trị giỏ hàng
    cart.totalPrice = cart.items.reduce((total, item) => {
      return total + (item.totalPrice || 0); // Lấy giá trị `totalPrice` của từng item
    }, 0);

    // Kiểm tra nếu totalPrice không hợp lệ
    if (!Number.isFinite(cart.totalPrice)) {
      console.error("Invalid totalPrice:", cart.totalPrice);
      cart.totalPrice = 0; // Gán giá trị mặc định nếu lỗi
    }

    // Lưu giỏ hàng
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
    const { userId, cartId, foodId } = req.params;

    if (!userId || !cartId || !foodId) {
      console.error("Thiếu tham số bắt buộc:", { userId, cartId, foodId });
      return res.status(400).json({ message: "Thiếu tham số bắt buộc" });
    }

    console.log("Received userId:", userId, "CartId:", cartId, "FoodId:", foodId);

    const cart = await Cart.findOne({ _id: cartId, user: userId });
    if (!cart) {
      console.log("Cart not found for user:", userId);
      return res.status(404).json({ message: "Giỏ hàng không tồn tại" });
    }

    console.log("Cart found:", cart);

    const itemIndex = cart.items.findIndex((item) => item.food.toString() === foodId);
    if (itemIndex === -1) {
      console.log("Food ID not found in cart items:", foodId);
      return res.status(404).json({ message: "Món ăn không tồn tại trong giỏ hàng" });
    }

    // Xóa món ăn khỏi giỏ hàng
    cart.items.splice(itemIndex, 1);

    // Cập nhật tổng giá tiền
    cart.totalPrice = cart.items.reduce((total, item) => total + item.price + (item.combos?.totalPrice || 0), 0);

    if (cart.items.length === 0) {
      // Nếu giỏ hàng không còn món nào, xóa giỏ hàng
      await Cart.findByIdAndDelete(cartId);
      console.log("Cart deleted as it is now empty.");

      return res.status(200).json({
        message: "Xóa món ăn và giỏ hàng thành công! Giỏ hàng hiện tại đã bị xóa do không còn món nào.",
        cart: null, // Trả về null để thông báo giỏ hàng không còn tồn tại
      });
    }

    // Nếu còn món ăn, lưu giỏ hàng sau khi cập nhật
    await cart.save();

    // Populate lại giỏ hàng
    const updatedCart = await Cart.findById(cartId).populate([
      {
        path: "items.food",
        select: "_id foodName price",
      },
      {
        path: "items.combos.foods.foodId",
        select: "_id foodName price",
      },
    ]);

    console.log("Updated cart with populated combos:", updatedCart);

    res.status(200).json({
      message: "Xóa món ăn khỏi giỏ hàng thành công!",
      cart: updatedCart,
    });
  } catch (error) {
    if (error.kind === "ObjectId") {
      console.error("Invalid ObjectId or data:", error);
      return res.status(400).json({ message: "ID không hợp lệ." });
    }
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
      "items.store": storeId,
    })
      .populate({
        path: "items.food", // Lấy thông tin món ăn từ food model
        select: "foodName price", // Chỉ lấy các trường cần thiết từ food
      })
      .populate({
        path: "items.combos.foods.foodId", // Lấy thông tin món ăn trong combos
        select: "foodName", // Lấy thêm tên món ăn
      });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({ message: "Giỏ hàng rỗng hoặc không tồn tại" });
    }

    // Lọc các món trong giỏ hàng theo storeId
    const storeCartItems = cart.items.filter((item) => item.store.toString() === storeId.toString());

    if (storeCartItems.length === 0) {
      return res.status(404).json({ message: "Không có món ăn nào trong giỏ hàng từ cửa hàng này." });
    }

    // Tính tổng giá trị chính xác (bao gồm combos và món chính)
    const totalPrice = storeCartItems.reduce((total, item) => {
      const foodPrice = item.food.price * item.quantity; // Giá món chính
      const comboPrice = item.combos?.totalPrice || 0; // Giá của combos (nếu có)
      return total + foodPrice + comboPrice; // Tổng giá món chính + combos
    }, 0);

    // Format combos để lấy thêm foodName
    const formattedItems = storeCartItems.map((item) => ({
      ...item.toObject(),
      combos: {
        ...item.combos,
        foods: item.combos.foods.map((comboFood) => ({
          foodId: comboFood.foodId._id,
          foodName: comboFood.foodId.foodName, // Lấy thêm foodName từ combo
          price: comboFood.price,
          quantity: comboFood.quantity, // Lấy số lượng của món trong combo
        })),
      },
    }));

    // Trả về thông tin giỏ hàng từ cửa hàng, bao gồm cả cartId và thông tin giao hàng
    res.status(200).json({
      message: "Lấy giỏ hàng thành công!",
      cart: {
        cartId: cart._id,
        storeId,
        items: formattedItems,
        totalPrice,
        deliveryAddress: cart.deliveryAddress || "",
        receiverName: cart.receiverName || "",
        receiverPhone: cart.receiverPhone || "",
        description: cart.description || "",
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

const updateCartItem = async (req, res) => {
  try {
    const { userId, cartId, foodId } = req.params;
    const { quantity, combos } = req.body;

    console.log("Server received request to update:", { userId, cartId, foodId, quantity, combos });

    if (!userId || !cartId || !foodId || quantity <= 0) {
      return res.status(400).json({ error: "Thông tin không hợp lệ." });
    }

    const cart = await Cart.findOne({ user: userId, _id: cartId }).populate("items.food");

    if (!cart) {
      console.log("Cart not found for user and cartId:", userId, cartId);
      return res.status(404).json({ error: "Giỏ hàng không tồn tại." });
    }

    console.log("Current cart items:", cart.items);

    const isComboMatching = (existingCombos, newCombos) => {
      if (!newCombos || newCombos.length === 0) return true;
      if (existingCombos.length !== newCombos.length) return false;

      const sortedExisting = [...existingCombos].sort((a, b) => a.foodId.toString().localeCompare(b.foodId.toString()));
      const sortedNew = [...newCombos].sort((a, b) => a.foodId.localeCompare(b.foodId));

      return sortedExisting.every((existingCombo, index) => {
        const newCombo = sortedNew[index];
        return existingCombo.foodId.toString() === newCombo.foodId && existingCombo.price === newCombo.price;
      });
    };

    const itemIndex = cart.items.findIndex((item) => {
      const isFoodMatch = item.food._id.toString() === foodId;
      const isComboMatch = isComboMatching(item.combos?.foods || [], combos || []);
      console.log({
        isFoodMatch,
        isComboMatch,
        item,
        combosRequested: combos,
      });
      return isFoodMatch && isComboMatch;
    });

    if (itemIndex === -1) {
      console.log("Food ID or combos not found in cart items:", foodId);
      return res.status(404).json({
        error: "Món ăn không có trong giỏ hàng hoặc combos không khớp.",
        existingCombos: cart.items.map((item) => item.combos?.foods || []),
        requestCombos: combos,
      });
    }

    const item = cart.items[itemIndex];
    // const oldQuantity = item.quantity;
    // Lấy giá đúng (ưu tiên giá giảm nếu có)
    const foodPrice = item.food.discountedPrice ? item.food.discountedPrice : item.food.price;

    // Cập nhật số lượng và giá
    item.quantity = quantity;
    item.price = quantity * foodPrice;

    // Xử lý combos: tăng hoặc giảm số lượng các món trong combo theo số lượng món chính
    if (item.combos && item.combos.foods.length > 0) {
      item.combos.totalQuantity = item.quantity;

      for (const combo of item.combos.foods) {
        const comboPrice = combo.isDiscounted && combo.discountedPrice ? combo.discountedPrice : combo.price;

        // Cập nhật giá và số lượng cho từng món trong combo
        combo.price = comboPrice; // Giá của 1 phần trong combo
        combo.quantity = item.quantity; // Đồng bộ số lượng món combo với món chính
        combo.totalPrice = comboPrice * item.quantity; // Tổng giá theo số lượng món chính
      }

      item.combos.totalPrice = item.combos.foods.reduce((total, combo) => total + combo.totalPrice, 0);
    }

    // Tính lại tổng giá cho món trong giỏ hàng (bao gồm món chính và combos)
    item.totalPrice = item.price + (item.combos?.totalPrice || 0);

    // Tính tổng giá toàn bộ giỏ hàng
    cart.totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);

    cart.updatedAt = Date.now();

    await cart.save();

    console.log("Updated cart successfully:", cart);

    res.status(200).json({
      message: "Cập nhật số lượng món ăn và combos thành công.",
      cart,
    });
  } catch (error) {
    console.error("Lỗi khi cập nhật món ăn trong giỏ hàng:", error);
    res.status(500).json({ error: "Lỗi khi cập nhật món ăn trong giỏ hàng." });
  }
};

module.exports = {
  addToCart,
  checkout,
  getCart,
  updateShippingInfo,
  removeFromCart,
  getCartByStoreId,
  deleteCartById,
  updateCartItem,
};
