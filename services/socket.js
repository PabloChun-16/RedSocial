const { Server } = require("socket.io");
const jwt = require("jwt-simple");
const { jwtSecret } = require("./jwt");

let ioInstance = null;

const DEFAULT_ROOM_PREFIX = "user:";

const decodeToken = (token) => {
  if(!token || typeof token !== "string"){
    throw new Error("AUTH_REQUIRED");
  }
  return jwt.decode(token.replace(/['"]+/g, "").trim(), jwtSecret);
};

const extractTokenFromHandshake = (socket) => {
  const { auth = {}, query = {}, headers = {} } = socket.handshake || {};
  if(typeof auth.token === "string" && auth.token.trim()){
    return auth.token;
  }
  if(typeof query.token === "string" && query.token.trim()){
    return query.token;
  }
  if(typeof headers.authorization === "string" && headers.authorization.trim()){
    return headers.authorization;
  }
  return null;
};

const initSocket = (server, { allowedOrigins = [] } = {}) => {
  if(ioInstance){
    return ioInstance;
  }
  const corsOptions = Array.isArray(allowedOrigins) && allowedOrigins.length
    ? { origin: allowedOrigins, credentials: true }
    : { origin: "*", credentials: true };

  const io = new Server(server, {
    cors: corsOptions,
    serveClient: true
  });

  io.use((socket, next) => {
    try{
      const token = extractTokenFromHandshake(socket);
      const payload = decodeToken(token);
      if(!payload?.id){
        return next(new Error("AUTH_REQUIRED"));
      }
      socket.data.user = payload;
      next();
    }catch(error){
      next(new Error("AUTH_FAILED"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data?.user?.id;
    if(!userId){
      socket.disconnect(true);
      return;
    }
    const room = `${DEFAULT_ROOM_PREFIX}${userId}`;
    socket.join(room);
    socket.on("disconnect", () => {
      socket.leave(room);
    });
  });

  ioInstance = io;
  return ioInstance;
};

const getIO = () => {
  if(!ioInstance){
    throw new Error("Socket.IO no ha sido inicializado");
  }
  return ioInstance;
};

const emitToUser = (userId, event, payload) => {
  if(!ioInstance || !userId || !event) return;
  ioInstance.to(`${DEFAULT_ROOM_PREFIX}${userId}`).emit(event, payload);
};

module.exports = {
  initSocket,
  getIO,
  emitToUser
};

