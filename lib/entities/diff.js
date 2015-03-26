'use strict';

function linkDiff(originalLinks, updatedLinks) {
  if (!originalLinks && !updatedLinks) {
    return [];
  }
  if (!originalLinks && updatedLinks) {
    return Object.keys(updatedLinks);
  }
  if (originalLinks && !updatedLinks) {
    return Object.keys(originalLinks);
  }

  let linkNames = new Set();
  Object.keys(originalLinks).forEach(link => linkNames.add(link));
  Object.keys(updatedLinks).forEach(link => linkNames.add(link));

  let result = [];
  for (let link of linkNames) {
    if (originalLinks[link] !== updatedLinks[link]) {
      result.push(link);
    }
  }
  return result;
}

function objectDiff(original, updated) {
  const diff = {
    fields: [],
    links: []
  };
  for (let key of Object.keys(updated)) {
    if (key === '_links') {
      diff.links = linkDiff(original._links, updated._links);
    } else if (!original.hasOwnProperty(key) || original[key] !== updated[key]) {
      diff.fields.push(key);
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

function isEmpty(diff) {
  return diff.fields.length === 0 && diff.links.length === 0;
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
