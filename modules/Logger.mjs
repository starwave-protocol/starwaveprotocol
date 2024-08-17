export default class Logger {
    static logWithDate(message) {
        console.log(`${new Date().toISOString()}: ${message}`);
    }

    static logMessage(message) {
        Logger.logWithDate(message);
    }

    static formatArgument(argument) {
        if (typeof argument === 'object') {
            return JSON.stringify(argument, null, 2);
        }

        if (typeof argument === 'number') {
            //Colorize number with yellow
            return `\x1b[33m${argument}\x1b[0m`;
        }

        if (typeof argument === 'string') {
            //Colorize string with green
            return `\x1b[32m${argument}\x1b[0m`;
        }

        if (typeof argument === 'boolean') {
            //Colorize boolean with blue
            return `\x1b[34m${argument}\x1b[0m`;
        }

        return argument;
    }

    static log() {
        let loggerString = '';
        for (let i = 0; i < arguments.length; i++) {
            loggerString += Logger.formatArgument(arguments[i]) + ' ';
        }

        Logger.logMessage(loggerString);
    }

    static logAction(action, ...args) {
        // @ts-ignore
        Logger.log(`${action}:`, ...args);
    }


    static error(...args) {
        Logger.logAction('Error', ...args);
    }
}
