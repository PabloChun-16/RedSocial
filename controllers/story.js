const Story = require("../models/story");
const { uploadBufferToS3, deleteFileFromS3 } = require("../utils/s3");
const { resolveImageUrl, stripImageSecrets } = require("../utils/image");

const DEFAULT_AVATAR = "iconobase.png";

const DEFAULT_ADJUSTMENTS = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
  fade: 0
};

const clamp01 = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const normalizeAdjustments = (raw = {}) => {
  const normalized = { ...DEFAULT_ADJUSTMENTS };
  if (!raw || typeof raw !== "object") return normalized;
  Object.keys(normalized).forEach((key) => {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[key] = value;
    } else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number.parseFloat(value);
      if (!Number.isNaN(parsed)) {
        normalized[key] = parsed;
      }
    }
  });
  return normalized;
};

const parseAdjustments = (raw) => {
  if (!raw) return { ...DEFAULT_ADJUSTMENTS };
  if (typeof raw === "object") return normalizeAdjustments(raw);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      return normalizeAdjustments(parsed);
    }
  } catch (error) {
    // fallback to defaults
  }
  return { ...DEFAULT_ADJUSTMENTS };
};

const parseTextBlocks = (raw) => {
  if (!raw) return [];
  let source = raw;
  if (typeof raw === "string") {
    try {
      source = JSON.parse(raw);
    } catch (error) {
      return [];
    }
  }
  if (!Array.isArray(source)) return [];
  return source
    .map((block) => {
      if (!block || typeof block !== "object") return null;
      const text = typeof block.text === "string" ? block.text : "";
      if (!text.trim()) return null;
      const color =
        typeof block.color === "string" && block.color.trim()
          ? block.color.trim()
          : "#ffffff";
      const fontSizeRaw =
        typeof block.fontSize === "number"
          ? block.fontSize
          : Number.parseFloat(block.fontSize);
      const fontSize =
        Number.isFinite(fontSizeRaw) && fontSizeRaw > 0 ? fontSizeRaw : 24;
      const fontFamily =
        typeof block.fontFamily === "string" && block.fontFamily.trim()
          ? block.fontFamily.trim()
          : "inherit";
      const xRaw =
        typeof block.x === "number" ? block.x : Number.parseFloat(block.x);
      const yRaw =
        typeof block.y === "number" ? block.y : Number.parseFloat(block.y);
      const rotationRaw =
        typeof block.rotation === "number"
          ? block.rotation
          : Number.parseFloat(block.rotation);
      const align =
        block.align === "left" || block.align === "right"
          ? block.align
          : "center";
      const normalized = {
        text: text.trim(),
        color,
        fontSize,
        fontFamily,
        x: clamp01(xRaw),
        y: clamp01(yRaw),
        rotation: Number.isFinite(rotationRaw) ? rotationRaw : 0,
        align
      };
      if (typeof block.id === "string" && block.id.trim()) {
        normalized.id = block.id.trim();
      }
      return normalized;
    })
    .filter(Boolean);
};

const normalizeUserRef = (value) => {
  if (!value) return null;
  const source =
    typeof value.toObject === "function"
      ? value.toObject({ virtuals: false })
      : value;
  if (typeof source === "string") {
    return { id: source };
  }
  if (typeof source === "object" && source !== null) {
    const id = source._id?.toString?.() ?? source.id ?? value?.toString?.();
    const legacyImage =
      typeof source.image === "string" && source.image.trim() ? source.image.trim() : null;
    const normalizedLegacy = legacyImage
      ? legacyImage.startsWith("/")
        ? legacyImage
        : `/${legacyImage}`
      : null;
    return {
      id,
      nick: source.nick,
      name: source.name,
      imageKey:
        typeof source.imageKey === "string" && source.imageKey.trim()
          ? source.imageKey.trim()
          : null,
      legacyImage: normalizedLegacy
    };
  }
  return null;
};

const sanitizeStory = (doc, currentUserId, options = {}) => {
  if (!doc) return null;
  const data =
    typeof doc.toObject === "function"
      ? doc.toObject({ virtuals: false })
      : doc;
  const owner = normalizeUserRef(data.user);
  const legacyImage =
    typeof data.image === "string" && data.image.trim() ? data.image.trim() : null;
  const normalizedLegacy = legacyImage
    ? legacyImage.startsWith("/")
      ? legacyImage
      : `/${legacyImage}`
    : null;
  const imageKey =
    typeof data.imageKey === "string" && data.imageKey.trim()
      ? data.imageKey.trim()
      : null;
  const hasImageOption =
    typeof options.imageUrl === "string" && options.imageUrl.trim() ? true : false;
  const imageUrl = hasImageOption
    ? options.imageUrl
    : !imageKey && normalizedLegacy
    ? normalizedLegacy
    : null;
  const adjustments = normalizeAdjustments(data.adjustments);
  const textBlocks = Array.isArray(data.textBlocks) ? data.textBlocks : [];
  return {
    id: data._id?.toString() ?? data.id,
    image: imageUrl,
    imageUrl,
    imageKey,
    filter:
      typeof data.filter === "string" && data.filter.trim()
        ? data.filter.trim().toLowerCase()
        : "original",
    adjustments,
    textBlocks,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    expiresAt: data.expiresAt,
    owner,
    isOwn: Boolean(owner?.id) && owner.id === currentUserId
  };
};

const pickLegacyImage = (source) => {
  if (!source || typeof source !== "object") return null;
  if (typeof source.image === "string" && source.image.trim()) {
    return source.image.trim();
  }
  if (typeof source.legacyImage === "string" && source.legacyImage.trim()) {
    return source.legacyImage.trim();
  }
  return null;
};

const decorateUserReference = async (reference) => {
  if (!reference) return null;
  const imageUrl = await resolveImageUrl({
    key: reference.imageKey,
    legacy: pickLegacyImage(reference),
    excludeLegacy: [DEFAULT_AVATAR]
  });
  const decorated = {
    ...reference,
    imageUrl,
    image: imageUrl || DEFAULT_AVATAR
  };
  stripImageSecrets(decorated);
  return decorated;
};

const formatStoryResponse = async (story, currentUserId) => {
  if (!story) return null;
  const data = sanitizeStory(story, currentUserId);
  if (!data) return null;
  const imageUrl = await resolveImageUrl({
    key: data.imageKey,
    legacy: pickLegacyImage(story)
  });
  data.imageUrl = imageUrl;
  data.image = imageUrl;
  if (data.owner) {
    data.owner = await decorateUserReference(data.owner);
  }
  stripImageSecrets(data);
  return data;
};

const formatStoryCollection = async (stories, currentUserId) => {
  const list = Array.isArray(stories) ? stories : [];
  const formatted = await Promise.all(list.map((story) => formatStoryResponse(story, currentUserId)));
  return formatted.filter(Boolean);
};

const cleanupExpiredStories = async () => {
  const now = new Date();
  const expired = await Story.find(
    {
      expiresAt: { $lte: now }
    },
    { imageKey: 1 }
  ).exec();
  if (!expired.length) return;
  const ids = expired.map((story) => story._id);
  await Story.deleteMany({ _id: { $in: ids } }).exec();
  await Promise.all(
    expired.map(async (story) => {
      if(story?.imageKey){
        await deleteFileFromS3(story.imageKey);
      }
    })
  );
};

const createStory = async (req, res) => {
  let imageKey = null;
  try {
    await cleanupExpiredStories();
    if (!req.file) {
      return res.status(400).json({
        status: "error",
        message: "Debes subir una imagen para tu historia"
      });
    }

    const filter = req.body.filter?.toString?.().trim().toLowerCase() || "original";
    const adjustments = parseAdjustments(req.body.adjustments);
    const textBlocks = parseTextBlocks(req.body.textBlocks);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    imageKey = await uploadBufferToS3({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      folder: "uploads/stories"
    });

    const story = await Story.create({
      user: req.user.id,
      imageKey,
      filter,
      adjustments,
      textBlocks,
      expiresAt
    });

    const populated = await story.populate({
      path: "user",
      select: "nick name imageKey"
    });
    const formatted = await formatStoryResponse(populated, req.user.id);

    return res.status(201).json({
      status: "success",
      message: "Historia publicada correctamente",
      story: formatted
    });
  } catch (error) {
    console.error("createStory error", error);
    if (imageKey) {
      await deleteFileFromS3(imageKey);
    }
    return res.status(500).json({
      status: "error",
      message: "No se pudo crear la historia",
      error: error.message
    });
  }
};

const listStories = async (req, res) => {
  try {
    await cleanupExpiredStories();
    const now = new Date();
    const stories = await Story.find({
      visibility: "public",
      expiresAt: { $gt: now }
    })
      .populate("user", "nick name imageKey")
      .sort({ createdAt: 1 })
      .exec();

    const normalizedStories = await formatStoryCollection(stories, req.user?.id);

    const grouped = [];
    const groupMap = new Map();
    normalizedStories.forEach((story) => {
      const ownerId = story.owner?.id || "unknown";
      if (!groupMap.has(ownerId)) {
        const group = {
          owner: story.owner,
          stories: []
        };
        groupMap.set(ownerId, group);
        grouped.push(group);
      }
      groupMap.get(ownerId).stories.push(story);
    });

    return res.status(200).json({
      status: "success",
      items: grouped,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("listStories error", error);
    return res.status(500).json({
      status: "error",
      message: "No se pudieron obtener las historias",
      error: error.message
    });
  }
};

const listSelfStories = async (req, res) => {
  try {
    await cleanupExpiredStories();
    const now = new Date();
    const stories = await Story.find({
      user: req.user.id,
      expiresAt: { $gt: now }
    })
      .populate("user", "nick name imageKey")
      .sort({ createdAt: 1 })
      .exec();
    const items = await formatStoryCollection(stories, req.user.id);
    return res.status(200).json({
      status: "success",
      items
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "No se pudieron obtener tus historias",
      error: error.message
    });
  }
};

const deleteStory = async (req, res) => {
  const { id } = req.params;
  try {
    const story = await Story.findById(id).exec();
    if (!story) {
      return res.status(404).json({
        status: "error",
        message: "Historia no encontrada"
      });
    }
    if (story.user?.toString?.() !== req.user.id) {
      return res.status(403).json({
        status: "error",
        message: "No tienes permisos para eliminar esta historia"
      });
    }
    const imageKey = story.imageKey;
    await Story.deleteOne({ _id: id }).exec();
    if(imageKey){
      await deleteFileFromS3(imageKey);
    }
    return res.status(200).json({
      status: "success",
      message: "Historia eliminada correctamente"
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "No se pudo eliminar la historia",
      error: error.message
    });
  }
};

module.exports = {
  createStory,
  listStories,
  listSelfStories,
  deleteStory
};
