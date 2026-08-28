import { Bonjour, type Service } from "bonjour-service";
import { MDNS_PRINTER_SERVICE_TYPE, MDNS_SERVICE_TYPE } from "@virt-printer/shared";

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
  const services: Service[] = [];

  try {
    services.push(
      bonjour.publish({
        name: options.name,
        type: MDNS_PRINTER_SERVICE_TYPE,
        port: options.tcpPort,
        txt: {
          txtvers: "1",
          qtotal: "1",
          ty: "PrintHub Virtual Printer",
          product: "PrintHub",
          pdl: "application/octet-stream",
          note: options.hostIp,
          tcp: String(options.tcpPort),
        },
      }),
    );
    console.log(
      `[bridge] mDNS _${MDNS_PRINTER_SERVICE_TYPE}._tcp on port ${options.tcpPort} (${options.name})`,
    );

    if (options.httpPort > 0 && options.wsPort > 0) {
      services.push(
        bonjour.publish({
          name: options.name,
          type: MDNS_SERVICE_TYPE,
          port: options.wsPort,
          txt: {
            host: options.hostIp,
            ws: String(options.wsPort),
            tcp: String(options.tcpPort),
            http: String(options.httpPort),
          },
        }),
      );
      console.log(`[bridge] mDNS _${MDNS_SERVICE_TYPE}._tcp on port ${options.wsPort}`);
    }
  } catch (err) {
    console.warn("[bridge] mDNS advertise failed:", err);
  }

  return {
    stop: () => {
      try {
        for (const service of services) service.stop();
        bonjour.destroy();
      } catch {
        /* ignore */
      }
    },
  };
}
