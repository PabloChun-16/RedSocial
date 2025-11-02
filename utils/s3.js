const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuid } = require("uuid");

const bucket = process.env.S3_BUCKET;
const region = process.env.AWS_REGION;

const buildClient = () => {
  const credentials =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      : undefined;

  return new S3Client({
    region,
    credentials
  });
};

const s3 = buildClient();

const ensureBucket = () => {
  if (!bucket) {
    throw new Error("Missing S3_BUCKET environment variable");
  }
};

const resolveExtension = (mimeType) => {
  if (!mimeType || typeof mimeType !== "string") return "bin";
  const parts = mimeType.split("/");
  return parts.length > 1 && parts[1] ? parts[1] : "bin";
};

const ensureFolder = (folder) => {
  if (!folder || typeof folder !== "string") {
    throw new Error("Missing target folder for S3 upload");
  }
  return folder.replace(/^\/*/, "").replace(/\/*$/, "");
};

const buildKey = ({ folder, mimeType }) => {
  const safeFolder = ensureFolder(folder);
  const extension = resolveExtension(mimeType);
  return `${safeFolder}/${uuid()}.${extension}`;
};

const uploadBufferToS3 = async ({ buffer, mimeType, folder }) => {
  if (!buffer) {
    throw new Error("Missing buffer to upload to S3");
  }
  ensureBucket();
  const key = buildKey({ folder, mimeType });
  const putCmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: mimeType
  });
  await s3.send(putCmd);
  return key;
};

const getSignedFileUrl = async (key, { expiresIn = 60 } = {}) => {
  if (!key) return null;
  ensureBucket();
  const getCmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });
  return getSignedUrl(s3, getCmd, { expiresIn });
};

const deleteFileFromS3 = async (key) => {
  if (!key) return;
  ensureBucket();
  const deleteCmd = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key
  });
  try {
    await s3.send(deleteCmd);
  } catch (error) {
    // No bloquear el flujo si falla la eliminación
    console.warn("No se pudo eliminar objeto en S3:", error?.message || error);
  }
};

module.exports = {
  uploadBufferToS3,
  getSignedFileUrl,
  deleteFileFromS3
};
