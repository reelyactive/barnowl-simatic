/**
 * Copyright reelyActive 2026
 * We believe in an open Internet of Things
 *
 * Telegram reference: Siemens "SIMATIC RTLS Data Export Service" application
 * manual, section "ExportAVT" (protocol version 1.2).
 */


const Raddec = require('raddec');
const repositioned = require('repositioned');


const TELEGRAM_SEPARATOR = ';';
const HEXBINARY_SEPARATOR = ':';
const EUI48_LENGTH_IN_HEX_CHARS = 12;
const BUTTON_PRESSED_CODES = [ 'S', 'L', 'D' ];


/**
 * SimaticDecoder Class
 * Decodes ExportAVT telegrams from one or more listeners and forwards the
 * events to the given BarnowlSimatic instance.
 */
class SimaticDecoder {

  /**
   * SimaticDecoder constructor
   * @param {Object} options The options as a JSON object.
   * @constructor
   */
  constructor(options) {
    options = options || {};

    this.barnowl = options.barnowl;
  }

  /**
   * Handle a single ExportAVT telegram from a given listener.
   * @param {String} data The telegram as a UTF-8 string (single line).
   * @param {String} origin The unique origin identifier of the listener.
   * @param {Number} time The time of the data capture.
   * @param {Object} decodingOptions The telegram decoding options.
   */
  handleData(data, origin, time, decodingOptions) {
    decodingOptions = decodingOptions || {};
    let fields = data.split(TELEGRAM_SEPARATOR);
    let telegramId = fields[0];

    switch(telegramId) {
      case 'P1':
      case 'OP1':
        return handlePositionTelegram(this, fields, time, decodingOptions);
      case 'S1':
        return handleStatusTelegram(this, fields, time, decodingOptions);
      case 'BtnStates1':
        return handleButtonTelegram(this, fields, time, decodingOptions);
      case 'N1':
        return handleDeviceDataTelegram(this, fields, time, decodingOptions);
      case 'H1':
        return handleHeartbeatTelegram(this, fields, time, decodingOptions);
      default:  // V1, I1, KeepAlive1, BattState1, LED_Info1, CMD_Ack1, Error1
        return; // are intentionally ignored
    }
  }
}


/**
 * Handle a P1/OP1 (position) telegram, producing a raddec.
 * P1;timestamp;NodeIdent;x;y;z;sensorTimestamp
 * @param {SimaticDecoder} instance The SimaticDecoder instance.
 * @param {Array} fields The telegram fields.
 * @param {Number} time The time of the data capture.
 * @param {Object} decodingOptions The telegram decoding options.
 */
function handlePositionTelegram(instance, fields, time, decodingOptions) {
  if(fields.length < 7) { return; }

  let deviceSignature = parseNodeIdent(fields[2]);
  let x = parseFloat(fields[3]);
  let y = parseFloat(fields[4]);
  let z = parseFloat(fields[5]);
  let hasValidPosition = !Number.isNaN(x) && !Number.isNaN(y);

  if(!hasValidPosition) { return; } // Tag went offline: position unknown

  let timestamp = parseTimestamp(fields[6]) || parseTimestamp(fields[1]) ||
                  time;
  let position = Number.isNaN(z) ? [ x, y ] : [ x, y, z ];

  if(decodingOptions.reposition) {
    position = repositioned.toWGS84(position,
                                  decodingOptions.reposition.coordinateSystem);
  }

  let raddec = new Raddec({
      transmitterId: deviceSignature.id,
      transmitterIdType: deviceSignature.idType,
      timestamp: timestamp,
      position: position
  });

  if(decodingOptions.receiver && decodingOptions.receiver.id) {
    raddec.addDecoding({
        receiverId: decodingOptions.receiver.id,
        receiverIdType: decodingOptions.receiver.idType ||
                        Raddec.identifiers.TYPE_UNKNOWN,
        rssi: decodingOptions.receiver.rssi || 0
    });
  }

  instance.barnowl.handleRaddec(raddec);
}


/**
 * Handle a S1 (device status) telegram, producing a dynamb-style
 * infrastructure message.
 * S1;timestamp;NodeIdent;digIn;virtIn;digOut;voltage;batteryLevel;heartbeat
 * @param {SimaticDecoder} instance The SimaticDecoder instance.
 * @param {Array} fields The telegram fields.
 * @param {Number} time The time of the data capture.
 * @param {Object} decodingOptions The telegram decoding options.
 */
function handleStatusTelegram(instance, fields, time, decodingOptions) {
  if(fields.length < 9) { return; }

  let deviceSignature = parseNodeIdent(fields[2]);
  let message = {
      deviceId: deviceSignature.id,
      deviceIdType: deviceSignature.idType,
      timestamp: parseTimestamp(fields[1]) || time
  };
  let voltage = parseFloat(fields[6]);
  let batteryPercentage = parseInt(fields[7]);
  let heartbeat = parseInt(fields[8]);
  let hasProperty = false;

  if(!Number.isNaN(voltage)) {
    message.batteryVoltage = voltage;
    hasProperty = true;
  }
  if(!Number.isNaN(batteryPercentage)) {
    message.batteryPercentage = batteryPercentage;
    hasProperty = true;
  }
  if(!Number.isNaN(heartbeat)) {
    message.isHealthy = (heartbeat === 1);
    hasProperty = true;
  }

  if(hasProperty) {
    instance.barnowl.handleInfrastructureMessage(message);
  }
}


/**
 * Handle a BtnStates1 (button states) telegram, producing a dynamb-style
 * infrastructure message.
 * BtnStates1;timestamp;NodeIdent;button1;button2   (S/L/D or empty)
 * @param {SimaticDecoder} instance The SimaticDecoder instance.
 * @param {Array} fields The telegram fields.
 * @param {Number} time The time of the data capture.
 * @param {Object} decodingOptions The telegram decoding options.
 */
function handleButtonTelegram(instance, fields, time, decodingOptions) {
  if(fields.length < 4) { return; }

  let deviceSignature = parseNodeIdent(fields[2]);
  let isButtonPressed = [];

  for(let index = 3; index < Math.min(fields.length, 5); index++) {
    let code = fields[index].trim().toUpperCase();
    isButtonPressed.push(BUTTON_PRESSED_CODES.includes(code));
  }

  instance.barnowl.handleInfrastructureMessage({
      deviceId: deviceSignature.id,
      deviceIdType: deviceSignature.idType,
      timestamp: parseTimestamp(fields[1]) || time,
      isButtonPressed: isButtonPressed
  });
}


/**
 * Handle a N1 (device data) telegram, producing a statid-style infrastructure
 * message.  Infrastructure devices (Anchor/Gateway) include their position.
 * N1;ts;NodeIdent;netAddr;nodeKey;name;ip;serial;type;x;y;z;group;errCnt;t1-t5
 * @param {SimaticDecoder} instance The SimaticDecoder instance.
 * @param {Array} fields The telegram fields.
 * @param {Number} time The time of the data capture.
 * @param {Object} decodingOptions The telegram decoding options.
 */
function handleDeviceDataTelegram(instance, fields, time, decodingOptions) {
  if(fields.length < 14) { return; }

  let deviceSignature = parseNodeIdent(fields[2]);
  let message = {
      deviceId: deviceSignature.id,
      deviceIdType: deviceSignature.idType,
      timestamp: parseTimestamp(fields[1]) || time
  };

  if(fields[5] !== '') {
    message.name = fields[5];
  }
  if(fields[8] !== '') {
    message.deviceType = fields[8]; // TAG | Anchor | Gateway
  }

  let x = parseFloat(fields[9]);
  let y = parseFloat(fields[10]);
  let z = parseFloat(fields[11]);
  if(!Number.isNaN(x) && !Number.isNaN(y)) {
    let position = Number.isNaN(z) ? [ x, y ] : [ x, y, z ];
    if(decodingOptions.reposition) {
      position = repositioned.toWGS84(position,
                                  decodingOptions.reposition.coordinateSystem);
    }
    message.position = position;
  }

  instance.barnowl.handleInfrastructureMessage(message);
}


/**
 * Handle a H1 (heartbeat) telegram, producing a dynamb-style infrastructure
 * message, only if the includeHeartbeats decoding option is enabled.
 * H1;timestamp;NodeIdent
 * @param {SimaticDecoder} instance The SimaticDecoder instance.
 * @param {Array} fields The telegram fields.
 * @param {Number} time The time of the data capture.
 * @param {Object} decodingOptions The telegram decoding options.
 */
function handleHeartbeatTelegram(instance, fields, time, decodingOptions) {
  if((fields.length < 3) || (decodingOptions.includeHeartbeats !== true)) {
    return;
  }

  let deviceSignature = parseNodeIdent(fields[2]);

  instance.barnowl.handleInfrastructureMessage({
      deviceId: deviceSignature.id,
      deviceIdType: deviceSignature.idType,
      timestamp: parseTimestamp(fields[1]) || time,
      isHealthy: true
  });
}


/**
 * Parse the NodeIdent field into an id and idType.  With the default
 * ExportAVT configuration (NodeIdent=NetworkAddress) this is a 6-byte
 * HexBinary such as 17:b4:10:02:07:ea which translates to EUI-48.
 * @param {String} nodeIdent The NodeIdent field.
 * @return {Object} The id (String) and idType (Number).
 */
function parseNodeIdent(nodeIdent) {
  let id = nodeIdent.toLowerCase().replaceAll(HEXBINARY_SEPARATOR, '');
  let isEui48 = /^[0-9a-f]{12}$/.test(id);

  if(isEui48) {
    return { id: id, idType: Raddec.identifiers.TYPE_EUI48 };
  }
  return { id: nodeIdent, idType: Raddec.identifiers.TYPE_UNKNOWN };
}


/**
 * Parse an ExportAVT DateTime (YYYY-MM-DDThh:mm:ss.SSSZ) into epoch
 * milliseconds.
 * @param {String} dateTime The DateTime field.
 * @return {Number} The epoch milliseconds, or null if invalid/empty.
 */
function parseTimestamp(dateTime) {
  if(!dateTime || (dateTime === '')) { return null; }

  let timestamp = Date.parse(dateTime);
  return Number.isNaN(timestamp) ? null : timestamp;
}


module.exports = SimaticDecoder;
