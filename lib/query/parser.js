var peg = require('pegjs')
var fs = require('fs')
var path = require('path')

const GRAMMAR_FILE = path.join(__dirname, 'grammar.peg')

module.exports = peg.buildParser(fs.readFileSync(GRAMMAR_FILE, 'utf8'))
