/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');
var httpServer = require('http-server');

var plugin = require('../lib');
Pouch.plugin(plugin);

var chai = require('chai');
chai.use(require("chai-as-promised"));

var should = chai.should();
var Promise = require('bluebird');

var dbs;
if (process.browser) {
  dbs = 'testdb' + Math.random() +
    ',http://localhost:5984/testdb' + Math.round(Math.random() * 100000);
} else {
  dbs = process.env.TEST_DB;
}

dbs.split(',').forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

function getUrl(filename) {
  if (typeof process === 'undefined' || process.browser) {
    return '/test/dumps/' + filename;
  }
  return 'http://127.0.0.1:8001/test/dumps/' + filename;
}

function tests(dbName, dbType) {

  var db;
  var server;

  describe(dbType + ': basic dump', function () {
    this.timeout(30000);

    beforeEach(function () {
      this.timeout(30000);
      db = new Pouch(dbName);
      if (typeof process !== 'undefined'  && !process.browser) {
        server = httpServer.createServer();
        return new Promise(function (resolve) {
          server.listen(8001, resolve);
        });
      }
    });
    afterEach(function () {
      this.timeout(30000);
      return Pouch.destroy(dbName).then(function () {
        if (typeof process !== 'undefined'  && !process.browser) {
          server.close();
        }
      });
    });

    it('should load the dumpfile', function () {
      var url = getUrl('bloggr.txt');
      return db.load(url).then(function () {
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(12);
      });
    });

    it('should load the dumpfile, with a callback', function (done) {
      var url = getUrl('bloggr.txt');
      db.load(url, function () {
        db.info(function (err, info) {
          info.doc_count.should.equal(12);
          done();
        });
      });
    });

    it('handles 404s', function () {
      var url = getUrl('404.txt');
      return db.load(url).then(function () {
        throw new Error('should not be here');
      }, function (err) {
        should.exist(err);
      });
    });

    it('handles malformed', function () {
      var url = getUrl('malformed.txt');
      return db.load(url).then(function () {
        throw new Error('should not be here');
      }, function (err) {
        should.exist(err);
      });
    });
  });
}
