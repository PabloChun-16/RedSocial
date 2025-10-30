const mongoose = require("mongoose");

async function ensureConversationIndexes(){
  try{
    const Conversation = require("../models/conversation");
    // Drop legacy wrong index if it exists (key_1)
    const indexes = await Conversation.collection.indexes().catch(() => []);
    const hasWrong = Array.isArray(indexes) && indexes.some((ix) => ix?.name === "key_1");
    if(hasWrong){
      try{
        await Conversation.collection.dropIndex("key_1");
        console.log("[indexes] Removed legacy index conversations.key_1");
      }catch(err){
        console.warn("[indexes] Could not drop key_1:", err?.message);
      }
    }
    // Synchronize indexes defined in schema (creates participantsKey unique index if missing
    // and removes others not present)
    await Conversation.syncIndexes();
    console.log("[indexes] Conversations indexes are in sync");
  }catch(error){
    console.warn("[indexes] Sync failed:", error?.message);
  }
}

module.exports = { ensureConversationIndexes };

