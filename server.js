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
const { uploadFileToSpaces } = require('./lib/cloudStorageUtils');


// used for testing
const {JobRequest} = require('./models/jobRequest')
const {postOfferings} = require('./lib/postOfferings')
const { 
  validatePreimage, 
  validateCascdrUserEligibility 
} = require('./lib/authChecks');

// misc

const {
  relayInit,
  getPublicKey,
} = require("nostr-tools");
const {
  YTDL_SCHEMA,
  YTDL_RESULT_SCHEMA,
} = require("./const/serviceSchema");
const { callMakeClip } = require('./lib/service');

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

app.use(bodyParser.json());
app.set('trust proxy', true); // trust first proxy

// Request Logging
app.use(logger);

// --------------------MOUNT ENDPOINT ROUTES -----------------------------

app.use('/', serviceRoutes);

// --------------------- SERVER -----------------------------

postOfferings();
setInterval(postOfferings, 300000);

let port = 5001;
if (port == null || port == "") {
  port = 5001;
}

app.listen(port, async function () {
  console.log("Starting NIP105 Server...");
  console.log(`Server started on port ${port}.`);
  // const data = {
  //   videoId:'BeCGnY_aVUM',
  //   clipRanges: [ 
  //     {start:0.0, end:10.0},
  //     {start:2661.28, end: 2671.28}
  //     //{ start: 2661.28, end: 2727.76 } ,
  //     //{ start: 2550.079, end: 2580.012 }
  //   ]
  // }
  // callMakeClip(data)

  // const blah = await uploadFileToSpaces('./clips/x9ITk5R_ezw_clip_1.mp4','cascdr-chads-stay-winning','test33.mp4')
  // console.log(blah);
});

