export declare class Metronome {
    /**
     * The function to run
     */
    private readonly func;
    /**
     * How often to run the function (in milliseconds)
     */
    private readonly interval;
    /**
     * Can be either number or NodeJS.Timer depending on env
     */
    private timer;
    private shouldStop;
    /**
     * @param func      The function to run
     * @param interval  How often to run the function
     */
    constructor(func: () => any, interval: number);
    /**
     * Start running the function
     */
    start(): Promise<void>;
    /**
     * Stop running the function
     */
    stop(): void;
    /**
     * Run the function, then recurse
     */
    private tick;
}
