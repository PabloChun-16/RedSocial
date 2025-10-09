//Importar modulos
const jwt = require("jwt-simple");
const moment = require("moment");

//Importar clave secreta
const libjwt = require("../services/jwt");
const claveSecreta = libjwt.claveSecreta;

//Middleware de autenticación
exports.auth = (req, res, next) => {
    //Comprobatar si me llega la cabecera de auth
    if (!req.headers.authorization) {
        return res.status(403).send({
            status: "error",
            message: "La petición no tiene la cabecera de autenticación"
        });
    }

    //Decodificar el token
    let token = req.headers.authorization.replace(/['"]+/g, '');
    try {
        let payload = jwt.decode(token, claveSecreta);

        //Comprobar expiracion del token
        if (payload.exp <= moment().unix()) {
            return res.status(401).send({
                status: "error",
                message: "token expirado"
            });
        }
        //Agregar datos de usuario a la request
        req.user = payload;
    } catch (error) {
        return res.status(404).send({
            status: "error",
            message: "token invalido",
            error: error.message
        });
    }


    //Pasar a ejecución de acción
    next();
}
