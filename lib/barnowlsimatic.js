/**
 * Copyright reelyActive 2026
 * We believe in an open Internet of Things
 */


const EventEmitter = require('events').EventEmitter;
const SimaticDecoder = require('./simaticdecoder.js');
const TcpListener = require('./tcplistener.js');
const TestListener = require('./testlistener.js');


/**
 * BarnowlSimatic Class
 * Converts SIMATIC RTLS Locating Manager (ExportAVT) data into standard
 * raddec events.
 * @param {Object} options The options as a JSON object.
 */
class BarnowlSimatic extends EventEmitter {

  /**
   * BarnowlSimatic constructor
   * @param {Object} options The options as a JSON object.
   * @constructor
   */
  constructor(options) {
    super();
    options = options || {};
    options.barnowl = this;

    this.listeners = [];
    this.simaticDecoder = new SimaticDecoder({ barnowl: this });
  }

  /**
   * Add a listener to the given hardware interface.
   * @param {Class} ListenerClass The (uninstantiated) listener class.
   * @param {Object} options The options as a JSON object.
   */
  addListener(ListenerClass, options) {
    options = options || {};
    options.decoder = this.simaticDecoder;

    let listener = new ListenerClass(options);
    this.listeners.push(listener);
  }

  /**
   * Handle and emit the given raddec.
   * @param {Raddec} raddec The given Raddec instance.
   */
  handleRaddec(raddec) {
    this.emit("raddec", raddec);
  }

  /**
   * Handle and emit the given infrastructure message.
   * @param {Object} message The given infrastructure message.
   */
  handleInfrastructureMessage(message) {
    this.emit("infrastructureMessage", message);
  }
}


module.exports = BarnowlSimatic;
module.exports.TcpListener = TcpListener;
module.exports.TestListener = TestListener;
