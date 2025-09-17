/*jshint expr:true */
'use strict';

var Pouch = require('pouchdb-memory');
var httpServer = require('http-server');

var plugin = require('../lib');
Pouch.plugin(plugin);

var chai = require('chai');
chai.use(require("chai-as-promised"));

var should = chai.should();
var Promise = require('pouchdb-promise');

var dbs = ['testdb', 'http://localhost:5984/testdb'];

dbs.forEach(function (db) {
  var dbType = /^http/.test(db) ? 'http' : 'local';
  tests(db, dbType);
});

clientServerTests();

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
      return db.destroy().then(function () {
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

    it('should load the dumpfile with ajax opts', function () {
      var url = getUrl('bloggr.txt');
      return db.load(url, {ajax: {timeout: 30000}}).then(function () {
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(12);
      });
    });

    it('should load the dumpfile 2', function () {
      var url = getUrl('bloggr2.txt');
      return db.load(url).then(function () {
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(12);
      });
    });

    it('should load the dumpfile 3', function () {
      var urls = [];
      for (var i = 0; i < 10; i++) {
        urls.push(getUrl('bloggr-split/bloggr_0000000' + i + '.txt'));
      }
      return Promise.all(urls.map(function (url) {
        return db.load(url);
      })).then(function () {
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


function clientServerTests(dbName) {

  var db;
  var remote;
  var server;

  describe('client-server: basic', function () {
    this.timeout(30000);

    beforeEach(function () {
      this.timeout(30000);
      db = new Pouch(dbs[0]);
      remote = new Pouch(dbs[1]);
      if (typeof process !== 'undefined' && !process.browser) {
        server = httpServer.createServer();
        return new Promise(function (resolve) {
          server.listen(8001, resolve);
        });
      }
    });
    afterEach(function () {
      this.timeout(30000);
      return db.destroy().then(function () {
        return remote.destroy();
      }).then(function () {
        if (typeof process !== 'undefined'  && !process.browser) {
          server.close();
        }
      });
    });

    it('should load the dumpfile', function () {
      var url = getUrl('bloggr.txt');
      return db.load(url).then(function () {
        return remote.load(url);
      }).then(function () {
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(12);
        return remote.info();
      }).then(function (info) {
        info.doc_count.should.equal(12);
      });
    });

    it('sets a checkpoint so that replication from the proxy resumes from the last seq in the dump file', function () {
      var url = getUrl('foobar.txt');

      return db.load(url, {proxy: dbs[1]}).then(function() {
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(3);
        return plugin.getReplicationForDb(db, {proxy: dbs[1]});
      }).then(function (repl) {
        return Promise.all([
          db.get(repl.checkpoint),
          remote.get(repl.checkpoint)
        ]);
      }).then(function (docs) {
        for (var doc of docs) {
          doc.history.should.deep.equal([
            { last_seq: '3-g1AAAABPeJzLYWBgYMxgTmEQTM4vTc5ISXLIyU9OzMnILy7JAUoxJTLksTD8B4KsDOZE5lygELu5maFFkqUBNi1ZAJQ9GHo' }
          ]);
          doc.last_seq.should.equal('3-g1AAAABPeJzLYWBgYMxgTmEQTM4vTc5ISXLIyU9OzMnILy7JAUoxJTLksTD8B4KsDOZE5lygELu5maFFkqUBNi1ZAJQ9GHo');
        }
      });
    });

    it('only transitions replication when db has adapter', function () {
      var adapter = (process.browser ? 'websql' : 'leveldb');
      var db = new Pouch(dbs[0], { adapter: adapter });
      if (!db.adapter) {
        it.skip('websql not supported by this browser');
        return;
      }
      var url = getUrl('foobar.txt');

      return db.load(url, {proxy: dbs[1]}).then(function () {
        return db.info();
      }).then(function (info) {
        info.doc_count.should.equal(3);
        return plugin.getReplicationForDb(db, {proxy: dbs[1]});
      }).then(function (repl) {
        return Promise.all([
          db.get(repl.checkpoint),
          remote.get(repl.checkpoint)
        ]);
      }).then(function (docs) {
        for (var doc of docs) {
          doc.history.should.deep.equal([
            { last_seq: '3-g1AAAABPeJzLYWBgYMxgTmEQTM4vTc5ISXLIyU9OzMnILy7JAUoxJTLksTD8B4KsDOZE5lygELu5maFFkqUBNi1ZAJQ9GHo' }
          ]);
          doc.last_seq.should.equal('3-g1AAAABPeJzLYWBgYMxgTmEQTM4vTc5ISXLIyU9OzMnILy7JAUoxJTLksTD8B4KsDOZE5lygELu5maFFkqUBNi1ZAJQ9GHo');
        }
      });
    });

    function countUnique (replications) {
      var unique = {};
      var count = 0;

      for (var repl of replications) {
        if (!(repl.checkpoint in unique)) {
          unique[repl.checkpoint] = true;
          count++;
        }
      }
      return count;
    }

    it('gets a consistent replication checkpoint ID', function () {
      return Promise.all([
        plugin.getReplicationForDb(db, {proxy: dbs[1]}),
        plugin.getReplicationForDb(db, {proxy: dbs[1]})
      ]).then(function (replications) {
        countUnique(replications).should.equal(1);
      });
    });

    it('gets different checkpoint IDs when using different options', function () {
      var filter = function (doc) { return !!doc; };
      var query_params = {batch_size: 10};

      return Promise.all([
        plugin.getReplicationForDb(db, {proxy: dbs[1]}),
        plugin.getReplicationForDb(db, {proxy: dbs[1], filter: filter}),
        plugin.getReplicationForDb(db, {proxy: dbs[1], filter: '_view', view: 'mydesign/view'}),
        plugin.getReplicationForDb(db, {proxy: dbs[1], filter: '_view', view: 'mydesign/another'})
      ]).then(function (replications) {
        countUnique(replications).should.equal(4);
      });
    });

    it('loads from a string', function () {
      var str = '{"version":"1.0.0","db_type":"http","start_time":"2014-11-02T18:57:26.169Z",' +
        '"db_info":{"db_name":"foobar","doc_count":2,"doc_del_count":1,"update_seq":4,' +
        '"purge_seq":0,"compact_running":false,"disk_size":16479,"data_size":419,"instance' +
        '_start_time":"1414953985168119","disk_format_version":6,"committed_update_seq":4,' +
        '"host":"http://localhost:5984/foobar/","auto_compaction":false}}\n{"docs":[{"_id"' +
        ':"foo","_rev":"1-x"}]}\n{"seq":1}\n{"docs":[{"_id":"bar","_rev":"1-y"}]}\n{"seq":2}' +
        '\n{"docs":[{"_id": "baz", "_rev": "1-w"}]}\n{"seq":3}';

      return db.load(str).then(function () {
        return db.allDocs();
      }).then(function (res) {
        res.should.deep.equal({
          "total_rows": 3,
          "offset": 0,
          "rows": [
            {
              "id": "bar",
              "key": "bar",
              "value": {
                "rev": "1-y"
              }
            },
            {
              "id": "baz",
              "key": "baz",
              "value": {
                "rev": "1-w"
              }
            },
            {
              "id": "foo",
              "key": "foo",
              "value": {
                "rev": "1-x"
              }
            }
          ]
        });
      });
    });
  });
}
