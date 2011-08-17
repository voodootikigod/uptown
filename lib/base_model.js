var Backbone = require("backbone");

module.exports.init = function (db, table_name) {
  var model = Backbone.Model.extend({
    destroy: function(options) {
      // AWS::S3::S3Object.delete(self.filename,"#{BUCKET_PREFIX}#{self.provisioned_service.node}")
      db.query("DELETE FROM "+table_name+" WHERE id = $1", [this.id], function (err, resp) {
        if (err && options["error"]) {
          options["error"](err);
        } else {
          if (typeof options["success"] == 'function') {
            options["success"](resp.rows);
          }
        }
      });
    },

    save: function (options) {
      if (validate(this.attributes)) {
        var columns = [], value_indicators = [], values = [];
        for (var attr in this.attributes) {
          columns.push(attr);
          value_indicators.push("$"+columns.length);
          values.push(this.attributes[attr]);
        }
        var ret = function(err, resp) {
          if (err && options["error"]) {
            options["error"](err);
          } else {
            if (typeof options["success"] == 'function') {
              options["success"](resp.rows);
            }
          }
        }
        if (this.id) {
          var set = "";
          for (var i =0, cl=columns.length; i< cl; i++ ){ set += columns[i]+" = $"+value_indicators[i]; }
          values.push(this.id);
          db.query("UPDATE "+table_name+" SET "+setter.join(", ")+" WHERE ID = $"+values.length, values, ret)
        } else {
          db.query("INSERT INTO "+table_name+" ("+columns.join(", ")+") VALUES ("+value_indicators.join(", ")+")", values, ret)
        }
      }

    }
  });
  
  model.find = function(id, cb) {
    db.query("select * from "+table_name+" where id = $1",[id], function (err, resp) {
      if (err || resp.rows.length ==0) {
        console.debug("Could not find with id: "+id);
        cb(null);
      } else {
        var m = new model(resp.rows[0]);
        cb(m);
      }
    });
  };
  return model;
}