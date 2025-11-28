const logger = {
  info: (message, data = null) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(data);
  },
  
  error: (message, error = null) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`);
    if (error) console.error(error);
  },
  
  success: (message, data = null) => {
    console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`);
    if (data) console.log(data);
  },
  
  debug: (message, data = null) => {
    if (process.env.ENABLE_DEBUG === 'true') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`);
      if (data) console.log(data);
    }
  }
};

module.exports = logger;
