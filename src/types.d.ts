declare module '@tobyg74/tiktok-api-dl' {
    export function Downloader(url: string, options: any): Promise<any>;
    export function Search(query: string, options: any): Promise<any>;
    export function StalkUser(username: string, options?: any): Promise<any>;
}
