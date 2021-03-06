'use strict'

var expect = require('chai').expect
var db = require('../lib/db')
var rest = require('./utils/rest')
var get = rest.get

describe('Query Language', () => {
  beforeEach(function * () {
    yield db.clear('vm', 'cluster', 'data_center', 'system', 'disk', 'storage')
  })

  describe('select', () => {
    it('should enable to query selected fields', function * () {
      yield rest.setup({vm: {
        id: 123,
        a: 'foo',
        b: 'bar',
        c: 'baz'
      }})

      let res = yield get({url: '/entities/vm/123', payload: {select: ['a', 'b']}})
      expect(res.body).to.eql({
        a: 'foo',
        b: 'bar'
      })
      expect(res.body.c).to.be.undefined
    })

    it('should return filtered query for entire collection', function * () {
      const vms = [
        {id: 1, name: 'vm_1', status: 'up'},
        {id: 2, name: 'vm_2', status: 'up'},
        {id: 3, name: 'vm_3', status: 'down'},
        {id: 4, name: 'vm_4', status: 'up'},
        {id: 5, name: 'vm_5', status: 'migrating'}
      ]
      yield rest.setup({vm: vms})

      let res = yield get({url: '/entities/vm', payload: {select: ['name', 'status']}})
      res.body.forEach((vm, i) => {
        expect(vm.id).to.be.undefined
        expect(vm.name).to.equal(vms[i].name)
        expect(vm.status).to.equal(vms[i].status)
      })
    })

    it('should enable to query fields of linked documents', function * () {
      const vm = {
        id: 123,
        name: 'my_vm',
        status: 'up',
        cluster: 456
      }
      const cluster = {
        id: 456,
        name: 'my_cluster'
      }

      yield rest.setup({vm, cluster})

      let res = yield get({url: '/entities/vm/123', payload: {select: ['name', 'status', '@cluster.name']}})
      expect(res.body).to.eql({
        name: vm.name,
        status: vm.status,
        '@cluster.name': cluster.name
      })
    })

    it('should support embedding of linked objects', function * () {
      const vm = {
        id: 123,
        name: 'my_vm',
        status: 'up',
        cluster: 456
      }
      const cluster = {
        id: 456,
        name: 'my_cluster'
      }

      yield rest.setup({vm, cluster})

      let res = yield get({url: '/entities/vm/123', payload: {select: ['name', 'status', '@cluster']}})
      expect(res.body.name).to.equal(vm.name)
      expect(res.body.status).to.equal(vm.status)
      expect(res.body['@cluster']).to.be.an('object')
      expect(res.body['@cluster'].id).to.equal(cluster.id.toString())
      expect(res.body['@cluster'].name).to.equal(cluster.name)
    })

    it('should enable to query fields of linked documents for entire collections', function * () {
      const vms = [{
        id: 123,
        name: 'my_vm',
        status: 'up',
        cluster: 456
      }, {
        id: 124,
        name: 'my_vm2',
        status: 'down',
        cluster: 457
      }]

      const clusters = [{
        id: 456,
        name: 'my_cluster'
      }, {
        id: 457,
        name: 'my_other_cluster'
      }]

      yield rest.setup({
        vm: vms,
        cluster: clusters
      })

      let res = yield get({url: '/entities/vm', payload: {select: ['name', 'status', '@cluster']}})

      expect(res.body).to.have.length(2)
      for (let i = 0; i < 2; i++) {
        expect(res.body[i].name).to.equal(vms[i].name)
        expect(res.body[i].status).to.equal(vms[i].status)
        expect(res.body[i]['@cluster']).to.be.an('object')
        expect(res.body[i]['@cluster'].id).to.equal(clusters[i].id.toString())
        expect(res.body[i]['@cluster'].name).to.equal(clusters[i].name)
      }
    })

    it('should support query string for selection', function * () {
      const vms = [{
        id: 123,
        name: 'my_vm',
        status: 'up',
        cluster: 456
      }, {
        id: 124,
        name: 'my_vm2',
        status: 'down',
        cluster: 457
      }]

      const clusters = [{
        id: 456,
        name: 'my_cluster'
      }, {
        id: 457,
        name: 'my_other_cluster'
      }]

      yield rest.setup({
        vm: vms,
        cluster: clusters
      })

      let query = {select: ['name', 'status', '@cluster']}
      let res = yield get({url: `/entities/vm?q=${JSON.stringify(query)}`})

      expect(res.body).to.have.length(2)
      for (let i = 0; i < 2; i++) {
        expect(res.body[i].name).to.equal(vms[i].name)
        expect(res.body[i].status).to.equal(vms[i].status)
        expect(res.body[i]['@cluster']).to.be.an('object')
        expect(res.body[i]['@cluster'].id).to.equal(clusters[i].id.toString())
        expect(res.body[i]['@cluster'].name).to.equal(clusters[i].name)
      }
    })

    it('should return 400 on bad query', function * () {
      yield get({url: '/entities/vm?q=Not entirely: JSON', status: 400})
    })

    it('should be able to resolve nested references', function * () {
      yield rest.setup({
        vm: {
          id: 1,
          name: 'my vm',
          cluster: 2
        },
        cluster: {
          id: 2,
          name: 'my cluster',
          data_center: 3
        },
        data_center: {
          id: 3,
          name: 'my data center',
          system: 4
        },
        system: {
          id: 4,
          name: 'my system'
        }
      })

      let res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center.@system.name']}})
      expect(res.body).to.eql({
        '@cluster.@data_center.@system.name': 'my system'
      })

      res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center.name']}})
      expect(res.body).to.eql({
        '@cluster.@data_center.name': 'my data center'
      })

      res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center.@system(name)']}})
      expect(res.body).to.eql({
        '@cluster.@data_center.@system': {
          name: 'my system'
        }
      })

      res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.@data_center(name)']}})
      expect(res.body).to.eql({
        '@cluster.@data_center': {
          name: 'my data center'
        }
      })
    })

    it('should support "0" as link value', function * () {
      yield rest.setup({
        vm: {
          id: 1,
          cluster: 0
        },
        cluster: {
          id: 0,
          name: 'my cluster'
        }
      })

      let res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster.name']}})
      expect(res.body).to.eql({
        '@cluster.name': 'my cluster'
      })
    })

    it('should support nested projections', function * () {
      yield rest.setup({
        vm: {
          id: 1,
          name: 'my vm',
          cluster: 2
        },
        cluster: {
          id: 2,
          name: 'my cluster',
          version: '3.6',
          cpu: 'haswell',
          data_center: 3
        },
        data_center: {
          id: 3,
          comment: 'my data center'
        }
      })

      let res = yield get({url: '/entities/vm/1', payload: {select: ['@cluster(id, name, version, @data_center.comment)']}})
      expect(res.body).to.eql({
        '@cluster': {
          id: '2',
          name: 'my cluster',
          version: '3.6',
          '@data_center.comment': 'my data center'
        }
      })
    })

    it('should support wildcard projections', function * () {
      yield rest.setup({
        vm: {
          id: 1,
          name: 'foo'
        }
      })
      let res = yield get({url: '/entities/vm/1', payload: {select: ['*']}})
      expect(res.body).to.eql({
        id: '1',
        name: 'foo'
      })
    })

    it('should support nested wildcard projections', function * () {
      let vm = {
        id: 1,
        name: 'foo',
        host: 2
      }
      let host = {
        id: 2,
        name: 'host 123'
      }
      yield rest.setup({vm, host})

      let res = yield get({url: '/entities/vm/1', payload: {select: ['name', '@host(*)']}})
      expect(res.body).to.eql({
        name: 'foo',
        '@host': {id: '2', name: 'host 123'}
      })
    })

    it('should resolve subcollections', function * () {
      let vms = []
      for (let i = 0; i < 3; i++) {
        vms.push({id: i.toString(), name: 'vm' + i, cluster: '1'})
      }

      yield rest.setup({
        cluster: {
          id: 1,
          name: 'my cluster'
        },
        vm: vms
      })

      let res = yield get({url: '/entities/cluster/1', payload: {select: ['name', '@[vm]']}})
      expect(res.body).to.eql({
        name: 'my cluster',
        '@[vm]': vms
      })
    })

    it('should resolve subcollections with projections', function * () {
      let vms = []
      for (let i = 0; i < 3; i++) {
        vms.push({id: i.toString(), name: 'vm' + i, cluster: '1'})
      }

      yield rest.setup({
        cluster: {
          id: 1,
          name: 'my cluster'
        },
        vm: vms
      })

      let res = yield get({url: '/entities/cluster/1', payload: {select: ['name', '@[vm].name']}})
      expect(res.body).to.eql({
        name: 'my cluster',
        '@[vm].name': vms.map((vm) => vm.name)
      })

      res = yield get({url: '/entities/cluster/1', payload: {select: ['@[vm](name)']}})
      expect(res.body).to.eql({
        '@[vm]': vms.map((vm) => {
          return {name: vm.name}
        })
      })
    })

    it('should resolve nested references in subcollections', function * () {
      const bigStorage = {id: '1', name: 'Big storage'}
      const smallStorage = {id: '2', name: 'Small storage'}
      yield rest.setup({
        vm: [
          {id: 1, disk: [1, 2]},
          {id: 2, disk: [1]}
        ],
        disk: [
          {id: 1, storage: bigStorage.id},
          {id: 2, storage: smallStorage.id}
        ],
        storage: [
          bigStorage,
          smallStorage
        ]
      })
      let res = yield get({url: '/entities/vm', payload: {select: ['@[disk].@storage']}})
      expect(res.body).to.eql([
        { '@[disk].@storage': [bigStorage, smallStorage] },
        { '@[disk].@storage': [bigStorage] }
      ])
    })

    it('should support nested projection in subcollections', function * () {
      const bigStorage = {id: '1', name: 'Big storage'}
      const smallStorage = {id: '2', name: 'Small storage'}
      yield rest.setup({
        vm: [
          {id: 1, disk: [1, 2]},
          {id: 2, disk: [1]}
        ],
        disk: [
          {id: 1, storage: bigStorage.id},
          {id: 2, storage: smallStorage.id}
        ],
        storage: [
          bigStorage,
          smallStorage
        ]
      })
      let res = yield get({url: '/entities/vm', payload: {select: ['@[disk].@storage(name)']}})
      expect(res.body).to.eql([
        { '@[disk].@storage': [{name: bigStorage.name}, {name: smallStorage.name}] },
        { '@[disk].@storage': [{name: bigStorage.name}] }
      ])
    })

    it('should resolve multiple array references', function * () {
      yield rest.setup({
        vm: {
          id: 1,
          name: 'myVm'
        }
      })

      let res = yield get({url: '/entities/vm/1', payload: {select: ['*', '@[foo]', '@[bar]']}})
      expect(res.body).to.eql({
        id: '1',
        name: 'myVm',
        '@[foo]': [],
        '@[bar]': []
      })
    })
  })

  describe('where', () => {
    it('should filter entities based on a simple property equality', function * () {
      yield rest.setup({
        vm: [
          { id: '1', status: 'up' },
          { id: '2', status: 'up' },
          { id: '3', status: 'down' },
          { id: '4', status: 'up' },
          { id: '5', status: 'undefined' }
        ]
      })

      let res = yield get({url: '/entities/vm', payload: {where: {status: 'up'}}})
      expect(res.body).to.eql([
        { id: '1', status: 'up' },
        { id: '2', status: 'up' },
        { id: '4', status: 'up' }
      ])
    })

    it('should support filtering based on multiple conditions', function * () {
      yield rest.setup({
        vm: [
          { id: '1', status: 'up', cluster: '1' },
          { id: '2', status: 'up', cluster: '2' },
          { id: '3', status: 'down', cluster: '2' },
          { id: '4', status: 'up', cluster: '1' },
          { id: '5', status: 'undefined', cluster: '1' }
        ]
      })

      let res = yield get({url: '/entities/vm', payload: {
        select: 'id',
        where: {status: 'up', cluster: '1'}}
      })
      expect(res.body).to.eql([
        { id: '1' },
        { id: '4' }
      ])
    })

    it('should support matching on simple glob patterns', function * () {
      yield rest.setup({
        vm: [
          { id: '1', status: 'up' },
          { id: '2', status: 'powering_up' },
          { id: '3', status: 'down' },
          { id: '4', status: 'up' },
          { id: '5', status: 'powering_down' }
        ]
      })

      let res = yield get({url: '/entities/vm', payload: {where: {status: '*up'}}})
      expect(res.body).to.eql([
        { id: '1', status: 'up' },
        { id: '2', status: 'powering_up' },
        { id: '4', status: 'up' }
      ])
    })
  })

  describe('orderBy', () => {
    it('should support basic sorting of documents', function * () {
      yield rest.setup({
        vm: [
          { id: '1', name: 'Z' },
          { id: '2', name: 'x' },
          { id: '3', name: 'W' },
          { id: '4', name: 'Y' },
          { id: '5', name: 's' }
        ]
      })

      let query = {
        select: 'name',
        orderBy: 'name'
      }
      let res = yield get({url: `/entities/vm?q=${JSON.stringify(query)}`})
      expect(res.body).to.eql([
        { name: 'W' },
        { name: 'Y' },
        { name: 'Z' },
        { name: 's' },
        { name: 'x' }
      ])

      query = {
        select: 'id',
        orderBy: '-id'
      }

      res = yield get({url: `/entities/vm?q=${JSON.stringify(query)}`})
      expect(res.body).to.eql([
        { id: '5' },
        { id: '4' },
        { id: '3' },
        { id: '2' },
        { id: '1' }
      ])
    })

    it('should support sorting by multiple fields', function * () {
      yield rest.setup({
        vm: [
          { id: '5', name: 'C' },
          { id: '2', name: 'A' },
          { id: '4', name: 'B' },
          { id: '1', name: 'A' },
          { id: '3', name: 'B' }
        ]
      })

      let query = {
        orderBy: ['name', '-id']
      }

      let res = yield get({url: `/entities/vm?q=${JSON.stringify(query)}`})
      expect(res.body).to.eql([
        { id: '2', name: 'A' },
        { id: '1', name: 'A' },
        { id: '4', name: 'B' },
        { id: '3', name: 'B' },
        { id: '5', name: 'C' }
      ])
    })
  })

  describe('limit & skip', () => {
    it('should support basic pagination', function * () {
      const vms = [
        { id: '1', name: 'vm 1' },
        { id: '2', name: 'vm 2' },
        { id: '3', name: 'vm 3' },
        { id: '4', name: 'vm 4' },
        { id: '5', name: 'vm 5' }
      ]

      yield rest.setup({vm: vms})

      let query = {
        limit: 2,
        skip: 1
      }
      let res = yield get({url: `/entities/vm?q=${JSON.stringify(query)}`})

      expect(res.body).to.have.length(2)
      for (let i = 0; i < query.limit; i++) {
        expect(res.body[i]).to.eql(vms[i + query.skip])
      }
    })

    it('should support nested pagination', function * () {
      yield rest.setup({
        cluster: {
          id: 1,
          name: 'my cluster'
        },
        vm: [
          { id: 1, name: 'vm 1', cluster: '1' },
          { id: 2, name: 'vm 2', cluster: '1' },
          { id: 3, name: 'vm 3', cluster: '1' },
          { id: 4, name: 'vm 4', cluster: '1' },
          { id: 5, name: 'vm 5', cluster: '1' }
        ]
      })

      let query = {
        select: ['name', {
          many_ref: 'vm',
          skip: 2,
          limit: 2
        }]
      }
      let res = yield get({url: `/entities/cluster?q=${JSON.stringify(query)}`})
      expect(res.body).to.have.length(1)
      expect(res.body[0]).to.eql({
        name: 'my cluster',
        '@[vm]': [
          { id: '3', name: 'vm 3', cluster: '1' },
          { id: '4', name: 'vm 4', cluster: '1' }
        ]
      })
    })
  })
})
