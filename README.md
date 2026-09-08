barnowl-simatic
===============

__barnowl-simatic__ converts the decodings of UWB devices by the [Siemens SIMATIC RTLS](https://www.siemens.com/simatic-rtls) into standard developer-friendly JSON that is vendor/technology/application-agnostic.

![Overview of barnowl-simatic](https://reelyactive.github.io/barnowl-simatic/images/overview.png)

__barnowl-simatic__ is a lightweight [Node.js package](https://www.npmjs.com/package/barnowl-simatic) that can run on resource-constrained edge devices as well as on powerful cloud servers and anything in between.  It is compatible with reelyActive's [Pareto Anywhere](https://www.reelyactive.com/pareto/anywhere/) open source middleware suite, and can just as easily be run standalone behind a [barnowl](https://github.com/reelyactive/barnowl) instance, as detailed in the code examples below.


Quick Start
-----------

Clone this repository, install package dependencies with `npm install`, and then from the root folder run at any time:

    npm start 12.34.56.78 800

__barnowl-simatic__ will connect as a TCP client, on the given IP address and port, to the __ExportAVT__ module of the SIMATIC RTLS Data Export Service, perform the mandatory `V1` protocol handshake (protocol version 1.2), and decode the LineFeed-framed plain-text telegrams, and output (flattened) __raddec__ JSON to the console.


Hello barnowl-simatic!
----------------------

```javascript
const BarnowlSimatic = require('barnowl-simatic');

let barnowl = new BarnowlSimatic();

barnowl.addListener(BarnowlSimatic.TestListener, {});

barnowl.on('raddec', (raddec) => {
  console.log(raddec);  // Real-time location
});

barnowl.on('infrastructureMessage', (message) => {
  console.log(message); // Sensor/status data
});
```


Supported Listener Interfaces
-----------------------------

The following listener interfaces are supported.

### TCP

```javascript
const options = {
    host: "localhost",
    port: 800,
    protocolVersion: "1.2",
    reconnectMilliseconds: 5000,
    decodingOptions: {} // See Decoding Options below
};
barnowl.addListener(BarnowlSimatic.TcpListener, options);
```

### Test

Provides a steady stream of simulated TExportAVT telegrams for testing purposes.

```javascript
barnowl.addListener(BarnowlSimatic.TestListener, {});
```


Decoding Options
----------------

The `decodingOptions` property of the listener interface options supports translation from the SIMATIC coordinate system to WGS84 (global geocoordinates) via the `reposition` property:

    {
      reposition: {
        coordinateSystem: {
          type: "customOrigin",
          originOffset: [ -73.57123, 45.50883, 0 ], // Geocoordinates of origin
          measurementUnits: [ 'm', 'm', 'm' ],      // SIMATIC uses metres
          horizontalPlaneRotation: 0                // Degrees from true North
        }
      }
    }

See the [repositioned](https://github.com/reelyactive/repositioned) module for detailed documentation.

Additional `decodingOptions` are as follows:

| Option            | Description |
|:------------------|:------------|
| receiver          | `{ id: "...", idType: 2, rssi: 0 }` optionally adds a synthetic receiver decoding to each raddec (ExportAVT provides computed positions, not per-receiver radio decodings, so raddecs otherwise have an empty rssiSignature). |
| includeHeartbeats | `true` maps H1 telegrams to `isHealthy` infrastructure messages. Off by default (S1 already carries heartbeat state). |


Prerequisites
-------------

Configure the SIMATIC RTLS as follows.  In `RTLS_LM_DataExport.ini`, the `[ExportAVT]` section (or a `[Module.*]` clone with `ExportType=ExportAVT`) must be active with the telegrams to export enabled, for example:

    [ExportAVT]
    Active=1
    Port=800
    RemoteFraming=LineFeedFraming
    SendInitialData=1
    PosDataMsg=P1
    StateDataMsg=S1
    NodeDataMsg=N1
    ButtonStateMsg=BtnStates1
    PositionFormate=xyz

`RemoteFraming` must be `LineFeedFraming` (default) or `LineFeedFramingCR`.  Multiple parties may connect to the same ExportAVT port simultaneously, so this module can run alongside other consumers (e.g. Location Intelligence).


Telegram mapping
----------------

| ExportAVT telegram   | Event                 | Properties                   |
|:---------------------|:----------------------|:-----------------------------|
| P1 / OP1 (position)  | raddec                | `position` [ x,y,z ], `timestamp` (sensor time) |
| S1 (device status)   | infrastructureMessage | `batteryVoltage`, `batteryPercentage`, `isHealthy` (heartbeat) |
| BtnStates1 (buttons) | infrastructureMessage | `isButtonPressed` [ button1, button2 ] |
| N1 (device data)     | infrastructureMessage | `name`, `deviceType` (TAG/Anchor/Gateway), `position` (infrastructure only) |
| H1 (heartbeat)       | infrastructureMessage | `isHealthy: true` (only with `includeHeartbeats: true`) |
| V1, I1, KeepAlive1, BattState1, LED_Info1, CMD_Ack1, Error1 | _ignored_ | Battery level is already covered by S1 |

The device identifier is the transponder NetworkAddress (6-byte HexBinary, e.g. `17:b4:10:02:07:ea`), translated to an EUI-48 id (`17b4100207ea`).  The ExportAVT default `NodeIdent=NetworkAddress` must be maintained for addresses to be recognised, else the transmitterIdType will be TYPE_UNKNOWN.

P1 telegrams with an empty (invalid) position (ex: tags which went offline) do not produce a raddec.


AI disclosure and tooling
-------------------------

This project is maintained by human developers.  The original code was developed by Tommy Morissette at [CNIMI](https://cnimi.ca/) using Anthropic's [Fable 5](https://www.anthropic.com/claude/fable) artificial intelligence model in [Claude Pro](https://claude.com/).


Contributing
------------

Discover [how to contribute](CONTRIBUTING.md) to this open source project which upholds a standard [code of conduct](CODE_OF_CONDUCT.md).


Security
--------


Consult our [security policy](SECURITY.md) for best practices using this open source software and to report vulnerabilities.


License
-------

MIT License

Copyright (c) 2026 [reelyActive](https://www.reelyactive.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
THE SOFTWARE.