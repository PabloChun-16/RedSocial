const mongoose = require("mongoose");
const Conversation = require("../models/conversation");

const toIdString = (value) => {
  if(!value) return "";
  if(value instanceof mongoose.Types.ObjectId){
    return value.toString();
  }
  if(typeof value === "object" && typeof value.toString === "function"){
    return value.toString();
  }
  if(typeof value === "string"){
    return value;
  }
  return "";
};

const readUnreadCount = (unreadCounts, key) => {
  if(!key) return 0;
  if(!unreadCounts) return 0;
  if(typeof unreadCounts.get === "function"){
    const value = unreadCounts.get(key);
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  const value = unreadCounts[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const getUnreadMessagesCount = async (userId) => {
  const idString = toIdString(userId);
  if(!idString){
    return 0;
  }
  const projection = {};
  projection[`unreadCounts.${idString}`] = 1;
  const conversations = await Conversation.find({ participants: userId })
    .select(projection)
    .lean()
    .exec();
  return conversations.reduce((total, doc) => {
    return total + readUnreadCount(doc?.unreadCounts, idString);
  }, 0);
};

module.exports = {
  getUnreadMessagesCount,
  toIdString,
  readUnreadCount
};
