import cors from 'cors';
import config from '../config/index.js';

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (config.env === 'production') return callback(null, true);
    if (config.cors.allowedOrigins.indexOf(origin) !== -1 || config.env === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
};

export default cors(corsOptions);
