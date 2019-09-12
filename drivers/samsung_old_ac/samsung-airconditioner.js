var events  = require('events'), 
    util    = require('util'), 
    tls     = require('tls'), 
    carrier = require('carrier');

var Emitter = require('events').EventEmitter;

var DEFAULT_LOGGER = { 
  error   : function(msg, props) { console.log(msg); if (!!props) console.trace(props.exception); },
  warning : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }, 
  notice  : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }, 
  info    : function(msg, props) { console.log(msg); if (!!props) console.log(props);             },
  debug   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }                     
};

class SamsungAirconditioner extends Emitter {
  constructor (options) {
    super();
    this.options = options || {};
    this.logger = typeof options === 'undefined' ? {} : options.logger || {};

    for (let k in DEFAULT_LOGGER) {
      if ((DEFAULT_LOGGER.hasOwnProperty(k)) && (typeof this.logger[k] === 'undefined')) {
        this.logger[k] = DEFAULT_LOGGER[k];
      }
    }

    this.props = { duid : options.duid };
  }

  connect () {
    this.callbacks = {};

    this.socket = tls.connect({port: 2878, host: this.options.ip, rejectUnauthorized: false }, function() {  
      this.logger.info('connected', { ipaddr: this.options.ip, port: 2878, tls: true });

      this.socket.setEncoding('utf8');
      carrier.carry(this.socket, function(line) {
        var callback, id, state;

        if (line === 'DRC-1.00') {
          return;
        }

        if (line === '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
          return this.send('<Request Type="AuthToken"><User Token="' + this.token + '" /></Request>');
        }

        if (line.match(/Response Type="AuthToken" Status="Okay"/)) {
          this.emit('loginSuccess');
        }

        this.logger.debug('read', { line: line });

        // Other events
        if (line.match(/Update Type="Status"/)) {
          if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            state = {};
            state[matches[1]] = matches[2];

            this.emit('stateChange', state);
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

            this.emit('stateChange', state);
        }

        /* extract CommandID into and then... */
        if (!this.callbacks[id]) return;
        callback = this.callbacks[id];
        delete(this.callbacks[id]);

        /* you may want to pass a structure instead, cf., xml2json */
        callback(null, line);
      });
    }).on('end', function() {
      this.emit('end');
    }).on('error', function(err) {
      this.emit('error', err);
    });
  }

  control (key, value, callback) {
    var id;

    if (!this.socket) throw new Error('not logged in');

    id = Math.round(Math.random() * 10000);
    if (!!callback) this.callbacks[id] = callback;

    return this.send(
      '<Request Type="DeviceControl"><Control CommandID="cmd' + id + '" DUID="' + this.options.duid + '"><Attr ID="' + key + '" Value="' + value + '" /></Control></Request>'
    );
  }

  send (xml) {
    this.logger.debug('write', { line: xml });
    this.socket.write(xml + "\r\n");

    return this;
  }

  login (token, callback) {
    this.token = token;
    this.connect();

    setTimeout(function() { callback(null, null); }, 0);
    return this;
  }

  getToken (callback) {
    var socket;

    if (typeof callback !== 'function') throw new Error('callback is mandatory for getToken');

    socket = tls.connect({port: 2878, host: this.options.ip, rejectUnauthorized: false }, function() {  
      var n = 0, state;

      this.logger.info('connected', { ipaddr: this.options.ip, port: 2878, tls: true });

      socket.setEncoding('utf8');
      carrier.carry(socket, function(line) {
        this.logger.debug('read', line);
        if (line == 'DRC-1.00') {
          return;
        }

        if (line == '<?xml version="1.0" encoding="utf-8" ?><Update Type="InvalidateAccount"/>') {
          return socket.write('<Request Type="GetToken" />' + "\r\n");
        }

        if (line == '<?xml version="1.0" encoding="utf-8" ?><Response Type="GetToken" Status="Ready"/>') {
          return this.emit('waiting');
        }

        /* examine the line that contains the result */
        if (line == '<?xml version="1.0" encoding="utf-8" ?><Response Status="Fail" Type="Authenticate" ErrorCode="301" />') {
          return callback(new Error('Failed authentication'));
        }


        var matches = line.match(/Token="(.*)"/);
        if (matches) {
          this.emit('authenticated');
          this.token =  matches[1];
          return callback(null, this.token);
        }


        // Other events
        if (line.match(/Update Type="Status"/)) {
          if ((matches = line.match(/Attr ID="(.*)" Value="(.*)"/))) {
            state = {};
            state[matches[1]] = matches[2];

            this.emit('stateChange', state);
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

            this.emit('stateChange', state);
        }


      });
    }).on('end', function() {
      if (!this.token) callback(new Error('premature eof'));
    }).on('error', function(err) {
      if (!this.token) callback(err);
    });

    return this;
  }

  onoff (onoff) {
    return this.control('AC_FUN_POWER', onoff ? 'On' : 'Off');
  }

  off () {
    return this.control('AC_FUN_POWER', 'Off');
  }

  mode (type) {
    var i, lmodes = [];

    var modes = ['Auto', 'Cool', 'Dry', 'Wind', 'Heat'];

    for (i = 0; i < modes.length; i++) lmodes[i] = modes[i].toLowerCase();
    i = lmodes.indexOf(type.toLowerCase());
    if (i === -1) throw new Error("Invalid mode: " + type);

    return this.control('AC_FUN_OPMODE', modes[i]);
  }

  setTemperature (temp) {
    return this.control('AC_FUN_TEMPSET', temp);
  }

  setConvenientMode (mode) {
    var i, lmodes = [];

    var modes = ['Off', 'Quiet', 'Sleep', 'Smart', 'SoftCool', 'TurboMode', 'WindMode1', 'WindMode2', 'WindMode3'];

    for (i = 0; i < modes.length; i++) lmodes[i] = modes[i].toLowerCase();
    i = lmodes.indexOf(mode.toLowerCase());
    if (i === -1) throw new Error("Invalid mode: " + mode);

    return this.control('AC_FUN_COMODE', mode);
  }

  getTemperature (mode) {
    return this.control('AC_FUN_TEMPNOW', '', function(err, line) {
      var celcius;
  
      if (!!err) callback(err);
  
      /* parse line and invoke */
        callback(null, celcius);
      });
  }

  sleepMode (minutes) {
    return this.control('AC_FUN_SLEEP', minutes);
  }

  status () {
    return this.send('<Request Type="DeviceState" DUID="' + this.options.duid+ '"></Request>');
  }
}

module.exports = SamsungAirconditioner;
