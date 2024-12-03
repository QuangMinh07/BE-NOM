const UserPersonalInfo = require("../models/userPersonal");
const User = require("../models/user");

const updateUserPersonalInfo = async (req, res, next) => {
  const { dateOfBirth, gender, city, state, postalCode, country, profilePictureURL } = req.body;

  try {
    // Kiểm tra nếu bất kỳ trường nào bị thiếu
    if (!dateOfBirth || !gender || !state) {
      return next(errorHandler(400, "Tất cả các trường thông tin không được bỏ trống"));
    }
    // Tìm thông tin cá nhân của người dùng dựa trên userId
    let userPersonalInfo = await UserPersonalInfo.findOne({ userId: req.user.id });

    if (!userPersonalInfo) {
      // Nếu chưa có thông tin cá nhân, tạo mới
      userPersonalInfo = new UserPersonalInfo({
        userId: req.user.id,
        dateOfBirth,
        gender,
        city,
        state,
        postalCode,
        country,
        profilePictureURL,
      });
    } else {
      // Nếu đã có, cập nhật thông tin
      userPersonalInfo.dateOfBirth = dateOfBirth;
      userPersonalInfo.gender = gender;
      userPersonalInfo.city = city || userPersonalInfo.city;
      userPersonalInfo.state = state;
      userPersonalInfo.postalCode = postalCode || userPersonalInfo.postalCode;
      userPersonalInfo.country = country || userPersonalInfo.country;
      userPersonalInfo.profilePictureURL = profilePictureURL || userPersonalInfo.profilePictureURL;
    }

    // Lưu thông tin cá nhân đã cập nhật
    await userPersonalInfo.save();

    // Lấy thông tin đầy đủ để trả về cho người dùng
    const updatedUserPersonalInfo = await UserPersonalInfo.findOne({ userId: req.user.id }).populate("userId", "fullName address phoneNumber").exec();

    const fullName = updatedUserPersonalInfo.userId.fullName;
    const nameParts = fullName.split(" "); // Tách fullName thành các phần
    const firstName = nameParts[0]; // Lấy phần đầu tiên là firstName
    const lastName = nameParts.slice(1).join(" "); // Phần còn lại là lastName

    res.status(200).json({
      success: true,
      userPersonalInfo: {
        firstName,
        lastName,
        address: updatedUserPersonalInfo.userId.address, // Trả về address từ model User
        phoneNumber: updatedUserPersonalInfo.userId.phoneNumber, // Trả về phoneNumber từ model User
        dateOfBirth: updatedUserPersonalInfo.dateOfBirth,
        gender: updatedUserPersonalInfo.gender,
        city: updatedUserPersonalInfo.city,
        state: updatedUserPersonalInfo.state,
        postalCode: updatedUserPersonalInfo.postalCode,
        country: updatedUserPersonalInfo.country,
        profilePictureURL: updatedUserPersonalInfo.profilePictureURL,
      },
      message: "Cập nhật thông tin cá nhân thành công!",
    });
  } catch (error) {
    next(error);
  }
};

const getUserPersonalInfo = async (req, res, next) => {
  try {
    const userPersonalInfo = await UserPersonalInfo.findOne({
      userId: req.user.id,
    })
      .populate("userId", "fullName address phoneNumber") // Truy vấn để lấy fullName, address và phoneNumber từ model User
      .exec();

    if (!userPersonalInfo) {
      return res.status(404).json({ success: false, message: "Thông tin cá nhân không tồn tại" });
    }

    const fullName = userPersonalInfo.userId.fullName;
    const nameParts = fullName.split(" "); // Tách fullName thành các phần
    const firstName = nameParts[0]; // Lấy phần đầu tiên là firstName
    const lastName = nameParts.slice(1).join(" "); // Phần còn lại là lastName

    res.status(200).json({
      success: true,
      userPersonalInfo: {
        firstName,
        lastName,
        address: userPersonalInfo.userId.address, // Trả về address từ model User
        phoneNumber: userPersonalInfo.userId.phoneNumber, // Trả về phoneNumber từ model User
        dateOfBirth: userPersonalInfo.dateOfBirth,
        gender: userPersonalInfo.gender,
        city: userPersonalInfo.city,
        state: userPersonalInfo.state,
        postalCode: userPersonalInfo.postalCode,
        country: userPersonalInfo.country,
        profilePictureURL: userPersonalInfo.profilePictureURL,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUserPersonalInfo,
  updateUserPersonalInfo,
};
