var express = require('express'),
    restful = require('./../index.js'),
    mongoose = restful.mongoose;
var app = express();

app.use(express.bodyParser());
app.use(express.query());

mongoose.connect("mongodb://localhost/resources");

var Resource = app.resource = restful.model('resource', mongoose.Schema({
    title: 'string',
    year: 'number',
  }))
  .methods(['get', 'post', 'put', 'delete']);

Resource.register(app, '/resources');

app.listen(8123);
