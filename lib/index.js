'use strict';

var utils = require('./utils');
var ajax = require('./ajax');

exports.load = utils.toPromise(function (url, callback) {
  var db = this;

  ajax({url: url, json: false}, function (err, data) {
    if (err) {
      return callback(err);
    }

    var docs = [];
    try {
      data.split('\n').forEach(function (line) {
        if (!line) {
          return;
        }
        line = JSON.parse(line);
        if (line.docs) {
          docs = docs.concat(line.docs);
        }
      });
    } catch (err) {
      return callback(err);
    }

    db.bulkDocs({docs: docs, new_edits: false}, callback);
  });
});

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
