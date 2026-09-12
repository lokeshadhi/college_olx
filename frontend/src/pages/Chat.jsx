import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import ConversationList from "../components/chat/ConversationList.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useSocket } from "../hooks/useSocket.js";
import { chatService } from "../services/chatService.js";
import "../styles/chat.css";

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [smartReplies, setSmartReplies] = useState([]);
  const [smartReplyLoading, setSmartReplyLoading] = useState(false);

  // Load all user conversations
  const loadConversations = useCallback(async () => {
    try {
      const res = await chatService.getConversations();
      if (res.success) {
        setConversations(res.data || []);
      }
    } catch (error) {
      toast.error("Failed to load conversations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load active conversation details and messages
  const loadActiveConversation = useCallback(
    async (convId, pageNum = 1) => {
      try {
        if (pageNum === 1) {
          const convRes = await chatService.getConversationById(convId);
          if (convRes.success) {
            setActiveConversation(convRes.data);
          }
        }

        const msgRes = await chatService.getMessages(convId, pageNum, 30);
        if (msgRes.success) {
          if (pageNum === 1) {
            setMessages(msgRes.data.messages || []);
          } else {
            setMessages((prev) => [...msgRes.data.messages, ...prev]);
          }
          setPage(pageNum);
          setHasMore(pageNum < msgRes.data.totalPages);
        }

        // Mark messages as read locally and on server
        await chatService.markMessagesAsRead(convId).catch(() => {});
        if (socket && isConnected) {
          socket.emit("message_read", { conversationId: convId });
        }

        // Reset unread count for this conversation in the sidebar list
        setConversations((prev) =>
          prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
        );
      } catch (error) {
        toast.error("Failed to load chat messages");
      }
    },
    [socket, isConnected]
  );

  // Sync route param with active conversation
  useEffect(() => {
    if (conversationId) {
      loadActiveConversation(conversationId, 1);
    } else if (conversations.length > 0 && window.innerWidth > 768) {
      // On desktop, auto-open the first conversation if none selected in URL
      navigate(`/chat/${conversations[0]._id}`, { replace: true });
    } else {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [conversationId, conversations.length, loadActiveConversation, navigate]);

  // Socket room management and real-time listeners
  useEffect(() => {
    if (!socket || !isConnected || !conversationId) return;

    // Join room
    socket.emit("join_conversation", { conversationId });

    // Handle incoming message
    const handleNewMessage = (newMsg) => {
      if (newMsg.conversation === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });

        // Mark as read immediately if current user is the receiver
        if (newMsg.receiver === user?._id) {
          socket.emit("message_read", { conversationId });
          chatService.markAsRead(conversationId).catch(() => {});
        }
      }

      // Update sidebar snippet
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === newMsg.conversation) {
            return {
              ...c,
              lastMessage: newMsg._id,
              lastMessageContent:
                newMsg.messageType === "image" ? "📷 Photo" : newMsg.content?.slice(0, 100),
              lastMessageAt: newMsg.createdAt,
              unreadCount:
                newMsg.conversation === conversationId || newMsg.sender === user?._id
                  ? 0
                  : (c.unreadCount || 0) + 1,
            };
          }
          return c;
        })
      );
    };

    // Handle read receipts
    const handleMessagesRead = ({ conversationId: readConvId, readerId, readAt }) => {
      if (readConvId === conversationId && readerId !== user?._id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender?._id === user?._id || m.sender === user?._id
              ? { ...m, read: true, readAt }
              : m
          )
        );
      }
    };

    // Handle typing events
    const handleUserTyping = ({ conversationId: typingConvId, userId: typingUserId }) => {
      if (typingConvId === conversationId && typingUserId !== user?._id) {
        setIsOtherTyping(true);
      }
    };

    const handleUserStopTyping = ({ conversationId: typingConvId, userId: typingUserId }) => {
      if (typingConvId === conversationId && typingUserId !== user?._id) {
        setIsOtherTyping(false);
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("messages_read", handleMessagesRead);
    socket.on("user_typing", handleUserTyping);
    socket.on("user_stop_typing", handleUserStopTyping);

    return () => {
      socket.emit("leave_conversation", { conversationId });
      socket.off("new_message", handleNewMessage);
      socket.off("messages_read", handleMessagesRead);
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stop_typing", handleUserStopTyping);
      setIsOtherTyping(false);
    };
  }, [socket, isConnected, conversationId, user?._id]);

  // Sending message (text or image)
  const handleSendMessage = async ({ content, imageFile }) => {
    if (!conversationId) return;

    let imageUrl = "";
    let messageType = "text";

    if (imageFile) {
      const uploadRes = await chatService.uploadChatImage(imageFile);
      if (!uploadRes.success) {
        throw new Error(uploadRes.message || "Image upload failed");
      }
      imageUrl = uploadRes.imageUrl;
      messageType = "image";
    }

    const payload = {
      conversationId,
      content,
      messageType,
      imageUrl,
    };

    // Try socket emission first with acknowledgment callback
    if (socket && isConnected) {
      return new Promise((resolve, reject) => {
        socket.emit("send_message", payload, (response) => {
          if (response?.success) {
            resolve(response.message);
          } else {
            // Fallback to REST API if socket rejected
            chatService
              .sendMessage(conversationId, payload)
              .then((res) => resolve(res.data))
              .catch(reject);
          }
        });
      });
    } else {
      // Fallback: send via REST
      const res = await chatService.sendMessage(conversationId, payload);
      setMessages((prev) => [...prev, res.data]);
      return res.data;
    }
  };

  // Throttled typing event dispatcher
  const handleTyping = (isTyping) => {
    if (!socket || !isConnected || !conversationId) return;
    if (isTyping) {
      socket.emit("typing_start", { conversationId });
    } else {
      socket.emit("typing_stop", { conversationId });
    }
  };

  // Load older messages on pagination scroll
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || !conversationId) return;
    setLoadingMore(true);
    try {
      await loadActiveConversation(conversationId, page + 1);
    } finally {
      setLoadingMore(false);
    }
  };

  // Generate AI Smart Replies
  const handleRequestSmartReplies = async () => {
    if (!conversationId || smartReplyLoading) return;
    setSmartReplyLoading(true);
    try {
      const res = await chatService.getAiSmartReplies(conversationId);
      if (res.success && Array.isArray(res.data)) {
        setSmartReplies(res.data);
      }
    } catch (error) {
      toast.error("AI reply unavailable");
    } finally {
      setSmartReplyLoading(false);
    }
  };

  const handleSelectConversation = (id) => {
    navigate(`/chat/${id}`);
  };

  const handleBackToConversations = () => {
    navigate("/chat");
  };

  if (loading) {
    return (
      <MainLayout>
        <div style={{ display: "flex", justifyContent: "center", padding: "4rem" }}>
          <Loader />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="chat-page-container">
        <div className="chat-card">
          {/* Conversation List (Sidebar) */}
          <div className={`chat-sidebar-wrapper ${conversationId ? "mobile-hidden" : ""}`}>
            <ConversationList
              conversations={conversations}
              activeId={conversationId}
              onSelectConversation={handleSelectConversation}
            />
          </div>

          {/* Active Chat Window */}
          <div className={`chat-main-wrapper ${!conversationId ? "mobile-hidden" : ""}`} style={{ flex: 1, display: "flex", minWidth: 0 }}>
            <ChatWindow
              conversation={activeConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              isOtherTyping={isOtherTyping}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              loadingMore={loadingMore}
              smartReplies={smartReplies}
              onRequestSmartReplies={handleRequestSmartReplies}
              smartReplyLoading={smartReplyLoading}
              onBack={handleBackToConversations}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Chat;
