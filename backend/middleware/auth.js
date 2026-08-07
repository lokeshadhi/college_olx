import jwt from "jsonwebtoken";
import User from "../models/User.js";

// Authentication middleware: verifies the JWT (from the httpOnly cookie or an
// Authorization header) and attaches the logged-in user to req.user.
export const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Not authorized, no token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ success: false, message: "Not authorized, user no longer exists" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Not authorized, invalid or expired token" });
  }
};

// Authorization middleware: ensures the logged-in user is the owner of the
// resource being modified (used on product update/delete/sold routes).
export const isOwner = (getOwnerId) => async (req, res, next) => {
  try {
    const ownerId = await getOwnerId(req);
    if (!ownerId) {
      return res.status(404).json({ success: false, message: "Resource not found" });
    }
    if (ownerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Not authorized to modify this resource" });
    }
    next();
  } catch (error) {
    next(error);
  }
};
