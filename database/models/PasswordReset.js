import mongoose from "mongoose";

// A pending "forgot password". The new password (already hashed) is only applied once the code
// sent to the account's e-mail is entered correctly. Removed automatically when it expires.
const passwordResetSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    passwordHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    codeExpiresAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }, // TTL
  },
  { timestamps: true }
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.PasswordReset || mongoose.model("PasswordReset", passwordResetSchema);
