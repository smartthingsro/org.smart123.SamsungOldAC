'use strict';

const Homey = require('homey');
var API = require('samsung-airconditioner').API;

class SamsungOldAC extends Homey.Device {
	
	onInit() {
        new API().on('discover', function(aircon) {
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

module.exports = SamsungOldAC;