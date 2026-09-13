import logoLight from "../assets/campusx-logo-light.png";
import logoDark from "../assets/campusx-logo-dark.png";

/**
 * CampusLogo — CampusX Marketplace Brand Logo
 * Features the signature CampusX Marketplace branding with academic cap,
 * shopping cart handle, and dual wheels on the "X".
 * Automatically adapts between light and dark themes.
 */
export const CampusLogo = ({ height = 42, className = "" }) => {
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
        src={logoLight}
        alt="CampusX Marketplace"
        height={height}
        className="campus-logo-img light-only"
        style={{
          height: `${height}px`,
          width: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 2px 6px rgba(12, 22, 53, 0.12))",
          transition: "transform 0.2s ease",
        }}
      />
      <img
        src={logoDark}
        alt="CampusX Marketplace"
        height={height}
        className="campus-logo-img dark-only"
        style={{
          height: `${height}px`,
          width: "auto",
          objectFit: "contain",
          filter: "drop-shadow(0 2px 10px rgba(59, 130, 246, 0.25))",
          transition: "transform 0.2s ease",
        }}
      />
    </div>
  );
};

export default CampusLogo;
