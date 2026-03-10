import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

/**
 * Thin wrapper around Nakama's HTTP RPC endpoint.
 * All requests go through:  POST /v2/rpc/<id>?http_key=<key>
 */
@Injectable()
export class NakamaService {
  private readonly client: AxiosInstance;
  private readonly httpKey: string;

  constructor(private readonly config: ConfigService) {
    const baseURL = config.get<string>('NAKAMA_URL', 'http://nakama:7350');
    this.httpKey = config.get<string>('NAKAMA_HTTP_KEY', 'retro_server_http_key');

    this.client = axios.create({
      baseURL,
      timeout: 10_000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Call a Nakama server-side RPC and return the parsed `payload` value.
   * Nakama wraps the response in `{ "payload": "<json-string>" }`.
   */
  async rpc<T = unknown>(id: string, body: unknown = {}): Promise<T> {
    const resp = await this.client.post<{ payload: string }>(
      `/v2/rpc/${id}`,
      JSON.stringify(body),
      { params: { http_key: this.httpKey } },
    );
    return JSON.parse(resp.data.payload) as T;
  }
}
