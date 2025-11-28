require('dotenv').config();
const app = require('./server');

const PORT = process.env.PORT || 3000;
console.log(`Starting production server on port ${PORT}`);
