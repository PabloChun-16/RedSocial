const mongoose = require("mongoose");
const User = require("../models/user");
const { formatUserResponse } = require("./user");
const { resolveImageUrl } = require("../utils/image");
const DEFAULT_AVATAR = "iconobase.png";

const { getUnreadMessagesCount } = require("../services/messages");

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const ensureArrays = (user) => {
  if(!user) return;
  if(!Array.isArray(user.followers)) user.followers = [];
  if(!Array.isArray(user.following)) user.following = [];
};

const updateCounts = (user) => {
  ensureArrays(user);
  user.followersCount = Array.isArray(user.followers) ? user.followers.length : 0;
  user.followingCount = Array.isArray(user.following) ? user.following.length : 0;
};

const getRelationship = (currentUser, targetUser) => {
  const currentId = currentUser?._id?.toString?.();
  const targetId = targetUser?._id?.toString?.();
  if(!currentId || !targetId){
    return { following: false, followedBy: false, friends: false };
  }
  const currentFollowing = new Set(
    (currentUser.following || []).map((id) => id?.toString?.()).filter(Boolean)
  );
  const targetFollowing = new Set(
    (targetUser.following || []).map((id) => id?.toString?.()).filter(Boolean)
  );
  const relationship = {
    following: currentFollowing.has(targetId),
    followedBy: targetFollowing.has(currentId)
  };
  relationship.friends = relationship.following && relationship.followedBy;
  return relationship;
};

const buildCountsPayload = (user) => ({
  followers: typeof user.followersCount === "number"
    ? user.followersCount
    : Array.isArray(user.followers)
    ? user.followers.length
    : 0,
  following: typeof user.followingCount === "number"
    ? user.followingCount
    : Array.isArray(user.following)
    ? user.following.length
    : 0
});

const followUser = async (req, res) => {
  const targetId = req.params.userId;
  const currentUserId = req.user.id;
  if(!targetId || !isObjectId(targetId)){
    return res.status(400).json({
      status: "error",
      message: "Usuario a seguir no válido"
    });
  }
  if(targetId.toString() === currentUserId.toString()){
    return res.status(400).json({
      status: "error",
      message: "No puedes seguirte a ti mismo"
    });
  }
  try{
    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId)
        .select("name surname nick email role imageKey bio notifications followers following followersCount followingCount")
        .exec(),
      User.findById(targetId)
        .select("name surname nick role imageKey bio followers following followersCount followingCount")
        .exec()
    ]);

    if(!targetUser){
      return res.status(404).json({
        status: "error",
        message: "El usuario que intentas seguir no existe"
      });
    }
    if(!currentUser){
      return res.status(404).json({
        status: "error",
        message: "Tu sesión no es válida"
      });
    }

    ensureArrays(currentUser);
    ensureArrays(targetUser);

    const targetIdStr = targetUser._id.toString();
    const currentIdStr = currentUser._id.toString();

    const alreadyFollowing = currentUser.following.some(
      (id) => id?.toString?.() === targetIdStr
    );

    if(!alreadyFollowing){
      currentUser.following.push(targetUser._id);
    }

    const alreadyRegistered = targetUser.followers.some(
      (id) => id?.toString?.() === currentIdStr
    );
    if(!alreadyRegistered){
      targetUser.followers.push(currentUser._id);
    }

    if(!alreadyFollowing || !alreadyRegistered){
      updateCounts(currentUser);
      updateCounts(targetUser);
      await Promise.all([currentUser.save(), targetUser.save()]);
    }

    const relationship = getRelationship(currentUser, targetUser);
    const messagesUnread = await getUnreadMessagesCount(currentUserId);

    const targetImageUrl = await resolveImageUrl({
      key: targetUser.imageKey,
      legacy: targetUser.image,
      excludeLegacy: [DEFAULT_AVATAR]
    });
    const targetPayload = {
      id: targetIdStr,
      nick: targetUser.nick,
      name: targetUser.name,
      imageUrl: targetImageUrl,
      image: targetImageUrl || DEFAULT_AVATAR
    };

    const currentUserPayload = await formatUserResponse(currentUser, { messagesUnread });

    return res.status(200).json({
      status: "success",
      message: alreadyFollowing ? "Ya sigues a este usuario" : "Ahora sigues a este usuario",
      relationship,
      counts: {
        currentUser: buildCountsPayload(currentUser),
        target: buildCountsPayload(targetUser)
      },
      target: targetPayload,
      currentUser: currentUserPayload
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo seguir al usuario",
      error: error.message
    });
  }
};

const unfollowUser = async (req, res) => {
  const targetId = req.params.userId;
  const currentUserId = req.user.id;
  if(!targetId || !isObjectId(targetId)){
    return res.status(400).json({
      status: "error",
      message: "Usuario a dejar de seguir no válido"
    });
  }
  if(targetId.toString() === currentUserId.toString()){
    return res.status(400).json({
      status: "error",
      message: "No puedes dejar de seguirte a ti mismo"
    });
  }
  try{
    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId)
        .select("name surname nick email role imageKey bio notifications followers following followersCount followingCount")
        .exec(),
      User.findById(targetId)
        .select("name surname nick role imageKey bio followers following followersCount followingCount")
        .exec()
    ]);

    if(!targetUser){
      return res.status(404).json({
        status: "error",
        message: "El usuario indicado no existe"
      });
    }
    if(!currentUser){
      return res.status(404).json({
        status: "error",
        message: "Tu sesión no es válida"
      });
    }

    ensureArrays(currentUser);
    ensureArrays(targetUser);

    const targetIdStr = targetUser._id.toString();
    const currentIdStr = currentUser._id.toString();

    const initialFollowingLength = currentUser.following.length;
    currentUser.following = currentUser.following.filter(
      (id) => id?.toString?.() !== targetIdStr
    );

    const initialFollowersLength = targetUser.followers.length;
    targetUser.followers = targetUser.followers.filter(
      (id) => id?.toString?.() !== currentIdStr
    );

    const changed =
      initialFollowingLength !== currentUser.following.length ||
      initialFollowersLength !== targetUser.followers.length;

    if(changed){
      updateCounts(currentUser);
      updateCounts(targetUser);
      await Promise.all([currentUser.save(), targetUser.save()]);
    }

    const relationship = getRelationship(currentUser, targetUser);
    const messagesUnread = await getUnreadMessagesCount(currentUserId);

    const targetImageUrl = await resolveImageUrl({
      key: targetUser.imageKey,
      legacy: targetUser.image,
      excludeLegacy: [DEFAULT_AVATAR]
    });
    const targetPayload = {
      id: targetIdStr,
      nick: targetUser.nick,
      name: targetUser.name,
      imageUrl: targetImageUrl,
      image: targetImageUrl || DEFAULT_AVATAR
    };

    const currentUserPayload = await formatUserResponse(currentUser, { messagesUnread });

    return res.status(200).json({
      status: "success",
      message: changed ? "Has dejado de seguir a este usuario" : "No estabas siguiendo a este usuario",
      relationship,
      counts: {
        currentUser: buildCountsPayload(currentUser),
        target: buildCountsPayload(targetUser)
      },
      target: targetPayload,
      currentUser: currentUserPayload
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo dejar de seguir al usuario",
      error: error.message
    });
  }
};

module.exports = {
  followUser,
  unfollowUser
};
