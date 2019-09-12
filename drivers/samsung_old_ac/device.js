'use strict';

const Homey = require('homey');
const API = require('./samsung-discovery');
const AirCon = require('./samsung-airconditioner');

class SamsungOldACDevice extends Homey.Device {
	
	onInit() {
        this.registerCapabilityListener('onoff', async ( value ) => {
			this.log('wallplug value ', value);
        });

        this.aircons = [];
        
        new API().on('discover', function(aircon) {
            if (aircon.options.ip == '192.168.1.110') return;

            console.log(aircon);
            return;
            if(this.aircons.indexOf(aircon.options.ip) === -1) {
                this.aircons.push(aircon);
                this.getToken(aircon);
            } else {
                this.login(aircon);
            }
        }).on('error', function(err) {
            console.log('discovery error: ' + err.message);
        });

        var aircon = new AirCon({"ip":"192.168.1.134", "duid":"F8:04:2E:30:11:B5"});
        aircon.getToken( (err, token) => {
            if (!!err) return console.log('login error: ' + err.message);
            console.log(token);
        }).on('waiting', function() {
            console.log('please power on the device within the next 30 seconds');
        }).on('end', function() {
            console.log('aircon disconnected');
        }).on('err', function(err) {
            console.log('aircon error: ' + err.message);
        });
    }
}

module.exports = SamsungOldACDevice;