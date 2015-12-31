'use strict'

var expect = require('chai').expect
var _ = require('lodash')
var db = require('../lib/db')

var rest = require('./utils/rest')
var get = rest.get
var post = rest.post
var patch = rest.patch
var put = rest.put
var remove = rest.remove

describe('Entity Collections', () => {
  // clear used db collections
  beforeEach(function *() {
    yield db.clear('vm')
  })

  const payload = {
    name: 'My VM',
    id: 'very_unique'
  }

  describe('GET', () => {
    it('should return empty result for non-existing collection', function *() {
      let res = yield get({url: '/entities/vm'})
      expect(res.body).to.eql([])
    })

    it('should return 404 for non-existing entity', function *() {
      yield get({url: '/entities/vm/non_existing_id', status: 404})
    })

    it('should return previously created entity', function *() {
      yield post({url: '/entities/vm', payload})

      let res = yield get({url: '/entities/vm/very_unique'})
      expect(res.body).to.eql(payload)

      res = yield get({url: '/entities/vm'})
      expect(res.body).to.eql([payload])
    })

    it('should return entity created using integer id', function *() {
      let vm = {id: 123}
      yield post({url: '/entities/vm', payload: vm})

      let res = yield get({url: '/entities/vm/123'})
      expect(res.body).to.eql({id: '123'})
    })

    it('should return all documents from existing collection', function *() {
      const documents = []
      for (let i = 0; i < 5; i++) {
        var doc = {
          id: 'id_' + i,
          name: 'name_' + i
        }
        documents.push(doc)
        yield post({url: '/entities/vm', payload: doc})
      }
      let res = yield get({url: '/entities/vm'})
      expect(res.body).to.eql(documents)
    })

    it('should support nested documents', function *() {
      const vm = {
        id: '123',
        boot: [
          { device: 'cdrom' },
          { device: 'hdd' }
        ]
      }

      yield rest.setup({vm})

      let res = yield get({url: '/entities/vm/123'})
      expect(res.body).to.eql(vm)
    })
  })

  describe('PATCH', () => {
    it('should fail on non-existing document', function *() {
      yield patch({url: '/entities/vm/blurp', payload: {name: 'not very useful'}, status: 404})
    })

    it('should be able to patch single property', function *() {
      yield post({url: '/entities/vm', payload})
      yield patch({url: '/entities/vm/very_unique', payload: {name: 'New name'}})

      let res = yield get({url: '/entities/vm/very_unique'})
      expect(res.body.id).to.equal('very_unique')
      expect(res.body.name).to.equal('New name')
    })

    const PAYLOAD2 = {
      id: 'big',
      name: 'Bigger VM',
      status: 'up'
    }

    it('should be able to patch multiple properties', function *() {
      yield post({url: '/entities/vm', payload: PAYLOAD2})
      yield patch({url: '/entities/vm/big', payload: {name: 'Even Bigger VM', status: 'sadly DOWN'}})

      let res = yield get({url: '/entities/vm/big'})
      expect(res.body.id).to.equal('big')
      expect(res.body.name).to.equal('Even Bigger VM')
      expect(res.body.status).to.equal('sadly DOWN')
    })

    it('should return 400 when trying to patch document id', function *() {
      yield post({url: '/entities/vm', payload: PAYLOAD2})
      yield patch({url: '/entities/vm/big', payload: {id: 'new_id', name: 'whatever'}, status: 400})
    })

    it("'null' should remove given field from document", function *() {
      yield rest.setup({
        vm: {
          id: '1',
          name: 'foo',
          old_field: 42
        }
      })

      yield patch({url: '/entities/vm/1', payload: {old_field: null}})

      let res = yield get({url: '/entities/vm/1'})
      expect(res.body).to.eql({
        id: '1',
        name: 'foo'
      })
    })

    it('empty patch should result in no-op', function *() {
      yield rest.setup({vm: PAYLOAD2})
      yield patch({url: '/entities/vm/big', payload: {}})

      let res = yield get({url: '/entities/vm/big'})
      expect(res.body).to.eql(PAYLOAD2)
    })
  })

  describe('PUT', () => {
    it("should create document if doesn'n exist", function *() {
      yield put({url: '/entities/vm/very_unique', payload, status: 201})
      let res = yield get({url: '/entities/vm/very_unique'})
      expect(res.body).to.eql(payload)
    })

    it('should replace entire document', function *() {
      yield post({url: '/entities/vm', payload})
      yield put({url: '/entities/vm/very_unique', payload: {id: 'very_unique', status: 'image_locked'}})

      let res = yield get({url: '/entities/vm/very_unique'})
      expect(res.body.id).to.equal('very_unique')
      expect(res.body.name).to.not.exist
      expect(res.body.status).to.equal('image_locked')
    })

    it('should return 400 on attempt to replace document with different id', function *() {
      yield post({url: '/entities/vm', payload})
      yield put({url: '/entities/vm/very_unique', payload: {id: 'not_very_unique'}, status: 400})
    })

    it('should create entire collection', function *() {
      const documents = _.times(5, i => {
        return {'id': 'id_' + i, name: 'name_' + i}
      })
      yield put({url: '/entities/vm', payload: documents, status: 201})
      let res = yield get({url: '/entities/vm'})
      expect(res.body).to.eql(documents)
    })

    it('should validate id presence on collection replace', function *() {
      const documents = [{name: 'not enough'}]
      yield put({url: '/entities/vm', payload: documents, status: 400})
    })

    it('should validate id uniqueness on bulk create/update', function *() {
      const documents = [
        { id: 123 },
        { id: 123 }
      ]
      yield put({url: '/entities/vm', payload: documents, status: 400})
    })

    it('should return 200 on replace existing collection', function *() {
      const documents = _.times(5, i => {
        return {'id': 'id_' + i, name: 'name_' + i}
      })
      yield put({url: '/entities/vm', payload: documents, status: 201})
      yield put({url: '/entities/vm', payload: documents})
    })
  })

  describe('DELETE', () => {
    it('should safely delete non-existing collection', function *() {
      yield remove({url: '/entities/blurp'})
    })

    it('should delete existing document', function *() {
      yield post({url: '/entities/vm', payload})
      yield remove({url: '/entities/vm/very_unique'})
    })

    it('should return 404 on attempt to delete non-existing document', function *() {
      yield remove({url: '/entities/vm/blurp', status: 404})
    })
  })
})
