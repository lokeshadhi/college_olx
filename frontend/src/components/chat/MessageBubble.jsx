import { FiCheck, FiAlertTriangle } from "react-icons/fi";
import { resolveImageUrl } from "../../utils/constants.js";

const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessageBubble = ({ message, currentUserId, onImageClick }) => {
  const senderId = message.sender?._id ? message.sender._id.toString() : message.sender?.toString();
  const isSent = senderId === currentUserId?.toString();

  const isScamRisk = message.securityAnalysis?.risk === "high";

  return (
    <div className={`message-row ${isSent ? "sent" : "received"}`}>
      <div className="message-bubble">
        {message.messageType === "image" && message.imageUrl && (
          <img
            src={resolveImageUrl(message.imageUrl)}
            alt="Chat attachment"
            className="message-image"
            onClick={() => onImageClick && onImageClick(resolveImageUrl(message.imageUrl))}
            loading="lazy"
          />
        )}

        {message.content && (
          <div className="message-text">{message.content}</div>
        )}

        {isScamRisk && (
          <div className="message-scam-alert">
            <div className="message-scam-alert-header">
              <FiAlertTriangle /> Safety Alert
            </div>
            <div>
              {message.securityAnalysis.reason ||
                "This message may contain suspicious payment or verification requests. Never wire money or share OTPs before inspecting items on campus."}
            </div>
          </div>
        )}

        <div className="message-meta">
          <span>{formatMessageTime(message.createdAt)}</span>
          {isSent && (
            <span className={`receipt-icon ${message.read ? "receipt-read" : ""}`}>
              {message.read ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
