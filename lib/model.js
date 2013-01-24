var mongoose = require('mongoose');

exports = module.exports = Model 

var methods = ['get', 'post', 'put', 'delete'];
var routes = ['schema'];
// Regular expression that checks for hex value
var checkForHexRegExp = new RegExp("^[0-9a-fA-F]{24}$");

/**
 * A resource exposed via the api
 * Handles internal routing and handling
 */
function Model(model) {
  this.resourceName = model.title.toLowerCase();
  this.title = model.title;
  this.parent = model.parent;
  this.methods = Array.prototype.map.call(model.methods, 
    function(meth) { return meth.toLowerCase(); }
  );
  this.fields = model.fields
  this.excludes = model.excludes;
  //
  // If there is no parent, just use root, othewise use their parents detailurl
  this.baseurl = this.parent ? this.parent.detailurl + this.resourceName : "/" + this.resourceName;
  this.detailurl = model.detailurl || this.baseurl + "/(?{<" + this.resourceName + "_key>)/";
  this.populateRoutes();

  this.Obj = mongoose.model(this.resourceName, model.schema);
}

Model.prototype.populateRoutes = function() {
  var self = this;
  this.routes = {};

  methods.forEach(function(meth) {
    if (self.methods.indexOf(meth) > -1 && meth in self.__proto__) {
      self.routes[meth] = self.__proto__[meth].call(self);
    }
  });

  routes.forEach(function(route) {
    self.routes[route] = self.__proto__[route].call(self);
  });
}

Model.prototype.register = function(app) {
  var self = this;
  app.use(this.baseurl, function() { self.dispatch.apply(self, arguments); });
}

/**
 *
 *
 */
Model.prototype.dispatch = function(req, res, next) {
  var url = req.url.toLowerCase(),
      method = req.method.toLowerCase(),
      params = this.parseUrl(url),
      filters = params.filters,
      route = params.route;

  // If we are recursively dispatching, then we are going to
  // filter the existing queryset. Else, filter this Model
  req.queryset = req.queryset || mongoose.model(this.resourceName).find({});

  req.queryset = this.filter(filters, req.queryset);

  if (!route || route === '') {
    return this.routes[method].call(this, req, res, next);
  } else if (this.routes.hasOwnProperty(route)) {
    return this.routes[route].call(this, req, res, next);
  }
  next();
}

/**
 * Parses the url for a route and a filter
 *
 * Routes are custom endings representing user defined endpoints for specific models
 * Filters filter a queryset
 *
 * If no route is found, '' is returned
 * If no filter is found, '' is returned
 */
Model.prototype.parseUrl = function(url) {
  var filters = '',
      route = '',
      urlparts = url.split('/');

  if (urlparts[0] === '') {
    urlparts.splice(0, 1);
  }
  if (urlparts[urlparts.length - 1] === '') {
    urlparts.splice(urlparts.length - 1, 1);
  }

  filters = this.getFilters(urlparts[0]);
  route = this.getRoute(urlparts[((filters !== '') ? 1 : 0)]); 
  return {
    filters: filters,
    route: route,  
  };
}

/**
 * Parses the url for a route property
 *
 * Routes are custom endings representing user defined endpoints for specific models
 */
Model.prototype.getRoute = function(url) {
  // haven't found a use for this yet
  return url;
}

/**
 * Returns an array of filters to be applied to the queryset
 *
 * More ways of filtering to come
 */
Model.prototype.getFilters = function(filter) {
  if (checkForHexRegExp.test(filter)) {
    return [
      {key: '_id', val: filter},
    ]
  }
  return [];
}

/**
 * Filters the queryset based on the filter properties in the url
 * 
 * Returns the filtered queryset
 *
 * To be implemented
 */
Model.prototype.filter = function(filters, queryset) {
  filters.forEach(function(filter) {
    if ('val' in filter) {
      queryset = queryset.where(filter.key, filter.val);
    }
  });
  return queryset;
}

Model.prototype.schema = function() {
  var self = this;
  return function(req, res, next) {
    respond(res, 200, {
      resource: self.resourceName,
      fields: self.fields,
      methods: self.methods,
      GET: self.detailurl,
      POST: self.baseurl,
      PUT: self.detailurl,
      DELETE: self.detailurl,
    });
  }
}

Model.prototype.get = function() {
  var self = this;
  return function(req, res, next, params) {
    console.log("GET on " + self.resourceName);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    var query = req.queryset.find().lean().exec(function(a,list) {
      res.write(JSON.stringify(list));
      res.end();
    });
  }
}

Model.prototype.post = function() {
  var self = this;
  return function(req, res, next, params) {
    console.log("Called POST on " + self.resourceName);
    var obj = new self.Obj(req.body);
    obj.save(function(err) {
      respondOr400(res, err, 201, obj);
    });
  }
}
Model.prototype.put = function() {
  var self = this;
  return function(req, res, next, filters) {
    console.log("Called PUT on " + self.resourceName);
    req.queryset.findOneAndUpdate({}, req.body, function(err, newObj) {
      if (err) {
        return respond(res, 400, err);
      }
      if (!newObj) {
        respond(res, 400, {
          message: 'Object not found',
          name: 'ObjectNotFound',
          errors: {
            _id: {
              message: "Could not find object with specified attributes",
            }
          }
        });
      } else {
        respond(res, 200, newObj);
      }
      res.end();
    });
  }
}
Model.prototype.delete = function() {
  var self = this;
  return function(req, res, next, params) {
    req.queryset.findOneAndRemove({}, function(err, obj) {
      respondOr400(res, err, 200, {
        status: "OK"
      });
    });
  }
}

/**
 * Takes a response, error, success statusCode and success payload
 *
 * If there is an error, it returns a 400 with the error as the payload
 * If there is no error, it returns statusCode with the specified payload
 *
 */
function respondOr400(res, err, statusCode, payload) {
  if (err) {
    respond(res, 400, err);
  } else {
    respond(res, statusCode, payload);
  }
}

function respond(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.write(JSON.stringify(payload));
  res.end();
}