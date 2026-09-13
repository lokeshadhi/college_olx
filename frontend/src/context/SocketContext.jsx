import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../hooks/useAuth.js";
import { getUnreadCount } from "../services/chatService.js";

export const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadTotal, setUnreadTotal] = useState(0);
  const socketRef = useRef(null);
  const activeConversationIdRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setUnreadTotal(0);
      return;
    }
    try {
      const res = await getUnreadCount();
      if (res?.success && typeof res.count === "number") {
        setUnreadTotal(res.count);
      }
    } catch {
      // Silently catch in background
    }
  }, [isAuthenticated, user]);

  const setActiveConversation = useCallback((convId) => {
    activeConversationIdRef.current = convId || null;
  }, []);

  useEffect(() => {
    // Initial fetch of authoritative unread count
    if (isAuthenticated && user) {
      fetchUnreadCount();
    } else {
      setUnreadTotal(0);
    }
  }, [isAuthenticated, user?._id, fetchUnreadCount]);

  useEffect(() => {
    // Only connect if the user is authenticated
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";
    const socketUrl = apiBase.replace(/\/api\/?$/, "");

    // Create singleton socket connection with credentials support
    const socketInstance = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    socketInstance.on("connect", () => {
      setIsConnected(true);
      // Synchronize latest unread count on connect / reconnect
      fetchUnreadCount();
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", () => {
      setIsConnected(false);
    });

    // Real-time presence updates
    socketInstance.on("online_users", (userIds) => {
      if (Array.isArray(userIds)) {
        setOnlineUsers(new Set(userIds));
      }
    });

    socketInstance.on("user_online", ({ userId }) => {
      if (userId) {
        setOnlineUsers((prev) => new Set([...prev, userId]));
      }
    });

    socketInstance.on("user_offline", ({ userId }) => {
      if (userId) {
        setOnlineUsers((prev) => {
          const updated = new Set(prev);
          updated.delete(userId);
          return updated;
        });
      }
    });

    // Global message notification counter (avoids incrementing if currently viewing conversation)
    socketInstance.on("notification_new_message", (data) => {
      if (data?.conversationId && data.conversationId === activeConversationIdRef.current) {
        return;
      }
      setUnreadTotal((prev) => prev + 1);
    });

    // Authoritative unread count update broadcast by backend read receipts
    socketInstance.on("unread_count_updated", ({ unreadTotal: newTotal }) => {
      if (typeof newTotal === "number") {
        setUnreadTotal(newTotal);
      }
    });

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, user?._id, fetchUnreadCount]);

  const isOnline = useCallback(
    (userId) => {
      if (!userId) return false;
      return onlineUsers.has(userId.toString());
    },
    [onlineUsers]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        onlineUsers,
        unreadTotal,
        setUnreadTotal,
        fetchUnreadCount,
        setActiveConversation,
        isOnline,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;

