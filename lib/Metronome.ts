// Copyright (c) 2018, Zpalmtree
//
// Please see the included LICENSE file for more information.

export class Metronome {

    private readonly func: () => any;

    private readonly interval: number;

    /* Can be either number or NodeJS.Timer depending on env */
    private timer: any;
    constructor(func: () => any, interval: number) {
        this.func = func;
        this.interval = interval;
    }

    public start(): void {
        this.tick();
    }

    public stop(): void {
        clearTimeout(this.timer);
    }

    private tick(): void {
        this.func();
        this.timer = setTimeout(this.tick.bind(this), this.interval);
    }
}
