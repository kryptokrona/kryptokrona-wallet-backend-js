"use strict";
// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
class Metronome {
    constructor(func, interval) {
        this.func = func;
        this.interval = interval;
    }
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.tick();
        });
    }
    stop() {
        clearTimeout(this.timer);
    }
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.func();
            this.timer = setTimeout(this.tick.bind(this), this.interval);
        });
    }
}
exports.Metronome = Metronome;
