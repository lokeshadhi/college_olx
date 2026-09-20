import { FiCheck, FiLock, FiUnlock, FiAlertCircle } from "react-icons/fi";
import { resolveImageUrl } from "../../utils/constants.js";

const formatMessageTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const MessageBubble = ({ message, currentUserId, onImageClick }) => {
  const senderId = message.sender?._id ? message.sender._id.toString() : message.sender?.toString();
  const isSent = senderId === currentUserId?.toString();
  const isEncrypted = Number(message.encryptionVersion) >= 1;
  const hasDecryptionError = Boolean(message.decryptionError);
  const isDecryptionFailed = hasDecryptionError || (typeof message.content === "string" && message.content.includes("Decryption failed"));

  return (
    <div className={`message-row ${isSent ? "sent" : "received"}`}>
      <div className="message-bubble">
        {message.messageType === "image" && message.imageUrl && (
          <div>
            <img
              src={resolveImageUrl(message.imageUrl)}
              alt="Chat attachment"
              className="message-image"
              onClick={() => onImageClick && onImageClick(resolveImageUrl(message.imageUrl))}
              loading="lazy"
            />
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--color-text-muted, #8D99AE)",
                marginTop: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                opacity: 0.85,
              }}
            >
              <FiUnlock size={10} />
              <span>Photo (Not E2EE in this version)</span>
            </div>
          </div>
        )}

        {isDecryptionFailed ? (
          <div className="message-decryption-notice">
            <FiAlertCircle className="decryption-notice-icon" />
            <span>{typeof message.content === "string" ? message.content.replace(/^🔒\s*/, "") : "Decryption failed: Key mismatch or tampered payload"}</span>
          </div>
        ) : (
          message.content && <div className="message-text">{message.content}</div>
        )}

        <div className="message-meta" style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          {isEncrypted && (
            <span title="End-to-End Encrypted (AES-256-GCM + RSA-OAEP)" style={{ display: "inline-flex", opacity: 0.75 }}>
              <FiLock size={10} />
            </span>
          )}
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

