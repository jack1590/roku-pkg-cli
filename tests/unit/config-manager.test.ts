import { ConfigManager } from '../../src/lib/config-manager';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');

describe('ConfigManager', () => {
    const mockConfigPath = path.join(process.cwd(), 'roku-pkg-config.json');
    const mockConfig = {
        rokuDevice: { ip: '192.168.1.100', password: 'test123' },
        projects: [
            {
                name: 'TestApp',
                signKey: 'testkey123',
                signPackageLocation: '/test/package.pkg',
                outputLocation: './output/test.pkg'
            }
        ]
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should load existing config file', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

            const configManager = new ConfigManager();

            expect(fs.existsSync).toHaveBeenCalledWith(mockConfigPath);
            expect(fs.readFileSync).toHaveBeenCalledWith(mockConfigPath, 'utf8');
        });

        it('should create default config if file does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            (fs.writeFileSync as jest.Mock).mockImplementation(() => { });

            const configManager = new ConfigManager();

            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    describe('getRokuDevice', () => {
        it('should return roku device configuration', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

            const configManager = new ConfigManager();
            const device = configManager.getRokuDevice();

            expect(device).toEqual(mockConfig.rokuDevice);
        });
    });

    describe('getProjects', () => {
        it('should return all projects', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

            const configManager = new ConfigManager();
            const projects = configManager.getProjects();

            expect(projects).toEqual(mockConfig.projects);
        });
    });

    describe('addProject', () => {
        it('should add a new project', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));
            (fs.writeFileSync as jest.Mock).mockImplementation(() => { });

            const configManager = new ConfigManager();
            const newProject = {
                name: 'NewApp',
                signKey: 'newkey456',
                signPackageLocation: '/new/package.pkg',
                outputLocation: './output/new.pkg'
            };

            configManager.addProject(newProject);

            expect(fs.writeFileSync).toHaveBeenCalled();
        });
    });

    describe('removeProject', () => {
        it('should remove an existing project', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));
            (fs.writeFileSync as jest.Mock).mockImplementation(() => { });

            const configManager = new ConfigManager();
            const result = configManager.removeProject('TestApp');

            expect(result).toBe(true);
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        it('should return false when removing non-existent project', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));

            const configManager = new ConfigManager();
            const result = configManager.removeProject('NonExistent');

            expect(result).toBe(false);
        });
    });
}); 