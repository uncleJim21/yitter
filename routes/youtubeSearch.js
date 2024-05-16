const express = require('express');
const { searchVideos } = require('../controllers/youtubeSearch');
const cors = require('cors');
const {corsRestrictDomain} = require('../middleware/domainCors');


const router = express.Router();

router
    .route('/search/videos')
    .post(cors(corsRestrictDomain), searchVideos);

module.exports = router;