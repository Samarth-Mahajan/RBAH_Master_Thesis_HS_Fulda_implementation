import { grpc } from './proto.js';

export function startGrpcServer(server: grpc.Server, port: number, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error) => {
      if (error) return reject(error);
      console.log(JSON.stringify({ event: 'grpc_server_started', service: name, port }));
      resolve();
    });
  });
}

export function unaryCall<TResponse>(
  invoke: (callback: grpc.requestCallback<TResponse>) => grpc.ClientUnaryCall
): { result: Promise<TResponse>; cancel: () => void } {
  let call: grpc.ClientUnaryCall;
  const result = new Promise<TResponse>((resolve, reject) => {
    call = invoke((error, response) => error ? reject(error) : resolve(response as TResponse));
  });
  return { result, cancel: () => call.cancel() };
}
