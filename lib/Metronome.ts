// Copyright (c) 2018, Zpalmtree 
// 
// Please see the included LICENSE file for more information.

export class Metronome {
    constructor(func: () => any, interval: number) {
        this.func = func;
        this.interval = interval;
    }

    start(): void {
        this.tick();
    }

    stop(): void {
        clearTimeout(this.timer);
    }

    private tick(): void {
        this.func();
        this.timer = setTimeout(this.tick.bind(this), this.interval);
    }

    private readonly func: () => any;

    private readonly interval: number;

    /* Can be either number or NodeJS.Timer depending on env */
    private timer: any;
}
