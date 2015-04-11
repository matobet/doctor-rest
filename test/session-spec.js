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

describe('Session Collection', () => {

  beforeEach(function *() {
    yield db.clear('_session');
  });

  describe('GET', () => {

    it('should initially return empty collection', function *() {
      let res = yield get({url: '/sessions'});
      expect(res.body).to.eql([]);
    });

    it('should return 404 for non-existing session', function *() {
      yield get({url: '/sessions/42', status: 404});
    });

    it('should return previously created session', function *() {
      yield post({url: '/sessions', payload: {id: 1}});

      let res = yield get({url: '/sessions/1'});
      expect(res.body.id).to.equal('1');
    });

    it('should return all existing sessions', function *() {
      const sessions = [
        {id: 1},
        {id: 2},
        {id: 3},
        {id: 4}
      ];
      yield put({url: '/sessions', payload: sessions});

      let res = yield get({url: '/sessions'});
      expect(res.body).to.eql(sessions.map(session => {
        session.id = session.id.toString();
        return session;
      }));
    });
  });

  describe('PATCH', () => {

  });

  describe('PUT', () => {

    it('should create session if it doesn\'t exist', function *() {
      yield put({url: '/sessions/43', payload: {id: 43}, status: 201});
      let res = yield get({url: '/sessions/43'});
      expect(res.body.id).to.eql('43');
    });
  });

  describe('DELETE', () => {

    it('should safely delete empty session collection', function *() {
      yield remove({url: '/sessions'});
    });

    it('should safely delete non-existing session', function *() {
      yield remove({url: '/sessions/42'});
    });

    it('should delete existing session', function *() {
      yield post({url: '/sessions', payload: {id: 1}});
      yield remove({url: '/sessions/1'});
      yield get({url: '/sessions/1', status: 404});
    });

    it('should delete all existing sesisons', function *() {
      for (let i = 0; i < 3; i++) {
        yield post({url: '/sessions', payload: {id: i}});
      }
      yield remove({url: '/sessions'});
      let res = yield get({url: '/sessions'});
      expect(res.body).to.eql([]);
    });
  });
});
