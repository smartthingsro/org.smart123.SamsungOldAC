'use strict';

const Homey = require('homey');

class SamsungOldACApp extends Homey.App {
	
	onInit() {
		this.log('SamsungOldAC is running...');
	}
	
}

module.exports = SamsungOldACApp;