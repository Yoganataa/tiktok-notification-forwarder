import got, {ExtendOptions} from 'got';

export const getFetch = (baseUrl: string, options?: ExtendOptions) =>
    got.extend({
        prefixUrl: baseUrl,
        dnsCache: true,
        // Disable SSL verification to fix "Hostname/IP does not match certificate's altnames"
        https: {
            rejectUnauthorized: false
        },
        ...options,
    });
