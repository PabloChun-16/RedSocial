const path = require("path");
const Publication = require("../models/publication");

const PUBLIC_ROOT = path.join(__dirname, "..", "public");

const DEFAULT_ADJUSTMENTS = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  fade: 0
};

const sanitizePublication = (doc, currentUserId) => {
  if (!doc) return null;
  const data = typeof doc.toObject === "function" ? doc.toObject({ virtuals: false }) : doc;
  const owner = data.user && typeof data.user === "object"
    ? {
        id: data.user._id?.toString() ?? data.user.id,
        nick: data.user.nick,
        name: data.user.name,
        image: data.user.image
      }
    : { id: data.user?.toString?.() ?? data.user };

  const relativeImage =
    typeof data.image === "string"
      ? data.image.startsWith("/")
        ? data.image
        : `/${data.image}`
      : null;

  return {
    id: data._id?.toString() ?? data.id,
    image: relativeImage,
    caption: data.caption || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    filter: data.filter || "original",
    adjustments: { ...DEFAULT_ADJUSTMENTS, ...(data.adjustments || {}) },
    likes: data.likes || 0,
    visibility: data.visibility || "public",
    createdAt: data.createdAt,
    owner,
    isOwn: owner.id === currentUserId
  };
};

const parseTags = (raw = "") =>
  raw
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);

const parseAdjustments = (raw) => {
  if (!raw) return { ...DEFAULT_ADJUSTMENTS };
  if (typeof raw === "object") return { ...DEFAULT_ADJUSTMENTS, ...raw };
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return { ...DEFAULT_ADJUSTMENTS, ...parsed };
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
    const filter = req.body.filter?.trim() || "original";
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
      .exec();

    if (!publication) {
      return res.status(404).json({
        status: "error",
        message: "Publicación no encontrada"
      });
    }

    return res.status(200).json({
      status: "success",
      publication: sanitizePublication(publication, req.user.id)
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener la publicación",
      error: error.message
    });
  }
};

module.exports = {
  pruebaPublication,
  createPublication,
  listFeed,
  listByUser,
  getPublication
};
