'use strict';

var utils = require('./utils');
var ajax = require('pouchdb-ajax');
var Checkpointer = require('./checkpointer');

exports.load = utils.toPromise(function (url, opts, callback) {
  var db = this;

  if (typeof opts === 'function') {
    callback = opts;
    opts = {};
  }

  var ajaxOptions = { url: url, json: false };
  if (opts.ajax) {
    ajaxOptions = utils.extend(true, ajaxOptions, opts.ajax);
  }

  ajax(ajaxOptions, function (err, data) {
    if (err) {
      return callback(err);
    }

    var docs = [];
    var lastSeq = 0;
    try {
      data.split('\n').forEach(function (line) {
        if (!line) {
          return;
        }
        line = JSON.parse(line);
        if (line.docs) {
          docs = docs.concat(line.docs);
        }
        if (line.seq) {
          lastSeq = line.seq;
        }
      });
    } catch (err) {
      return callback(err);
    }

    db.bulkDocs({docs: docs, new_edits: false}, function (err) {
      /* istanbul ignore next */
      if (err) {
        return callback(err);
      }
      if (!opts.proxy) {
        return callback();
      }

      db.info().then(function (info) {
        var src = new db.constructor(opts.proxy,
          utils.extend(true, {}, db.__opts, opts));
        var target = new db.constructor(info.db_name,
          utils.extend(true, {}, db.__opts, opts));
        var replIdOpts = {};
        if (opts.filter) {
          replIdOpts.filter = opts.filter;
        }

        return utils.genReplicationId(src, target, replIdOpts).then(function (replId) {
          var state = {
            cancelled: false
          };
          var checkpointer = new Checkpointer(src,  target, replId, state);
          return checkpointer.writeCheckpoint(lastSeq);
        });
      }).then(function () {
        callback();
      }, callback);
    });
  });
});

/* istanbul ignore next */
if (typeof window !== 'undefined' && window.PouchDB) {
  window.PouchDB.plugin(exports);
}
