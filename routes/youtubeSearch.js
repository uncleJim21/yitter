const express = require('express');
const { searchVideos } = require('../controllers/youtubeSearch');
const auth =  require('../middleware/auth');


const router = express.Router();

router
    .route('/search/videos')
    .post(auth, searchVideos);

module.exports = router;