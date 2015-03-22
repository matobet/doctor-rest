'use strict';

function objectDiff(original, updated) {
  const diff = {};
  for (let key of Object.keys(updated)) {
    if (!original.hasOwnProperty(key) || original[key] !== updated[key]) {
      diff[key] = updated[key];
    }
  }
  return diff;
}

function byId(arr) {
  const map = {};
  for (let obj of arr) {
    map[obj.id] = obj;
  }
  return map;
}

function isEmpty(obj) {
  return Object.getOwnPropertyNames(obj).length === 0;
}

function arrayDiff(original, updated) {
  const diffs = {
    created: [],
    updated: [],
    deleted: []
  };
  const originalById = byId(original);
  for (let u of updated) {
    if (u.id in originalById) {
      const diff = objectDiff(originalById[u.id], u);
      if (!isEmpty(diff)) {
        diff.id = u.id;
        diffs.updated.push(diff);
      }
    } else {
      diffs.created.push(u.id);
    }
  }
  const updatedById = byId(updated);
  for (let o of original) {
    if (!(o.id in updatedById)) {
      diffs.deleted.push(o.id);
    }
  }
  return diffs;
}

module.exports = {
  object: objectDiff,
  array: arrayDiff
};
