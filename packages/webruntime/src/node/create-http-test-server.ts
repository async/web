import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

export interface HttpTestServer {
  origin: string;
  server: Server;
  close(): Promise<void>;
}

export async function createHttpTestServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void
): Promise<HttpTestServer> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected HTTP test server address');
  }

  return {
    origin: `http://127.0.0.1:${address.port}`,
    server,
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  };
}
