import * as dgram from 'dgram';
import axios from 'axios';
import { DiscoveredDevice } from '../types';

export class RokuDiscovery {
    private static readonly SSDP_MULTICAST_IP = '239.255.255.250';
    private static readonly SSDP_PORT = 1900;
    private static readonly ROKU_ECP_PORT = 8060;
    private static readonly DISCOVERY_TIMEOUT = 5000;

    /**
     * Discover Roku devices using SSDP (Simple Service Discovery Protocol)
     */
    static async discoverDevices(): Promise<DiscoveredDevice[]> {
        const devices = new Map<string, DiscoveredDevice>();

        // Try both SSDP and network scanning for better discovery
        const [ssdpDevices, networkDevices] = await Promise.allSettled([
            this.discoverViaSsdp(),
            this.discoverViaNetworkScan()
        ]);

        // Combine results from both methods
        if (ssdpDevices.status === 'fulfilled') {
            ssdpDevices.value.forEach(device => {
                devices.set(device.ip, device);
            });
        }

        if (networkDevices.status === 'fulfilled') {
            networkDevices.value.forEach(device => {
                // Merge with existing device info if found via SSDP
                const existing = devices.get(device.ip);
                if (existing) {
                    devices.set(device.ip, { ...existing, ...device });
                } else {
                    devices.set(device.ip, device);
                }
            });
        }

        return Array.from(devices.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Discover Roku devices using SSDP
     */
    private static async discoverViaSsdp(): Promise<DiscoveredDevice[]> {
        return new Promise((resolve) => {
            const devices = new Map<string, DiscoveredDevice>();
            const socket = dgram.createSocket('udp4');

            const searchMessage = [
                'M-SEARCH * HTTP/1.1',
                `HOST: ${this.SSDP_MULTICAST_IP}:${this.SSDP_PORT}`,
                'MAN: "ssdp:discover"',
                'MX: 3',
                'ST: roku:ecp',
                '',
                ''
            ].join('\r\n');

            socket.on('message', async (msg, remote) => {
                const response = msg.toString();
                if (response.includes('roku:ecp') && response.includes('LOCATION:')) {
                    const locationMatch = response.match(/LOCATION:\s*(.+)/i);
                    if (locationMatch) {
                        const location = locationMatch[1].trim();
                        try {
                            const device = await this.getDeviceInfo(location);
                            if (device) {
                                devices.set(device.ip, device);
                            }
                        } catch (error) {
                            // Ignore individual device errors
                        }
                    }
                }
            });

            socket.on('error', () => {
                // Ignore socket errors, just resolve with what we have
            });

            socket.bind(() => {
                socket.setBroadcast(true);
                socket.send(
                    searchMessage,
                    this.SSDP_PORT,
                    this.SSDP_MULTICAST_IP,
                    () => {
                        setTimeout(() => {
                            socket.close();
                            resolve(Array.from(devices.values()));
                        }, this.DISCOVERY_TIMEOUT);
                    }
                );
            });
        });
    }

    /**
     * Discover Roku devices by scanning common network ranges
     */
    private static async discoverViaNetworkScan(): Promise<DiscoveredDevice[]> {
        const devices: DiscoveredDevice[] = [];
        const networkRanges = this.getNetworkRanges();

        // Check each potential IP in parallel (limited concurrency)
        const checkPromises: Promise<DiscoveredDevice | null>[] = [];

        for (const range of networkRanges) {
            for (let i = 1; i <= 254; i++) {
                const ip = `${range}.${i}`;
                checkPromises.push(this.checkIfRokuDevice(ip));
            }
        }

        // Process in chunks to avoid overwhelming the network
        const chunkSize = 50;
        for (let i = 0; i < checkPromises.length; i += chunkSize) {
            const chunk = checkPromises.slice(i, i + chunkSize);
            const results = await Promise.allSettled(chunk);

            results.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    devices.push(result.value);
                }
            });
        }

        return devices;
    }

    /**
     * Get common network ranges to scan
     */
    private static getNetworkRanges(): string[] {
        // Common private network ranges
        const ranges = [
            '192.168.1',
            '192.168.0',
            '10.0.0',
            '10.0.1',
            '172.16.0'
        ];

        // Try to detect current network range
        const os = require('os');
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            const netInterface = interfaces[name];
            if (netInterface) {
                for (const net of netInterface) {
                    if (net.family === 'IPv4' && !net.internal) {
                        const parts = net.address.split('.');
                        if (parts.length === 4) {
                            const networkBase = `${parts[0]}.${parts[1]}.${parts[2]}`;
                            if (!ranges.includes(networkBase)) {
                                ranges.unshift(networkBase); // Add to front for priority
                            }
                        }
                    }
                }
            }
        }

        return ranges;
    }

    /**
     * Check if an IP address has a Roku device
     */
    private static async checkIfRokuDevice(ip: string): Promise<DiscoveredDevice | null> {
        try {
            const response = await axios.get(`http://${ip}:${this.ROKU_ECP_PORT}/query/device-info`, {
                timeout: 2000,
                validateStatus: (status) => status === 200
            });

            if (response.data && response.data.includes('<device-info>')) {
                return this.parseDeviceInfo(ip, response.data);
            }
        } catch (error) {
            // Device not found or not a Roku
        }
        return null;
    }

    /**
     * Get device info from SSDP location URL
     */
    private static async getDeviceInfo(location: string): Promise<DiscoveredDevice | null> {
        try {
            // Extract IP from location URL
            const urlMatch = location.match(/http:\/\/([^:\/]+)/);
            if (!urlMatch) return null;

            const ip = urlMatch[1];
            const deviceInfoResponse = await axios.get(`http://${ip}:${this.ROKU_ECP_PORT}/query/device-info`, {
                timeout: 3000
            });

            if (deviceInfoResponse.data) {
                return this.parseDeviceInfo(ip, deviceInfoResponse.data);
            }
        } catch (error) {
            // Ignore errors
        }
        return null;
    }

    /**
     * Parse device info XML response
     */
    private static parseDeviceInfo(ip: string, xmlData: string): DiscoveredDevice | null {
        try {
            // Simple XML parsing without external dependencies
            const getValue = (tag: string): string => {
                const match = xmlData.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`));
                return match ? match[1].trim() : '';
            };

            const friendlyName = getValue('friendly-device-name') || getValue('user-device-name') || `Roku-${ip}`;
            const modelName = getValue('model-name') || getValue('model-number') || 'Unknown Roku';
            const serialNumber = getValue('serial-number') || 'Unknown';
            const softwareVersion = getValue('software-version');
            const deviceType = getValue('device-type');

            return {
                ip,
                name: friendlyName,
                modelName,
                serialNumber,
                softwareVersion,
                deviceType
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Test if a discovered device is reachable and responding
     */
    static async testDevice(device: DiscoveredDevice): Promise<boolean> {
        try {
            const response = await axios.get(`http://${device.ip}:${this.ROKU_ECP_PORT}/query/device-info`, {
                timeout: 3000
            });
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }
}