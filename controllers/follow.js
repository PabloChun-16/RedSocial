const pruebaFollow = (req, res) => {
    return res.status(200).send({
        message: "Mensaje de prueba desde el controlador de follow"
    });
}

module.exports = {
    pruebaFollow
};  

