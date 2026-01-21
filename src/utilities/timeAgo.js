// timeAgo.js

/**
 * Hypersomnia Timestamp Parser & Time Ago Module
 * Supports:
 *  - ISO 8601 string ("2024-01-27T17:59:44Z")
 *  - Arena format ("2023-11-28 23:12:58.304938 UTC")
 *  - UNIX timestamp float (1768986741.526944)
 */

function parseHypersomniaTime(value) {
    if (typeof value === 'number') {
        // UNIX float timestamp
        return new Date(value * 1000);
    }
    if (typeof value === 'string') {
        // Convert Arena format to ISO 8601
        const iso = value.replace(' ', 'T').replace(' UTC', 'Z');
        return new Date(iso);
    }
    throw new Error('Unsupported timestamp format: ' + value);
}

function timeAgo(value) {
    const date = parseHypersomniaTime(value);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
}

function timeAgoShort(value) {
    const date = parseHypersomniaTime(value);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
    return `${Math.floor(diff / 31536000)}y ago`;
}

export { timeAgo, timeAgoShort };
