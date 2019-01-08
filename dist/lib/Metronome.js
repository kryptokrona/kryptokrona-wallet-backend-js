"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
Object.defineProperty(exports, "__esModule", { value: true });
class Metronome {
    constructor(func, interval) {
        this.func = func;
        this.interval = interval;
    }
    start() {
        this.tick();
    }
    stop() {
        clearTimeout(this.timer);
    }
    tick() {
        this.func();
        this.timer = setTimeout(this.tick.bind(this), this.interval);
    }
}
exports.Metronome = Metronome;
