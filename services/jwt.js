//importar dependencias
const jwt = require("jwt-simple");
const moment = require("moment");

//Clave secreta
const claveSecreta = "CLAVE_SECRETA_del_proyecto_DE_LA_RED_soCIAL_987987";


//Crear una función para generar token
const createToken = (user) =>{
    const payload = {
        id: user._id,
        name: user.name,
        surname: user.surname,
        nick: user.nick,
        email: user.email,
        role: user.role,
        image: user.image,
        iat: moment().unix(),
        exp: moment().add(30,"days").unix()
    };
    //Devolver un JWT token codificado
    return jwt.encode(payload, claveSecreta);
}


module.exports = {
    claveSecreta,
    createToken
}