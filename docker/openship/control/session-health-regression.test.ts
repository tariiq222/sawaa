import { test, expect } from 'bun:test';
import net from 'node:net';
import grpc from '/app/node_modules/@grpc/grpc-js';
import protoLoader from '/app/node_modules/@grpc/proto-loader';
import withSession from '/app/node_modules/dockerode/lib/session.js';

const Health = grpc.makeGenericClientConstructor({
  Check: {
    path: '/grpc.health.v1.Health/Check', requestStream: false, responseStream: false,
    requestSerialize: () => Buffer.alloc(0), requestDeserialize: () => ({}),
    responseSerialize: () => Buffer.from([8, 1]),
    responseDeserialize: (buffer: Buffer) => ({ status: buffer[0] === 8 ? buffer[1] : 0 }),
  },
}, 'Health');

async function fixture(auth?: { username: string; password: string }) {
  let finish: (() => void) | undefined;
  const sockets: net.Socket[] = [];
  const server = net.createServer(socket => {
    sockets.push(socket);
    withSession({ modem: { dial(_opts: unknown, cb: Function) { cb(null, socket); } } }, auth,
      (error: Error | null, _id: string, done: () => void) => { if (error) throw error; finish = done; });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `127.0.0.1:${(server.address() as net.AddressInfo).port}`;
  return { address, stop() { finish?.(); sockets.forEach(s => s.destroy()); server.close(); } };
}

function check(client: any) {
  return new Promise<any>((resolve, reject) => client.Check({}, { deadline: Date.now() + 2000 },
    (error: Error | null, response: unknown) => error ? reject(error) : resolve(response)));
}

test('BuildKit health checks stay SERVING beyond the daemon ten-second failure window', async () => {
  const f = await fixture(); const client = new Health(f.address, grpc.credentials.createInsecure());
  try {
    expect(await check(client)).toEqual({ status: 1 });
    await new Promise(resolve => setTimeout(resolve, 11000));
    expect(await check(client)).toEqual({ status: 1 });
  } finally { client.close(); f.stop(); }
}, 15000);

for (const auth of [undefined, { username: 'fixture-user', password: 'fixture-password' }]) {
  test(`session health registration preserves ${auth ? 'supplied' : 'empty'} registry credentials`, async () => {
    const f = await fixture(auth);
    const pkg = grpc.loadPackageDefinition(protoLoader.loadSync('/app/node_modules/dockerode/lib/proto/auth.proto')) as any;
    const client = new pkg.moby.filesync.v1.Auth(f.address, grpc.credentials.createInsecure());
    try {
      const response = await new Promise<any>((resolve, reject) => client.Credentials({ Host: 'fixture.invalid' },
        { deadline: Date.now() + 2000 }, (error: Error | null, result: any) => error ? reject(error) : resolve(result)));
      expect(response).toEqual(auth ? { Username: 'fixture-user', Secret: 'fixture-password' } : {});
    } finally { client.close(); f.stop(); }
  });
}
