const Admin = require("../models/admin");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const registerAdmin = async (req, res, next) => {
    const { username, password } = req.body;

    // Kiểm tra các trường bắt buộc
    if (!username || !password) {
        return next(
            errorHandler(400, "Cả tên người dùng và mật khẩu đều phải nhập")
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
            { id: admin._id, role: admin.role },
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
        console.log(role);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;
        const users = await User.find({ roleId: role })
            .skip(skip)
            .limit(limit);

        console.log("Users found:", users);

        const totalUsers = await User.countDocuments({ roleId: role });

        if (users.length === 0) {
            return res.status(404).json({ success: false, msg: 'Không tìm thấy người dùng' });
        }

        return res.status(200).json({
            success: true,
            data: users,
            total: totalUsers,
            page,
            totalPages: Math.ceil(totalUsers / limit)
        });
    } catch (error) {
        console.error("Error:", error); // In ra lỗi nếu có
        return res.status(500).json({ success: false, msg: 'Lỗi server' });
    }
};
module.exports = {
    registerAdmin,
    loginAdmin,
    getAllUser
};
