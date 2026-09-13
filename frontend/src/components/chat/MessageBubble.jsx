import { FiCheck } from "react-icons/fi";
import { resolveImageUrl } from "../../utils/constants.js";

const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessageBubble = ({ message, currentUserId, onImageClick }) => {
  const senderId = message.sender?._id ? message.sender._id.toString() : message.sender?.toString();
  const isSent = senderId === currentUserId?.toString();

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
