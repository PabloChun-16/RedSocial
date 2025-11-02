//importar dependencias
const jwt = require("jwt-simple");
const moment = require("moment");

const DEFAULT_SECRET = "CLAVE_SECRETA_del_proyecto_DE_LA_RED_soCIAL_987987";

const jwtSecret = process.env.JWT_SECRET || DEFAULT_SECRET;
const jwtExpirationDays = Number.parseInt(process.env.JWT_EXPIRATION_DAYS || "30", 10);
const sessionCookieName = process.env.SESSION_COOKIE_NAME || "app_session";

//Crear una función para generar token
const createToken = (user) =>{
  const payload = {
    id: user._id,
    name: user.name,
    surname: user.surname,
    nick: user.nick,
    email: user.email,
    role: user.role,
    provider: user.provider || (user.googleId ? "google" : "local"),
    picture: user.picture ?? null,
    iat: moment().unix(),
    exp: moment().add(jwtExpirationDays, "days").unix()
  };
  //Devolver un JWT token codificado
  return jwt.encode(payload, jwtSecret);
};

module.exports = {
  jwtSecret,
  jwtExpirationDays,
  sessionCookieName,
  createToken
};
