const User = require("../models/user");
const { resolveImageUrl } = require("../utils/image");

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const DEFAULT_USER_LIMIT = 8;

const normalizeSuggestionUser = async (doc) => {
  if (!doc) return null;
  const imageUrl = await resolveImageUrl({
    key: doc.imageKey,
    legacy: doc.picture || doc.image
  }).catch(() => null);
  return {
    id: doc._id?.toString?.() || doc.id,
    name: doc.name || "",
    nick: doc.nick || "",
    bio: doc.bio || "",
    image: imageUrl || "/media/iconobase.png"
  };
};

const searchUsers = async (req, res) => {
  try {
    const raw = typeof req.query.q === "string" ? req.query.q : "";
    const query = raw.trim();
    if (!query) {
      return res.status(200).json({ ok: true, users: [] });
    }

    const tokens = query
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean)
      .map(escapeRegExp);

    if (!tokens.length) {
      return res.status(200).json({ ok: true, users: [] });
    }

    const regex = new RegExp(tokens.join("|"), "i");
    const limitRaw = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 20) : DEFAULT_USER_LIMIT;

    const users = await User.find({
      $or: [{ nick: regex }, { name: regex }, { bio: regex }]
    })
      .select({ name: 1, nick: 1, bio: 1, imageKey: 1, picture: 1 })
      .sort({ nick: 1 })
      .limit(limit)
      .exec();

    const suggestions = (await Promise.all(users.map(normalizeSuggestionUser))).filter(Boolean);

    return res.status(200).json({ ok: true, users: suggestions });
  } catch (error) {
    console.error("searchUsers", error);
    return res.status(500).json({ ok: false, error: "No se pudieron obtener sugerencias" });
  }
};

module.exports = {
  searchUsers
};
