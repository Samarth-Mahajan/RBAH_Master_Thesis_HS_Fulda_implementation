import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'node:path';

const definition = protoLoader.loadSync(path.resolve(process.cwd(), 'proto/checkout.proto'), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const loadedProto = grpc.loadPackageDefinition(definition) as unknown as { rbah: { checkout: any } };
export const checkout = loadedProto.rbah.checkout;
export { grpc };
