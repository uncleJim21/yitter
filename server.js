// external dependencies
const express = require('express');
const WebSocket = require("ws");
const cors = require('cors');
const bodyParser = require("body-parser");
const mongoose = require('mongoose');

// middleware
const logger = require('./middleware/logger');

// routes
const serviceRoutes = require('./routes/service');
const searchRoutes = require('./routes/youtubeSearch');

// used for testing
const {JobRequest} = require('./models/jobRequest')
const {postOfferings} = require('./lib/postOfferings')
const { 
  validatePreimage, 
  validateCascdrUserEligibility 
} = require('./lib/authChecks');

// --------------------- MONGOOSE -----------------------------

const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
  console.log("Connected to MongoDB!");
});

// --------------------- APP SETUP -----------------------------

const app = express();
require("dotenv").config();
global.WebSocket = WebSocket;


app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.options('*', cors());

const allowedOrigins = [ 
  'https://cascdr.vercel.app', 
  'https://cascdr-dev.vercel.app',  // Add your domains here 
  'http://localhost:3000' 
]; 
 
const corsOptionsRestrictDomain = { 
  origin: (origin, callback) => { 
    if (!origin || allowedOrigins.indexOf(origin) !== -1) { 
      callback(null, true); 
    } else { 
      callback(new Error('Not allowed by CORS')); 
    } 
  }
};

app.use(bodyParser.json());
app.set('trust proxy', true); // trust first proxy

// Request Logging
app.use(logger);

// --------------------MOUNT ENDPOINT ROUTES -----------------------------

app.use('/', serviceRoutes);
app.use('/', searchRoutes);

// --------------------- SERVER -----------------------------

postOfferings();
setInterval(postOfferings, 300000);

let port = 5001;
if (port == null || port == "") {
  port = 5001;
}

app.listen(port, async function () {
  console.log("Starting NIP105 Yitter Server...");
  console.log(`Server started on port ${port}.`);
});

