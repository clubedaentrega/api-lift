'use strict'

var MACHINE_ID = toHex(Math.floor(Math.random() * 0xFFFFFF), 6),
	PID = toHex(process.pid % 0xFFFF, 4),
	index = Math.floor(Math.random() * 0xFFFFFF)

/**
 * Return an unique id for each call
 * Inspired by ObjectId in mongodb
 * @returns {string}
 */
module.exports = function () {
	index = (index + 1) % 0xFFFFFF
	return toHex(Math.floor(Date.now() / 1e3), 8) +
		MACHINE_ID +
		PID +
		toHex(index, 6)
}

function toHex(num, len) {
	var str = num.toString(16)
	while (str.length < len) {
		str = '0' + str
	}
	return str
}