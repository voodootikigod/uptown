// npm install express pg postmark login
/**
 * Module dependencies.
 */
var uptown = require("uptown"),
    helpers = require("./lib/helpers");
module.exports.attach = function (app, app_config) {
  uptown.attach(app, app_config, __dirname, helpers);
};
