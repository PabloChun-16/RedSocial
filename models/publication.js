const { Schema, model } = require("mongoose");

const adjustmentsSchema = new Schema(
  {
    brightness: { type: Number, default: 1 },
    contrast: { type: Number, default: 1 },
    saturation: { type: Number, default: 1 },
    warmth: { type: Number, default: 0 },
    fade: { type: Number, default: 0 }
  },
  { _id: false }
);

const commentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const publicationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    image: { type: String, required: true },
    caption: { type: String, trim: true },
    tags: [{ type: String, trim: true }],
    filter: { type: String, trim: true },
    adjustments: { type: adjustmentsSchema, default: () => ({}) },
    likes: { type: Number, default: 0 },
    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: { type: [commentSchema], default: () => [] },
    savedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    visibility: { type: String, enum: ["public", "friends", "private"], default: "public" }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

module.exports = model("Publication", publicationSchema, "publications");
