// Importar dependencias
const connection = require("./database/connection");
const express = require("express");
const cors = require("cors");

// Mensaje de bienvenida
console.log("Bienvenido a mi red social");

// Conectar a la BD
connection();

// Crear el servidor node
const app = express();
const puerto = 3900;

// Configurar CORS (middleware)
app.use(cors());

// Convertir los datos del body a objetos JS
app.use(express.json());
// Servir archivos estáticos del frontend
app.use(express.static("public"));

app.use(express.urlencoded({ extended: true }));

// Configuración de las rutas
const userRoutes = require("./routes/user");
const publicationRoutes = require("./routes/publication");
const followRoutes = require("./routes/follow");
const storyRoutes = require("./routes/story");

// Prefijos para las rutas
app.use("/api/user", userRoutes);
app.use("/api/publication", publicationRoutes);
app.use("/api/follow", followRoutes);
app.use("/api/stories", storyRoutes);

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
