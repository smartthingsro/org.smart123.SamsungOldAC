'use strict';

const Homey = require('homey');
const API = require('./samsung-discovery');

class SamsungOldACDevice extends Homey.Device {
	
	onInit() {
        this.registerCapabilityListener('onoff', async ( value ) => {
			this.log('wallplug value ', value);
        });
        
        new API().on('discover', function(aircon) {
            console.log('asdasd');
            // now login!
            aircon.get_token( (err, token) => {
                if (!!err) return console.log('login error: ' + err.message);
                this.token = token;

                aircon.login(token, function(err) {
                    if (!!err) return console.log('login error: ' + err.message);
                
                    // Drive the aircon!
                    aircon.onoff(true);
                });
            }).on('waiting', function() {
                console.log('please power on the device within the next 30 seconds');
            }).on('end', function() {
                console.log('aircon disconnected');
            }).on('err', function(err) {
                console.log('aircon error: ' + err.message);
            });
        }).on('error', function(err) {
            console.log('discovery error: ' + err.message);
        });

        
    }

}

module.exports = SamsungOldACDevice;