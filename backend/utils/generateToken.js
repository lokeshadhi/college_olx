import jwt from "jsonwebtoken";

// Signs a JWT for the given user id and sets it as an httpOnly cookie on the response.
// httpOnly + sameSite protect the token from XSS/CSRF while still allowing the SPA to
// stay logged in across page refreshes.
const generateToken = (res, userId) => {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
};

export default generateToken;
