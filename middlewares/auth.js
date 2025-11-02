//Importar modulos
const jwt = require("jwt-simple");
const moment = require("moment");

//Importar clave secreta
const { jwtSecret, sessionCookieName } = require("../services/jwt");

const parseCookies = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((acc, pair) => {
    const [key, ...rest] = pair.split("=");
    if (!key) return acc;
    acc[key.trim()] = decodeURIComponent(rest.join("=").trim());
    return acc;
  }, {});
};

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.trim()) {
    return authHeader.replace(/['"]+/g, "").trim();
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  return cookies[sessionCookieName] || null;
};

//Middleware de autenticación
exports.auth = (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(403).json({
      status: "error",
      message: "La petición no incluye credenciales válidas"
    });
  }

  try {
    const payload = jwt.decode(token, jwtSecret);

    //Comprobar expiracion del token
    if (payload.exp <= moment().unix()) {
      return res.status(401).json({
        status: "error",
        message: "token expirado"
      });
    }
    //Agregar datos de usuario a la request
    req.user = payload;
  } catch (error) {
    return res.status(401).json({
      status: "error",
      message: "token invalido",
      error: error.message
    });
  }

  //Pasar a ejecución de acción
  next();
};
