const { Schema, model } = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const notificationSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["like", "comment", "message"],
      required: true
    },
    actor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    publication: { type: Schema.Types.ObjectId, ref: "Publication", default: null },
    conversation: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    message: { type: String, trim: true },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  surname: {
    type: String,
    trim: true
  },
  bio: {
    type: String,
    trim: true
  },
  nick: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    }
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  provider: {
    type: String,
    enum: ["local", "google", "both"],
    default: "local"
  },
  picture: {
    type: String,
    trim: true,
    default: null
  },
  role: {
    type: String,
    default: "ROLE_USER"
  },
  imageKey: {
    type: String,
    default: null
  },
  followers: {
    type: [{ type: Schema.Types.ObjectId, ref: "User" }],
    default: () => []
  },
  following: {
    type: [{ type: Schema.Types.ObjectId, ref: "User" }],
    default: () => []
  },
  followersCount: {
    type: Number,
    default: 0
  },
  followingCount: {
    type: Number,
    default: 0
  },
  notifications: {
    type: [notificationSchema],
    default: () => []
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

// Agregar el plugin de paginación
userSchema.plugin(mongoosePaginate);

// Exportar el modelo
module.exports = model("User", userSchema, "users");
