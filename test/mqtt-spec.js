'use strict';

var expect = require('chai').expect
  , rest = require('./utils/rest')
  , push = require('./utils/push')
  , post = rest.post
  , patch = rest.patch
  , put = rest.put
  ;

describe("MQTT push notification", function () {

  push.setup();

  const payload = {
    id: "push_message_342",
    data: "some content"
  };

  const payload2 = {
    id: "push_message_12",
    data: "some content"
  };

  it('should be sent on entity creation', function *() {
    push.expect('vm/push_message_342', 'data');
    yield post('/entities/vm', payload);
    yield push.wait();
  });

  it('should be sent on entity update with changed fields', function *() {
    push.expect('vm/push_message_12', 'data');
    yield post('/entities/vm', payload2);
    push.expect('vm/push_message_12', 'data');
    yield put('/entities/vm/push_message_12', {id: payload2.id, data: "Some other content"});
    yield push.wait();
  });

  it('should not be sent when nothing changes', function *() {
    push.expect('vm/push_message_342', 'data');
    yield post('/entities/vm', payload);
    yield put('/entities/vm/push_message_342', payload);
    yield push.wait();
  });

  it('should equal properties in patch update', function *() {
    push.expect('vm/push_message_342', 'data');
    yield post('/entities/vm', payload);
    push.expect('vm/push_message_342', 'data,new_field');
    yield patch('/entities/vm/push_message_342', {data: "new data", new_field: 'surprise'});
    yield push.wait();
  });

  it('should be sent for each updated entity', function *() {
    const vms = [1, 2, 3, 4, 5].map(i => {
      return {
        id: 'id_' + i,
        name: 'name_' + i
      };
    });

    for (let vm of vms) {
      push.expect('vm/' + vm.id, 'name');
      yield post('/entities/vm', vm);
    }

    for (let vm of vms) {
      vm.status = 'down';
    }
    for (let vm of vms) {
      push.expect('vm/' + vm.id, 'status');
    }
    yield put('/entities/vm', vms);
    yield push.wait();
  });

  // this test should be last
  it('should not send any extra messages', function *() {
    yield push.wait();
  });
});
