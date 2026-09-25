import { useState, useMemo } from "react";
import { FiTag } from "react-icons/fi";
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

  // Group conversations by contact/seller so each contact only appears ONCE in sidebar
  const groupedContacts = useMemo(() => {
    const map = new Map();

    conversations.forEach((conv) => {
      const other = getOtherParticipant(conv);
      const otherId = (other?._id || other?.id || "unknown").toString();

      if (!map.has(otherId)) {
        map.set(otherId, {
          otherUser: other,
          conversations: [],
          totalUnreadCount: 0,
          latestMessageAt: conv.lastMessageAt || conv.updatedAt || conv.createdAt,
          latestSnippet: conv.lastMessageContent || "Started a conversation",
        });
      }

      const entry = map.get(otherId);
      entry.conversations.push(conv);
      entry.totalUnreadCount += conv.unreadCount || 0;

      // Keep latest message info
      const entryTime = new Date(entry.latestMessageAt || 0).getTime();
      const convTime = new Date(conv.lastMessageAt || conv.updatedAt || conv.createdAt || 0).getTime();
      if (convTime >= entryTime) {
        entry.latestMessageAt = conv.lastMessageAt || conv.updatedAt || conv.createdAt;
        entry.latestSnippet = conv.lastMessageContent || "Started a conversation";
      }
    });

    // Sort contacts by latest activity descending
    const list = Array.from(map.values()).sort((a, b) => {
      const timeA = new Date(a.latestMessageAt || 0).getTime();
      const timeB = new Date(b.latestMessageAt || 0).getTime();
      return timeB - timeA;
    });

    if (!search.trim()) return list;

    const term = search.toLowerCase();
    return list.filter((item) => {
      const userName = item.otherUser?.name?.toLowerCase() || "";
      const matchesName = userName.includes(term);
      const matchesProduct = item.conversations.some((c) =>
        c.product?.title?.toLowerCase().includes(term)
      );
      return matchesName || matchesProduct;
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
        {groupedContacts.length === 0 ? (
          <li style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--color-text-muted)" }}>
            {conversations.length === 0 ? "No conversations yet" : "No matches found"}
          </li>
        ) : (
          groupedContacts.map((contact) => {
            const otherUser = contact.otherUser;
            const userIsOnline = isOnline(otherUser?._id);
            const isTabActive = contact.conversations.some((c) => c._id === activeId);

            // Active or latest conversation in this group
            const currentConv = contact.conversations.find((c) => c._id === activeId) || contact.conversations[0];
            const currentProduct = currentConv?.product;
            const hasMultipleProducts = contact.conversations.length > 1;

            return (
              <li
                key={otherUser?._id || currentConv._id}
                className={`conversation-item ${isTabActive ? "active" : ""}`}
                onClick={() => {
                  if (isTabActive) return;
                  // Select the active conversation if one was selected, or the most recent
                  const sorted = [...contact.conversations].sort((a, b) => {
                    const tA = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
                    const tB = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
                    return tB - tA;
                  });
                  onSelectConversation(sorted[0]._id);
                }}
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
                      {formatConversationTime(contact.latestMessageAt)}
                    </span>
                  </div>

                  {currentProduct && (
                    <div className="conversation-product-tag" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        <FiTag size={11} style={{ flexShrink: 0, opacity: 0.9 }} /> {currentProduct.title}
                      </span>
                      {hasMultipleProducts && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            background: "var(--color-paper-subtle)",
                            color: "var(--color-brand-accent)",
                            padding: "1px 5px",
                            borderRadius: "10px",
                            fontWeight: 600,
                            flexShrink: 0,
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          +{contact.conversations.length - 1} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="conversation-snippet-row">
                    <p className="conversation-snippet">
                      {contact.latestSnippet}
                    </p>
                    {contact.totalUnreadCount > 0 && (
                      <span className="unread-badge">{contact.totalUnreadCount}</span>
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
