import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiX, FiMessageSquare, FiSlash, FiAlertTriangle } from "react-icons/fi";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";
import TypingIndicator from "./TypingIndicator.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { useSocket } from "../../hooks/useSocket.js";
import { resolveImageUrl } from "../../utils/constants.js";

const ChatWindow = ({
  conversation,
  messages = [],
  onSendMessage,
  onTyping,
  isOtherTyping = false,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  onBack,
  blockStatus = { isBlocked: false, blockedByMe: false, blockedByUser: false },
  onBlockUser,
  onUnblockUser,
  onReportUser,
}) => {
  const { user } = useAuth();
  const { isOnline } = useSocket();
  const [lightboxImage, setLightboxImage] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevMessagesLength = useRef(messages.length);

  const currentUserId = (user?._id || user?.id || "").toString();
  const rawParticipant = conversation?.participants?.find((p) => {
    const pId = (p?._id || p?.id || p || "").toString();
    return pId && pId !== currentUserId;
  });

  const otherUser =
    typeof rawParticipant === "object" && rawParticipant !== null
      ? { ...rawParticipant, _id: (rawParticipant._id || rawParticipant.id || "").toString() }
      : rawParticipant
      ? { _id: rawParticipant.toString(), name: "Student" }
      : conversation?.product?.seller
      ? {
          _id: (conversation.product.owner?._id || conversation.product.owner || "").toString(),
          name: conversation.product.seller?.name || "Student",
        }
      : null;

  const otherIsOnline = isOnline(otherUser?._id);

  // Auto-scroll to bottom on new messages if near bottom
  useEffect(() => {
    if (messages.length > prevMessagesLength.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (prevMessagesLength.current === 0 && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
    prevMessagesLength.current = messages.length;
  }, [messages.length]);

  if (!conversation) {
    return (
      <div className="chat-main chat-empty-state">
        <FiMessageSquare className="chat-empty-icon" />
        <h3 style={{ margin: "0 0 0.5rem", color: "var(--color-ink)" }}>Select a Conversation</h3>
        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          Choose a chat from the sidebar or click "Chat with Seller" on any product listing.
        </p>
      </div>
    );
  }

  const product = conversation.product;

  return (
    <div className="chat-main">
      {/* Chat Header with user, product context, and moderation actions */}
      <div className="chat-main-header">
        <div className="chat-header-user">
          {onBack && (
            <button className="chat-back-button" onClick={onBack} title="Back to conversations">
              <FiArrowLeft />
            </button>
          )}

          <div className="avatar-wrapper">
            {otherUser?.profileImage ? (
              <img
                src={resolveImageUrl(otherUser.profileImage)}
                alt={otherUser.name}
                className="user-avatar-img"
              />
            ) : (
              <div className="user-avatar-placeholder">
                {otherUser?.name?.charAt(0)?.toUpperCase() || "U"}
              </div>
            )}
            <span className={`status-dot ${otherIsOnline ? "online" : "offline"}`} />
          </div>

          <div className="chat-header-user-info">
            <h3>{otherUser?.name || "Student"}</h3>
            <div className={`chat-header-status ${otherIsOnline ? "online" : ""}`}>
              {otherIsOnline ? "● Online on Campus" : "○ Offline"}
            </div>
          </div>
        </div>

        {/* Product Context Banner & Moderation Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          {product && (
            <Link
              to={`/products/${product._id}`}
              className="chat-product-banner"
              title="View product details"
            >
              {product.images?.[0] && (
                <img src={resolveImageUrl(product.images[0])} alt={product.title} />
              )}
              <div className="chat-product-meta">
                <span className="chat-product-title">{product.title}</span>
                <span className="chat-product-price">
                  ₹{Number(product.price).toLocaleString("en-IN")}
                </span>
              </div>
            </Link>
          )}

          {/* Moderation Action Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {blockStatus?.blockedByMe ? (
              <button
                type="button"
                onClick={onUnblockUser}
                style={{
                  background: "var(--color-paper-raised, #1B2138)",
                  border: "1px solid var(--color-border, #2B3253)",
                  borderRadius: "6px",
                  padding: "5px 10px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "var(--color-text, #EDEAE0)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Unblock this student"
              >
                <FiSlash /> Unblock
              </button>
            ) : (
              <button
                type="button"
                onClick={onBlockUser}
                style={{
                  background: "transparent",
                  border: "1px solid var(--color-border, #2B3253)",
                  borderRadius: "6px",
                  padding: "5px 8px",
                  fontSize: "0.78rem",
                  color: "var(--color-text-muted, #9CA3B8)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                title="Block this student from chat"
              >
                <FiSlash /> Block
              </button>
            )}

            <button
              type="button"
              onClick={onReportUser}
              style={{
                background: "transparent",
                border: "1px solid var(--color-border, #2B3253)",
                borderRadius: "6px",
                padding: "5px 8px",
                fontSize: "0.78rem",
                color: "var(--color-coral, #D9634B)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
              title="Report this student"
            >
              <FiAlertTriangle /> Report
            </button>
          </div>
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="messages-container" ref={messagesContainerRef}>
        {hasMore && (
          <button
            className="messages-load-more"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading older messages..." : "↑ Load older messages"}
          </button>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            message={msg}
            currentUserId={user?._id}
            onImageClick={(url) => setLightboxImage(url)}
          />
        ))}

        {isOtherTyping && <TypingIndicator userName={otherUser?.name || "User"} />}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input or Blocked Notice */}
      {blockStatus?.isBlocked ? (
        <div
          style={{
            padding: "16px 20px",
            background: "var(--color-bg, #FAF8F5)",
            borderTop: "1px solid var(--color-border, #E4DFD2)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.88rem",
              color: "var(--color-text-muted, #5B6478)",
              marginBottom: blockStatus.blockedByMe ? "10px" : "0",
            }}
          >
            {blockStatus.blockedByMe
              ? "You have blocked this student. You cannot send or receive messages in this chat."
              : "Communication in this chat is unavailable because you have been blocked."}
          </div>
          {blockStatus.blockedByMe && (
            <button
              onClick={onUnblockUser}
              style={{
                padding: "6px 14px",
                background: "var(--color-paper-raised, #FFFFFF)",
                border: "1px solid var(--color-border, #E4DFD2)",
                borderRadius: "6px",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--color-ink, #16213E)",
                cursor: "pointer",
              }}
            >
              Unblock to resume chat
            </button>
          )}
        </div>
      ) : (
        <MessageInput
          onSendMessage={onSendMessage}
          onTyping={onTyping}
        />
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div className="image-lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="image-lightbox-close"
              onClick={() => setLightboxImage(null)}
              title="Close"
            >
              <FiX />
            </button>
            <img src={lightboxImage} alt="Attachment preview" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
