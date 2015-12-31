var expect = require('chai').expect
var parser = require('../lib/query/parser')

describe('Field Parser', () => {
  function expectParse (input, result) {
    return expect(parser.parse(input))
  }

  it('should parse simple field', () => {
    expectParse('foo').to.equal('foo')
  })

  it('should parse simple reference', () => {
    expectParse('@cluster').to.eql({ref: 'cluster'})
  })

  it('should parse reference with field', () => {
    expectParse('@cluster.name').to.eql({
      ref: 'cluster',
      select: 'name'
    })
  })

  it('should parse reference with projections', () => {
    expectParse('@cluster(id, name)').to.eql({
      ref: 'cluster',
      select: ['id', 'name']
    })
  })

  it('should parse nested reference', () => {
    expectParse('@cluster.@data_center').to.eql({
      ref: 'cluster',
      select: {
        ref: 'data_center'
      }
    })
  })

  it('should parse nested reference with field', () => {
    expectParse('@cluster.@data_center.name').to.eql({
      ref: 'cluster',
      select: {
        ref: 'data_center',
        select: 'name'
      }
    })
  })

  it('should parse nested reference with projections', () => {
    expectParse('@cluster.@data_center(name, status)').to.eql({
      ref: 'cluster',
      select: {
        ref: 'data_center',
        select: ['name', 'status']
      }
    })
  })

  it('should parse array reference', () => {
    expectParse('@[disk]').to.eql({many_ref: 'disk'})
  })

  it('should parse array reference with field', () => {
    expectParse('@[disk].name').to.eql({
      many_ref: 'disk',
      select: 'name'
    })
  })

  it('should parse array reference with projection', () => {
    expectParse('@[disk](name, status)').to.eql({
      many_ref: 'disk',
      select: ['name', 'status']
    })
  })

  it('should parse nested array reference', () => {
    expectParse('@cluster.@data_center.@[storage_domain]').to.eql({
      ref: 'cluster',
      select: {
        ref: 'data_center',
        select: {
          many_ref: 'storage_domain'
        }
      }
    })
  })

  it('should parse complex combination of all features', () => {
    expectParse('@cluster(id, name, @[vm](name, status, @[disk].name))').to.eql({
      ref: 'cluster',
      select: [
        'id',
        'name',
        {
          many_ref: 'vm',
          select: [
            'name',
            'status',
            {
              many_ref: 'disk',
              select: 'name'
            }
          ]
        }
      ]
    })
  })
})
