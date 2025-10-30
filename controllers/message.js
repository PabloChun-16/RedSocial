const mongoose = require("mongoose");
const Conversation = require("../models/conversation");
const Message = require("../models/message");
const User = require("../models/user");
const { getUnreadMessagesCount, toIdString, readUnreadCount } = require("../services/messages");

const MAX_THREADS = 200;
const MAX_NOTIFICATIONS = 50;
const DEFAULT_PAGE_SIZE = 40;
const MAX_PAGE_SIZE = 200;
const NOTIFY_PREVIEW_LIMIT = 140;
const FALLBACK_RELATIONS_LIMIT = 400;

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const sanitizeUserSummary = (source) => {
  if(!source) return null;
  const data =
    typeof source.toObject === "function" ? source.toObject({ virtuals: false }) : source;
  const id =
    data?._id?.toString?.() ??
    data?.id ??
    (typeof data === "string" ? data : typeof source === "string" ? source : null);
  if(!id){
    return null;
  }
  return {
    id,
    name: data?.name || "",
    surname: data?.surname || "",
    nick: data?.nick || "",
    image: data?.image || "iconobase.png"
  };
};

const sanitizeMessage = (doc, currentUserId) => {
  if(!doc) return null;
  const data =
    typeof doc.toObject === "function"
      ? doc.toObject({ virtuals: false })
      : { ...doc };
  const id = data._id?.toString?.() ?? data.id ?? null;
  const senderId = toIdString(data.sender?._id ?? data.sender);
  const recipientId = toIdString(data.recipient?._id ?? data.recipient);
  const readBy =
    Array.isArray(data.readBy) ? data.readBy.map((value) => toIdString(value)).filter(Boolean) : [];
  return {
    id,
    text: data.text || "",
    createdAt: data.createdAt,
    sender: sanitizeUserSummary(data.sender),
    recipient: sanitizeUserSummary(data.recipient),
    isOwn: senderId === currentUserId,
    isRead: readBy.includes(currentUserId),
    senderId,
    recipientId
  };
};

const truncatePreview = (text = "", limit = NOTIFY_PREVIEW_LIMIT) => {
  const trimmed = text.trim();
  if(!trimmed) return "";
  if(trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit - 1)}…`;
};

const collectMessages = async (conversationId, currentUserId, { limit, before } = {}) => {
  const pageSize = Math.min(Math.max(limit || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const filter = { conversation: conversationId };
  if(before instanceof Date && !Number.isNaN(before.getTime())){
    filter.createdAt = { $lt: before };
  }
  const query = Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(pageSize)
    .populate("sender", "name nick surname image")
    .populate("recipient", "name nick surname image");

  const rawMessages = await query.lean().exec();
  const hasMore = rawMessages.length === pageSize;
  rawMessages.reverse();
  const messages = rawMessages.map((message) => sanitizeMessage(message, currentUserId));
  const nextCursor = rawMessages.length ? rawMessages[0].createdAt : null;
  return { messages, hasMore, nextCursor };
};

const createMessageNotification = async ({
  actorId,
  targetUserId,
  conversationId,
  preview,
  actorNick,
  actorName
}) => {
  if(!actorId || !targetUserId) return;
  const actorLabel = actorNick ? `@${actorNick}` : actorName || "Alguien";
  const snippet = truncatePreview(preview || "");
  const body = snippet ? `${actorLabel} te envió un mensaje: “${snippet}”` : `${actorLabel} te envió un mensaje`;
  try{
    await User.findByIdAndUpdate(
      targetUserId,
      {
        $push: {
          notifications: {
            $each: [
              {
                type: "message",
                actor: actorId,
                conversation: conversationId,
                message: body,
                isRead: false,
                createdAt: new Date()
              }
            ],
            $position: 0,
            $slice: MAX_NOTIFICATIONS
          }
        }
      },
      { new: false }
    ).exec();
  }catch(error){
    console.warn("No se pudo crear la notificación de mensaje", error.message);
  }
};

const fetchUserWithRelations = async (userId) => {
  if(!userId) return null;
  return User.findById(userId)
    .select("name surname nick image followers following followersCount followingCount")
    .lean()
    .exec();
};

const fetchFallbackRelations = async ({ currentUserId, direction }) => {
  const query = direction === "followers"
    ? { following: currentUserId }
    : { followers: currentUserId };
  const docs = await User.find(query)
    .select("_id")
    .limit(FALLBACK_RELATIONS_LIMIT)
    .lean()
    .exec();
  return docs
    .map((doc) => toIdString(doc?._id ?? doc?.id))
    .filter(Boolean);
};

const ensureConversationBetween = async (currentUserId, targetUserId, { allowCreate = false } = {}) => {
  const currentId = toIdString(currentUserId);
  const targetId = toIdString(targetUserId);
  if(!currentId || !targetId){
    return { conversation: null, created: false };
  }
  const participantsKey = [currentId, targetId].sort().join(":");
  let conversation = await Conversation.findOne({ participantsKey }).exec();
  let created = false;
  if(!conversation && allowCreate){
    conversation = await Conversation.create({
      participants: [currentUserId, targetUserId],
      participantsKey,
      unreadCounts: {
        [currentId]: 0,
        [targetId]: 0
      }
    });
    created = true;
  }
  return { conversation, created };
};

const buildThreadList = async (currentUserId) => {
  const currentId = toIdString(currentUserId);
  const currentUser = await fetchUserWithRelations(currentUserId);
  if(!currentUser){
    return { threads: [], totalUnread: 0 };
  }

  const followerSet = new Set(
    Array.isArray(currentUser.followers)
      ? currentUser.followers.map((value) => toIdString(value)).filter(Boolean)
      : []
  );
  const followingSet = new Set(
    Array.isArray(currentUser.following)
      ? currentUser.following.map((value) => toIdString(value)).filter(Boolean)
      : []
  );

  if(
    typeof currentUser.followersCount === "number" &&
    currentUser.followersCount > followerSet.size
  ){
    const fallbackFollowers = await fetchFallbackRelations({
      currentUserId,
      direction: "followers"
    });
    fallbackFollowers.forEach((id) => followerSet.add(id));
  }
  if(
    typeof currentUser.followingCount === "number" &&
    currentUser.followingCount > followingSet.size
  ){
    const fallbackFollowing = await fetchFallbackRelations({
      currentUserId,
      direction: "following"
    });
    fallbackFollowing.forEach((id) => followingSet.add(id));
  }

  const contactIds = new Set([
    ...followerSet,
    ...followingSet
  ]);
  contactIds.delete(currentId);

  const conversations = await Conversation.find({ participants: currentUserId })
    .limit(MAX_THREADS)
    .populate("participants", "name nick surname image")
    .lean()
    .exec();

  const conversationByContact = new Map();
  conversations.forEach((conversation) => {
    const participants = Array.isArray(conversation.participants)
      ? conversation.participants
      : [];
    const other = participants
      .map((participant) => toIdString(participant?._id ?? participant))
      .find((id) => id && id !== currentId);
    if(other){
      conversationByContact.set(other, conversation);
      contactIds.add(other);
    }
  });

  const contactUsers = await User.find({ _id: { $in: Array.from(contactIds) } })
    .select("name surname nick image")
    .lean()
    .exec();

  const contactsMap = new Map(
    contactUsers.map((user) => [toIdString(user?._id ?? user.id), user])
  );

  const threads = Array.from(contactIds)
    .map((contactId) => {
      const target = contactsMap.get(contactId);
      if(!target){
        return null;
      }
      const conversation = conversationByContact.get(contactId) || null;
      const unread = conversation ? readUnreadCount(conversation.unreadCounts, currentId) : 0;
      const lastMessage = conversation?.lastMessage || null;
      const lastMessageAt =
        lastMessage?.createdAt || conversation?.updatedAt || conversation?.createdAt || null;
      return {
        contact: sanitizeUserSummary(target),
        conversationId: conversation?._id?.toString?.() ?? null,
        unread,
        preview: truncatePreview(lastMessage?.text || ""),
        lastMessageAt,
        lastMessageSender: toIdString(lastMessage?.sender),
        relationship: {
          following: followingSet.has(contactId),
          followedBy: followerSet.has(contactId),
          friends: followingSet.has(contactId) && followerSet.has(contactId)
        },
        status: conversation ? "active" : "pending"
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

  const totalUnread = threads.reduce((sum, thread) => sum + (thread.unread || 0), 0);
  return { threads, totalUnread };
};

const buildConversationPayload = async ({
  conversation,
  currentUser,
  contactUser,
  currentUserId,
  query
}) => {
  const currentId = toIdString(currentUserId);
  const contactId = toIdString(contactUser?._id ?? contactUser?.id);

  const followerSet = new Set(
    Array.isArray(currentUser?.followers)
      ? currentUser.followers.map((value) => toIdString(value)).filter(Boolean)
      : []
  );
  const followingSet = new Set(
    Array.isArray(currentUser?.following)
      ? currentUser.following.map((value) => toIdString(value)).filter(Boolean)
      : []
  );

  let beforeDate = null;
  if(query?.before){
    const parsed = new Date(query.before);
    if(!Number.isNaN(parsed.getTime())){
      beforeDate = parsed;
    }
  }

  const { messages, hasMore, nextCursor } = await collectMessages(conversation._id, currentUserId, {
    limit: query?.limit,
    before: beforeDate
  });

  // Marcar como leído y normalizar contador de no leídos de forma segura
  try{
    await Promise.all([
      Message.updateMany(
        {
          conversation: conversation._id,
          recipient: currentUserId,
          readBy: { $ne: currentUserId }
        },
        { $addToSet: { readBy: currentUserId } }
      ).exec(),
      Conversation.updateOne(
        { _id: conversation._id },
        { $set: { [`unreadCounts.${currentId}`]: 0 } }
      ).exec()
    ]);
  }catch(updateErr){
    // No bloquear la carga del chat por un fallo de actualización de lectura
  }

  const totalUnread = await getUnreadMessagesCount(currentUserId);

  const relationship = {
    following: followingSet.has(contactId),
    followedBy: followerSet.has(contactId)
  };
  relationship.friends = relationship.following && relationship.followedBy;

  return {
    conversation: {
      id: conversation._id.toString(),
      contact: sanitizeUserSummary(contactUser),
      participants: [sanitizeUserSummary(currentUser), sanitizeUserSummary(contactUser)],
      unread: 0,
      messages,
      hasMore,
      nextCursor,
      relationship,
      lastMessage: conversation.lastMessage
        ? {
            text: conversation.lastMessage.text || "",
            createdAt: conversation.lastMessage.createdAt,
            sender: toIdString(conversation.lastMessage.sender)
          }
        : null
    },
    totalUnread
  };
};

const listThreads = async (req, res) => {
  try{
    const { threads, totalUnread } = await buildThreadList(req.user.id);
    return res.status(200).json({
      status: "success",
      totalUnread,
      threads
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudieron obtener tus conversaciones",
      error: error.message
    });
  }
};

const getConversationWithUser = async (req, res) => {
  const targetId = req.params.userId;
  if(!isObjectId(targetId)){
    return res.status(400).json({
      status: "error",
      message: "Identificador de usuario no válido"
    });
  }
  if(toIdString(targetId) === toIdString(req.user.id)){
    return res.status(400).json({
      status: "error",
      message: "No puedes iniciar un chat contigo mism@"
    });
  }
  try{
    const [currentUser, targetUser] = await Promise.all([
      fetchUserWithRelations(req.user.id),
      fetchUserWithRelations(targetId)
    ]);
    if(!currentUser){
      return res.status(404).json({
        status: "error",
        message: "No se pudo identificar tu usuario"
      });
    }
    if(!targetUser){
      return res.status(404).json({
        status: "error",
        message: "La persona indicada no existe"
      });
    }
    const followerSet = new Set(
      Array.isArray(currentUser.followers)
        ? currentUser.followers.map((value) => toIdString(value)).filter(Boolean)
        : []
    );
    const followingSet = new Set(
      Array.isArray(currentUser.following)
        ? currentUser.following.map((value) => toIdString(value)).filter(Boolean)
        : []
    );

    const { conversation } = await ensureConversationBetween(req.user.id, targetId, {
      allowCreate: followerSet.has(toIdString(targetId)) || followingSet.has(toIdString(targetId))
    });

    if(!conversation){
      return res.status(403).json({
        status: "error",
        message: "Necesitas seguir o ser seguido por la persona para chatear"
      });
    }

    const payload = await buildConversationPayload({
      conversation,
      currentUser,
      contactUser: targetUser,
      currentUserId: req.user.id,
      query: req.query
    });

    return res.status(200).json({
      status: "success",
      ...payload
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo cargar la conversación",
      error: error.message
    });
  }
};

const getConversationById = async (req, res) => {
  const conversationId = req.params.conversationId;
  if(!isObjectId(conversationId)){
    return res.status(400).json({
      status: "error",
      message: "Identificador de conversación no válido"
    });
  }
  try{
    const conversation = await Conversation.findById(conversationId)
      .populate("participants", "name surname nick image followers following")
      .exec();
    if(!conversation){
      return res.status(404).json({
        status: "error",
        message: "La conversación solicitada ya no existe"
      });
    }

    const participants = Array.isArray(conversation.participants)
      ? conversation.participants
      : [];
    const currentIndex = participants.findIndex(
      (participant) => toIdString(participant?._id ?? participant) === toIdString(req.user.id)
    );
    if(currentIndex === -1){
      return res.status(403).json({
        status: "error",
        message: "No tienes acceso a esta conversación"
      });
    }

    const contactParticipant = participants.find(
      (participant, index) => index !== currentIndex
    );
    if(!contactParticipant){
      return res.status(404).json({
        status: "error",
        message: "No se pudo determinar el participante del chat"
      });
    }

    const currentUser = await fetchUserWithRelations(req.user.id);
    if(!currentUser){
      return res.status(404).json({
        status: "error",
        message: "No se pudo identificar tu usuario"
      });
    }

    const payload = await buildConversationPayload({
      conversation,
      currentUser,
      contactUser: contactParticipant,
      currentUserId: req.user.id,
      query: req.query
    });

    return res.status(200).json({
      status: "success",
      ...payload
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo recuperar el chat",
      error: error.message
    });
  }
};

const sendMessageToUser = async (req, res) => {
  const targetId = req.params.userId;
  if(!isObjectId(targetId)){
    return res.status(400).json({
      status: "error",
      message: "Identificador de usuario no válido"
    });
  }
  const rawText = req.body?.text;
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if(!text){
    return res.status(400).json({
      status: "error",
      message: "El mensaje no puede estar vacío"
    });
  }
  try{
    const [currentUser, targetUser] = await Promise.all([
      fetchUserWithRelations(req.user.id),
      fetchUserWithRelations(targetId)
    ]);
    if(!currentUser){
      return res.status(404).json({
        status: "error",
        message: "No se pudo identificar tu usuario"
      });
    }
    if(!targetUser){
      return res.status(404).json({
        status: "error",
        message: "La persona indicada no existe"
      });
    }
    const targetIdStr = toIdString(targetId);
    const followerSet = new Set(
      Array.isArray(currentUser.followers)
        ? currentUser.followers.map((value) => toIdString(value)).filter(Boolean)
        : []
    );
    const followingSet = new Set(
      Array.isArray(currentUser.following)
        ? currentUser.following.map((value) => toIdString(value)).filter(Boolean)
        : []
    );

    const { conversation, created } = await ensureConversationBetween(req.user.id, targetId, {
      allowCreate: followerSet.has(targetIdStr) || followingSet.has(targetIdStr)
    });

    if(!conversation){
      return res.status(403).json({
        status: "error",
        message: "Necesitas seguir o ser seguido por la persona para chatear"
      });
    }

    const now = new Date();
    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user.id,
      recipient: targetId,
      text,
      readBy: [req.user.id],
      createdAt: now
    });

    await Conversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessage: {
            text,
            sender: req.user.id,
            createdAt: now
          },
          updatedAt: now,
          [`unreadCounts.${toIdString(req.user.id)}`]: 0
        },
        $inc: {
          [`unreadCounts.${targetIdStr}`]: 1
        }
      }
    ).exec();

    await createMessageNotification({
      actorId: req.user.id,
      targetUserId: targetId,
      conversationId: conversation._id,
      preview: text,
      actorNick: currentUser.nick,
      actorName: currentUser.name
    });

    const sanitizedMessage = sanitizeMessage(
      {
        ...message.toObject(),
        sender: currentUser,
        recipient: targetUser
      },
      toIdString(req.user.id)
    );

    const totalUnread = await getUnreadMessagesCount(req.user.id);

    return res.status(201).json({
      status: "success",
      message: sanitizedMessage,
      conversation: {
        id: conversation._id.toString(),
        contact: sanitizeUserSummary(targetUser),
        created: created === true,
        lastMessage: {
          text,
          createdAt: now,
          sender: toIdString(req.user.id)
        }
      },
      totalUnread
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo enviar el mensaje",
      error: error.message
    });
  }
};

const markConversationAsRead = async (req, res) => {
  const conversationId = req.params.conversationId;
  if(!isObjectId(conversationId)){
    return res.status(400).json({
      status: "error",
      message: "Identificador de conversación no válido"
    });
  }
  try{
    const conversation = await Conversation.findById(conversationId).select("participants").exec();
    if(!conversation){
      return res.status(404).json({
        status: "error",
        message: "La conversación solicitada ya no existe"
      });
    }
    const participants = Array.isArray(conversation.participants)
      ? conversation.participants.map((value) => toIdString(value))
      : [];
    if(!participants.includes(toIdString(req.user.id))){
      return res.status(403).json({
        status: "error",
        message: "No tienes acceso a esta conversación"
      });
    }

    await Promise.all([
      Message.updateMany(
        { conversation: conversation._id, recipient: req.user.id, readBy: { $ne: req.user.id } },
        { $addToSet: { readBy: req.user.id } }
      ).exec(),
      Conversation.updateOne(
        { _id: conversation._id },
        { $set: { [`unreadCounts.${toIdString(req.user.id)}`]: 0 } }
      ).exec()
    ]);

    const totalUnread = await getUnreadMessagesCount(req.user.id);

    return res.status(200).json({
      status: "success",
      totalUnread
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo actualizar la conversación",
      error: error.message
    });
  }
};

const getSummary = async (req, res) => {
  try{
    const totalUnread = await getUnreadMessagesCount(req.user.id);
    return res.status(200).json({
      status: "success",
      totalUnread
    });
  }catch(error){
    return res.status(500).json({
      status: "error",
      message: "No se pudo obtener el resumen de mensajes",
      error: error.message
    });
  }
};

module.exports = {
  listThreads,
  getConversationWithUser,
  getConversationById,
  sendMessageToUser,
  markConversationAsRead,
  getSummary
};
