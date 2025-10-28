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

const textBlockSchema = new Schema(
  {
    id: { type: String, trim: true },
    text: { type: String, trim: true, default: "" },
    color: { type: String, trim: true, default: "#ffffff" },
    fontSize: { type: Number, default: 24 },
    fontFamily: { type: String, trim: true, default: "inherit" },
    x: { type: Number, default: 0.5 }, // porcentaje 0-1
    y: { type: Number, default: 0.5 }, // porcentaje 0-1
    rotation: { type: Number, default: 0 },
    align: {
      type: String,
      enum: ["left", "center", "right"],
      default: "center"
    },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const storySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    image: { type: String, required: true },
    filter: { type: String, trim: true, default: "original" },
    adjustments: { type: adjustmentsSchema, default: () => ({}) },
    textBlocks: { type: [textBlockSchema], default: () => [] },
    visibility: { type: String, enum: ["public"], default: "public" },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    }
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } }
);

module.exports = model("Story", storySchema, "stories");
