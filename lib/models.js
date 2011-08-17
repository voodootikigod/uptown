// Models should live in ./models
// ClientModelFactory.makeAll() will generate the client-side source for models, with
// only properties defined in the constructor's __exports__ array property.

var util = require('util'),
      fs = require('fs');
var JS_REGEX = /^[a-zA-Z0-9_\-]+\.js$/;

module.exports = function(approot, db, debug) {
	var modelsDir = approot +"/models/server/";
	var files = fs.readdirSync(modelsDir);
	var serializedCache;
	var Models = {};
	for(var i = 0, fl = files.length; i < fl; i++) {
	  if(!files[i].match(JS_REGEX))
	    continue;
	  var module = require(modelsDir+files[i])(db);
	  for (var item in module) {
      if (debug) 
	      console.log("[uptown] Loading model: "+item);
	    Models[item] = module[item];
	  }
	}
	return Models;
}

