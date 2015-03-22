'use strict';

var expect = require('chai').expect
  , diff = require('../lib/entities/diff')
  ;

describe('Diff', () => {

  describe('Object', () => {

    it('should return empty diff on equal objects', () => {
      var obj = {id: 42, data: 'foo'};
      expect(diff.object(obj, obj)).to.eql({});
    });

    it('should return diff on different objects', () => {
      var original = {id: 42, data: 'xyz'};
      var updated = {id: 42, data: 'abc', new_field: true};
      expect(diff.object(original, updated)).to.eql({data: 'abc', new_field: true});
    });
  });

  describe('Array', () => {

    it('should return empty diff on same arrays', () => {
      var objs = [
        {id: 1, bar: 'foo'},
        {id: 2, baz: 'qux'}
      ];
      expect(diff.array(objs, objs)).to.eql({
        created: [],
        updated: [],
        deleted: []
      });
    });

    it('should return id of newly created entity', () => {
      var obj = {id: 'lol', data: 'bar'};
      var orig = [];
      var modified = [obj];
      expect(diff.array(orig, modified)).to.eql({
        created: [obj.id],
        updated: [],
        deleted: []
      });
    });

    it('should return id of deleted entity', () => {
      var obj = {id: 'lol', data: 'bar'};
      var orig = [obj];
      var modified = [];
      expect(diff.array(orig, modified)).to.eql({
        created: [],
        updated: [],
        deleted: [obj.id]
      });
    });

    it('should return object diff of changed object', () => {
      var orig = [{id: 'lol', data: 'bar', old_field: 19}];
      var modified = [{id: 'lol', data: 'foo', new_field: 42}];
      expect(diff.array(orig, modified)).to.eql({
        created: [],
        updated: [{id: 'lol', 'data': 'foo', new_field: 42}],
        deleted: []
      });
    });
  });
});
