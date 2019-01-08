export declare class Metronome {
    private readonly func;
    private readonly interval;
    private timer;
    constructor(func: () => any, interval: number);
    start(): void;
    stop(): void;
    private tick;
}
