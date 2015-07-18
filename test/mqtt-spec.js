'use strict';

var expect = require('chai').expect
  , db  = require('../lib/db')
  , rest = require('./utils/rest')
  , push = require('./utils/push')
  , post = rest.post
  , patch = rest.patch
  , put = rest.put
  , remove = rest.remove
  ;

describe("MQTT push notification", function () {

  push.setup();

  beforeEach(function *() {
    yield db.clear('vm');
  });

  const payload = {
    id: "push_message_342",
    data: "some content"
  };

  const payload2 = {
    id: "push_message_12",
    data: "some content"
  };

  it('should be sent on entity creation', function *() {
    push.expect('vm/push_message_342', '+');
    yield post({url: '/entities/vm', payload});
    yield push.wait();
  });

  it('should be sent on entity update with changed fields', function *() {
    push.expect('vm/push_message_12', '+');
    yield post({url: '/entities/vm', payload: payload2});
    push.expect('vm/push_message_12', 'data');
    yield put({url: '/entities/vm/push_message_12', payload: {id: payload2.id, data: "Some other content"}});
    yield push.wait();
  });

  it('should be sent when nested object changes', function *() {
    const vm = {
      id: '123',
      data: {
        head: 'foo',
        body: [1, 2, 3]
      }
    };
    push.expect('vm/123', '+');
    yield rest.setup({vm});

    vm.data.body[2] = 42;

    push.expect('vm/123', 'data');
    yield put({url: '/entities/vm/123', payload: vm});

    yield push.wait();
  });

  it('should not be sent when nothing changes', function *() {
    push.expect('vm/push_message_342', '+');
    yield post({url: '/entities/vm', payload});
    yield put({url: '/entities/vm/push_message_342', payload});
    yield push.wait();
  });

  it('should not be sent when nested object does not change', function *() {
    const vm = {
      id: '123',
      data: {
        head: 'foo',
        body: [1, 2, 3]
      }
    };
    push.expect('vm/123', '+');
    yield rest.setup({vm});

    yield put({url: '/entities/vm/123', payload: vm});
    yield push.wait();
  });

  it('should equal properties in patch update', function *() {
    push.expect('vm/push_message_342', '+');
    yield post({url: '/entities/vm', payload});
    push.expect('vm/push_message_342', 'data,new_field');
    yield patch({url: '/entities/vm/push_message_342', payload: {data: "new data", new_field: 'surprise'}});
    yield push.wait();
  });

  function *setupVms() {
    const vms = [1, 2, 3, 4, 5].map(i => {
      return {
        id: 'id_' + i,
        name: 'name_' + i
      };
    });

    for (let vm of vms) {
      push.expect('vm/' + vm.id, '+');
      yield post({url: '/entities/vm', payload: vm});
    }

    return vms;
  }

  it('should be sent for each updated entity', function *() {
    const vms = yield setupVms();

    for (let vm of vms) {
      vm.status = 'down';
    }
    for (let vm of vms) {
      push.expect('vm/' + vm.id, 'status');
    }
    yield put({url: '/entities/vm', payload: vms});
    yield push.wait();
  });

  it('should be sent for each created/updated/deleted entity', function *() {
    let vms = yield setupVms();

    push.expect('vm/id_6', '+');
    push.expect('vm/id_1', 'status');
    push.expect('vm/id_2', 'name');
    push.expect('vm/id_4', '-');
    push.expect('vm/id_5', '-');

    vms = [vms[0], vms[1], vms[2]];
    vms[0].status = 'up';
    vms[1].name = 'something';
    vms.push({id: 'id_6'});

    yield put({url: '/entities/vm', payload: vms});

    yield push.wait();
  });

  it('should be sent for single removed entity', function *() {
    push.expect('vm/push_message_342', '+');
    yield post({url: '/entities/vm', payload});
    push.expect('vm/push_message_342', '-');
    yield remove({url: '/entities/vm/push_message_342'});

    yield push.wait();
  });

  it('should be sent for each removed entity', function *() {
    const vms = yield setupVms();
    for (let vm of vms) {
      push.expect('vm/' + vm.id, '-');
    }
    yield remove({url: '/entities/vm'});

    yield push.wait();
  });

  describe('Links', () => {

    it('should be sent on link change', function *() {
      push.expect('vm/push_message_342', '+');
      yield post({url: '/entities/vm', payload});
      push.expect('vm/push_message_342', '@cluster');
      yield patch({url: '/entities/vm/push_message_342', payload: {_links: {cluster: 42}}});
      yield push.wait();
    });
  });

  // this test should be last
  it('should not send any extra messages', function *() {
    yield push.wait();
  });
});
