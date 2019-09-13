var Emitter = require('events').EventEmitter, 
    tls     = require('tls'), 
    carrier = require('carrier'),
    fs      = require('fs');

var self;

class SamsungAirconditioner extends Emitter {
  constructor (options) {
    super();
    self = this;
    self.options = options;
  }

  connect () {
    self.callbacks = {};

    self.socket = tls.connect({
			pfx: fs.readFileSync('/assets/certificate/ac14k_m.pfx'),
			port: 2878,
			host: self.options.ip,
			rejectUnauthorized: false,
			ciphers: 'HIGH:!DH:!aNULL'
		}, function() {
      
      console.log('connected', { ipaddr: self.options.ip, port: 2878, tls: true });

      self.socket.setEncoding('utf8');
      carrier.carry(self.socket, function(line) {
        var callback, id, state;

        if (line === 'DRC-1.00') {
          return;
        }

        if (line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
          return self.send('<Request Type="AuthToken"><User Token="' + self.token + '" /></Request>');
        }

        if (line.match(/Response Type="AuthToken" Status="Okay"/)) {
          self.emit('loginSuccess');
        }

        console.log('read', { line: line });

        // Other events
        if (line.match(/Update Type="Status"/)) {
          if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            state = {};
            state[matches[1]] = matches[2];

            self.emit('stateChange', state);
          }
        }

        if (line.match(/Response Type="DeviceState" Status="Okay"/)) {
            state = {};

            // line = '<Device DUID="7825AD103D06" GroupID="AC" ModelID="AC" ><Attr ID="AC_FUN_ENABLE" Type="RW" Value="Enable"/><Attr ID="AC_FUN_POWER" Type="RW" Value="Off"/><Attr ID="AC_FUN_SUPPORTED" Type="R" Value="0"/><Attr ID="AC_FUN_OPMODE" Type="RW" Value="NotSupported"/><Attr ID="AC_FUN_TEMPSET" Type="RW" Value="24"/><Attr ID="AC_FUN_COMODE" Type="RW" Value="Off"/><Attr ID="AC_FUN_ERROR" Type="RW" Value="00000000"/><Attr ID="AC_FUN_TEMPNOW" Type="R" Value="29"/><Attr ID="AC_FUN_SLEEP" Type="RW" Value="0"/><Attr ID="AC_FUN_WINDLEVEL" Type="RW" Value="High"/><Attr ID="AC_FUN_DIRECTION" Type="RW" Value="Fixed"/><Attr ID="AC_ADD_AUTOCLEAN" Type="RW" Value="Off"/><Attr ID="AC_ADD_APMODE_END" Type="W" Value="0"/><Attr ID="AC_ADD_STARTWPS" Type="RW" Value="Direct"/><Attr ID="AC_ADD_SPI" Type="RW" Value="Off"/><Attr ID="AC_SG_WIFI" Type="W" Value="Connected"/><Attr ID="AC_SG_INTERNET" Type="W" Value="Connected"/><Attr ID="AC_ADD2_VERSION" Type="RW" Value="0"/><Attr ID="AC_SG_MACHIGH" Type="W" Value="0"/><Attr ID="AC_SG_MACMID" Type="W" Value="0"/><Attr ID="AC_SG_MACLOW" Type="W" Value="0"/><Attr ID="AC_SG_VENDER01" Type="W" Value="0"/><Attr ID="AC_SG_VENDER02" Type="W" Value="0"/><Attr ID="AC_SG_VENDER03" Type="W" Value="0"/></Device>'

            var attributes = line.split("><");
            attributes.forEach(function(attr) {
              if ((matches = attr.match(/Attr ID="(.*)" Type=".*" Value="(.*)"/))) {
                state[matches[1]] = matches[2];
              }
            });

            self.emit('stateChange', state);
        }

        /* extract CommandID into and then... */
        if (!self.callbacks[id]) return;
        callback = self.callbacks[id];
        delete(self.callbacks[id]);

        /* you may want to pass a structure instead, cf., xml2json */
        callback(null, line);
      });
    }).on('end', function() {
      self.emit('end');
    }).on('error', function(err) {
      self.emit('error', err);
    });
  }

  control (key, value, callback) {
    var id;

    if (!self.socket) throw new Error('not logged in');

    id = Math.round(Math.random() * 10000);
    if (!!callback) self.callbacks[id] = callback;

    return self.send(
      '<Request Type="DeviceControl"><Control CommandID="cmd' + id + '" DUID="' + self.options.duid + '"><Attr ID="' + key + '" Value="' + value + '" /></Control></Request>'
    );
  }

  send (xml) {
    console.log('write', { line: xml });
    self.socket.write(xml + "\r\n");

    return self;
  }

  login (token, callback) {
    self.token = token;
    self.connect();

    setTimeout(function() { callback(null, null); }, 0);
    return self;
  }

  getToken (callback) {
    var socket;

    if (typeof callback !== 'function') throw new Error('callback is mandatory for getToken');

    self.socket = tls.connect({
			pfx: fs.readFileSync('/assets/certificate/ac14k_m.pfx'),
			port: 2878,
			host: self.options.ip,
			rejectUnauthorized: false,
			ciphers: 'HIGH:!DH:!aNULL'
		}, function() {
      var n = 0, state;
      console.log('connected', { ipaddr: self.options.ip, port: 2878, tls: true });

      self.socket.setEncoding('utf8');
      carrier.carry(self.socket, function(line) {
        console.log('read', line);
        if (line == 'DRC-1.00') {
          return;
        }

        if (line == '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
          return self.socket.write('<Request Type="GetToken" />' + "\r\n");
        }

        if (line == '<?xml version="1.0" encoding="utf-8" ?><Response Type="GetToken" Status="Ready"/>') {
          return self.emit('waiting');
        }

        /* examine the line that contains the result */
        if (line == '<?xml version="1.0" encoding="utf-8" ?><Response Status="Fail" Type="Authenticate" ErrorCode="301" />') {
          return callback(new Error('Failed authentication'));
        }


        var matches = line.match(/Token="(.*)"/);
        if (matches) {
          self.emit('authenticated');
          self.token =  matches[1];
          return callback(null, self.token);
        }


        // Other events
        if (line.match(/Update Type="Status"/)) {
          if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            state = {};
            state[matches[1]] = matches[2];

            self.emit('stateChange', state);
          }
        }

        if (line.match(/Response Type="DeviceState" Status="Okay"/)) {
            state = {};

            // line = '<Device DUID="7825AD103D06" GroupID="AC" ModelID="AC" ><Attr ID="AC_FUN_ENABLE" Type="RW" Value="Enable"/><Attr ID="AC_FUN_POWER" Type="RW" Value="Off"/><Attr ID="AC_FUN_SUPPORTED" Type="R" Value="0"/><Attr ID="AC_FUN_OPMODE" Type="RW" Value="NotSupported"/><Attr ID="AC_FUN_TEMPSET" Type="RW" Value="24"/><Attr ID="AC_FUN_COMODE" Type="RW" Value="Off"/><Attr ID="AC_FUN_ERROR" Type="RW" Value="00000000"/><Attr ID="AC_FUN_TEMPNOW" Type="R" Value="29"/><Attr ID="AC_FUN_SLEEP" Type="RW" Value="0"/><Attr ID="AC_FUN_WINDLEVEL" Type="RW" Value="High"/><Attr ID="AC_FUN_DIRECTION" Type="RW" Value="Fixed"/><Attr ID="AC_ADD_AUTOCLEAN" Type="RW" Value="Off"/><Attr ID="AC_ADD_APMODE_END" Type="W" Value="0"/><Attr ID="AC_ADD_STARTWPS" Type="RW" Value="Direct"/><Attr ID="AC_ADD_SPI" Type="RW" Value="Off"/><Attr ID="AC_SG_WIFI" Type="W" Value="Connected"/><Attr ID="AC_SG_INTERNET" Type="W" Value="Connected"/><Attr ID="AC_ADD2_VERSION" Type="RW" Value="0"/><Attr ID="AC_SG_MACHIGH" Type="W" Value="0"/><Attr ID="AC_SG_MACMID" Type="W" Value="0"/><Attr ID="AC_SG_MACLOW" Type="W" Value="0"/><Attr ID="AC_SG_VENDER01" Type="W" Value="0"/><Attr ID="AC_SG_VENDER02" Type="W" Value="0"/><Attr ID="AC_SG_VENDER03" Type="W" Value="0"/></Device>'

            var attributes = line.split("><");
            attributes.forEach(function(attr) {
              if ((matches = attr.match(/Attr ID="(.*)" Type=".*" Value="(.*)"/))) {
                state[matches[1]] = matches[2];
              }
            });

            self.emit('stateChange', state);
        }


      });
    }).on('end', function() {
      if (!self.token) callback(new Error('premature eof'));
    }).on('error', function(err) {
      if (!self.token) callback(err);
    });

    return self;
  }

  onoff (onoff) {
    return self.control('AC_FUN_POWER', onoff ? 'On' : 'Off');
  }

  off () {
    return self.control('AC_FUN_POWER', 'Off');
  }

  mode (type) {
    var i, lmodes = [];

    var modes = ['Auto', 'Cool', 'Dry', 'Wind', 'Heat'];

    for (i = 0; i < modes.length; i++) lmodes[i] = modes[i].toLowerCase();
    i = lmodes.indexOf(type.toLowerCase());
    if (i === -1) throw new Error("Invalid mode: " + type);

    return self.control('AC_FUN_OPMODE', modes[i]);
  }

  setTemperature (temp) {
    return self.control('AC_FUN_TEMPSET', temp);
  }

  setConvenientMode (mode) {
    var i, lmodes = [];

    var modes = ['Off', 'Quiet', 'Sleep', 'Smart', 'SoftCool', 'TurboMode', 'WindMode1', 'WindMode2', 'WindMode3'];

    for (i = 0; i < modes.length; i++) lmodes[i] = modes[i].toLowerCase();
    i = lmodes.indexOf(mode.toLowerCase());
    if (i === -1) throw new Error("Invalid mode: " + mode);

    return self.control('AC_FUN_COMODE', mode);
  }

  getTemperature (mode) {
    return self.control('AC_FUN_TEMPNOW', '', function(err, line) {
      var celcius;
  
      if (!!err) callback(err);
  
      /* parse line and invoke */
        callback(null, celcius);
      });
  }

  sleepMode (minutes) {
    return self.control('AC_FUN_SLEEP', minutes);
  }

  status () {
    return self.send('<Request Type="DeviceState" DUID="' + self.options.duid+ '"></Request>');
  }
}

module.exports = SamsungAirconditioner;
