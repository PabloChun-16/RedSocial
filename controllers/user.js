const bcrypt = require("bcrypt");
const User = require("../models/user");
const Publication = require("../models/publication");
const jwt = require("../services/jwt");
const { getUnreadMessagesCount } = require("../services/messages");
const { uploadBufferToS3, deleteFileFromS3 } = require("../utils/s3");
const { resolveImageUrl, stripImageSecrets } = require("../utils/image");

const DEFAULT_AVATAR = "iconobase.png";

const getFollowCounts = (source = {}) => {
  const followersArray = Array.isArray(source.followers) ? source.followers : [];
  const followingArray = Array.isArray(source.following) ? source.following : [];
  const followersCount =
    typeof source.followersCount === "number"
      ? source.followersCount
      : followersArray.length;
  const followingCount =
    typeof source.followingCount === "number"
      ? source.followingCount
      : followingArray.length;
  return {
    followersArray,
    followingArray,
    followersCount,
    followingCount
  };
};

const sanitizeUser = (doc, extras = {}) => {
  if(!doc) return null;
  const obj = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const notifications = Array.isArray(obj.notifications) ? obj.notifications : [];
  const unreadCount = notifications.filter((item) => !item?.isRead).length;
  const { followersCount, followingCount } = getFollowCounts(obj);
  const extrasObj = typeof extras === "object" && extras !== null ? extras : {};
  const legacyImage =
    typeof obj.image === "string" && obj.image.trim() ? obj.image.trim() : null;
  const normalizedLegacy =
    legacyImage && legacyImage !== DEFAULT_AVATAR
      ? (legacyImage.startsWith("/") ? legacyImage : `/${legacyImage}`)
      : null;
  const imageKey =
    typeof obj.imageKey === "string" && obj.imageKey.trim() ? obj.imageKey.trim() : null;
  const hasExtrasUrl =
    typeof extrasObj.imageUrl === "string" && extrasObj.imageUrl.trim() ? true : false;
  const imageUrl = hasExtrasUrl
    ? extrasObj.imageUrl
    : !imageKey && normalizedLegacy
    ? normalizedLegacy
    : null;
  const picture =
    typeof extrasObj.picture === "string" && extrasObj.picture.trim()
      ? extrasObj.picture.trim()
      : typeof obj.picture === "string" && obj.picture.trim()
      ? obj.picture.trim()
      : imageUrl;
  return {
    id: obj._id?.toString() ?? obj.id,
    name: obj.name,
    surname: obj.surname,
    nick: obj.nick,
    email: obj.email,
    provider: obj.provider || (obj.googleId ? "google" : "local"),
    role: obj.role,
    bio: obj.bio,
    followers: followersCount,
    following: followingCount,
    stats: {
      followers: followersCount,
      following: followingCount,
      posts: obj.stats?.posts ?? obj.postsCount ?? 0
    },
    notificationsUnread: unreadCount,
    messagesUnread:
      typeof extrasObj.messagesUnread === "number"
        ? extrasObj.messagesUnread
        : typeof obj.messagesUnread === "number"
        ? obj.messagesUnread
        : 0,
    picture,
    imageKey,
    imageUrl,
    image: imageUrl || DEFAULT_AVATAR
  };
};

const normalizeUserRef = (value) => {
  if(!value) return null;
  const source =
    typeof value.toObject === "function" ? value.toObject({ virtuals: false }) : value;
  if(typeof source === "string"){
    return { id: source };
  }
  if(typeof source === "object" && source !== null){
    const id = source._id?.toString?.() ?? source.id ?? value?.toString?.();
    const legacyImage =
      typeof source.image === "string" && source.image.trim() ? source.image.trim() : null;
    const normalizedLegacy =
      legacyImage && legacyImage !== DEFAULT_AVATAR
        ? (legacyImage.startsWith("/") ? legacyImage : `/${legacyImage}`)
        : null;
    const imageKey =
      typeof source.imageKey === "string" && source.imageKey.trim()
        ? source.imageKey.trim()
        : null;
    return {
      id,
      nick: source.nick,
      name: source.name,
      imageKey,
      legacyImage: normalizedLegacy
    };
  }
  return null;
};

const sanitizeNotification = (doc) => {
  if(!doc) return null;
  const data = typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : doc;
  const actor = normalizeUserRef(data.actor);
  let publication = null;
  if(data.publication){
    const raw =
      typeof data.publication.toObject === "function"
        ? data.publication.toObject({ virtuals: false })
        : data.publication;
    const legacyImage =
      typeof raw.image === "string" && raw.image.trim() ? raw.image.trim() : null;
    const imageKey =
      typeof raw.imageKey === "string" && raw.imageKey.trim() ? raw.imageKey.trim() : null;
    publication = {
      id: raw._id?.toString() ?? raw.id,
      imageKey,
      legacyImage,
      caption: raw.caption,
      owner: normalizeUserRef(raw.user)
    };
  }
  let conversation = null;
  if(data.conversation){
    const raw =
      typeof data.conversation.toObject === "function"
        ? data.conversation.toObject({ virtuals: false })
        : data.conversation;
    conversation = {
      id: raw._id?.toString() ?? raw.id,
      updatedAt: raw.updatedAt,
      participants: Array.isArray(raw.participants)
        ? raw.participants.map(normalizeUserRef)
        : []
    };
  }
  return {
    id: data._id?.toString() ?? data.id,
    type: data.type,
    message: data.message,
    isRead: Boolean(data.isRead),
    createdAt: data.createdAt,
    actor,
    publication,
    conversation
  };
};

const sanitizePublicUser = (doc, currentUserId, options = {}) => {
  if(!doc) return null;
  const data =
    typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : doc;
  const { followersArray, followingArray, followersCount, followingCount } =
    getFollowCounts(data);
  const followerIds = new Set(followersArray.map((item) => item?.toString?.()).filter(Boolean));
  const followingIds = new Set(followingArray.map((item) => item?.toString?.()).filter(Boolean));
  const id = data._id?.toString?.() ?? data.id ?? null;
  const currentId = currentUserId?.toString?.() ?? currentUserId ?? null;
  const isSelf = Boolean(currentId && id && currentId === id);
  const isFollowing = !isSelf && currentId ? followerIds.has(currentId) : false;
  const isFollowed = !isSelf && currentId ? followingIds.has(currentId) : false;
  const postsCount =
    typeof options.postsCount === "number"
      ? options.postsCount
      : typeof data.postsCount === "number"
      ? data.postsCount
      : data.stats?.posts ?? 0;
  const legacyImage =
    typeof data.image === "string" && data.image.trim() ? data.image.trim() : null;
  const normalizedLegacy =
    legacyImage && legacyImage !== DEFAULT_AVATAR
      ? (legacyImage.startsWith("/") ? legacyImage : `/${legacyImage}`)
      : null;
  const imageKey =
    typeof data.imageKey === "string" && data.imageKey.trim() ? data.imageKey.trim() : null;
  const hasImageUrlOption =
    typeof options.imageUrl === "string" && options.imageUrl.trim() ? true : false;
  const imageUrl = hasImageUrlOption
    ? options.imageUrl
    : !imageKey && normalizedLegacy
    ? normalizedLegacy
    : null;

  const result = {
    id,
    nick: data.nick,
    name: data.name,
    surname: data.surname,
    bio: data.bio,
    provider: data.provider || (data.googleId ? "google" : "local"),
    picture:
      typeof data.picture === "string" && data.picture.trim()
        ? data.picture.trim()
        : imageUrl,
    image: imageUrl || DEFAULT_AVATAR,
    imageUrl,
    imageKey,
    role: data.role || "ROLE_USER",
    createdAt: data.created_at || data.createdAt || null,
    stats: {
      followers: followersCount,
      following: followingCount,
      posts: postsCount
    },
    followersCount,
    followingCount,
    isSelf,
    relationship: {
      following: isFollowing,
      followedBy: isFollowed,
      friends: isFollowing && isFollowed
    }
  };
  result.canFollow = !isSelf;
  return result;
};

const pickLegacyImage = (source) => {
  if (!source || typeof source !== "object") return null;
  if (typeof source.legacyImage === "string" && source.legacyImage.trim()) {
    return source.legacyImage.trim();
  }
  if (typeof source.image === "string" && source.image.trim()) {
    return source.image.trim();
  }
  return null;
};

const LEGACY_EXCLUDES = [DEFAULT_AVATAR];

const resolveUserImage = async (source) => {
  if (!source) return null;
  const key = source.imageKey || null;
  const legacy = pickLegacyImage(source);
  return resolveImageUrl({ key, legacy, excludeLegacy: LEGACY_EXCLUDES });
};

const decorateUserReference = async (reference) => {
  if (!reference) return null;
  const imageUrl = await resolveUserImage(reference);
  const decorated = {
    ...reference,
    imageUrl,
    image: imageUrl || DEFAULT_AVATAR
  };
  stripImageSecrets(decorated);
  return decorated;
};

const formatUserResponse = async (user, extras = {}) => {
  if (!user) return null;
  const imageUrl = await resolveUserImage(user);
  const sanitized = sanitizeUser(user, { ...extras, imageUrl });
  stripImageSecrets(sanitized);
  return sanitized;
};

const formatPublicUserResponse = async (user, currentUserId, options = {}) => {
  if (!user) return null;
  const imageUrl = await resolveUserImage(user);
  const sanitized = sanitizePublicUser(user, currentUserId, { ...options, imageUrl });
  stripImageSecrets(sanitized);
  return sanitized;
};

const decorateNotificationItem = async (notification) => {
  if (!notification) return null;
  if (notification.actor) {
    notification.actor = await decorateUserReference(notification.actor);
  }
  if (notification.publication) {
    const publication = notification.publication;
    const imageUrl = await resolveImageUrl({
      key: publication.imageKey,
      legacy: pickLegacyImage(publication)
    });
    publication.imageUrl = imageUrl;
    publication.image = imageUrl;
    if (publication.owner) {
      publication.owner = await decorateUserReference(publication.owner);
    }
    stripImageSecrets(publication);
  }
  if (notification.conversation) {
    const conversation = notification.conversation;
    if (Array.isArray(conversation.participants)) {
      const decoratedParticipants = await Promise.all(
        conversation.participants.map(decorateUserReference)
      );
      conversation.participants = decoratedParticipants.filter(Boolean);
    }
    stripImageSecrets(conversation);
  }
  stripImageSecrets(notification);
  return notification;
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
    const userResponse = await formatUserResponse(userStored);

    // Devolver resultado
    return res.status(200).json({
      status: "success",
      message: "Usuario registrado correctamente",
      user: userResponse
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
      .select({ name: 1, surname: 1, nick: 1, email: 1, role: 1, imageKey: 1, password: 1, bio: 1, notifications: 1 })
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

    const messagesUnread = await getUnreadMessagesCount(user._id);

    // Excluir la contraseña antes de devolver
    user.password = undefined;

    const userResponse = await formatUserResponse(user, { messagesUnread });
    // Devolver los datos del usuario (y el token)
    return res.status(200).send({
      status: "success",
      message: "Login exitoso",
      user: userResponse,
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
    const userDocs = await User.find().select("-password").exec(); // excluye el campo password
    const users = await Promise.all(userDocs.map((doc) => formatUserResponse(doc)));
    return res.status(200).json({
      status: "success",
      count: users.length,
      users: users.filter(Boolean)
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error al obtener usuarios",
      error: error.message
    });
  }
};

const removeAvatarFile = async (key) => {
  if(!key) return;
  await deleteFileFromS3(key);
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
    const messagesUnread = await getUnreadMessagesCount(user._id);
    const userResponse = await formatUserResponse(user, { messagesUnread });
    return res.status(200).json({
      status: "success",
      user: userResponse
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
  let uploadedAvatarKey = null;

  const cleanupUploaded = async () => {
    if(uploadedAvatarKey){
      await deleteFileFromS3(uploadedAvatarKey);
      uploadedAvatarKey = null;
    }
  };

  try{
    if(req.file){
      uploadedAvatarKey = await uploadBufferToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        folder: "uploads/avatars"
      });
    }

    const user = await User.findById(userId).exec();
    if(!user){
      await cleanupUploaded();
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado"
      });
    }

    if(desiredNickRaw !== undefined){
      if(!desiredNickRaw){
        await cleanupUploaded();
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
          await cleanupUploaded();
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
        await cleanupUploaded();
        return res.status(400).json({
          status: "error",
          message: "Debes indicar la contraseña actual y la nueva"
        });
      }
      const validPwd = await bcrypt.compare(currentPassword, user.password);
      if(!validPwd){
        await cleanupUploaded();
        return res.status(400).json({
          status: "error",
          message: "La contraseña actual no es correcta"
        });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    if(uploadedAvatarKey){
      if(user.imageKey){
        await removeAvatarFile(user.imageKey);
      }
      user.imageKey = uploadedAvatarKey;
      uploadedAvatarKey = null;
    }

    const saved = await user.save();
    const messagesUnread = await getUnreadMessagesCount(saved._id);
    const sanitized = await formatUserResponse(saved, { messagesUnread });

    return res.status(200).json({
      status: "success",
      message: "Perfil actualizado correctamente",
      user: sanitized
    });
  }catch(error){
    await cleanupUploaded();
    return res.status(500).json({
      status: "error",
      message: "No se pudo actualizar el perfil",
      error: error.message
    });
  }
};

const listNotifications = async (req, res) => {
  try{
    const user = await User.findById(req.user.id)
      .select("notifications")
      .populate("notifications.actor", "nick name imageKey")
      .populate({
        path: "notifications.publication",
        select: "imageKey caption user",
        populate: { path: "user", select: "nick name imageKey" }
      })
      .populate({
        path: "notifications.conversation",
        select: "participants updatedAt",
        populate: { path: "participants", select: "nick name imageKey" }
      })
      .exec();

    if(!user){
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado"
      });
    }

    const rawItems = Array.isArray(user.notifications)
      ? user.notifications.map(sanitizeNotification)
      : [];
    const items = (await Promise.all(rawItems.map(decorateNotificationItem))).filter(Boolean);

    return res.status(200).json({
      status: "success",
      items,
      unread: items.filter((item) => item && !item.isRead).length
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudieron obtener las notificaciones",
      error: error.message
    });
  }
};

const markNotificationsAsRead = async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((id) => id?.toString?.()).filter(Boolean)
    : [];
  try{
    if(ids.length){
      await User.updateOne(
        { _id: req.user.id },
        { $set: { "notifications.$[item].isRead": true } },
        { arrayFilters: [{ "item._id": { $in: ids } }] }
      ).exec();
    }else{
      await User.updateOne(
        { _id: req.user.id, "notifications.isRead": false },
        { $set: { "notifications.$[item].isRead": true } },
        { arrayFilters: [{ "item.isRead": false }] }
      ).exec();
    }

    const user = await User.findById(req.user.id)
      .select("notifications imageKey image")
      .exec();
    if(!user){
      return res.status(404).json({
        status: "error",
        message: "Usuario no encontrado"
      });
    }
    const sanitized = await formatUserResponse(user);

    return res.status(200).json({
      status: "success",
      unread: sanitized?.notificationsUnread ?? 0
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudieron actualizar las notificaciones",
      error: error.message
    });
  }
};

const getPublicProfile = async (req, res) => {
  const identifierRaw = req.params.identifier;
  const currentUserId = req.user.id;
  if(!identifierRaw){
    return res.status(400).json({
      status: "error",
      message: "Debes indicar el usuario a consultar"
    });
  }
  const identifier = identifierRaw.toString().trim().toLowerCase();
  const isCurrentUser =
    identifier === "me" ||
    identifier === currentUserId?.toString?.().toLowerCase() ||
    identifier === req.user.nick?.toLowerCase?.();
  try{
    let targetUser = null;
    if(isCurrentUser){
      targetUser = await User.findById(currentUserId).select("-password").exec();
    }else if(/^[0-9a-f]{24}$/.test(identifier)){
      targetUser = await User.findOne({
        $or: [{ _id: identifier }, { nick: identifier }]
      })
        .select("-password")
        .exec();
    }else{
      targetUser = await User.findOne({ nick: identifier }).select("-password").exec();
    }

    if(!targetUser){
      return res.status(404).json({
        status: "error",
        message: "El usuario no existe"
      });
    }

    const targetId = targetUser._id?.toString?.();
    const postsCount = await Publication.countDocuments({ user: targetId }).exec();
    const payload = await formatPublicUserResponse(targetUser, currentUserId, { postsCount });
    if(payload?.isSelf && identifier !== "me"){
      payload.canFollow = false;
    }

    return res.status(200).json({
      status: "success",
      user: payload
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener el perfil solicitado",
      error: error.message
    });
  }
};

module.exports = {
  pruebaUser,
  listUsers,
  getProfile,
  updateProfile,
  listNotifications,
  markNotificationsAsRead,
  getPublicProfile,
  sanitizeUser,
  sanitizePublicUser,
  formatUserResponse,
  formatPublicUserResponse,
  decorateUserReference
};
