// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

import { LogCategory, logger, LogLevel } from './Logger';

export class Metronome {

    /**
     * The function to run
     */
    private readonly func: () => any;

    /**
     * How often to run the function (in milliseconds)
     */
    private readonly interval: number;

    /**
     * Can be either number or NodeJS.Timer depending on env
     */
    private timer: any;

    private shouldStop: boolean = true;

    /**
     * @param func      The function to run
     * @param interval  How often to run the function
     */
    constructor(func: () => any, interval: number) {
        this.func = func;
        this.interval = interval;
    }

    /**
     * Start running the function
     */
    public async start(): Promise<void> {
        this.shouldStop = false;
        await this.tick();
    }

    /**
     * Stop running the function
     */
    public stop(): void {
        this.shouldStop = true;
        clearTimeout(this.timer);
    }

    /**
     * Run the function, then recurse
     */
    private async tick(): Promise<void> {
        try {
            await this.func();
        } catch (err) {
            logger.log(
                'Threw exception processing tick function: ' + err,
                LogLevel.ERROR,
                LogCategory.SYNC,
            );
        }

        if (!this.shouldStop) {
            this.timer = setTimeout(this.tick.bind(this), this.interval);
        }
    }
}
