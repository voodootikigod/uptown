var uptown = require("uptown");

module.exports.dynamicHelpers = {
};

module.exports.helpers = {
  is_prod: function () { 
    return (["staging", "production"].indexOf((process.env["NODE_ENV"] || "development")) >= 0); 
  },
  titleize: function (string) {
  	res = new Array();
  	var parts = string.split(" ");
  	for (var i =0, pl = parts.length; i < pl; i++) {
  	  var part = parts[i];
  		res.push(part.substring(0,1).toUpperCase() + part.substring(1,part.length));
  	}
  	return res.join(" ");
  },
  truncate: function (string, length) {
    if (length < string.length)
      return string.substr(0, length) +"..."
    else
      string
  }
};
