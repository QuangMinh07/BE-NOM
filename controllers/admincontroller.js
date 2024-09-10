const Admin = require("../models/admin");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

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
      {
        expiresIn: "1h",
      }
    );

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
    const { role } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Lấy tất cả người dùng với vai trò là "customer" hoặc "seller"
    const query = { roleId: { $in: ["customer", "seller"] } };

    // Truy vấn danh sách người dùng và phân trang
    const users = await User.find(query).skip(skip).limit(limit);
    const totalUsers = await User.countDocuments(query);

    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, msg: "Không tìm thấy người dùng" });
    }

    // Cập nhật lastActive cho từng người dùng
    const updatedUsers = await Promise.all(
      users.map(async (user) => {
        user.lastActive = Date.now();
        await user.save();
        return user;
      })
    );

    return res.status(200).json({
      success: true,
      data: updatedUsers, // Trả về danh sách người dùng đã được cập nhật
      total: totalUsers,
      page,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ success: false, msg: "Lỗi server" });
  }
};

const updateOnlineStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    const currentTime = Date.now();
    const timeout = 30 * 1000; // 30 giây không hoạt động

    // Kiểm tra thời gian hoạt động cuối cùng (lastActive) để xác định trạng thái online
    if (currentTime - user.lastActive > timeout) {
      user.isOnline = false; // Người dùng đã không hoạt động quá lâu, set isOnline là false
    } else {
      user.isOnline = true; // Người dùng vẫn đang hoạt động
    }

    // Cập nhật thời gian hoạt động cuối cùng và trạng thái online
    user.lastActive = currentTime;
    await user.save();

    // Truyền dữ liệu người dùng đã cập nhật cho các middleware hoặc route handlers khác
    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAllUser,
  updateOnlineStatus,
};
