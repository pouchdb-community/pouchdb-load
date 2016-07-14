PouchDB Load
=====

[![Build Status](https://travis-ci.org/nolanlawson/pouchdb-load.svg)](https://travis-ci.org/nolanlawson/pouchdb-load)

Client-side tools for loading a dump from a CouchDB/PouchDB database.

For dumping, check out [pouchdb-dump-cli](https://github.com/nolanlawson/pouchdb-dump-cli) to dump from the command line, or [pouchdb-replication-stream](https://github.com/nolanlawson/pouchdb-replication-stream) to dump from within your Node.js application.

This method is typically much faster than standard replication, because it uses fewer HTTP requests. So it's a great way to quickly load an initial state for your database. 

Usage
--------

To use this plugin, include it after `pouchdb.js` in your HTML page:

```html
<script src="pouchdb.js"></script>
<script src="pouchdb.load.js"></script>
```

Or install from Bower:

```
bower install pouchdb-load
```

Or to use it in Node.js, just npm install it:

```
npm install pouchdb-load
```

And then attach it to the `PouchDB` object:

```js
var PouchDB = require('pouchdb');
PouchDB.plugin(require('pouchdb-load'));
```

API
----------

This plugin exposes a single method on your database, `load()`:

### db.load(urlOrString [, options] [, callback])

This method returns a Promise or calls your callback, if you prefer the callback style.

You can give it a URL pointing to a single dump file:

```js
var db = new PouchDB('my-awesome-db');
db.load('http://example.com/my-dump-file.txt').then(function () {
  // done loading!
}).catch(function (err) {
  // HTTP error or something like that
});
```

This will read the entire file into memory, though. Assuming you used the `--split` option when you dumped your database, you can also load multiple files by using `Promise.all`. For instance, let's say you had 5 files, named 
`'my-dump-file_00000000.txt'` through `'my-dump-file_00000004.txt'`. You would do:

```js
var dumpFiles = [
  'my-dump-file_00000000.txt',
  'my-dump-file_00000001.txt',
  'my-dump-file_00000002.txt',
  'my-dump-file_00000003.txt',
  'my-dump-file_00000004.txt',
];

PouchDB.utils.Promise.all(dumpFiles.map(function (dumpFile) {
  return db.load('http://example.com/' + dumpFile);
})).then(function () {
  // done loading!
}).catch(function (err) {
  // HTTP error or something like that
});
```

This will load them all simultaneously. You can also load them all in a series:

```js
var series = PouchDB.utils.Promise.resolve();

dumpFiles.forEach(function (dumpFile) {
  series = series.then(function () {
    return db.load('http://example.com/' + dumpFile);
  });
});

series.then(function () {
  // done loading!
}).catch(function (err) {
  // HTTP error or something like that
});
```

#### Loading from a string rather than a URL

Instead of a URL, you can also load directly from a string. This is useful if you used [`pouchdb-replication-stream`](https://github.com/nolanlawson/pouchdb-replication-stream) to dump directly to a string, or if you are loading your dumpfile through some other mechanism than ajax (websockets, WebRTC, etc.):

```js
var db = new PouchDB('my-awesome-db');
var myDumpedString = getDumpedStringSomehow();

db.load(myDumpedString).then(function () {
  // done loading!
}).catch(function (err) {
  // any possible errors
});
```

#### Handoff to regular replication

Normally the `load()` operation doesn't write any *checkpoints*, meaning that if you switch from `load()` to normal replication, then it will start reading all the changes from the remote CouchDB from the beginning of time. This is slow, so to avoid it, use the `proxy` option:

```js
db.load('http://example.com/my-dump-file.txt', {
  proxy: 'http://mysite.com/mydb'
}).then(function () {
  // done loading! handoff to regular replication
  return db.replicate.from('http://mysite.com/mydb');
}).catch(function (err) {
  // HTTP error or something like that
});
```

This will tell the plugin that the dumpfile `'http://example.com/my-dump-file.txt'` is just a proxy for `'http://mysite.com/mydb'`. So when you pick up replication again, it won't start from 0 but rather will start from the last checkpoint reported by the dump file.

If your replication also involves a `filter` function, you should pass that in as `filter` as well (so that the correct checkpoint can be written):

```js
function filterFun(doc) {
  /* your cool filter function here */ 
}

db.load('http://example.com/my-dump-file.txt', {
  proxy: 'http://mysite.com/mydb',
  filter: filterFun
}).then(function () {
  // done loading! handoff to regular replication
  return db.replicate.from('http://mysite.com/mydb', {filter: filterFun});
}).catch(function (err) {
  // HTTP error or something like that
});
```

The same goes for `view` and `query_params`.

#### Custom ajax options

You can also include ajax options in the `options`:

```js
db.load('myfile.txt', {
  ajax: {
    timeout: 30000
  }
});
```

The ajax options themselves are described in [the PouchDB documentation](http://pouchdb.com/api.html#create_database).

#### Live demo

[NPM Browser](http://npm-browser.com) uses pouchdb-load to load a bunch of static files from Amazon S3, which is how it's able to replicate all of NPM so quickly. Here is [the relevant code](https://github.com/pouchdb/npm-browser/blob/c16ada690be45df0af80336aedd69f308d3f105b/scripts/services/pouch-service.js#L72-L108), which does the dump, checkpointing, and handoff to regular replication (as described above).

#### Notes on idempotency

The `load()` operation is *idempotent*, meaning that you can run it over and over again, and it won't create duplicate documents in the target database.

However, it's inefficient to run the `load()` every time the user starts your app. So if you'd like, you can use "local documents" to remember whether or not this database has already been loaded:

```js
db.get('_local/initial_load_complete').catch(function (err) {
  if (err.status !== 404) { // 404 means not found
    throw err;
  }
  db.load(/* ... */).then(function () {
    return db.put({_id: '_local/initial_load_complete'});
  });
}).then(function () {
  // at this point, we are sure that 
  // initial replication is complete
}).catch(function (err) {
  // handle unexpected errors
});
```

This code first checks for a local document called `'_local/initial_load_complete'`. If the document is not found, then it calls `dump()`, then puts the local doc to mark that it's complete. Else it finishes.

(*Local documents* are non-replicated PouchDB/CouchDB documents that are useful for storing local state or configuration files. To create a local document, you simply prefix `'_local/'` to the document `_id`.)

Building
----
    npm install
    npm run build

Testing
----

### In Node

This will run the tests in Node using LevelDB:

    npm test
    
You can also check for 100% code coverage using:

    npm run coverage

### In the browser

    npm run test-local

To test in your own browser, or

    npm run test-browser

To test in PhantomJS.
