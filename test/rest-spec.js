'use strict';

var expect = require('chai').expect
  , _ = require('lodash')
  , db = require('../lib/db')

  , rest = require('./utils/rest')
  , get = rest.get
  , post = rest.post
  , patch = rest.patch
  , put = rest.put
  , remove = rest.remove
  ;

// clear used db collections
beforeEach(function *() {
  yield db.clear('vm');
});

describe('Entity Collections', () => {

  const PAYLOAD = {
    name: 'My VM',
    id: 'very_unique'
  };

  describe('GET', () => {

    it('should return empty result for non-existing collection', function *() {
      let res = yield get('/entities/vm');
      expect(res.body).to.eql([]);
    });

    it('should return 404 for non-existing entity', function *() {
      yield get('/entities/vm/non_existing_id', 404);
    });

    it('should return previously created entity', function *() {
      yield post('/entities/vm', PAYLOAD);

      let res = yield get('/entities/vm/very_unique');
      expect(res.body).to.eql(PAYLOAD);

      res = yield get('/entities/vm');
      expect(res.body).to.eql([PAYLOAD]);
    });

    it('should return all documents from existing collection', function *() {
      const documents = [];
      for (let i = 0; i < 5; i++) {
        var doc = {
          id: "id_" + i,
          name: "name_" + i
        };
        documents.push(doc);
        yield post('/entities/vm', doc);
      }
      let res = yield get('/entities/vm');
      expect(res.body).to.eql(documents);
    });

  });

  describe('PATCH', () => {

    it('should fail on non-existing document', function *() {
      yield patch('/entities/vm/blurp', {name: 'not very useful'}, 404);
    });

    it('should be able to patch single property', function *() {
      yield post('/entities/vm', PAYLOAD);
      yield patch('/entities/vm/very_unique', {name: 'New name'});

      let res = yield get('/entities/vm/very_unique');
      expect(res.body.id).to.equal('very_unique');
      expect(res.body.name).to.equal('New name');
    });

    const PAYLOAD2 = {
      id: 'big',
      name: 'Bigger VM',
      status: 'up'
    };

    it('should be able to patch multiple properties', function *() {
      yield post('/entities/vm', PAYLOAD2);
      yield patch('/entities/vm/big', {name: 'Even Bigger VM', status: 'sadly DOWN'});

      let res = yield get('/entities/vm/big');
      expect(res.body.id).to.equal('big');
      expect(res.body.name).to.equal('Even Bigger VM');
      expect(res.body.status).to.equal('sadly DOWN');
    });

    it('should return 400 when trying to patch document id', function *() {
      yield post('/entities/vm', PAYLOAD2);
      yield patch('/entities/vm/big', {id: "new_id", name: "whatever"}, 400);
    });

  });

  describe('PUT', () => {

    it('should create document if doesn\'n exist', function *() {
      yield put('/entities/vm/very_unique', PAYLOAD, 201);
      let res = yield get('/entities/vm/very_unique');
      expect(res.body).to.eql(PAYLOAD);
    });

    it('should replace entire document', function *() {
      yield post('/entities/vm', PAYLOAD);
      yield put('/entities/vm/very_unique', {id: 'very_unique', status: 'image_locked'});

      let res = yield get('/entities/vm/very_unique');
      expect(res.body.id).to.equal('very_unique');
      expect(res.body.name).to.not.exist;
      expect(res.body.status).to.equal('image_locked');
    });

    it('should return 400 on attempt to replace document with different id', function *() {
      yield post('/entities/vm', PAYLOAD);
      yield put('/entities/vm/very_unique', {id: 'not_very_unique'}, 400);
    });

    it('should create entire collection', function *() {
      const documents = _.times(5, i => {
        return {'id': "id_" + i, name: "name_" + i};
      });
      yield put('/entities/vm', documents, 201);
      let res = yield get('/entities/vm');
      expect(res.body).to.eql(documents);
    });

    it('should validate id presence on collection replace', function *() {
      const documents = [{name: "not enough"}];
      yield put('/entities/vm', documents, 400);
    });

    it('should return 200 on replace existing collection', function *() {
      const documents = _.times(5, i => {
        return {'id': "id_" + i, name: "name_" + i};
      });
      yield put('/entities/vm', documents, 201);
      yield put('/entities/vm', documents);
    });
  });

  describe('DELETE', () => {

    it('should safely delete non-existing collection', function *() {
      yield remove('/entities/blurp');
    });

    it('should delete existing document', function *() {
      yield post('/entities/vm', PAYLOAD);
      yield remove('/entities/vm/very_unique');
    });

    it('should return 404 on attempt to delete non-existing document', function *() {
      yield remove('/entities/vm/blurp', 404);
    });
  });
});
