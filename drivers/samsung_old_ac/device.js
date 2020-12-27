'use strict';

const Homey = require('homey');
const API = require('../../lib/samsung-discovery');
const AirCon = require('../../lib/samsung-airconditioner');

class SamsungOldACDevice extends Homey.Device {	
	onInit() {
        this.aircon = new AirCon({
            "ip": this.getSetting('IP'),
            "duid": this.getSetting('MAC')
        });

        if (!this.getStoreValue('token')) {
            this.getToken();
        } else {
            this.login(this.getStoreValue('token'));
        }
    }

    getToken() {
        this.aircon.getToken( (err, token) => {
            if (!!err) return console.log('login error: ' + err.message);
            this.setStoreValue('token', token);
            this.login(token);
        }).on('waiting', function() {
            console.log('please power on the device within the next 30 seconds');
        }).on('end', function() {
            console.log('aircon disconnected');
        }).on('err', function(err) {
            console.log('aircon error: ' + err.message);
        });
    }

    login(token) {
        this.registerCapabilities();
        this.registerEventListeners();

        this.aircon.login(token, function(err) {
            if (!!err) return console.log('login error: ' + err.message);
        });
    }

    registerEventListeners() {
        this.aircon.on('loginSuccess', () => {
            this.aircon.getTemperature();
        });

        this.aircon.on('stateChange', (states) => {
            for (var state in states) {
                if (state == 'AC_FUN_TEMPNOW') {
                    this.setCapabilityValue('measure_temperature', parseInt(states[state]));
                }
            }
        });
    }

    registerCapabilities() {
        this.registerCapabilityListener('onoff', async ( value ) => {
            this.log('Turned: ', value);
            this.aircon.onoff(value);

            return Promise.resolve();
        });

        this.registerCapabilityListener('target_temperature', value => {
            this.log('Set target temperature: ', value);
            this.aircon.setTemperature(value);

            return Promise.resolve();
        });

        this.registerCapabilityListener('thermostat_mode', value => {
            this.log("Set mode: ", value);
            if (value == "off") {
                this.aircon.off();
            } else {
                this.aircon.mode(value);
            }

            return Promise.resolve();
        });
    }
}

module.exports = SamsungOldACDevice;