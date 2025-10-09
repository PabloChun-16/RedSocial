const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const User = require("../models/user");
const jwt = require("../services/jwt");

const resolvePublicPath = (relativePath = "") =>
  path.join(__dirname, "..", "public", relativePath);

const sanitizeUser = (doc) => {
  if(!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: obj._id?.toString() ?? obj.id,
    name: obj.name,
    surname: obj.surname,
    nick: obj.nick,
    email: obj.email,
    role: obj.role,
    image: obj.image || "default.png"
  };
};

// Ruta de prueba (la de siempre)
const pruebaUser = (req, res) => {
  return res.status(200).send({
    message: "Mensaje de prueba desde el controlador de usuario"
  });
};

// Registro de usuarios
const register = async (req, res) => {
  try {
    // Recoger datos de la petición
    let params = req.body;

    // Comprobar que me llegan bien (+validación)
    if (!params.name || !params.email || !params.password || !params.nick) {
      return res.status(400).json({
        status: "error",
        message: "Faltan datos por enviar"
      });
    }

    // Control usuarios duplicados
    const users = await User.find({
      $or: [
        { email: params.email.toLowerCase() },
        { nick: params.nick.toLowerCase() }
      ]
    }).exec();

    if (users && users.length >= 1) {
      return res.status(200).send({
        status: "success",
        message: "El usuario ya existe"
      });
    }

    // Cifrar la contraseña 
    let pwd = await bcrypt.hash(params.password, 10);
    params.password = pwd;

    // Crear objeto de usuario
    let user_to_save = new User(params);

    // Guardar usuario en la BD
    const userStored = await user_to_save.save();

    // Devolver resultado
    return res.status(200).json({
      status: "success",
      message: "Usuario registrado correctamente",
      user: userStored
    });

  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error en la consulta de usuarios",
      error: error.message
    });
  }
};

// Login de usuarios
const login = async (req, res) => {
  try {
    // Recoger parámetros del body
    let params = req.body;

    if (!params.email || !params.password) {
      return res.status(400).send({
        status: "error",
        message: "Faltan datos por enviar"
      });
    }

    // Buscar en la BD si existe el email
    const user = await User.findOne({ email: params.email })
      .select({ name: 1, surname: 1, nick: 1, email: 1, role: 1, image: 1, password: 1 })
      .exec();

    if (!user) {
      return res.status(404).send({
        status: "error",
        message: "No existe el usuario"
      });
    }

    // Comprobar la contraseña
    const coincide = await bcrypt.compare(params.password, user.password);
    if (!coincide) {
      return res.status(400).send({
        status: "error",
        message: "Contraseña incorrecta"
      });
    }

    // Generar token JWT
    const token = jwt.createToken(user);

    // Excluir la contraseña antes de devolver
    user.password = undefined;

    const sanitized = sanitizeUser(user);
    // Devolver los datos del usuario (y el token)
    return res.status(200).send({
      status: "success",
      message: "Login exitoso",
      user: sanitized,
      token
    });

  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error en el proceso de login",
      error: error.message
    });
  }
};

// Listar todos los usuarios (sin contraseña)
const listUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // excluye el campo password
    return res.status(200).json({
      status: "success",
      count: users.length,
      users
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error al obtener usuarios",
      error: error.message
    });
  }
};

const removeAvatarFile = (storedPath) => {
  if(!storedPath || storedPath === "default.png") return;
  const absolute = resolvePublicPath(storedPath);
  fs.promises
    .access(absolute, fs.constants.F_OK)
    .then(() => fs.promises.unlink(absolute))
    .catch(() => {});
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").exec();
    if(!user){
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado"
      });
    }
    return res.status(200).json({
      status: "success",
      user: sanitizeUser(user)
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener el perfil",
      error: error.message
    });
  }
};

const updateProfile = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const desiredNickRaw = typeof req.body.nick === "string" ? req.body.nick.trim() : undefined;
  const userId = req.user.id;
  const uploadedAvatar = req.file?.filename
    ? `uploads/avatars/${req.file.filename}`
    : null;

  const cleanupUploaded = () => {
    if(uploadedAvatar){
      removeAvatarFile(uploadedAvatar);
    }
  };

  try{
    const user = await User.findById(userId).exec();
    if(!user){
      cleanupUploaded();
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado"
      });
    }

    if(desiredNickRaw !== undefined){
      if(!desiredNickRaw){
        cleanupUploaded();
        return res.status(400).json({
          status: "error",
          message: "El nick no puede estar vacío"
        });
      }
      const desiredNick = desiredNickRaw.toLowerCase();
      if(desiredNick !== user.nick){
        const nickExists = await User.findOne({
          _id: { $ne: userId },
          nick: desiredNick
        }).select("_id");
        if(nickExists){
          cleanupUploaded();
          return res.status(409).json({
            status: "error",
            message: "El nick ya está en uso por otro usuario"
          });
        }
        user.nick = desiredNick;
      }
    }

    if(newPassword || currentPassword){
      if(!currentPassword || !newPassword){
        cleanupUploaded();
        return res.status(400).json({
          status: "error",
          message: "Debes indicar la contraseña actual y la nueva"
        });
      }
      const validPwd = await bcrypt.compare(currentPassword, user.password);
      if(!validPwd){
        cleanupUploaded();
        return res.status(400).json({
          status: "error",
          message: "La contraseña actual no es correcta"
        });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    if(uploadedAvatar){
      if(user.image && user.image !== "default.png"){
        removeAvatarFile(user.image);
      }
      user.image = uploadedAvatar;
    }

    const saved = await user.save();
    const sanitized = sanitizeUser(saved);

    return res.status(200).json({
      status: "success",
      message: "Perfil actualizado correctamente",
      user: sanitized
    });
  }catch(error){
    cleanupUploaded();
    return res.status(500).json({
      status: "error",
      message: "No se pudo actualizar el perfil",
      error: error.message
    });
  }
};

module.exports = {
  pruebaUser,
  register,
  login,
  listUsers,
  getProfile,
  updateProfile
};
