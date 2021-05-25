'use strict';

const Homey = require('homey');
const SamsungDiscovery = require('../../lib/samsung-discovery');
const AC = require('../../lib/samsung-airconditioner');

class SamsungOldACDriver extends Homey.Driver {
    async onPair(session) {
        var self = this;
        let devices = [];
        let selectedDevice = {};

        devices = await new Promise(resolve => {
            let SD = new SamsungDiscovery();
            SD.on('discover', function(result) {
                let found = false;
                for (let i in devices) {
                    if (devices[i].data.id == result.options.duid) {
                        found = true;
                    }
                }
                if (!found) {
                    devices.push({
                        name: "Samsung Old AC [" + result.options.duid + "]",
                        data: {
                            id: result.options.duid
                        },
                        store: {
                            ip: result.options.ip,
                            duid: result.options.duid
                        }
                    });

                    session.emit("list_devices", devices);
                }
            });

            setTimeout(() => {
                SD.stop();
                resolve(devices);
            }, 5000);
        });

        session.setHandler("list_devices", async function () {
            return devices;
        });

        session.setHandler('list_devices_selection', async (data) => {
            return selectedDevice = data[0];
        });

        session.setHandler('authenticate', function () {
            let aircon = new AC({
                "ip": selectedDevice.store.ip,
                "duid": selectedDevice.store.duid
            });

            aircon.getToken( (err, token) => {
                if (!!err) return console.log('login error: ' + err.message);

                selectedDevice.store.token = token;

                aircon.login(token, function(err) {
                    if (!!err) return console.log('login error: ' + err.message);
                });
            }).on('waiting', function() {
                console.log('please power on the device within the next 30 seconds');
            }).on('end', function() {
                console.log('aircon disconnected');
            }).on('err', function(err) {
                console.log('aircon error: ' + err.message);
            }).on('authenticated', () => {
                session.showView('add_device');
            });
        });

        session.setHandler('add_device', async (data) => {
            return Promise.resolve(selectedDevice);
        });
    }
}

module.exports = SamsungOldACDriver;