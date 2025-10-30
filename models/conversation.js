const { Schema, model, Types } = require("mongoose");

const ensureParticipantsKey = (participants = []) => {
  if(!Array.isArray(participants)){
    return "";
  }
  const ids = participants
    .map((value) => {
      if(value instanceof Types.ObjectId){
        return value.toString();
      }
      if(value && typeof value === "object" && typeof value.toString === "function"){
        return value.toString();
      }
      if(typeof value === "string"){
        return value;
      }
      return null;
    })
    .filter(Boolean)
    .sort();
  return ids.join(":");
};

const conversationSchema = new Schema(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: "User", required: true }],
      validate: {
        validator(value){
          return Array.isArray(value) && value.filter(Boolean).length === 2;
        },
        message: "Una conversación directa requiere exactamente dos participantes"
      }
    },
    participantsKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    lastMessage: {
      text: { type: String, trim: true, default: "" },
      sender: { type: Schema.Types.ObjectId, ref: "User", default: null },
      createdAt: { type: Date, default: null }
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

conversationSchema.pre("validate", function(next){
  if(!Array.isArray(this.participants)){
    this.participants = [];
  }
  this.participants = this.participants.filter(Boolean);
  if(this.participants.length !== 2){
    return next(new Error("Una conversación directa requiere exactamente dos participantes"));
  }
  const key = ensureParticipantsKey(this.participants);
  this.participantsKey = key;
  if(!this.unreadCounts || typeof this.unreadCounts !== "object"){
    this.unreadCounts = new Map();
  }
  const ids = key.split(":");
  if(this.unreadCounts instanceof Map){
    ids.forEach((id) => {
      if(!this.unreadCounts.has(id)){
        this.unreadCounts.set(id, 0);
      }
    });
  }else{
    ids.forEach((id) => {
      if(!Object.prototype.hasOwnProperty.call(this.unreadCounts, id)){
        this.unreadCounts[id] = 0;
      }
    });
  }
  next();
});

module.exports = model("Conversation", conversationSchema, "conversations");
