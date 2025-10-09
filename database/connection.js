const mongoose = require('mongoose');

const connection = async () => {
    try{

        await mongoose.connect("mongodb://localhost:27017/mi_red_social",);
        console.log("Database connected successfully");
    }catch(error){
        console.log(error);
        throw new Error("Error connecting to database");
    }
};

module.exports = connection;

