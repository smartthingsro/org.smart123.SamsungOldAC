/*jslint node: true */
"use strict";
var Emitter        = require('events').EventEmitter,
    os             = require('os'),
    util           = require('util'),
    SSDP           = require('./extended-ssdp'),
    Device         = require('./samsung-airconditioner');


var DEFAULT_LOGGER = { 
  error   : function(msg, props) { console.log(msg); if (!!props) console.trace(props.exception); }, 
  warning : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }, 
  notice  : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }, 
  info    : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }, 
  debug   : function(msg, props) { console.log(msg); if (!!props) console.log(props);             }
};

class SamsungDiscovery extends Emitter {
  constructor (options) {
    super();
    this.options = options || {};
    this.logger = typeof options === 'undefined' ? {} : options.logger || {};

    for (let k in DEFAULT_LOGGER) {
      if ((DEFAULT_LOGGER.hasOwnProperty(k)) && (typeof this.logger[k] === 'undefined')) {
        this.logger[k] = DEFAULT_LOGGER[k];
      }
    }

    let ifaces = os.networkInterfaces();
    for (let ifname in ifaces) {
      if ((!ifaces.hasOwnProperty(ifname)) || 
          (ifname.indexOf('vmnet') === 0)  || 
          (ifname.indexOf('vboxnet') === 0)  || 
          (ifname.indexOf('vnic') === 0)   || 
          (ifname.indexOf('tun') !== -1)) {
        continue;
      }

      let ifaddrs = ifaces[ifname];
      if (ifaddrs.length === 0) continue;

      for (let ifa = 0; ifa < ifaddrs.length; ifa++) {
        if ((ifaddrs[ifa].internal) || (ifaddrs[ifa].family !== 'IPv4')) continue;

        this.logger.debug('listening', { 
          network_interface: ifname, 
          ipaddr: ifaddrs[ifa].address, 
          portno: 1900 
        });
        this.listen(ifname, ifaddrs[ifa].address, 1900);
      }
    }
  }

  listen (ifname, ipaddr, portno) {
    var notify = function() {
      ssdp.notify(ifname, ipaddr, portno, 'AIR CONDITIONER',
        { SPEC_VER: 'MSpec-1.00', SERVICE_NAME: 'ControlServer-MLib', MESSAGE_TYPE: 'CONTROLLER_START' });
    };

    var ssdp = new SSDP({
      addMembership     : false, 
      responsesOnly     : true,
      multicastLoopback : false,
      noAdvertisements  : true
    }).on('response', function(msg, rinfo) {
      var i, info, j, lines, mac;
  
      lines = msg.toString().split("\r\n");
      info = {};
      for (i = 1; i < lines.length; i++) {
        j = lines[i].indexOf(':');
        if (j <= 0) break;
        info[lines[i].substring(0, j)] = lines[i].substring(j + 1).trim();
      }

      mac = info.MAC_ADDR;
      var devices = {};
      devices[mac] = new Device({ 
        logger : this.logger,
        ip     : rinfo.address,
        duid   : mac,
        info   : info
      });
  
      this.emit('discover', devices[mac]);
    });

    ssdp.logger = this.logger;

    ssdp.server('0.0.0.0');
    ssdp.sock.on('listening', function() {
      setInterval(notify, 30 * 1000);
      notify();
    });
  }
}

module.exports = SamsungDiscovery;
