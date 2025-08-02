import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config, Project, RokuDevice } from '../types';

export class ConfigManager {
    private configPath: string;
    private config: Config = {
        rokuDevice: { ip: '', password: '' },
        projects: []
    };

    constructor() {
        const configDir = path.join(os.homedir(), '.roku-pkg');
        this.configPath = path.join(configDir, 'config.json');
        
        // Ensure config directory exists
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        
        this.loadConfig();
    }

    private loadConfig(): void {
        if (fs.existsSync(this.configPath)) {
            const data = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(data);
        } else {
            this.config = {
                rokuDevice: { ip: '', password: '' },
                projects: []
            };
            this.saveConfig();
        }
    }

    private saveConfig(): void {
        fs.writeFileSync(
            this.configPath,
            JSON.stringify(this.config, null, 2)
        );
    }

    getConfig(): Config {
        return this.config;
    }

    getRokuDevice(): RokuDevice {
        return this.config.rokuDevice;
    }

    setRokuDevice(device: RokuDevice): void {
        this.config.rokuDevice = device;
        this.saveConfig();
    }

    getProjects(): Project[] {
        return this.config.projects;
    }

    getProject(name: string): Project | undefined {
        return this.config.projects.find(p => p.name === name);
    }

    addProject(project: Project): void {
        this.config.projects.push(project);
        this.saveConfig();
    }

    updateProject(name: string, updates: Partial<Project>): boolean {
        const index = this.config.projects.findIndex(p => p.name === name);
        if (index !== -1) {
            this.config.projects[index] = {
                ...this.config.projects[index],
                ...updates
            };
            this.saveConfig();
            return true;
        }
        return false;
    }

    removeProject(name: string): boolean {
        const index = this.config.projects.findIndex(p => p.name === name);
        if (index !== -1) {
            this.config.projects.splice(index, 1);
            this.saveConfig();
            return true;
        }
        return false;
    }
} 