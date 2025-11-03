const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");
const {
  RekognitionClient,
  DetectLabelsCommand
} = require("@aws-sdk/client-rekognition");

const debugAws = async (req, res) => {
  try {
    const regionEnv = process.env.AWS_REGION;
    const bucketEnv = process.env.S3_BUCKET;

    const creds = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };

    const s3 = new S3Client({
      region: regionEnv,
      credentials: creds
    });

    const rekog = new RekognitionClient({
      region: "us-east-1",
      credentials: creds
    });

    let s3Result;
    try {
      const listCmd = new ListBucketsCommand({});
      const out = await s3.send(listCmd);
      s3Result = {
        ok: true,
        bucketCount: Array.isArray(out?.Buckets) ? out.Buckets.length : 0
      };
    } catch (err) {
      s3Result = { ok: false, error: String(err) };
    }

    let rekogResult;
    try {
      const testCmd = new DetectLabelsCommand({
        Image: { Bytes: new Uint8Array([0x00]) },
        MaxLabels: 1,
        MinConfidence: 0
      });
      await rekog.send(testCmd);
      rekogResult = { ok: true };
    } catch (err) {
      rekogResult = { ok: false, error: String(err) };
    }

    return res.json({
      regionEnv,
      bucketEnv,
      usingCreds: {
        accessKeyId_preview: process.env.AWS_ACCESS_KEY_ID
          ? `${process.env.AWS_ACCESS_KEY_ID.slice(0, 6)}...`
          : null
      },
      s3Result,
      rekogResult
    });
  } catch (err) {
    return res.status(500).json({ fatal: String(err) });
  }
};

module.exports = {
  debugAws
};
