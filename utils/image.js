const { getSignedFileUrl } = require("./s3");

const normalizeLegacyImagePath = (value) => {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const resolveImageUrl = async ({ key, legacy, excludeLegacy = [] }) => {
  const normalizedLegacy = normalizeLegacyImagePath(legacy);
  if (key) {
    try {
      const signedUrl = await getSignedFileUrl(key);
      if (signedUrl) {
        return signedUrl;
      }
    } catch (error) {
      console.warn("No se pudo generar URL firmada para S3:", error?.message || error);
    }
  }
  if (!normalizedLegacy) return null;
  const excludes = Array.isArray(excludeLegacy) ? excludeLegacy : [excludeLegacy];
  if (excludes.some((candidate) => candidate && normalizedLegacy.endsWith(candidate))) {
    return null;
  }
  return normalizedLegacy;
};

const stripImageSecrets = (target) => {
  if (!target) return target;
  if (Array.isArray(target)) {
    target.forEach(stripImageSecrets);
    return target;
  }
  if (typeof target === "object") {
    if ("imageKey" in target) {
      delete target.imageKey;
    }
    if ("legacyImage" in target) {
      delete target.legacyImage;
    }
    Object.values(target).forEach(stripImageSecrets);
  }
  return target;
};

module.exports = {
  normalizeLegacyImagePath,
  resolveImageUrl,
  stripImageSecrets
};
