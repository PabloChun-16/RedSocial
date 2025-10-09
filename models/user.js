const { Schema, model } = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

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
    required: true
  },
  role: {
    type: String,
    default: "ROLE_USER"
  },
  image: {
    type: String,
    default: "default.png"
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
