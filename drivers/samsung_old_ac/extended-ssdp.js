"use strict";
const SSDP = require('node-ssdp');
const netmask = require('netmask');

class ExtendedSSDP extends SSDP {
    notify (ifname, ipaddr, portno, signature, vars) {
        var out;
    
        var self = this;
    
        if (!self.listening) return;
    
        Object.keys(self.usns).forEach(function (usn) {
            var bcast, mask, quad0;
        
            var udn   = self.usns[usn],
                heads ={ 
                    HOST            : '239.255.255.250:1900', 
                    'CACHE-CONTROL' : 'max-age=20', 
                    SERVER          : signature
                };
        
            out = self.getSSDPHeader('NOTIFY', heads);
            Object.keys(vars).forEach(function (n) { out += n + ': ' + vars[n] + '\r\n'; });
        
            quad0 = parseInt(ipaddr.split('.')[0], 10);
            mask = ((quad0 & 0x80) === 0) ? 8 : ((quad0 & 0xc0) === 0xf0) ? 16 : 24;
        
            // TBD: use the (obsolete) class A/B/C netmasks
            bcast = new netmask.Netmask(ipaddr + '/' + mask).broadcast;
            self.logger.debug('multicasting', { 
                network_interface: ifname, 
                ipaddr: bcast, 
                portno: 1900 
            });
        
            out = new Buffer(out);
            self.sock.setBroadcast(true);
            self.sock.send(out, 0, out.length, 1900, bcast);
        });
    }
}

module.exports = ExtendedSSDP;