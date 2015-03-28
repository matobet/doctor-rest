'use strict';

var expect = require('chai').expect
  , db = require('../lib/db')
  , rest = require('./utils/rest')
  , get = rest.get
  , post = rest.post
  , patch = rest.patch
  , put = rest.put
  , remove = rest.remove
  ;

describe('Query Language', () => {

  beforeEach(function *() {
    yield db.clear('vm', 'cluster');
  });

  it('should enable to query selected fields', function *() {
    const payload = {
      id: 123,
      a: 'foo',
      b: 'bar',
      c: 'baz'
    };
    yield post({url: '/entities/vm', payload});

    let res = yield get({url: '/entities/vm/123', payload: {select: ['a', 'b']}});
    expect(res.body.a).to.equal('foo');
    expect(res.body.b).to.equal('bar');
    expect(res.body.c).to.be.undefined;
  });

  it('should return filtered query for entire collection', function *() {
    const vms = [
      {id: 1, name: 'vm_1', status: 'up'},
      {id: 2, name: 'vm_2', status: 'up'},
      {id: 3, name: 'vm_3', status: 'down'},
      {id: 4, name: 'vm_4', status: 'up'},
      {id: 5, name: 'vm_5', status: 'migrating'}
    ];
    yield put({url: '/entities/vm', payload: vms, status: 201});

    let res = yield get({url: '/entities/vm', payload: {select: ['name', 'status']}});
    res.body.forEach((vm, i) => {
      expect(vm.id).to.be.undefined;
      expect(vm.name).to.equal(vms[i].name);
      expect(vm.status).to.equal(vms[i].status);
    });
  });

  it('should enable to query fields of linked documents', function *() {
    const vm = {
      id: 123,
      name: 'my_vm',
      status: 'up',
      _links: {cluster: 456}
    };
    const cluster = {
      id: 456,
      name: 'my_cluster'
    };

    yield post({url: '/entities/vm', payload: vm});
    yield post({url: '/entities/cluster', payload: cluster});

    let res = yield get({url: '/entities/vm/123', payload: {select: ['name', 'status', '@cluster.name']}});
    console.dir(res.body);
    expect(res.body.name).to.equal(vm.name);
    expect(res.body.status).to.equal(vm.status);
    expect(res.body['@cluster.name']).to.equal(cluster.name);
  });

  it('should support embedding of linked objects', function *() {
    const vm = {
      id: 123,
      name: 'my_vm',
      status: 'up',
      _links: {cluster: 456}
    };
    const cluster = {
      id: 456,
      name: 'my_cluster'
    };

    yield post({url: '/entities/vm', payload: vm});
    yield post({url: '/entities/cluster', payload: cluster});

    let res = yield get({url: '/entities/vm/123', payload: {select: ['name', 'status', '@cluster']}});
    expect(res.body.name).to.equal(vm.name);
    expect(res.body.status).to.equal(vm.status);
    expect(res.body['@cluster']).to.be.an('object');
    expect(res.body['@cluster'].id).to.equal(cluster.id.toString());
    expect(res.body['@cluster'].name).to.equal(cluster.name);
  });

  it('should enable to query fields of linked documents for entire collections', function *() {
    const vms = [{
      id: 123,
      name: 'my_vm',
      status: 'up',
      _links: {cluster: 456}
    }, {
      id: 124,
      name: 'my_vm2',
      status: 'down',
      _links: {cluster: 457}
    }];

    const clusters = [{
      id: 456,
      name: 'my_cluster'
    }, {
      id: 457,
      name: 'my_other_cluster'
    }];

    yield put({url: '/entities/vm', payload: vms, status: 201});
    yield put({url: '/entities/cluster', payload: clusters, status: 201});

    let res = yield get({url: '/entities/vm', payload: {select: ['name', 'status', '@cluster']}});

    expect(res.body).to.have.length(2);
    for (let i = 0; i < 2; i++) {
      expect(res.body[i].name).to.equal(vms[i].name);
      expect(res.body[i].status).to.equal(vms[i].status);
      expect(res.body[i]['@cluster']).to.be.an('object');
      expect(res.body[i]['@cluster'].id).to.equal(clusters[i].id.toString());
      expect(res.body[i]['@cluster'].name).to.equal(clusters[i].name);
    }
  });
});
