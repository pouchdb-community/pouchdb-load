/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb');

var plugin = require('../lib');
Pouch.plugin(plugin);

var chai = require('chai');
chai.use(require("chai-as-promised"));

chai.should(); // var should = chai.should();
require('bluebird'); // var Promise = require('bluebird');

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

function tests(dbName, dbType) {

  var db;

  beforeEach(function () {
    this.timeout(30000);
    db = new Pouch(dbName);
    return db;
  });
  afterEach(function () {
    this.timeout(30000);
    return Pouch.destroy(dbName);
  });
  describe(dbType + ': basic dump', function () {
    this.timeout(30000);

    it('should load the dumpfile', function () {
      return db.load('/test/dumps/bloggr.txt').then(function () {
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(10);
      });
    });
  });
}
