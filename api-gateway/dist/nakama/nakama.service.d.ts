import { ConfigService } from '@nestjs/config';
export declare class NakamaService {
    private readonly config;
    private readonly client;
    private readonly httpKey;
    constructor(config: ConfigService);
    rpc<T = unknown>(id: string, body?: unknown): Promise<T>;
}
