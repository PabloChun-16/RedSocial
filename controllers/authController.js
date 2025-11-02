const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user");
const { createToken, sessionCookieName, jwtExpirationDays } = require("../services/jwt");
const { formatUserResponse } = require("./user");
const { getUnreadMessagesCount } = require("../services/messages");

const GOOGLE_TOKEN_AUDIENCE = process.env.GOOGLE_CLIENT_ID;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const GOOGLE_CLIENT = GOOGLE_TOKEN_AUDIENCE ? new OAuth2Client(GOOGLE_TOKEN_AUDIENCE) : null;

const isProduction = process.env.NODE_ENV === "production";
const parsedMaxAge = Number(process.env.SESSION_MAX_AGE_MS);
const defaultMaxAge = Math.max(jwtExpirationDays, 1) * 24 * 60 * 60 * 1000;
const sessionMaxAgeMs =
  Number.isFinite(parsedMaxAge) && parsedMaxAge > 0 ? parsedMaxAge : defaultMaxAge;

const normalizeEmail = (email = "") =>
  typeof email === "string" ? email.trim().toLowerCase() : "";
const normalizeNick = (nick = "") =>
  typeof nick === "string" ? nick.trim().toLowerCase() : "";

const stripDiacritics = (value = "") =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const toSlug = (value = "") =>
  stripDiacritics(value)
    .replace(/[^a-zA-Z0-9]+/g, "")
    .replace(/_/g, "")
    .toLowerCase();

const guessNickSeeds = (payload = {}) => {
  const seeds = [];
  if (payload.nick) seeds.push(payload.nick);
  if (payload.email) seeds.push(payload.email.split("@")[0]);
  if (payload.name) seeds.push(payload.name);
  if (payload.given_name) seeds.push(payload.given_name);
  if (payload.family_name) seeds.push(payload.family_name);
  return seeds.filter(Boolean);
};

const generateUniqueNick = async (payload = {}) => {
  const seeds = guessNickSeeds(payload);
  let base = seeds
    .map(toSlug)
    .find((slug) => slug && slug.length >= 3);
  if (!base) {
    base = `usuario${Math.floor(Math.random() * 1000)}`;
  }
  let candidate = base;
  let suffix = 0;
  // Limitar el número de intentos razonable
  while (await User.exists({ nick: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
    if (suffix > 5000) {
      candidate = `${base}${Date.now()}`;
      break;
    }
  }
  return candidate;
};

const setSessionCookie = (res, token) => {
  res.cookie(sessionCookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: sessionMaxAgeMs,
    path: "/"
  });
};

const buildAuthSuccess = async (user, res, { message, statusCode = 200 } = {}) => {
  const token = createToken(user);
  setSessionCookie(res, token);

  let messagesUnread = 0;
  try {
    messagesUnread = await getUnreadMessagesCount(user._id);
  } catch (error) {
    console.warn("No se pudo obtener count de mensajes no leídos:", error?.message);
  }

  const userResponse = await formatUserResponse(user, {
    messagesUnread,
    picture: user.picture
  });

  return res.status(statusCode).json({
    ok: true,
    status: "success",
    message,
    user: userResponse,
    token
  });
};

const validateRecaptcha = async (token, remoteIp) => {
  if (!token) {
    return { success: false, message: "Token reCAPTCHA ausente" };
  }
  if (!RECAPTCHA_SECRET) {
    throw new Error("RECAPTCHA_SECRET_KEY no está configurada");
  }
  if (typeof fetch !== "function") {
    throw new Error("La API fetch no está disponible en este entorno");
  }
  const params = new URLSearchParams();
  params.append("secret", RECAPTCHA_SECRET);
  params.append("response", token);
  if (remoteIp) params.append("remoteip", remoteIp);

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const data = await response.json();
  return {
    success: data.success === true,
    data
  };
};

const ensureGoogleClient = () => {
  if (!GOOGLE_CLIENT) {
    throw new Error("GOOGLE_CLIENT_ID no está configurado");
  }
  return GOOGLE_CLIENT;
};

const getAuthConfig = (req, res) => {
  return res.status(200).json({
    ok: true,
    googleClientId: GOOGLE_TOKEN_AUDIENCE || "",
    recaptchaSiteKey: process.env.RECAPTCHA_SITE_KEY || ""
  });
};

const register = async (req, res) => {
  try {
    const { name, nick, email, password, recaptchaToken } = req.body || {};

    if (!name || !nick || !email || !password) {
      return res.status(400).json({
        ok: false,
        status: "error",
        message: "Faltan datos por enviar"
      });
    }

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({
        ok: false,
        status: "error",
        message: "La contraseña debe tener al menos 6 caracteres"
      });
    }

    const verification = await validateRecaptcha(recaptchaToken, req.ip);
    if (!verification.success) {
      return res.status(400).json({
        ok: false,
        status: "error",
        message: "No pudimos verificar que eres humano. Reintenta el captcha."
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedNick = normalizeNick(nick);

    const duplicate = await User.findOne({
      $or: [{ email: normalizedEmail }, { nick: normalizedNick }]
    })
      .select("_id email nick")
      .lean()
      .exec();

    if (duplicate) {
      return res.status(409).json({
        ok: false,
        status: "error",
        message: "El usuario ya existe"
      });
    }

    const hashedPwd = await bcrypt.hash(password, 10);

    const user = new User({
      name: name.trim(),
      nick: normalizedNick,
      email: normalizedEmail,
      password: hashedPwd,
      provider: "local"
    });

    const saved = await user.save();
    return buildAuthSuccess(saved, res, {
      message: "Usuario registrado correctamente",
      statusCode: 201
    });
  } catch (error) {
    console.error("Error en registro de usuario:", error);
    const status = error.message?.includes("RECAPTCHA_SECRET_KEY")
      ? 500
      : 500;
    return res.status(status).json({
      ok: false,
      status: "error",
      message: status === 500 ? "Error en el registro" : error.message,
      error: error.message
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        status: "error",
        message: "Faltan datos por enviar"
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail })
      .select({
        name: 1,
        surname: 1,
        nick: 1,
        email: 1,
        role: 1,
        imageKey: 1,
        bio: 1,
        notifications: 1,
        password: 1,
        provider: 1,
        picture: 1,
        googleId: 1
      })
      .exec();

    if (!user) {
      return res.status(404).json({
        ok: false,
        status: "error",
        message: "No existe el usuario"
      });
    }

    if (!user.password) {
      return res.status(400).json({
        ok: false,
        status: "error",
        message: "Tu cuenta está vinculada con Google. Usa 'Continuar con Google'."
      });
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      return res.status(400).json({
        ok: false,
        status: "error",
        message: "Contraseña incorrecta"
      });
    }

    user.password = undefined;
    return buildAuthSuccess(user, res, { message: "Login exitoso" });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      message: "Error en el proceso de login",
      error: error.message
    });
  }
};

const google = async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({
        ok: false,
        status: "error",
        message: "Falta el token de Google"
      });
    }

    const client = ensureGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_TOKEN_AUDIENCE
    });
    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({
        ok: false,
        status: "error",
        message: "No pudimos validar tu cuenta de Google. Intenta de nuevo."
      });
    }
    if (payload.email_verified !== true) {
      return res.status(401).json({
        ok: false,
        status: "error",
        message: "No pudimos validar tu cuenta de Google. Intenta de nuevo."
      });
    }

    const sub = payload.sub;
    const email = normalizeEmail(payload.email);
    const name =
      payload.name || payload.given_name || payload.family_name || "Usuario Google";
    const picture =
      typeof payload.picture === "string" && payload.picture.trim()
        ? payload.picture.trim()
        : null;

    let user = await User.findOne({ googleId: sub }).exec();

    if (!user && email) {
      user = await User.findOne({ email }).exec();
      if (user) {
        user.googleId = sub;
        user.provider = user.provider && user.provider !== "local" ? user.provider : "both";
        if (picture) user.picture = picture;
        if (!user.name) user.name = name;
      }
    }

    if (!user) {
      const nick = await generateUniqueNick({ email, name, nick: payload.nickname });
      user = new User({
        name,
        email,
        nick,
        googleId: sub,
        provider: "google",
        picture
      });
    }

    if (user.provider === "local" && user.password) {
      user.provider = "both";
    }
    if (!user.picture && picture) {
      user.picture = picture;
    }

    const savedUser = await user.save();
    return buildAuthSuccess(savedUser, res, { message: "Login con Google exitoso" });
  } catch (error) {
    console.error("Error en autenticación Google:", error);
    return res.status(401).json({
      ok: false,
      status: "error",
      message: "No pudimos validar tu cuenta de Google. Intenta de nuevo.",
      error: error.message
    });
  }
};

module.exports = {
  getAuthConfig,
  register,
  login,
  google
};
