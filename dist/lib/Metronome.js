"use strict";
// Copyright (c) 2018-2020, Zpalmtree
//
// Please see the included LICENSE file for more information.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Metronome = void 0;
const Logger_1 = require("./Logger");
class Metronome {
    /**
     * @param func      The function to run
     * @param interval  How often to run the function
     */
    constructor(func, interval) {
        this.shouldStop = true;
        /**
         * Is code currently executing
         */
        this.inTick = false;
        this.started = false;
        /**
         * Function to run when stopping, and tick func has completed
         */
        this.finishedFunc = undefined;
        this.func = func;
        this.interval = interval;
    }
    /**
     * Start running the function
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.started) {
                return;
            }
            this.started = true;
            this.shouldStop = false;
            yield this.tick();
        });
    }
    /**
     * Stop running the function
     */
    stop() {
        return new Promise((resolve) => {
            this.shouldStop = true;
            clearTimeout(this.timer);
            if (this.inTick) {
                this.finishedFunc = () => {
                    this.started = false;
                    this.finishedFunc = undefined;
                    resolve();
                };
            }
            else {
                this.started = false;
                resolve();
            }
        });
    }
    /**
     * Run the function, then recurse
     */
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            this.inTick = true;
            try {
                yield this.func();
            }
            catch (err) {
                Logger_1.logger.log('Threw exception processing tick function: ' + err, Logger_1.LogLevel.ERROR, Logger_1.LogCategory.SYNC);
            }
            if (!this.shouldStop) {
                this.timer = setTimeout(this.tick.bind(this), this.interval);
            }
            else {
                if (this.finishedFunc) {
                    this.finishedFunc();
                }
            }
            this.inTick = false;
        });
    }
}
exports.Metronome = Metronome;
