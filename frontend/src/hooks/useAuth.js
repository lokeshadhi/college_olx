import { useContext } from "react";
import { AuthContext } from "../context/AuthContext.jsx";

// Convenience hook so components can `const { user, login } = useAuth()`
// instead of importing AuthContext + useContext everywhere.
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
