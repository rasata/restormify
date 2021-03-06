/* jshint unused: false */
/* global describe, before, beforeEach, afterEach, after, it, xdescribe, xit */
'use strict';

var fs = require('fs');
var restify = require('restify');
var orm = require('orm');
var assert = require('assert');

var restormify = require('../');
var dbProps = {host: 'index', protocol: 'sqlite'};

var server = restify.createServer();
var client;
var db;
var baz;
server.use(restify.bodyParser());
server.use(restify.queryParser());

describe('basic tests', function(){
  before(function(done){
    orm.connect(dbProps, function(err, database){
      if(err){
        done(err);
      }
      db = database;

      restormify({
        db: db,
        server: server
      }, function(){
        baz = db.define('baz', {
          name: String,
          email: String,
          foo: {type: 'boolean', serverOnly: true},
          deleted: {type: 'boolean', serverOnly: true}
        });
        done();
      });
    });

    client = restify.createJsonClient({
      url: 'http://localhost:1234/api'
    });
  });

  describe('api', function(){
    beforeEach(function(done){
      server.listen(1234);
      baz.sync(done);
    });

    it('baz should return nothing on a get', function(done){
      client.get('/api/baz', function(err, req, res, obj){
        assert.ok(!err, 'no errors');
        assert.equal(res.statusCode, 200, 'received a 200');
        assert.equal(obj.length, 0, 'no data recieved');
        done();
      });
    });

    it('creates a user', function(done){
      var name = {name: 'todd', email: 't@t.com'};
      client.post('/api/baz', name, function(err, req, res, obj){
        assert.ok(!err, 'no errors');
        assert.equal(res.statusCode, 201, 'received a 201');
        assert.equal(obj.name, name.name, 'accepted data');
        assert.equal(obj.email, name.email, 'accepted data');
        assert.ok(!obj.foo, 'server only data not sent');
        assert.ok(!obj.deleted, 'server only data not sent');
        assert.equal(obj._links.self.type, 'baz', 'has correct type');
        assert.equal(obj._links.self.href, '/api/baz/'+obj.id, 'matches self href');
        done();
      });
    });

    it('returns a 404 for bad content', function(done){
      client.get('/api/faaaa', function(err, req, res){
        assert.equal(res.statusCode, 404, 'missing content');
        done();
      });
    });

    it('returns a 404 for a bad id', function(done){
      client.get('/api/baz/askjasd', function(err, req, res){
        assert.equal(res.statusCode, 404, 'missing content');
        done();
      });
    });

    it('returns 404 for a missing id', function(done){
      client.get('/api/baz/123', function(err, req, res){
        assert.equal(res.statusCode, 404, 'missing content');
        done();
      });
    });

    it('returns a created user', function(done){
      var name = {name: 'foo bar'};

      baz.create(name, function(err, bazName){
        client.get('/api/baz/'+bazName.id, function(err, req, res, obj){
          assert.ok(!err, 'no errors');
          assert.equal(res.statusCode, 200, 'received a 200');
          assert.equal(obj.name, bazName.name, 'returned correct user data');
          assert.equal(obj.id, bazName.id, 'returned correct id');
          assert.equal(obj._links.self.type, 'baz', 'has correct type');
          assert.equal(obj._links.self.href, '/api/baz/'+bazName.id, 'matches self href');
          done();
        });
      });
    });

    it('returns all created users', function(done){
      var name = {name: 'foo bar'};

      baz.create(name, function(err, bazName){
        client.get('/api/baz/', function(err, req, res, obj){
          assert.ok(!err, 'no errors');
          assert.equal(res.statusCode, 200, 'received a 200');
          assert.ok(Array.isArray(obj), 'returned an array');
          assert.equal(obj[0].name, bazName.name, 'returned correct user data');
          assert.equal(obj[0].id, bazName.id, 'returned correct id');
          assert.equal(obj[0]._links.self.type, 'baz', 'has correct type');
          assert.equal(obj[0]._links.self.href, '/api/baz/'+bazName.id, 'matches self href');
          done();
        });
      });
    });


    it('updating a user (PUT)', function(done){
      var name = {name: 'foo bar'};

      baz.create(name, function(err, bazName){
        client.put('/api/baz/'+bazName.id, {name: 'baz wee', email: 't@t.com'}, function(err, req, res, obj){
          assert.ok(!err, 'no errors');
          assert.equal(res.statusCode, 200, 'received a 200');
          assert.equal(obj.name, 'baz wee', 'updated the user');
          assert.equal(obj.email, 't@t.com', 'updated the user');
          assert.equal(obj._links.self.type, 'baz', 'has correct type');
          assert.equal(obj._links.self.href, '/api/baz/'+bazName.id, 'matches self href');
          done();
        });
      });
    });

    it('updating a user (PATCH)', function(done){
      var name = {name: 'foo bar', email: 't@t.com'};

      baz.create(name, function(err, bazName){
        client.patch('/api/baz/'+bazName.id, {name: 'baz wee'}, function(err, req, res, obj){
          assert.ok(!err, 'no errors');
          assert.equal(res.statusCode, 200, 'received a 200');
          assert.equal(obj.name, 'baz wee', 'updated the user');
          assert.equal(obj.email, 't@t.com', 'did not update an unset prop');
          assert.equal(obj._links.self.type, 'baz', 'has correct type');
          assert.equal(obj._links.self.href, '/api/baz/'+bazName.id, 'matches self href');
          done();
        });
      });
    });

    afterEach(function(done){
      server.close();
      db.drop(done);
    });
  });

  after(function(done){
    db.close();
    fs.unlink(dbProps.host, function(){
      done();
    });
  });
});
