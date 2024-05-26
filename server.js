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
const { uploadFileToSpaces, deleteOldFilesFromSpaces, deleteOldLocalFiles } = require('./lib/cloudStorageUtils');
// const {callMakeClip, callYitter} = require('./lib/service')

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
async function doCronJobs(){
  console.log(`doCronJobs`)
  const garbageCollectionDays = 30;//process.env.GARBAGE_COLLECTION_MAX_DAYS || 3;
  console.log(`Collecting garbage more than:${garbageCollectionDays}`)
  postOfferings();
  deleteOldFilesFromSpaces(garbageCollectionDays);
  deleteOldLocalFiles(garbageCollectionDays);
}

doCronJobs();
setInterval(doCronJobs, 300000);

let port = 4000;
if (port == null || port == "") {
  port = 4000;
}

app.listen(port, async function () {
  console.log("Starting NIP105 Server...");
  console.log(`Server started on port ${port}.`);

  // const data = {
  //   videoId:'BeCGnY_aVUM',
  //   clipRanges: [ { start: 2661.28, end: 2727.76 } ]
  // }
  // callMakeClip(data)
  // callYitter({})
  // const blah = await uploadFileToSpaces('./clips/x9ITk5R_ezw_clip_1.mp4','cascdr-chads-stay-winning','test33.mp4')
  // console.log(blah);
});

