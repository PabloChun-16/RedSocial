// Cargar variables de entorno
require("dotenv").config();

// Importar dependencias
const connection = require("./database/connection");
const express = require("express");
const cors = require("cors");

// Mensaje de bienvenida
console.log("Bienvenido a mi red social");

// Conectar a la BD
connection().then(async () => {
  // Alinear índices de conversaciones para evitar colisiones por índices heredados
  try{
    const { ensureConversationIndexes } = require("./database/ensureIndexes");
    await ensureConversationIndexes();
  }catch(err){
    console.warn("No se pudieron sincronizar los índices:", err?.message);
  }
});

// Crear el servidor node
const app = express();
const puerto = 3900;

// Configurar CORS (middleware)
const parseOrigins = (value = "") =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS || "");
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`Origen no permitido por CORS: ${origin}`);
    return callback(null, false);
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// Convertir los datos del body a objetos JS
app.use(express.json());
// Servir archivos estáticos del frontend
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));

// Configuración de las rutas
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/user");
const publicationRoutes = require("./routes/publication");
const followRoutes = require("./routes/follow");
const storyRoutes = require("./routes/story");
const messageRoutes = require("./routes/message");

// Prefijos para las rutas
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/publication", publicationRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/messages", messageRoutes);

// Ruta de prueba
app.get("/ruta-prueba", (req, res) => {
  return res.status(200).json({
    mensaje: "Hola mundo desde mi red social"
  });
});

// Poner el servidor a escuchar peticiones
app.listen(puerto, () => {
  console.log("Servidor corriendo en el puerto", puerto);
});
