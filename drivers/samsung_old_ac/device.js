'use strict';

const Homey = require('homey');
const API = require('../../lib/samsung-discovery');
const AirCon = require('../../lib/samsung-airconditioner');

class SamsungOldACDevice extends Homey.Device {	
	async onInit() {
        this.aircon = new AirCon({
            "ip": this.getStoreValue('ip'),
            "duid": this.getStoreValue('duid')
        });

        this.aircon.on('loginSuccess', () => {
            this.aircon.getTemperature();
        });

        this.aircon.login(this.getStoreValue('token'), function(err) {
            if (!!err) return console.log('login error: ' + err.message);
        });        

        this.registerCapabilities();
        this.registerEventListeners();
    }

    registerEventListeners() {
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