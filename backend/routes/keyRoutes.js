import express from "express";
import {
  registerPublicKey,
  getPublicKeyByUserId,
  storeEncryptedBackup,
  getEncryptedBackup,
} from "../controllers/keyController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.post("/public-key", registerPublicKey);
router.get("/public-key/:userId", getPublicKeyByUserId);
router.post("/backup", storeEncryptedBackup);
router.get("/backup", getEncryptedBackup);

export default router;
