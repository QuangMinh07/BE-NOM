const User = require("../models/user");
const bcryptjs = require("bcryptjs");
const { errorHandler } = require("../utils/errorHandler");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const argon2 = require("argon2");
const Store = require("../models/store");
const Staff = require("../models/staff"); // Đường dẫn tới modal Staff của bạn
const UserPersonalInfo = require("../models/userPersonal"); // Đường dẫn tới modal Staff của bạn
const ShipperInfo = require("../models/shipper");
// const firebase = require("../firebase");

const changePassword = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    console.log("Received change password request:", {
      userId,
      currentPassword,
      newPassword,
      confirmNewPassword,
    });

    // Kiểm tra nếu thiếu dữ liệu đầu vào
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ msg: "Vui lòng điền đầy đủ các trường." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: "Không tìm thấy người dùng" });
    }

    console.log("User found:", user);

    // Use bcryptjs to verify the current password
    const isPasswordValid = await bcryptjs.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ msg: "Mật khẩu hiện tại không đúng" });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ msg: "Mật khẩu mới và xác nhận mật khẩu không khớp" });
    }

    // Use bcryptjs to hash the new password
    const hashPass = await bcryptjs.hash(newPassword, 10);

    await User.findByIdAndUpdate(userId, { password: hashPass }, { new: true });

    return res.status(200).json({ msg: "Cập nhật mật khẩu thành công" });
  } catch (error) {
    console.error("Error in changePassword:", error);
    return res.status(500).json({ error: "Lỗi server" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, confirmPassword } = req.body;

    // Check if newPassword and confirmPassword match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        msg: "Mật khẩu mới và xác nhận mật khẩu không khớp",
      });
    }

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        msg: "Email không tồn tại trong hệ thống",
      });
    }

    // Hash the new password and update the user's record
    const hashedPassword = await bcryptjs.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    // Send confirmation email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Mật khẩu đã được cập nhật",
      text: `Mật khẩu của bạn đã được thay đổi thành công. Nếu bạn không yêu cầu điều này, vui lòng liên hệ với chúng tôi ngay lập tức.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, msg: "Mật khẩu đã được cập nhật thành công" });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Cập nhật mật khẩu thất bại",
      error: error.message,
    });
  }
};

const sendResetPasswordEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, msg: "Email không tồn tại" });
    }

    // Email exists, send response confirming this without sending verification code
    res.status(200).json({ success: true, msg: "Email tồn tại trong hệ thống" });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Đã xảy ra lỗi khi kiểm tra email",
      error: error.message,
    });
  }
};

const registerUser = async (req, res, next) => {
  const { username, phone, email, password } = req.body;

  // Kiểm tra các trường bắt buộc
  if (!username || !phone || !email || !password) {
    return next(errorHandler(400, "Tất cả các trường username, phone, email và password đều phải nhập"));
  }

  // Kiểm tra độ dài username và password
  if (username.length < 7 || username.length > 20) {
    return next(errorHandler(400, "Tên người dùng phải có từ 7 đến 20 ký tự"));
  }

  if (password.length < 8) {
    return next(errorHandler(400, "Mật khẩu phải có ít nhất 8 ký tự"));
  }

  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone)) {
    return next(errorHandler(400, "Số điện thoại phải bao gồm đúng 10 chữ số"));
  }

  try {
    // Kiểm tra nếu staff đã tồn tại dựa trên phone và name
    const existingStaff = await Staff.findOne({ phone: phone, name: username });

    let role = "customer"; // Vai trò mặc định là customer
    let storeId = null; // Sẽ lưu storeId nếu đăng ký là staff

    if (existingStaff) {
      // Nếu là nhân viên, chuyển vai trò thành "staff"
      if (existingStaff.user) {
        return next(errorHandler(400, "Nhân viên này đã đăng ký tài khoản"));
      }
      role = "staff"; // Đặt vai trò là staff
      storeId = existingStaff.store; // Lấy storeId từ thông tin của nhân viên
    }

    // Kiểm tra xem username, phone hoặc email đã tồn tại chưa
    const existingUser = await User.findOne({
      $or: [{ userName: username }, { phoneNumber: phone }, { email: email }],
    });

    if (existingUser) {
      if (existingUser.userName === username) {
        return next(errorHandler(400, "Tên người dùng đã tồn tại"));
      }
      if (existingUser.phoneNumber === phone) {
        return next(errorHandler(400, "Số điện thoại đã tồn tại"));
      }
      if (existingUser.email === email) {
        return next(errorHandler(400, "Email đã tồn tại"));
      }
    }

    // Mã hóa mật khẩu
    const hashedPassword = bcryptjs.hashSync(password, 10);

    // Tạo mã xác thực và thời gian hết hạn
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString(); // Mã xác thực 6 chữ số
    const verificationCodeExpiry = Date.now() + 1 * 60 * 1000; // 1 phút

    // Tạo người dùng mới với vai trò được xác định
    const newUser = new User({
      userName: username,
      phoneNumber: phone,
      email: email,
      password: hashedPassword,
      verificationCode: verificationCode,
      verificationCodeExpiry: verificationCodeExpiry,
      roleId: role, // Vai trò (customer hoặc staff)
      storeIds: storeId ? [storeId] : [], // Nếu là staff thì thêm storeId vào storeIds
    });

    // Lưu người dùng vào cơ sở dữ liệu
    await newUser.save();

    // Tạo thông tin cá nhân cho người dùng với ảnh ảo mặc định
    const defaultProfilePictureURL = "https://example.com/random-image.jpg"; // URL ảnh ảo

    const newUserPersonalInfo = new UserPersonalInfo({
      userId: newUser._id,
      profilePictureURL: defaultProfilePictureURL, // Gán ảnh ảo vào profilePictureURL
    });

    // Lưu thông tin cá nhân vào cơ sở dữ liệu
    await newUserPersonalInfo.save();

    // Nếu là nhân viên, liên kết tài khoản mới với nhân viên và cập nhật thông tin của nhân viên
    if (role === "staff") {
      existingStaff.user = newUser._id; // Liên kết người dùng mới với nhân viên
      existingStaff.isActive = true; // Đánh dấu nhân viên là active
      await existingStaff.save();

      // Tìm và cập nhật roleId trong store.staffList
      const store = await Store.findById(storeId);
      if (store) {
        const staffIndex = store.staffList.findIndex((staff) => staff.staffId.equals(existingStaff._id));
        if (staffIndex !== -1) {
          store.staffList[staffIndex].roleId = "staff"; // Cập nhật roleId của nhân viên
          await store.save();
        }
      }
    }

    // Gửi email xác thực
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Mã Xác Thực Đăng Ký",
      text: `Mã xác thực của bạn là: ${verificationCode}. Mã xác thực sẽ hết hạn sau 1 phút.`,
    };

    await transporter.sendMail(mailOptions);

    // Trả về phản hồi yêu cầu xác thực email
    res.status(201).json({
      success: true,
      message: "Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác thực.",
    });
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  const { phone, password } = req.body;

  // Kiểm tra xem phone và password có được nhập hay không
  if (!phone || !password) {
    return next(errorHandler(400, "Vui lòng nhập cả số điện thoại và mật khẩu"));
  }

  try {
    // Tìm người dùng với số điện thoại đã cung cấp
    const user = await User.findOne({ phoneNumber: phone });

    // Kiểm tra xem người dùng có tồn tại không
    if (!user) {
      return next(errorHandler(400, "Số điện thoại không chính xác"));
    }

    // Kiểm tra mật khẩu
    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) {
      return next(errorHandler(400, "Mật khẩu không chính xác"));
    }

    // Kiểm tra trạng thái xác thực
    if (!user.isVerified) {
      return next(errorHandler(400, "Tài khoản chưa được xác thực. Vui lòng kiểm tra email của bạn để xác thực."));
    }

    // Nếu người dùng là "staff", kiểm tra trạng thái "isActive" và lấy thông tin storeId
    let isActive = true; // Mặc định là true nếu không phải staff
    let storeId = null; // Lưu storeId nếu là staff
    let storeIds = []; // Khai báo mảng storeIds
    if (user.roleId === "staff") {
      const staff = await Staff.findOne({ user: user._id }).populate("store");
      if (!staff) {
        return next(errorHandler(400, "Không tìm thấy thông tin nhân viên."));
      }
      isActive = staff.isActive; // Cập nhật isActive từ staff

      // Kiểm tra trạng thái active của nhân viên
      if (!isActive) {
        return next(errorHandler(403, "Tài khoản nhân viên chưa được kích hoạt. Vui lòng liên hệ quản trị viên để kích hoạt."));
      }

      // Lưu storeId từ thông tin của nhân viên
      storeId = staff.store._id;
      storeIds = [storeId]; // Thêm storeId vào mảng storeIds
    }

    // Kiểm tra trạng thái chờ duyệt nếu người dùng là "seller"
    if (user.roleId === "seller" && !user.isApproved) {
      return next(errorHandler(403, "Tài khoản của bạn đang trong trạng thái chờ duyệt, bạn không được phép đăng nhập. Xin cảm ơn!"));
    }

    // Nếu người dùng là seller, lấy storeIds
    if (user.roleId === "seller") {
      // Lấy danh sách storeIds từ user
      storeIds = user.storeIds || []; // Gán giá trị cho storeIds
    }

    // Tạo token xác thực
    const token = jwt.sign(
      { id: user._id, role: user.roleId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" } // Token expires in 7 days
    );

    // Set cookie với token
    res.cookie("auth_token", token, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    });

    console.log("Token đã được lưu trong cookie: ", token);

    user.isOnline = true;
    await user.save();

    // Trả về phản hồi đăng nhập thành công, bao gồm isActive, storeId và storeIds (nếu là staff hoặc seller)
    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user._id,
        userName: user.userName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        roleId: user.roleId,
        isActive, // Trả về trạng thái isActive
        storeId, // Trả về storeId nếu là nhân viên
        storeIds, // Trả về mảng storeIds nếu là staff hoặc seller
        isOnline: user.isOnline, // Trả về trạng thái online
      },
    });
  } catch (error) {
    next(error);
  }
};

const logoutUser = async (req, res, next) => {
  try {
    // Find the user based on the ID from the token
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Set the online status to false
    user.isOnline = false;
    await user.save();

    // Clear the auth cookie
    res.clearCookie("auth_token");

    res.status(200).json({
      success: true,
      message: "Đăng xuất thành công",
    });
  } catch (error) {
    next(error);
  }
};

// // Đăng nhập bằng Google
// const googleCallback = (req, res) => {
//   const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
//     expiresIn: "1h",
//   });
//   res.redirect(`${process.env.CLIENT_URL}/login?token=${token}`);
// };

// // Đăng nhập bằng Facebook
// const facebookCallback = (req, res) => {
//   const token = jwt.sign({ id: req.user._id }, process.env.JWT_SECRET, {
//     expiresIn: "1h",
//   });
//   res.redirect(`${process.env.CLIENT_URL}/login?token=${token}`);
// };

const verifyEmail = async (req, res, next) => {
  const { email, verificationCode } = req.body;

  if (!email || !verificationCode) {
    return next(errorHandler(400, "Email và mã xác thực là bắt buộc"));
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return next(errorHandler(400, "Người dùng không tồn tại"));
    }

    if (user.isVerified) {
      return next(errorHandler(400, "Tài khoản đã được xác thực"));
    }

    if (user.verificationCode !== verificationCode) {
      return next(errorHandler(400, "Mã xác thực không đúng"));
    }

    if (user.verificationCodeExpiry < Date.now()) {
      return next(errorHandler(400, "Mã xác thực đã hết hạn"));
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Xác thực email thành công!Giờ bạn hãy đăng nhập",
    });
  } catch (error) {
    next(error);
  }
};

const getProfile = async (req, res, next) => {
  try {
    // Lấy thông tin người dùng từ database dựa trên user ID trong token
    const user = await User.findById(req.user.id).select("-password"); // Loại bỏ mật khẩu khỏi thông tin trả về

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Trả về thông tin người dùng
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  const { phone, email, fullName, address } = req.body;

  try {
    // Tìm người dùng dựa trên ID từ token
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // Kiểm tra xem email hoặc số điện thoại mới có trùng với bất kỳ ai khác không
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return next(errorHandler(400, "Email đã tồn tại"));
      }
    }

    if (phone && phone !== user.phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber: phone });
      if (phoneExists) {
        return next(errorHandler(400, "Số điện thoại đã tồn tại"));
      }
    }

    // Cập nhật thông tin người dùng
    user.phoneNumber = phone || user.phoneNumber;
    user.email = email || user.email;
    user.fullName = fullName || user.fullName;
    user.address = address || user.address;

    // Lưu thay đổi vào cơ sở dữ liệu
    await user.save();

    res.status(200).json({
      success: true,
      message: "Cập nhật thông tin thành công!",
      user: {
        id: user._id,
        userName: user.userName,
        phoneNumber: user.phoneNumber,
        email: user.email,
        fullName: user.fullName,
        address: user.address,
      },
    });
  } catch (error) {
    next(error);
  }
};

const resendVerificationCode = async (req, res, next) => {
  const { email } = req.body;

  // Check if email is provided
  if (!email) {
    return next(errorHandler(400, "Email là bắt buộc"));
  }

  try {
    // Find the user by email
    const user = await User.findOne({ email });

    // If user does not exist
    if (!user) {
      return next(errorHandler(404, "Người dùng không tồn tại"));
    }

    // If the user is already verified, no need to resend
    if (user.isVerified) {
      return next(errorHandler(400, "Tài khoản đã được xác thực"));
    }

    // Generate a new verification code and expiry time
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const newVerificationCodeExpiry = Date.now() + 1 * 60 * 1000; // 1 minute expiry

    // Update user's verification code and expiry in the database
    user.verificationCode = newVerificationCode;
    user.verificationCodeExpiry = newVerificationCodeExpiry;
    await user.save();

    // Send the new verification code via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Mã Xác Thực Mới",
      text: `Mã xác thực mới của bạn là: ${newVerificationCode}. Mã xác thực sẽ hết hạn sau 1 phút.`,
    };

    await transporter.sendMail(mailOptions);

    // Respond with success message
    res.status(200).json({
      success: true,
      message: "Mã xác thực đã được gửi lại. Vui lòng kiểm tra email của bạn.",
    });
  } catch (error) {
    console.error("Error in resendVerificationCode:", error);
    return res.status(500).json({
      success: false,
      message: "Gửi lại mã xác thực thất bại",
      error: error.message,
    });
  }
};

const setOnlineStatus = async (req, res) => {
  try {
    const userId = req.user.id; // Lấy ID người dùng từ token
    const { isOnline } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, msg: "Người dùng không tồn tại" });
    }

    user.isOnline = isOnline;
    await user.save();

    res.status(200).json({
      success: true,
      msg: `Trạng thái đã được cập nhật thành ${isOnline ? "on" : "off"}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      msg: "Cập nhật trạng thái thất bại",
      error: error.message,
    });
  }
};

const registerSeller = async (req, res) => {
  const { userId, representativeName, cccd, storeName, foodType, businessType, bankAccount, storeAddress, idImage } = req.body;

  try {
    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem tài khoản này đã là người bán hay chưa
    if (user.roleId === "seller") {
      return res.status(400).json({ message: "Tài khoản đã là người bán" });
    }

    const newStore = new Store({
      storeName: storeName || "",
      storeAddress: storeAddress || "",
      bankAccount: bankAccount || "",
      foodType: foodType || "",
      owner: userId,
    });

    // Lưu thông tin cửa hàng
    await newStore.save();

    console.log("New store created with ID:", newStore._id);

    // Cập nhật các trường khác cho người dùng
    user.roleId = "seller";
    user.representativeName = representativeName || user.representativeName;
    user.cccd = cccd || user.cccd;
    user.businessType = businessType || user.businessType;
    user.idImage = idImage || user.idImage;
    user.isApproved = false; // Đặt trạng thái chờ duyệt

    // Thêm storeId vào danh sách storeIds của người dùng
    user.storeIds.push(newStore._id);
    console.log("Store IDs after adding new store:", user.storeIds);

    // Lưu lại người dùng sau khi cập nhật
    await user.save();

    // Lấy lại thông tin người dùng và populate các cửa hàng liên kết
    const populatedUser = await User.findById(userId).populate({
      path: "storeIds",
      model: "Store",
      select: "storeName storeAddress bankAccount foodType createdAt",
    });
    console.log("Populated user with store details:", populatedUser);

    // Trả về thông tin người dùng và cửa hàng sau khi đăng ký thành công
    res.status(200).json({
      message: "Đăng ký người bán thành công, chờ admin duyệt",
      user: populatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const checkApprovalStatus = async (req, res) => {
  const { userId } = req.body; // Lấy userId từ body

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    if (user.roleId !== "seller" || !user.isApproved) {
      return res.status(403).json({ message: "Tài khoản chưa được duyệt làm người bán" });
    }

    res.status(200).json({ message: "Người bán đã được duyệt" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

const registerShipper = async (req, res) => {
  try {
    const { userId, fullName, cccd, address, dateOfBirth, temporaryAddress, bankAccount, vehicleNumber, profilePictureURL } = req.body;

    // Tìm kiếm người dùng dựa trên userId
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem tài khoản này đã là shipper hay chưa
    if (user.roleId === "shipper") {
      return res.status(400).json({ message: "Tài khoản đã là shipper" });
    }

    // Tạo hoặc cập nhật thông tin cá nhân cho shipper
    let personalInfo = await UserPersonalInfo.findOne({ userId });
    if (!personalInfo) {
      personalInfo = new UserPersonalInfo({
        userId: user._id,
        dateOfBirth: dateOfBirth || "", // Ngày sinh của shipper
        profilePictureURL: profilePictureURL || "https://example.com/default-profile-picture.jpg", // URL ảnh đại diện (nếu không có thì sử dụng ảnh mặc định)
      });
    } else {
      // Cập nhật thông tin cá nhân nếu đã tồn tại
      personalInfo.dateOfBirth = dateOfBirth || personalInfo.dateOfBirth;
      personalInfo.profilePictureURL = profilePictureURL || personalInfo.profilePictureURL;
    }

    // Lưu thông tin cá nhân
    await personalInfo.save();

    // Tạo hoặc cập nhật thông tin ShipperInfo
    let shipperInfo = await ShipperInfo.findOne({ userId: user._id });
    if (!shipperInfo) {
      shipperInfo = new ShipperInfo({
        userId: user._id,
        personalInfoId: personalInfo._id,
        temporaryAddress: temporaryAddress || "", // Địa chỉ tạm trú
        bankAccount: bankAccount || "", // Số tài khoản ngân hàng
        vehicleNumber: vehicleNumber || "", // Mã số xe của shipper
      });
    } else {
      // Cập nhật thông tin nếu ShipperInfo đã tồn tại
      shipperInfo.temporaryAddress = temporaryAddress || shipperInfo.temporaryAddress;
      shipperInfo.bankAccount = bankAccount || shipperInfo.bankAccount;
      shipperInfo.vehicleNumber = vehicleNumber || shipperInfo.vehicleNumber;
    }

    // Lưu thông tin shipper
    await shipperInfo.save();

    // Cập nhật vai trò người dùng thành shipper và đặt trạng thái chờ duyệt
    user.roleId = "shipper";
    user.fullName = fullName || user.fullName; // Cập nhật tên đầy đủ nếu cần
    user.cccd = cccd || user.cccd; // Cập nhật CCCD/CMND nếu cần
    user.address = address || user.address; // Cập nhật địa chỉ từ user
    user.isApproved = false; // Đặt trạng thái chờ duyệt
    await user.save();

    // Trả về phản hồi thành công và thông báo rằng tài khoản đang chờ duyệt
    res.status(200).json({
      message: "Đăng ký shipper thành công, chờ admin duyệt",
      user: {
        id: user._id,
        roleId: user.roleId,
        fullName: user.fullName,
        cccd: user.cccd,
        address: user.address, // Địa chỉ từ user
        isApproved: user.isApproved, // Trạng thái chờ duyệt
      },
      personalInfo,
      shipperInfo,
    });
  } catch (error) {
    console.error("Lỗi khi đăng ký shipper:", error);
    res.status(500).json({ message: "Lỗi server khi đăng ký shipper", error });
  }
};

module.exports = {
  registerUser,
  loginUser,
  // googleCallback,
  // facebookCallback,
  verifyEmail,
  getProfile,
  updateUser,
  sendResetPasswordEmail,
  resetPassword,
  changePassword,
  resendVerificationCode,
  logoutUser, // Add this
  setOnlineStatus,
  registerSeller,
  checkApprovalStatus,
  registerShipper,
};
