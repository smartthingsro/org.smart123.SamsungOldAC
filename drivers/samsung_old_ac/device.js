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

        var aircon = new AirCon({"ip":"adyku.asuscomm.com", "duid":"F8042E3011B5"});
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