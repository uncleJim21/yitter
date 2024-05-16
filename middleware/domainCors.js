const allowedOrigins = [
    'https://cascdr.vercel.app',
    'https://cascdr-dev.vercel.app',
    'http://localhost:3000',
  ];
  
  const corsRestrictDomain = {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  };
  
  module.exports = corsRestrictDomain;
  