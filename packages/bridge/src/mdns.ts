import { Bonjour, type Service } from "bonjour-service";
import { MDNS_SERVICE_TYPE } from "@virt-printer/shared";

export interface MdnsAdvertiseOptions {
  name: string;
  hostIp: string;
  wsPort: number;
  tcpPort: number;
  httpPort: number;
}

export interface MdnsHandle {
  stop: () => void;
}

export function startMdnsAdvertise(options: MdnsAdvertiseOptions): MdnsHandle {
  const bonjour = new Bonjour();
  let service: Service | undefined;

  try {
    service = bonjour.publish({
      name: options.name,
      type: MDNS_SERVICE_TYPE,
      port: options.wsPort,
      txt: {
        host: options.hostIp,
        ws: String(options.wsPort),
        tcp: String(options.tcpPort),
        http: String(options.httpPort),
      },
    });
    console.log(`[bridge] mDNS _${MDNS_SERVICE_TYPE}._tcp on port ${options.wsPort}`);
  } catch (err) {
    console.warn("[bridge] mDNS advertise failed:", err);
  }

  return {
    stop: () => {
      try {
        service?.stop();
        bonjour.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}
