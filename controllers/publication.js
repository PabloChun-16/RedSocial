const path = require("path");
const Publication = require("../models/publication");
const User = require("../models/user");

const PUBLIC_ROOT = path.join(__dirname, "..", "public");
const MAX_NOTIFICATIONS = 50;

const DEFAULT_ADJUSTMENTS = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  fade: 0
};

const normalizeAdjustments = (raw = {}) => {
  const normalized = { ...DEFAULT_ADJUSTMENTS };
  if(!raw || typeof raw !== "object") return normalized;
  Object.keys(normalized).forEach((key) => {
    const value = raw[key];
    if(typeof value === "number" && Number.isFinite(value)){
      normalized[key] = value;
    }else if(typeof value === "string" && value.trim() !== ""){
      const parsed = Number.parseFloat(value);
      if(!Number.isNaN(parsed)){
        normalized[key] = parsed;
      }
    }
  });
  return normalized;
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
    return {
      id,
      nick: source.nick,
      name: source.name,
      image: source.image
    };
  }
  return null;
};

const sanitizePublication = (doc, currentUserId, options = {}) => {
  if (!doc) return null;
  const data = typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : doc;
  const owner = normalizeUserRef(data.user) ?? { id: data.user?.toString?.() ?? data.user };

  const relativeImage =
    typeof data.image === "string"
      ? data.image.startsWith("/")
        ? data.image
        : `/${data.image}`
      : null;

  const likedBy = Array.isArray(data.likedBy)
    ? data.likedBy.map((item) => item?.toString?.() ?? item)
    : [];
  const savedBy = Array.isArray(data.savedBy)
    ? data.savedBy.map((item) => item?.toString?.() ?? item)
    : [];
  const commentsRaw = Array.isArray(data.comments) ? data.comments : [];
  const includeComments = Boolean(options.includeComments);
  const normalizedComments = includeComments
    ? commentsRaw.map((comment) => {
        const commentAuthor = normalizeUserRef(comment.user);
        return {
          id: comment._id?.toString() ?? comment.id,
          text: comment.text || "",
          createdAt: comment.createdAt,
          author: commentAuthor,
          isCreator: commentAuthor?.id && owner?.id && commentAuthor.id === owner.id
        };
      })
    : undefined;

  const likesCount =
    typeof data.likes === "number" && data.likes >= 0 ? data.likes : likedBy.length;

  const result = {
    id: data._id?.toString() ?? data.id,
    image: relativeImage,
    caption: data.caption || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    filter:
      typeof data.filter === "string" && data.filter.trim()
        ? data.filter.trim().toLowerCase()
        : "original",
    adjustments: normalizeAdjustments(data.adjustments),
    likes: likesCount,
    liked: likedBy.includes(currentUserId),
    saved: savedBy.includes(currentUserId),
    commentsCount: commentsRaw.length,
    visibility: data.visibility || "public",
    createdAt: data.createdAt,
    owner,
    isOwn: owner.id === currentUserId
  };
  if(includeComments){
    result.comments = normalizedComments || [];
  }
  return result;
};

const pushNotification = async ({ targetUserId, type, actorId, actorName, actorNick, publicationId, message }) => {
  if(!targetUserId || !actorId || targetUserId === actorId) return;
  const baseMessage =
    message ||
    (type === "like"
      ? `${actorNick || actorName || "Alguien"} le dio like a tu publicación`
      : `${actorNick || actorName || "Alguien"} comentó tu publicación`);

  try{
    await User.findByIdAndUpdate(
      targetUserId,
      {
        $push: {
          notifications: {
            $each: [
              {
                type,
                actor: actorId,
                publication: publicationId,
                message: baseMessage,
                isRead: false,
                createdAt: new Date()
              }
            ],
            $position: 0,
            $slice: MAX_NOTIFICATIONS
          }
        }
      },
      { new: false }
    ).exec();
  }catch(error){
    // No romper el flujo si falla la notificación
    console.warn("No se pudo crear la notificación", error.message);
  }
};

const parseTags = (raw = "") =>
  raw
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);

const parseAdjustments = (raw) => {
  if (!raw) return { ...DEFAULT_ADJUSTMENTS };
  if (typeof raw === "object") return normalizeAdjustments(raw);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return normalizeAdjustments(parsed);
    }
  } catch (err) {
    // ignored, fallback to defaults
  }
  return { ...DEFAULT_ADJUSTMENTS };
};

const ensureRelativePath = (absolutePath) => {
  if (!absolutePath) return null;
  if (absolutePath.startsWith("/")) return absolutePath;
  const relative = path.relative(PUBLIC_ROOT, absolutePath);
  return `/${relative.split(path.sep).join("/")}`;
};

const pruebaPublication = (req, res) => {
  return res.status(200).send({
    message: "Mensaje de prueba desde el controlador de Publication"
  });
};

const createPublication = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Debes subir una imagen para crear la publicación"
      });
    }

    const caption = req.body.caption?.trim() || "";
    const tags = parseTags(req.body.tags || "");
    const filter = req.body.filter?.toString?.().trim().toLowerCase() || "original";
    const visibility = req.body.visibility === "friends" ? "friends" : "public";
    const adjustments = parseAdjustments(req.body.adjustments);

    const relativeImage = ensureRelativePath(req.file.path);

    const publication = await Publication.create({
      user: req.user.id,
      image: relativeImage,
      caption,
      tags,
      filter,
      adjustments,
      visibility
    });

    const populated = await publication.populate({
      path: "user",
      select: "nick name image"
    });

    return res.status(201).json({
      status: "success",
      message: "Publicación creada correctamente",
      publication: sanitizePublication(populated, req.user.id)
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "No se pudo crear la publicación",
      error: error.message
    });
  }
};

const listFeed = async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 40;
    const posts = await Publication.find({
      user: { $ne: req.user.id },
      visibility: "public"
    })
      .populate("user", "nick name image")
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();

    return res.status(200).json({
      status: "success",
      items: posts.map((pub) => sanitizePublication(pub, req.user.id))
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener el feed",
      error: error.message
    });
  }
};

const listByUser = async (req, res) => {
  try {
    const targetId = req.params.userId === "me" ? req.user.id : req.params.userId;
    const posts = await Publication.find({
      user: targetId
    })
      .populate("user", "nick name image")
      .sort({ createdAt: -1 })
      .exec();

    return res.status(200).json({
      status: "success",
      items: posts.map((pub) => sanitizePublication(pub, req.user.id))
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "No se pudieron obtener las publicaciones del usuario",
      error: error.message
    });
  }
};

const getPublication = async (req, res) => {
  try {
    const { id } = req.params;
    const publication = await Publication.findById(id)
      .populate("user", "nick name image")
      .populate("comments.user", "nick name image")
      .exec();

    if (!publication) {
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada"
      });
    }

    return res.status(200).json({
      status: "success",
      publication: sanitizePublication(publication, req.user.id, { includeComments: true })
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener la publicación",
      error: error.message
    });
  }
};

const likePublication = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try{
    const publication = await Publication.findById(id)
      .populate("user", "nick name image")
      .exec();

    if(!publication){
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada"
      });
    }

    if(!Array.isArray(publication.likedBy)){
      publication.likedBy = [];
    }

    const alreadyLiked = publication.likedBy.some(
      (liker) => liker?.toString?.() === userId
    );
    if(!alreadyLiked){
      publication.likedBy.push(userId);
      publication.likes = publication.likedBy.length;
      await publication.save();

      const ownerId = publication.user?._id?.toString?.() ?? publication.user?.toString?.();
      await pushNotification({
        targetUserId: ownerId,
        type: "like",
        actorId: userId,
        actorName: req.user.name,
        actorNick: req.user.nick,
        publicationId: publication._id
      });
    }

    const normalized = sanitizePublication(publication, userId);
    return res.status(200).json({
      status: "success",
      publication: normalized
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo registrar el like",
      error: error.message
    });
  }
};

const unlikePublication = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try{
    const publication = await Publication.findById(id)
      .populate("user", "nick name image")
      .exec();

    if(!publication){
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada"
      });
    }

    if(!Array.isArray(publication.likedBy)){
      publication.likedBy = [];
    }

    const prevLength = publication.likedBy.length;
    publication.likedBy = publication.likedBy.filter(
      (liker) => liker?.toString?.() !== userId
    );
    if(publication.likedBy.length !== prevLength){
      publication.likes = Math.max(0, publication.likedBy.length);
      await publication.save();
    }

    const normalized = sanitizePublication(publication, userId);
    return res.status(200).json({
      status: "success",
      publication: normalized
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo quitar el like",
      error: error.message
    });
  }
};

const addComment = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const rawText = req.body?.text ?? req.body?.comment ?? "";
  const text = typeof rawText === "string" ? rawText.trim() : "";

  if(!text){
    return res.status(400).json({
      status: "error",
      message: "Debes escribir un comentario"
    });
  }
  if(text.length > 500){
    return res.status(400).json({
      status: "error",
      message: "El comentario no puede superar los 500 caracteres"
    });
  }

  try{
    const publication = await Publication.findById(id)
      .populate("user", "nick name image")
      .populate("comments.user", "nick name image")
      .exec();

    if(!publication){
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada"
      });
    }

    if(!Array.isArray(publication.comments)){
      publication.comments = [];
    }

    publication.comments.push({
      user: userId,
      text,
      createdAt: new Date()
    });

    await publication.save();
    await publication.populate("comments.user", "nick name image");

    const normalized = sanitizePublication(publication, userId, { includeComments: true });

    const ownerId = publication.user?._id?.toString?.() ?? publication.user?.toString?.();
    const preview = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    await pushNotification({
      targetUserId: ownerId,
      type: "comment",
      actorId: userId,
      actorName: req.user.name,
      actorNick: req.user.nick,
      publicationId: publication._id,
      message: `${req.user.nick || req.user.name || "Alguien"} comentó: ${preview}`
    });

    return res.status(201).json({
      status: "success",
      publication: normalized
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo agregar el comentario",
      error: error.message
    });
  }
};

const listSavedPublications = async (req, res) => {
  try{
    const posts = await Publication.find({
      savedBy: req.user.id
    })
      .populate("user", "nick name image")
      .sort({ createdAt: -1 })
      .exec();

    return res.status(200).json({
      status: "success",
      items: posts.map((pub) => sanitizePublication(pub, req.user.id))
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener la lista de guardados",
      error: error.message
    });
  }
};

const savePublication = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try{
    const publication = await Publication.findById(id)
      .populate("user", "nick name image")
      .exec();

    if(!publication){
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada"
      });
    }

    if(!Array.isArray(publication.savedBy)){
      publication.savedBy = [];
    }

    const alreadySaved = publication.savedBy.some(
      (saved) => saved?.toString?.() === userId
    );
    if(!alreadySaved){
      publication.savedBy.push(userId);
      await publication.save();
    }

    const normalized = sanitizePublication(publication, userId);
    return res.status(200).json({
      status: "success",
      publication: normalized
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo guardar la publicación",
      error: error.message
    });
  }
};

const unsavePublication = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try{
    const publication = await Publication.findById(id)
      .populate("user", "nick name image")
      .exec();

    if(!publication){
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada"
      });
    }

    if(!Array.isArray(publication.savedBy)){
      publication.savedBy = [];
    }

    const prevLength = publication.savedBy.length;
    publication.savedBy = publication.savedBy.filter(
      (saved) => saved?.toString?.() !== userId
    );
    if(publication.savedBy.length !== prevLength){
      await publication.save();
    }

    const normalized = sanitizePublication(publication, userId);
    return res.status(200).json({
      status: "success",
      publication: normalized
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo quitar de guardados",
      error: error.message
    });
  }
};

const deletePublication = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const publication = await Publication.findById(id).exec();
    if (!publication) {
      return res.status(404).json({ status: "error", message: "Publicación no encontrada" });
    }

    const ownerId = publication.user?._id?.toString?.() ?? publication.user?.toString?.();
    if (ownerId !== userId) {
      return res.status(403).json({ status: "error", message: "No tienes permiso para eliminar esta publicación" });
    }

    // Eliminar archivo asociado si existe
    try {
      const fs = require("fs");
      const path = require("path");
      const PUBLIC_ROOT = path.join(__dirname, "..", "public");
      const imagePath = publication.image ? publication.image.replace(/^\//, "") : null;
      if (imagePath) {
        const absolute = path.join(PUBLIC_ROOT, imagePath);
        if (fs.existsSync(absolute)) {
          fs.unlinkSync(absolute);
        }
      }
    } catch (err) {
      // No bloquear la eliminación en BD si falla borrar el archivo
      console.warn("No se pudo eliminar el archivo de la publicación:", err.message);
    }

    await Publication.deleteOne({ _id: id }).exec();

    return res.status(200).json({ status: "success", message: "Publicación eliminada" });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "No se pudo eliminar la publicación", error: error.message });
  }
};

module.exports = {
  pruebaPublication,
  createPublication,
  listFeed,
  listByUser,
  getPublication,
  likePublication,
  unlikePublication,
  addComment,
  listSavedPublications,
  savePublication,
  unsavePublication
  ,
  deletePublication
};
