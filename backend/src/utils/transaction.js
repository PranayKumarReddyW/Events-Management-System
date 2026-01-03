const mongoose = require("mongoose");
const logger = require("./logger");

/**
 * Check if MongoDB supports transactions (replica set or mongos)
 * @returns {Promise<boolean>}
 */
async function supportsTransactions() {
  try {
    const admin = mongoose.connection.db.admin();
    const serverStatus = await admin.serverStatus();

    // Check if it's a replica set or sharded cluster
    const isReplicaSet = serverStatus.repl && serverStatus.repl.setName;
    const isSharded = serverStatus.process === "mongos";

    return isReplicaSet || isSharded;
  } catch (error) {
    logger.warn("Could not check MongoDB transaction support:", error.message);
    return false;
  }
}

/**
 * Execute a function with or without transaction based on MongoDB configuration
 * @param {Function} callback - Async function that receives session (may be null)
 * @returns {Promise<any>}
 */
async function withTransaction(callback) {
  const transactionsSupported = await supportsTransactions();

  if (transactionsSupported) {
    // Use transactions (production with replica set)
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } else {
    // No transactions (development with standalone MongoDB)
    logger.debug("Transactions not supported - running without session");
    return await callback(null);
  }
}

module.exports = {
  supportsTransactions,
  withTransaction,
};
