const TYPE_SWITCH = 'action.devices.types.SWITCH';
const TYPE_LIGHT = 'action.devices.types.LIGHT';
const TYPE_THERMOSTAT = 'action.devices.types.THERMOSTAT';
const TYPE_OUTLET = 'action.devices.types.OUTLET';

const TRAITS_ONOFF = 'action.devices.traits.OnOff';
const TRAITS_BRIGHTNESS = 'action.devices.traits.Brightness';
const TRAITS_COLORSPEC = 'action.devices.traits.ColorSpectrum';
// const TRAITS_COLORTEMP = 'action.devices.traits.ColorTemperature';
const TRAITS_TEMPSETTING = 'action.devices.traits.TemperatureSetting';

const Gateway = require('./gateway');
const config = require('../config-provider');

const pollingDeviceProperty =
  config.hasOwnProperty('mongodb') && config.mongodb.hasOwnProperty('uri');

function hex2number(colorString) {
  const color = colorString.replace('#', '');
  const colorN = parseInt(color, 16);
  return colorN;
}

function number2hex(colorNumber) {
  let color = colorNumber.toString(16);
  while (color.length < 6) color = '0' + color;
  color = '#' + color;
  return color;
}

function getSmartHomeDeviceProperties(gateway, thing) {
  const device = {
    id: null,
    type: null,
    traits: [],
    name: {
      // defaultNames: [thing.name],
      name: thing.name,
      // nicknames: [thing.name]
    },
    willReportState: pollingDeviceProperty,
    attributes: {},
    deviceInfo: {
      manufacturer: 'mozilla',
      model: 'gateway',
      hwVersion: '1.0',
      swVersion: '1.0',
    },
  };

  switch (thing.type) {
    case 'onOffSwitch':
      if (gateway.getThingId(thing).match(/^tplink-/)) {
        device.type = TYPE_OUTLET;
      } else {
        device.type = TYPE_SWITCH;
      }
      device.traits.push(TRAITS_ONOFF);
      break;
    case 'multilevelSwitch': // limitation: only support on property
      device.type = TYPE_SWITCH;
      device.traits.push(TRAITS_ONOFF);
      break;
    case 'smartPlug': // limitation: only support on property
      device.type = TYPE_OUTLET;
      device.traits.push(TRAITS_ONOFF);
      break;
    case 'onOffLight':
      device.type = TYPE_LIGHT;
      device.traits.push(TRAITS_ONOFF);
      break;
    case 'dimmableLight':
      device.type = TYPE_LIGHT;
      device.traits.push(TRAITS_ONOFF);
      device.traits.push(TRAITS_BRIGHTNESS);
      break;
    case 'onOffColorLight':
      device.type = TYPE_LIGHT;
      device.traits.push(TRAITS_ONOFF);
      if (thing.properties.hasOwnProperty('color')) {
        device.traits.push(TRAITS_COLORSPEC);
      }
      device.attributes.colorModel = 'rgb';
      break;
    case 'dimmableColorLight':
      device.type = TYPE_LIGHT;
      device.traits.push(TRAITS_ONOFF);
      if (thing.properties.hasOwnProperty('color')) {
        device.traits.push(TRAITS_COLORSPEC);
      }
      device.traits.push(TRAITS_BRIGHTNESS);
      device.attributes.colorModel = 'rgb';
      break;
    case 'thing':
      // thermostat
      if (
        thing.properties.hasOwnProperty('mode') &&
        thing.properties.hasOwnProperty('temperature')
      ) {
        device.type = TYPE_THERMOSTAT;
        device.traits.push(TRAITS_TEMPSETTING);
        device.attributes.availableThermostatModes = 'off,heat,cool,on';
        device.attributes.thermostatTemperatureUnit = 'C';
      }
      break;
    default:
      // do nothing
      break;
  }

  return device;
}

async function changeSmartHomeDeviceStates(gateway, thing, states) {
  const currentStates = {};
  try {
    currentStates.online = true;
    switch (thing.type) {
      case 'onOffSwitch':
      case 'multilevelSwitch': // limitation: only support on property
      case 'smartPlug': // limitation: only support on property
      case 'onOffLight':
        if (states.hasOwnProperty('on'))
          currentStates.on = await gateway.setThingState(
            thing,
            'on',
            states['on']
          );

        break;

      case 'dimmableLight':
        if (states.hasOwnProperty('on'))
          currentStates.on = await gateway.setThingState(
            thing,
            'on',
            states['on']
          );

        if (states.hasOwnProperty('brightness'))
          currentStates.brightness = await gateway.setThingState(
            thing,
            'level',
            states['brightness']
          );

        if (states.hasOwnProperty('brightnessRelativeWeight')) {
          const current = await gateway.getThingState(thing, 'level');
          const target = current + states.brightnessRelativeWeight;
          currentStates.brightness = await gateway.setThingState(
            thing,
            'level',
            target
          );
        }
        break;

      case 'onOffColorLight':
        if (states.hasOwnProperty('on'))
          currentStates.on = await gateway.setThingState(
            thing,
            'on',
            states['on']
          );

        if (
          states.hasOwnProperty('color') &&
          states.color.hasOwnProperty('spectrumRGB')
        ) {
          const color = number2hex(states['color'].spectrumRGB);
          const hex = await gateway.setThingState(thing, 'color', color);
          currentStates.color = {
            spectrumRGB: hex2number(hex),
          };
        }
        break;

      case 'dimmableColorLight':
        if (states.hasOwnProperty('on'))
          currentStates.on = await gateway.setThingState(
            thing,
            'on',
            states['on']
          );

        if (states.hasOwnProperty('brightness'))
          currentStates.brightness = await gateway.setThingState(
            thing,
            'level',
            states.brightness
          );

        if (states.hasOwnProperty('brightnessRelativeWeight')) {
          const current = await gateway.getThingState(thing, 'level');
          const target = current + states.brightnessRelativeWeight;
          currentStates.brightness = await gateway.setThingState(
            thing,
            'level',
            target
          );
        }

        if (
          states.hasOwnProperty('color') &&
          states.color.hasOwnProperty('spectrumRGB')
        ) {
          const color = number2hex(states.color.spectrumRGB);
          const hex = await gateway.setThingState(thing, 'color', color);
          currentStates.color = {
            spectrumRGB: hex2number(hex),
          };
        }
        break;

      case 'thing':
        // thermostat
        if (
          thing.properties.hasOwnProperty('mode') &&
          thing.properties.hasOwnProperty('temperature')
        ) {
          if (states.hasOwnProperty('thermostatMode'))
            currentStates.thermostatMode = await gateway.setThingState(
              thing,
              'mode',
              states.thermostatMode
            );

          if (states.hasOwnProperty('thermostatTemperatureSetpoint')) {
            const temperature = states.thermostatTemperatureSetpoint;
            currentStates.thermostatTemperatureSetpoint = await gateway.setThingState(
              thing,
              'temperature',
              temperature
            );
          }
        }
        break;
      default:
        // do nothing
        break;
    }
  } catch (err) {
    console.error('changeSmartHomeDeviceStates fail:', err);
    currentStates.online = false;
  }

  return currentStates;
}

async function getSmartHomeDeviceStates(gateway, thing) {
  const states = {
    online: true,
  };

  try {
    switch (thing.type) {
      case 'onOffSwitch':
      case 'multilevelSwitch': // limitation: only support on property
      case 'smartPlug': // limitation: only support on property
      case 'onOffLight':
        {
          const on = await gateway.getThingState(thing, 'on');
          states.on = on;
          states.online = await gateway.checkThingOnline(thing, 'on', on);
        }
        break;
      case 'dimmableLight':
        {
          const [on, brightness] = await Promise.all([
            gateway.getThingState(thing, 'on'),
            gateway.getThingState(thing, 'level'),
          ]);

          states.on = on;
          states.brightness = brightness;
          states.online = await gateway.checkThingOnline(thing, 'on', on);
        }
        break;
      case 'onOffColorLight':
        {
          const promises = [];
          promises.push(gateway.getThingState(thing, 'on'));
          if (thing.properties.hasOwnProperty('color')) {
            promises.push(gateway.getThingState(thing, 'color'));
          }
          const [on, hex] = await Promise.all(promises);

          states.on = on;

          if (hex) {
            const color = {
              spectrumRGB: hex2number(hex),
            };
            states.color = color;
          }
          states.online = await gateway.checkThingOnline(thing, 'on', on);
        }
        break;
      case 'dimmableColorLight':
        {
          const promises = [];
          promises.push(gateway.getThingState(thing, 'on'));
          promises.push(gateway.getThingState(thing, 'level'));
          if (thing.properties.hasOwnProperty('color')) {
            promises.push(gateway.getThingState(thing, 'color'));
          }
          const [on, brightness, hex] = await Promise.all(promises);

          states.on = on;
          states.brightness = brightness;

          if (hex) {
            const color = {
              spectrumRGB: hex2number(hex),
            };
            states.color = color;
          }
          states.online = await gateway.checkThingOnline(thing, 'on', on);
        }
        break;

      case 'thing':
        // thermostat
        if (
          thing.properties.hasOwnProperty('mode') &&
          thing.properties.hasOwnProperty('temperature')
        ) {
          const [mode, temperature] = await Promise.all([
            gateway.getThingState(thing, 'mode'),
            gateway.getThingState(thing, 'temperature'),
          ]);

          states.thermostatMode = mode;
          states.thermostatTemperatureSetpoint = temperature;
          states.online = await gateway.checkThingOnline(thing, 'mode', mode);
        }
        break;
      default:
        // do nothing
        break;
    }
  } catch (err) {
    console.error('getSmartHomeDeviceStates fail:', err);
    states.online = false;
  }

  return states;
}

/**
 *
 * @param deviceList:
 * [
 *   "123",
 *   "234"
 * ]
 * @return {{}}
 * {
 *   "123": {
 *     "id": "123",
 *     "type": "action.devices.types.Outlet",
 *     "traits": [
 *       "action.devices.traits.OnOff"
 *     ],
 *     "name": {
 *       "defaultNames": ["TP-Link Outlet C110"],
 *       "name": "Homer Simpson Light",
 *       "nicknames": ["wall plug"]
 *     },
 *     "willReportState: false,
 *     "attributes": {
 *     // None defined for these traits yet.
 *     },
 *     "roomHint": "living room",
 *     "deviceInfo": {
 *       "manufacturer": "tplink",
 *       "model": "c110",
 *       "hwVersion": "3.2",
 *       "swVersion": "11.4"
 *     },
 *     "customData": {
 *       "fooValue": 74,
 *       "barValue": true,
 *       "bazValue": "sheepdip"
 *     }
 *   },
 *   "456": {
 *     "id": "456",
 *     "type": "action.devices.types.Light",
 *     "traits": [
 *       "action.devices.traits.OnOff",
 *       "action.devices.traits.Brightness",
 *       "action.devices.traits.ColorTemperature",
 *       "action.devices.traits.ColorSpectrum"
 *     ],
 *     "name": {
 *       "defaultNames": ["OSRAM bulb A19 color hyperglow"],
 *       "name": "lamp1",
 *       "nicknames": ["reading lamp"]
 *     },
 *     "willReportState: false,
 *     "attributes": {
 *       "TemperatureMinK": 2000,
 *       "TemperatureMaxK": 6500
 *     },
 *     "roomHint": "living room",
 *     "config": {
 *       "manufacturer": "osram",
 *       "model": "hg11",
 *       "hwVersion": "1.2",
 *       "swVersion": "5.4"
 *     },
 *     "customData": {
 *       "fooValue": 12,
 *       "barValue": false,
 *       "bazValue": "dancing alpaca"
 *     }
 *   },
 *   "234": {
 *     "id": "234"
 *     // ...
 *   }
 * }
 */
async function smartHomeGetDevices(client, deviceList = null) {
  const gateway = new Gateway(client.gateway, client.token);
  const things = await gateway.getThings(deviceList);
  const devices = {};
  for (let i = 0; i < things.length; i++) {
    const thing = things[i];
    const device = getSmartHomeDeviceProperties(gateway, thing);

    if (device && device.type) {
      const thingId = gateway.getThingId(thing);
      devices[thingId] = device;
    }
  }

  return devices;
}

/**
 *
 * @param deviceList:
 * [
 *   "123",
 *   "234"
 * ]
 * @return {{}}
 * {
 *   "123": {
 *     "on": true ,
 *     "online": true
 *   },
 *   "456": {
 *     "on": true,
 *     "online": true,
 *     "brightness": 80,
 *     "color": {
 *       "name": "cerulian",
 *       "spectrumRGB": 31655
 *     }
 *   },
 *   ...
 * }
 */
async function smartHomeGetStates(client, deviceList = null) {
  const gateway = new Gateway(client.gateway, client.token);
  const things = await gateway.getThings(deviceList);

  const results = await Promise.all(
    things.map(function(thing) {
      return getSmartHomeDeviceStates(gateway, thing);
    })
  );

  const devices = {};

  for (let i = 0; i < results.length; i++) {
    const thing = things[i];
    const thingId = gateway.getThingId(thing);
    const states = results[i];
    devices[thingId] = states;
  }

  return devices;
}

/**
 *
 * @param deviceList:
 * [
 *   "123",
 *   "234"
 * ]
 *
 * @param exec:
 * [{
 *   "command": "action.devices.commands.OnOff",
 *   "params": {
 *       "on": true
 *   }
 * }]
 *
 * @return {}
 * {
 *   "on": true
 * }
 */
async function smartHomeExec(client, deviceList, exec) {
  const gateway = new Gateway(client.gateway, client.token);
  const things = await gateway.getThings(deviceList);

  let query = {};

  for (let i = 0; i < exec.length; i++) {
    query = Object.assign(query, exec[i].params);
  }

  const results = await Promise.all(
    things.map(function(thing) {
      return changeSmartHomeDeviceStates(gateway, thing, query);
    })
  );

  const devices = {};
  for (let i = 0; i < results.length; i++) {
    const thing = things[i];
    const thingId = gateway.getThingId(thing);
    const states = results[i];
    devices[thingId] = states;
  }

  // TODO return current states
  return { devices, query };
}

exports.smartHomeGetDevices = smartHomeGetDevices;
exports.smartHomeGetStates = smartHomeGetStates;
exports.smartHomeExec = smartHomeExec;
