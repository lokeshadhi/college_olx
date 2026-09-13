import { useState, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth.js";
import { useSocket } from "../../hooks/useSocket.js";
import { resolveImageUrl } from "../../utils/constants.js";

const formatConversationTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffHours = (now - date) / (1000 * 60 * 60);

  if (diffHours < 24) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffHours < 48) {
    return "Yesterday";
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const ConversationList = ({
  conversations = [],
  activeId = null,
  onSelectConversation,
}) => {
  const { user } = useAuth();
  const { isOnline } = useSocket();
  const [search, setSearch] = useState("");

  const currentUserId = (user?._id || user?.id || "").toString();

  const getOtherParticipant = (conv) => {
    const raw = conv?.participants?.find((p) => {
      const pId = (p?._id || p?.id || p || "").toString();
      return pId && pId !== currentUserId;
    });
    if (typeof raw === "object" && raw !== null) {
      return raw;
    }
    return raw ? { _id: raw.toString(), name: "Student" } : null;
  };

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations;
    const term = search.toLowerCase();
    return conversations.filter((c) => {
      const otherUser = getOtherParticipant(c);
      const userName = otherUser?.name?.toLowerCase() || "";
      const productTitle = c.product?.title?.toLowerCase() || "";
      return userName.includes(term) || productTitle.includes(term);
    });
  }, [conversations, search, currentUserId]);

  return (
    <aside className="chat-sidebar">
      <div className="chat-sidebar-header">
        <h2>Messages</h2>
        <input
          type="text"
          className="chat-search-input"
          placeholder="Search chats by name or product..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <ul className="conversation-list">
        {filteredConversations.length === 0 ? (
          <li style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--color-text-muted)" }}>
            {conversations.length === 0 ? "No conversations yet" : "No matches found"}
          </li>
        ) : (
          filteredConversations.map((conv) => {
            const otherUser = getOtherParticipant(conv);
            const userIsOnline = isOnline(otherUser?._id);
            const isActive = conv._id === activeId;

            return (
              <li
                key={conv._id}
                className={`conversation-item ${isActive ? "active" : ""}`}
                onClick={() => onSelectConversation(conv._id)}
              >
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
                  <span className={`status-dot ${userIsOnline ? "online" : "offline"}`} />
                </div>

                <div className="conversation-info">
                  <div className="conversation-top-row">
                    <span className="conversation-user-name">{otherUser?.name || "Student"}</span>
                    <span className="conversation-time">
                      {formatConversationTime(conv.lastMessageAt || conv.updatedAt)}
                    </span>
                  </div>

                  {conv.product && (
                    <div className="conversation-product-tag">
                      📌 {conv.product.title}
                    </div>
                  )}

                  <div className="conversation-snippet-row">
                    <p className="conversation-snippet">
                      {conv.lastMessageContent || "Started a conversation"}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="unread-badge">{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
};

export default ConversationList;
