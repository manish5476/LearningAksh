'use strict';
const EventEmitter = require('events');

// We extend the native Node.js EventEmitter
class EventDispatcher extends EventEmitter {}

// We export a SINGLETON (one global instance)
// This ensures the entire app is listening to the exact same event bus
const eventDispatcher = new EventDispatcher();

module.exports = eventDispatcher;