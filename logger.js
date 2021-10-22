const winston = require('winston');

function filterOnly(level) {
    return winston.format(function (info) {
        if (info['level'] === level) {
            return info;
        }
    })();
}
 
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.errors({stack: true}),
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'info.log', level: 'info', format: filterOnly('info') }),
    ],
});
 
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}
 
module.exports = logger;