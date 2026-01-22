const units = [
    ['year', 'y', 31536000],
    ['month', 'mo', 2592000],
    ['week', 'w', 604800],
    ['day', 'd', 86400],
    ['hour', 'h', 3600],
    ['minute', 'm', 60],
    ['second', 's', 1]
];

const parse = (v) =>
    v instanceof Date ? v : new Date(typeof v === 'number' ? v * 1000 : String(v).replace(' ', 'T').replace(' UTC', 'Z'));

const calc = (v, isShort) => {
    const diff = Math.floor((Date.now() - parse(v)) / 1000);
    const abs = Math.abs(diff);
    
    for (const [full, short, sec] of units) {
        if (abs >= sec) {
            const num = Math.floor(abs / sec);
            return isShort ?
                `${num}${short} ago` :
                `${num} ${full}${num > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'just now';
};

module.exports = {
    timeAgo: (v) => calc(v, false),
    timeAgoShort: (v) => calc(v, true)
};