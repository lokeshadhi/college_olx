import { useState, useRef, useEffect } from "react";
import { FiSend, FiImage, FiX } from "react-icons/fi";
import toast from "react-hot-toast";

const MessageInput = ({
  onSendMessage,
  onTyping,
  disabled = false,
}) => {
  const [content, setContent] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`;
    }
  }, [content]);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setContent(text);

    // Throttle / debounce typing indicator
    if (!isTypingRef.current && text.trim()) {
      isTypingRef.current = true;
      if (onTyping) onTyping(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      if (onTyping) onTyping(false);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large. Maximum size is 5MB.");
      return;
    }

    // Validate type
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed && !selectedImage) return;
    if (sending || disabled) return;

    setSending(true);

    // Stop typing indicator immediately
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    isTypingRef.current = false;
    if (onTyping) onTyping(false);

    try {
      await onSendMessage({
        content: trimmed,
        imageFile: selectedImage,
      });

      // Clear input
      setContent("");
      removeSelectedImage();
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (error) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="chat-input-area">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageSelect}
        />

        {/* Attachment button */}
        <button
          type="button"
          className="chat-attach-btn"
          title="Attach image (JPEG, PNG, WebP)"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending}
        >
          <FiImage />
        </button>

        {/* Input and preview container */}
        <div className="chat-input-wrapper">
          {imagePreview && (
            <div className="pending-attachment-preview">
              <img src={imagePreview} alt="Upload preview" />
              <button
                type="button"
                className="pending-attachment-remove"
                onClick={removeSelectedImage}
                title="Remove image"
              >
                <FiX />
              </button>
            </div>
          )}

          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={disabled ? "Connecting to chat..." : "Type a message..."}
            value={content}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setTimeout(() => {
                textareaRef.current?.scrollIntoView({ block: "nearest" });
              }, 200);
            }}
            rows={1}
            disabled={disabled || sending}
            maxLength={2000}
            enterKeyHint="send"
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          className="chat-send-btn"
          onClick={handleSend}
          disabled={disabled || sending || (!content.trim() && !selectedImage)}
          title="Send message"
        >
          <FiSend />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;
