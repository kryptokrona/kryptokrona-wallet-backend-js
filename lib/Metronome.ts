// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

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
        await this.tick();
    }

    /**
     * Stop running the function
     */
    public stop(): void {
        clearTimeout(this.timer);
    }

    /**
     * Run the function, then recurse
     */
    private async tick(): Promise<void> {
        await this.func();
        this.timer = setTimeout(this.tick.bind(this), this.interval);
    }
}
