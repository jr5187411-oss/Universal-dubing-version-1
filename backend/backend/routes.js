const express = require('express');
const router = express.Router();
const dubbingController = require('./controllers/dubbingController');

router.post('/upload', dubbingController.handleUpload);
router.get('/progress/:id', dubbingController.handleProgress);
router.get('/download/:id', dubbingController.handleDownload);

module.exports = router;
