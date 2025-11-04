// Cargar variables de entorno
require("dotenv").config();

// Validación rápida de variables requeridas
const REQUIRED_ENVS = ["MONGODB_URI"];
for (const k of REQUIRED_ENVS) {
  if (!process.env[k]) {
    console.error(`❌ Falta la variable ${k} en .env`);
    process.exit(1);
  }
}

// Importar dependencias
const connection = require("./database/connection");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { debugAws } = require("./controllers/debugController");
const { initSocket } = require("./services/socket");

// Mensaje de bienvenida
console.log("Bienvenido a mi red social");

// Crear el servidor node
const app = express();
const PORT = Number(process.env.PORT || 3900);
const server = http.createServer(app);

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

// Body parsers y estáticos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

initSocket(server, { allowedOrigins });

// Rutas
const authRoutes = require("./routes/auth");
const aiRoutes = require("./routes/ai");
const searchRoutes = require("./routes/search");
const userRoutes = require("./routes/user");
const publicationRoutes = require("./routes/publication");
const followRoutes = require("./routes/follow");
const storyRoutes = require("./routes/story");
const messageRoutes = require("./routes/message");

// Prefijos para las rutas
app.get("/api/debug-aws", debugAws);
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/user", userRoutes);
app.use("/api/publication", publicationRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/messages", messageRoutes);

// Ruta de prueba
app.get("/ruta-prueba", (req, res) => {
  return res.status(200).json({ mensaje: "Hola mundo desde mi red social" });
});

// Probes útiles
app.get("/health", (_req, res) => res.status(200).send("OK"));

// Bootstrap: conectar BD y luego levantar servidor
(async () => {
  try {
    await connection(); // usa process.env.MONGODB_URI internamente
    try {
      const { ensureConversationIndexes } = require("./database/ensureIndexes");
      await ensureConversationIndexes();
    } catch (err) {
      console.warn("No se pudieron sincronizar los índices:", err?.message);
    }

    server.listen(PORT, () => {
      console.log(`Servidor corriendo en el puerto ${PORT}`);
    });
  } catch (err) {
    console.error("No se pudo inicializar la aplicación:", err?.message);
    process.exit(1);
  }
})();

// Manejo básico de errores globales
process.on("unhandledRejection", (reason) => {
  console.error("💥 UnhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("💥 UncaughtException:", err);
  process.exit(1);
});
// Fin de index.js
