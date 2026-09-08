/**
 * Copyright reelyActive 2026
 * We believe in an open Internet of Things
 */


const net = require('net');


const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 800;
const DEFAULT_PROTOCOL_VERSION = '1.2';
const DEFAULT_RECONNECT_MILLISECONDS = 5000;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;


/**
 * TcpListener Class
 * Listens for ExportAVT telegrams over a TCP client connection.
 */
class TcpListener {

  /**
   * TcpListener constructor
   * @param {Object} options The options as a JSON object.
   * @constructor
   */
  constructor(options) {
    options = options || {};

    this.host = options.host || DEFAULT_HOST;
    this.port = options.port || DEFAULT_PORT;
    this.protocolVersion = options.protocolVersion ||
                           DEFAULT_PROTOCOL_VERSION;
    this.reconnectMilliseconds = options.reconnectMilliseconds ||
                                 DEFAULT_RECONNECT_MILLISECONDS;
    this.decoder = options.decoder;
    this.decodingOptions = options.decodingOptions || {};
    this.origin = this.host + ':' + this.port;
    this.buffer = Buffer.alloc(0);
    this.socket = null;
    this.reconnectTimeout = null;

    connect(this);
  }

}


/**
 * Establish the TCP connection and perform the V1 protocol handshake.
 * @param {TcpListener} instance The TcpListener instance.
 */
function connect(instance) {
  instance.buffer = Buffer.alloc(0);
  instance.socket = net.createConnection({ host: instance.host,
                                           port: instance.port });

  instance.socket.on('connect', () => {
    console.log('barnowl-simatic: connected to ExportAVT on',
                instance.origin);
    // The V1 telegram MUST be the first message sent, else the Data Export
    // Service will not transmit any data
    let timestamp = new Date().toISOString();
    instance.socket.write('V1;' + timestamp + ';' +
                          instance.protocolVersion + '\n');
  });

  instance.socket.on('data', (data) => {
    handleData(instance, data);
  });

  instance.socket.on('error', (error) => {
    console.log('barnowl-simatic:', error.message);
  });

  instance.socket.on('close', () => {
    scheduleReconnect(instance);
  });
}


/**
 * Buffer the received data and forward each complete LineFeed-framed
 * telegram to the decoder.
 * @param {TcpListener} instance The TcpListener instance.
 * @param {Buffer} data The received data.
 */
function handleData(instance, data) {
  instance.buffer = Buffer.concat([ instance.buffer, data ]);

  let lineFeedIndex = instance.buffer.indexOf(LINE_FEED);
  while(lineFeedIndex >= 0) {
    let lineEndIndex = lineFeedIndex;
    if((lineEndIndex > 0) &&
       (instance.buffer[lineEndIndex - 1] === CARRIAGE_RETURN)) {
      lineEndIndex--;
    }
    let telegram = instance.buffer.toString('utf8', 0, lineEndIndex).trim();
    instance.buffer = instance.buffer.subarray(lineFeedIndex + 1);

    if(telegram.length > 0) {
      instance.decoder.handleData(telegram, instance.origin, Date.now(),
                                  instance.decodingOptions);
    }
    lineFeedIndex = instance.buffer.indexOf(LINE_FEED);
  }
}


/**
 * Schedule a reconnection attempt after the configured delay.
 * @param {TcpListener} instance The TcpListener instance.
 */
function scheduleReconnect(instance) {
  if(instance.reconnectTimeout !== null) { return; }

  console.log('barnowl-simatic: connection closed, reconnecting to',
              instance.origin, 'in', instance.reconnectMilliseconds, 'ms');
  instance.reconnectTimeout = setTimeout(() => {
    instance.reconnectTimeout = null;
    connect(instance);
  }, instance.reconnectMilliseconds);
}


module.exports = TcpListener;
