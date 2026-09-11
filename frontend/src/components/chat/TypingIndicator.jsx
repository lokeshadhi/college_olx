const TypingIndicator = ({ userName = "User" }) => {
  return (
    <div className="typing-indicator-row">
      <span>{userName} is typing</span>
      <span className="typing-dots">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </span>
    </div>
  );
};

export default TypingIndicator;
