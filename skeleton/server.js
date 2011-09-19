var uptown          = require("uptown"),
    options         = require("./lib/helpers"),
    app_env     		=   (process.env["NODE_ENV"] || "development");
  
// Load up app config
options["app_config"] = require(__dirname+"/../config")[app_env];

// Head uptown!
uptown.init(__dirname, options).start();