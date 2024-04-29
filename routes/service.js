const express = require('express');
const { postService, getResult } = require('../controllers/service');
const auth =  require('../middleware/auth');


const router = express.Router();

router
    .route('/:service')
    .post(auth, postService);

router
    .route('/:service/:payment_hash/get_result')
    .get(auth, getResult);

module.exports = router;