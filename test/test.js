'use strict';

var expect = require('chai').expect
  , app = require('../')
  , db = require('../db')
  , request = require('co-supertest').agent(app.listen())
  ;

// clear used db collections
beforeEach(function *() {
  yield db.clear('vm');
});

function get(url) {
  return request.get(url).expect(200).type('json').end();
}

describe('Entity Collections', () => {

  it('should return empty result for non-existing collection', function *() {
    let res = yield get('/entities/vm');
    expect(res.body).to.eql([]);
  });

  it('should return 404 for non-existing entity', function *() {
    yield request.get('/entities/vm/non_existing_id').expect(404).end();
  });

  it('should return previously created entity', function *() {
    const payload = {
      name: "My VM",
      id: "this_looks_unique_enough"
    };
    yield request.post('/entities/vm').send(payload).expect(201).end();
    let res = yield get('/entities/vm/this_looks_unique_enough');
    expect(res.body).to.eql(payload);
  });
});
