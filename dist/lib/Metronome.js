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
const Logger_1 = require("./Logger");
class Metronome {
    /**
     * @param func      The function to run
     * @param interval  How often to run the function
     */
    constructor(func, interval) {
        this.shouldStop = true;
        this.func = func;
        this.interval = interval;
    }
    /**
     * Start running the function
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            this.shouldStop = false;
            yield this.tick();
        });
    }
    /**
     * Stop running the function
     */
    stop() {
        this.shouldStop = true;
        clearTimeout(this.timer);
    }
    /**
     * Run the function, then recurse
     */
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.func();
            }
            catch (err) {
                Logger_1.logger.log('Threw exception processing tick function: ' + err, Logger_1.LogLevel.ERROR, Logger_1.LogCategory.SYNC);
            }
            if (!this.shouldStop) {
                this.timer = setTimeout(this.tick.bind(this), this.interval);
            }
        });
    }
}
exports.Metronome = Metronome;
