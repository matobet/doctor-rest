var peg = require('pegjs')
  , fs = require('fs')
  , path = require('path')
  ;

const GRAMMAR_FILE = path.join(__dirname, "grammar.peg");

module.exports = peg.buildParser(fs.readFileSync(GRAMMAR_FILE, 'utf8'));
