import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import MainLayout from "../layouts/MainLayout.jsx";
import ConversationList from "../components/chat/ConversationList.jsx";
import ChatWindow from "../components/chat/ChatWindow.jsx";
import ReportModal from "../components/chat/ReportModal.jsx";
import KeyBackupModal from "../components/chat/KeyBackupModal.jsx";
import Loader from "../components/Loader.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useSocket } from "../hooks/useSocket.js";
import { chatService } from "../services/chatService.js";
import e2eeService from "../crypto/e2eeService.js";
import "../styles/chat.css";

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected, setActiveConversation: setGlobalActiveConversation, fetchUnreadCount } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [blockStatus, setBlockStatus] = useState({ isBlocked: false, blockedByMe: false, blockedByUser: false });
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [keyStatusModalOpen, setKeyStatusModalOpen] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState(null);
  const [displayedConversationId, setDisplayedConversationId] = useState(null);

  // Per-conversation message cache: convId -> { messages, hasMore, page, timestamp }
  const messagesCacheRef = useRef(new Map());
  // Active request tracking to eliminate race conditions
  const currentRequestRef = useRef({ conversationId: null, requestId: 0 });

  const [peerE2eeInfo, setPeerE2eeInfo] = useState({
    isEncrypted: false,
    peerHasKey: false,
    keyChanged: false,
    currentFingerprint: "",
  });

  const currentUserId = (user?._id || user?.id || "").toString();

  // Robustly extract other participant from activeConversation, sidebar list, or product
  const otherUser = useMemo(() => {
    const activeParticipants = activeConversation?.participants || [];
    let found = activeParticipants.find((p) => {
      const pId = (p?._id || p?.id || p || "").toString();
      return pId && pId !== currentUserId;
    });

    if (!found || typeof found === "string") {
      const convInList = conversations.find(
        (c) => (c._id || c.id)?.toString() === conversationId
      );
      const listParticipant = convInList?.participants?.find((p) => {
        const pId = (p?._id || p?.id || p || "").toString();
        return pId && pId !== currentUserId && typeof p === "object" && p !== null;
      });
      if (listParticipant) {
        found = listParticipant;
      }
    }

    if (!found) {
      const product = activeConversation?.product;
      const ownerId = (product?.owner?._id || product?.owner || "").toString();
      if (ownerId && ownerId !== currentUserId) {
        found = {
          _id: ownerId,
          id: ownerId,
          name: product?.seller?.name || "Student",
          phone: product?.seller?.phone,
          department: product?.seller?.department,
        };
      }
    }

    if (typeof found === "object" && found !== null) {
      const idStr = (found._id || found.id || "").toString();
      return {
        ...found,
        _id: idStr,
        id: idStr,
      };
    } else if (found) {
      const idStr = found.toString();
      return {
        _id: idStr,
        id: idStr,
        name: "Student",
      };
    }

    return null;
  }, [activeConversation, conversations, conversationId, currentUserId]);

  // Find all conversations belonging to this same peer/seller across different products
  const peerConversations = useMemo(() => {
    if (!otherUser?._id) return [];
    const otherIdStr = otherUser._id.toString();
    return conversations.filter((c) => {
      const p = c.participants?.find((part) => {
        const id = (part?._id || part?.id || part || "").toString();
        return id === otherIdStr;
      });
      return Boolean(p);
    });
  }, [conversations, otherUser?._id]);

  // Mobile virtual keyboard & viewport height dynamic tracking
  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateViewport = () => {
      const height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      document.documentElement.style.setProperty("--chat-viewport-height", `${height}px`);
    };

    updateViewport();

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport);
      window.visualViewport.addEventListener("scroll", updateViewport);
    } else {
      window.addEventListener("resize", updateViewport);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewport);
        window.visualViewport.removeEventListener("scroll", updateViewport);
      } else {
        window.removeEventListener("resize", updateViewport);
      }
      document.documentElement.style.removeProperty("--chat-viewport-height");
    };
  }, []);

  // Initialize E2EE cryptographic identity for logged-in user from local IndexedDB
  useEffect(() => {
    if (!user?._id) return;
    let isMounted = true;

    e2eeService
      .initUserKeys(user)
      .then((res) => {
        if (!isMounted) return;
        if (res?.status === "missing_local_keys") {
          console.info("E2EE: Keys not present in local storage. Log in to restore keys.");
        }
      })
      .catch((err) => {
        console.error("E2EE key initialization error:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  // Check recipient E2EE key status and fingerprint
  useEffect(() => {
    const peerId = otherUser?._id;
    if (!peerId) {
      setPeerE2eeInfo({ isEncrypted: false, peerHasKey: false, keyChanged: false, currentFingerprint: "" });
      return;
    }

    let isMounted = true;
    e2eeService
      .getPeerPublicKey(peerId)
      .then((peerKey) => {
        if (isMounted) {
          setPeerE2eeInfo({
            isEncrypted: true,
            peerHasKey: true,
            keyChanged: Boolean(peerKey?.keyChanged),
            currentFingerprint: peerKey?.fingerprint || "",
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setPeerE2eeInfo({
            isEncrypted: false,
            peerHasKey: false,
            keyChanged: false,
            currentFingerprint: "",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [otherUser?._id]);

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

  // Load active conversation details, messages, and block relationship
  const loadActiveConversation = useCallback(
    async (convId, pageNum = 1, requestId = currentRequestRef.current.requestId) => {
      try {
        if (pageNum === 1) {
          const convRes = await chatService.getConversationById(convId);
          // Discard if user switched conversation during conversation fetch
          if (
            currentRequestRef.current.conversationId !== convId ||
            currentRequestRef.current.requestId !== requestId
          ) {
            return;
          }
          if (convRes.success) {
            setActiveConversation(convRes.data);
          }
          // Fetch block relationship for this conversation
          chatService
            .getConversationBlockStatus(convId)
            .then((res) => {
              if (
                currentRequestRef.current.conversationId === convId &&
                currentRequestRef.current.requestId === requestId &&
                res?.success
              ) {
                setBlockStatus(res.data);
              }
            })
            .catch(() => {});
        }

        const msgRes = await chatService.getMessages(convId, pageNum, 30);
        // Discard if user switched conversation during messages fetch
        if (
          currentRequestRef.current.conversationId !== convId ||
          currentRequestRef.current.requestId !== requestId
        ) {
          return;
        }

        if (msgRes.success) {
          const rawMessages = msgRes.data.messages || [];
          const myId = (user?._id || user?.id || "").toString();

          const decryptedMessages = await Promise.all(
            rawMessages.map(async (m) => {
              const dec = await e2eeService.decryptMessage(m, myId);
              return {
                ...m,
                content: dec.decryptedText,
                isEncrypted: dec.isEncrypted,
                decryptionError: dec.error,
              };
            })
          );

          // Discard if user switched conversation during decryption
          if (
            currentRequestRef.current.conversationId !== convId ||
            currentRequestRef.current.requestId !== requestId
          ) {
            return;
          }

          if (pageNum === 1) {
            setMessages(decryptedMessages);
            setDisplayedConversationId(convId);
            setPage(1);
            setHasMore(msgRes.data.totalPages > 1);
            setMessagesLoading(false);
            setMessagesError(null);

            // Update in-memory cache for this conversation
            messagesCacheRef.current.set(convId, {
              messages: decryptedMessages,
              hasMore: msgRes.data.totalPages > 1,
              page: 1,
              timestamp: Date.now(),
            });
          } else {
            setMessages((prev) => {
              const combined = [...decryptedMessages, ...prev];
              // Update cache with prepended messages
              messagesCacheRef.current.set(convId, {
                messages: combined,
                hasMore: pageNum < msgRes.data.totalPages,
                page: pageNum,
                timestamp: Date.now(),
              });
              return combined;
            });
            setPage(pageNum);
            setHasMore(pageNum < msgRes.data.totalPages);
          }
        }

        // Mark messages as read locally and on server
        if (
          currentRequestRef.current.conversationId === convId &&
          currentRequestRef.current.requestId === requestId
        ) {
          await chatService.markMessagesAsRead(convId).catch(() => {});
          if (socket && isConnected) {
            socket.emit("message_read", { conversationId: convId });
          }
          if (fetchUnreadCount) {
            fetchUnreadCount();
          }

          // Reset unread count for this conversation in the sidebar list
          setConversations((prev) =>
            prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
          );
        }
      } catch (error) {
        if (
          currentRequestRef.current.conversationId === convId &&
          currentRequestRef.current.requestId === requestId
        ) {
          setMessagesLoading(false);
          setMessagesError("Failed to load chat messages. Please try again.");
          toast.error("Failed to load chat messages");
        }
      }
    },
    [socket, isConnected, fetchUnreadCount, user?._id, user?.id]
  );

  // On desktop, auto-open the first conversation if none selected in URL
  useEffect(() => {
    if (!conversationId && conversations.length > 0 && typeof window !== "undefined" && window.innerWidth > 768) {
      navigate(`/chat/${conversations[0]._id}`, { replace: true });
    }
  }, [conversationId, conversations, navigate]);

  // Sync route param with active conversation, cache, and initiate fetch
  useEffect(() => {
    if (!conversationId) {
      currentRequestRef.current = {
        conversationId: null,
        requestId: currentRequestRef.current.requestId + 1,
      };
      setActiveConversation(null);
      setMessages([]);
      setDisplayedConversationId(null);
      setMessagesLoading(false);
      setMessagesError(null);
      setBlockStatus({ isBlocked: false, blockedByMe: false, blockedByUser: false });
      if (setGlobalActiveConversation) {
        setGlobalActiveConversation(null);
      }
      return;
    }

    if (setGlobalActiveConversation) {
      setGlobalActiveConversation(conversationId);
    }

    // 1. Invalidate any in-flight requests from earlier conversations
    const requestId = ++currentRequestRef.current.requestId;
    currentRequestRef.current.conversationId = conversationId;

    // 2. Immediately update selected conversation header preview from sidebar list
    const foundInList = conversations.find(
      (c) => (c._id || c.id)?.toString() === conversationId
    ) || null;
    setActiveConversation(foundInList);

    // 3. Immediately clear or populate messages from cache
    const cached = messagesCacheRef.current.get(conversationId);
    if (cached && Array.isArray(cached.messages)) {
      setMessages(cached.messages);
      setDisplayedConversationId(conversationId);
      setMessagesLoading(false);
      setHasMore(Boolean(cached.hasMore));
      setPage(cached.page || 1);
    } else {
      // Clear previous conversation messages immediately & show loading skeleton
      setMessages([]);
      setDisplayedConversationId(conversationId);
      setMessagesLoading(true);
      setHasMore(false);
      setPage(1);
    }
    setMessagesError(null);

    // 4. Fetch fresh conversation details and messages
    loadActiveConversation(conversationId, 1, requestId);

    return () => {
      // Invalidation handled via requestId
    };
  }, [conversationId, conversations, loadActiveConversation, setGlobalActiveConversation]);

  // Socket room management and real-time listeners
  useEffect(() => {
    if (!socket || !isConnected || !conversationId) return;

    // Join room
    socket.emit("join_conversation", { conversationId });

    // Handle incoming message
    const handleNewMessage = async (newMsg) => {
      if (newMsg.conversation === conversationId) {
        const myId = (user?._id || user?.id || "").toString();
        const dec = await e2eeService.decryptMessage(newMsg, myId);
        const decryptedMsg = {
          ...newMsg,
          content: dec.decryptedText,
          isEncrypted: dec.isEncrypted,
          decryptionError: dec.error,
        };

        setMessages((prev) => {
          if (prev.some((m) => m._id === decryptedMsg._id)) return prev;
          return [...prev, decryptedMsg];
        });

        // Mark as read immediately if current user is the receiver and viewing
        const receiverId = (newMsg.receiver?._id || newMsg.receiver || "").toString();
        if (receiverId === myId) {
          socket.emit("message_read", { conversationId });
          chatService.markMessagesAsRead(conversationId).catch(() => {});
          if (fetchUnreadCount) fetchUnreadCount();
        }
      }

      // Update sidebar snippet
      setConversations((prev) =>
        prev.map((c) => {
          if (c._id === newMsg.conversation) {
            const preview = Number(newMsg.encryptionVersion) >= 1
              ? "🔒 Encrypted Message"
              : (newMsg.messageType === "image" ? "📷 Photo" : newMsg.content?.slice(0, 100));

            const senderId = (newMsg.sender?._id || newMsg.sender || "").toString();
            const myId = (user?._id || user?.id || "").toString();

            return {
              ...c,
              lastMessage: newMsg._id,
              lastMessageContent: preview,
              lastMessageAt: newMsg.createdAt,
              unreadCount:
                newMsg.conversation === conversationId || senderId === myId
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
  }, [socket, isConnected, conversationId, user?._id, fetchUnreadCount]);

  // Sending message (text or image)
  const handleSendMessage = async ({ content, imageFile }) => {
    if (!conversationId) return;

    if (blockStatus?.isBlocked) {
      throw new Error("Cannot send messages. Communication is blocked.");
    }

    let imageUrl = "";
    let messageType = "text";

    if (imageFile) {
      const uploadRes = await chatService.uploadChatImage(imageFile, conversationId);
      if (!uploadRes.success) {
        throw new Error(uploadRes.message || "Image upload failed");
      }
      imageUrl = uploadRes.imageUrl;
      messageType = "image";
    }

    let payload = {
      conversationId,
      content,
      messageType,
      imageUrl,
      encryptionVersion: 0,
    };

    if (messageType === "text" && peerE2eeInfo.peerHasKey && otherUser?._id) {
      try {
        const encrypted = await e2eeService.encryptMessage(
          conversationId,
          currentUserId,
          otherUser._id,
          content
        );
        payload = {
          conversationId,
          content: "",
          messageType: "text",
          imageUrl: "",
          ...encrypted,
        };
      } catch (err) {
        console.warn("E2EE encryption warning, sending legacy fallback:", err);
      }
    }

    // Decrypt returned message before saving to state
    const formatReturnedMessage = async (rawMsg) => {
      const dec = await e2eeService.decryptMessage(rawMsg, currentUserId);
      return {
        ...rawMsg,
        content: dec.decryptedText,
        isEncrypted: dec.isEncrypted,
        decryptionError: dec.error,
      };
    };

    // Try socket emission first with acknowledgment callback
    if (socket && isConnected) {
      return new Promise((resolve, reject) => {
        socket.emit("send_message", payload, async (response) => {
          if (response?.success) {
            const formatted = await formatReturnedMessage(response.message);
            resolve(formatted);
          } else {
            // Fallback to REST API if socket rejected
            try {
              const res = await chatService.sendMessage(conversationId, payload);
              const formatted = await formatReturnedMessage(res.data);
              if (currentRequestRef.current.conversationId === conversationId) {
                setMessages((prev) => [...prev, formatted]);
              }
              const cached = messagesCacheRef.current.get(conversationId);
              if (cached && Array.isArray(cached.messages)) {
                messagesCacheRef.current.set(conversationId, {
                  ...cached,
                  messages: [...cached.messages, formatted],
                });
              }
              resolve(formatted);
            } catch (err) {
              reject(err);
            }
          }
        });
      });
    } else {
      // Fallback: send via REST
      const res = await chatService.sendMessage(conversationId, payload);
      const formatted = await formatReturnedMessage(res.data);
      if (currentRequestRef.current.conversationId === conversationId) {
        setMessages((prev) => [...prev, formatted]);
      }
      const cached = messagesCacheRef.current.get(conversationId);
      if (cached && Array.isArray(cached.messages)) {
        messagesCacheRef.current.set(conversationId, {
          ...cached,
          messages: [...cached.messages, formatted],
        });
      }
      return formatted;
    }
  };

  // Throttled typing event dispatcher
  const handleTyping = (isTyping) => {
    if (!socket || !isConnected || !conversationId) return;
    if (blockStatus?.isBlocked) return;
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
      await loadActiveConversation(conversationId, page + 1, currentRequestRef.current.requestId);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSelectConversation = (id) => {
    if (!id || id === conversationId) return;
    navigate(`/chat/${id}`);
  };

  const handleBackToConversations = () => {
    navigate("/chat");
  };

  const handleBlockUser = async () => {
    const targetUserId = (otherUser?._id || otherUser?.id || "").toString();
    if (!targetUserId) {
      toast.error("Unable to identify student to block. Please select a conversation first.");
      return;
    }
    if (targetUserId === currentUserId) {
      toast.error("You cannot block yourself");
      return;
    }
    try {
      const res = await chatService.blockUser(targetUserId);
      if (res?.success) {
        toast.success(`Blocked ${otherUser?.name || "student"} successfully`);
        setBlockStatus({ isBlocked: true, blockedByMe: true, blockedByUser: false });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to block user");
    }
  };

  const handleUnblockUser = async () => {
    const targetUserId = (otherUser?._id || otherUser?.id || "").toString();
    if (!targetUserId) {
      toast.error("Unable to identify student to unblock. Please select a conversation first.");
      return;
    }
    try {
      const res = await chatService.unblockUser(targetUserId);
      if (res?.success) {
        toast.success(`Unblocked ${otherUser?.name || "student"} successfully`);
        setBlockStatus({ isBlocked: false, blockedByMe: false, blockedByUser: false });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to unblock user");
    }
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
    <MainLayout hideFooter={true}>
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
          <div className={`chat-main-wrapper ${!conversationId ? "mobile-hidden" : ""}`}>
            <ChatWindow
              key={conversationId || (activeConversation?._id || activeConversation?.id) || "empty"}
              conversation={activeConversation || conversations.find((c) => (c._id || c.id)?.toString() === conversationId)}
              messages={messages}
              messagesLoading={messagesLoading}
              messagesError={messagesError}
              displayedConversationId={displayedConversationId}
              onRetryLoad={() => loadActiveConversation(conversationId, 1, currentRequestRef.current.requestId)}
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              isOtherTyping={isOtherTyping}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onBack={handleBackToConversations}
              blockStatus={blockStatus}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              onReportUser={() => setReportModalOpen(true)}
              e2eeStatus={peerE2eeInfo}
              otherUser={otherUser}
              peerConversations={peerConversations}
              onSelectProductConversation={handleSelectConversation}
              onOpenKeyBackup={() => {
                setKeyStatusModalOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Moderation Report Modal */}
      <ReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        reportedUser={otherUser}
        conversationId={conversationId}
      />

      {/* End-to-End Encryption Key & Security Status Modal */}
      <KeyBackupModal
        isOpen={keyStatusModalOpen}
        onClose={() => setKeyStatusModalOpen(false)}
        user={user}
      />
    </MainLayout>
  );
};

export default Chat;

