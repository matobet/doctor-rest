'use strict';

var expect = require('chai').expect
  , db = require('../lib/db')
  , rest = require('./utils/rest')
  , get = rest.get
  ;

describe('Query Language', () => {

  beforeEach(function *() {
    yield db.clear('vm', 'cluster', 'data_center', 'system', 'disk', 'storage');
  });

  it('should enable to query selected fields', function *() {
    yield rest.setup({vm: {
      id: 123,
      a: 'foo',
      b: 'bar',
      c: 'baz'
    }});

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
    yield rest.setup({vm: vms});

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

    yield rest.setup({vm, cluster});

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

    yield rest.setup({vm, cluster});

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

    yield rest.setup({
      vm: vms,
      cluster: clusters
    });

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

  it('should support query string for selection', function *() {
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

    yield rest.setup({
      vm: vms,
      cluster: clusters
    });

    let query = {select: ['name', 'status', '@cluster']};
    let res = yield get({url: `/entities/vm?q=${JSON.stringify(query)}`});

    expect(res.body).to.have.length(2);
    for (let i = 0; i < 2; i++) {
      expect(res.body[i].name).to.equal(vms[i].name);
      expect(res.body[i].status).to.equal(vms[i].status);
      expect(res.body[i]['@cluster']).to.be.an('object');
      expect(res.body[i]['@cluster'].id).to.equal(clusters[i].id.toString());
      expect(res.body[i]['@cluster'].name).to.equal(clusters[i].name);
    }
  });

  it('should return 400 on bad query', function *() {
    yield get({url: '/entities/vm?q=Not entirely: JSON', status: 400});
  });

  it('should be able to resolve nested references', function *() {
    yield rest.setup({
      vm: {
        id: 1,
        name: 'my vm',
        _links: {
          cluster: 2
        }
      },
      cluster: {
        id: 2,
        name: 'my cluster',
        _links: {
          data_center: 3
        }
      },
      data_center: {
        id: 3,
        name: 'my data center',
        _links: {
          system: 4
        }
      },
      system: {
        id: 4,
        name: 'my system'
      }
    });

    let res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center.@system.name']}});
    expect(res.body).to.eql({
      '@cluster.@data_center.@system.name': 'my system'
    });

    res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center.name']}});
    expect(res.body).to.eql({
      '@cluster.@data_center.name': 'my data center'
    });

    res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center.@system(name)']}});
    expect(res.body).to.eql({
      '@cluster.@data_center.@system': {
        name: 'my system'
      }
    });

    res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center(name)']}});
    expect(res.body).to.eql({
      '@cluster.@data_center': {
        name: 'my data center'
      }
    });
  });

  it('should support nested projections', function *() {
    yield rest.setup({
      vm: {
        id: 1,
        name: 'my vm',
        _links: {
          cluster: 2
        }
      },
      cluster: {
        id: 2,
        name: 'my cluster',
        version: '3.6',
        cpu: 'haswell',
        _links: {
          data_center: 3
        }
      },
      data_center: {
        id: 3,
        comment: 'my data center'
      }
    });

    let res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster(id, name, version, @data_center.comment)']}});
    expect(res.body).to.eql({
      '@cluster': {
        id: '2',
        name: 'my cluster',
        version: '3.6',
        '@data_center.comment': 'my data center'
      }
    });
  });

  it('should support wildcard projections', function *() {
    yield rest.setup({
      vm: {
        id: 1,
        name: 'foo'
      }
    });
    let res = yield get({url: '/entities/vm/1', payload: {select: ['*']}});
    expect(res.body).to.eql({
      id: '1',
      name: 'foo'
    });
  });

  it('should support nested wildcard projections', function *() {
    let vm = {
      id: 1,
      name: 'foo',
      _links: {
        host: 2
      }
    };
    let host = {
      id: 2,
      name: 'host 123'
    };
    yield rest.setup({vm, host});

    let res = yield get({url: '/entities/vm/1', payload: {select: ['name', '@host(*)']}});
    expect(res.body).to.eql({
      name: 'foo',
      '@host': {id: '2', name: 'host 123'}
    });
  });

  it('should resolve subcollections', function *() {
    let vms = [];
    for (let i = 0; i < 3; i++) {
      vms.push({id: i.toString(), name: 'vm' + i, _links: { cluster: '1' }});
    }

    yield rest.setup({
      cluster: {
        id: 1,
        name: 'my cluster'
      },
      vm: vms
    });

    let res = yield get({url: '/entities/cluster/1', payload: {select: ['name', '@[vm]']}});
    expect(res.body).to.eql({
      name: 'my cluster',
      '@[vm]': vms
    });
  });

  it('should resolve subcollections with projections', function *() {

    let vms = [];
    for (let i = 0; i < 3; i++) {
      vms.push({id: i.toString(), name: 'vm' + i, _links: { cluster: '1' }});
    }

    yield rest.setup({
      cluster: {
        id: 1,
        name: 'my cluster'
      },
      vm: vms
    });

    let res = yield get({url: '/entities/cluster/1', payload: {select: ['name', '@[vm].name']}});
    expect(res.body).to.eql({
      name: 'my cluster',
      '@[vm].name': vms.map(vm => vm.name)
    });

    res = yield get({url: '/entities/cluster/1', payload: {select: ['@[vm](name)']}});
    expect(res.body).to.eql({
      '@[vm]': vms.map(vm => { return {name: vm.name}; })
    });
  });

  it('should resolve nested references in subcollections', function *() {
    const bigStorage = {id: '1', name: 'Big storage'};
    const smallStorage = {id: '2', name: 'Small storage'};
    yield rest.setup({
      vm: [
        {id: 1, _links: { disk: [1, 2] }},
        {id: 2, _links: { disk: [1]}}
      ],
      disk: [
        {id: 1, _links: { storage: bigStorage.id }},
        {id: 2, _links: { storage: smallStorage.id }}
      ],
      storage: [
        bigStorage,
        smallStorage
      ]
    });
    let res = yield get({url: '/entities/vm', payload: {select: ['@[disk].@storage']}});
    expect(res.body).to.eql([
      { '@[disk].@storage': [bigStorage, smallStorage] },
      { '@[disk].@storage': [bigStorage] }
    ]);
  });

  it('should support nested projection in subcollections', function *() {
    const bigStorage = {id: '1', name: 'Big storage'};
    const smallStorage = {id: '2', name: 'Small storage'};
    yield rest.setup({
      vm: [
        {id: 1, _links: { disk: [1, 2] }},
        {id: 2, _links: { disk: [1]}}
      ],
      disk: [
        {id: 1, _links: { storage: bigStorage.id }},
        {id: 2, _links: { storage: smallStorage.id }}
      ],
      storage: [
        bigStorage,
        smallStorage
      ]
    });
    let res = yield get({url: '/entities/vm', payload: {select: ['@[disk].@storage(name)']}});
    expect(res.body).to.eql([
      { '@[disk].@storage': [{name: bigStorage.name}, {name: smallStorage.name}] },
      { '@[disk].@storage': [{name: bigStorage.name}] }
    ]);
  });
});
