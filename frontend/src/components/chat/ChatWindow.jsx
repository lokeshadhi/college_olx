import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiArrowLeft, FiX, FiMessageSquare } from "react-icons/fi";
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
  smartReplies = [],
  onRequestSmartReplies,
  smartReplyLoading = false,
  onBack,
}) => {
  const { user } = useAuth();
  const { isOnline } = useSocket();
  const [lightboxImage, setLightboxImage] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevMessagesLength = useRef(messages.length);

  const otherUser = conversation?.participants?.find((p) => p._id !== user?._id);
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
      {/* Chat Header with user and product context */}
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

        {/* Product Context Banner */}
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

      {/* Message Input with Image Upload & AI Reply */}
      <MessageInput
        onSendMessage={onSendMessage}
        onTyping={onTyping}
        smartReplies={smartReplies}
        onRequestSmartReplies={onRequestSmartReplies}
        smartReplyLoading={smartReplyLoading}
      />

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
