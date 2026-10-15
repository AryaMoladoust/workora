import mongoose from "mongoose";

// A sign-up that has not proven its e-mail yet. Nothing is created in User / Membership until the
// 4-digit code sent to the address is entered correctly. Removed automatically when it expires.
const signupVerificationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    lastSentAt: { type: Date, default: Date.now },
    codeExpiresAt: { type: Date, required: true }, // the 4-digit code stops working here
    expiresAt: { type: Date, required: true }, // the whole record is deleted here (TTL)
  },
  { timestamps: true }
);

signupVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.SignupVerification || mongoose.model("SignupVerification", signupVerificationSchema);
