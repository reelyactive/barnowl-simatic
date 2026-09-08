/**
 * Copyright reelyActive 2026
 * We believe in an open Internet of Things
 */


const DEFAULT_RADIO_DECODINGS_PERIOD_MILLISECONDS = 1000;
const DEFAULT_POSITION = { x: 2.51, y: 9.92, z: 1.00 };
const POSITION_RANDOM_DELTA = 1;
const TEST_DEVICE_ID = '17:b4:10:02:07:ea';
const TEST_ORIGIN = 'test';


/**
 * TestListener Class
 * Provides a consistent stream of artificially generated telegrams.
 */
class TestListener {

  /**
   * TestListener constructor
   * @param {Object} options The options as a JSON object.
   * @constructor
   */
  constructor(options) {
    options = options || {};

    this.decoder = options.decoder;
    this.radioDecodingPeriod = options.radioDecodingPeriod ||
                               DEFAULT_RADIO_DECODINGS_PERIOD_MILLISECONDS;
    this.position = Object.assign({}, DEFAULT_POSITION);
    this.decodingOptions = options.decodingOptions || {};

    setInterval(emitTelegrams, this.radioDecodingPeriod, this);
  }

}


/**
 * Emit simulated ExportAVT telegrams.
 * @param {TestListener} instance The given instance.
 */
function emitTelegrams(instance) {
  let now = new Date().toISOString();
  let position = instance.position;
  let positionTelegram = [ 'P1', now, TEST_DEVICE_ID, position.x.toFixed(2),
                           position.y.toFixed(2), position.z.toFixed(2),
                           now ].join(';');
  let statusTelegram = [ 'S1', now, TEST_DEVICE_ID, '', '1', '', '4.155',
                         '99', '1' ].join(';');

  updateSimulatedPosition(instance);
  instance.decoder.handleData(positionTelegram, TEST_ORIGIN, Date.now(),
                              instance.decodingOptions);
  instance.decoder.handleData(statusTelegram, TEST_ORIGIN, Date.now(),
                              instance.decodingOptions);
}


/**
 * Update the simulated position values.
 * @param {TestListener} instance The given instance.
 */
function updateSimulatedPosition(instance) {
  instance.position.x += ((Math.random() * POSITION_RANDOM_DELTA) -
                          (POSITION_RANDOM_DELTA / 2));
  instance.position.y += ((Math.random() * POSITION_RANDOM_DELTA) -
                          (POSITION_RANDOM_DELTA / 2));
}


module.exports = TestListener;
