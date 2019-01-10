export declare class Metronome {
    private readonly func;
    private readonly interval;
    private timer;
    constructor(func: () => any, interval: number);
    start(): Promise<void>;
    stop(): void;
    private tick;
}
