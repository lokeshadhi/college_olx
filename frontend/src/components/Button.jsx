// Generic button wrapper so every CTA in the app shares the same variants,
// sizing, loading state, and disabled behavior.
const Button = ({
  children,
  variant = "primary", // primary | outline | ghost | danger
  size = "md", // md | sm
  block = false,
  loading = false,
  loadingText,
  disabled = false,
  type = "button",
  onClick,
  className = "",
  ...rest
}) => {
  const classes = [
    "btn",
    `btn-${variant}`,
    size === "sm" ? "btn-sm" : "",
    block ? "btn-block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled || loading} {...rest}>
      {loading ? (loadingText || "Please wait...") : children}
    </button>
  );
};

export default Button;
