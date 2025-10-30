const { Schema, model } = require("mongoose");

const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    text: {
      type: String,
      trim: true,
      required: true,
      maxlength: 2000
    },
    attachments: [
      new Schema(
        {
          type: {
            type: String,
            enum: ["image", "video", "file"],
            default: "image"
          },
          url: { type: String, trim: true }
        },
        { _id: false }
      )
    ],
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: () => []
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = model("Message", messageSchema, "messages");
