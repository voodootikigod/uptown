var app_env, app_config;

var express     =   require('express'),
  	connect     =   require("connect"),
    login       =   require('login').postgresql,
    fs          =   require("fs");

var jsp = require("uglify-js").parser;
var pro = require("uglify-js").uglify;    
var helpers = require("./helpers");    
var app = exports.app = express.createServer();
var appRoot;

var defaults = {
  sessionHandler:  (function (express, connect) {
    return express.session({ secret: "921JoGhozySwWSs4S3VCf5ppW1h0NRo3J8MB" })
  }),
  viewEngine: 'jade',
  debug: false
};


exports.BaseModel = require("./base_model");


exports.init = function (approot, options) {
	// Ensure sane directory structure.
	var listing = fs.readdirSync(approot);
	var expectedDirs = ["controllers", "models", "db", "public", "views"];
	var expectedCount = 0;
	for (var l = listing.length-1; 0 <= l; l--) { if (expectedDirs.indexOf(listing[l]) >=0) { expectedCount++; } }
	if (expectedCount != expectedDirs.length) {
		throw new Exception("The application root does not appear to be a valid Uptown app." +
                        " Please run uptown generate <project_name> again.");
	} else {
		appRoot = approot;
	}
	// populate environment and configuration
	app_env     		=   (process.env["NODE_ENV"] || "development");
	app_config  		=   require(appRoot+"/config")[app_env];

  defaults["debug"] = (app_env == "development");



  if (typeof options !== "object") {
    options = {};
  }
  
  options.__proto__ = defaults;
  exports.options = options;


	// load database connection
	exports.db			=	require(__dirname+"/db")(app_config).connection;
	// Load server side model definitions
	exports.models      =   require(__dirname+"/models")(appRoot, exports.db, options.debug);
  exports.postmark    =   require("postmark")(app_config.postmark);

  // Configuration
  app.configure(function(){
    app.set('views', appRoot + '/views');
    app.set('view engine', options.viewEngine);
    app.use(express.cookieParser());
    app.use(options.sessionHandler(express, connect));
  
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(appRoot + '/public'));
  });

  app.configure('development', function(){
    app.use(express.errorHandler({ 
      dumpExceptions: true, 
      showStack: true 
    })); 
  });

  app.configure('production', function(){
    app.use(express.errorHandler()); 
  });

  var dHelpers = helpers.dynamicHelpers;
  var sHelpers = helpers.helpers;
  // Populate dynamic helpers
  if (typeof options["dynamicHelpers"] === 'object') {
    options["dynamicHelpers"].__proto__ = dHelpers;
    dHelpers = options["dynamicHelpers"];
  }
  app.dynamicHelpers(dHelpers);

  // Populate helpers
  if (typeof options["helpers"] === 'object') {
    options["helpers"].__proto__ = sHelpers;
    sHelpers = options["helpers"];
  }
  app.helpers(sHelpers);

  // Initialize authentication system
  var auth = login(app, exports.db, exports.postmark, { 
    app_name: app_config.app_name, 
    base_url: app_config.base_url, 
    from: app_config.postmark_from,
    email_key: (app_config["email_key"] || "email_address")
  });



  // initialize controllers
  var controllersDir = appRoot+"/controllers/";
  fs.readdir(controllersDir, function (err, files) {
    for (var fl = files.length; 0 < fl; fl--) {
      var module = files[fl-1];
      if (/[a-z]+\.js/.test(module))
        require(controllersDir+module).load(app, auth, exports.models);
    }
  });

  // bind up the client side backbone models and if production, compress, and cache in memory
  var cachedModels = null;
  app.get("/backbone/models.js", function (req, res) {
    if (!cachedModels) {
      var str = "var BaseModel = Backbone.Model;";
      var clientModels = appRoot+"/models/client/";
       fs.readdir(clientModels, function (err, files) {
         for (var fl = files.length; 0 < fl; fl--) {
           var model = files[fl-1];
           if (/[a-z]+\.js/.test(model)) {
             str += "\n\n/* "+model+" */\n"+fs.readFileSync(clientModels+model).toString();
           }
         }
         res.send(str);
         if (app_env != "development") {
           var ast = jsp.parse(str); // parse code and get the initial AST
           ast = pro.ast_mangle(ast); // get a new AST with mangled names
           ast = pro.ast_squeeze(ast); // get an AST with compression optimizations
           cachedModels = pro.gen_code(ast); // compressed code here
         }
       });
    } else {
      res.send(cachedModels);
    }
  });
  return this;
};



exports.start = (function () {
  app.listen(app_config.port);
  console.log("Uptown is open on port %d", app.address().port);
  return this;
});



exports.migrate = (function (cb) {
  exports.db.query('SELECT "version" FROM "schema_migrations"', function (err, resp) {
    var migrations_run = 0;
    var executed = [];
    for (var rl = resp.rows.length; rl >0; rl--) {
      executed.push(resp.rows[rl-1].version);
    }
    var run_migrations = (function (torun) {
      var current = torun.pop();
      if (current) {
        if (executed.indexOf(current.id) < 0) {
          var sql = current.sql+" INSERT INTO schema_migrations VALUES ("+current.id+");";
          exports.db.query(sql, function (e, r) {
            if (e) {
              console.log("Could not migrate database. Error provided below.")
              console.log(e);
            } else {
              migrations_run++;
              run_migrations(torun);
            }
          });
        } else {
          run_migrations(torun);  
        }
      } else {
        if (migrations_run > 0)
          console.log("Migrations run: "+migrations_run);
        if (cb) {
          cb();
        }
      }
    });
    var migrations_dir = appRoot+"/db/migrations/";
    fs.readdir(migrations_dir, function (err, list) {
      var migrations = [];
      for (var li = 0, ll = list.length; li < ll; li++) {
        if (m = list[li].match(/(.*)\.sql/)) {
          migrations.push({
            id: m[1],
            sql: fs.readFileSync(migrations_dir+m[0]).toString()
          });
        }
      }
      run_migrations(migrations.sort((function (a, b) { return (parseInt(a.id) - parseInt(b.id)); })));
    });
  });
});