import logoLight from "../assets/campusx-logo-light.png";
import logoDark from "../assets/campusx-logo-dark.png";
import stackedLight from "../assets/campusx-stacked-light.png";
import stackedDark from "../assets/campusx-stacked-dark.png";

/**
 * CampusLogo — Official CampusX Marketplace Brand Logo
 * Features the graduate student in shopping cart with "CAMPUS X: BUY. SELL. CONNECT."
 * Automatically adapts between light and dark themes with crystal clear HD resolution.
 */
export const CampusLogo = ({ height = 48, variant = "horizontal", className = "" }) => {
  const lightSrc = variant === "stacked" ? stackedLight : logoLight;
  const darkSrc = variant === "stacked" ? stackedDark : logoDark;

  return (
    <div
      className={`campus-brand-logo ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
      }}
    >
      <img
        src={lightSrc}
        alt="CampusX: Buy. Sell. Connect."
        className="campus-logo-img light-only"
        style={{
          maxHeight: `${height}px`,
          maxWidth: "100%",
          width: "auto",
          objectFit: "contain",
          imageRendering: "auto",
          WebkitFontSmoothing: "antialiased",
          transition: "transform 0.2s ease",
        }}
      />
      <img
        src={darkSrc}
        alt="CampusX: Buy. Sell. Connect."
        className="campus-logo-img dark-only"
        style={{
          maxHeight: `${height}px`,
          maxWidth: "100%",
          width: "auto",
          objectFit: "contain",
          imageRendering: "auto",
          WebkitFontSmoothing: "antialiased",
          transition: "transform 0.2s ease",
        }}
      />
    </div>
  );
};

export default CampusLogo;
