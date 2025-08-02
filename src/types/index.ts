export interface RokuDevice {
    ip: string;
    password: string;
    name?: string;
    modelName?: string;
    serialNumber?: string;
    softwareVersion?: string;
}

export interface DiscoveredDevice {
    ip: string;
    name: string;
    modelName: string;
    serialNumber: string;
    softwareVersion?: string;
    deviceType?: string;
}

export interface Project {
    name: string;
    rootDir: string;  // Root directory of the Roku app source code
    signKey: string;
    signPackageLocation: string;
    outputLocation: string;
    files?: string[];  // Optional file patterns to include in build
}

export interface Config {
    rokuDevice: RokuDevice;
    projects: Project[];
} 