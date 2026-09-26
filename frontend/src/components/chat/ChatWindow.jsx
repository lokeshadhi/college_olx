import { useState, useRef, useEffect, Fragment } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowLeft,
  FiX,
  FiMessageSquare,
  FiSlash,
  FiAlertTriangle,
  FiLock,
  FiShield,
  FiChevronDown,
  FiCheck,
  FiExternalLink,
} from "react-icons/fi";
import MessageBubble from "./MessageBubble.jsx";
import MessageInput from "./MessageInput.jsx";
import TypingIndicator from "./TypingIndicator.jsx";
import { useAuth } from "../../hooks/useAuth.js";
import { useSocket } from "../../hooks/useSocket.js";
import { resolveImageUrl } from "../../utils/constants.js";

const formatDateDivider = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) {
    return "Today";
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const isCurrentYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(isCurrentYear ? {} : { year: "numeric" }),
  });
};

const ChatWindow = ({
  conversation,
  messages = [],
  messagesLoading = false,
  messagesError = null,
  displayedConversationId = null,
  onRetryLoad,
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
  e2eeStatus = { isEncrypted: true, peerHasKey: true, keyChanged: false },
  onOpenKeyBackup,
  otherUser: propOtherUser,
  peerConversations = [],
  onSelectProductConversation,
}) => {
  const { user } = useAuth();
  const { isOnline } = useSocket();
  const [lightboxImage, setLightboxImage] = useState(null);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileDropdownRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const prevMessagesLength = useRef(0);
  const prevConversationId = useRef(conversation?._id);
  const isInitialScrollDone = useRef(false);
  const prevScrollHeightRef = useRef(0);

  const windowConvId = (conversation?._id || conversation?.id)?.toString();
  const isMatchingConversation = Boolean(windowConvId && displayedConversationId && windowConvId === displayedConversationId);
  const showLoadingSkeleton = messagesLoading || !isMatchingConversation;

  // Close product dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProductDropdownOpen(false);
      }
      if (mobileDropdownRef.current && !mobileDropdownRef.current.contains(e.target)) {
        setMobileDropdownOpen(false);
      }
    };
    if (productDropdownOpen || mobileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [productDropdownOpen, mobileDropdownOpen]);

  const otherUser = propOtherUser || conversation?.participants?.find(
    (p) => (p._id || p.id || p)?.toString() !== (user?._id || user?.id)?.toString() && typeof p === "object" && p !== null
  ) || null;
  const otherIsOnline = otherUser ? isOnline(otherUser._id || otherUser.id) : false;

  const scrollToBottom = (behavior = "auto") => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior,
    });
  };

  // Reset tracking when active conversation ID changes
  useEffect(() => {
    if (conversation?._id !== prevConversationId.current) {
      prevConversationId.current = conversation?._id;
      prevMessagesLength.current = 0;
      isInitialScrollDone.current = false;
      prevScrollHeightRef.current = 0;
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [conversation?._id]);

  // Robust container-only scroll to bottom when messages load or arrive
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    if (loadingMore) {
      // Preserve scroll position when older messages are prepended
      if (prevScrollHeightRef.current > 0) {
        const addedHeight = el.scrollHeight - prevScrollHeightRef.current;
        if (addedHeight > 0) {
          el.scrollTop += addedHeight;
        }
        prevScrollHeightRef.current = 0;
      }
      prevMessagesLength.current = messages.length;
      return;
    }

    if (!isInitialScrollDone.current && messages.length > 0 && !showLoadingSkeleton) {
      // First load of messages for this conversation: jump to bottom instantly
      isInitialScrollDone.current = true;
      requestAnimationFrame(() => scrollToBottom("auto"));
      const t1 = setTimeout(() => scrollToBottom("auto"), 50);
      const t2 = setTimeout(() => scrollToBottom("auto"), 150);
      const t3 = setTimeout(() => scrollToBottom("auto"), 300);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (messages.length > prevMessagesLength.current && !showLoadingSkeleton) {
      // New message appended: smooth scroll to bottom if user is already near bottom
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;
      if (isNearBottom) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      }
    }

    prevMessagesLength.current = messages.length;
  }, [messages.length, loadingMore, showLoadingSkeleton]);

  // Ensure scroll stays pinned to bottom when security warning banner or typing indicator appears
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 250;
    if (isNearBottom) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [e2eeStatus?.keyChanged, isOtherTyping]);

  const handleOlderLoadClick = () => {
    const el = messagesContainerRef.current;
    if (el) {
      prevScrollHeightRef.current = el.scrollHeight;
    }
    if (onLoadMore) onLoadMore();
  };

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
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className={`chat-header-status ${otherIsOnline ? "online" : ""}`}>
                {otherIsOnline ? "● Online on Campus" : "○ Offline"}
              </div>
              {e2eeStatus?.isEncrypted ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "0.68rem",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#10B981",
                    fontWeight: 600,
                  }}
                  title={`End-to-End Encrypted. Fingerprint: ${e2eeStatus.currentFingerprint || ""}`}
                >
                  <FiLock size={9} /> E2EE
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    fontSize: "0.68rem",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    background: "rgba(245, 158, 11, 0.15)",
                    color: "#F59E0B",
                    fontWeight: 500,
                  }}
                  title="Recipient has not yet registered an E2EE key. Messages sent in legacy plaintext mode."
                >
                  Legacy
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Product Context Banner / Product Dropdown & Moderation Actions */}
        <div className="chat-header-right">
          {product && (
            peerConversations && peerConversations.length > 1 ? (
              <div className="chat-product-dropdown-wrapper" ref={dropdownRef}>
                <button
                  type="button"
                  className={`chat-product-dropdown-trigger ${productDropdownOpen ? "open" : ""}`}
                  onClick={() => setProductDropdownOpen((prev) => !prev)}
                  title="Switch between products discussed with this seller"
                  aria-expanded={productDropdownOpen}
                >
                  {product.images?.[0] && (
                    <img src={resolveImageUrl(product.images[0])} alt={product.title} className="chat-product-thumb" />
                  )}
                  <div className="chat-product-meta">
                    <span className="chat-product-title">{product.title}</span>
                    <span className="chat-product-price">
                      ₹{Number(product.price).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="chat-product-switch-badge">
                    <span>{peerConversations.length} products</span>
                    <FiChevronDown className={`chevron-icon ${productDropdownOpen ? "rotated" : ""}`} />
                  </div>
                </button>

                {productDropdownOpen && (
                  <div className="chat-product-dropdown-menu">
                    <div className="chat-product-dropdown-header">
                      <span>Products with {otherUser?.name || "Seller"}</span>
                      <Link
                        to={`/products/${product._id}`}
                        className="chat-product-view-link"
                        title="View listing details on store"
                        onClick={() => setProductDropdownOpen(false)}
                      >
                        View Listing <FiExternalLink size={12} />
                      </Link>
                    </div>

                    <div className="chat-product-dropdown-list">
                      {peerConversations.map((c) => {
                        const itemProduct = c.product;
                        const isCurrent = (c._id || c.id)?.toString() === (conversation._id || conversation.id)?.toString();

                        if (!itemProduct) return null;

                        return (
                          <div
                            key={c._id || c.id}
                            className={`chat-product-dropdown-item ${isCurrent ? "active-product" : ""}`}
                            onClick={() => {
                              if (!isCurrent && onSelectProductConversation) {
                                onSelectProductConversation(c._id || c.id);
                              }
                              setProductDropdownOpen(false);
                            }}
                          >
                            <div className="item-thumb-wrapper">
                              {itemProduct.images?.[0] ? (
                                <img
                                  src={resolveImageUrl(itemProduct.images[0])}
                                  alt={itemProduct.title}
                                  className="item-thumb-img"
                                />
                              ) : (
                                <div className="item-thumb-placeholder">📦</div>
                              )}
                              {c.unreadCount > 0 && <span className="item-unread-dot" />}
                            </div>

                            <div className="item-info">
                              <div className="item-title-row">
                                <span className="item-title">{itemProduct.title}</span>
                                {isCurrent && (
                                  <span className="item-current-tag">
                                    <FiCheck size={12} /> Active
                                  </span>
                                )}
                              </div>
                              <span className="item-price">
                                ₹{Number(itemProduct.price || 0).toLocaleString("en-IN")}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
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
            )
          )}

          {/* Keys & Moderation Action Buttons */}
          <div className="chat-header-actions">
            <button
              type="button"
              className="chat-action-btn"
              onClick={onOpenKeyBackup}
              title="View End-to-End Encryption Security Status"
            >
              <FiShield /> <span className="btn-label">Security</span>
            </button>

            {blockStatus?.blockedByMe ? (
              <button
                type="button"
                className="chat-action-btn chat-action-unblock"
                onClick={onUnblockUser}
                title="Unblock this student"
              >
                <FiSlash /> <span className="btn-label">Unblock</span>
              </button>
            ) : (
              <button
                type="button"
                className="chat-action-btn"
                onClick={onBlockUser}
                title="Block this student from chat"
              >
                <FiSlash /> <span className="btn-label">Block</span>
              </button>
            )}

            <button
              type="button"
              className="chat-action-btn chat-action-report"
              onClick={onReportUser}
              title="Report this student"
            >
              <FiAlertTriangle /> <span className="btn-label">Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-only compact product switcher when multiple products are being discussed */}
      {product && peerConversations && peerConversations.length > 1 && (
        <div className="chat-mobile-product-bar" ref={mobileDropdownRef}>
          <div className="chat-mobile-product-info">
            <span className="mobile-product-label">Discussing:</span>
            <span className="mobile-product-name">{product.title}</span>
            <span className="mobile-product-price">₹{Number(product.price).toLocaleString("en-IN")}</span>
          </div>
          <button
            type="button"
            className="chat-mobile-switch-btn"
            onClick={() => setMobileDropdownOpen((prev) => !prev)}
          >
            Switch ({peerConversations.length}) <FiChevronDown size={14} className={mobileDropdownOpen ? "rotated" : ""} />
          </button>

          {mobileDropdownOpen && (
            <div className="chat-product-dropdown-menu mobile-dropdown-menu">
              <div className="chat-product-dropdown-header">
                <span>Products with {otherUser?.name || "Seller"}</span>
                <Link
                  to={`/products/${product._id}`}
                  className="chat-product-view-link"
                  title="View listing details on store"
                  onClick={() => setMobileDropdownOpen(false)}
                >
                  View Listing <FiExternalLink size={12} />
                </Link>
              </div>

              <div className="chat-product-dropdown-list">
                {peerConversations.map((c) => {
                  const itemProduct = c.product;
                  const isCurrent = (c._id || c.id)?.toString() === (conversation._id || conversation.id)?.toString();

                  if (!itemProduct) return null;

                  return (
                    <div
                      key={c._id || c.id}
                      className={`chat-product-dropdown-item ${isCurrent ? "active-product" : ""}`}
                      onClick={() => {
                        if (!isCurrent && onSelectProductConversation) {
                          onSelectProductConversation(c._id || c.id);
                        }
                        setMobileDropdownOpen(false);
                      }}
                    >
                      <div className="item-thumb-wrapper">
                        {itemProduct.images?.[0] ? (
                          <img
                            src={resolveImageUrl(itemProduct.images[0])}
                            alt={itemProduct.title}
                            className="item-thumb-img"
                          />
                        ) : (
                          <div className="item-thumb-placeholder">📦</div>
                        )}
                        {c.unreadCount > 0 && <span className="item-unread-dot" />}
                      </div>

                      <div className="item-info">
                        <div className="item-title-row">
                          <span className="item-title">{itemProduct.title}</span>
                          {isCurrent && (
                            <span className="item-current-tag">
                              <FiCheck size={12} /> Active
                            </span>
                          )}
                        </div>
                        <span className="item-price">
                          ₹{Number(itemProduct.price || 0).toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Key Changed Security Warning Banner */}
      {e2eeStatus?.keyChanged && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            borderBottom: "1px solid rgba(239, 68, 68, 0.3)",
            padding: "8px 16px",
            fontSize: "0.8rem",
            color: "#FCA5A5",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <FiAlertTriangle size={16} />
          <span>
            <strong>Security Warning:</strong> This student's encryption key fingerprint has changed. Verify their identity to protect against interception.
          </span>
        </div>
      )}

      {/* Messages Scroll View */}
      <div className="messages-container" ref={messagesContainerRef}>
        {showLoadingSkeleton ? (
          <div className="messages-loading-state" aria-label="Loading conversation messages">
            <div className="message-skeleton received">
              <div className="skeleton-bubble short" />
            </div>
            <div className="message-skeleton sent">
              <div className="skeleton-bubble medium" />
            </div>
            <div className="message-skeleton received">
              <div className="skeleton-bubble long" />
            </div>
            <div className="message-skeleton sent">
              <div className="skeleton-bubble short" />
            </div>
            <div className="message-skeleton received">
              <div className="skeleton-bubble medium" />
            </div>
          </div>
        ) : messagesError ? (
          <div className="messages-error-state">
            <FiAlertTriangle size={28} style={{ color: "var(--color-danger, #FF453A)" }} />
            <p style={{ margin: "4px 0 10px", fontSize: "0.88rem" }}>{messagesError}</p>
            {onRetryLoad && (
              <button type="button" onClick={onRetryLoad} className="btn-retry-chat">
                Retry Loading
              </button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="messages-empty-state">
            <div className="messages-empty-bubble">
              <FiLock size={22} className="empty-bubble-icon" />
              <h4>End-to-End Encrypted</h4>
              <p>
                Messages and photos are secured with end-to-end encryption.
                Send a message to start chatting with {otherUser?.name || "this student"}.
              </p>
            </div>
          </div>
        ) : (
          <>
            {hasMore && (
              <button
                className="messages-load-more"
                onClick={handleOlderLoadClick}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading older messages..." : "↑ Load older messages"}
              </button>
            )}

            {messages.map((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null;
              const msgDate = msg.createdAt ? new Date(msg.createdAt).toDateString() : "";
              const prevDate = prevMsg?.createdAt ? new Date(prevMsg.createdAt).toDateString() : "";
              const showDateDivider = msgDate && msgDate !== prevDate;

              return (
                <Fragment key={msg._id || index}>
                  {showDateDivider && (
                    <div className="chat-date-divider">
                      <span>{formatDateDivider(msg.createdAt)}</span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    currentUserId={user?._id}
                    onImageClick={(url) => setLightboxImage(url)}
                  />
                </Fragment>
              );
            })}
          </>
        )}

        {isOtherTyping && <TypingIndicator userName={otherUser?.name || "User"} />}
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
