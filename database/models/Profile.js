import mongoose from "mongoose";

// LinkedIn-style professional profile. One per user; visible to the members of the user's workspaces.
// Dates are Jalali (Shamsi) years / months because that is what the users think in.
const experienceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    company: { type: String, default: "", trim: true, maxlength: 100 },
    employmentType: { type: String, default: "", maxlength: 20 },
    location: { type: String, default: "", trim: true, maxlength: 80 },
    fromYear: { type: Number, default: null },
    fromMonth: { type: Number, default: null },
    toYear: { type: Number, default: null },
    toMonth: { type: Number, default: null },
    current: { type: Boolean, default: false },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { _id: true }
);

const educationSchema = new mongoose.Schema(
  {
    school: { type: String, required: true, trim: true, maxlength: 120 },
    degree: { type: String, default: "", trim: true, maxlength: 80 },
    field: { type: String, default: "", trim: true, maxlength: 100 },
    fromYear: { type: Number, default: null },
    toYear: { type: Number, default: null },
    description: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { _id: true }
);

const languageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    level: { type: String, default: "professional", maxlength: 20 },
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    headline: { type: String, default: "", trim: true, maxlength: 120 },
    about: { type: String, default: "", trim: true, maxlength: 2000 },
    location: { type: String, default: "", trim: true, maxlength: 80 },
    links: {
      website: { type: String, default: "", maxlength: 200 },
      linkedin: { type: String, default: "", maxlength: 200 },
      github: { type: String, default: "", maxlength: 200 },
      telegram: { type: String, default: "", maxlength: 200 },
      instagram: { type: String, default: "", maxlength: 200 },
    },
    skills: { type: [String], default: [] },
    experiences: { type: [experienceSchema], default: [] },
    education: { type: [educationSchema], default: [] },
    languages: { type: [languageSchema], default: [] },
    // set when the first-login wizard was finished or skipped (so it is never shown again)
    onboardedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

profileSchema.index({ userId: 1 }, { unique: true });

export default mongoose.models.Profile || mongoose.model("Profile", profileSchema);
