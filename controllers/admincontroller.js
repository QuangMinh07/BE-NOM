const Admin = require("../models/admin");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Store = require("../models/store");

const registerAdmin = async (req, res, next) => {
  const { username, fullName, password } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!username || !fullName || !password) {
    return next(
      errorHandler(
        400,
        "Cả tên người dùng, tên đầy đủ và mật khẩu đều phải nhập"
      )
    );
  }

  // Kiểm tra độ dài username
  if (username.length < 7 || username.length > 20) {
    return next(errorHandler(400, "Tên người dùng phải có từ 7 đến 20 ký tự"));
  }

  // Kiểm tra độ dài password
  if (password.length < 8) {
    return next(errorHandler(400, "Mật khẩu phải có ít nhất 8 ký tự"));
  }

  try {
    // Kiểm tra xem username đã tồn tại chưa
    const existingAdmin = await Admin.findOne({ userName: username });

    if (existingAdmin) {
      return next(errorHandler(400, "Tên người dùng đã tồn tại"));
    }

    // Mã hóa mật khẩu
    const hashedPassword = bcryptjs.hashSync(password, 10);

    // Tạo Admin mới
    const newAdmin = new Admin({
      userName: username,
      fullName,
      password: hashedPassword,
    });

    // Lưu Admin vào cơ sở dữ liệu
    await newAdmin.save();

    // Trả về phản hồi thành công
    res.status(201).json({
      success: true,
      message: "Đăng ký Admin thành công!",
    });
  } catch (error) {
    next(error);
  }
};

const loginAdmin = async (req, res, next) => {
  const { username, password } = req.body;

  // Kiểm tra xem username và password có được nhập hay không
  if (!username || !password) {
    return next(
      errorHandler(400, "Vui lòng nhập cả tên người dùng và mật khẩu")
    );
  }

  try {
    // Tìm admin với username đã cung cấp
    const admin = await Admin.findOne({ userName: username });

    // Kiểm tra xem admin có tồn tại không
    if (!admin) {
      return next(errorHandler(400, "Tên người dùng không chính xác"));
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcryptjs.compare(password, admin.password);
    if (!isMatch) {
      return next(errorHandler(400, "Mật khẩu không chính xác"));
    }

    // Tạo token xác thực
    const token = jwt.sign(
      {
        id: admin._id,
        role: admin.role,
        username: admin.userName,
        fullName: admin.fullName,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Thời gian tồn tại token là 7 ngày
    );

    // Lưu token vào cookie
    res.cookie("accessToken", token, {
      httpOnly: true, // Đảm bảo cookie chỉ được sử dụng trong HTTP, không thể truy cập từ JavaScript
      secure: false, // Đảm bảo cookie chỉ được gửi qua HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày (tính bằng milliseconds)
    });

    // Trả về phản hồi đăng nhập thành công
    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      token,
      admin: {
        id: admin._id,
        userName: admin.userName,
        fullName: admin.fullName, // Trả về fullName
        role: admin.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getAllUser = async (req, res) => {
  try {
    const {
      sortField = "userName", // Mặc định sắp xếp theo tên
      sortOrder = "asc", // Mặc định sắp xếp tăng dần (A -> Z)
      role, // Lọc theo vai trò customer, seller, shipper
      isOnline, // Lọc theo trạng thái online hoặc offline
    } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Lọc người dùng theo vai trò nếu có truyền
    const query = role
      ? { roleId: role }
      : { roleId: { $in: ["customer", "seller", "shipper"] } };

    // Nếu có truyền isOnline, thêm điều kiện lọc online hoặc offline
    if (typeof isOnline !== "undefined") {
      query.isOnline = isOnline === "true"; // Chuyển giá trị isOnline từ string thành Boolean
    }

    // Tạo đối tượng sắp xếp
    const sortOptions = {};
    if (sortField && sortOrder) {
      sortOptions[sortField] = sortOrder === "asc" ? 1 : -1;
    }

    // Lấy danh sách người dùng theo sắp xếp và phân trang, đồng thời populate storeIds
    const users = await User.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "storeIds",
        model: "Store",
        select: "storeName storeAddress bankAccount foodType createdAt", // Lấy các trường từ Store
      });

    const totalUsers = await User.countDocuments(query);

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, msg: "Không tìm thấy người dùng" });
    }

    return res.status(200).json({
      success: true,
      data: users,
      total: totalUsers,
      page,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ success: false, msg: "Lỗi server" });
  }
};

const approveSeller = async (req, res) => {
  const { userId } = req.body;

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId).populate("storeIds"); // Populate để lấy thông tin cửa hàng

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem người dùng đã đăng ký làm người bán chưa và chưa được duyệt
    if (user.roleId !== "seller" || user.isApproved) {
      return res.status(400).json({
        message: "Người dùng không trong trạng thái chờ duyệt làm người bán",
      });
    }

    // Duyệt người bán
    user.isApproved = true;

    // Tăng số lượng cửa hàng của người dùng
    await User.findByIdAndUpdate(userId, { $inc: { storeCount: 1 } });

    // Lưu thông tin người dùng
    await user.save();

    res.status(200).json({
      message: "Người bán đã được duyệt thành công",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const rejectSeller = async (req, res) => {
  const { userId } = req.body; // Chỉ cần userId từ request body

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem người dùng có phải người bán đang chờ duyệt hay không
    if (user.roleId !== "seller" || user.isApproved) {
      return res.status(400).json({
        message: "Người dùng không trong trạng thái chờ duyệt làm người bán",
      });
    }

    // Xóa tất cả các cửa hàng liên kết với userId
    await Store.deleteMany({ owner: userId });

    // Thay đổi vai trò về lại "customer"
    user.roleId = "customer";
    user.isApproved = false;
    user.storeName = "";
    user.foodType = "";
    user.businessType = "";
    user.bankAccount = "";
    user.storeAddress = "";
    user.idImage = "";
    user.cccd = "";
    user.representativeName = "";

    // Xóa danh sách storeIds
    user.storeIds = [];

    // Lưu thay đổi người dùng
    await user.save();

    res.status(200).json({
      message:
        "Người dùng đã bị từ chối và quay lại vai trò customer. Cửa hàng đã bị xóa.",
      user,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const getStoreCount = async (req, res) => {
  try {
    const { userId } = req.body; // Chỉ cần userId từ request body
    const user = await User.findById(userId);

    return res.status(200).json({ storeCount: user.storeCount });
  } catch (error) {
    return res.status(500).json({ message: "Đã xảy ra lỗi", error });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAllUser,
  approveSeller,
  rejectSeller,
  getStoreCount,
};
