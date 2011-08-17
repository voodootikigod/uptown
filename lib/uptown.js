var app_env, app_config;

var connect     =   require("connect"),
    express     =   require('express'),
    login       =   require('login').postgresql,
    fs          =   require("fs")
    
var app = exports.app = express.createServer();
var appRoot;
exports.init = function (approot, options) {
	// Ensure sane directory structure.
	var listing = fs.readdirSync(approot);
	var expectedDirs = ["controllers", "models", "db", "public", "views"];
	var expectedCount = 0;
	for (var l = listing.length-1; 0 <= l; l--) { if (expectedDirs.indexOf(listing[l]) >=0) { expectedCount++; } }
	if (expectedCount != expectedDirs.length) {
		throw new Exception("The application root does not appear to be a valid Uptown app. Please run uptown generate <project_name> again.");
	} else {
		appRoot = approot;
	}
	// populate environment and configuration
	app_env     		=   (process.env["NODE_ENV"] || "development");
	app_config  		=   require(appRoot+"/config")[app_env];

	// load database connection
	exports.db			=	require(__dirname+"/db")(app_config).connection;
	// Load server side model definitions
	exports.models      =   require(__dirname+"/models")(appRoot, exports.db);
    exports.postmark    =   require("postmark")(app_config.postmark);
}

exports.run = (function (options) {
  if (typeof options == 'undefined')
    options = {};
  // Configuration
  app.configure(function(){
    app.set('views', appRoot + '/views');
    app.set('view engine', 'jade');
    app.use(express.cookieParser());
    app.use((options["sessionHandler"]) ? options["sessionHandler"] : express.session({ store: new (require('connect-redis')(connect))(), maxAge: (24*60*60*1000), secret: "yt5nFY0Z07bHxpbyUzR7HSLSLp7XEAqo1K2GdPuGW3X8mMowNc" }));
  
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.use(express.static(appRoot + '/public'));
  });

  app.configure('development', function(){
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
  });

  app.configure('production', function(){
    app.use(express.errorHandler()); 
  });

  var dynHelpers = {
      current_user: function (req) {return req.user; }
  };

  if (options["dynamicHelpers"]) {
    for (var helper in options["dynamicHelpers"]) {
      dynHelpers[helper] = options["dynamicHelpers"][helper];
    }
  }
  app.dynamicHelpers(dynHelpers);

  var helpers = {
    is_prod: function () { return (["staging", "production"].indexOf(app_env) >= 0); }
  };
  if (options["helpers"]) {
    for (var helper in options["helpers"]) {
      helpers[helper] = options["helpers"][helper];
    }
  }
  app.helpers(helpers);


  var auth = login(app, exports.db, postmark, { 
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

  app.listen(app_config.port);
  console.log("Uptown is open on port %d", app.address().port);

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