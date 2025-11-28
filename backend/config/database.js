require('dotenv').config();

module.exports = {
  dbPath: process.env.DB_PATH || './db/rag.db',
  options: {
    verbose: process.env.ENABLE_DEBUG === 'true' ? console.log : null,
    fileMustExist: false
  }
};
