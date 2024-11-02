const { default: mongoose } = require("mongoose");
const Chat = require("../models/chat");
const Order = require("../models/storeOrder"); // Đảm bảo đã import model Order

const getChatMessages = async (req, res) => {
  try {
    const { roomId } = req.params; // Lấy roomId từ params

    // Tìm phòng chat theo roomId
    const chatRoom = await Chat.findOne({ roomId });

    if (!chatRoom) {
      return res.status(404).json({ message: "Không tìm thấy phòng chat" });
    }

    // Trả về đầy đủ thông tin của các tin nhắn (bao gồm senderId và receiverId)
    const messages = chatRoom.messages.map((message) => ({
      senderId: message.senderId,
      receiverId: message.receiverId,
      text: message.text,
    }));

    res.status(200).json({
      roomId: chatRoom.roomId,
      messages: messages, // Trả về mảng chứa các object với senderId, receiverId và text
    });
  } catch (error) {
    console.error("Lỗi khi lấy tin nhắn:", error); // In ra lỗi chi tiết trong terminal
    res.status(500).json({ error: "Không thể lấy tin nhắn từ phòng chat" });
  }
};

const createChatRoom = async (req, res) => {
  try {
    const { orderId } = req.params; // Lấy orderId từ params
    const orderDetails = await Order.findById(orderId); // Lấy thông tin từ đơn hàng

    if (!orderDetails) {
      return res.status(404).json({ message: "Không tìm thấy đơn hàng" });
    }

    // Lấy userId và shipperId từ orderDetails
    const userId = orderDetails.user;
    const shipperId = orderDetails.shipper;

    // Kiểm tra nếu phòng đã tồn tại
    let chatRoom = await Chat.findOne({ userId, shipperId });
    if (!chatRoom) {
      chatRoom = new Chat({
        roomId: orderId, // Dùng orderId làm roomId
        userId,
        shipperId,
        messages: [], // Khởi tạo với mảng tin nhắn trống
      });
      await chatRoom.save();
    }

    res.status(200).json(chatRoom);
  } catch (error) {
    res.status(500).json({ error: "Không thể tạo phòng chat" });
  }
};

const sendMessage = async (req, res) => {
  try {
    console.log("Request body từ client:", req.body); // Log request body để kiểm tra

    const { roomId, senderId, receiverId, text } = req.body;

    // Kiểm tra xem phòng chat có tồn tại hay không
    const chatRoom = await Chat.findOne({ roomId });
    if (!chatRoom) {
      return res.status(404).json({ message: "Không tìm thấy phòng chat" });
    }

    // Chuyển đổi senderId và receiverId thành ObjectId
    const senderObjectId = new mongoose.Types.ObjectId(senderId);
    const receiverObjectId = new mongoose.Types.ObjectId(receiverId);

    // Tạo tin nhắn mới
    const newMessage = {
      senderId: senderObjectId,
      receiverId: receiverObjectId,
      text,
      createdAt: new Date(),
    };

    // Đẩy tin nhắn vào mảng messages
    chatRoom.messages.push(newMessage);

    // Lưu lại phòng chat
    await chatRoom.save();

    // Trả về tin nhắn đã gửi
    res.status(200).json({
      message: "Tin nhắn đã được gửi",
      newMessage,
    });
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn:", error); // In ra lỗi chi tiết trong terminal
    res.status(500).json({ error: "Không thể gửi tin nhắn" });
  }
};

const getChatRooms = async (req, res) => {
  try {
    const { userId, shipperId } = req.params; // Lấy userId hoặc shipperId từ URL parameters

    // Tạo điều kiện tìm kiếm dựa trên userId hoặc shipperId
    let filter = {};
    if (userId) filter.userId = userId;
    if (shipperId) filter.shipperId = shipperId;

    // Tìm các phòng chat phù hợp với điều kiện
    const chatRooms = await Chat.find(filter).select("roomId userId shipperId");

    // Kiểm tra nếu không có phòng chat nào
    if (!chatRooms || chatRooms.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy phòng chat" });
    }

    // Trả về danh sách các phòng chat
    res.status(200).json({ chatRooms });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách phòng chat:", error);
    res.status(500).json({ error: "Không thể lấy danh sách phòng chat" });
  }
};

module.exports = { getChatMessages, createChatRoom, sendMessage, getChatRooms };
