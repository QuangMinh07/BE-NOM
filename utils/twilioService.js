const twilio = require("twilio");
require("dotenv").config();

const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const formatPhoneNumber = (phone) => {
  let formattedPhone = phone.replace(/\s+/g, "").replace(/[^0-9]/g, "");
  if (formattedPhone.startsWith("0")) {
    formattedPhone = `+84${formattedPhone.substring(1)}`; // Thêm mã quốc gia Việt Nam
  } else if (!formattedPhone.startsWith("+")) {
    formattedPhone = `+${formattedPhone}`; // Thêm dấu "+"
  }
  return formattedPhone;
};

const sendVerificationCode = async (phoneNumber) => {
  try {
    // Định dạng số điện thoại
    const formattedPhone = formatPhoneNumber(phoneNumber);

    console.log("Verify Service SID:", process.env.TWILIO_VERIFY_SERVICE_SID);

    const verification = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verifications.create({ to: formattedPhone, channel: "sms" });

    return verification.status;
  } catch (error) {
    console.error("Error in sendVerificationCode:", error);
    if (error.code === 60203) {
      throw new Error("Đã vượt quá số lần gửi mã xác thực. Vui lòng thử lại sau một thời gian.");
    }

    throw error;
  }
};

const verifyCode = async (phoneNumber, code) => {
  try {
    // Định dạng số điện thoại
    const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

    const verificationCheck = await client.verify.v2.services(process.env.TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({ to: formattedPhoneNumber, code });

    return verificationCheck.status;
  } catch (error) {
    console.error("Error in verifyCode:", error);
    throw error;
  }
};

module.exports = { sendVerificationCode, verifyCode };
