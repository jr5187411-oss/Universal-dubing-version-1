const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const routes = require('./routes');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use('/api', routes);
app.use('/output', express.static(path.join(__dirname, 'output')));

module.exports = app;
