export async function fetchBuffer(url: string, maxSizeInBytes: number = 25 * 1024 * 1024): Promise<Buffer> {
    // 1. HEAD request to check size before downloading
    try {
        const headRes = await fetch(url, { method: 'HEAD' });
        if (headRes.ok) {
            const contentLength = headRes.headers.get('content-length');
            if (contentLength && parseInt(contentLength) > maxSizeInBytes) {
                throw new Error(`File size (${contentLength} bytes) exceeds limit of ${maxSizeInBytes} bytes`);
            }
        }
    } catch (e) {
        // Ignore HEAD error, proceed to try GET but we might fail later or rely on stream check
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch media: ${response.statusText}`);

    // Check size again if headers present
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSizeInBytes) {
        throw new Error(`File size (${contentLength} bytes) exceeds limit of ${maxSizeInBytes} bytes`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > maxSizeInBytes) {
        throw new Error(`File size (${buffer.length} bytes) exceeds limit of ${maxSizeInBytes} bytes`);
    }

    return buffer;
}
